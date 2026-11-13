import { computed, Injectable, signal } from '@angular/core';
import {
  CommitmentTerm,
  LegalGuardian,
  LegalGuardianInput,
  Resident,
  ResidentHistoryEntry,
  ResidentInput,
  Room,
  RoomInput,
  Supervisor,
  SupervisorInput,
} from './management.models';
import { formatResidentName } from './management.utils';
import {
  birthDateProblem,
  changedProblem,
  nameProblem,
  normalizeEnrollment,
  normalizeName,
  phoneDigits,
  phoneProblem,
  relationshipProblem,
  residentEmailProblem,
  residentEnrollmentProblem,
  supervisorIdProblem,
} from '../../shared/field-rules';

interface ManagementState {
  residents: Resident[];
  guardians: LegalGuardian[];
  supervisors: Supervisor[];
  rooms: Room[];
}

const INITIAL_STATE: ManagementState = {
  residents: [
    {
      id: 'r-ana',
      name: 'Ana Luísa Ribeiro',
      enrollment: '2024100000001001',
      birthDate: '2009-06-14',
      course: 'Agropecuária',
      roomId: 'q-102',
      status: 'Ativo',
      version: 1,
    },
    {
      id: 'r-bruno',
      name: 'Pedro Henrique Silva',
      enrollment: '2024100000001002',
      birthDate: '2009-12-03',
      course: 'Informática',
      roomId: 'q-104',
      status: 'Ativo',
      version: 1,
    },
    {
      id: 'r-camila',
      name: 'Beatriz Costa',
      enrollment: '2024100000001003',
      birthDate: '2010-08-22',
      course: 'Alimentos',
      roomId: 'q-201',
      status: 'Ativo',
      version: 1,
    },
    {
      id: 'r-davi',
      name: 'Lucas Almeida',
      enrollment: '2024100000001004',
      birthDate: '2010-02-08',
      course: 'Agropecuária',
      roomId: 'q-203',
      status: 'Ativo',
      version: 1,
    },
  ],
  guardians: [
    {
      id: 'g-1',
      residentId: 'r-ana',
      name: 'Mariana Ribeiro',
      relationship: 'Mãe',
      phone: '62999990001',
      active: true,
      authorized: true,
      version: 1,
    },
    {
      id: 'g-2',
      residentId: 'r-bruno',
      name: 'Paulo Silva',
      relationship: 'Pai',
      phone: '62999990002',
      active: true,
      authorized: true,
      version: 1,
    },
  ],
  supervisors: [
    {
      id: 's-1',
      name: 'Helena Supervisora Exemplo',
      institutionalId: 'DEMO-SUP-001',
      email: 'helena@demo.invalid',
      version: 1,
    },
    {
      id: 's-2',
      name: 'Ricardo Supervisor Exemplo',
      institutionalId: 'DEMO-SUP-002',
      email: 'ricardo@demo.invalid',
      version: 1,
    },
  ],
  rooms: [
    {
      id: 'q-101',
      number: '101',
      block: 'A',
      floor: 'Térreo',
      situation: 'Disponível',
      cleaningScore: 8.5,
      version: 1,
    },
    {
      id: 'q-102',
      number: '102',
      block: 'A',
      floor: 'Térreo',
      situation: 'Ocupado',
      cleaningScore: null,
      version: 1,
    },
    {
      id: 'q-103',
      number: '103',
      block: 'A',
      floor: 'Térreo',
      situation: 'Disponível',
      cleaningScore: null,
      version: 1,
    },
    {
      id: 'q-104',
      number: '104',
      block: 'A',
      floor: 'Térreo',
      situation: 'Ocupado',
      cleaningScore: null,
      version: 1,
    },
    {
      id: 'q-201',
      number: '201',
      block: 'B',
      floor: '1º piso',
      situation: 'Ocupado',
      cleaningScore: 9,
      version: 1,
    },
    {
      id: 'q-202',
      number: '202',
      block: 'A',
      floor: '1º piso',
      situation: 'Manutenção',
      cleaningScore: null,
      version: 1,
    },
    {
      id: 'q-203',
      number: '203',
      block: 'B',
      floor: '1º piso',
      situation: 'Ocupado',
      cleaningScore: null,
      version: 1,
    },
    {
      id: 'q-301',
      number: '301',
      block: 'B',
      floor: 'Térreo',
      situation: 'Disponível',
      cleaningScore: null,
      version: 1,
    },
    {
      id: 'q-302',
      number: '302',
      block: 'B',
      floor: 'Térreo',
      situation: 'Indisponível',
      cleaningScore: null,
      version: 1,
    },
  ],
};

