import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { RoomSituation } from './management.models';

export interface Accommodation {
  id: string;
  code: string;
  name: string;
  version: number;
}

export type AccommodationInput = Pick<Accommodation, 'code' | 'name'>;

export interface AccommodationUnit extends Accommodation {
  accommodationId: string;
}

export interface RoomRecord {
  id: string;
  code: string;
  number: string;
  accommodationId: string;
  unitId: string | null;
  floor: string | null;
  capacity: number | null;
  situation: RoomSituation;
  occupancy: number;
  vacancies: number | null;
  cleaningScore: null;
  version: number;
}

export type RoomRecordInput = Pick<
  RoomRecord,
  'code' | 'number' | 'accommodationId' | 'unitId' | 'floor' | 'capacity' | 'situation'
>;

export interface HousingMap {
  accommodations: Accommodation[];
  units: AccommodationUnit[];
  rooms: RoomRecord[];
}

// O número pode repetir dentro do alojamento; o código é o que distingue a opção.
export function roomOptionLabel(room: RoomRecord, units: AccommodationUnit[]): string {
  const unit = units.find((item) => item.id === room.unitId);
  return unit ? `${room.code} · ${unit.name}` : room.code;
}

export function unitsIn(map: HousingMap, accommodationId?: string): AccommodationUnit[] {
  return map.units.filter((unit) => !accommodationId || unit.accommodationId === accommodationId);
}

export function roomsIn(map: HousingMap, accommodationId?: string, unitId?: string): RoomRecord[] {
  return map.rooms.filter(
    (room) =>
      (!accommodationId || room.accommodationId === accommodationId) &&
      (!unitId || room.unitId === unitId),
  );
}

// "Bloco A" pode repetir entre alojamentos; sem alojamento escolhido, o nome dele distingue a opção.
export function unitOptionLabel(
  unit: AccommodationUnit,
  map: HousingMap,
  accommodationId?: string,
): string {
  const owner = map.accommodations.find((item) => item.id === unit.accommodationId);
  return !accommodationId && owner ? `${unit.name} · ${owner.name}` : unit.name;
}

export interface LocationControls {
  accommodationId: FormControl<string>;
  unitId: FormControl<string>;
  roomId: FormControl<string>;
}

/** Chame depois de restaurar filtros lembrados, para a restauração não limpar a seleção. */
export function cascadeLocation({ accommodationId, unitId, roomId }: LocationControls): void {
  accommodationId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => unitId.setValue(''));
  unitId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => roomId.setValue(''));
}

export function clearMissingLocation(map: HousingMap, controls: LocationControls): boolean {
  const { accommodationId, unitId, roomId } = controls;
  const before = unitId.value + roomId.value;
  if (unitId.value && !unitsIn(map, accommodationId.value).some((u) => u.id === unitId.value))
    unitId.setValue('');
  if (
    roomId.value &&
    !roomsIn(map, accommodationId.value, unitId.value).some((r) => r.id === roomId.value)
  )
    roomId.setValue('');
  return unitId.value + roomId.value !== before;
}
