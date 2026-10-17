import { readArrayPage } from '../../core/list-page';
import { Injectable } from '@angular/core';
import { Supervisor, SupervisorInput } from './management.models';

const baseUrl = '/api/v1/supervisores';

export class SupervisorApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`Falha na API de supervisores (${status}).`);
  }
}

function isSupervisor(value: unknown): value is Supervisor {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Supervisor>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.institutionalId === 'string' &&
    typeof item.email === 'string' &&
    typeof item.version === 'number'
  );
}

@Injectable({ providedIn: 'root' })
export class SupervisorApiService {
  async page(
    params: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<{ items: Supervisor[]; total: number }> {
    return readArrayPage(
      baseUrl,
      params,
      isSupervisor,
      (response) => this.responseError(response),
      signal,
    );
  }
  async list(): Promise<Supervisor[]> {
    const value = await this.read(baseUrl);
    if (!Array.isArray(value) || !value.every(isSupervisor)) {
      throw new Error('A lista de supervisores recebida é inválida.');
    }
    return value;
  }

  async get(id: string): Promise<Supervisor> {
    const value = await this.read(`${baseUrl}/${encodeURIComponent(id)}`);
    if (!isSupervisor(value)) throw new Error('O cadastro recebido é inválido.');
    return value;
  }

  async save(
    input: SupervisorInput,
    existing?: Pick<Supervisor, 'id' | 'version'>,
  ): Promise<Supervisor> {
    const csrfResponse = await fetch('/api/v1/auth/csrf', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!csrfResponse.ok) throw await this.responseError(csrfResponse);
    const token: unknown = await csrfResponse.json();
    if (!token || typeof token !== 'object') throw new Error('Resposta CSRF inválida.');
    const { headerName, token: tokenValue } = token as Record<string, unknown>;
    if (typeof headerName !== 'string' || typeof tokenValue !== 'string') {
      throw new Error('Resposta CSRF inválida.');
    }

    const response = await fetch(
      existing ? `${baseUrl}/${encodeURIComponent(existing.id)}` : baseUrl,
      {
        method: existing ? 'PUT' : 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          [headerName]: tokenValue,
        },
        body: JSON.stringify(existing ? { ...input, version: existing.version } : input),
      },
    );
    if (!response.ok) throw await this.responseError(response);
    const value: unknown = await response.json();
    if (!isSupervisor(value)) throw new Error('O cadastro salvo não pôde ser confirmado.');
    return value;
  }

  private async read(url: string): Promise<unknown> {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw await this.responseError(response);
    return response.json();
  }

  private async responseError(response: Response): Promise<SupervisorApiError> {
    try {
      const body: unknown = await response.json();
      const code =
        body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
          ? body.code
          : undefined;
      return new SupervisorApiError(response.status, code);
    } catch {
      return new SupervisorApiError(response.status);
    }
  }
}
