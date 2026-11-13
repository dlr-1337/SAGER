import {
  ERROR_CONFLICT,
  ERROR_FORBIDDEN,
  ERROR_GENERIC,
  ERROR_INVALID,
  ERROR_NOT_FOUND,
  ERROR_SESSION,
} from '../../core/error-messages';
import { readArrayPage } from '../../core/list-page';
import { Injectable } from '@angular/core';
import {
  Accommodation,
  AccommodationInput,
  AccommodationUnit,
  validAgeGroup,
} from './housing.models';

const baseUrl = '/api/v1/alojamentos';

export class AccommodationApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`Falha na API de alojamentos (${status}).`);
  }
}

function isAccommodation(value: unknown): value is Accommodation {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Accommodation>;
  return (
    typeof item.id === 'string' &&
    typeof item.code === 'string' &&
    typeof item.name === 'string' &&
    validAgeGroup(item.ageGroup) &&
    Number.isInteger(item.version) &&
    (item.version ?? -1) >= 0
  );
}

function isUnit(value: unknown): value is AccommodationUnit {
  return isAccommodation(value) && typeof (value as AccommodationUnit).accommodationId === 'string';
}

@Injectable({ providedIn: 'root' })
export class AccommodationApiService {
  async page(
    params: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<{ items: Accommodation[]; total: number }> {
    return readArrayPage(
      baseUrl,
      params,
      isAccommodation,
      (response) => this.responseError(response),
      signal,
    );
  }
  async list(): Promise<Accommodation[]> {
    const value = await this.request(baseUrl);
    if (!Array.isArray(value) || !value.every(isAccommodation))
      throw new Error('Lista de alojamentos inválida.');
    return value;
  }

  async get(id: string): Promise<Accommodation> {
    const value = await this.request(`${baseUrl}/${encodeURIComponent(id)}`);
    if (!isAccommodation(value)) throw new Error('Cadastro de alojamento inválido.');
    return value;
  }

  async save(
    input: AccommodationInput,
    existing?: Pick<Accommodation, 'id' | 'version'>,
  ): Promise<Accommodation> {
    const value = await this.request(
      existing ? `${baseUrl}/${encodeURIComponent(existing.id)}` : baseUrl,
      input,
      existing?.version,
    );
    if (!isAccommodation(value)) throw new Error('O alojamento salvo não pôde ser confirmado.');
    return value;
  }

  async listUnits(accommodationId: string): Promise<AccommodationUnit[]> {
    const value = await this.request(this.unitsUrl(accommodationId));
    if (
      !Array.isArray(value) ||
      !value.every(isUnit) ||
      value.some((unit) => unit.accommodationId !== accommodationId)
    ) {
      throw new Error('Lista de unidades inválida.');
    }
    return value;
  }

  async getUnit(accommodationId: string, id: string): Promise<AccommodationUnit> {
    const value = await this.request(`${this.unitsUrl(accommodationId)}/${encodeURIComponent(id)}`);
    if (!isUnit(value) || value.accommodationId !== accommodationId)
      throw new Error('Cadastro de unidade inválido.');
    return value;
  }

  async saveUnit(
    accommodationId: string,
    input: AccommodationInput,
    existing?: Pick<AccommodationUnit, 'id' | 'version'>,
  ): Promise<AccommodationUnit> {
    const url =
      this.unitsUrl(accommodationId) + (existing ? `/${encodeURIComponent(existing.id)}` : '');
    const value = await this.request(url, input, existing?.version);
    if (!isUnit(value) || value.accommodationId !== accommodationId)
      throw new Error('A unidade salva não pôde ser confirmada.');
    return value;
  }

  private unitsUrl(id: string): string {
    return `${baseUrl}/${encodeURIComponent(id)}/unidades`;
  }

  private async request(
    url: string,
    input?: AccommodationInput,
    version?: number,
  ): Promise<unknown> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (input) {
      const response = await fetch('/api/v1/auth/csrf', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers,
      });
      if (!response.ok) throw await this.responseError(response);
      const token: unknown = await response.json();
      if (!token || typeof token !== 'object') throw new Error('Resposta CSRF inválida.');
      const { headerName, token: value } = token as Record<string, unknown>;
      if (typeof headerName !== 'string' || typeof value !== 'string')
        throw new Error('Resposta CSRF inválida.');
      headers['Content-Type'] = 'application/json';
      headers[headerName] = value;
    }
    const response = await fetch(url, {
      method: input ? (version === undefined ? 'POST' : 'PUT') : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      ...(input
        ? { body: JSON.stringify(version === undefined ? input : { ...input, version }) }
        : {}),
    });
    if (!response.ok) throw await this.responseError(response);
    return response.json();
  }

  private async responseError(response: Response): Promise<AccommodationApiError> {
    let code: string | undefined;
    try {
      const value: unknown = await response.json();
      if (
        value &&
        typeof value === 'object' &&
        typeof (value as { code?: unknown }).code === 'string'
      )
        code = (value as { code: string }).code;
    } catch {
      /* Respostas de segurança podem não conter JSON. */
    }
    return new AccommodationApiError(response.status, code);
  }
}

export function accommodationErrorMessage(error: unknown): string {
  if (error instanceof AccommodationApiError) {
    if (error.status === 401) return ERROR_SESSION;
    if (error.status === 403) return ERROR_FORBIDDEN;
    if (error.status === 404) return ERROR_NOT_FOUND;
    if (error.code === 'stale_version') return ERROR_CONFLICT;
    if (error.status === 409) return 'Já existe um cadastro com este código. Informe outro código.';
    if (error.status === 400) return ERROR_INVALID;
  }
  return ERROR_GENERIC;
}
