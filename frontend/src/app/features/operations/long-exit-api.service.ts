import { api } from '../../core/api';
import { ERROR_GENERIC } from '../../core/error-messages';
import { readArrayPage } from '../../core/list-page';
import { Injectable } from '@angular/core';
import { isAuthorizationMediaType } from './long-exit-document.utils';
import { LongExit, LongExitEligibility, LongExitInput, ReceivedFile } from './long-exit.models';
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
const nullableText = (value: unknown) => value === null || typeof value === 'string';
const nullableInstant = (value: unknown) => value === null || instant(value);
function isAuthorizationFile(value: unknown): boolean {
  return (
    record(value) &&
    fields(value, ['id', 'documentVersionId', 'bindingId', 'mediaType', 'sha256']) &&
    ['WHATSAPP', 'MANUAL'].includes(String(value['origin'])) &&
    ['CANDIDATE', 'ACCEPTED', 'REFUSED'].includes(String(value['state'])) &&
    version(value['size']) &&
    nullableText(value['senderPhone']) &&
    typeof value['senderDivergent'] === 'boolean' &&
    instant(value['receivedAt']) &&
    nullableText(value['decidedBy']) &&
    nullableText(value['decidedByName']) &&
    nullableInstant(value['decidedAt']) &&
    nullableText(value['decisionReason'])
  );
}
function isReceivedFile(value: unknown): value is ReceivedFile {
  return (
    record(value) &&
    typeof value['messageId'] === 'string' &&
    nullableText(value['senderPhone']) &&
    typeof value['fromGuardian'] === 'boolean' &&
    ['STORED', 'FAILED'].includes(String(value['mediaState'])) &&
    nullableText(value['failureCode']) &&
    nullableText(value['mediaType']) &&
    version(value['size']) &&
    instant(value['receivedAt'])
  );
}
function isEligibility(value: unknown): value is LongExitEligibility {
  return (
    record(value) &&
    fields(value, ['residentId', 'residentName', 'enrollment', 'currentDate', 'zone']) &&
    instant(value['now']) &&
    typeof value['eligible'] === 'boolean' &&
    Array.isArray(value['blockers']) &&
    value['blockers'].every((item) => typeof item === 'string') &&
    record(value['providers']) &&
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
export function isLongExit(value: unknown): value is LongExit {
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
      'canAttachAuthorization',
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
        nullableText(binding['verifiedBy']) &&
        nullableText(binding['verifiedByName']) &&
        nullableInstant(binding['verifiedAt']) &&
        instant(binding['createdAt']) &&
        instant(binding['expiresAt']),
    )
  )
    return false;
  return (
    Array.isArray(value['authorizationFiles']) &&
    value['authorizationFiles'].every(isAuthorizationFile) &&
    typeof value['whatsappAvailable'] === 'boolean' &&
    typeof value['deliveryUnconfirmed'] === 'boolean' &&
    Array.isArray(value['history']) &&
    value['history'].every(
      (event) =>
        record(event) &&
        fields(event, ['id', 'event', 'status', 'guardianId']) &&
        nullableText(event['actorProfile']) &&
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
    if (!Array.isArray(value) || !value.every(isLongExit)) throw new Error(ERROR_GENERIC);
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
      throw new Error(
        'O documento atual ainda não está pronto. Recarregue os dados e tente de novo.',
      );
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
  async attachAuthorization(exit: LongExit, file: File): Promise<LongExit> {
    const form = new FormData();
    form.append('version', String(exit.version));
    form.append('file', file);
    return this.mutate(exit.id, 'autorizacao/arquivos', form);
  }
  async linkAuthorization(exit: LongExit, messageId: string): Promise<LongExit> {
    return this.mutate(exit.id, 'autorizacao/vinculos', { version: exit.version, messageId });
  }
  async unlinkedFiles(id: string): Promise<ReceivedFile[]> {
    const value = await this.request(
      `/api/v1/saidas-longas/${encodeURIComponent(id)}/autorizacao/nao-vinculados`,
    );
    if (!Array.isArray(value) || !value.every(isReceivedFile)) throw new Error(ERROR_GENERIC);
    return value;
  }
  authorizationFileUrl(id: string, fileId: string): string {
    return `/api/v1/saidas-longas/${encodeURIComponent(id)}/autorizacao/arquivos/${encodeURIComponent(fileId)}`;
  }
  async authorizationFile(id: string, fileId: string): Promise<Blob> {
    return this.authorizationBlob(this.authorizationFileUrl(id, fileId));
  }
  async confirmAuthorization(
    exit: LongExit,
    fileId: string,
    justification: string,
  ): Promise<LongExit> {
    return this.mutate(exit.id, `autorizacao/arquivos/${encodeURIComponent(fileId)}/conferencia`, {
      version: exit.version,
      confirmed: true,
      ...(justification ? { justification } : {}),
    });
  }
  async refuseAuthorization(exit: LongExit, fileId: string, comment: string): Promise<LongExit> {
    return this.mutate(exit.id, `autorizacao/arquivos/${encodeURIComponent(fileId)}/recusa`, {
      version: exit.version,
      comment,
    });
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
    const url = `/api/v1/saidas-longas/${encodeURIComponent(id)}/documentos/${encodeURIComponent(documentVersionId)}/${kind}`;
    if (kind === 'assinado') return this.authorizationBlob(url);
    const response = await this.response(url, 'GET', undefined, 'application/pdf');
    if (this.mediaType(response) !== 'application/pdf')
      throw new Error('O arquivo recebido não é um documento PDF. Tente atualizar os dados.');
    return this.filled(response);
  }
  private async authorizationBlob(url: string): Promise<Blob> {
    const response = await this.response(url, 'GET', undefined, '*/*');
    const type = this.mediaType(response);
    if (!isAuthorizationMediaType(type))
      throw new Error('O tipo do arquivo recebido não é permitido. Tente atualizar os dados.');
    // The download name is derived from Blob.type, which must not carry parameters.
    return (await this.filled(response)).slice(0, undefined, type);
  }
  private mediaType(response: Response): string {
    return response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  }
  private async filled(response: Response): Promise<Blob> {
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
    if (!guard(value)) throw new Error(ERROR_GENERIC);
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
    return api(url, {
      method,
      body: input,
      headers: { Accept: accept },
      error: async (response) => {
        const body: unknown = await response.json().catch(() => null);
        return new OperationsApiError(
          response.status,
          record(body) && typeof body['code'] === 'string' ? body['code'] : undefined,
          record(body) && typeof body['message'] === 'string' ? body['message'] : undefined,
        );
      },
    });
  }
}
