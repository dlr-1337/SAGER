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
