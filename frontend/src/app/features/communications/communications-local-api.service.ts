import {
  ERROR_CONFLICT,
  ERROR_FORBIDDEN,
  ERROR_GENERIC,
  ERROR_INVALID,
  ERROR_NOT_FOUND,
  ERROR_SESSION,
} from '../../core/error-messages';
import { Injectable } from '@angular/core';
import {
  CursorPage,
  DisciplineContext,
  DisciplineNotification,
  DisciplineOccurrence,
  DisciplineTerm,
  DisciplineWarning,
  EvidenceValue,
  NoticeInput,
  OwnCommunication,
  PrivateDocument,
  PublishedNotice,
  RecurrenceCandidate,
  WarningInput,
} from './communications-local.models';
import {
  categoryLabels,
  notificationLabels,
  severityLabels,
  validCivilDate,
} from './communications-local.utils';

type Guard<T> = (value: unknown) => value is T;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const numbered = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const instant = (value: unknown): value is string =>
  typeof value === 'string' &&
  Number.isFinite(Date.parse(value)) &&
  /(?:Z|[+-]\d\d:\d\d)$/.test(value);
const nullableString = (value: unknown) => value === null || typeof value === 'string';
const nullableTime = (value: unknown) => value === null || instant(value);
const nullableUuid = (value: unknown) => value === null || uuid(value);
const strings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => typeof value[key] === 'string');
const ids = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => uuid(value[key]));
const times = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => instant(value[key]));
const category = (value: unknown) =>
  typeof value === 'string' && Object.hasOwn(categoryLabels, value);
function evidence(value: unknown, depth = 0): value is EvidenceValue {
  if (depth > 12) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value))
    return value.length <= 1000 && value.every((item) => evidence(item, depth + 1));
  return record(value) && Object.values(value).every((item) => evidence(item, depth + 1));
}
const context: Guard<DisciplineContext> = (value): value is DisciplineContext =>
  record(value) &&
  instant(value['now']) &&
  typeof value['currentDate'] === 'string' &&
  validCivilDate(value['currentDate']) &&
  value['zone'] === 'America/Sao_Paulo' &&
  Array.isArray(value['categories']) &&
  value['categories'].every(category) &&
  Array.isArray(value['severities']) &&
  value['severities'].every(
    (item) => typeof item === 'string' && Object.hasOwn(severityLabels, item),
  );
const occurrence: Guard<DisciplineOccurrence> = (value): value is DisciplineOccurrence =>
  record(value) &&
  ids(value, ['id', 'residentId', 'sourceId']) &&
  strings(value, ['residentName', 'sourceType']) &&
  category(value['category']) &&
  typeof value['valid'] === 'boolean' &&
  numbered(value['version']) &&
  numbered(value['sourceVersion']) &&
  instant(value['occurredAt']) &&
  evidence(value['evidence']) &&
  Array.isArray(value['revisions']) &&
  value['revisions'].every(
    (revision) =>
      record(revision) &&
      numbered(revision['version']) &&
      numbered(revision['sourceVersion']) &&
      typeof revision['valid'] === 'boolean' &&
      times(revision, ['occurredAt', 'recordedAt']) &&
      evidence(revision['evidence']),
  );
const notification: Guard<DisciplineNotification> = (value): value is DisciplineNotification =>
  record(value) &&
  ids(value, ['id', 'occurrenceId', 'residentId']) &&
  strings(value, ['residentName', 'policyCode']) &&
  category(value['category']) &&
  typeof value['status'] === 'string' &&
  Object.hasOwn(notificationLabels, value['status']) &&
  typeof value['requiresReview'] === 'boolean' &&
  typeof value['valid'] === 'boolean' &&
  ['version', 'occurrenceVersion', 'policyVersion'].every((key) => numbered(value[key])) &&
  instant(value['createdAt']) &&
  evidence(value['evidence']) &&
  Array.isArray(value['events']) &&
  value['events'].every(
    (event) =>
      record(event) &&
      ids(event, ['id', 'actorId']) &&
      strings(event, ['action']) &&
      instant(event['recordedAt']) &&
      numbered(event['resultingVersion']) &&
      numbered(event['occurrenceVersion']) &&
      nullableString(event['reasonCode']) &&
      nullableString(event['reason']),
  );
