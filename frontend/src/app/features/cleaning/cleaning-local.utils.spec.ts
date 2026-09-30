import { describe, expect, it } from 'vitest';
import {
  cleaningInputError,
  cleaningPlan,
  previewCleaningScore,
  validCriteria,
} from './cleaning-local.utils';
import { CleaningCriteria } from './cleaning-local.models';
import { CommunicationIntent } from '../communications/communications-local.utils';

const criteria: CleaningCriteria = { PISO: 0.1, SUPERFICIES: 0, RESIDUOS: 0, ORGANIZACAO: 0 };
describe('Política local de limpeza', () => {
  it('calcula a prévia HALF_UP nos pontos intermediários e respeita zero sem valor inventado', () => {
    expect(previewCleaningScore(criteria)).toBe(0.03);
    expect(previewCleaningScore({ ...criteria, PISO: 0.3 })).toBe(0.08);
    expect(previewCleaningScore({ ...criteria, PISO: 0 })).toBe(0);
    expect(previewCleaningScore({ PISO: 10, SUPERFICIES: 10, RESIDUOS: 10, ORGANIZACAO: 10 })).toBe(
      10,
    );
  });
  it('exige quatro critérios com notas finitas em décimos entre zero e dez', () => {
    for (const value of [
      { ...criteria, PISO: null },
      { ...criteria, PISO: 0.01 },
      { ...criteria, PISO: 10.1 },
      { ...criteria, PISO: NaN },
      { ...criteria, extra: 1 },
      { PISO: 1 },
    ])
      expect(validCriteria(value)).toBe(false);
    expect(validCriteria(criteria)).toBe(true);
  });
  it('omitte hora e justificativa no modo agora e valida retrospectivo pelo relógio do servidor', () => {
    const input = cleaningPlan(
      'room',
      'NOW',
      criteria,
      '  registro  ',
      '2099-01-01T00:00',
      'ignorada',
    );
    expect(input).toEqual({ roomId: 'room', timeMode: 'NOW', criteria, observation: 'registro' });
    const retro = cleaningPlan(
      'room',
      'RETROACTIVE',
      criteria,
      '',
      '2026-09-30T13:00',
      'Avaliação conferida presencialmente.',
    );
    expect(retro.evaluatedAt).toBe('2026-09-30T16:00:00.000Z');
    expect(cleaningInputError(retro, '2026-09-30T15:59:59Z')).toContain('futuro');
    expect(cleaningInputError(retro, '2026-09-30T16:00:00Z')).toBe('');
    expect(
      cleaningInputError({ ...retro, registrationReason: 'curta' }, '2026-09-30T16:00:00Z'),
    ).toContain('10');
  });
  it('preserva a intenção de registro na repetição manual e renova quando os critérios mudam', () => {
    const intent = new CommunicationIntent();
    const key = intent.for(criteria);
    expect(intent.for({ ...criteria })).toBe(key);
    expect(intent.for({ ...criteria, PISO: 1 })).not.toBe(key);
  });
});
