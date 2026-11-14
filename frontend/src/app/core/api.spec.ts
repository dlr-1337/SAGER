import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, cached, onUnauthorized, resetSession } from './api';

const token = (value = 'csrf-1') =>
  new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: value }), { status: 200 });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const calls = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls.map(([url, init]) => [url, (init as RequestInit | undefined)?.method] as const);

class TestError extends Error {
  constructor(readonly status: number) {
    super(`erro ${status}`);
  }
}
const error = (response: Response) => new TestError(response.status);

describe('api', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetSession();
    onUnauthorized(() => undefined);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lê com credenciais da origem, sem cache e sem pedir CSRF', async () => {
    fetchMock.mockResolvedValueOnce(json([]));
    await api('/api/v1/cursos');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/cursos');
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    expect(init.body).toBeUndefined();
  });

  it('envia objeto como JSON e FormData como está', async () => {
    const form = new FormData();
    form.append('file', new Blob(['x']), 'a.txt');
    fetchMock
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({}));
    await api('/api/v1/cursos', { method: 'POST', body: { name: 'Curso' } });
    await api('/api/v1/arquivos', { method: 'POST', body: form });
    const [, jsonInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(jsonInit.body).toBe('{"name":"Curso"}');
    expect(jsonInit.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': 'csrf-1',
    });
    const [, formInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(formInit.body).toBe(form);
    expect(formInit.headers).not.toHaveProperty('Content-Type');
    expect(formInit.headers).toMatchObject({ 'X-CSRF-TOKEN': 'csrf-1' });
  });

  it('pede o token CSRF uma vez para gravações seguidas e simultâneas', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === '/api/v1/auth/csrf' ? token() : json({}),
    );
    await api('/api/v1/a', { method: 'POST', body: {} });
    await Promise.all([
      api('/api/v1/b', { method: 'PUT', body: {} }),
      api('/api/v1/c', { method: 'DELETE' }),
    ]);
    expect(calls(fetchMock).filter(([url]) => url === '/api/v1/auth/csrf')).toHaveLength(1);
    resetSession();
    await Promise.all([
      api('/api/v1/d', { method: 'POST', body: {} }),
      api('/api/v1/e', { method: 'POST', body: {} }),
    ]);
    expect(calls(fetchMock).filter(([url]) => url === '/api/v1/auth/csrf')).toHaveLength(2);
  });

  it('com csrf_invalid pega um token novo e repete a gravação uma única vez', async () => {
    const refused = () => json({ code: 'csrf_invalid' }, 403);
    fetchMock
      .mockResolvedValueOnce(token('velho'))
      .mockResolvedValueOnce(refused())
      .mockResolvedValueOnce(token('novo'))
      .mockResolvedValueOnce(json({ ok: true }));
    const response = await api('/api/v1/a', { method: 'POST', body: {}, error });
    expect(await response.json()).toEqual({ ok: true });
    expect((fetchMock.mock.calls[3][1] as RequestInit).headers).toMatchObject({
      'X-CSRF-TOKEN': 'novo',
    });

    resetSession();
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(token('a'))
      .mockResolvedValueOnce(refused())
      .mockResolvedValueOnce(token('b'))
      .mockResolvedValueOnce(refused());
    await expect(api('/api/v1/a', { method: 'POST', body: {}, error })).rejects.toEqual(
      new TestError(403),
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('com csrf_invalid só repete a gravação se o cookie ainda for da conta da tela', async () => {
    const handler = vi.fn();
    onUnauthorized(handler, () => 'conta-a');
    const refused = () => json({ code: 'csrf_invalid' }, 403);
    fetchMock
      .mockResolvedValueOnce(token('de-a'))
      .mockResolvedValueOnce(refused())
      .mockResolvedValueOnce(json({ id: 'conta-b' }));
    await expect(api('/api/v1/a', { method: 'POST', body: {}, error })).rejects.toEqual(
      new TestError(403),
    );
    expect(handler).toHaveBeenCalledTimes(1);
    expect(calls(fetchMock)).toEqual([
      ['/api/v1/auth/csrf', undefined],
      ['/api/v1/a', 'POST'],
      ['/api/v1/auth/me', 'GET'],
    ]);

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(token('velho'))
      .mockResolvedValueOnce(refused())
      .mockResolvedValueOnce(json({ id: 'conta-a' }))
      .mockResolvedValueOnce(token('novo'))
      .mockResolvedValueOnce(json({ ok: true }));
    expect((await api('/api/v1/a', { method: 'POST', body: {}, error })).ok).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[4][1] as RequestInit).headers).toMatchObject({
      'X-CSRF-TOKEN': 'novo',
    });
  });

  it('não repete um 403 que não é de CSRF', async () => {
    fetchMock
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(json({ code: 'forbidden' }, 403));
    await expect(api('/api/v1/a', { method: 'POST', body: {}, error })).rejects.toBeInstanceOf(
      TestError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('avisa o tratador de 401 e lança o erro do serviço', async () => {
    const handler = vi.fn();
    onUnauthorized(handler);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(api('/api/v1/residentes', { error })).rejects.toEqual(new TestError(401));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('usa a fábrica do serviço quando o token CSRF não vem', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(api('/api/v1/a', { method: 'POST', body: {}, error })).rejects.toEqual(
      new TestError(503),
    );
  });

  describe('cached', () => {
    let now = 1_000_000;
    beforeEach(() => {
      now = 1_000_000;
      vi.spyOn(Date, 'now').mockImplementation(() => now);
    });

    it('devolve a mesma Promise por 60 s e uma nova depois', async () => {
      const loader = vi.fn(async () => ['lista']);
      const first = cached('cursos', loader);
      now += 59_999;
      expect(cached('cursos', loader)).toBe(first);
      now += 1;
      expect(cached('cursos', loader)).not.toBe(first);
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it('esquece as cópias depois de uma gravação bem-sucedida e de resetSession()', async () => {
      const loader = vi.fn(async () => ['lista']);
      fetchMock.mockImplementation(async (url: string) =>
        url === '/api/v1/auth/csrf' ? token() : json({}),
      );
      await cached('cursos', loader);
      await api('/api/v1/cursos', { method: 'POST', body: {} });
      await cached('cursos', loader);
      expect(loader).toHaveBeenCalledTimes(2);
      resetSession();
      await cached('cursos', loader);
      expect(loader).toHaveBeenCalledTimes(3);
    });

    it('mantém as cópias quando a gravação falha, menos num conflito de versão', async () => {
      const loader = vi.fn(async () => ['lista']);
      fetchMock
        .mockResolvedValueOnce(token())
        .mockResolvedValueOnce(json({}, 400))
        .mockResolvedValueOnce(json({ code: 'stale_version' }, 409));
      await cached('cursos', loader);
      await expect(api('/api/v1/cursos', { method: 'POST', body: {} })).rejects.toThrow();
      await cached('cursos', loader);
      expect(loader).toHaveBeenCalledTimes(1);
      await expect(api('/api/v1/cursos/1', { method: 'PUT', body: {} })).rejects.toThrow();
      await cached('cursos', loader);
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it('não guarda uma falha', async () => {
      const loader = vi
        .fn<() => Promise<string[]>>()
        .mockRejectedValueOnce(new Error('falhou'))
        .mockResolvedValueOnce(['lista']);
      await expect(cached('cursos', loader)).rejects.toThrow('falhou');
      expect(await cached('cursos', loader)).toEqual(['lista']);
    });
  });
});
