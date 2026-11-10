export type RoomSituation = 'Disponível' | 'Ocupado' | 'Manutenção' | 'Indisponível';

export interface Resident {
  id: string;
  name: string;
  enrollment: string;
  birthDate: string;
  course: string;
  institutionalEmail?: string | null;
  roomId: string | null;
  status: 'Ativo' | 'Inativo';
  version: number;
}

export type ResidentInput = Pick<
  Resident,
  'name' | 'enrollment' | 'birthDate' | 'course' | 'institutionalEmail'
>;

export interface LegalGuardian {
  id: string;
  residentId: string;
  name: string;
  relationship: string;
  phone: string;
  active: boolean;
  authorized: boolean;
  version: number;
}

export type LegalGuardianInput = Pick<
  LegalGuardian,
  'name' | 'relationship' | 'phone' | 'active' | 'authorized'
>;

export interface Supervisor {
  id: string;
  name: string;
  institutionalId: string;
  email: string;
  version: number;
}

export type SupervisorInput = Pick<Supervisor, 'name' | 'institutionalId' | 'email'>;

export type SupervisorPayload = SupervisorInput & {
  password?: string;
  passwordConfirmation?: string;
};

export interface Room {
  id: string;
  number: string;
  block: string;
  floor: string;
  situation: RoomSituation;
  cleaningScore: number | null;
  version: number;
}

export type RoomInput = Pick<Room, 'number' | 'block' | 'floor' | 'situation'>;

export interface ResidentHistoryEntry {
  id: string;
  residentId: string;
  date: string;
  description: string;
  category: string;
}

export interface CommitmentTerm {
  id: string;
  residentId: string;
  title: string;
  status: 'Pendente de definição institucional';
}
