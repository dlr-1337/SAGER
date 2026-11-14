import { api } from '../../core/api';
import {
  ERROR_CONFLICT,
  ERROR_FORBIDDEN,
  ERROR_GENERIC,
  ERROR_NOT_FOUND,
  ERROR_SESSION,
} from '../../core/error-messages';
import { Injectable } from '@angular/core';

export interface AllocationRecord {
  id: string;
  residentId: string;
  roomId: string;
  startedAt: string;
  endedAt: string | null;
  endReason: 'TRANSFER' | 'END' | 'CONCLUSION' | null;
  version: number;
}

const baseUrl = '/api/v1/alocacoes';

export class AllocationApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`Falha na API de alocações (${status}).`);
  }
}

function isAllocation(value: unknown): value is AllocationRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<AllocationRecord>;
  return (
    typeof item.id === 'string' &&
    typeof item.residentId === 'string' &&
    typeof item.roomId === 'string' &&
    typeof item.startedAt === 'string' &&
    (item.endedAt === null || typeof item.endedAt === 'string') &&
    (item.endReason === null ||
      ['TRANSFER', 'END', 'CONCLUSION'].includes(item.endReason as string)) &&
    Number.isInteger(item.version) &&
    (item.version ?? -1) >= 0
  );
}

@Injectable({ providedIn: 'root' })
export class AllocationApiService {
  async byResident(residentId: string): Promise<AllocationRecord[]> {
    return this.list(new URLSearchParams({ residentId }));
  }

  async activeInRoom(roomId: string): Promise<AllocationRecord[]> {
    return this.list(new URLSearchParams({ roomId, active: 'true' }));
  }

  async create(residentId: string, roomId: string): Promise<AllocationRecord> {
    return this.write(baseUrl, { residentId, roomId });
  }

  async transfer(id: string, roomId: string, version: number): Promise<AllocationRecord> {
    return this.write(`${baseUrl}/${encodeURIComponent(id)}/transferir`, { roomId, version });
  }

  async end(id: string, version: number): Promise<AllocationRecord> {
    return this.write(`${baseUrl}/${encodeURIComponent(id)}/encerrar`, { version });
  }

  private async list(query: URLSearchParams): Promise<AllocationRecord[]> {
    const response = await api(`${baseUrl}?${query}`, {
      error: (response) => this.responseError(response),
    });
    const value: unknown = await response.json();
    if (!Array.isArray(value) || !value.every(isAllocation)) {
      throw new Error('A lista de alocações recebida é inválida.');
    }
    return value;
  }

  private async write(url: string, body: object): Promise<AllocationRecord> {
    const response = await api(url, {
      method: 'POST',
      body,
      error: (response) => this.responseError(response),
    });
    const value: unknown = await response.json();
    if (!isAllocation(value)) throw new Error('A alocação salva não pôde ser confirmada.');
    return value;
  }

  private async responseError(response: Response): Promise<AllocationApiError> {
    try {
      const body: unknown = await response.json();
      const code =
        body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
          ? body.code
          : undefined;
      return new AllocationApiError(response.status, code);
    } catch {
      return new AllocationApiError(response.status);
    }
  }
}

export function allocationErrorMessage(error: unknown): string {
  if (error instanceof AllocationApiError) {
    switch (error.code) {
      case 'stale_version':
        return ERROR_CONFLICT;
      case 'active_conflict':
        return 'Este residente já está em um quarto. Recarregue os dados.';
      case 'room_full':
        return 'O quarto atingiu a capacidade cadastrada. Escolha outro quarto.';
      case 'room_unavailable':
        return 'O quarto está em manutenção ou indisponível. Escolha outro quarto.';
      case 'capacity_unknown':
        return 'Defina a capacidade do quarto antes de colocar um residente nele.';
      case 'age_group_mismatch':
        return 'Este quarto é de outra faixa etária. Escolha um quarto da faixa do residente.';
      case 'birth_date_required':
        return 'Informe a data de nascimento do residente antes de colocá-lo neste quarto.';
      case 'resident_concluded':
        return 'Este residente concluiu o curso. Lance a prorrogação antes de colocar no quarto.';
      case 'invalid_reference':
        return 'Residente ou quarto não encontrado. Recarregue os dados.';
    }
    if (error.status === 401) return ERROR_SESSION;
    if (error.status === 403) return ERROR_FORBIDDEN;
    if (error.status === 404) return ERROR_NOT_FOUND;
  }
  return ERROR_GENERIC;
}
