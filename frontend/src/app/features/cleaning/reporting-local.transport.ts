import {
  ERROR_CONFLICT,
  ERROR_FORBIDDEN,
  ERROR_GENERIC,
  ERROR_INVALID,
  ERROR_NOT_FOUND,
  ERROR_SESSION,
} from '../../core/error-messages';
import { validCivilDate } from '../communications/communications-local.utils';
export type Guard<T> = (value: unknown) => value is T;
export const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
export const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export const numeric = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
export const instant = (value: unknown): value is string =>
  typeof value === 'string' &&
  Number.isFinite(Date.parse(value)) &&
  /(?:Z|[+-]\d\d:\d\d)$/.test(value);
export const civilDate = (value: unknown): value is string =>
  typeof value === 'string' && validCivilDate(value);
export const nullableString = (value: unknown) => value === null || typeof value === 'string';
export const nullableNumber = (value: unknown) => value === null || numeric(value);
export const nullableInteger = (value: unknown) => value === null || integer(value);
export const nullableUuid = (value: unknown) => value === null || uuid(value);
export const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
export function identifier(value: string): string {
  if (!uuid(value)) throw new Error('Identificador de registro inválido.');
  return encodeURIComponent(value);
}
export function query(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== '') params.set(key, String(value));
  return params.size ? '?' + params.toString() : '';
}
export class ReportingApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super('A consulta ou gravação não foi concluída.');
  }
}
export function reportingError(error: unknown): string {
  if (
    error instanceof ReportingApiError ||
    (record(error) && typeof error['status'] === 'number')
  ) {
    const status = error instanceof ReportingApiError ? error.status : error['status'];
    const code = error instanceof ReportingApiError ? error.code : '';
    if (status === 401) return ERROR_SESSION;
    if (status === 403) return ERROR_FORBIDDEN;
    if (status === 404) return ERROR_NOT_FOUND;
    if (status === 410) return 'Este relatório expirou. Gere outro.';
    if (code === 'assessment_exists')
      return 'Já existe uma avaliação deste quarto nesta data. Abra essa avaliação e corrija por lá.';
    if (status === 409) return ERROR_CONFLICT;
    if (code === 'report_limit_exceeded')
      return 'Muitos registros para um só relatório. Escolha um período menor.';
    if (status === 400 || status === 422) return ERROR_INVALID;
  }
  return ERROR_GENERIC;
}
export class ReportingTransport {
  async get<T>(path: string, guard: Guard<T>): Promise<T> {
    return this.checked(await (await this.response(path)).json(), guard);
  }
  async post<T>(path: string, input: unknown, guard: Guard<T>): Promise<T> {
    return this.checked(await (await this.response(path, input)).json(), guard);
  }
  async response(path: string, input?: unknown, accept = 'application/json'): Promise<Response> {
    const headers: Record<string, string> = { Accept: accept };
    if (input !== undefined) {
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
      method: input === undefined ? 'GET' : 'POST',
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
      throw new ReportingApiError(
        response.status,
        record(value) && typeof value['code'] === 'string' ? value['code'] : undefined,
      );
    }
    return response;
  }
  private checked<T>(value: unknown, guard: Guard<T>): T {
    if (!guard(value)) throw new Error('O servidor retornou dados inválidos.');
    return value;
  }
}
