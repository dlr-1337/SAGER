import { Injectable } from '@angular/core';
import {
  Accommodation,
  AccommodationUnit,
  HousingMap,
  RoomRecord,
  RoomRecordInput,
} from './housing.models';
import { RoomSituation } from './management.models';

const baseUrl = '/api/v1/quartos';
const situations: RoomSituation[] = ['Disponível', 'Ocupado', 'Manutenção', 'Indisponível'];

export class RoomApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`Falha na API de quartos (${status}).`);
  }
}

function isAccommodation(value: unknown): value is Accommodation {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Accommodation>;
  return (
    typeof item.id === 'string' &&
    typeof item.code === 'string' &&
    typeof item.name === 'string' &&
    Number.isInteger(item.version) &&
    (item.version ?? -1) >= 0
  );
}

function isUnit(value: unknown): value is AccommodationUnit {
  return (
    isAccommodation(value) &&
    typeof (value as Partial<AccommodationUnit>).accommodationId === 'string'
  );
}

function isRoom(value: unknown): value is RoomRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<RoomRecord>;
  return (
    typeof item.id === 'string' &&
    typeof item.code === 'string' &&
    typeof item.number === 'string' &&
    typeof item.accommodationId === 'string' &&
    (item.unitId === null || typeof item.unitId === 'string') &&
    (item.floor === null || typeof item.floor === 'string') &&
    (item.capacity === null || (Number.isInteger(item.capacity) && (item.capacity ?? 0) > 0)) &&
    situations.includes(item.situation as RoomSituation) &&
    item.occupancy === null &&
    item.vacancies === null &&
    item.cleaningScore === null &&
    Number.isInteger(item.version) &&
    (item.version ?? -1) >= 0
  );
}

@Injectable({ providedIn: 'root' })
export class RoomApiService {
  async list(): Promise<RoomRecord[]> {
    const value = await this.read(baseUrl);
    if (!Array.isArray(value) || !value.every(isRoom)) {
      throw new Error('A lista de quartos recebida é inválida.');
    }
    return value;
  }

  async get(id: string): Promise<RoomRecord> {
    const value = await this.read(`${baseUrl}/${encodeURIComponent(id)}`);
    if (!isRoom(value)) throw new Error('O quarto recebido é inválido.');
    return value;
  }

  async map(): Promise<HousingMap> {
    const value = await this.read(`${baseUrl}/mapa`);
    if (!value || typeof value !== 'object') throw new Error('O mapa recebido é inválido.');
    const map = value as Partial<HousingMap>;
    if (
      !Array.isArray(map.accommodations) ||
      !map.accommodations.every(isAccommodation) ||
      !Array.isArray(map.units) ||
      !map.units.every(isUnit) ||
      !Array.isArray(map.rooms) ||
      !map.rooms.every(isRoom)
    ) {
      throw new Error('O mapa recebido é inválido.');
    }
    const accommodationIds = new Set(map.accommodations.map((item) => item.id));
    const units = new Map(map.units.map((item) => [item.id, item]));
    if (
      map.units.some((item) => !accommodationIds.has(item.accommodationId)) ||
      map.rooms.some(
        (item) =>
          !accommodationIds.has(item.accommodationId) ||
          (item.unitId !== null &&
            units.get(item.unitId)?.accommodationId !== item.accommodationId),
      )
    ) {
      throw new Error('Os vínculos do mapa recebido são inválidos.');
    }
    return { accommodations: map.accommodations, units: map.units, rooms: map.rooms };
  }

  async save(
    input: RoomRecordInput,
    existing?: Pick<RoomRecord, 'id' | 'version'>,
  ): Promise<RoomRecord> {
    const csrfResponse = await fetch('/api/v1/auth/csrf', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!csrfResponse.ok) throw await this.responseError(csrfResponse);
    const csrf: unknown = await csrfResponse.json();
    if (!csrf || typeof csrf !== 'object') throw new Error('Resposta CSRF inválida.');
    const { headerName, token } = csrf as Record<string, unknown>;
    if (typeof headerName !== 'string' || !headerName || typeof token !== 'string' || !token) {
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
          [headerName]: token,
        },
        body: JSON.stringify(existing ? { ...input, version: existing.version } : input),
      },
    );
    if (!response.ok) throw await this.responseError(response);
    const value: unknown = await response.json();
    if (!isRoom(value)) throw new Error('O quarto salvo não pôde ser confirmado.');
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

  private async responseError(response: Response): Promise<RoomApiError> {
    try {
      const body: unknown = await response.json();
      const code =
        body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
          ? body.code
          : undefined;
      return new RoomApiError(response.status, code);
    } catch {
      return new RoomApiError(response.status);
    }
  }
}

export function roomLoadError(error: unknown): string {
  if (error instanceof RoomApiError && error.status === 401)
    return 'A sessão expirou. Entre novamente para consultar os quartos.';
  if (error instanceof RoomApiError && error.status === 403)
    return 'A sessão não permite consultar os quartos. Entre com um perfil autorizado.';
  if (error instanceof RoomApiError && error.status === 404)
    return 'O quarto solicitado não está disponível no ambiente local de teste.';
  return 'Não foi possível consultar o backend local. Confira a conexão e tente novamente.';
}
