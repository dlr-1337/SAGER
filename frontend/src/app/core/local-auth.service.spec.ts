import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, resetSession } from './api';
import { LocalAuthService, SESSION_SIGNAL } from './local-auth.service';

const principal = {
  id: '00000000-0000-0000-0000-000000000001',
  nome: 'Operadora Exemplo',
  email: 'operadora@example.test',
  matricula: 'TESTE-LOGIN',
  fotoUrl: null,
  perfis: ['gestor' as const],
  residenteId: null,
  supervisorId: null,
};

describe('LocalAuthService', () => {
  beforeEach(() => resetSession());
  afterEach(() => vi.unstubAllGlobals());

  it('envia formulário com CSRF e aceita o perfil devolvido por /me', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'csrf-test' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(principal), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const auth = TestBed.inject(LocalAuthService);

    expect(await auth.login(principal.matricula, 'senha de teste')).toBe('success');
    expect(auth.principal()?.perfis).toEqual(['gestor']);
    const [url, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/v1/auth/login');
    expect(request.credentials).toBe('same-origin');
    expect(request.headers).toMatchObject({ 'X-CSRF-TOKEN': 'csrf-test' });
    expect(new URLSearchParams(request.body as string).get('matricula')).toBe(principal.matricula);
    expect(new URLSearchParams(request.body as string).get('password')).toBe('senha de teste');
  });

  it('não conserva principal quando /me nega a sessão', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const auth = TestBed.inject(LocalAuthService);
    auth.principal.set(principal);

    expect(await auth.refresh()).toBeNull();
    expect(auth.principal()).toBeNull();
  });

  it('recusa vínculos ausentes, inválidos ou incompatíveis com o perfil da conta', async () => {
    const { residenteId: _resident, supervisorId: _supervisor, ...withoutLinks } = principal;
    const invalidPrincipals = [
      withoutLinks,
      { ...principal, perfis: ['gestor', 'residente'] },
      { ...principal, residenteId: 'outro-residente', supervisorId: null },
      {
        ...principal,
        residenteId: '00000000-0000-0000-0000-000000000002',
        supervisorId: null,
      },
      { ...principal, residenteId: null, supervisorId: 123 },
      {
        ...principal,
        perfis: ['residente'],
        residenteId: null,
        supervisorId: '00000000-0000-0000-0000-000000000003',
      },
      {
        ...principal,
        perfis: ['residente'],
        residenteId: '00000000-0000-0000-0000-000000000002',
        supervisorId: '00000000-0000-0000-0000-000000000003',
      },
      { ...principal, maiorDeIdade: 'sim' },
    ];
    const auth = TestBed.inject(LocalAuthService);
    for (const value of invalidPrincipals) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(value))));
      expect(await auth.refresh()).toBeNull();
      expect(auth.principal()).toBeNull();
    }
  });

  it('aceita vínculos explícitos e não infere o cadastro a partir do e-mail', async () => {
    const auth = TestBed.inject(LocalAuthService);
    for (const value of [
      principal,
      {
        ...principal,
        perfis: ['residente'],
        residenteId: '00000000-0000-0000-0000-000000000002',
      },
      {
        ...principal,
        perfis: ['residente'],
        residenteId: '00000000-0000-0000-0000-000000000002',
        maiorDeIdade: true,
      },
      {
        ...principal,
        supervisorId: '00000000-0000-0000-0000-000000000003',
      },
    ]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(value))));
      expect(await auth.refresh()).toEqual(value);
    }
  });

  it('trata como sessão ausente um principal com o perfil de saúde removido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...principal, perfis: ['saude'] }))),
    );
    const auth = TestBed.inject(LocalAuthService);
    auth.principal.set(principal);

    expect(await auth.refresh()).toBeNull();
    expect(auth.principal()).toBeNull();
  });

  it('encerra a sessão com CSRF e limpa o principal após resposta bem-sucedida', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'csrf-test' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const auth = TestBed.inject(LocalAuthService);
    auth.principal.set(principal);

    await auth.logout();
    expect(auth.principal()).toBeNull();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/auth/logout');
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({ 'X-CSRF-TOKEN': 'csrf-test' });
  });

  it('avisa as outras abas ao entrar e ao sair, mesmo sem armazenamento', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/v1/auth/csrf'
          ? new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 't' }))
          : new Response(url === '/api/v1/auth/me' ? JSON.stringify(principal) : null),
      ),
    );
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    const auth = TestBed.inject(LocalAuthService);

    expect(await auth.login(principal.matricula, 'senha de teste')).toBe('success');
    await auth.logout();
    expect(setItem.mock.calls.map(([key]) => key)).toEqual([SESSION_SIGNAL, SESSION_SIGNAL]);
    setItem.mockRestore();
  });

  it('descarta o token CSRF ao entrar, ao sair e ao esquecer o usuário', async () => {
    let issued = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/v1/auth/csrf')
        return new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: `t${++issued}` }));
      if (url === '/api/v1/auth/me') return new Response(JSON.stringify(principal));
      return new Response(url === '/api/v1/gravacao' ? '{}' : null, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const auth = TestBed.inject(LocalAuthService);
    const write = async () => {
      await api('/api/v1/gravacao', { method: 'POST', body: {} });
      const [, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
      return (init.headers as Record<string, string>)['X-CSRF-TOKEN'];
    };

    expect(await write()).toBe('t1');
    expect(await write()).toBe('t1');
    expect(await auth.login(principal.matricula, 'senha de teste')).toBe('success');
    expect(await write()).toBe('t2');
    await auth.logout();
    expect(await write()).toBe('t3');
    auth.clearPrincipal();
    expect(await write()).toBe('t4');
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/v1/auth/csrf')).toHaveLength(4);
  });
});
