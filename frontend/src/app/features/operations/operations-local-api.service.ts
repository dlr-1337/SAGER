import { readArrayPage } from '../../core/list-page';
import { Injectable } from '@angular/core';
import {
  CallContext,
  CallMark,
  ExitEligibility,
  NightCall,
  PhysicalExitInput,
  ShortExit,
  ShortExitInput,
} from './operations-local.models';
import { exitStatusLabels } from './operations-local.utils';

export class OperationsApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
    message?: string,
  ) {
    super(message ?? 'Não foi possível acessar os registros. Tente novamente.');
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: Record<string, unknown>, fields: string[]) =>
  fields.every((field) => typeof value[field] === 'string');
const instant = (value: unknown): value is string =>
  typeof value === 'string' &&
  Number.isFinite(Date.parse(value)) &&
  /(?:Z|[+-]\d\d:\d\d)$/.test(value);
const version = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function isCall(value: unknown): value is NightCall {
  if (
    !record(value) ||
    !strings(value, ['id', 'accommodationId', 'accommodationName', 'referenceDate']) ||
    !version(value['version']) ||
    !['ABERTA', 'FECHADA'].includes(String(value['status'])) ||
    !instant(value['openedAt']) ||
    !record(value['summary']) ||
    !Array.isArray(value['records'])
  )
    return false;
  const summary = value['summary'];
  if (
    !['total', 'present', 'absent', 'justified', 'unmarked'].every((field) =>
      version(summary[field]),
    )
  )
    return false;
  return value['records'].every(
    (row) =>
      record(row) &&
      strings(row, ['id', 'residentId', 'residentName', 'enrollment', 'roomNumber']) &&
      version(row['version']) &&
      (row['mark'] === null ||
        ['PRESENTE', 'AUSENTE', 'AUSENCIA_JUSTIFICADA'].includes(String(row['mark']))) &&
      Array.isArray(row['authorizedExits']) &&
      row['authorizedExits'].every(
        (ref) =>
          record(ref) &&
          typeof ref['id'] === 'string' &&
          ['SHORT', 'LONG'].includes(String(ref['type'])),
      ) &&
      Array.isArray(row['history']) &&
      row['history'].every(
        (event) =>
          record(event) &&
          strings(event, ['id', 'mark', 'actorProfile']) &&
          instant(event['recordedAt']) &&
          version(event['version']) &&
          version(event['callVersion']),
      ),
  );
}
function isContext(value: unknown): value is CallContext {
  return (
    record(value) &&
    strings(value, ['referenceDate', 'zone', 'windowStart', 'windowEnd']) &&
    instant(value['now']) &&
    typeof value['outsideWindow'] === 'boolean' &&
    version(value['eligibleResidents']) &&
    Array.isArray(value['accommodations']) &&
    value['accommodations'].every(
      (item) => record(item) && strings(item, ['id', 'code', 'name']),
    ) &&
    Array.isArray(value['missingBirthDates']) &&
    value['missingBirthDates'].every(
      (item) =>
        record(item) && strings(item, ['residentId', 'residentName', 'enrollment', 'roomNumber']),
    )
  );
}
function isEligibility(value: unknown): value is ExitEligibility {
  return (
    record(value) &&
    strings(value, ['residentId', 'residentName', 'enrollment', 'currentDate', 'zone']) &&
    instant(value['now']) &&
    typeof value['eligible'] === 'boolean' &&
    Array.isArray(value['blockers']) &&
    value['blockers'].every((item) => typeof item === 'string')
  );
}
function isExit(value: unknown): value is ShortExit {
  return (
    record(value) &&
    strings(value, ['id', 'residentId', 'residentName', 'enrollment', 'reason', 'zone']) &&
    ['NOW', 'SCHEDULED'].includes(String(value['departureMode'])) &&
    Object.hasOwn(exitStatusLabels, String(value['status'])) &&
    version(value['version']) &&
    instant(value['requestedDepartureAt']) &&
    instant(value['expectedReturnAt']) &&
    instant(value['now']) &&
    record(value['capabilities']) &&
    ['canEdit', 'canDecide', 'canCancel', 'canDepart', 'canReturn'].every(
      (field) => typeof (value['capabilities'] as Record<string, unknown>)[field] === 'boolean',
    ) &&
    Array.isArray(value['history']) &&
    value['history'].every(
      (event) =>
        record(event) &&
        strings(event, ['id', 'event', 'actorProfile', 'status']) &&
        version(event['version']) &&
        instant(event['recordedAt']),
    )
  );
}

