import { describe, expect, it } from 'vitest';
import { OperationsDemoService } from './operations-demo.service';

const dateAt = (hoursFromNow: number) =>
  new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();

describe('OperationsDemoService: critical operation rules', () => {
  it('accepts exactly three hours for a short exit and rejects a longer return, including edits', () => {
    const service = new OperationsDemoService();
    const departure = dateAt(5);
    const threeHours = new Date(Date.parse(departure) + 3 * 3_600_000).toISOString();
    const tooLate = new Date(Date.parse(threeHours) + 60_000).toISOString();
    const request = service.createExit({
      kind: 'Curta',
      departure,
      expectedReturn: threeHours,
      reason: 'Compromisso',
      notes: '',
    });
    expect(request.status).toBe('Aguardando análise');
    expect(() =>
      service.createExit({
        kind: 'Curta',
        departure,
        expectedReturn: tooLate,
        reason: 'Compromisso',
        notes: '',
      }),
    ).toThrow(/três horas/);
    expect(() =>
      service.updateExit(request.id, {
        kind: 'Curta',
        departure,
        expectedReturn: tooLate,
        reason: 'Compromisso',
        notes: '',
      }),
    ).toThrow(/três horas/);
    expect(service.getExit(request.id)?.expectedReturn).toBe(threeHours);
  });

  it('rejects a long exit of three hours or less and accepts one minute more', () => {
    const service = new OperationsDemoService();
    const departure = dateAt(5);
    const threeHours = new Date(Date.parse(departure) + 3 * 3_600_000).toISOString();
    const longer = new Date(Date.parse(threeHours) + 60_000).toISOString();
    const input = { kind: 'Longa' as const, departure, reason: 'Visita', notes: '' };
    expect(() => service.createExit({ ...input, expectedReturn: threeHours })).toThrow(
      /mais de três horas/,
    );
    expect(service.createExit({ ...input, expectedReturn: longer }).status).toBe(
      'Aguardando autorização',
    );
  });

  it('blocks approval until a received file is confirmed and keeps confirmation separate from approval', () => {
    const service = new OperationsDemoService();
    expect(service.decideExit('S-1048', 'approve')).toBe(false);
    expect(service.confirmAuthorization('S-1048')).toBe(false);
    expect(service.getExit('S-1048')?.status).toBe('Aguardando autorização');
    expect(service.simulateReceivedFile('S-1048')).toBe(true);
    expect(service.simulateReceivedFile('S-1048')).toBe(false);
    expect(service.decideExit('S-1048', 'approve')).toBe(false);
    expect(service.getExit('S-1048')?.status).toBe('Aguardando autorização');
    expect(service.confirmAuthorization('S-1048')).toBe(true);
    expect(service.getExit('S-1048')?.status).toBe('Aguardando análise');
    expect(service.decideExit('S-1048', 'approve')).toBe(true);
    expect(service.getExit('S-1048')?.status).toBe('Aprovada');
  });

  it('rejects a long exit before the confirmation only with 10 to 2,000 characters', () => {
    const service = new OperationsDemoService();
    expect(service.decideExit('S-1048', 'reject', 'a'.repeat(9))).toBe(false);
    expect(service.decideExit('S-1048', 'reject', 'a'.repeat(2001))).toBe(false);
    expect(service.getExit('S-1048')?.status).toBe('Aguardando autorização');
    expect(service.decideExit('S-1048', 'approve')).toBe(false);
    expect(service.decideExit('S-1048', 'reject', 'Sem vaga.!')).toBe(true);
    expect(service.getExit('S-1048')?.status).toBe('Rejeitada');
    expect(service.getExit('S-1048')?.timeline.at(-1)?.detail).toBe('Sem vaga.!');
  });

  it('offers resend only after a simulated delivery failure', () => {
    const service = new OperationsDemoService();
    expect(service.resendLongExit('S-1048', 'Tentativa adicional')).toBe(false);
    expect(service.getExit('S-1048')?.messageState).toBe('Enviada');
    expect(service.resendLongExit('S-1046', '')).toBe(false);
    expect(service.resendLongExit('S-1046', 'Providência registrada com o responsável.')).toBe(
      true,
    );
    expect(service.getExit('S-1046')?.messageState).toBe('Enviada');
  });

  it('starts residents with an ongoing exit as justified by the system, and lets the supervisor correct', () => {
    const service = new OperationsDemoService();
    expect(service.callSummary()).toMatchObject({ marked: 1, justified: 1 });
    expect(service.attendance().find((entry) => entry.residentId === 'res-002')).toEqual({
      residentId: 'res-002',
      mark: 'Ausência justificada',
      system: true,
    });
    service.setAttendanceMark('res-002', 'Presente');
    expect(service.callSummary()).toMatchObject({ marked: 1, justified: 0, present: 1 });
    expect(service.attendance().find((entry) => entry.residentId === 'res-002')?.system).toBe(
      undefined,
    );
  });

  it('requires every minor resident to be marked before finishing the call', () => {
    const service = new OperationsDemoService();
    expect(service.completeCall(false)).toBe(false);
    service.minors.forEach((resident) => service.setAttendanceMark(resident.id, 'Presente'));
    expect(service.completeCall(true)).toBe(true);
    expect(service.callSummary().marked).toBe(service.minors.length);
    expect(service.callLate()).toBe(true);
  });

  it('requires an observation for a delayed return without creating a warning automatically', () => {
    const service = new OperationsDemoService();
    const item = service.getExit('S-1047')!;
    service.exits.update((items) =>
      items.map((entry) =>
        entry.id === item.id ? { ...entry, expectedReturn: dateAt(-0.5) } : entry,
      ),
    );
    const actual = new Date().toISOString();
    expect(service.confirmReturn(item.id, actual, '')).toBe(false);
    expect(
      service.confirmReturn(item.id, actual, 'Chegada presencial confirmada após o previsto.'),
    ).toBe(true);
    expect(service.getExit(item.id)?.status).toBe('Retorno confirmado com atraso');
    expect(service.warnings()).toHaveLength(0);
  });

  it('keeps internal notification distinct from a manually registered warning', () => {
    const service = new OperationsDemoService();
    expect(service.warnings()).toHaveLength(0);
    expect(service.archiveNotification('N-201', '')).toBe(false);
    expect(
      service.convertNotification('N-201', {
        description: 'Ocorrência analisada',
        date: new Date().toISOString().slice(0, 10),
        severity: 'Descrição demonstrativa',
        justification: 'Decisão humana registrada para demonstração.',
      }),
    ).toBe(true);
    expect(service.getNotification('N-201')?.status).toBe('Convertida em advertência');
    expect(service.warnings()[0].notificationId).toBe('N-201');
  });
});