const HISTORY: ResidentHistoryEntry[] = [
  {
    id: 'h-1',
    residentId: 'r-ana',
    date: '2026-09-24',
    category: 'Cadastro',
    description: 'Registro demonstrativo criado para a apresentação do sistema.',
  },
  {
    id: 'h-2',
    residentId: 'r-ana',
    date: '2026-09-23',
    category: 'Chamada',
    description: 'Exemplo de presença registrada na chamada noturna.',
  },
  {
    id: 'h-3',
    residentId: 'r-bruno',
    date: '2026-09-24',
    category: 'Cadastro',
    description: 'Registro demonstrativo criado para a apresentação do sistema.',
  },
];

@Injectable({ providedIn: 'root' })
export class ManagementDemoService {
  private readonly state = signal<ManagementState>(structuredClone(INITIAL_STATE));

  readonly residents = computed(() => this.state().residents);
  readonly guardians = computed(() => this.state().guardians);
  readonly supervisors = computed(() => this.state().supervisors);
  readonly rooms = computed(() => this.state().rooms);

  readonly history = signal<ResidentHistoryEntry[]>(HISTORY);
  readonly terms = signal<CommitmentTerm[]>([]);

  renameCourse(previous: string, next: string): void {
    this.state.update((state) => ({
      ...state,
      residents: state.residents.map((r) => (r.course === previous ? { ...r, course: next } : r)),
    }));
  }

  resident(id: string): Resident | undefined {
    return this.residents().find((item) => item.id === id);
  }

  supervisor(id: string): Supervisor | undefined {
    return this.supervisors().find((item) => item.id === id);
  }

  guardian(id: string): LegalGuardian | undefined {
    return this.guardians().find((item) => item.id === id);
  }

  room(id: string): Room | undefined {
    return this.rooms().find((item) => item.id === id);
  }

  roomLabel(id: string | null): string {
    const room = id ? this.room(id) : undefined;
    return room ? `${room.number} · Bloco ${room.block}` : 'Sem quarto atribuído';
  }

  residentsInRoom(id: string): Resident[] {
    return this.residents().filter((item) => item.roomId === id && item.status === 'Ativo');
  }

  occupancyLabel(id: string): string {
    const count = this.residentsInRoom(id).length;
    return `${count} ${count === 1 ? 'morador' : 'moradores'}`;
  }

  guardiansFor(residentId: string): LegalGuardian[] {
    return this.guardians().filter((item) => item.residentId === residentId);
  }

  saveResident(input: ResidentInput, id?: string): Resident {
    const existing = id ? this.resident(id) : undefined;
    if (id && !existing) throw new Error('Residente não encontrado.');
    const typedEnrollment = input.enrollment.trim();
    const problem =
      changedProblem(nameProblem, input.name.trim(), existing?.name) ??
      changedProblem(residentEnrollmentProblem, typedEnrollment, existing?.enrollment) ??
      changedProblem(birthDateProblem, input.birthDate, existing?.birthDate) ??
      changedProblem(
        residentEmailProblem,
        input.institutionalEmail?.trim() ?? '',
        existing?.institutionalEmail,
      ) ??
      (input.course.trim() ? null : 'Escolha o curso.');
    if (problem) throw new Error(problem);
    const enrollment =
      typedEnrollment === existing?.enrollment
        ? typedEnrollment
        : normalizeEnrollment(typedEnrollment);
    if (
      this.residents().some(
        (item) => item.enrollment.toUpperCase() === enrollment.toUpperCase() && item.id !== id,
      )
    ) {
      throw new Error('Esta matrícula já está cadastrada na demonstração.');
    }
    const resident: Resident = {
      id: existing?.id ?? newId(),
      name: formatResidentName(normalizeName(input.name)),
      enrollment,
      birthDate: input.birthDate,
      course: input.course.trim(),
      institutionalEmail: input.institutionalEmail?.trim().toLowerCase() || null,
      roomId: existing?.roomId ?? null,
      status: existing?.status ?? 'Ativo',
      version: (existing?.version ?? 0) + 1,
    };
    this.commit({ ...this.state(), residents: upsert(this.residents(), resident) });
    return resident;
  }