const warning: Guard<DisciplineWarning> = (value): value is DisciplineWarning =>
  record(value) &&
  ids(value, ['id', 'residentId', 'issuedBy', 'communicationId']) &&
  strings(value, ['residentName', 'description', 'justification']) &&
  nullableUuid(value['occurrenceId']) &&
  nullableUuid(value['notificationId']) &&
  category(value['category']) &&
  typeof value['severity'] === 'string' &&
  Object.hasOwn(severityLabels, value['severity']) &&
  typeof value['warningDate'] === 'string' &&
  validCivilDate(value['warningDate']) &&
  ['VIGENTE', 'ANULADA'].includes(String(value['status'])) &&
  typeof value['requiresReview'] === 'boolean' &&
  instant(value['issuedAt']) &&
  numbered(value['version']) &&
  nullableString(value['annulmentReason']);
const document: Guard<PrivateDocument> = (value): value is PrivateDocument =>
  record(value) &&
  uuid(value['id']) &&
  typeof value['sha256'] === 'string' &&
  /^[0-9a-f]{64}$/i.test(value['sha256']) &&
  numbered(value['size']) &&
  typeof value['state'] === 'string';
const term: Guard<DisciplineTerm> = (value): value is DisciplineTerm =>
  record(value) &&
  ids(value, ['id', 'residentId', 'issuedBy', 'communicationId']) &&
  strings(value, ['residentName', 'decision']) &&
  Array.isArray(value['warningIds']) &&
  value['warningIds'].every(uuid) &&
  ['EMITIDO', 'ANULADO'].includes(String(value['status'])) &&
  instant(value['issuedAt']) &&
  document(value['document']) &&
  numbered(value['version']) &&
  nullableString(value['annulmentReason']);
const recurrence: Guard<RecurrenceCandidate> = (value): value is RecurrenceCandidate =>
  record(value) &&
  category(value['category']) &&
  numbered(value['minimumWarnings']) &&
  Number(value['minimumWarnings']) >= 2 &&
  numbered(value['windowDays']) &&
  Number(value['windowDays']) > 0 &&
  typeof value['candidate'] === 'boolean' &&
  Array.isArray(value['warnings']) &&
  value['warnings'].every(warning);
const notice: Guard<PublishedNotice> = (value): value is PublishedNotice =>
  record(value) &&
  uuid(value['id']) &&
  strings(value, ['title', 'body']) &&
  Array.isArray(value['residentIds']) &&
  value['residentIds'].every(uuid) &&
  ['RASCUNHO', 'PUBLICADO', 'RETIRADO'].includes(String(value['status'])) &&
  numbered(value['version']) &&
  nullableTime(value['publishedAt']) &&
  nullableUuid(value['communicationId']) &&
  nullableString(value['withdrawalReason']);
const own: Guard<OwnCommunication> = (value): value is OwnCommunication =>
  record(value) &&
  ids(value, ['id', 'sourceId']) &&
  strings(value, ['title', 'body']) &&
  ['AVISO', 'ADVERTENCIA', 'TERMO'].includes(String(value['kind'])) &&
  numbered(value['contentVersion']) &&
  ['PUBLICADO', 'SUPERADO', 'RETIRADO', 'ANULADO'].includes(String(value['status'])) &&
  instant(value['publishedAt']) &&
  nullableString(value['stateReason']) &&
  typeof value['requiresReview'] === 'boolean' &&
  nullableTime(value['readAt']) &&
  nullableTime(value['acknowledgedAt']) &&
  (value['document'] === null || document(value['document']));
function page<T>(guard: Guard<T>): Guard<CursorPage<T>> {
  return (value): value is CursorPage<T> =>
    record(value) &&
    Array.isArray(value['items']) &&
    value['items'].every(guard) &&
    (value['nextCursor'] === null || numbered(value['nextCursor']));
}

