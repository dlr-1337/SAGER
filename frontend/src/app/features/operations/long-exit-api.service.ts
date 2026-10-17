import { readArrayPage } from '../../core/list-page';
import { Injectable } from '@angular/core';
import { LongExit, LongExitEligibility, LongExitInput } from './long-exit.models';
import { OperationsApiError } from './operations-local-api.service';
import { PhysicalExitInput } from './operations-local.models';
import { exitStatusLabels } from './operations-local.utils';
import { messageStatusLabels, signatureStatusLabels } from './long-exit.utils';

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const fields = (value: Record<string, unknown>, names: string[]) =>
  names.every((name) => typeof value[name] === 'string');
const instant = (value: unknown): value is string =>
  typeof value === 'string' &&
  Number.isFinite(Date.parse(value)) &&
  /(?:Z|[+-]\d\d:\d\d)$/.test(value);
const version = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function isEligibility(value: unknown): value is LongExitEligibility {
  return (
    record(value) &&
    fields(value, ['residentId', 'residentName', 'enrollment', 'currentDate', 'zone']) &&
    instant(value['now']) &&
    typeof value['eligible'] === 'boolean' &&
    Array.isArray(value['blockers']) &&
    value['blockers'].every((item) => typeof item === 'string') &&
    record(value['providers']) &&
    typeof value['providers']['clicksignEnabled'] === 'boolean' &&
    typeof value['providers']['whatsappEnabled'] === 'boolean' &&
    Array.isArray(value['guardians']) &&
    value['guardians'].every(
      (guardian) =>
        record(guardian) &&
        fields(guardian, ['id', 'name', 'relationship']) &&
        (guardian['phone'] === null || typeof guardian['phone'] === 'string') &&
        typeof guardian['eligible'] === 'boolean' &&
        Array.isArray(guardian['blockers']) &&
        guardian['blockers'].every((blocker) => typeof blocker === 'string'),
    )
  );
}
function isLongExit(value: unknown): value is LongExit {
  if (
    !record(value) ||
    !fields(value, [
      'id',
      'residentId',
      'residentName',
      'enrollment',
      'guardianId',
      'guardianName',
      'guardianRelationship',
      'reason',
      'zone',
    ]) ||
    !version(value['version']) ||
    !['NOW', 'SCHEDULED'].includes(String(value['departureMode'])) ||
    !Object.hasOwn(exitStatusLabels, String(value['status'])) ||
    !Object.hasOwn(signatureStatusLabels, String(value['signatureStatus'])) ||
    !Object.hasOwn(messageStatusLabels, String(value['messageStatus'])) ||
    !instant(value['requestedDepartureAt']) ||
    !instant(value['expectedReturnAt']) ||
    !instant(value['now']) ||
    !record(value['capabilities'])
  )
    return false;
  const caps = value['capabilities'];
  if (
    ![
      'canEdit',
      'canApprove',
      'canReject',
      'canCancel',
      'canDepart',
      'canReturn',
      'canResend',
      'canReconcile',
      'canDownloadOriginal',
      'canDownloadSigned',
    ].every((field) => typeof caps[field] === 'boolean')
  )
    return false;
  const document = value['currentDocument'];
  if (
    document !== null &&
    (!record(document) ||
      !fields(document, ['documentVersionId', 'originalState', 'signedState']) ||
      !version(document['revisionNumber']))
  )
    return false;
  if (
    !version(value['remainingResends']) ||
    (value['resendAvailableAt'] !== null && !instant(value['resendAvailableAt']))
  )
    return false;
  if (
    !Array.isArray(value['bindings']) ||
    !value['bindings'].every(
      (binding) =>
        record(binding) &&
        fields(binding, ['id', 'documentVersionId', 'guardianId', 'guardianName']) &&
        Object.hasOwn(signatureStatusLabels, String(binding['status'])) &&
        Object.hasOwn(messageStatusLabels, String(binding['messageStatus'])) &&
        typeof binding['widgetAvailable'] === 'boolean' &&
        instant(binding['createdAt']) &&
        instant(binding['expiresAt']),
    )
  )
    return false;
  return (
    Array.isArray(value['history']) &&
    value['history'].every(
      (event) =>
        record(event) &&
        fields(event, ['id', 'event', 'actorProfile', 'status', 'guardianId']) &&
        version(event['version']) &&
        instant(event['recordedAt']),
    )
  );
}