  saveGuardian(residentId: string, input: LegalGuardianInput, id?: string): LegalGuardian {
    if (!this.resident(residentId)) throw new Error('Residente não encontrado.');
    const existing = id
      ? this.guardians().find((item) => item.id === id && item.residentId === residentId)
      : undefined;
    if (id && !existing) throw new Error('Responsável não encontrado.');
    const typedName = input.name.trim();
    const problem =
      changedProblem(nameProblem, typedName, existing?.name) ??
      changedProblem(relationshipProblem, input.relationship.trim(), existing?.relationship) ??
      changedProblem(phoneProblem, phoneDigits(input.phone), existing?.phone);
    if (problem) throw new Error(problem);
    const guardian: LegalGuardian = {
      id: existing?.id ?? newId(),
      residentId,
      name: typedName === existing?.name ? typedName : normalizeName(typedName),
      relationship: input.relationship.trim(),
      phone: phoneDigits(input.phone),
      active: input.active,
      authorized: input.authorized,
      version: (existing?.version ?? 0) + 1,
    };
    this.commit({ ...this.state(), guardians: upsert(this.guardians(), guardian) });
    return guardian;
  }

  saveSupervisor(input: SupervisorInput, id?: string): Supervisor {
    const existing = id ? this.supervisor(id) : undefined;
    if (id && !existing) throw new Error('Supervisor não encontrado.');
    const typedName = input.name.trim();
    const typedId = input.institutionalId.trim();
    const problem =
      changedProblem(nameProblem, typedName, existing?.name) ??
      changedProblem(supervisorIdProblem, typedId, existing?.institutionalId);
    if (problem) throw new Error(problem);
    const institutionalId = typedId.toUpperCase();
    if (
      this.supervisors().some(
        (item) => item.institutionalId.toUpperCase() === institutionalId && item.id !== id,
      )
    ) {
      throw new Error('Esta matrícula ou SIAPE já está cadastrada.');
    }
    const supervisor: Supervisor = {
      id: existing?.id ?? newId(),
      name: typedName === existing?.name ? typedName : normalizeName(typedName),
      institutionalId,
      email: input.email.trim().toLowerCase(),
      version: (existing?.version ?? 0) + 1,
    };
    this.commit({ ...this.state(), supervisors: upsert(this.supervisors(), supervisor) });
    return supervisor;
  }

  saveRoom(input: RoomInput, id?: string): Room {
    const number = input.number.trim();
    if (
      this.rooms().some(
        (item) => item.number.toLowerCase() === number.toLowerCase() && item.id !== id,
      )
    ) {
      throw new Error('Este número de quarto já está cadastrado. Use outro número.');
    }
    const existing = id ? this.room(id) : undefined;
    if (id && !existing) throw new Error('Quarto não encontrado.');
    const room: Room = {
      id: existing?.id ?? newId(),
      number,
      block: input.block.trim(),
      floor: input.floor.trim(),
      situation: input.situation,
      cleaningScore: existing?.cleaningScore ?? null,
      version: (existing?.version ?? 0) + 1,
    };
    this.commit({ ...this.state(), rooms: upsert(this.rooms(), room) });
    return room;
  }

  private commit(state: ManagementState): void {
    this.state.set(state);
  }
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((value) => value.id === item.id)
    ? items.map((value) => (value.id === item.id ? item : value))
    : [...items, item];
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
