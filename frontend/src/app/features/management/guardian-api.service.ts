import { readArrayPage } from '../../core/list-page';
import { Injectable } from '@angular/core';
import { api } from '../../core/api';

export interface GuardianRecord {
  id: string;
  residentId: string;
  name: string;
  relationship: string;
  phone: string | null;
  active: boolean;
  version: number;
}

export type GuardianPayload = Pick<
  GuardianRecord,
  'residentId' | 'name' | 'relationship' | 'phone' | 'active'
>;

const baseUrl = '/api/v1/responsaveis';

export class GuardianApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`Falha na API de responsáveis (${status}).`);
  }
}

function isGuardian(value: unknown): value is GuardianRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<GuardianRecord>;
  return (
    typeof item.id === 'string' &&
    typeof item.residentId === 'string' &&
    typeof item.name === 'string' &&
    typeof item.relationship === 'string' &&
    (item.phone === null || typeof item.phone === 'string') &&
    typeof item.active === 'boolean' &&
    typeof item.version === 'number'
  );
}

@Injectable({ providedIn: 'root' })
export class GuardianApiService {
  async page(
    params: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<{ items: GuardianRecord[]; total: number }> {
    return readArrayPage(
      baseUrl,
      params,
      isGuardian,
      (response) => this.responseError(response),
      signal,
    );
  }
  async list(): Promise<GuardianRecord[]> {
    const value = await this.read(baseUrl);
    if (!Array.isArray(value) || !value.every(isGuardian)) {
      throw new Error('A lista de responsáveis recebida é inválida.');
    }
    return value;
  }

  async get(id: string): Promise<GuardianRecord> {
    const value = await this.read(`${baseUrl}/${encodeURIComponent(id)}`);
    if (!isGuardian(value)) throw new Error('O cadastro recebido é inválido.');
    return value;
  }

  async save(
    input: GuardianPayload,
    existing?: Pick<GuardianRecord, 'id' | 'version'>,
  ): Promise<GuardianRecord> {
    const response = await api(
      existing ? `${baseUrl}/${encodeURIComponent(existing.id)}` : baseUrl,
      {
        method: existing ? 'PUT' : 'POST',
        body: existing ? { ...input, version: existing.version } : input,
        error: (response) => this.responseError(response),
      },
    );
    const value: unknown = await response.json();
    if (!isGuardian(value)) throw new Error('O cadastro salvo não pôde ser confirmado.');
    return value;
  }

  private async read(url: string): Promise<unknown> {
    return (await api(url, { error: (response) => this.responseError(response) })).json();
  }

  private async responseError(response: Response): Promise<GuardianApiError> {
    try {
      const body: unknown = await response.json();
      const code =
        body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
          ? body.code
          : undefined;
      return new GuardianApiError(response.status, code);
    } catch {
      return new GuardianApiError(response.status);
    }
  }
}
