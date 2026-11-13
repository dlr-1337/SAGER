import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalAuthService } from './local-auth.service';

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
});
