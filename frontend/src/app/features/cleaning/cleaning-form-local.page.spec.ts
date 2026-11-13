import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { HousingMap } from '../management/housing.models';
import { RoomApiService } from '../management/room-api.service';
import { CleaningFormLocalPage } from './cleaning-form-local.page';
import { CleaningLocalApiService } from './cleaning-local-api.service';

const room = (id: string, accommodationId: string, unitId: string | null) => ({
  id,
  code: id.toUpperCase(),
  number: '101',
  accommodationId,
  unitId,
  floor: null,
  capacity: 4,
  situation: 'Ocupado' as const,
  occupancy: 1,
  vacancies: 3,
  version: 0,
});
const housing: HousingMap = {
  accommodations: [
    { id: 'a1', code: 'A1', name: 'Alojamento Um', version: 0 },
    { id: 'a2', code: 'A2', name: 'Alojamento Dois', version: 0 },
  ],
  units: [
    { id: 'u1', accommodationId: 'a1', code: 'BA', name: 'Bloco A', version: 0 },
    { id: 'u2', accommodationId: 'a2', code: 'BA', name: 'Bloco A', version: 0 },
  ],
  rooms: [room('r1', 'a1', 'u1'), room('r2', 'a1', null), room('r3', 'a2', 'u2')],
};

describe('Escolha do quarto na avaliação de limpeza', () => {
  let map: ReturnType<typeof vi.fn>;
  let id: string | null;

  beforeEach(() => {
    id = null;
    map = vi.fn().mockResolvedValue(structuredClone(housing));
    TestBed.configureTestingModule({
      imports: [CleaningFormLocalPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => id } } },
        },
        {
          provide: DemoSessionService,
          useValue: { active: signal(false), hasRole: (role: string) => role === 'supervisor' },
        },
        {
          provide: CleaningLocalApiService,
          useValue: {
            policy: vi.fn().mockResolvedValue({ version: 1, now: '', currentDate: '' }),
            get: vi.fn().mockResolvedValue(null),
          },
        },
        { provide: RoomApiService, useValue: { map } },
        { provide: MatDialog, useValue: {} },
      ],
    });
  });

  async function create() {
    const fixture = TestBed.createComponent(CleaningFormLocalPage);
    await fixture.whenStable();
    return fixture;
  }

  it('estreita as opções sem chamar o servidor e limpa em cascata', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    const { accommodationId, unitId, roomId } = page.form.controls;
    expect(page.visibleUnits().map((item) => page.unitLabel(item))).toEqual([
      'Bloco A · Alojamento Um',
      'Bloco A · Alojamento Dois',
    ]);
    expect(page.visibleRooms().map((item) => page.roomLabel(item))).toEqual([
      'R1 · Bloco A',
      'R2',
      'R3 · Bloco A',
    ]);
    accommodationId.setValue('a1');
    expect(page.visibleUnits().map((item) => page.unitLabel(item))).toEqual(['Bloco A']);
    expect(page.visibleRooms().map((item) => item.id)).toEqual(['r1', 'r2']);
    roomId.setValue('r2');
    unitId.setValue('u1');
    expect(roomId.value).toBe('');
    expect(page.visibleRooms().map((item) => item.id)).toEqual(['r1']);
    roomId.setValue('r1');
    accommodationId.setValue('a2');
    expect(unitId.value).toBe('');
    expect(roomId.value).toBe('');
    expect(map).toHaveBeenCalledTimes(1);
  });

  it('ao corrigir uma avaliação não carrega quartos nem mostra a escolha', async () => {
    id = 'avaliacao';
    const fixture = await create();
    expect(map).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[formcontrolname="unitId"]')).toBeNull();
  });
});
