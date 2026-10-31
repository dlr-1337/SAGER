import {
  ERROR_CONFLICT,
  ERROR_GENERIC,
  ERROR_INVALID,
  ERROR_NOT_FOUND,
  ERROR_SESSION,
} from '../../core/error-messages';
import { Injectable } from '@angular/core';
import { Observable, defer } from 'rxjs';
import {
  CareAssignment,
  HealthAccount,
  HealthCapabilities,
  HealthCategory,
  HealthAuthor,
  HealthCustody,
  HealthExport,
  HealthNote,
  HealthNoteSummary,
  HealthPage,
  HealthProfessional,
  HealthProfession,
  HealthResident,
  HealthRevision,
  ProfessionalGrant,
  allCategories,
  professionLabels,
} from './health.models';

type Guard<T> = (value: unknown) => value is T;
type Query = Record<string, string | number | null | undefined>;
const base = '/api/v1/saude';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
const strings = (v: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => typeof v[key] === 'string');
const nullable = (v: unknown) => v === null || typeof v === 'string';
const numbered = (v: Record<string, unknown>) =>
  Number.isSafeInteger(v['version']) && (v['version'] as number) >= 0;
const profession = (v: unknown): v is HealthProfession =>
  typeof v === 'string' && Object.hasOwn(professionLabels, v);
const category = (v: unknown): v is HealthCategory => allCategories.includes(v as HealthCategory);

const grant: Guard<ProfessionalGrant> = (v): v is ProfessionalGrant =>
  object(v) &&
  strings(v, [
    'id',
    'accountId',
    'accountName',
    'registrationNumber',
    'registrationRegion',
    'verifiedBy',
    'verifiedAt',
    'verificationReason',
    'startedAt',
  ]) &&
  profession(v['profession']) &&
  nullable(v['endedAt']) &&
  numbered(v) &&
  Number.isSafeInteger(v['sequence']);
const capabilities: Guard<HealthCapabilities> = (v): v is HealthCapabilities =>
  object(v) &&
  (v['professionalGrant'] === null || grant(v['professionalGrant'])) &&
  typeof v['canAdministerAccess'] === 'boolean' &&
  typeof v['canAccessOwnRecord'] === 'boolean';
const account: Guard<HealthAccount> = (v): v is HealthAccount =>
  object(v) && strings(v, ['id', 'name', 'profile']) && nullable(v['email']);
const assignment: Guard<CareAssignment> = (v): v is CareAssignment =>
  object(v) &&
  strings(v, [
    'id',
    'residentId',
    'residentName',
    'professionalGrantId',
    'accountId',
    'accountName',
    'startedAt',
    'createdBy',
    'reason',
  ]) &&
  profession(v['profession']) &&
  nullable(v['endedAt']) &&
  numbered(v) &&
  Number.isSafeInteger(v['sequence']);
const authors: Guard<HealthAuthor[]> = (v): v is HealthAuthor[] =>
  Array.isArray(v) && v.every((item) => object(item) && strings(item, ['id', 'name']));
const custody: Guard<HealthCustody> = (v): v is HealthCustody =>
  object(v) &&
  strings(v, [
    'id',
    'residentId',
    'sourceAuthorAccountId',
    'sourceAuthorName',
    'recipientGrantId',
    'recipientAccountName',
    'createdBy',
    'createdAt',
    'reason',
  ]) &&
  nullable(v['endedAt']) &&
  numbered(v) &&
  Number.isSafeInteger(v['sequence']);
const resident: Guard<HealthResident> = (v): v is HealthResident =>
  object(v) &&
  strings(v, ['id', 'name', 'enrollment']) &&
  nullable(v['birthDate']) &&
  nullable(v['lastRecordedAt']) &&
  nullable(v['reviewAfter']);
const professional: Guard<HealthProfessional> = (v): v is HealthProfessional =>
  object(v) &&
  strings(v, ['accountId', 'grantId', 'careAssignmentId', 'name']) &&
  profession(v['profession']);
const summary: Guard<HealthNoteSummary> = (v): v is HealthNoteSummary =>
  object(v) &&
  strings(v, [
    'id',
    'residentId',
    'authorAccountId',
    'authorName',
    'authorRegistrationNumber',
    'authorRegistrationRegion',
    'createdAt',
    'updatedAt',
  ]) &&
  category(v['category']) &&
  profession(v['authorProfession']) &&
  numbered(v) &&
  Number.isSafeInteger(v['sequence']) &&
  nullable(v['relatedNoteId']) &&
  ['canCorrect', 'canShare', 'custodyAccess'].every((key) => typeof v[key] === 'boolean');
