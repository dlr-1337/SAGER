import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { FilterState } from '../../core/filter-state';
import { HousingMap } from '../management/housing.models';
import { ResidentApiService } from '../management/resident-api.service';
import { RoomApiService } from '../management/room-api.service';
import { CleaningLocalApiService } from './cleaning-local-api.service';
import { CleaningListLocalPage } from './cleaning-local.pages';

const room = (id: string, code: string, accommodationId: string, unitId: string | null) => ({
  id,
  code,
  number: '101',
  accommodationId,
  unitId,
  floor: null,
  capacity: 4,
  situation: 'Ocupado' as const,
  occupancy: 1,
  vacancies: 3,
  cleaningScore: null,
  version: 0,
});
const housing: HousingMap = {
  accommodations: [
    { id: 'a1', code: 'A1', name: 'Alojamento Um', version: 0 },
    { id: 'a2', code: 'A2', name: 'Alojamento Dois', version: 0 },
  ],
  units: [{ id: 'u1', accommodationId: 'a1', code: 'BA', name: 'Bloco A', version: 0 }],
  rooms: [room('r1', 'A-101', 'a1', 'u1'), room('r2', 'C-101', 'a2', null)],
};

describe('Filtro de alojamento na lista de limpeza', () => {
  let list: ReturnType<typeof vi.fn>;
  let map: ReturnType<typeof vi.fn>;
  let own: boolean;

  beforeEach(() => {
    own = false;
    list = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    map = vi.fn().mockResolvedValue(structuredClone(housing));
    TestBed.configureTestingModule({
      imports: [CleaningListLocalPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get data() {
                return { ownCleaning: own };
              },
            },
          },
        },
        {
          provide: DemoSessionService,
          useValue: {
            active: signal(false),
            hasRole: (...roles: string[]) => roles.includes(own ? 'residente' : 'supervisor'),
          },
        },
        {
          provide: CleaningLocalApiService,
          useValue: { list, ownList: vi.fn().mockResolvedValue({ items: [], nextCursor: null }) },
        },
        { provide: RoomApiService, useValue: { map } },
        { provide: ResidentApiService, useValue: { list: vi.fn().mockResolvedValue([]) } },
      ],
    });
  });

  async function create() {
    const fixture = TestBed.createComponent(CleaningListLocalPage);
    await fixture.whenStable();
    return fixture;
  }

  it('envia o alojamento sem quarto e oferece só os quartos dele', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    expect(page.visibleRooms().map((item) => page.roomLabel(item))).toEqual([
      'A-101 · Bloco A',
      'C-101',
    ]);
    page.filters.controls.accommodationId.setValue('a2');
    await page.load();
    expect(page.visibleRooms().map((item) => item.id)).toEqual(['r2']);
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ accommodationId: 'a2', roomId: '' }),
    );
  });

  it('volta o quarto a todos ao trocar de alojamento', async () => {
    const fixture = await create();
    const { accommodationId, roomId } = fixture.componentInstance.filters.controls;
    accommodationId.setValue('a1');
    roomId.setValue('r1');
    accommodationId.setValue('a2');
    expect(roomId.value).toBe('');
  });

  it('filtra por casa ou bloco, com quarto dependente e cascata', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    const { accommodationId, unitId, roomId } = page.filters.controls;
    expect(page.visibleUnits().map((item) => page.unitLabel(item))).toEqual([
      'Bloco A · Alojamento Um',
    ]);
    roomId.setValue('r2');
    unitId.setValue('u1');
    expect(roomId.value).toBe('');
    expect(page.visibleRooms().map((item) => item.id)).toEqual(['r1']);
    await page.load();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ unitId: 'u1', roomId: '' }));
    accommodationId.setValue('a1');
    expect(unitId.value).toBe('');
    expect(page.visibleUnits().map((item) => page.unitLabel(item))).toEqual(['Bloco A']);
  });

  it('descarta bloco lembrado fora do alojamento e consulta sem ele', async () => {
    TestBed.inject(FilterState).values.set('cleaning-local.pages', {
      from: '',
      to: '',
      accommodationId: 'a2',
      unitId: 'u1',
      roomId: '',
      residentId: '',
    });
    const fixture = await create();
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await fixture.whenStable();
    expect(fixture.componentInstance.filters.controls.unitId.value).toBe('');
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ accommodationId: 'a2', unitId: '' }),
    );
  });

  it('descarta quarto lembrado fora do alojamento e consulta sem ele', async () => {
    TestBed.inject(FilterState).values.set('cleaning-local.pages', {
      from: '',
      to: '',
      accommodationId: 'a1',
      roomId: 'r2',
      residentId: '',
    });
    const fixture = await create();
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await fixture.whenStable();
    expect(fixture.componentInstance.filters.controls.roomId.value).toBe('');
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ accommodationId: 'a1', roomId: '' }),
    );
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('não consulta o mapa em "Minhas avaliações"', async () => {
    own = true;
    await create();
    expect(map).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });
});