@Injectable({ providedIn: 'root' })
export class OperationsLocalApiService {
  async callContext(accommodationId?: string): Promise<CallContext> {
    return this.checked(
      await this.request('/api/v1/chamadas/contexto' + this.query({ accommodationId })),
      isContext,
    );
  }
  async calls(accommodationId: string, date: string): Promise<NightCall[]> {
    return this.list(
      await this.request('/api/v1/chamadas' + this.query({ accommodationId, date })),
      isCall,
    );
  }
  async call(id: string): Promise<NightCall> {
    return this.checked(await this.request(`/api/v1/chamadas/${encodeURIComponent(id)}`), isCall);
  }
  async openCall(input: {
    accommodationId: string;
    outsideWindowConfirmed?: boolean;
    justification?: string;
  }): Promise<NightCall> {
    return this.checked(await this.request('/api/v1/chamadas', 'POST', input), isCall);
  }
  async mark(
    call: NightCall,
    residentId: string,
    mark: CallMark,
    justification?: string,
    authorizedExit?: { id: string; type: 'SHORT' | 'LONG' },
  ): Promise<NightCall> {
    const correction = call.status === 'FECHADA';
    return this.checked(
      await this.request(
        `/api/v1/chamadas/${encodeURIComponent(call.id)}/${correction ? 'correcoes' : 'registros'}/${encodeURIComponent(residentId)}`,
        correction ? 'POST' : 'PUT',
        {
          version: call.version,
          mark,
          ...(justification ? { justification } : {}),
          ...(authorizedExit
            ? { authorizedExitId: authorizedExit.id, authorizedExitType: authorizedExit.type }
            : {}),
        },
      ),
      isCall,
    );
  }
  async closeCall(
    call: NightCall,
    outsideWindowConfirmed?: boolean,
    justification?: string,
  ): Promise<NightCall> {
    return this.checked(
      await this.request(`/api/v1/chamadas/${encodeURIComponent(call.id)}/fechamento`, 'POST', {
        version: call.version,
        ...(outsideWindowConfirmed ? { outsideWindowConfirmed, justification } : {}),
      }),
      isCall,
    );
  }
  async eligibility(): Promise<ExitEligibility> {
    return this.checked(await this.request('/api/v1/saidas-curtas/elegibilidade'), isEligibility);
  }
  async exitsPage(
    params: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<{ items: ShortExit[]; total: number }> {
    return readArrayPage(
      '/api/v1/saidas-curtas',
      params,
      isExit,
      async (response) => new OperationsApiError(response.status),
      signal,
    );
  }
  async exits(search?: string, status?: string): Promise<ShortExit[]> {
    return this.list(
      await this.request('/api/v1/saidas-curtas' + this.query({ search, status })),
      isExit,
    );
  }
  async exit(id: string): Promise<ShortExit> {
    return this.checked(
      await this.request(`/api/v1/saidas-curtas/${encodeURIComponent(id)}`),
      isExit,
    );
  }
  async saveExit(
    input: ShortExitInput,
    existing?: Pick<ShortExit, 'id' | 'version'>,
  ): Promise<ShortExit> {
    return this.checked(
      await this.request(
        `/api/v1/saidas-curtas${existing ? '/' + encodeURIComponent(existing.id) : ''}`,
        existing ? 'PUT' : 'POST',
        { ...input, ...(existing ? { version: existing.version } : {}) },
      ),
      isExit,
    );
  }
  async decideExit(
    exit: ShortExit,
    decision: 'APPROVE' | 'REJECT',
    comment: string,
  ): Promise<ShortExit> {
    return this.exitMutation(exit.id, 'decisao', {
      version: exit.version,
      decision,
      ...(comment ? { comment } : {}),
    });
  }
  async cancelExit(exit: ShortExit, comment: string): Promise<ShortExit> {
    return this.exitMutation(exit.id, 'cancelamento', { version: exit.version, comment });
  }
  async physicalExit(
    id: string,
    action: 'partida' | 'retorno',
    input: PhysicalExitInput,
  ): Promise<ShortExit> {
    return this.exitMutation(id, action, input);
  }
  private async exitMutation(id: string, action: string, input: unknown): Promise<ShortExit> {
    return this.checked(
      await this.request(
        `/api/v1/saidas-curtas/${encodeURIComponent(id)}/${action}`,
        'POST',
        input,
      ),
      isExit,
    );
  }
  private query(values: Record<string, string | undefined>): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
    return query.size ? '?' + query.toString() : '';
  }
  private checked<T>(value: unknown, guard: (value: unknown) => value is T): T {
    if (!guard(value))
      throw new Error('O servidor retornou dados inválidos. Recarregue os registros.');
    return value;
  }
  private list<T>(value: unknown, guard: (value: unknown) => value is T): T[] {
    if (!Array.isArray(value) || !value.every(guard))
      throw new Error('O servidor retornou uma lista inválida. Tente novamente.');
    return value;
  }
  private async request(url: string, method = 'GET', input?: unknown): Promise<unknown> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (method !== 'GET') {
      const token = await this.request('/api/v1/auth/csrf');
      if (!record(token) || !strings(token, ['headerName', 'token']))
        throw new Error('Não foi possível obter a proteção da sessão.');
      headers[String(token['headerName'])] = String(token['token']);
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
    return response.json();
  }
}
export function operationsError(error: unknown): string {
  if (error instanceof OperationsApiError && error.status === 409)
    return 'O registro mudou ou seu prazo terminou. Recarregue os dados e revise a situação antes de tentar novamente.';
  if (error instanceof OperationsApiError && [401, 403].includes(error.status))
    return 'Sua sessão não tem permissão para esta ação. Volte ao início ou entre novamente.';
  if (error instanceof OperationsApiError && error.status === 404)
    return 'O registro não foi encontrado ou não está disponível para sua sessão.';
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a ação. Tente novamente.';
}
