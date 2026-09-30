import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoScenario, DemoSessionService, Role } from '../../core/demo-session.service';
import {
  AllocationApiError,
  AllocationApiService,
  AllocationRecord,
} from './allocation-api.service';
import { GuardianApiService, GuardianRecord } from './guardian-api.service';
import { HousingMap } from './housing.models';
import { ManagementDemoService } from './management-demo.service';
import { ResidentApiError, ResidentApiService, ResidentRecord } from './resident-api.service';
import { ResidentDetailComponent } from './resident-detail.component';
import { ResidentFormComponent } from './resident-form.component';
import { ResidentsComponent } from './residents.component';
import { RoomApiService } from './room-api.service';

const resident: ResidentRecord = {
  id: '00000000-0000-0000-0000-000000000041',
  name: 'Estudante Sintético',
  enrollment: 'TESTE-001',
  birthDate: null,
  course: null,
  version: 0,
};
const guardian: GuardianRecord = {
  id: '00000000-0000-0000-0000-000000000051',
  residentId: resident.id,
  name: 'Responsável Sintético',
  relationship: 'pessoa com guarda',
  phone: null,
  active: true,
  version: 0,
};
const roomId = '00000000-0000-0000-0000-000000000301';
const secondRoomId = '00000000-0000-0000-0000-000000000302';
const allocation: AllocationRecord = {
  id: '00000000-0000-0000-0000-000000000401',
  residentId: resident.id,
  roomId,
  startedAt: '2026-09-29T12:00:00Z',
  endedAt: null,
  endReason: null,
  version: 0,
};
const map: HousingMap = {
  accommodations: [{ id: 'a1', code: 'A1', name: 'Alojamento Sintético', version: 0 }],
  units: [],
  rooms: [roomId, secondRoomId].map((id, index) => ({
    id,
    code: `Q${index + 1}`,
    number: `0${index + 1}`,
    accommodationId: 'a1',
    unitId: null,
    floor: null,
    capacity: 2,
    situation: 'Disponível',
    occupancy: index,
    vacancies: 2 - index,
    cleaningScore: null,
    version: 0,
  })),
};

