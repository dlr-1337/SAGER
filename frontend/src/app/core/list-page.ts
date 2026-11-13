import { signal } from '@angular/core';
import { api } from './api';

export async function readArrayPage<T>(
  url: string,
  params: Record<string, string>,
  guard: (value: unknown) => value is T,
  error: (response: Response) => Promise<Error>,
  signal?: AbortSignal,
): Promise<{ items: T[]; total: number }> {
  const response = await api(`${url}?${new URLSearchParams(params)}`, { signal, error });
  const items: unknown = await response.json();
  if (!Array.isArray(items) || !items.every(guard)) throw new Error('Lista recebida inválida.');
  const total = Number(response.headers.get('X-Total-Count') ?? items.length);
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('Total recebido inválido.');
  return { items, total };
}

export interface CursorPageResult<T> {
  items: T[];
  nextCursor: number | null;
}

/**
 * Páginas fixas sobre uma lista por cursor. As páginas visitadas ficam em memória até o próximo
 * `reload()`, para que Anterior mostre exatamente o que já foi visto; um contador de geração
 * descarta a resposta de um pedido antigo.
 */
export function cursorPages<T>(
  fetch: (cursor?: number) => Promise<CursorPageResult<T>>,
  message: (error: unknown) => string,
) {
  const items = signal<T[]>([]);
  const page = signal(0);
  const hasNext = signal(false);
  const loading = signal(false);
  const error = signal('');
  let pages: CursorPageResult<T>[] = [];
  let generation = 0;
  const show = (index: number, result: CursorPageResult<T>) => {
    page.set(index);
    items.set(result.items);
    hasNext.set(result.nextCursor !== null);
  };
  async function go(index: number): Promise<void> {
    const current = ++generation;
    if (pages[index]) {
      loading.set(false);
      error.set('');
      return show(index, pages[index]);
    }
    const cursor = index ? (pages[index - 1]?.nextCursor ?? null) : undefined;
    if (cursor === null) return;
    loading.set(true);
    error.set('');
    try {
      const result = await fetch(cursor);
      if (current !== generation) return;
      pages[index] = result;
      show(index, result);
    } catch (failure) {
      if (current === generation) error.set(message(failure));
    } finally {
      if (current === generation) loading.set(false);
    }
  }
  return {
    items: items.asReadonly(),
    page: page.asReadonly(),
    hasNext: hasNext.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    go,
    reload(): Promise<void> {
      pages = [];
      show(0, { items: [], nextCursor: null });
      return go(0);
    },
  };
}
