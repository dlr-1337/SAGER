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
  occupancy: null;
  vacancies: null;
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
