import { describe, expect, it } from 'vitest';
import { ShortExitInput } from './operations-local.models';
import {
  formatOperationsTime,
  saoPauloInput,
  saoPauloInstant,
  shortExitFormError,
  validJustification,
} from './operations-local.utils';

const now = '2026-09-30T16:00:00Z';
const input: ShortExitInput = {
  departureMode: 'SCHEDULED',
  requestedDepartureAt: now,
  expectedReturnAt: '2026-09-30T19:00:00Z',
  reason: 'Buscar material escolar',
  notes: null,
};

describe('Horários e regras das operações locais', () => {
  it('converte horário civil de São Paulo para instante UTC e faz a conversão inversa', () => {
    expect(saoPauloInstant('2026-09-30T13:00')).toBe('2026-09-30T16:00:00.000Z');
    expect(saoPauloInput('2026-10-01T01:30:00Z')).toBe('2026-09-30T22:30');
    expect(formatOperationsTime('2026-10-01T01:30:00Z')).toContain('30/09/2026');
    expect(formatOperationsTime('2026-10-01T01:30:00Z')).toContain('22:30');
  });
  it('rejeita datas impossíveis, horários inválidos e ausência de formato civil', () => {
    for (const value of [
      '2026-02-30T13:00',
      '2026-09-30T24:00',
      '2026-00-30T13:00',
      '2026-09-00T13:00',
      '30/09/2026 13:00',
      '',
    ])
      expect(saoPauloInstant(value)).toBeNull();
    expect(saoPauloInstant('2028-02-29T13:00')).toBe('2028-02-29T16:00:00.000Z');
  });
  it('respeita o fuso histórico e rejeita horário inexistente no início do horário de verão', () => {
    expect(saoPauloInstant('2018-12-01T13:00')).toBe('2018-12-01T15:00:00.000Z');
    expect(saoPauloInstant('2018-11-04T00:30')).toBeNull();
  });
  it('aceita duração exata de 3 horas e exige retorno posterior à saída', () => {
    expect(shortExitFormError(input, now)).toBe('');
    expect(shortExitFormError({ ...input, expectedReturnAt: now }, now)).toContain('posterior');
    expect(
      shortExitFormError({ ...input, expectedReturnAt: '2026-09-30T19:00:01Z' }, now),
    ).toContain('3 horas');
  });
  it('usa o horário do servidor para NOW e para o limite da saída agendada', () => {
    expect(
      shortExitFormError({ ...input, departureMode: 'NOW', requestedDepartureAt: undefined }, now),
    ).toBe('');
    expect(shortExitFormError(input, '2026-09-30T16:00:01Z')).toContain(
      'horário informado pelo servidor',
    );
    expect(
      shortExitFormError({ ...input, departureMode: 'NOW' }, '2026-09-30T19:00:01Z'),
    ).toContain('posterior');
  });
  it('valida motivo, observação e justificativa sem aceitar apenas espaços', () => {
    expect(shortExitFormError({ ...input, reason: '   ' }, now)).toContain('motivo');
    expect(shortExitFormError({ ...input, notes: 'a'.repeat(2001) }, now)).toContain('observações');
    expect(validJustification(' nove ')).toBe(false);
    expect(validJustification('Motivo institucional informado.')).toBe(true);
    expect(validJustification('a'.repeat(501))).toBe(false);
  });
});
