import { Injectable } from '@angular/core';
import { api } from '../../core/api';

export interface ResidentRecord {
  id: string;
  name: string;
  enrollment: string;
  birthDate: string | null;
  course: string | null;
  version: number;
  courseId?: string | null;
  institutionalEmail?: string | null;
  entryYear?: number | null;
  extraSemesters?: number;
}

export type ResidentPayload = Pick<
  ResidentRecord,
  'name' | 'enrollment' | 'courseId' | 'institutionalEmail'
> & {
  birthDate: string;
  entryYear: number | null;
  extraSemesters: number;
  password?: string;
  passwordConfirmation?: string;
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
    (item.entryYear == null || Number.isInteger(item.entryYear)) &&
    (item.extraSemesters === undefined || Number.isInteger(item.extraSemesters)) &&
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

  async page(
    params: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<{ items: ResidentRecord[]; total: number }> {
    const response = await api(`${baseUrl}?${new URLSearchParams(params)}`, {
      signal,
      error: (response) => this.responseError(response),
    });
    const value: unknown = await response.json();
    if (!Array.isArray(value) || !value.every(isResident))
      throw new Error('Lista de residentes inválida.');
    const total = Number(response.headers.get('X-Total-Count') ?? value.length);
    if (!Number.isSafeInteger(total) || total < 0) throw new Error('Total de residentes inválido.');
    return { items: value, total };
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
    const response = await api(
      existing ? `${baseUrl}/${encodeURIComponent(existing.id)}` : baseUrl,
      {
        method: existing ? 'PUT' : 'POST',
        body: existing ? { ...input, version: existing.version } : input,
        error: (response) => this.responseError(response),
      },
    );
    const value: unknown = await response.json();
    if (!isResident(value)) throw new Error('O cadastro salvo não pôde ser confirmado.');
    return value;
  }

  private async read(url: string): Promise<unknown> {
    return (await api(url, { error: (response) => this.responseError(response) })).json();
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