const note: Guard<HealthNote> = (v): v is HealthNote =>
  summary(v) &&
  object(v) &&
  typeof v['body'] === 'string' &&
  Array.isArray(v['shares']) &&
  v['shares'].every(
    (s) =>
      object(s) &&
      strings(s, [
        'id',
        'recipientGrantId',
        'recipientCareAssignmentId',
        'recipientName',
        'createdAt',
      ]) &&
      profession(s['profession']) &&
      nullable(s['endedAt']) &&
      numbered(s),
  );
const revision: Guard<HealthRevision> = (v): v is HealthRevision =>
  object(v) &&
  strings(v, ['id', 'noteId', 'body', 'recordedAt', 'recordedBy']) &&
  nullable(v['reason']) &&
  numbered(v);

function page<T>(guard: Guard<T>): Guard<HealthPage<T>> {
  return (v): v is HealthPage<T> =>
    object(v) &&
    Array.isArray(v['items']) &&
    v['items'].every(guard) &&
    (v['nextCursor'] === null ||
      typeof v['nextCursor'] === 'string' ||
      Number.isSafeInteger(v['nextCursor'])) &&
    Number.isSafeInteger(v['totalCount']) &&
    (v['totalCount'] as number) >= 0;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super(`A solicitação de saúde foi recusada (${status}).`);
  }
}

export function healthErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return ERROR_SESSION;
    if (error.status === 403)
      return error.code === 'csrf_invalid'
        ? 'Esta página ficou aberta por muito tempo. Recarregue a página e tente de novo.'
        : 'Sua conta não pode ver isto. Fale com o gestor.';
    if (error.status === 404) return ERROR_NOT_FOUND;
    if (error.status === 409) return ERROR_CONFLICT;
    if (error.status === 400 || error.status === 422) return ERROR_INVALID;
  }
  return ERROR_GENERIC;
}

