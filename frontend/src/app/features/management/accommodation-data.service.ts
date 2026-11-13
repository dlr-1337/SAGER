import { Injectable, inject, signal } from '@angular/core';
import { SessionService } from '../../core/session.service';
import { AccommodationApiError, AccommodationApiService } from './accommodation-api.service';
import { Accommodation, AccommodationInput, AccommodationUnit } from './housing.models';

/** Dados públicos da demonstração permanecem em memória e nunca são enviados à API. */
@Injectable({ providedIn: 'root' })
export class AccommodationDataService {
  private readonly api = inject(AccommodationApiService);
  private readonly session = inject(SessionService);
  private readonly demoAccommodations = signal<Accommodation[]>([]);
  private readonly demoUnits = signal<AccommodationUnit[]>([]);

  async list(): Promise<Accommodation[]> {
    return this.session.active() ? this.demoAccommodations() : this.api.list();
  }

  async get(id: string): Promise<Accommodation> {
    if (!this.session.active()) return this.api.get(id);
    const item = this.demoAccommodations().find((entry) => entry.id === id);
    if (!item) throw new AccommodationApiError(404, 'not_found');
    return item;
  }

  async save(
    input: AccommodationInput,
    existing?: Pick<Accommodation, 'id' | 'version'>,
  ): Promise<Accommodation> {
    if (!this.session.active()) return this.api.save(input, existing);
    const list = this.demoAccommodations();
    const prior = existing ? await this.get(existing.id) : undefined;
    if (prior && prior.version !== existing?.version)
      throw new AccommodationApiError(409, 'stale_version');
    if (
      list.some(
        (entry) => entry.id !== prior?.id && entry.code.toLowerCase() === input.code.toLowerCase(),
      )
    )
      throw new AccommodationApiError(409, 'duplicate_code');
    const item = {
      ...input,
      id: prior?.id ?? crypto.randomUUID(),
      version: prior ? prior.version + 1 : 0,
    };
    this.demoAccommodations.set([...list.filter((entry) => entry.id !== item.id), item]);
    return item;
  }

  async listUnits(accommodationId: string): Promise<AccommodationUnit[]> {
    if (!this.session.active()) return this.api.listUnits(accommodationId);
    await this.get(accommodationId);
    return this.demoUnits().filter((entry) => entry.accommodationId === accommodationId);
  }

  async getUnit(accommodationId: string, id: string): Promise<AccommodationUnit> {
    if (!this.session.active()) return this.api.getUnit(accommodationId, id);
    const item = (await this.listUnits(accommodationId)).find((entry) => entry.id === id);
    if (!item) throw new AccommodationApiError(404, 'not_found');
    return item;
  }

  async saveUnit(
    accommodationId: string,
    input: AccommodationInput,
    existing?: Pick<AccommodationUnit, 'id' | 'version'>,
  ): Promise<AccommodationUnit> {
    if (!this.session.active()) return this.api.saveUnit(accommodationId, input, existing);
    const list = await this.listUnits(accommodationId);
    const prior = existing ? await this.getUnit(accommodationId, existing.id) : undefined;
    if (prior && prior.version !== existing?.version)
      throw new AccommodationApiError(409, 'stale_version');
    if (
      list.some(
        (entry) => entry.id !== prior?.id && entry.code.toLowerCase() === input.code.toLowerCase(),
      )
    )
      throw new AccommodationApiError(409, 'duplicate_code');
    const item = {
      ...input,
      accommodationId,
      id: prior?.id ?? crypto.randomUUID(),
      version: prior ? prior.version + 1 : 0,
    };
    this.demoUnits.set([...this.demoUnits().filter((entry) => entry.id !== item.id), item]);
    return item;
  }
}
