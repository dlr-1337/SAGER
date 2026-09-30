import { Injectable } from '@angular/core';
import { SignatureAccess, clicksignEnvironmentOrigin } from './signature-access.models';
import { signatureStatusLabels } from '../operations/long-exit.utils';

export class SignatureAccessError extends Error {
  constructor(readonly status: number) {
    super('O convite de assinatura não está disponível.');
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const instant = (value: unknown) =>
  typeof value === 'string' &&
  Number.isFinite(Date.parse(value)) &&
  /(?:Z|[+-]\d\d:\d\d)$/.test(value);
const uuid = (value: unknown) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function isAccess(value: unknown): value is SignatureAccess {
  if (
    !record(value) ||
    !uuid(value['bindingId']) ||
    !uuid(value['documentVersionId']) ||
    ![
      'bindingId',
      'documentVersionId',
      'residentName',
      'enrollment',
      'guardianName',
      'guardianRelationship',
      'reason',
    ].every((field) => typeof value[field] === 'string') ||
    typeof value['revisionNumber'] !== 'number' ||
    !Number.isSafeInteger(value['revisionNumber']) ||
    value['revisionNumber'] < 1 ||
    !['requestedDepartureAt', 'expectedReturnAt', 'expiresAt', 'now'].every((field) =>
      instant(value[field]),
    ) ||
    !Object.hasOwn(signatureStatusLabels, String(value['signatureStatus'])) ||
    !(value['notes'] === null || typeof value['notes'] === 'string') ||
    !record(value['widget'])
  )
    return false;
  const widget = value['widget'];
  if (
    typeof widget['available'] !== 'boolean' ||
    !(widget['environment'] === null || typeof widget['environment'] === 'string') ||
    typeof widget['libraryVersion'] !== 'string' ||
    !(widget['signerId'] === null || typeof widget['signerId'] === 'string')
  )
    return false;
  return (
    !widget['available'] ||
    (widget['libraryVersion'] === '2.1.0' &&
      typeof widget['signerId'] === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(widget['signerId']) &&
      typeof widget['environment'] === 'string' &&
      !!clicksignEnvironmentOrigin(widget['environment']))
  );
}

@Injectable({ providedIn: 'root' })
export class SignatureAccessApiService {
  async access(token: string): Promise<SignatureAccess> {
    const value: unknown = await (await this.read('/api/v1/assinaturas/acesso', token)).json();
    if (!isAccess(value))
      throw new Error(
        'Os dados do convite não puderam ser confirmados. Abra novamente o convite recebido.',
      );
    return value;
  }
  async document(token: string): Promise<Blob> {
    const response = await this.read('/api/v1/assinaturas/documento', token);
    if (response.headers.get('content-type')?.split(';')[0].trim() !== 'application/pdf')
      throw new Error(
        'O documento original não está disponível. Atualize o convite e tente novamente.',
      );
    const blob = await response.blob();
    if (!blob.size)
      throw new Error(
        'O documento original não está disponível. Atualize o convite e tente novamente.',
      );
    return blob;
  }
  private async read(url: string, token: string): Promise<Response> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new SignatureAccessError(401);
    const response = await fetch(url, {
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        Accept: url.endsWith('/documento') ? 'application/pdf' : 'application/json',
        Authorization: `Bearer ${token}`,
      },
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new SignatureAccessError(response.status);
    return response;
  }
}
export function signatureAccessError(error: unknown): string {
  if (error instanceof SignatureAccessError && error.status === 410)
    return 'Este convite expirou ou foi revogado. Peça um novo convite à equipe da residência.';
  if (error instanceof SignatureAccessError && [401, 403, 404, 409].includes(error.status))
    return 'Este convite não está disponível para a revisão atual. Abra o convite mais recente recebido pelo WhatsApp ou procure a equipe da residência.';
  return 'Não foi possível consultar este convite. Tente novamente ou procure a equipe da residência.';
}