export class CommunicationsApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super('A operação de comunicação não foi concluída.');
  }
}
export function communicationsError(error: unknown): string {
  if (
    error instanceof CommunicationsApiError ||
    (record(error) && typeof error['status'] === 'number')
  ) {
    const status = error instanceof CommunicationsApiError ? error.status : error['status'];
    if (status === 401) return ERROR_SESSION;
    if (status === 403) return ERROR_FORBIDDEN;
    if (status === 404) return ERROR_NOT_FOUND;
    if (status === 409) return ERROR_CONFLICT;
    if (status === 400 || status === 422) return ERROR_INVALID;
  }
  return ERROR_GENERIC;
}

@Injectable({ providedIn: 'root' })
export class CommunicationsLocalApiService {
  context(): Promise<DisciplineContext> {
    return this.get('/notificacoes/contexto', context);
  }
  notifications(
    residentId = '',
    status = '',
    beforeSequence?: number,
    filters: Record<string, string> = {},
  ): Promise<CursorPage<DisciplineNotification>> {
    return this.get(
      '/notificacoes' + this.query({ ...filters, residentId, status, beforeSequence }),
      page(notification),
    );
  }
  notification(id: string): Promise<DisciplineNotification> {
    return this.get('/notificacoes/' + this.id(id), notification);
  }
  occurrence(id: string): Promise<DisciplineOccurrence> {
    return this.get('/ocorrencias/' + this.id(id), occurrence);
  }
  notificationAction(
    id: string,
    action: 'visualizar' | 'analisar' | 'arquivar',
    input: {
      version: number;
      reason?: string;
      reasonCode?: string;
      confirmCurrentEvidence?: boolean;
    },
  ): Promise<DisciplineNotification> {
    return this.post(`/notificacoes/${this.id(id)}/${action}`, input, notification);
  }
  convert(
    id: string,
    input: WarningInput & { version: number; idempotencyKey: string },
  ): Promise<DisciplineWarning> {
    return this.post(`/notificacoes/${this.id(id)}/converter`, input, warning);
  }
  warnings(
    residentId = '',
    beforeSequence?: number,
    filters: Record<string, string> = {},
  ): Promise<CursorPage<DisciplineWarning>> {
    return this.get(
      '/advertencias' + this.query({ ...filters, residentId, beforeSequence }),
      page(warning),
    );
  }
  warning(id: string): Promise<DisciplineWarning> {
    return this.get('/advertencias/' + this.id(id), warning);
  }
  createWarning(
    input: WarningInput & { residentId: string; idempotencyKey: string },
  ): Promise<DisciplineWarning> {
    return this.post('/advertencias', input, warning);
  }
  annulWarning(id: string, version: number, reason: string): Promise<DisciplineWarning> {
    return this.post(`/advertencias/${this.id(id)}/anular`, { version, reason }, warning);
  }
  recurrences(residentId: string): Promise<RecurrenceCandidate[]> {
    return this.get(
      `/residentes/${this.id(residentId)}/reincidencias`,
      (value): value is RecurrenceCandidate[] => Array.isArray(value) && value.every(recurrence),
    );
  }
  terms(residentId: string, beforeSequence?: number): Promise<CursorPage<DisciplineTerm>> {
    return this.get(
      `/residentes/${this.id(residentId)}/termos` + this.query({ beforeSequence }),
      page(term),
    );
  }
  term(id: string): Promise<DisciplineTerm> {
    return this.get('/termos/' + this.id(id), term);
  }
  issueTerm(
    residentId: string,
    input: { warningIds: string[]; decision: string; confirmed: true; idempotencyKey: string },
  ): Promise<DisciplineTerm> {
    return this.post(`/residentes/${this.id(residentId)}/termos`, input, term);
  }
  annulTerm(id: string, version: number, reason: string): Promise<DisciplineTerm> {
    return this.post(`/termos/${this.id(id)}/anular`, { version, reason }, term);
  }
  notices(
    beforeSequence?: number,
    filters: Record<string, string> = {},
  ): Promise<CursorPage<PublishedNotice>> {
    return this.get('/avisos' + this.query({ ...filters, beforeSequence }), page(notice));
  }
  notice(id: string): Promise<PublishedNotice> {
    return this.get('/avisos/' + this.id(id), notice);
  }
  createNotice(input: NoticeInput & { idempotencyKey: string }): Promise<PublishedNotice> {
    return this.post('/avisos', input, notice);
  }
  publishNotice(id: string, version: number, idempotencyKey: string): Promise<PublishedNotice> {
    return this.post(`/avisos/${this.id(id)}/publicar`, { version, idempotencyKey }, notice);
  }
  reviseNotice(
    id: string,
    input: { version: number; title: string; body: string; idempotencyKey: string },
  ): Promise<PublishedNotice> {
    return this.post(`/avisos/${this.id(id)}/revisar`, input, notice);
  }
  withdrawNotice(id: string, version: number, reason: string): Promise<PublishedNotice> {
    return this.post(`/avisos/${this.id(id)}/retirar`, { version, reason }, notice);
  }
  ownList(
    kind: 'avisos' | 'advertencias' | 'termos',
    beforeSequence?: number,
    filters: Record<string, string> = {},
  ): Promise<CursorPage<OwnCommunication>> {
    return this.get(`/me/${kind}` + this.query({ ...filters, beforeSequence }), page(own));
  }
  own(id: string): Promise<OwnCommunication> {
    return this.get('/me/comunicacoes/' + this.id(id), own);
  }
  ownAction(
    id: string,
    action: 'leitura' | 'ciencia',
    contentVersion: number,
  ): Promise<OwnCommunication> {
    return this.post(`/me/comunicacoes/${this.id(id)}/${action}`, { version: contentVersion }, own);
  }
  async document(id: string, own = false): Promise<Blob> {
    const response = await this.response(
      `${own ? '/me' : ''}/termos/${this.id(id)}/documento`,
      'GET',
      undefined,
      'application/pdf',
    );
    if (response.headers.get('content-type')?.split(';')[0].trim() !== 'application/pdf')
      throw new Error('O servidor não retornou um documento PDF.');
    const blob = await response.blob();
    if (!blob.size) throw new Error('O documento está vazio.');
    return blob;
  }
  private id(value: string): string {
    if (!uuid(value)) throw new Error('Identificador de registro inválido.');
    return encodeURIComponent(value);
  }
  private query(values: Record<string, string | number | undefined>): string {
    const params = new URLSearchParams({ limit: '25' });
    for (const [key, value] of Object.entries(values))
      if (value !== undefined && value !== '') params.set(key, String(value));
    return '?' + params.toString();
  }
  private async get<T>(path: string, guard: Guard<T>): Promise<T> {
    return this.checked(await (await this.response(path)).json(), guard);
  }
  private async post<T>(path: string, input: unknown, guard: Guard<T>): Promise<T> {
    return this.checked(await (await this.response(path, 'POST', input)).json(), guard);
  }
  private checked<T>(value: unknown, guard: Guard<T>): T {
    if (!guard(value)) throw new Error('O servidor retornou dados de comunicação inválidos.');
    return value;
  }
  private async response(
    path: string,
    method = 'GET',
    input?: unknown,
    accept = 'application/json',
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: accept };
    if (method !== 'GET') {
      const csrf: unknown = await (await this.response('/auth/csrf')).json();
      if (
        !record(csrf) ||
        typeof csrf['headerName'] !== 'string' ||
        !/^X-CSRF-TOKEN$/i.test(csrf['headerName']) ||
        typeof csrf['token'] !== 'string'
      )
        throw new Error('A proteção da sessão não foi confirmada.');
      headers[csrf['headerName']] = csrf['token'];
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch('/api/v1' + path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    });
    if (!response.ok) {
      let value: unknown;
      try {
        value = await response.json();
      } catch {
        value = null;
      }
      throw new CommunicationsApiError(
        response.status,
        record(value) && typeof value['code'] === 'string' ? value['code'] : undefined,
      );
    }
    return response;
  }
}
