// Único ponto de acesso à API: credenciais, JSON, token CSRF em memória, 401 central e cópias de
// 60 s das listas de referência. Estado de módulo, por aba; os *-demo.service não passam por aqui.

interface CsrfToken {
  headerName: string;
  token: string;
}

export interface ApiInit extends Omit<RequestInit, 'body' | 'headers'> {
  /** Objeto vira JSON; FormData, URLSearchParams, Blob e texto seguem como estão. */
  body?: unknown;
  headers?: Record<string, string>;
  /** Monta o erro de uma resposta que não é ok, na classe de erro do serviço. */
  error?: (response: Response) => Error | Promise<Error>;
}

const COPY_TTL_MS = 60_000;
/** localStorage: hora da última resposta aceita de uma conta que entrou neste navegador. */
export const ACCOUNT_OPEN = 'sager.account';
/** A sessão do servidor expira depois de 30 minutos sem uso (SAGER_SESSION_TIMEOUT). */
export const SESSION_IDLE_MS = 30 * 60_000;
const genericError = () => new Error('Não deu certo. Verifique a internet e tente de novo.');

let csrf: Promise<CsrfToken> | null = null;
let unauthorized: () => void = () => undefined;
let knownUser: () => string | null = () => null;
const copies = new Map<string, { at: number; value: Promise<unknown> }>();

/** `user` diz qual conta a tela mostra; a repetição por CSRF só grava para ela. */
export function onUnauthorized(handler: () => void, user: () => string | null = () => null): void {
  unauthorized = handler;
  knownUser = user;
}

/** Descarta o token CSRF e as cópias: depois de entrar, ao sair e quando a sessão termina. */
export function resetSession(): void {
  csrf = null;
  copies.clear();
}

export function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = copies.get(key);
  if (hit && Date.now() - hit.at < COPY_TTL_MS) return hit.value as Promise<T>;
  const value = loader();
  copies.set(key, { at: Date.now(), value });
  value.catch(() => {
    if (copies.get(key)?.value === value) copies.delete(key);
  });
  return value;
}

export async function api(url: string, init: ApiInit = {}): Promise<Response> {
  const { body, headers: extra, error = genericError, ...rest } = init;
  const method = (rest.method ?? 'GET').toUpperCase();
  const write = method !== 'GET' && method !== 'HEAD';
  const raw =
    body === undefined ||
    typeof body === 'string' ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob;
  const send = async () => {
    const headers: Record<string, string> = { Accept: 'application/json', ...extra };
    if (!raw) headers['Content-Type'] = 'application/json';
    if (write) {
      const token = await csrfToken(error);
      headers[token.headerName] = token.token;
    }
    return fetch(url, {
      ...rest,
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      body: raw ? (body as BodyInit | undefined) : JSON.stringify(body),
    });
  };
  let response = await send();
  // O filtro do Spring recusa antes do controlador: a gravação não aconteceu e pode ser repetida.
  if (write && response.status === 403 && (await errorCode(response)) === 'csrf_invalid') {
    csrf = null;
    // Outra aba pode ter trocado a conta no mesmo cookie: só repete para a conta da tela.
    const user = knownUser();
    if (user) {
      const me: unknown = await (await api('/api/v1/auth/me', { error })).json();
      if ((me as { id?: unknown } | null)?.id !== user) {
        unauthorized();
        throw await error(response);
      }
    }
    response = await send();
  }
  if (response.status === 401) unauthorized();
  // Um 409 diz que a aba está desatualizada: o "Recarregar dados" seguinte precisa ir ao servidor.
  if (write && (response.ok || response.status === 409)) copies.clear();
  if (!response.ok) throw await error(response);
  touchAccount();
  return response;
}

/** Grava a hora em `ACCOUNT_OPEN`; sem `create`, só adia uma chave que já existe. */
export function touchAccount(create = false): void {
  try {
    if (create || localStorage.getItem(ACCOUNT_OPEN) !== null)
      localStorage.setItem(ACCOUNT_OPEN, String(Date.now()));
  } catch {
    // Sem armazenamento, vale só o principal da aba (core/local-auth.service.ts).
  }
}

async function csrfToken(error: NonNullable<ApiInit['error']>): Promise<CsrfToken> {
  csrf ??= fetch('/api/v1/auth/csrf', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  }).then(async (response) => {
    if (!response.ok) throw response;
    const value = (await response.json()) as Partial<CsrfToken> | null;
    // Só o cabeçalho canônico: o token nunca vai num cabeçalho escolhido pela resposta.
    if (
      typeof value?.headerName !== 'string' ||
      !/^X-CSRF-TOKEN$/i.test(value.headerName) ||
      typeof value.token !== 'string' ||
      !value.token
    )
      throw new Error('A proteção da sessão não foi confirmada.');
    return { headerName: value.headerName, token: value.token };
  });
  const pending = csrf;
  try {
    return await pending;
  } catch (failure) {
    if (csrf === pending) csrf = null;
    throw failure instanceof Response ? await error(failure.clone()) : failure;
  }
}

async function errorCode(response: Response): Promise<string | undefined> {
  try {
    const value: unknown = await response.clone().json();
    return value && typeof value === 'object' && 'code' in value && typeof value.code === 'string'
      ? value.code
      : undefined;
  } catch {
    return undefined;
  }
}
