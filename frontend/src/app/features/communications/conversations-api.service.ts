import { Injectable } from '@angular/core';
import { isLongExit } from '../operations/long-exit-api.service';
import { LongExit } from '../operations/long-exit.models';
import { OperationsApiError } from '../operations/operations-local-api.service';
import {
  Conversation,
  ConversationMessage,
  ConversationPage,
  OpenExit,
  SessionView,
} from './conversations.models';

const base = '/api/v1/conversas';
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: Record<string, unknown>, names: string[]) =>
  names.every((name) => typeof value[name] === 'string');
const nullableStrings = (value: Record<string, unknown>, names: string[]) =>
  names.every((name) => value[name] === null || typeof value[name] === 'string');
const instant = (value: unknown): value is string =>
  typeof value === 'string' &&
  Number.isFinite(Date.parse(value)) &&
  /(?:Z|[+-]\d\d:\d\d)$/.test(value);
const nullableInstant = (value: unknown) => value === null || instant(value);
const count = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const oneOf = (value: unknown, allowed: string[]) => allowed.includes(String(value));
const directions = ['IN', 'OUT'];
const kinds = ['TEXT', 'IMAGE', 'AUDIO', 'DOCUMENT'];

function isGuardianLink(value: unknown): boolean {
  return (
    record(value) &&
    strings(value, ['id', 'name', 'relationship', 'residentId', 'residentName']) &&
    nullableStrings(value, ['phone'])
  );
}
function isPreview(value: unknown): boolean {
  return (
    record(value) &&
    oneOf(value['direction'], directions) &&
    oneOf(value['kind'], kinds) &&
    nullableStrings(value, ['body', 'deliveryStatus']) &&
    instant(value['sentAt'])
  );
}
function isConversation(value: unknown): value is Conversation {
  return (
    record(value) &&
    strings(value, ['id', 'chatId']) &&
    nullableStrings(value, ['phone']) &&
    typeof value['linked'] === 'boolean' &&
    Array.isArray(value['guardians']) &&
    value['guardians'].every(isGuardianLink) &&
    (value['lastMessage'] === null || isPreview(value['lastMessage'])) &&
    count(value['unreadCount']) &&
    nullableInstant(value['lastMessageAt'])
  );
}
function isMessage(value: unknown): value is ConversationMessage {
  return (
    record(value) &&
    strings(value, ['id', 'conversationId']) &&
    oneOf(value['direction'], directions) &&
    oneOf(value['origin'], [
      'WEBHOOK',
      'RECONCILIATION',
      'SUPERVISOR',
      'DEVICE',
      'AUTHORIZATION',
    ]) &&
    oneOf(value['kind'], kinds) &&
    nullableStrings(value, ['body', 'mediaFailureCode', 'mediaType', 'mediaFilename']) &&
    oneOf(value['mediaState'], ['NONE', 'PENDING', 'STORED', 'FAILED']) &&
    count(value['mediaSize']) &&
    (value['deliveryStatus'] === null ||
      oneOf(value['deliveryStatus'], [
        'QUEUED',
        'SENT',
        'DELIVERED',
        'READ',
        'FAILED',
        'UNCERTAIN',
      ])) &&
    nullableStrings(value, ['failureCode']) &&
    instant(value['sentAt']) &&
    typeof value['linkable'] === 'boolean'
  );
}
function isOpenExit(value: unknown): value is OpenExit {
  return (
    record(value) &&
    strings(value, ['id', 'residentId', 'residentName', 'guardianId', 'guardianName']) &&
    count(value['version']) &&
    instant(value['requestedDepartureAt']) &&
    instant(value['expectedReturnAt'])
  );
}
function isSession(value: unknown): value is SessionView {
  return (
    record(value) &&
    typeof value['available'] === 'boolean' &&
    typeof value['status'] === 'string' &&
    nullableInstant(value['linkedAt']) &&
    nullableInstant(value['lastEventAt']) &&
    typeof value['canSend'] === 'boolean' &&
    (value['unavailableReason'] === null ||
      oneOf(value['unavailableReason'], [
        'gateway_disabled',
        'session_not_ready',
        'gateway_unreachable',
      ]))
  );
}
const pageOf =
  <T>(guard: (value: unknown) => value is T) =>
  (value: unknown): value is ConversationPage<T> =>
    record(value) &&
    Array.isArray(value['items']) &&
    value['items'].every(guard) &&
    nullableStrings(value, ['nextCursor']);
const listOf =
  <T>(guard: (value: unknown) => value is T) =>
  (value: unknown): value is T[] =>
    Array.isArray(value) && value.every(guard);