@Injectable({ providedIn: 'root' })
export class LongExitApiService {
  async eligibility(): Promise<LongExitEligibility> {
    return this.checked(await this.request('/api/v1/saidas-longas/elegibilidade'), isEligibility);
  }
  async page(
    params: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<{ items: LongExit[]; total: number }> {
    return readArrayPage(
      '/api/v1/saidas-longas',
      params,
      isLongExit,
      async (response) => new OperationsApiError(response.status),
      signal,
    );
  }
  async list(search = '', status = ''): Promise<LongExit[]> {
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    const value = await this.request(
      '/api/v1/saidas-longas' + (query.size ? '?' + query.toString() : ''),
    );
    if (!Array.isArray(value) || !value.every(isLongExit))
      throw new Error('O servidor retornou uma lista inválida. Tente novamente.');
    return value;
  }
  async get(id: string): Promise<LongExit> {
    return this.checked(
      await this.request(`/api/v1/saidas-longas/${encodeURIComponent(id)}`),
      isLongExit,
    );
  }
  async save(input: LongExitInput, existing?: Pick<LongExit, 'id' | 'version'>): Promise<LongExit> {
    return this.checked(
      await this.request(
        '/api/v1/saidas-longas' + (existing ? '/' + encodeURIComponent(existing.id) : ''),
        existing ? 'PUT' : 'POST',
        { ...input, ...(existing ? { version: existing.version } : {}) },
      ),
      isLongExit,
    );
  }
  async decide(exit: LongExit, decision: 'APPROVE' | 'REJECT', comment: string): Promise<LongExit> {
    if (decision === 'APPROVE' && !exit.currentDocument)
      throw new Error('O documento da revisão atual ainda não está disponível.');
    return this.mutate(exit.id, 'decisao', {
      version: exit.version,
      decision,
      ...(decision === 'APPROVE'
        ? { documentVersionId: exit.currentDocument!.documentVersionId }
        : {}),
      ...(comment ? { comment } : {}),
    });
  }
  async cancel(exit: LongExit, comment: string): Promise<LongExit> {
    return this.mutate(exit.id, 'cancelamento', { version: exit.version, comment });
  }
  async resend(exit: LongExit, comment: string, guardianId?: string): Promise<LongExit> {
    return this.mutate(exit.id, 'reenvio', {
      version: exit.version,
      comment,
      ...(guardianId ? { guardianId } : {}),
    });
  }
  async reconcile(exit: LongExit): Promise<LongExit> {
    return this.mutate(exit.id, 'reconciliacao', { version: exit.version });
  }
  async physical(
    id: string,
    action: 'partida' | 'retorno',
    input: PhysicalExitInput,
  ): Promise<LongExit> {
    return this.mutate(id, action, input);
  }
  async document(
    id: string,
    documentVersionId: string,
    kind: 'original' | 'assinado',
  ): Promise<Blob> {
    const response = await this.response(
      `/api/v1/saidas-longas/${encodeURIComponent(id)}/documentos/${encodeURIComponent(documentVersionId)}/${kind}`,
      'GET',
      undefined,
      'application/pdf',
    );
    if (response.headers.get('content-type')?.split(';')[0].trim() !== 'application/pdf')
      throw new Error('O arquivo recebido não é um documento PDF. Tente atualizar os dados.');
    const blob = await response.blob();
    if (!blob.size) throw new Error('O documento recebido está vazio. Tente atualizar os dados.');
    return blob;
  }
  private async mutate(id: string, action: string, input: unknown): Promise<LongExit> {
    return this.checked(
      await this.request(
        `/api/v1/saidas-longas/${encodeURIComponent(id)}/${action}`,
        'POST',
        input,
      ),
      isLongExit,
    );
  }
  private checked<T>(value: unknown, guard: (value: unknown) => value is T): T {
    if (!guard(value))
      throw new Error('O servidor retornou dados inválidos. Recarregue a solicitação.');
    return value;
  }
  private async request(url: string, method = 'GET', input?: unknown): Promise<unknown> {
    return (await this.response(url, method, input)).json();
  }
  private async response(
    url: string,
    method = 'GET',
    input?: unknown,
    accept = 'application/json',
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: accept };
    if (method !== 'GET') {
      const csrf = await this.request('/api/v1/auth/csrf');
      if (!record(csrf) || !fields(csrf, ['headerName', 'token']))
        throw new Error('Não foi possível obter a proteção da sessão.');
      headers[String(csrf['headerName'])] = String(csrf['token']);
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(url, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    });
    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      throw new OperationsApiError(
        response.status,
        record(body) && typeof body['code'] === 'string' ? body['code'] : undefined,
        record(body) && typeof body['message'] === 'string' ? body['message'] : undefined,
      );
    }
    return response;
  }
}
