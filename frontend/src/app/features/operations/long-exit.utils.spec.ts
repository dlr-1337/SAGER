import { describe, expect, it } from 'vitest';
import { LongExitInput } from './long-exit.models';
import { longExitFormError, longPeriodError } from './long-exit.utils';

const now = '2026-09-30T15:59:00Z';
const departure = '2026-09-30T16:00:00Z';
const input: LongExitInput = {
  guardianId: 'responsavel-elegivel',
  departureMode: 'SCHEDULED',
  requestedDepartureAt: departure,
  expectedReturnAt: '2026-09-30T20:00:00Z',
  reason: 'Visita à família',
  notes: null,
};
describe('Plano de saída longa', () => {
  it('aceita mais de três horas e rejeita o limite da saída curta', () => {
    expect(longExitFormError(input, now)).toBe('');
    expect(
      longExitFormError({ ...input, expectedReturnAt: '2026-09-30T19:00:00Z' }, now),
    ).toContain('mais de 3 horas');
    expect(longExitFormError({ ...input, expectedReturnAt: '2026-09-30T19:00:00.001Z' }, now)).toBe(
      '',
    );
  });
  it('limita a duração: 3 h recusada; 3 h 01 e 30 dias aceitos', () => {
    expect(longPeriodError(departure, '2026-09-30T19:00:00Z')).toContain('mais de 3 horas');
    expect(longPeriodError(departure, '2026-09-30T19:01:00Z')).toBe('');
    expect(longPeriodError(departure, '2026-10-30T16:00:00Z')).toBe('');
    expect(longPeriodError(departure, departure)).toContain('depois da saída');
  });
  it('NOW parado perde o limite quando o horário do servidor avança', () => {
    const idle = { ...input, departureMode: 'NOW' as const, requestedDepartureAt: undefined };
    expect(longExitFormError(idle, '2026-09-30T16:00:00Z')).toBe('');
    expect(longExitFormError(idle, '2026-09-30T17:00:00Z')).toContain('mais de 3 horas');
  });
  it('usa o instante do servidor para NOW e não aceita agendamento passado', () => {
    expect(
      longExitFormError({ ...input, departureMode: 'NOW', requestedDepartureAt: undefined }, now),
    ).toBe('');
    expect(longExitFormError(input, '2026-09-30T16:00:01Z')).toContain('depois de agora');
  });
  it('recusa partida agendada igual ao horário do servidor, como o backend', () => {
    expect(longExitFormError(input, departure)).toContain('depois de agora');
  });
  it('exige responsável escolhido e retorno posterior', () => {
    expect(longExitFormError({ ...input, guardianId: '' }, now)).toContain('quem vai autorizar');
    expect(longExitFormError({ ...input, expectedReturnAt: departure }, now)).toContain(
      'depois da saída',
    );
    expect(longExitFormError({ ...input, reason: '  ' }, now)).toContain('motivo');
  });
});
