import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationPolling, IDLE_LIMIT_MS } from './conversation-polling';

function fakeDocument() {
  const target = new EventTarget() as EventTarget & { hidden: boolean };
  target.hidden = false;
  return target;
}

describe('ConversationPolling', () => {
  let doc: ReturnType<typeof fakeDocument>;
  let tick: ReturnType<typeof vi.fn<() => Promise<void>>>;
  let polling: ConversationPolling;

  beforeEach(() => {
    vi.useFakeTimers();
    doc = fakeDocument();
    tick = vi.fn<() => Promise<void>>().mockResolvedValue();
    polling = new ConversationPolling(tick, 5000, doc as unknown as Document);
    polling.start();
  });
  afterEach(() => {
    polling.destroy();
    vi.useRealTimers();
  });

  it('agenda a próxima consulta só depois da resposta', async () => {
    let answer!: () => void;
    tick.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(tick).toHaveBeenCalledTimes(1);
    answer();
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('continua depois de uma falha que não é de sessão', async () => {
    tick.mockRejectedValueOnce(Object.assign(new Error('fora'), { status: 503 }));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(tick).toHaveBeenCalledTimes(2);
    expect(polling.state()).toBe('running');
  });

  it('pausa com a aba oculta e consulta ao voltar', async () => {
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).not.toHaveBeenCalled();
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('para depois de 30 minutos sem interação e retoma quando pedido', async () => {
    await vi.advanceTimersByTimeAsync(IDLE_LIMIT_MS + 5000);
    expect(polling.state()).toBe('idle');
    const calls = tick.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(calls);
    polling.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(polling.state()).toBe('running');
    expect(tick).toHaveBeenCalledTimes(calls + 1);
  });

  it('a interação adia a pausa por inatividade', async () => {
    await vi.advanceTimersByTimeAsync(IDLE_LIMIT_MS - 5000);
    doc.dispatchEvent(new Event('keydown'));
    await vi.advanceTimersByTimeAsync(IDLE_LIMIT_MS - 5000);
    expect(polling.state()).toBe('running');
  });

  it('para em 401', async () => {
    tick.mockRejectedValueOnce(Object.assign(new Error('sessão'), { status: 401 }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(polling.state()).toBe('expired');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('não consulta depois de destruído, inclusive com resposta pendente', async () => {
    let answer!: () => void;
    tick.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    await vi.advanceTimersByTimeAsync(5000);
    polling.destroy();
    answer();
    doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(1);
  });
});
