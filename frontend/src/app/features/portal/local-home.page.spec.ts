import { describe, expect, it } from 'vitest';
import { msUntilNextMidnight } from './local-home.page';

describe('msUntilNextMidnight', () => {
  it('conta até a meia-noite de Brasília, não do fuso da máquina', () => {
    // 12:00 UTC = 09:00 em America/Sao_Paulo: faltam 15 horas.
    expect(msUntilNextMidnight(new Date('2026-10-17T12:00:00Z'))).toBe(15 * 3_600_000);
  });

  it('trata o último minuto e a própria meia-noite', () => {
    expect(msUntilNextMidnight(new Date('2026-10-17T23:59:00-03:00'))).toBe(60_000);
    expect(msUntilNextMidnight(new Date('2026-10-18T00:00:00-03:00'))).toBe(86_400_000);
  });
});
