import { describe, expect, it } from 'vitest';
import { LongExitInput } from './long-exit.models';
import { longExitFormError } from './long-exit.utils';

const now = '2026-09-30T16:00:00Z';
const input: LongExitInput = {
  guardianId: 'responsavel-elegivel',
  departureMode: 'SCHEDULED',
  requestedDepartureAt: now,
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
  it('usa o instante do servidor para NOW e não aceita agendamento passado', () => {
    expect(
      longExitFormError({ ...input, departureMode: 'NOW', requestedDepartureAt: undefined }, now),
    ).toBe('');
    expect(longExitFormError(input, '2026-09-30T16:00:01Z')).toContain(
      'horário informado pelo servidor',
    );
  });
  it('exige responsável escolhido e retorno posterior', () => {
    expect(longExitFormError({ ...input, guardianId: '' }, now)).toContain('responsável elegível');
    expect(longExitFormError({ ...input, expectedReturnAt: now }, now)).toContain('posterior');
    expect(longExitFormError({ ...input, reason: '  ' }, now)).toContain('motivo');
  });
});
