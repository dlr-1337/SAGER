import { describe, expect, it, vi } from 'vitest';
import { cursorPages } from './list-page';

const pageOf = (start: number, nextCursor: number | null) => ({
  items: Array.from({ length: 25 }, (_, index) => start + index),
  nextCursor,
});

describe('Páginas por cursor', () => {
  it('usa o nextCursor na Próxima e devolve a página vista na Anterior sem nova consulta', async () => {
    const fetch = vi.fn(async (cursor?: number) =>
      cursor === undefined ? pageOf(1, 75) : pageOf(26, null),
    );
    const list = cursorPages(fetch, () => 'falhou');
    await list.reload();
    expect(list.items()[0]).toBe(1);
    expect(list.hasNext()).toBe(true);
    await list.go(1);
    expect(fetch).toHaveBeenLastCalledWith(75);
    expect(list.page()).toBe(1);
    expect(list.items()[0]).toBe(26);
    expect(list.hasNext()).toBe(false);
    await list.go(0);
    expect(list.items()).toEqual(pageOf(1, 75).items);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('esquece as páginas visitadas no reload', async () => {
    const fetch = vi.fn(async () => pageOf(1, 75));
    const list = cursorPages(fetch, () => 'falhou');
    await list.reload();
    await list.go(1);
    await list.reload();
    expect(list.page()).toBe(0);
    await list.go(1);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('descarta resposta atrasada, de sucesso ou de falha', async () => {
    let finishOld!: (value: ReturnType<typeof pageOf>) => void;
    let failOld!: (error: Error) => void;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(pageOf(1, 75))
      .mockReturnValueOnce(new Promise((resolve) => (finishOld = resolve)))
      .mockResolvedValueOnce(pageOf(500, null))
      .mockReturnValueOnce(new Promise((_, reject) => (failOld = reject)))
      .mockResolvedValueOnce(pageOf(900, null));
    const list = cursorPages(fetch, () => 'falhou');
    await list.reload();
    const old = list.go(1);
    await list.reload();
    finishOld(pageOf(26, null));
    await old;
    expect(list.page()).toBe(0);
    expect(list.items()[0]).toBe(500);
    const failing = list.reload();
    await list.reload();
    failOld(new Error('rede'));
    await failing;
    expect(list.items()[0]).toBe(900);
    expect(list.error()).toBe('');
    expect(list.loading()).toBe(false);
  });

  it('refresh() troca só a página à vista, sem lista vazia, e esquece as seguintes', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(pageOf(1, 75))
      .mockResolvedValueOnce(pageOf(26, 100))
      .mockResolvedValueOnce(pageOf(30, 90))
      .mockResolvedValueOnce(pageOf(55, null));
    const list = cursorPages(fetch, () => 'falhou');
    await list.reload();
    await list.go(1);
    const seen: unknown[][] = [];
    const loading: boolean[] = [];
    const watching = list.refresh();
    seen.push(list.items());
    loading.push(list.loading());
    await watching;
    expect(fetch).toHaveBeenLastCalledWith(75);
    expect(seen[0][0]).toBe(26);
    expect(loading).toEqual([false]);
    expect(list.page()).toBe(1);
    expect(list.items()[0]).toBe(30);
    await list.go(0);
    expect(list.items()[0]).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(3);
    await list.go(1);
    await list.go(2);
    expect(fetch).toHaveBeenLastCalledWith(90);
    expect(list.items()[0]).toBe(55);
  });

  it('refresh() descarta a resposta atrasada e devolve a falha sem tirar os itens', async () => {
    let late!: (value: ReturnType<typeof pageOf>) => void;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(pageOf(1, 75))
      .mockReturnValueOnce(new Promise((resolve) => (late = resolve)))
      .mockRejectedValueOnce(new Error('rede'));
    const list = cursorPages(fetch, () => 'falhou');
    await list.reload();
    const old = list.refresh();
    await list.go(0);
    late(pageOf(900, null));
    await old;
    expect(list.items()[0]).toBe(1);
    await expect(list.refresh()).rejects.toThrow('rede');
    expect(list.items()[0]).toBe(1);
    expect(list.error()).toBe('');
  });

  it('mostra a mensagem de erro recebida', async () => {
    const list = cursorPages(
      () => Promise.reject(new Error('rede')),
      (error) => `Falhou: ${(error as Error).message}`,
    );
    await list.reload();
    expect(list.error()).toBe('Falhou: rede');
    expect(list.loading()).toBe(false);
  });
});
