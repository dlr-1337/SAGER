import { describe, expect, it, vi } from 'vitest';
import { ShortExitInput } from './operations-local.models';
import {
  departureMinimum,
  exitStatusLabel,
  formatDuration,
  isOverdue,
  formatOperationsTime,
  minutesAfter,
  nextReturn,
  periodHint,
  saoPauloInput,
  saoPauloInstant,
  serverClock,
  shortExitFormError,
  shortPeriodError,
  validJustification,
} from './operations-local.utils';

const now = '2026-09-30T16:00:00Z';
const input: ShortExitInput = {
  departureMode: 'NOW',
  reason: 'Buscar material escolar',
  notes: null,
};

describe('Horários e regras das operações locais', () => {
  it('a partida registrada começa na mais tardia entre a partida pedida e a aprovação', () => {
    const requested = '2026-09-30T17:00:00Z';
    expect(departureMinimum({ requestedDepartureAt: requested, decidedAt: null })).toBe(requested);
    expect(
      departureMinimum({ requestedDepartureAt: requested, decidedAt: '2026-09-30T16:40:00Z' }),
    ).toBe(requested);
    expect(
      departureMinimum({ requestedDepartureAt: requested, decidedAt: '2026-09-30T17:20:00.123Z' }),
    ).toBe('2026-09-30T17:20:00.123Z');
  });
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
  it('aceita o pedido para agora só com o motivo, sem horário (short-exit-two-steps)', () => {
    expect(shortExitFormError(input)).toBe('');
  });
  it('mostra "Atrasada" na saída em andamento depois do retorno previsto (overdue-exit-badge)', () => {
    const exit = { status: 'EM_ANDAMENTO' as const, expectedReturnAt: now, now };
    expect(isOverdue({ ...exit, now: '2026-09-30T15:59:59Z' })).toBe(false);
    expect(exitStatusLabel({ ...exit, now: '2026-09-30T15:59:59Z' })).toBe('Em andamento');
    expect(isOverdue(exit)).toBe(true);
    expect(exitStatusLabel(exit)).toBe('Atrasada');
    expect(exitStatusLabel({ ...exit, status: 'RETORNO_CONFIRMADO_COM_ATRASO' })).toBe(
      'Retorno confirmado com atraso',
    );
  });
  it('limita a saída curta: 1 min e 3 h aceitos, 3 h 01 recusado', () => {
    expect(shortPeriodError(now, minutesAfter(now, 1))).toBe('');
    expect(shortPeriodError(now, minutesAfter(now, 180))).toBe('');
    expect(shortPeriodError(now, minutesAfter(now, 181))).toContain('3 horas');
    expect(shortPeriodError(now, now)).toContain('posterior');
  });
  it('decide o retorno após mudança da partida sem perder edição válida', () => {
    const next = (departure: string | null, current: string | null, edited: boolean) =>
      nextReturn(departure, current, edited, 180, shortPeriodError);
    expect(next(now, minutesAfter(now, 60), false)).toEqual({
      value: minutesAfter(now, 180),
      adjusted: false,
    });
    expect(next(now, minutesAfter(now, 60), true)).toBeNull();
    expect(next(now, minutesAfter(now, 200), true)).toEqual({
      value: minutesAfter(now, 180),
      adjusted: true,
    });
    expect(next(now, null, true)?.adjusted).toBe(false);
    expect(next(null, minutesAfter(now, 60), true)).toBeNull();
    expect(next(null, minutesAfter(now, 60), false)).toEqual({ value: '', adjusted: false });
  });
  it('resume duração e limites em minutos, sem cruzar o limite por causa de segundos', () => {
    expect(formatDuration(150)).toBe('2 h 30 min');
    expect(formatDuration(180)).toBe('3 h');
    expect(formatDuration(45)).toBe('45 min');
    const withSeconds = '2026-09-30T16:00:20Z';
    const hint = periodHint(withSeconds, '2026-09-30T19:01:00Z', 1, 180, shortPeriodError);
    expect(hint).toEqual({
      returnMin: '2026-09-30T13:01',
      returnMax: '2026-09-30T16:00',
      duration: '3 h 1 min',
      error: 'A saída curta deve durar no máximo 3 horas.',
    });
    expect(periodHint(null, null, 1, 180, shortPeriodError).returnMin).toBeNull();
  });
  it('deriva o horário do servidor do tempo decorrido, sem o relógio do dispositivo', () => {
    vi.useFakeTimers({ toFake: ['performance', 'Date'], now: new Date('2001-01-01T00:00:00Z') });
    try {
      const clock = serverClock(now);
      vi.advanceTimersByTime(50 * 60_000);
      expect(clock()).toBe('2026-09-30T16:50:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });
  it('valida motivo, observação e justificativa sem aceitar apenas espaços', () => {
    expect(shortExitFormError({ ...input, reason: '   ' })).toContain('motivo');
    expect(shortExitFormError({ ...input, notes: 'a'.repeat(2001) })).toContain('observações');
    expect(validJustification(' nove ')).toBe(false);
    expect(validJustification('Motivo institucional informado.')).toBe(true);
    expect(validJustification('a'.repeat(2000))).toBe(true);
    expect(validJustification('a'.repeat(2001))).toBe(false);
  });
});
