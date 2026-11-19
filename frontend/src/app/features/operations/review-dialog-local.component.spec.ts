import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import {
  LocalOperationsReviewDialogComponent,
  LocalReviewData,
} from './review-dialog-local.component';

function create(data: Partial<LocalReviewData>) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: { title: 'Revisão', action: 'Confirmar', lines: [], ...data },
      },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new LocalOperationsReviewDialogComponent());
  return { component, close };
}
const physical: NonNullable<LocalReviewData['physical']> = {
  action: 'retorno',
  now: '2026-09-30T20:00:00Z',
  minimum: '2026-09-30T16:00:00Z',
  expectedReturnAt: '2026-09-30T19:00:00Z',
  version: 4,
};

async function render(data: Partial<LocalReviewData>): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: { title: 'Revisão', action: 'Confirmar', lines: [], ...data },
      },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(LocalOperationsReviewDialogComponent);
  await fixture.whenStable();
  return fixture.nativeElement;
}
const buttons = (element: HTMLElement) =>
  Array.from(element.querySelectorAll('button')).map((button) => ({
    name: button.textContent?.trim(),
    className: button.className,
  }));

describe('Revisão das operações locais', () => {
  it('cancelar pedido: "Voltar" fecha e "Cancelar pedido" confirma em vermelho, sem texto fixo', async () => {
    const element = await render({
      title: 'O pedido será cancelado.',
      action: 'Cancelar pedido',
      requireReason: true,
      danger: true,
    });
    expect(buttons(element)).toEqual([
      { name: 'Voltar', className: 'btn op-secondary' },
      { name: 'Cancelar pedido', className: 'btn-danger' },
    ]);
    expect(element.textContent).not.toContain('Confira os dados antes de confirmar');
  });
  it('aprovar mostra a nota de que a saída é registrada depois, sem tom de alerta', async () => {
    const element = await render({
      title: 'A saída será aprovada.',
      action: 'Confirmar aprovação',
      note: 'Aprovar não registra a saída; ela é registrada quando o residente se apresentar.',
      comment: true,
    });
    const note = element.querySelector('p.op-help');
    expect(note?.textContent?.trim()).toBe(
      'Aprovar não registra a saída; ela é registrada quando o residente se apresentar.',
    );
    expect(note?.getAttribute('role')).toBeNull();
    expect(element.querySelector('[role=alert]')).toBeNull();
  });
  it('conferir autorização mantém "Cancelar" e o botão principal', async () => {
    const element = await render({ action: 'Confirmar conferência' });
    expect(buttons(element)).toEqual([
      { name: 'Cancelar', className: 'btn op-secondary' },
      { name: 'Confirmar conferência', className: 'btn op-primary' },
    ]);
  });
  it('registrar volta no horário mostra só a orientação de ver o residente', async () => {
    const element = await render({
      title: 'Conferir volta',
      action: 'Confirmar volta',
      warning: 'Veja o residente pessoalmente antes de confirmar a volta.',
      physical: { ...physical, now: '2026-09-30T18:00:00Z' },
    });
    expect(element.querySelectorAll('.op-help, .op-warning')).toHaveLength(1);
  });
  it('aceita justificativa de 10 a 2.000 caracteres, como o servidor', async () => {
    const short = create({ requireReason: true });
    short.component.reason.setValue('a'.repeat(9));
    short.component.confirm();
    expect(short.close).not.toHaveBeenCalled();
    expect(short.component.error()).toBe('Informe uma justificativa com 10 a 2.000 caracteres.');

    TestBed.resetTestingModule();
    const long = create({ requireReason: true });
    long.component.reason.setValue('a'.repeat(2000));
    long.component.confirm();
    expect(long.close).toHaveBeenCalledWith({ reason: 'a'.repeat(2000), confirmed: false });

    const fixture = TestBed.createComponent(LocalOperationsReviewDialogComponent);
    await fixture.whenStable();
    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea');
    expect(textarea?.getAttribute('maxlength')).toBe('2000');
  });
  it('não confirma registro fora da janela sem ciência expressa e justificativa válida', () => {
    const { component, close } = create({ requireReason: true, requireConfirmation: true });
    component.confirm();
    expect(close).not.toHaveBeenCalled();
    component.reason.setValue('Registro após a ronda presencial.');
    component.confirm();
    expect(close).not.toHaveBeenCalled();
    component.confirmation.setValue(true);
    component.confirm();
    expect(close).toHaveBeenCalledWith({
      reason: 'Registro após a ronda presencial.',
      confirmed: true,
    });
  });
  it('registra NOW somente com a modalidade e exige observação quando o relógio do servidor indica atraso', () => {
    const { component, close } = create({ physical });
    component.confirm();
    expect(close).not.toHaveBeenCalled();
    component.lateObservation.setValue('Retorno atrasado por problema no transporte.');
    component.confirm();
    expect(close).toHaveBeenCalledWith({
      reason: '',
      confirmed: false,
      physical: {
        version: 4,
        timeMode: 'NOW',
        lateObservation: 'Retorno atrasado por problema no transporte.',
      },
    });
  });
  it('aceita retorno retroativo superior a 3 horas, preservando instante UTC e motivo', () => {
    const { component, close } = create({ physical });
    component.timeMode.setValue('RETROACTIVE');
    component.time.setValue('2026-09-30T16:30');
    component.reason.setValue('Retorno conferido no livro de portaria.');
    component.lateObservation.setValue('O transporte atrasou o retorno ao campus.');
    component.confirm();
    expect(close).toHaveBeenCalledWith(
      expect.objectContaining({
        physical: {
          version: 4,
          timeMode: 'RETROACTIVE',
          occurredAt: '2026-09-30T19:30:00.000Z',
          justification: 'Retorno conferido no livro de portaria.',
          lateObservation: 'O transporte atrasou o retorno ao campus.',
        },
      }),
    );
  });
  it('rejeita retorno anterior ou igual à partida e horário futuro em relação ao servidor', () => {
    const { component, close } = create({ physical });
    component.timeMode.setValue('RETROACTIVE');
    component.reason.setValue('Registro presencial conferido.');
    component.time.setValue('2026-09-30T13:00');
    component.confirm();
    expect(close).not.toHaveBeenCalled();
    expect(component.error()).toContain('depois da saída');
    component.time.setValue('2026-09-30T17:01');
    component.confirm();
    expect(close).not.toHaveBeenCalled();
    expect(component.error()).toContain('futuro');
  });
  it('exige escolha explícita entre múltiplas saídas autorizadas', () => {
    const { component, close } = create({
      initialMark: 'AUSENCIA_JUSTIFICADA',
      authorizedExits: [
        { id: 'curta', type: 'SHORT' },
        { id: 'longa', type: 'LONG' },
      ],
    });
    component.confirm();
    expect(close).not.toHaveBeenCalled();
    component.authorizedExit.setValue('curta');
    component.confirm();
    expect(close).toHaveBeenCalledWith(
      expect.objectContaining({
        mark: 'AUSENCIA_JUSTIFICADA',
        authorizedExit: { id: 'curta', type: 'SHORT' },
      }),
    );
  });
});
