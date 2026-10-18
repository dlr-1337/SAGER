import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoScenario, DemoSessionService, Role } from '../../core/demo-session.service';
import { FilterState } from '../../core/filter-state';
import { AllocationApiService } from './allocation-api.service';
import { HousingMap, RoomRecord } from './housing.models';
import { ManagementDemoService } from './management-demo.service';
import { RoomApiError, RoomApiService } from './room-api.service';
import { ResidentApiService } from './resident-api.service';
import { RoomDetailComponent } from './room-detail.component';
import { RoomFormComponent } from './room-form.component';
import { RoomsComponent } from './rooms.component';

const room: RoomRecord = {
  id: 'quarto-1',
  code: 'TESTE-Q01',
  number: '01',
  accommodationId: 'alojamento-1',
  unitId: 'unidade-1',
  floor: null,
  capacity: null,
  situation: 'Disponível',
  occupancy: 0,
  vacancies: null,
  cleaningScore: null,
  version: 0,
};
const map: HousingMap = {
  accommodations: [
    { id: 'alojamento-1', code: 'TESTE-A1', name: 'Alojamento Fictício', version: 0 },
  ],
  units: [
    {
      id: 'unidade-1',
      accommodationId: 'alojamento-1',
      code: 'TESTE-U1',
      name: 'Casa Fictícia',
      version: 0,
    },
  ],
  rooms: [
    room,
    {
      ...room,
      id: 'quarto-2',
      code: 'TESTE-Q02',
      number: '02',
      capacity: 4,
      vacancies: 4,
      unitId: null,
    },
  ],
};