@Injectable({ providedIn: 'root' })
export class HealthApiService {
  getMe(): Observable<HealthCapabilities> {
    return defer(() => this.read(`${base}/me`, capabilities));
  }
  accounts(q = '', afterId?: string | number | null) {
    return this.read(this.url('contas', { q, afterId }), page(account));
  }
  grants(accountId: string, beforeSequence?: string | number | null) {
    return this.read(this.url('habilitacoes', { accountId, beforeSequence }), page(grant));
  }
  createGrant(input: {
    accountId: string;
    profession: HealthProfession;
    registrationNumber: string;
    registrationRegion: string;
    verificationReason: string;
  }) {
    return this.mutate('habilitacoes', input);
  }
  revokeGrant(id: string, version: number, reason: string) {
    return this.mutate(`habilitacoes/${encodeURIComponent(id)}/revogacao`, { version, reason });
  }
  assignments(residentId: string, beforeSequence?: string | number | null) {
    return this.read(this.url('vinculos', { residentId, beforeSequence }), page(assignment));
  }
  createAssignment(input: { residentId: string; professionalGrantId: string; reason: string }) {
    return this.mutate('vinculos', input);
  }
  endAssignment(id: string, version: number, reason: string) {
    return this.mutate(`vinculos/${encodeURIComponent(id)}/encerramento`, { version, reason });
  }
  custodies(residentId: string, beforeSequence?: string | number | null) {
    return this.read(this.url('custodias', { residentId, beforeSequence }), page(custody));
  }
  noteAuthors(residentId: string) {
    return this.read(this.url('custodias/autores', { residentId }), authors);
  }
  createCustody(input: {
    residentId: string;
    sourceAuthorAccountId: string;
    recipientGrantId: string;
    reason: string;
  }) {
    return this.mutate('custodias', input);
  }
  endCustody(id: string, version: number, reason: string) {
    return this.mutate(`custodias/${encodeURIComponent(id)}/encerramento`, { version, reason });
  }
  residents(q = '', afterId?: string | number | null) {
    return this.read(this.url('residentes', { q, afterId }), page(resident));
  }
  resident(id: string) {
    return this.read(`${base}/residentes/${encodeURIComponent(id)}`, resident);
  }
  professionals(id: string, selectedCategory: HealthCategory) {
    return this.read(
      this.url(`residentes/${encodeURIComponent(id)}/profissionais`, {
        category: selectedCategory,
      }),
      (v): v is { items: HealthProfessional[] } =>
        object(v) && Array.isArray(v['items']) && v['items'].every(professional),
    );
  }
  notes(id: string, selectedCategory = '', beforeSequence?: string | number | null) {
    return this.read(
      this.url(`residentes/${encodeURIComponent(id)}/notas`, {
        category: selectedCategory,
        beforeSequence,
      }),
      page(summary),
    );
  }
  async createNote(
    id: string,
    input: { category: HealthCategory; body: string; relatedNoteId?: string },
  ) {
    return this.write(this.url(`residentes/${encodeURIComponent(id)}/notas`), input, note);
  }
  note(id: string, own = false) {
    return this.read(`${own ? '/api/v1/minha-saude' : base}/notas/${encodeURIComponent(id)}`, note);
  }
  history(id: string, own = false, beforeVersion?: string | number | null) {
    const params = new URLSearchParams({ limit: '20' });
    if (beforeVersion !== null && beforeVersion !== undefined)
      params.set('beforeVersion', String(beforeVersion));
    return this.read(
      `${own ? '/api/v1/minha-saude' : base}/notas/${encodeURIComponent(id)}/historico?${params}`,
      page(revision),
    );
  }
  correctNote(id: string, input: { version: number; body: string; reason: string }) {
    return this.mutate(`notas/${encodeURIComponent(id)}/correcoes`, input);
  }
  shareNote(id: string, version: number, recipientGrantIds: string[]) {
    return this.mutate(`notas/${encodeURIComponent(id)}/partilhas`, { version, recipientGrantIds });
  }
  revokeShare(id: string, shareId: string, version: number) {
    return this.mutate(
      `notas/${encodeURIComponent(id)}/partilhas/${encodeURIComponent(shareId)}/revogacao`,
      { version },
    );
  }
  ownNotes(selectedCategory = '', beforeSequence?: string | number | null) {
    const params = new URLSearchParams({ limit: '20' });
    if (selectedCategory) params.set('category', selectedCategory);
    if (beforeSequence !== null && beforeSequence !== undefined)
      params.set('beforeSequence', String(beforeSequence));
    return this.read(`/api/v1/minha-saude/notas?${params}`, page(summary));
  }
  export(id?: string) {
    const endpoint = id
      ? `${base}/residentes/${encodeURIComponent(id)}/exportacoes`
      : '/api/v1/minha-saude/exportacoes';
    return this.write(
      endpoint,
      {},
      (v): v is HealthExport =>
        object(v) &&
        strings(v, ['exportId', 'generatedAt', 'requestId']) &&
        uuid.test(v['exportId'] as string) &&
        resident(v['resident']) &&
        Array.isArray(v['notes']),
    );
  }

  private url(path: string, query: Query = {}): string {
    const params = new URLSearchParams({ limit: '20' });
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    });
    return `${base}/${path}?${params}`;
  }
  private async read<T>(url: string, guard: Guard<T>): Promise<T> {
    return this.request(url, { method: 'GET' }, guard);
  }
  private async mutate(path: string, body: unknown): Promise<void> {
    await this.write(`${base}/${path}`, body, (v): v is unknown => true);
  }
  private async write<T>(url: string, body: unknown, guard: Guard<T>): Promise<T> {
    const token = await this.read(
      '/api/v1/auth/csrf',
      (v): v is { headerName: string; token: string } =>
        object(v) && strings(v, ['headerName', 'token']),
    );
    return this.request(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [token.headerName]: token.token },
        body: JSON.stringify(body),
      },
      guard,
    );
  }
  private async request<T>(url: string, init: RequestInit, guard: Guard<T>): Promise<T> {
    const response = await fetch(url, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...init.headers },
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      throw new ApiError(
        response.status,
        object(body) && typeof body['code'] === 'string' ? body['code'] : undefined,
        object(body) && typeof body['requestId'] === 'string' && uuid.test(body['requestId'])
          ? body['requestId']
          : undefined,
      );
    }
    const value: unknown = response.status === 204 ? null : await response.json();
    if (!guard(value)) throw new Error('A resposta de saúde não pôde ser confirmada.');
    return value;
  }
}
