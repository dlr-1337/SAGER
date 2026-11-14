import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsavedForms } from '../shared/unsaved-forms';
import { SESSION_IDLE_MS, api, onUnauthorized, resetSession } from './api';
import { AutoRefreshOptions, autoRefresh } from './auto-refresh';
import { DemoSessionService } from './demo-session.service';

describe('Atualização automática', () => {
  let hidden: boolean;
  let tick: ReturnType<typeof vi.fn<() => Promise<void>>>;
  let fetchMock: ReturnType<typeof vi.fn>;
  const dialogs = { openDialogs: [] as unknown[] };
  const demo = signal(false);

  function start(options?: AutoRefreshOptions) {
    const injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    const refresh = runInInjectionContext(injector, () => autoRefresh(tick, options));
    return { refresh, destroy: () => injector.destroy() };
  }
  const setHidden = (value: boolean) => {
    hidden = value;
    document.dispatchEvent(new Event('visibilitychange'));
  };
  const autoHeader = (call: number) =>
    (fetchMock.mock.calls[call][1] as { headers: Record<string, string> }).headers[
      'X-Sager-Auto-Refresh'
    ];

  beforeEach(() => {
    vi.useFakeTimers();
    hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    dialogs.openDialogs = [];
    demo.set(false);
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: dialogs },
        { provide: DemoSessionService, useValue: { active: demo } },
      ],
    });
    resetSession();
    onUnauthorized(() => undefined);
    fetchMock = vi.fn(async () => new Response('[]'));
    vi.stubGlobal('fetch', fetchMock);
    tick = vi.fn(async () => {
      await api('/api/v1/saidas');
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (document as { hidden?: boolean }).hidden;
  });

  it('consulta aos 15 s, não antes, com a marca de consulta automática', async () => {
    start();
    await vi.advanceTimersByTimeAsync(14_999);
    expect(tick).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(autoHeader(0)).toBe('1');
  });

  it('aceita outro intervalo e agenda a próxima consulta só depois da resposta', async () => {
    let answer!: () => void;
    tick.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    start({ delayMs: () => 5000 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(tick).toHaveBeenCalledTimes(1);
    answer();
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('com a aba oculta não consulta por 1 minuto e consulta ao voltar, marcada', async () => {
    start();
    setHidden(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).not.toHaveBeenCalled();
    setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(autoHeader(0)).toBe('1');
  });

  it('pula o ciclo com formulário alterado, diálogo aberto ou tela ocupada', async () => {
    const forms = TestBed.inject(UnsavedForms);
    const form = { dirty: () => true, saving: () => false };
    forms.forms.add(form);
    let busy = false;
    start({ busy: () => busy });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(tick).not.toHaveBeenCalled();
    forms.forms.delete(form);
    dialogs.openDialogs = [{}];
    await vi.advanceTimersByTimeAsync(15_000);
    expect(tick).not.toHaveBeenCalled();
    dialogs.openDialogs = [];
    busy = true;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(tick).not.toHaveBeenCalled();
    busy = false;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('pausa depois de 30 minutos sem interação e "Retomar" consulta na hora, sem marca', async () => {
    const { refresh } = start();
    await vi.advanceTimersByTimeAsync(SESSION_IDLE_MS + 15_000);
    expect(refresh.state()).toBe('paused');
    const calls = tick.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(calls);
    refresh.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh.state()).toBe('running');
    expect(tick).toHaveBeenCalledTimes(calls + 1);
    expect(autoHeader(calls)).toBeUndefined();
  });

  it('a interação adia a pausa', async () => {
    const { refresh } = start();
    await vi.advanceTimersByTimeAsync(SESSION_IDLE_MS - 5000);
    document.dispatchEvent(new Event('keydown'));
    await vi.advanceTimersByTimeAsync(SESSION_IDLE_MS - 5000);
    expect(refresh.state()).toBe('running');
  });

  it('a falha liga o aviso, tenta no ciclo seguinte e o sucesso o desliga', async () => {
    tick.mockRejectedValueOnce(Object.assign(new Error('fora'), { status: 503 }));
    const { refresh } = start();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(refresh.failed()).toBe(true);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(tick).toHaveBeenCalledTimes(2);
    expect(refresh.failed()).toBe(false);
  });

  it('o 401 fica com o tratamento central, sem o aviso de falha', async () => {
    tick.mockRejectedValueOnce(Object.assign(new Error('sessão'), { status: 401 }));
    const { refresh } = start();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(refresh.failed()).toBe(false);
  });

  it('não agenda nada na demonstração', async () => {
    demo.set(true);
    start();
    setHidden(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).not.toHaveBeenCalled();
  });

  it('não consulta depois de destruída, inclusive com resposta pendente', async () => {
    let answer!: () => void;
    tick.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const { destroy } = start();
    await vi.advanceTimersByTimeAsync(15_000);
    destroy();
    answer();
    setHidden(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(1);
  });
});
