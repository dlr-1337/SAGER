import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_OPEN, SESSION_IDLE_MS, resetSession } from '../../core/api';
import { DemoSessionService } from '../../core/demo-session.service';
import { LocalAuthService } from '../../core/local-auth.service';
import { DemoEntry } from './demo-entry.service';

const principal = {
  id: '00000000-0000-0000-0000-000000000001',
  nome: 'Operadora Exemplo',
  email: null,
  matricula: 'TESTE-LOGIN',
  fotoUrl: null,
  perfis: ['gestor' as const],
  residenteId: null,
  supervisorId: null,
};

/** `me` responde /auth/me; o resto (CSRF e saída) responde `rest`. */
function server(me: () => Promise<Response>, rest: () => Response = () => new Response(null)) {
  const fetchMock = vi.fn(async (url: string) =>
    url === '/api/v1/auth/me'
      ? me()
      : url === '/api/v1/auth/csrf'
        ? new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 't' }))
        : rest(),
  );
  vi.stubGlobal('fetch', fetchMock);
  return () => fetchMock.mock.calls.map(([url]) => url);
}

const offline = () => Promise.reject(new TypeError('Failed to fetch'));

describe('DemoEntry', () => {
  let entry: DemoEntry;
  let session: DemoSessionService;
  let auth: LocalAuthService;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetSession();
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), DemoEntry] });
    entry = TestBed.inject(DemoEntry);
    session = TestBed.inject(DemoSessionService);
    auth = TestBed.inject(LocalAuthService);
    session.deactivate();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    session.deactivate();
    vi.unstubAllGlobals();
  });

  it('com a API fora do ar e sem conta conhecida, entra sem pedir mais nada', async () => {
    const calls = server(offline);
    await entry.choose('gestor');
    expect(session.active()).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/inicio');
    expect(calls()).toEqual(['/api/v1/auth/me']);
    expect(entry.error()).toBe('');
  });

  it('com conta aberta neste navegador e o servidor com erro, pede para tentar de novo', async () => {
    localStorage.setItem(ACCOUNT_OPEN, String(Date.now()));
    const calls = server(async () => new Response(null, { status: 503 }));
    await entry.choose('supervisor');
    expect(session.active()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(entry.error()).toContain('tente de novo');
    expect(calls()).toEqual(['/api/v1/auth/me']);
    expect(entry.busy()).toBe(false);
  });

  it('com a chave mais velha que a sessão do servidor e sem resposta, entra', async () => {
    localStorage.setItem(ACCOUNT_OPEN, String(Date.now() - SESSION_IDLE_MS - 1));
    const calls = server(offline);
    await entry.choose('gestor');
    expect(session.active()).toBe(true);
    expect(calls()).toEqual(['/api/v1/auth/me']);
    expect(localStorage.getItem(ACCOUNT_OPEN)).toBeNull();
  });

  it('com a conta conhecida nesta aba e sem resposta, não entra', async () => {
    auth.principal.set(principal);
    server(offline);
    await entry.choose('residente');
    expect(session.active()).toBe(false);
    expect(entry.error()).toContain('tente de novo');
    expect(auth.principal()).toEqual(principal);
  });

  it('com a sessão já encerrada no servidor, entra sem pedir a saída', async () => {
    localStorage.setItem(ACCOUNT_OPEN, String(Date.now()));
    const calls = server(async () => new Response(null, { status: 401 }));
    await entry.choose('gestor');
    expect(session.active()).toBe(true);
    expect(calls()).toEqual(['/api/v1/auth/me']);
    expect(localStorage.getItem(ACCOUNT_OPEN)).toBeNull();
  });

  it('com a conta aberta, sai antes de entrar', async () => {
    localStorage.setItem(ACCOUNT_OPEN, String(Date.now()));
    const calls = server(async () => new Response(JSON.stringify(principal)));
    await entry.choose('gestor');
    expect(calls()).toEqual(['/api/v1/auth/me', '/api/v1/auth/csrf', '/api/v1/auth/logout']);
    expect(session.active()).toBe(true);
    expect(auth.principal()).toBeNull();
    expect(localStorage.getItem(ACCOUNT_OPEN)).toBeNull();
  });

  it('se a saída falha, não entra', async () => {
    server(
      async () => new Response(JSON.stringify(principal)),
      () => new Response(null, { status: 500 }),
    );
    await entry.choose('gestor');
    expect(session.active()).toBe(false);
    expect(entry.error()).toContain('tente de novo');
  });
});
