import { describe, expect, it } from 'vitest';
import { courseProgress } from './management.utils';

const superior = { level: 'SUPERIOR' as const, durationYears: 4 };
const medio = { level: 'MEDIO' as const, durationYears: 3 };

describe('courseProgress', () => {
  it('calcula o período do superior e a formatura no último semestre do curso', () => {
    expect(courseProgress(2026, 0, superior, '2026-03-10')).toEqual({
      stage: '1º período',
      expectedGraduation: '2029/2',
      overdue: false,
    });
    expect(courseProgress(2026, 0, superior, '2026-06-30').stage).toBe('1º período');
    expect(courseProgress(2026, 0, superior, '2026-07-01').stage).toBe('2º período');
    expect(courseProgress(2026, 0, superior, '2029-12-31')).toMatchObject({
      stage: '8º período',
      overdue: false,
    });
  });

  it('calcula o ano do ensino médio', () => {
    expect(courseProgress(2026, 0, medio, '2026-02-01').stage).toBe('1º ano');
    expect(courseProgress(2026, 0, medio, '2026-08-01').stage).toBe('1º ano');
    expect(courseProgress(2026, 0, medio, '2027-08-01').stage).toBe('2º ano');
    expect(courseProgress(2026, 0, medio, '2028-03-01')).toEqual({
      stage: '3º ano',
      expectedGraduation: '2028/2',
      overdue: false,
    });
  });

  it('cada semestre de prorrogação adia a formatura em seis meses', () => {
    expect(courseProgress(2026, 1, medio, '2026-03-01').expectedGraduation).toBe('2029/1');
    expect(courseProgress(2026, 2, medio, '2026-03-01').expectedGraduation).toBe('2029/2');
  });

  it('indica ingresso futuro e prazo vencido', () => {
    expect(courseProgress(2027, 0, superior, '2026-11-11')).toEqual({
      stage: 'Ingressa em 2027',
      expectedGraduation: '2030/2',
      overdue: false,
    });
    expect(courseProgress(2020, 0, superior, '2024-01-15')).toEqual({
      stage: '9º período',
      expectedGraduation: '2023/2',
      overdue: true,
    });
    expect(courseProgress(2020, 1, superior, '2024-01-15').overdue).toBe(false);
  });

  it('devolve nulos quando falta ano de ingresso, nível ou duração', () => {
    const empty = { stage: null, expectedGraduation: null, overdue: null };
    expect(courseProgress(null, 0, superior, '2026-03-10')).toEqual(empty);
    expect(courseProgress(2026, 0, undefined, '2026-03-10')).toEqual(empty);
    expect(courseProgress(2026, 0, { level: null, durationYears: 4 }, '2026-03-10')).toEqual(empty);
    expect(courseProgress(2026, 0, { level: 'MEDIO', durationYears: null }, '2026-03-10')).toEqual(
      empty,
    );
  });
});
