import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_IDLE_MS, api, onUnauthorized, resetSession } from './api';
import { DemoSessionService, type Role } from './demo-session.service';
import { LocalAuthService } from './local-auth.service';
import {
  PENDING_REFRESH_MS,
  PENDING_URL,
  PendingBadgesService,
  parsePendingCounts,
  pendingLabel,
} from './pending-badges.service';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const supervisorCounts = {
  shortExits: 2,
  longExits: 1,
  notifications: 3,
  nightCalls: 1,
  conversations: 0,
};

describe('Contadores de pendências', () => {
  let hidden: boolean;
  let answer: () => Response | Promise<Response>;
  let fetchMock: ReturnType<typeof vi.fn>;

  const pendingCalls = () =>
    fetchMock.mock.calls.filter(([url]) => url === PENDING_URL) as [string, RequestInit][];
  const setHidden = (value: boolean) => {
    hidden = value;
    document.dispatchEvent(new Event('visibilitychange'));
  };
  function signIn(role: Role, id = '00000000-0000-0000-0000-000000000001') {
    TestBed.inject(LocalAuthService).principal.set({
      id,
      nome: 'Conta Sintética',
      email: null,
      matricula: 'TESTE-LOGIN',
      fotoUrl: null,
      perfis: [role],
      residenteId: role === 'residente' ? '00000000-0000-0000-0000-000000000002' : null,
      supervisorId: null,
    });
  }
  async function started(): Promise<PendingBadgesService> {
    const service = TestBed.inject(PendingBadgesService);
    service.start();
    await vi.advanceTimersByTimeAsync(0);
    return service;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    TestBed.configureTestingModule({});
    TestBed.inject(DemoSessionService).deactivate();
    resetSession();
    onUnauthorized(() => undefined);
    answer = () => json(supervisorCounts);
    fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/v1/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 't' });
      if (url === PENDING_URL) return answer();
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (document as { hidden?: boolean }).hidden;
  });

  it('pede a contagem ao abrir, como consulta automática, e soma por item do menu', async () => {
    signIn('supervisor');
    const service = await started();
    expect(pendingCalls()).toHaveLength(1);
    const [, init] = pendingCalls()[0];
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['X-Sager-Auto-Refresh']).toBe('1');
    expect(service.forPath('/saidas')).toBe(3);
    expect(service.forPath('/notificacoes')).toBe(3);
    expect(service.forPath('/chamada')).toBe(1);
    expect(service.forPath('/conversas')).toBe(0);
    expect(service.forPath('/limpeza')).toBe(0);
    expect(service.count(['longExits'])).toBe(1);
  });

  it('consulta a cada 30 s com a aba visível, nunca com ela oculta, e na hora ao voltar', async () => {
    signIn('supervisor');
    await started();
    await vi.advanceTimersByTimeAsync(PENDING_REFRESH_MS - 1);
    expect(pendingCalls()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(pendingCalls()).toHaveLength(2);
    setHidden(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(pendingCalls()).toHaveLength(2);
    setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(pendingCalls()).toHaveLength(3);
  });

  it('para depois de 30 minutos sem interação e volta na próxima troca de tela', async () => {
    signIn('supervisor');
    const service = await started();
    await vi.advanceTimersByTimeAsync(20 * 60_000);
    // Um clique aos 20 minutos adia a pausa.
    document.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(20 * 60_000);
    const beforePause = pendingCalls().length;
    expect(beforePause).toBeGreaterThan(70);
    await vi.advanceTimersByTimeAsync(SESSION_IDLE_MS);
    const paused = pendingCalls().length;
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(pendingCalls()).toHaveLength(paused);
    service.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(pendingCalls()).toHaveLength(paused + 1);
    await vi.advanceTimersByTimeAsync(PENDING_REFRESH_MS);
    expect(pendingCalls()).toHaveLength(paused + 2);
  });

  it('refaz a contagem depois de uma gravação, menos nas de entrada e saída da conta', async () => {
    signIn('residente');
    answer = () => json({ notices: 1, warnings: 0, terms: 0 });
    const service = await started();
    expect(service.forPath('/avisos')).toBe(1);
    answer = () => json({ notices: 0, warnings: 0, terms: 0 });
    await api('/api/v1/me/comunicacoes/c1/ciencia', { method: 'POST' });
    await vi.advanceTimersByTimeAsync(0);
    expect(pendingCalls()).toHaveLength(2);
    expect(service.forPath('/avisos')).toBe(0);
    await api('/api/v1/auth/logout', { method: 'POST' });
    await vi.advanceTimersByTimeAsync(0);
    expect(pendingCalls()).toHaveLength(2);
  });

  it('mantém os números anteriores quando a consulta falha ou a resposta foge do formato', async () => {
    signIn('supervisor');
    const service = await started();
    for (const bad of [
      () => json([]),
      () => json({ ...supervisorCounts, notices: 1 }),
      () => json({ ...supervisorCounts, shortExits: -1 }),
      () => json({ ...supervisorCounts, shortExits: 1.5 }),
      () => json({ notices: 1, warnings: 0, terms: 0 }),
      () => json({ code: 'unavailable' }, 503),
      () => Promise.reject(new TypeError('rede')),
    ]) {
      answer = bad;
      service.refresh();
      await vi.advanceTimersByTimeAsync(0);
      expect(service.forPath('/saidas')).toBe(3);
    }
  });

  it('não mostra os números de outra conta, nem os que chegam depois da troca', async () => {
    signIn('supervisor');
    const service = await started();
    expect(service.forPath('/saidas')).toBe(3);
    let release!: (response: Response) => void;
    answer = () => new Promise<Response>((resolve) => (release = resolve));
    signIn('supervisor', '00000000-0000-0000-0000-000000000009');
    expect(service.forPath('/saidas')).toBe(0);
    service.refresh();
    await vi.advanceTimersByTimeAsync(0);
    signIn('supervisor', '00000000-0000-0000-0000-000000000010');
    release(json({ ...supervisorCounts, shortExits: 9 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(service.forPath('/saidas')).toBe(0);
  });

  it('o gestor, a conta sem sessão e a demonstração não pedem nada à API', async () => {
    const service = await started();
    signIn('gestor');
    service.refresh();
    await vi.advanceTimersByTimeAsync(2 * PENDING_REFRESH_MS);
    expect(pendingCalls()).toHaveLength(0);
    expect(service.forPath('/saidas')).toBe(0);

    TestBed.inject(LocalAuthService).principal.set(null);
    const session = TestBed.inject(DemoSessionService);
    session.activate('supervisor');
    service.refresh();
    // O código da demonstração chega por import(): espera o carregamento.
    await vi.waitFor(() => expect(service.forPath('/saidas')).toBe(3));
    expect(fetchMock).not.toHaveBeenCalled();
    // Dados fictícios: 1 saída curta e 2 longas à espera, 2 notificações e a chamada aberta.
    expect(service.forPath('/notificacoes')).toBe(2);
    expect(service.forPath('/chamada')).toBe(1);
    session.deactivate();
    expect(service.forPath('/saidas')).toBe(0);
  });
});

describe('Formato da contagem', () => {
  it('aceita só os campos do perfil, inteiros de 0 em diante', () => {
    expect(parsePendingCounts(supervisorCounts, 'supervisor')).toEqual(supervisorCounts);
    expect(parsePendingCounts({ notices: 0, warnings: 2, terms: 1 }, 'residente')).toEqual({
      notices: 0,
      warnings: 2,
      terms: 1,
    });
    expect(parsePendingCounts({}, 'gestor')).toBeNull();
    expect(parsePendingCounts(supervisorCounts, 'residente')).toBeNull();
    expect(parsePendingCounts({ notices: '1', warnings: 0, terms: 0 }, 'residente')).toBeNull();
    expect(parsePendingCounts({ notices: null, warnings: 0, terms: 0 }, 'residente')).toBeNull();
    expect(parsePendingCounts(null, 'residente')).toBeNull();
  });

  it('lê "1 pendente" e "N pendentes"', () => {
    expect(pendingLabel(1)).toBe('1 pendente');
    expect(pendingLabel(3)).toBe('3 pendentes');
    expect(pendingLabel(120)).toBe('120 pendentes');
  });
});
