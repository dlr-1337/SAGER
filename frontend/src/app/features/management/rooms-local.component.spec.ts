import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoScenario, DemoSessionService, Role } from '../../core/demo-session.service';
import { HousingMap, RoomRecord } from './housing.models';
import { ManagementDemoService } from './management-demo.service';
import { RoomApiError, RoomApiService } from './room-api.service';
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
  occupancy: null,
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
    { ...room, id: 'quarto-2', code: 'TESTE-Q02', number: '02', capacity: 4, unitId: null },
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
    await TestBed.configureTestingModule({
      imports: [RoomsComponent, RoomFormComponent, RoomDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: RoomApiService, useValue: api },
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
    expect(text).toContain('Ocupação ainda não integrada');
    expect(text).toContain('Sem avaliação');
    expect(text).not.toContain('Bloco A');
    expect(fixture.componentInstance.groups()).toHaveLength(2);
    fixture.componentInstance.filters.controls.unitId.setValue('unidade-1');
    expect(fixture.componentInstance.filteredRooms().map((item) => item.id)).toEqual(['quarto-1']);
  });

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

  it('supervisor consulta mapa sem ações de edição e formulário nega acesso', async () => {
    role.set('supervisor');
    const fixture = TestBed.createComponent(RoomsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Cadastrar quarto');
    expect(fixture.nativeElement.textContent).not.toContain('Gerenciar alojamentos');
    expect(fixture.nativeElement.textContent).toContain('Consultar alojamentos');
    const form = TestBed.createComponent(RoomFormComponent);
    form.detectChanges();
    expect(form.nativeElement.textContent).toContain('Acesso restrito');
    await form.componentInstance.save();
    expect(api.save).not.toHaveBeenCalled();
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
    api.get.mockResolvedValue({ ...room, version: 1, capacity: 6 });
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
    api.get.mockRejectedValue(new Error('offline'));
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

  it.each([401, 403, 404])(
    'detalhe com status %s mostra erro sem cadastro demonstrativo',
    async (status) => {
      route.snapshot.paramMap = convertToParamMap({ id: room.id });
      api.get.mockRejectedValue(new RoomApiError(status));
      const fixture = TestBed.createComponent(RoomDetailComponent);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
      expect(fixture.componentInstance.localRoom()).toBeNull();
      expect(fixture.componentInstance.sessionRequired()).toBe(status !== 404);
    },
  );
});
