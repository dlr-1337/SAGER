import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SessionService } from './session.service';
import { DOCUMENT } from '@angular/common';

describe('SessionService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('restaura somente o papel de demonstração na mesma aba', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });

    const session = TestBed.runInInjectionContext(() => new SessionService());
    expect(session.role()).toBe('supervisor');
    session.setRole('residente');
    session.setScenario('erro');

    const reloaded = TestBed.runInInjectionContext(() => new SessionService());
    expect(reloaded.role()).toBe('residente');
    expect(reloaded.scenario()).toBe('padrao');
    expect([...values.keys()]).toEqual(['sager.demo.role']);
  });

  it('usa supervisor se o valor salvo for inválido ou o armazenamento falhar', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => 'perfil-desconhecido',
      setItem: () => {
        throw new Error('armazenamento indisponível');
      },
    });
    const session = TestBed.runInInjectionContext(() => new SessionService());
    expect(session.role()).toBe('supervisor');
    expect(() => session.setRole('gestor')).not.toThrow();
    expect(session.role()).toBe('gestor');
  });

  it('só ativa a demonstração após escolha explícita de perfil', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });

    const session = TestBed.runInInjectionContext(() => new SessionService());
    expect(session.active()).toBe(false);
    session.activate('gestor');
    expect(session.active()).toBe(true);
    expect(session.role()).toBe('gestor');
    expect(values.get('sager.demo.active')).toBe('true');

    const reloaded = TestBed.runInInjectionContext(() => new SessionService());
    expect(reloaded.active()).toBe(true);
    expect(reloaded.role()).toBe('gestor');
    reloaded.deactivate();
    expect(reloaded.active()).toBe(false);
    expect(values.has('sager.demo.active')).toBe(false);
  });

  it('produção recusa demonstração e apaga ativação antiga da mesma aba', () => {
    const values = new Map([['sager.demo.active', 'true']]);
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    const document = TestBed.inject(DOCUMENT);
    const meta = document.createElement('meta');
    meta.name = 'sager-environment';
    meta.content = 'production';
    document.head.append(meta);
    try {
      const session = TestBed.runInInjectionContext(() => new SessionService());
      expect(session.production).toBe(true);
      expect(session.demoAvailable).toBe(false);
      expect(session.active()).toBe(false);
      session.activate('gestor');
      expect(session.active()).toBe(false);
      expect(values.has('sager.demo.active')).toBe(false);
    } finally {
      meta.remove();
    }
  });
});