@Injectable({ providedIn: 'root' })
export class ConversationsApiService {
  async list(
    filter: { q?: string; before?: string } = {},
    signal?: AbortSignal,
  ): Promise<ConversationPage<Conversation>> {
    const query = new URLSearchParams(
      Object.entries(filter).filter((entry): entry is [string, string] => !!entry[1]),
    );
    return this.read(`${base}${query.size ? '?' + query : ''}`, pageOf(isConversation), signal);
  }
  async start(guardianId: string): Promise<Conversation> {
    return this.write(base, { guardianId }, isConversation);
  }
  async get(id: string): Promise<Conversation> {
    return this.read(`${base}/${encodeURIComponent(id)}`, isConversation);
  }
  async markRead(id: string): Promise<void> {
    await this.send(`${base}/${encodeURIComponent(id)}/leitura`);
  }
  async messages(id: string, before?: string): Promise<ConversationPage<ConversationMessage>> {
    const query = before ? `?${new URLSearchParams({ before })}` : '';
    return this.read(`${base}/${encodeURIComponent(id)}/mensagens${query}`, pageOf(isMessage));
  }
  async sendText(id: string, text: string, key: string): Promise<ConversationMessage> {
    return this.write(`${base}/${encodeURIComponent(id)}/mensagens`, { text }, isMessage, key);
  }
  async sendFile(
    id: string,
    file: File,
    caption: string,
    key: string,
  ): Promise<ConversationMessage> {
    const form = new FormData();
    form.append('file', file);
    if (caption) form.append('text', caption);
    return this.write(`${base}/${encodeURIComponent(id)}/mensagens`, form, isMessage, key);
  }
  async openExits(id: string): Promise<OpenExit[]> {
    return this.read(`${base}/${encodeURIComponent(id)}/saidas-abertas`, listOf(isOpenExit));
  }
  async link(messageId: string, exit: Pick<OpenExit, 'id' | 'version'>): Promise<LongExit> {
    return this.write(
      `${base}/mensagens/${encodeURIComponent(messageId)}/vinculo`,
      { exitId: exit.id, version: exit.version },
      isLongExit,
    );
  }
  /** No extension in the path: the proxy's static-file rule would otherwise take the request. */
  mediaUrl(messageId: string): string {
    return `${base}/mensagens/${encodeURIComponent(messageId)}/midia`;
  }
  async session(): Promise<SessionView> {
    return this.read(`${base}/sessao`, isSession);
  }
  async startSession(): Promise<SessionView> {
    return this.write(`${base}/sessao/inicio`, undefined, isSession);
  }
  qrUrl(revision: number): string {
    return `${base}/sessao/qr?v=${revision}`;
  }

  private async read<T>(
    url: string,
    guard: (value: unknown) => value is T,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.checked(await (await this.fetchOk(url, {}, signal)).json(), guard);
  }
  private async write<T>(
    url: string,
    input: FormData | object | undefined,
    guard: (value: unknown) => value is T,
    idempotencyKey?: string,
  ): Promise<T> {
    return this.checked(await (await this.send(url, input, idempotencyKey)).json(), guard);
  }
  private async send(
    url: string,
    input?: FormData | object,
    idempotencyKey?: string,
  ): Promise<Response> {
    const csrf: unknown = await (await this.fetchOk('/api/v1/auth/csrf', {})).json();
    if (!record(csrf) || !strings(csrf, ['headerName', 'token']))
      throw new Error('Não foi possível obter a proteção da sessão.');
    const headers: Record<string, string> = { [String(csrf['headerName'])]: String(csrf['token']) };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    // The browser must write the multipart boundary itself.
    if (input !== undefined && !(input instanceof FormData))
      headers['Content-Type'] = 'application/json';
    return this.fetchOk(url, {
      method: 'POST',
      headers,
      ...(input === undefined
        ? {}
        : { body: input instanceof FormData ? input : JSON.stringify(input) }),
    });
  }
  private async fetchOk(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    const response = await fetch(url, {
      ...init,
      signal,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...init.headers },
    });
    if (response.ok) return response;
    const body: unknown = await response.json().catch(() => null);
    throw new OperationsApiError(
      response.status,
      record(body) && typeof body['code'] === 'string' ? body['code'] : undefined,
      record(body) && typeof body['message'] === 'string'
        ? body['message']
        : // The proxy answers an oversized upload by itself, without the API's JSON body.
          response.status === 413
          ? 'O arquivo passa do limite de 10 MB.'
          : undefined,
    );
  }
  private checked<T>(value: unknown, guard: (value: unknown) => value is T): T {
    if (!guard(value)) throw new Error('O servidor retornou dados inválidos. Tente novamente.');
    return value;
  }
}
