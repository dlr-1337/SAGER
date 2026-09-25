import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from './demo-session.service';

describe('DemoSessionService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('restaura somente o papel de demonstração na mesma aba', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });

    const session = new DemoSessionService();
    expect(session.role()).toBe('supervisor');
    session.setRole('residente');
    session.setScenario('erro');

    const reloaded = new DemoSessionService();
    expect(reloaded.role()).toBe('residente');
    expect(reloaded.scenario()).toBe('padrao');
    expect([...values.keys()]).toEqual(['sager.demo.role']);
  });

  it('usa supervisor se o valor salvo for inválido ou o armazenamento falhar', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => 'perfil-desconhecido',
      setItem: () => { throw new Error('armazenamento indisponível'); },
    });
    const session = new DemoSessionService();
    expect(session.role()).toBe('supervisor');
    expect(() => session.setRole('gestor')).not.toThrow();
    expect(session.role()).toBe('gestor');
  });
});