describe('Residentes em sessão local', () => {
  const active = signal(false);
  const role = signal<Role>('gestor');
  const scenario = signal<DemoScenario>('padrao');
  const route = {
    snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) },
  };
  let api: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let guardianApi: { list: ReturnType<typeof vi.fn> };
  let allocationApi: {
    byResident: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    transfer: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  let roomApi: { map: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    active.set(false);
    role.set('gestor');
    scenario.set('padrao');
    route.snapshot.paramMap = convertToParamMap({});
    route.snapshot.queryParamMap = convertToParamMap({});
    api = {
      list: vi.fn().mockResolvedValue([structuredClone(resident)]),
      get: vi.fn().mockResolvedValue(structuredClone(resident)),
      save: vi.fn().mockResolvedValue(structuredClone(resident)),
    };
    guardianApi = { list: vi.fn().mockResolvedValue([structuredClone(guardian)]) };
    allocationApi = {
      byResident: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(structuredClone(allocation)),
      transfer: vi.fn().mockResolvedValue(structuredClone(allocation)),
      end: vi.fn().mockResolvedValue(structuredClone(allocation)),
    };
    roomApi = { map: vi.fn().mockResolvedValue(structuredClone(map)) };
    await TestBed.configureTestingModule({
      imports: [ResidentsComponent, ResidentFormComponent, ResidentDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: ResidentApiService, useValue: api },
        { provide: GuardianApiService, useValue: guardianApi },
        { provide: AllocationApiService, useValue: allocationApi },
        { provide: RoomApiService, useValue: roomApi },
        {
          provide: DemoSessionService,
          useValue: {
            active,
            scenario,
            hasRole: (...roles: Role[]) => roles.includes(role()),
            setScenario: (value: DemoScenario) => scenario.set(value),
          },
        },
      ],
    }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('busca por nome e matrícula na API sem dados demonstrativos', async () => {
    const fixture = TestBed.createComponent(ResidentsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Estudante Sintético');
    expect(fixture.nativeElement.textContent).toContain('Não informado');
    expect(fixture.nativeElement.textContent).not.toContain('Ana Luísa Ribeiro');
    expect(fixture.nativeElement.textContent).not.toContain('Sem quarto atribuído');
    fixture.componentInstance.localSearch.setValue('teste-001');
    expect(fixture.componentInstance.localFiltered()).toHaveLength(1);
    fixture.componentInstance.localSearch.setValue('outra matrícula');
    expect(fixture.componentInstance.localFiltered()).toHaveLength(0);
  });

  it('erro da API não exibe residentes da demonstração', async () => {
    api.list.mockRejectedValue(new Error('offline'));
    const fixture = TestBed.createComponent(ResidentsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar residentes');
    expect(fixture.nativeElement.textContent).not.toContain('Ana Luísa Ribeiro');
    expect(fixture.componentInstance.localResidents()).toEqual([]);
  });

  it('supervisor pode cadastrar residentes', async () => {
    role.set('supervisor');
    const fixture = TestBed.createComponent(ResidentsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Estudante Sintético');
    expect(fixture.nativeElement.textContent).toContain('Cadastrar residente');
  });

  it('detalhe local mostra responsáveis da API sem inventar idade ou autorização', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: resident.id });
    const guardians = vi.spyOn(TestBed.inject(ManagementDemoService), 'guardiansFor');
    const fixture = TestBed.createComponent(ResidentDetailComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Estudante Sintético');
    expect(fixture.nativeElement.textContent).toContain('Não informado');
    expect(fixture.nativeElement.textContent).toContain(
      'A ausência da data de nascimento não indica maioridade',
    );
    expect(fixture.nativeElement.textContent).not.toContain('anos');
    fixture.componentInstance.tab.set('responsaveis');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Responsável Sintético');
    expect(fixture.nativeElement.textContent).toContain('Telefone não informado');
    expect(fixture.nativeElement.textContent).toContain(
      'Assinatura pendente de definição institucional',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Mariana Ribeiro');
    expect(fixture.nativeElement.textContent).not.toContain('Autorizado para assinatura');
    expect(guardianApi.list).toHaveBeenCalledOnce();
    expect(guardians).not.toHaveBeenCalled();
  });

  it('falha ao consultar responsáveis não preenche vínculos demonstrativos e permite repetir', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: resident.id });
    guardianApi.list.mockRejectedValueOnce(new Error('offline'));
    const fixture = TestBed.createComponent(ResidentDetailComponent);
    await fixture.whenStable();
    fixture.componentInstance.tab.set('responsaveis');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar responsáveis');
    expect(fixture.nativeElement.textContent).not.toContain('Mariana Ribeiro');
    expect(fixture.componentInstance.localGuardians()).toEqual([]);

    await fixture.componentInstance.loadLocalGuardians();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Responsável Sintético');
    expect(fixture.componentInstance.guardiansError()).toBe(false);
  });

  it('distingue quartos de mesmo número em pisos diferentes na seleção e no histórico', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: resident.id });
    const repeatedNumbers = structuredClone(map);
    repeatedNumbers.rooms[0].floor = 'Térreo';
    repeatedNumbers.rooms[1].number = '01';
    repeatedNumbers.rooms[1].floor = '1º piso';
    roomApi.map.mockResolvedValue(repeatedNumbers);
    allocationApi.byResident.mockResolvedValue([
      structuredClone(allocation),
      {
        ...allocation,
        id: '00000000-0000-0000-0000-000000000402',
        roomId: secondRoomId,
        endedAt: '2026-09-29T13:00:00Z',
        endReason: 'TRANSFER',
        version: 1,
      },
    ]);
    const fixture = TestBed.createComponent(ResidentDetailComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const firstOption = fixture.nativeElement.querySelector(`option[value="${roomId}"]`);
    const secondOption = fixture.nativeElement.querySelector(`option[value="${secondRoomId}"]`);
    expect(firstOption.textContent).toContain('Q1');
    expect(firstOption.textContent).toContain('Térreo');
    expect(secondOption.textContent).toContain('Q2');
    expect(secondOption.textContent).toContain('1º piso');
    fixture.componentInstance.tab.set('historico');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Q1');
    expect(fixture.nativeElement.textContent).toContain('Térreo');
    expect(fixture.nativeElement.textContent).toContain('Q2');
    expect(fixture.nativeElement.textContent).toContain('1º piso');
  });

  it('aloca, transfere e encerra vínculo com versão do servidor, preservando histórico', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: resident.id });
    const fixture = TestBed.createComponent(ResidentDetailComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhum quarto ativo');
    fixture.componentInstance.selectedRoom.setValue(roomId);
    await fixture.componentInstance.saveAllocation();
    expect(allocationApi.create).toHaveBeenCalledWith(resident.id, roomId);
    allocationApi.byResident.mockResolvedValue([structuredClone(allocation)]);
    await fixture.componentInstance.loadAllocations();
    fixture.componentInstance.selectedRoom.setValue(secondRoomId);
    await fixture.componentInstance.saveAllocation();
    expect(allocationApi.transfer).toHaveBeenCalledWith(allocation.id, secondRoomId, 0);
    await fixture.componentInstance.endAllocation();
    expect(allocationApi.end).toHaveBeenCalledWith(allocation.id, 0);
  });

  it('conflito de transferência informa o motivo, atualiza dados e não mostra sucesso falso', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: resident.id });
    allocationApi.byResident.mockResolvedValue([structuredClone(allocation)]);
    allocationApi.transfer.mockRejectedValue(new AllocationApiError(409, 'room_full'));
    const fixture = TestBed.createComponent(ResidentDetailComponent);
    await fixture.whenStable();
    fixture.componentInstance.selectedRoom.setValue(secondRoomId);
    await fixture.componentInstance.saveAllocation();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('atingiu a capacidade');
    expect(fixture.componentInstance.activeAllocation()?.roomId).toBe(roomId);
  });

  it('supervisor pode transferir ou encerrar alocação', async () => {
    role.set('supervisor');
    route.snapshot.paramMap = convertToParamMap({ id: resident.id });
    allocationApi.byResident.mockResolvedValue([structuredClone(allocation)]);
    const fixture = TestBed.createComponent(ResidentDetailComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Quarto 01');
    expect(fixture.nativeElement.textContent).toContain('Transferir residente');
    expect(fixture.nativeElement.textContent).toContain('Encerrar alocação');
  });

  it('exige nascimento, preserva matrícula textual e bloqueia data futura', async () => {
    const fixture = TestBed.createComponent(ResidentFormComponent);
    const form = fixture.componentInstance.form;
    form.setValue({
      name: ' Estudante Sintético ',
      enrollment: ' TESTE-A1 ',
      birthDate: '',
      course: ' ',
    });
    await fixture.componentInstance.save();
    expect(api.save).not.toHaveBeenCalled();
    expect(form.controls.birthDate.hasError('required')).toBe(true);
    form.controls.birthDate.setValue('2009-05-14');
    await fixture.componentInstance.save();
    expect(api.save).toHaveBeenCalledWith(
      {
        name: 'Estudante Sintético',
        enrollment: 'TESTE-A1',
        birthDate: '2009-05-14',
        course: null,
      },
      undefined,
    );
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/residentes', resident.id], {
      queryParams: { saved: '1' },
    });
    api.save.mockClear();
    form.setValue({
      name: 'Pessoa Sintética',
      enrollment: 'ABC-2',
      birthDate: '2999-01-01',
      course: '',
    });
    await fixture.componentInstance.save();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('distingue duplicidade de versão obsoleta e recarrega a versão atual', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: resident.id });
    const fixture = TestBed.createComponent(ResidentFormComponent);
    await fixture.whenStable();
    fixture.componentInstance.form.controls.birthDate.setValue('2009-05-14');
    api.save.mockRejectedValueOnce(new ResidentApiError(409, 'duplicate_enrollment'));
    await fixture.componentInstance.save();
    expect(fixture.componentInstance.error()).toContain('Já existe um cadastro');
    expect(fixture.componentInstance.conflict()).toBe(false);
    api.save.mockRejectedValueOnce(new ResidentApiError(409, 'stale_version'));
    await fixture.componentInstance.save();
    expect(fixture.componentInstance.error()).toContain('alterado por outra sessão');
    expect(fixture.componentInstance.conflict()).toBe(true);
    api.get.mockResolvedValueOnce({ ...resident, name: 'Versão Atual', version: 1 });
    await fixture.componentInstance.reloadLatest();
    expect(fixture.componentInstance.form.controls.name.value).toBe('Versão Atual');
    expect(fixture.componentInstance.form.controls.birthDate.hasError('required')).toBe(true);
    fixture.componentInstance.form.controls.birthDate.setValue('2009-05-14');
    await fixture.componentInstance.save();
    expect(api.save).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Versão Atual' }), {
      id: resident.id,
      version: 1,
    });
  });

  it('não redireciona quando um salvamento termina depois de cancelar', async () => {
    let finishSave!: (value: ResidentRecord) => void;
    api.save.mockImplementation(
      () => new Promise<ResidentRecord>((resolve) => (finishSave = resolve)),
    );
    const fixture = TestBed.createComponent(ResidentFormComponent);
    fixture.componentInstance.form.setValue({
      name: 'Pessoa Sintética',
      enrollment: 'TESTE-002',
      birthDate: '2009-05-14',
      course: '',
    });
    const saving = fixture.componentInstance.save();
    expect(api.save).toHaveBeenCalledOnce();
    fixture.destroy();
    finishSave(resident);
    await saving;
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('demonstração usa exclusivamente os registros em memória', async () => {
    active.set(true);
    const fixture = TestBed.createComponent(ResidentsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ana Luísa Ribeiro');
    expect(api.list).not.toHaveBeenCalled();
  });
});
