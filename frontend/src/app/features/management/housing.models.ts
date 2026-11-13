import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { RoomSituation } from './management.models';

export type AgeGroup = 'MENORES' | 'MAIORES';

export interface Accommodation {
  id: string;
  code: string;
  name: string;
  ageGroup?: AgeGroup | null;
  version: number;
}

export type AccommodationInput = Pick<Accommodation, 'code' | 'name' | 'ageGroup'>;

export function ageGroupLabel(group: AgeGroup | null | undefined): string {
  if (group === 'MENORES') return 'Menores de 18 anos';
  if (group === 'MAIORES') return 'Maiores de 18 anos';
  return 'Sem faixa definida';
}

// Ausente vem de servidor antigo e de fixtures; vale como sem faixa.
export function validAgeGroup(value: unknown): boolean {
  return value === undefined || value === null || value === 'MENORES' || value === 'MAIORES';
}

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

const collator = new Intl.Collator('pt-BR', { numeric: true });

/** Ordem natural: "Casa 2" antes de "Casa 10". */
export function compareNatural(a: string, b: string): number {
  return collator.compare(a, b);
}

/** Sem piso primeiro, depois Térreo, os pisos numerados e o resto pelo nome. */
export function floorPosition(floor: string | null): number {
  if (floor === null) return -1;
  if (floor === 'Térreo') return 0;
  const number = Number.parseInt(floor, 10);
  return Number.isNaN(number) ? Number.MAX_SAFE_INTEGER : number;
}

export function compareFloors(a: string | null, b: string | null): number {
  return floorPosition(a) - floorPosition(b) || compareNatural(a ?? '', b ?? '');
}

/** Alojamentos por nome; casas por alojamento e nome; quartos por alojamento, casa (sem casa
 * primeiro), piso, número e código. */
export function sortHousingMap(map: HousingMap): HousingMap {
  const names = new Map(
    [...map.accommodations, ...map.units].map((item) => [item.id, item.name] as const),
  );
  const byName = (a: string | null, b: string | null) =>
    compareNatural(names.get(a ?? '') ?? '', names.get(b ?? '') ?? '');
  return {
    accommodations: [...map.accommodations].sort((a, b) => compareNatural(a.name, b.name)),
    units: [...map.units].sort(
      (a, b) => byName(a.accommodationId, b.accommodationId) || compareNatural(a.name, b.name),
    ),
    rooms: [...map.rooms].sort(
      (a, b) =>
        byName(a.accommodationId, b.accommodationId) ||
        Number(a.unitId !== null) - Number(b.unitId !== null) ||
        byName(a.unitId, b.unitId) ||
        compareFloors(a.floor, b.floor) ||
        compareNatural(a.number, b.number) ||
        compareNatural(a.code, b.code),
    ),
  };
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
