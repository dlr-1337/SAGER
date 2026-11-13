import { ERROR_FORBIDDEN, ERROR_GENERIC, ERROR_SESSION } from '../../core/error-messages';
import { Injectable } from '@angular/core';
import { api, cached } from '../../core/api';
import {
  Accommodation,
  AccommodationUnit,
  HousingMap,
  RoomRecord,
  RoomRecordInput,
  sortHousingMap,
  validAgeGroup,
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
    validAgeGroup(item.ageGroup) &&
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
    Number.isInteger(item.occupancy) &&
    (item.occupancy ?? -1) >= 0 &&
    (item.vacancies === null ||
      (Number.isInteger(item.vacancies) && (item.vacancies ?? -1) >= 0)) &&
    (item.capacity === null
      ? item.vacancies === null
      : item.vacancies === Math.max(0, Number(item.capacity) - Number(item.occupancy))) &&
    Number.isInteger(item.version) &&
    (item.version ?? -1) >= 0
  );
}

@Injectable({ providedIn: 'root' })
export class RoomApiService {
  /** Mapa em cópia de 60 s compartilhada pelas telas; não altere o objeto devolvido. */
  map(): Promise<HousingMap> {
    return cached('quartos/mapa', () => this.fetchMap());
  }

  private async fetchMap(): Promise<HousingMap> {
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
    return sortHousingMap({
      accommodations: map.accommodations,
      units: map.units,
      rooms: map.rooms,
    });
  }

  async save(
    input: RoomRecordInput,
    existing?: Pick<RoomRecord, 'id' | 'version'>,
  ): Promise<RoomRecord> {
    const response = await api(
      existing ? `${baseUrl}/${encodeURIComponent(existing.id)}` : baseUrl,
      {
        method: existing ? 'PUT' : 'POST',
        body: existing ? { ...input, version: existing.version } : input,
        error: (response) => this.responseError(response),
      },
    );
    const value: unknown = await response.json();
    if (!isRoom(value)) throw new Error('O quarto salvo não pôde ser confirmado.');
    return value;
  }

  private async read(url: string): Promise<unknown> {
    return (await api(url, { error: (response) => this.responseError(response) })).json();
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
  if (error instanceof RoomApiError && error.status === 401) return ERROR_SESSION;
  if (error instanceof RoomApiError && error.status === 403) return ERROR_FORBIDDEN;
  if (error instanceof RoomApiError && error.status === 404) return 'Não encontramos este quarto.';
  return ERROR_GENERIC;
}
