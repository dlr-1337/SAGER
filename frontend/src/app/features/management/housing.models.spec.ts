import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import {
  HousingMap,
  LocationControls,
  cascadeLocation,
  clearMissingLocation,
  roomsIn,
  unitOptionLabel,
  unitsIn,
} from './housing.models';

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
  cleaningScore: null,
  version: 0,
});
const map: HousingMap = {
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
const controls = (accommodationId = '', unitId = '', roomId = ''): LocationControls => ({
  accommodationId: new FormControl(accommodationId, { nonNullable: true }),
  unitId: new FormControl(unitId, { nonNullable: true }),
  roomId: new FormControl(roomId, { nonNullable: true }),
});

describe('Opções de bloco e quarto em cascata', () => {
  it('o bloco e o quarto seguem a seleção superior', () => {
    expect(unitsIn(map, '').map((item) => item.id)).toEqual(['u1', 'u2']);
    expect(unitsIn(map, 'a2').map((item) => item.id)).toEqual(['u2']);
    expect(roomsIn(map, '', '').map((item) => item.id)).toEqual(['r1', 'r2', 'r3']);
    expect(roomsIn(map, 'a1', '').map((item) => item.id)).toEqual(['r1', 'r2']);
    expect(roomsIn(map, 'a1', 'u1').map((item) => item.id)).toEqual(['r1']);
  });

  it('blocos de mesmo nome se distinguem pelo alojamento só quando nenhum foi escolhido', () => {
    const labels = map.units.map((unit) => unitOptionLabel(unit, map, ''));
    expect(labels).toEqual(['Bloco A · Alojamento Um', 'Bloco A · Alojamento Dois']);
    expect(unitOptionLabel(map.units[0], map, 'a1')).toBe('Bloco A');
  });

  it('trocar o alojamento limpa bloco e quarto; trocar o bloco limpa só o quarto', () => {
    const location = controls('a1', 'u1', 'r1');
    TestBed.runInInjectionContext(() => cascadeLocation(location));
    location.unitId.setValue('');
    expect(location.roomId.value).toBe('');
    expect(location.accommodationId.value).toBe('a1');
    location.unitId.setValue('u1');
    location.roomId.setValue('r1');
    location.accommodationId.setValue('a2');
    expect(location.unitId.value).toBe('');
    expect(location.roomId.value).toBe('');
  });

  it('descarta seleção lembrada que saiu das opções e avisa quando descartou', () => {
    const stale = controls('a1', 'u2', 'r3');
    expect(clearMissingLocation(map, stale)).toBe(true);
    expect(stale.unitId.value).toBe('');
    expect(stale.roomId.value).toBe('');
    const outOfUnit = controls('a1', 'u1', 'r2');
    expect(clearMissingLocation(map, outOfUnit)).toBe(true);
    expect(outOfUnit.unitId.value).toBe('u1');
    expect(outOfUnit.roomId.value).toBe('');
    const valid = controls('a1', 'u1', 'r1');
    expect(clearMissingLocation(map, valid)).toBe(false);
    expect(valid.roomId.value).toBe('r1');
  });
});
