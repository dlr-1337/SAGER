import { Injectable } from '@angular/core';

export interface ResidentRecord {
  id: string;
  name: string;
  enrollment: string;
  birthDate: string | null;
  course: string | null;
  version: number;
}

export type ResidentPayload = Pick<ResidentRecord, 'name' | 'enrollment' | 'course'> & {
  birthDate: string;
};

const baseUrl = '/api/v1/residentes';

export class ResidentApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`Falha na API de residentes (${status}).`);
  }
}

function isResident(value: unknown): value is ResidentRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ResidentRecord>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.enrollment === 'string' &&
    (item.birthDate === null || typeof item.birthDate === 'string') &&
    (item.course === null || typeof item.course === 'string') &&
    typeof item.version === 'number'
  );
}

@Injectable({ providedIn: 'root' })
export class ResidentApiService {
  async list(): Promise<ResidentRecord[]> {
    const value = await this.read(baseUrl);
    if (!Array.isArray(value) || !value.every(isResident)) {
      throw new Error('A lista de residentes recebida é inválida.');
    }
    return value;
  }

  async get(id: string): Promise<ResidentRecord> {
    const value = await this.read(`${baseUrl}/${encodeURIComponent(id)}`);
    if (!isResident(value)) throw new Error('O cadastro recebido é inválido.');
    return value;
  }

  async save(
    input: ResidentPayload,
    existing?: Pick<ResidentRecord, 'id' | 'version'>,
  ): Promise<ResidentRecord> {
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
    if (!isResident(value)) throw new Error('O cadastro salvo não pôde ser confirmado.');
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

  private async responseError(response: Response): Promise<ResidentApiError> {
    try {
      const body: unknown = await response.json();
      const code =
        body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
          ? body.code
          : undefined;
      return new ResidentApiError(response.status, code);
    } catch {
      return new ResidentApiError(response.status);
    }
  }
}