describe('Quartos em sessão local', () => {
  const active = signal(false);
  const role = signal<Role>('gestor');
  const scenario = signal<DemoScenario>('padrao');
  const route = {
    snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) },
  };
  let api: {
    map: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let allocationApi: { activeInRoom: ReturnType<typeof vi.fn> };
  let residentApi: { list: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    active.set(false);
    role.set('gestor');
    scenario.set('padrao');
    route.snapshot.paramMap = convertToParamMap({});
    route.snapshot.queryParamMap = convertToParamMap({});
    api = {
      map: vi.fn().mockResolvedValue(structuredClone(map)),
      get: vi.fn().mockResolvedValue(structuredClone(room)),
      save: vi.fn().mockResolvedValue(structuredClone(room)),
    };
    allocationApi = { activeInRoom: vi.fn().mockResolvedValue([]) };
    residentApi = { list: vi.fn().mockResolvedValue([]) };
    await TestBed.configureTestingModule({
      imports: [RoomsComponent, RoomFormComponent, RoomDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: RoomApiService, useValue: api },
        { provide: AllocationApiService, useValue: allocationApi },
        { provide: ResidentApiService, useValue: residentApi },
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

  it('mostra soma parcial, capacidade ausente e métricas sem dados inventados', async () => {
    const fixture = TestBed.createComponent(RoomsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('soma parcial; 1 quarto sem capacidade');
    expect(text).toContain('Capacidade não definida');
    expect(text).toContain('0 moradores');
    expect(text).toContain('4 vagas livres');
    expect(text).toContain('Sem avaliação');
    expect(text).not.toContain('Bloco A');
    expect(fixture.componentInstance.groups()).toHaveLength(2);
    expect(fixture.componentInstance.totals()).toEqual({
      known: 1,
      missing: 1,
      capacity: 4,
      people: 0,
      vacancies: 4,
    });
    fixture.componentInstance.filters.controls.unitId.setValue('unidade-1');
    expect(fixture.componentInstance.filteredRooms().map((item) => item.id)).toEqual(['quarto-1']);
    // Sem nenhum quarto com capacidade não há soma, nem parcial.
    expect(fixture.componentInstance.totals()).toMatchObject({ known: 0, missing: 1 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('soma parcial');
    expect(fixture.nativeElement.textContent).toContain('Não definida');
    fixture.componentInstance.filters.controls.occupancy.setValue('with-vacancies');
    expect(fixture.componentInstance.filteredRooms()).toHaveLength(0);
    fixture.componentInstance.clearFilters();
    fixture.componentInstance.filters.controls.occupancy.setValue('with-vacancies');
    expect(fixture.componentInstance.filteredRooms().map((item) => item.id)).toEqual(['quarto-2']);
  });

  it.each([
    { total: 25, initialPage: 1, expectedPage: 0 },
    { total: 0, initialPage: 1, expectedPage: 0 },
    { total: 26, initialPage: 1, expectedPage: 1 },
    { total: 55, initialPage: 4, expectedPage: 2 },
  ])(
    'limita a página restaurada $initialPage aos $total quartos filtrados',
    async ({ total, initialPage, expectedPage }) => {
      const records = Array.from({ length: total }, (_, index) => ({
        ...room,
        id: `quarto-${index + 1}`,
        code: `TESTE-Q${index + 1}`,
        number: String(index + 1),
      }));
      api.map.mockResolvedValue({
        ...map,
        rooms: [...records, { ...room, id: 'outro', situation: 'Manutenção' }],
      });
      const memory = TestBed.inject(FilterState);
      const filters = {
        search: 'TESTE-Q',
        block: '',
        accommodationId: room.accommodationId,
        unitId: room.unitId,
        floor: '',
        situation: 'Disponível',
        occupancy: 'unknown',
      };
      memory.values.set('rooms', filters);
      memory.values.set('rooms.component.ts-page', initialPage);
      const fixture = TestBed.createComponent(RoomsComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance;
      expect(component.filteredRooms()).toHaveLength(total);
      expect(component.page()).toBe(expectedPage);
      expect(component.groups().flatMap((group) => group.rooms.map((item) => item.id))).toEqual(
        records.slice(expectedPage * 25, (expectedPage + 1) * 25).map((item) => item.id),
      );
      expect(component.filters.getRawValue()).toEqual(filters);
      expect(memory.values.get('rooms.component.ts-page')).toBe(expectedPage);
      expect(api.map).toHaveBeenCalledOnce();
      if (total === 25) expect(fixture.nativeElement.textContent).toContain('1–25 de 25');
    },
  );

  it('falha de backend nunca preenche o mapa com registros demonstrativos', async () => {
    api.map.mockRejectedValue(new Error('offline'));
    const fixture = TestBed.createComponent(RoomsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar os quartos');
    expect(fixture.nativeElement.querySelectorAll('.mg-room-tile')).toHaveLength(0);
    expect(fixture.componentInstance.rooms()).toEqual([]);
  });

  it('demonstração mantém quartos e vínculos sem consultar API', async () => {
    active.set(true);
    route.snapshot.paramMap = convertToParamMap({ id: 'q-102' });
    const fixture = TestBed.createComponent(RoomDetailComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ana Luísa Ribeiro');
    expect(api.get).not.toHaveBeenCalled();
    expect(api.map).not.toHaveBeenCalled();
  });

  it('detalhe local não consulta ou mostra moradores fictícios da demonstração', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: room.id });
    const residents = vi.spyOn(TestBed.inject(ManagementDemoService), 'residentsInRoom');
    const fixture = TestBed.createComponent(RoomDetailComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Alojamento Fictício');
    expect(fixture.nativeElement.textContent).toContain('Casa Fictícia');
    expect(fixture.nativeElement.textContent).toContain('Capacidade não definida');
    expect(fixture.nativeElement.textContent).not.toContain('Ana Luísa Ribeiro');
    expect(residents).not.toHaveBeenCalled();
  });

  it('detalhe local mostra moradores vinculados pela API', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: room.id });
    const residentId = '00000000-0000-0000-0000-000000000041';
    allocationApi.activeInRoom.mockResolvedValue([
      {
        id: 'alocacao-1',
        residentId,
        roomId: room.id,
        startedAt: '2026-09-29T12:00:00Z',
        endedAt: null,
        endReason: null,
        version: 0,
      },
    ]);
    residentApi.list.mockResolvedValue([
      {
        id: residentId,
        name: 'Morador Sintético',
        enrollment: 'TESTE-01',
        birthDate: null,
        course: null,
        version: 0,
      },
    ]);
    const fixture = TestBed.createComponent(RoomDetailComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Morador Sintético');
    expect(allocationApi.activeInRoom).toHaveBeenCalledWith(room.id);
  });

  it('detalhe e edição usam o quarto e a unidade do mesmo mapa, incluindo a versão', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: room.id });
    const movedRoom: RoomRecord = {
      ...room,
      unitId: 'unidade-2',
      capacity: 6,
      vacancies: 6,
      version: 1,
    };
    api.map.mockResolvedValue({
      ...structuredClone(map),
      units: [
        ...structuredClone(map.units),
        {
          id: 'unidade-2',
          accommodationId: room.accommodationId,
          code: 'TESTE-U2',
          name: 'Nova Casa Fictícia',
          version: 0,
        },
      ],
      rooms: [movedRoom],
    });
    api.get.mockResolvedValue({ ...room, version: 0 });

    const detail = TestBed.createComponent(RoomDetailComponent);
    await detail.whenStable();
    detail.detectChanges();
    expect(detail.componentInstance.localRoom()).toEqual(movedRoom);
    expect(detail.nativeElement.textContent).toContain('Nova Casa Fictícia');

    const form = TestBed.createComponent(RoomFormComponent);
    await form.whenStable();
    form.detectChanges();
    expect(form.componentInstance.localRoom()).toEqual(movedRoom);
    expect(form.componentInstance.localForm.controls.unitId.value).toBe('unidade-2');
    expect(form.componentInstance.localForm.controls.capacity.value).toBe(6);
    await form.componentInstance.save();
    expect(api.save).toHaveBeenCalledWith(
      expect.objectContaining({ unitId: 'unidade-2', capacity: 6 }),
      { id: room.id, version: 1 },
    );
    expect(api.get).not.toHaveBeenCalled();
  });

  it('supervisor acessa mapa e formulário de quarto', async () => {
    role.set('supervisor');
    const fixture = TestBed.createComponent(RoomsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cadastrar quarto');
    expect(fixture.nativeElement.textContent).toContain('Gerenciar alojamentos');
    const form = TestBed.createComponent(RoomFormComponent);
    await form.whenStable();
    form.detectChanges();
    expect(form.nativeElement.textContent).toContain('Cadastrar quarto');
  });

  it('preserva zeros iniciais e nulos, recusando capacidades fracionárias e zero', async () => {
    const fixture = TestBed.createComponent(RoomFormComponent);
    await fixture.whenStable();
    fixture.componentInstance.localForm.setValue({
      code: '  TESTE-Q01  ',
      number: '01',
      accommodationId: 'alojamento-1',
      unitId: '',
      floor: '',
      capacity: 0,
      situation: 'Disponível',
    });
    await fixture.componentInstance.save();
    expect(api.save).not.toHaveBeenCalled();
    fixture.componentInstance.localForm.controls.capacity.setValue(1.5);
    await fixture.componentInstance.save();
    expect(api.save).not.toHaveBeenCalled();
    fixture.componentInstance.localForm.controls.capacity.setValue(null);
    await fixture.componentInstance.save();
    expect(api.save).toHaveBeenCalledWith(
      {
        code: 'TESTE-Q01',
        number: '01',
        accommodationId: 'alojamento-1',
        unitId: null,
        floor: null,
        capacity: null,
        situation: 'Disponível',
      },
      undefined,
    );
  });

  it('conflito preserva edição até o usuário carregar a versão atual', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: room.id });
    const fixture = TestBed.createComponent(RoomFormComponent);
    await fixture.whenStable();
    fixture.componentInstance.localForm.controls.capacity.setValue(8);
    api.save.mockRejectedValue(new RoomApiError(409, 'stale_version'));
    await fixture.componentInstance.save();
    expect(fixture.componentInstance.localForm.controls.capacity.value).toBe(8);
    expect(fixture.componentInstance.conflict()).toBe(true);
    expect(fixture.componentInstance.localRoom()?.version).toBe(0);
    api.map.mockResolvedValue({
      ...structuredClone(map),
      rooms: [{ ...room, version: 1, capacity: 6, vacancies: 6 }],
    });
    await fixture.componentInstance.reloadLatest();
    expect(fixture.componentInstance.localForm.controls.capacity.value).toBe(6);
    expect(fixture.componentInstance.localRoom()?.version).toBe(1);
    expect(fixture.componentInstance.conflict()).toBe(false);
  });

  it('falha ao carregar versão atual conserva os campos e a versão anterior', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: room.id });
    const fixture = TestBed.createComponent(RoomFormComponent);
    await fixture.whenStable();
    fixture.componentInstance.localForm.controls.capacity.setValue(8);
    api.map.mockRejectedValue(new Error('offline'));
    await fixture.componentInstance.reloadLatest();
    expect(fixture.componentInstance.localForm.controls.capacity.value).toBe(8);
    expect(fixture.componentInstance.localRoom()?.version).toBe(0);
    expect(fixture.componentInstance.error()).toContain('preservadas');
    expect(fixture.componentInstance.loadError()).toBe('');
  });

  it.each([
    ['duplicate_code', 'código global'],
    ['duplicate_location', 'mesma localização'],
    ['invalid_location', 'localização foi recusada'],
  ])('erro %s é específico e não provoca navegação de sucesso', async (code, message) => {
    const fixture = TestBed.createComponent(RoomFormComponent);
    await fixture.whenStable();
    fixture.componentInstance.localForm.setValue({
      code: 'Q01',
      number: '01',
      accommodationId: 'alojamento-1',
      unitId: '',
      floor: '',
      capacity: null,
      situation: 'Disponível',
    });
    api.save.mockRejectedValue(new RoomApiError(409, code));
    await fixture.componentInstance.save();
    expect(fixture.componentInstance.error()).toContain(message);
    expect(fixture.componentInstance.conflict()).toBe(false);
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('não declara sucesso ao reduzir capacidade abaixo da ocupação ativa', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: room.id });
    const fixture = TestBed.createComponent(RoomFormComponent);
    await fixture.whenStable();
    api.save.mockRejectedValue(new RoomApiError(409, 'capacity_below_occupancy'));
    fixture.componentInstance.localForm.controls.capacity.setValue(1);
    await fixture.componentInstance.save();
    expect(fixture.componentInstance.error()).toContain('moradores ativos');
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('não redireciona quando um salvamento pendente termina após sair do formulário', async () => {
    const fixture = TestBed.createComponent(RoomFormComponent);
    await fixture.whenStable();
    fixture.componentInstance.localForm.setValue({
      code: 'TESTE-Q03',
      number: '03',
      accommodationId: room.accommodationId,
      unitId: '',
      floor: '',
      capacity: null,
      situation: 'Disponível',
    });
    let resolveSave!: (value: RoomRecord) => void;
    api.save.mockImplementation(
      () => new Promise<RoomRecord>((resolve) => (resolveSave = resolve)),
    );
    const saving = fixture.componentInstance.save();
    expect(api.save).toHaveBeenCalledOnce();
    fixture.destroy();
    resolveSave({ ...room, id: 'quarto-3', code: 'TESTE-Q03', number: '03' });
    await saving;
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404])(
    'detalhe com status %s mostra erro sem cadastro demonstrativo',
    async (status) => {
      route.snapshot.paramMap = convertToParamMap({ id: room.id });
      if (status === 404) {
        api.map.mockResolvedValue({ ...structuredClone(map), rooms: [] });
      } else {
        api.map.mockRejectedValue(new RoomApiError(status));
      }
      const fixture = TestBed.createComponent(RoomDetailComponent);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
      expect(fixture.componentInstance.localRoom()).toBeNull();
      expect(fixture.componentInstance.sessionRequired()).toBe(status !== 404);
      expect(fixture.componentInstance.missing()).toBe(status === 404);
    },
  );
});
