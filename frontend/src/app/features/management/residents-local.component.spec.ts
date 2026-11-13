import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoScenario, DemoSessionService, Role } from '../../core/demo-session.service';
import { FilterState } from '../../core/filter-state';
import { civilToday } from '../../shared/field-rules';
import {
  AllocationApiError,
  AllocationApiService,
  AllocationRecord,
} from './allocation-api.service';
import { GuardianApiService, GuardianRecord } from './guardian-api.service';
import { Course, CourseApiService } from './course-api.service';
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
    page: ReturnType<typeof vi.fn>;
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
      page: vi.fn().mockImplementation((params) =>
        Promise.resolve({
          items: params.search && params.search !== 'teste-001' ? [] : [structuredClone(resident)],
          total: params.search && params.search !== 'teste-001' ? 0 : 1,
        }),
      ),
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
        {
          provide: CourseApiService,
          useValue: { list: vi.fn().mockResolvedValue([]), save: vi.fn(), demoCourses: signal([]) },
        },
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
    fixture.componentInstance.filters.controls.search.setValue('teste-001');
    await fixture.componentInstance.load();
    expect(fixture.componentInstance.visible()).toHaveLength(1);
    fixture.componentInstance.filters.controls.search.setValue('outra matrícula');
    await fixture.componentInstance.load();
    expect(fixture.componentInstance.visible()).toHaveLength(0);
  });

  it('descarta quarto lembrado que não existe mais nas opções', async () => {
    TestBed.inject(FilterState).values.set('residents', { roomId: 'quarto-removido' });
    const fixture = TestBed.createComponent(ResidentsComponent);
    await fixture.whenStable();
    expect(fixture.componentInstance.filters.controls.roomId.value).toBe('');
  });

  it('filtra por casa ou bloco no servidor, com quarto dependente e cascata', async () => {
    const unitId = 'b1';
    roomApi.map.mockResolvedValue({
      ...structuredClone(map),
      units: [{ id: unitId, accommodationId: 'a1', code: 'BA', name: 'Bloco A', version: 0 }],
      rooms: map.rooms.map((item, index) => ({ ...item, unitId: index ? null : unitId })),
    });
    const fixture = TestBed.createComponent(ResidentsComponent);
    await fixture.whenStable();
    const page = fixture.componentInstance;
    expect(page.units().map((item) => page.unitLabel(item))).toEqual([
      'Bloco A · Alojamento Sintético',
    ]);
    expect(page.rooms().map((item) => page.roomLabel(item))).toEqual(['Q1 · Bloco A', 'Q2']);
    const controls = page.filters.controls;
    controls.roomId.setValue(secondRoomId);
    controls.unitId.setValue(unitId);
    expect(controls.roomId.value).toBe('');
    expect(page.rooms().map((item) => item.id)).toEqual([roomId]);
    expect(page.applied()).toContainEqual({
      key: 'unitId',
      label: 'Casa ou bloco',
      value: 'Bloco A',
    });
    await page.load();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ unitId, limit: '25' }),
      expect.any(AbortSignal),
    );
    controls.roomId.setValue(roomId);
    controls.accommodationId.setValue('a1');
    expect(controls.unitId.value).toBe('');
    expect(controls.roomId.value).toBe('');
  });

  it('erro da API não exibe residentes da demonstração', async () => {
    api.page.mockRejectedValue(new Error('offline'));
    const fixture = TestBed.createComponent(ResidentsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar residentes');
    expect(fixture.nativeElement.textContent).not.toContain('Ana Luísa Ribeiro');
    expect(fixture.componentInstance.items()).toEqual([]);
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
      'Cada saída longa precisa da autorização do responsável, conferida por um servidor.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Mariana Ribeiro');
    expect(fixture.nativeElement.textContent).not.toContain('Pode autorizar saída longa');
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
    expect(fixture.nativeElement.textContent).toContain('Mudar de quarto');
    expect(fixture.nativeElement.textContent).toContain('Tirar do quarto');
  });

  it('exige nascimento e curso, normaliza a matrícula no servidor e bloqueia data futura', async () => {
    const fixture = TestBed.createComponent(ResidentFormComponent);
    const form = fixture.componentInstance.form;
    form.setValue({
      name: ' Estudante Sintético ',
      enrollment: ' 20261TESTEA0001 ',
      birthDate: '',
      courseId: '',
      institutionalEmail: '',
      entryYear: null,
      extraSemesters: 0,
      password: 'Senha teste 123!',
      passwordConfirmation: 'Senha teste 123!',
    });
    await fixture.componentInstance.save();
    expect(api.save).not.toHaveBeenCalled();
    expect(form.controls.birthDate.errors).toMatchObject({
      fieldRule: 'Informe a data de nascimento.',
    });
    form.controls.birthDate.setValue('2009-05-14');
    await fixture.componentInstance.save();
    expect(api.save).not.toHaveBeenCalled();
    expect(form.controls.courseId.hasError('required')).toBe(true);
    form.controls.courseId.setValue('curso-1');
    await fixture.componentInstance.save();
    expect(api.save).not.toHaveBeenCalled();
    expect(form.controls.entryYear.errors).toMatchObject({
      fieldRule: 'Informe o ano de ingresso.',
    });
    form.controls.entryYear.setValue(2026);
    await fixture.componentInstance.save();
    expect(api.save).toHaveBeenCalledWith(
      {
        name: 'Estudante Sintético',
        enrollment: '20261TESTEA0001',
        birthDate: '2009-05-14',
        courseId: 'curso-1',
        institutionalEmail: null,
        entryYear: 2026,
        extraSemesters: 0,
        password: 'Senha teste 123!',
        passwordConfirmation: 'Senha teste 123!',
      },
      undefined,
    );
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/residentes', resident.id], {
      queryParams: { saved: '1' },
    });
    api.save.mockClear();
    form.setValue({
      name: 'Pessoa Sintética',
      enrollment: '20261TESTEA0002',
      birthDate: '2999-01-01',
      courseId: 'curso-1',
      institutionalEmail: '',
      entryYear: null,
      extraSemesters: 0,
      password: 'Senha teste 123!',
      passwordConfirmation: 'Senha teste 123!',
    });
    await fixture.componentInstance.save();
    expect(api.save).not.toHaveBeenCalled();
  });

  it.each(['success', 'failure'])(
    'aguarda a criação do curso antes de salvar (%s)',
    async (result) => {
      let finish!: (value: Course) => void;
      let fail!: (error: Error) => void;
      const course = { id: 'curso-teste', name: 'Curso Sintético', active: true, version: 0 };
      const create = vi.spyOn(TestBed.inject(CourseApiService), 'save').mockReturnValue(
        new Promise<Course>((resolve, reject) => {
          finish = resolve;
          fail = reject;
        }),
      );
      const fixture = TestBed.createComponent(ResidentFormComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance;
      component.form.patchValue({
        name: 'Pessoa Sintética',
        enrollment: '20261TESTE00002',
        birthDate: '2009-05-14',
        courseId: 'curso-anterior',
        password: 'Senha teste 123!',
        passwordConfirmation: 'Senha teste 123!',
      });
      component.form.markAsDirty();
      component.newCourse.setValue(course.name);
      const creating = component.createCourse();
      fixture.detectChanges();
      const submit: HTMLButtonElement =
        fixture.nativeElement.querySelector('button[type="submit"]');
      expect(component.form.valid).toBe(true);
      expect(submit.disabled).toBe(true);
      await component.save();
      fixture.nativeElement
        .querySelector('form')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      expect(api.save).not.toHaveBeenCalled();
      expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
      if (result === 'success') finish(course);
      else fail(new Error('Falha sintética do curso'));
      await creating;
      fixture.detectChanges();
      expect(submit.disabled).toBe(false);
      expect(component.form.controls.name.value).toBe('Pessoa Sintética');
      expect(component.form.dirty).toBe(true);
      expect(api.save).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledOnce();
      if (result === 'success') expect(component.form.controls.courseId.value).toBe(course.id);
      else {
        expect(component.coursesError()).toBe('Falha sintética do curso');
        expect(component.newCourse.value).toBe(course.name);
        expect(component.form.controls.courseId.value).toBe('curso-anterior');
      }
      await component.save();
      expect(api.save).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ courseId: result === 'success' ? course.id : 'curso-anterior' }),
        undefined,
      );
    },
  );

  it.each([
    { edit: false, result: 'success' },
    { edit: false, result: 'failure' },
    { edit: true, result: 'success' },
    { edit: true, result: 'failure' },
  ])(
    'não cria curso enquanto o residente está sendo salvo (edição=$edit, $result)',
    async ({ edit, result }) => {
      if (edit) route.snapshot.paramMap = convertToParamMap({ id: resident.id });
      let finish!: (value: ResidentRecord) => void;
      let fail!: (error: Error) => void;
      api.save.mockReturnValueOnce(
        new Promise<ResidentRecord>((resolve, reject) => {
          finish = resolve;
          fail = reject;
        }),
      );
      const courses = TestBed.inject(CourseApiService);
      const fixture = TestBed.createComponent(ResidentFormComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance;
      component.form.patchValue({
        name: 'Pessoa Sintética',
        enrollment: '20261TESTE00002',
        birthDate: '2009-05-14',
        courseId: 'curso-anterior',
        password: 'Senha teste 123!',
        passwordConfirmation: 'Senha teste 123!',
      });
      component.addingCourse.set(true);
      component.newCourse.setValue('Curso Sintético');
      const saving = component.save();
      fixture.detectChanges();
      const create: HTMLButtonElement = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((button) => button.textContent?.includes('Cadastrar e selecionar'))!;
      const disabled = create.disabled;
      await component.createCourse();
      expect(courses.save).not.toHaveBeenCalled();
      expect(disabled).toBe(true);
      expect(component.form.controls.courseId.value).toBe('curso-anterior');
      expect(component.newCourse.value).toBe('Curso Sintético');
      expect(api.save).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ courseId: 'curso-anterior' }),
        edit ? { id: resident.id, version: resident.version } : undefined,
      );
      if (result === 'success') finish(resident);
      else fail(new Error('Falha sintética do residente'));
      await saving;
      fixture.detectChanges();
      if (result === 'success') {
        expect(TestBed.inject(Router).navigate).toHaveBeenCalledOnce();
      } else {
        expect(component.form.dirty).toBe(true);
        expect(create.disabled).toBe(false);
        expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
        vi.mocked(courses.save).mockResolvedValueOnce({
          id: 'curso-teste',
          name: 'Curso Sintético',
          active: true,
          version: 0,
        });
        await component.createCourse();
        expect(component.form.controls.courseId.value).toBe('curso-teste');
      }
    },
  );

  it('distingue duplicidade de versão obsoleta e recarrega a versão atual', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: resident.id });
    const fixture = TestBed.createComponent(ResidentFormComponent);
    await fixture.whenStable();
    fixture.componentInstance.form.controls.birthDate.setValue('2009-05-14');
    fixture.componentInstance.form.controls.courseId.setValue('curso-1');
    fixture.componentInstance.form.controls.entryYear.setValue(2026);
    api.save.mockRejectedValueOnce(new ResidentApiError(409, 'duplicate_enrollment'));
    await fixture.componentInstance.save();
    expect(fixture.componentInstance.error()).toContain('Já existe um cadastro');
    expect(fixture.componentInstance.conflict()).toBe(false);
    api.save.mockRejectedValueOnce(new ResidentApiError(409, 'stale_version'));
    await fixture.componentInstance.save();
    expect(fixture.componentInstance.error()).toContain('Outra pessoa alterou este registro');
    expect(fixture.componentInstance.conflict()).toBe(true);
    api.get.mockResolvedValueOnce({ ...resident, name: 'Versão Atual', version: 1 });
    await fixture.componentInstance.reloadLatest();
    expect(fixture.componentInstance.form.controls.name.value).toBe('Versão Atual');
    expect(fixture.componentInstance.form.controls.birthDate.errors).toMatchObject({
      fieldRule: 'Informe a data de nascimento.',
    });
    fixture.componentInstance.form.controls.birthDate.setValue('2009-05-14');
    fixture.componentInstance.form.controls.courseId.setValue('curso-1');
    fixture.componentInstance.form.controls.entryYear.setValue(2026);
    await fixture.componentInstance.save();
    expect(api.save).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Versão Atual' }), {
      id: resident.id,
      version: 1,
    });
  });

  it('cadastro antigo edita sem corrigir o que não mudou, mas precisa do curso', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: resident.id });
    api.get.mockResolvedValue({
      ...resident,
      name: 'Maria',
      enrollment: 'SAGER-QA-2026-001',
      birthDate: '1900-01-01',
      institutionalEmail: 'maria@gmail.com',
    });
    const fixture = TestBed.createComponent(ResidentFormComponent);
    await fixture.whenStable();
    const form = fixture.componentInstance.form;
    await fixture.componentInstance.save();
    expect(api.save).not.toHaveBeenCalled();
    expect(form.controls.courseId.hasError('required')).toBe(true);
    expect(form.controls.name.valid && form.controls.enrollment.valid).toBe(true);
    expect(form.controls.birthDate.valid && form.controls.institutionalEmail.valid).toBe(true);
    form.controls.courseId.setValue('curso-1');
    await fixture.componentInstance.save();
    expect(api.save).not.toHaveBeenCalled();
    expect(form.controls.entryYear.errors).toEqual({ fieldRule: 'Informe o ano de ingresso.' });
    form.controls.entryYear.setValue(2026);
    await fixture.componentInstance.save();
    expect(api.save).toHaveBeenCalledOnce();
    form.controls.enrollment.setValue('SAGER-QA-2026-002');
    expect(form.controls.enrollment.errors).toEqual({ fieldRule: 'Confira a matrícula no SUAP.' });
  });

  it('valida ano de ingresso e prorrogação e envia os dois ao servidor', async () => {
    const fixture = TestBed.createComponent(ResidentFormComponent);
    await fixture.whenStable();
    const native = fixture.nativeElement as HTMLElement;
    const form = fixture.componentInstance.form;
    const next = Number(civilToday().slice(0, 4)) + 1;
    expect(native.querySelector('#resident-extra-semesters-help')!.textContent).toBe(
      'Cada semestre adiciona 6 meses à previsão de formatura.',
    );
    form.setValue({
      name: 'Pessoa Sintética',
      enrollment: '20261TESTE00003',
      birthDate: '2009-05-14',
      courseId: 'curso-1',
      institutionalEmail: '',
      entryYear: 1989,
      extraSemesters: 11,
      password: 'Senha teste 123!',
      passwordConfirmation: 'Senha teste 123!',
    });
    await fixture.componentInstance.save();
    fixture.detectChanges();
    expect(api.save).not.toHaveBeenCalled();
    expect(native.querySelector('#resident-entry-year-error')!.textContent).toBe(
      `Informe um ano de 1990 a ${next}.`,
    );
    expect(native.querySelector('#resident-extra-semesters-error')!.textContent).toBe(
      'Use um número de 0 a 10.',
    );
    form.controls.entryYear.setValue(next + 1);
    expect(form.controls.entryYear.valid).toBe(false);
    form.controls.entryYear.setValue(next);
    form.controls.extraSemesters.setValue(2);
    await fixture.componentInstance.save();
    expect(api.save).toHaveBeenCalledWith(
      expect.objectContaining({ entryYear: next, extraSemesters: 2 }),
      undefined,
    );
  });

  it('sugere o ano de ingresso pela matrícula sem trocar o ano já informado', async () => {
    const fixture = TestBed.createComponent(ResidentFormComponent);
    await fixture.whenStable();
    const form = fixture.componentInstance.form;
    form.controls.enrollment.setValue('20251ABCD000123');
    expect(form.controls.entryYear.value).toBe(2025);
    form.controls.entryYear.setValue(2024);
    form.controls.enrollment.setValue('20261ABCD000123');
    expect(form.controls.entryYear.value).toBe(2024);
  });

  it('cadastro antigo sem ano abre com o ano sugerido pela matrícula', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: resident.id });
    api.get.mockResolvedValue({
      ...resident,
      enrollment: '20241ABCD000123',
      birthDate: '2009-05-14',
      courseId: 'curso-1',
    });
    const fixture = TestBed.createComponent(ResidentFormComponent);
    await fixture.whenStable();
    const form = fixture.componentInstance.form;
    expect(form.controls.entryYear.value).toBe(2024);
    await fixture.componentInstance.save();
    expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ entryYear: 2024 }), {
      id: resident.id,
      version: 0,
    });
  });

  it('ano de ingresso antigo fora da regra continua editável se não mudar', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: resident.id });
    api.get.mockResolvedValue({
      ...resident,
      birthDate: '2009-05-14',
      courseId: 'curso-1',
      entryYear: 2100,
      extraSemesters: 3,
    });
    const fixture = TestBed.createComponent(ResidentFormComponent);
    await fixture.whenStable();
    const form = fixture.componentInstance.form;
    expect(form.controls.entryYear.value).toBe(2100);
    expect(form.controls.extraSemesters.value).toBe(3);
    await fixture.componentInstance.save();
    expect(api.save).toHaveBeenCalledWith(
      expect.objectContaining({ entryYear: 2100, extraSemesters: 3 }),
      { id: resident.id, version: 0 },
    );
    form.controls.entryYear.setValue(2099);
    expect(form.controls.entryYear.valid).toBe(false);
  });

  it('detalhe local mostra etapa e previsão de formatura com o curso da API', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: resident.id });
    api.get.mockResolvedValue({
      ...resident,
      courseId: 'curso-1',
      course: 'Sistemas Sintéticos',
      entryYear: 2026,
      extraSemesters: 1,
    });
    vi.mocked(TestBed.inject(CourseApiService).list).mockResolvedValue([
      {
        id: 'curso-1',
        name: 'Sistemas Sintéticos',
        active: true,
        version: 0,
        level: 'SUPERIOR',
        durationYears: 4,
      },
    ]);
    const fixture = TestBed.createComponent(ResidentDetailComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('prorrogação de 1 semestre');
    expect(text).toContain('2030/1');
    expect(text).toMatch(/º período|Ingressa em 2026/);
    expect(text).not.toContain('Sem dados para calcular');
  });

  it('não redireciona quando um salvamento termina depois de cancelar', async () => {
    let finishSave!: (value: ResidentRecord) => void;
    api.save.mockImplementation(
      () => new Promise<ResidentRecord>((resolve) => (finishSave = resolve)),
    );
    const fixture = TestBed.createComponent(ResidentFormComponent);
    fixture.componentInstance.form.setValue({
      name: 'Pessoa Sintética',
      enrollment: '20261TESTE00002',
      birthDate: '2009-05-14',
      courseId: 'curso-1',
      institutionalEmail: '',
      entryYear: 2026,
      extraSemesters: 0,
      password: 'Senha teste 123!',
      passwordConfirmation: 'Senha teste 123!',
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
