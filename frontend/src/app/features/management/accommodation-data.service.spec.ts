import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { AccommodationApiError, AccommodationApiService } from './accommodation-api.service';
import { AccommodationDataService } from './accommodation-data.service';

function setup(demo: boolean) {
  const active = signal(demo);
  const api = { list: vi.fn(), save: vi.fn(), listUnits: vi.fn(), saveUnit: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: DemoSessionService, useValue: { active } },
      { provide: AccommodationApiService, useValue: api },
    ],
  });
  return { data: TestBed.inject(AccommodationDataService), active, api };
}

describe('AccommodationDataService', () => {
  it('preserva cadastros demonstrativos somente em memória, sem chamadas à API', async () => {
    const { data, api } = setup(true);
    const accommodation = await data.save({ code: 'FICTICIO', name: 'Alojamento Fictício' });
    const unit = await data.saveUnit(accommodation.id, { code: 'CASA', name: 'Casa Fictícia' });
    expect(await data.list()).toEqual([accommodation]);
    expect(await data.listUnits(accommodation.id)).toEqual([unit]);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.saveUnit).not.toHaveBeenCalled();
  });

  it('recusa código duplicado e edição demonstrativa com versão obsoleta', async () => {
    const { data } = setup(true);
    const accommodation = await data.save({ code: 'FICTICIO', name: 'Alojamento Fictício' });
    await expect(data.save({ code: 'ficticio', name: 'Duplicado' })).rejects.toEqual(
      new AccommodationApiError(409, 'duplicate_code'),
    );
    await data.save({ code: accommodation.code, name: 'Versão Atual' }, accommodation);
    await expect(
      data.save({ code: accommodation.code, name: 'Versão Antiga' }, accommodation),
    ).rejects.toEqual(new AccommodationApiError(409, 'stale_version'));
    expect((await data.get(accommodation.id)).name).toBe('Versão Atual');
  });

  it('não usa o catálogo demonstrativo quando a API local falha', async () => {
    const { data, active, api } = setup(true);
    await data.save({ code: 'FICTICIO', name: 'Alojamento Fictício' });
    active.set(false);
    api.list.mockRejectedValue(new Error('offline'));
    await expect(data.list()).rejects.toThrow('offline');
    expect(api.list).toHaveBeenCalledOnce();
  });

  it('impede consultar ou editar uma unidade demonstrativa por outro alojamento', async () => {
    const { data } = setup(true);
    const first = await data.save({ code: 'A', name: 'Alojamento A' });
    const second = await data.save({ code: 'B', name: 'Alojamento B' });
    const unit = await data.saveUnit(first.id, { code: 'CASA', name: 'Casa A' });
    await expect(data.getUnit(second.id, unit.id)).rejects.toEqual(
      new AccommodationApiError(404, 'not_found'),
    );
    await expect(data.saveUnit(second.id, { code: 'CASA', name: 'Movida' }, unit)).rejects.toEqual(
      new AccommodationApiError(404, 'not_found'),
    );
  });
});
