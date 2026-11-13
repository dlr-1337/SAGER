import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoScenario, DemoSessionService, Role } from '../../core/demo-session.service';
import { FilterState } from '../../core/filter-state';
import { AllocationApiService } from './allocation-api.service';
import { HousingMap, RoomRecord, sortHousingMap } from './housing.models';
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
    save: ReturnType<typeof vi.fn>;
  };
  let allocationApi: { activeInRoom: ReturnType<typeof vi.fn> };
  let residentApi: { page: ReturnType<typeof vi.fn> };
  const occupants = (items: unknown[]) =>
    residentApi.page.mockResolvedValue({ items, total: items.length });

  beforeEach(async () => {
    active.set(false);
    role.set('gestor');
    scenario.set('padrao');
    route.snapshot.paramMap = convertToParamMap({});
    route.snapshot.queryParamMap = convertToParamMap({});
    api = {
      map: vi.fn().mockResolvedValue(structuredClone(map)),
      save: vi.fn().mockResolvedValue(structuredClone(room)),
    };
    allocationApi = { activeInRoom: vi.fn().mockResolvedValue([]) };
    residentApi = { page: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
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
    fixture.componentInstance.filters.controls.search.setValue('TESTE-Q');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('soma parcial; 1 quarto sem capacidade');
    expect(text).toContain('Capacidade não definida');
    expect(text).toContain('0 moradores');
    expect(text).toContain('4 vagas livres');
    expect(text).not.toContain('Sem avaliação');
    expect(text).not.toContain('Bloco A');
    expect(fixture.componentInstance.groups()).toHaveLength(2);
    expect(fixture.componentInstance.totals()).toEqual({
      known: 1,
      missing: 1,
      capacity: 4,
      people: 0,
      vacancies: 4,
    });
    const component = fixture.componentInstance;
    component.clearFilters();
    component.open('alojamento-1');
    component.open('unidade-1');
    expect(component.filteredRooms().map((item) => item.id)).toEqual(['quarto-1']);
    // Sem nenhum quarto com capacidade não há soma, nem parcial.
    expect(component.totals()).toMatchObject({ known: 0, missing: 1 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('soma parcial');
    expect(fixture.nativeElement.textContent).toContain('Não definida');
    component.filters.controls.vacancies.setValue(true);
    expect(component.filteredRooms()).toHaveLength(0);
    component.clearFilters();
    expect(component.filteredRooms().map((item) => item.id)).toEqual(['quarto-1']);
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
        vacancies: false,
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
      if (total === 25)
        expect(fixture.nativeElement.querySelector('sager-pagination nav')).toBeNull();
    },
  );

  it('grade segue a ordem natural do mapa: alojamento pelo nome e quarto 2 antes do 10', async () => {
    // O serviço real ordena o mapa; aqui ele chega já ordenado, como o RoomApiService entrega.
    const first = { id: 'z-alojamento', code: 'TESTE-AA', name: 'Alojamento Alfa', version: 0 };
    const second = { id: 'a-alojamento', code: 'TESTE-AB', name: 'Alojamento Beta', version: 0 };
    const at = (id: string, accommodationId: string, number: string) => ({
      ...room,
      id,
      code: `TESTE-${id}`,
      number,
      accommodationId,
      unitId: null,
    });
    api.map.mockResolvedValue(
      sortHousingMap({
        accommodations: [second, first],
        units: [],
        rooms: [
          at('beta-1', second.id, '1'),
          at('alfa-10', first.id, '10'),
          at('alfa-2', first.id, '2'),
        ],
      }),
    );
    const fixture = TestBed.createComponent(RoomsComponent);
    await fixture.whenStable();
    fixture.componentInstance.filters.controls.search.setValue('TESTE-');
    const groups = fixture.componentInstance.groups();
    expect(groups.map((group) => group.name)).toEqual(['Alojamento Alfa', 'Alojamento Beta']);
    expect(groups[0].rooms.map((item) => item.number)).toEqual(['2', '10']);
  });

  const place = (id: string, name: string) => ({ id, code: `TESTE-${id}`, name, version: 0 });
  const house = (id: string, name: string, accommodationId: string) => ({
    ...place(id, name),
    accommodationId,
  });
  const at = (
    id: string,
    accommodationId: string,
    unitId: string | null,
    extra: Partial<RoomRecord> = {},
  ): RoomRecord => ({
    ...room,
    id,
    code: `TESTE-${id}`,
    number: id.split('-').at(-1)!,
    accommodationId,
    unitId,
    capacity: 2,
    vacancies: 2,
    ...extra,
  });
  // Texto visível, sem ícones nem separadores decorativos.
  const text = (fixture: { nativeElement: HTMLElement }, selector: string) =>
    [...fixture.nativeElement.querySelectorAll(selector)].map((item) => {
      const copy = item.cloneNode(true) as HTMLElement;
      copy
        .querySelectorAll('.material-symbols-rounded, [aria-hidden="true"]')
        .forEach((hidden) => hidden.remove());
      return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
    });
  async function shown(housing: HousingMap) {
    api.map.mockResolvedValue(sortHousingMap(housing));
    const fixture = TestBed.createComponent(RoomsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  async function choose(fixture: Awaited<ReturnType<typeof shown>>, name: string) {
    const card = [...fixture.nativeElement.querySelectorAll('button.mg-place-tile')].find(
      (item) => (item as HTMLElement).querySelector('strong')?.textContent?.trim() === name,
    ) as HTMLButtonElement;
    card.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('níveis do mapa', () => {
    const village: HousingMap = {
      accommodations: [
        place('vila', 'Vila Estudantil'),
        place('direta', 'Residência Direta'),
        place('vazia', 'Residência Vazia'),
      ],
      units: Array.from({ length: 10 }, (_, index) =>
        house(`casa-${index + 1}`, `Casa ${index + 1}`, 'vila'),
      ),
      rooms: [
        ...Array.from({ length: 30 }, (_, index) =>
          at(
            `c${Math.floor(index / 3) + 1}-${(index % 3) + 1}`,
            'vila',
            `casa-${Math.floor(index / 3) + 1}`,
          ),
        ),
        at('fora-99', 'vila', null),
        at('direta-1', 'direta', null),
        at('direta-2', 'direta', null),
      ],
    };

    it('abre com um cartão por alojamento, em ordem natural e sem quartos', async () => {
      const fixture = await shown(village);
      expect(text(fixture, 'button.mg-place-tile strong')).toEqual([
        'Residência Direta',
        'Residência Vazia',
        'Vila Estudantil',
      ]);
      expect(fixture.nativeElement.querySelectorAll('.mg-room-tile')).toHaveLength(0);
      expect(fixture.nativeElement.textContent).toContain('3 alojamentos');
      expect(text(fixture, 'button.mg-place-tile .mg-room-meta')[2]).toBe(
        '31 quartos · 62 vagas livres',
      );
      const labels = text(fixture, 'sager-filter-panel label');
      expect(labels.some((item) => /^(Alojamento|Casa ou bloco|Ocupação)/.test(item))).toBe(false);
    });

    it('vaga de quarto em manutenção ou indisponível não conta no cartão', async () => {
      const fixture = await shown({
        accommodations: [place('r', 'Residência')],
        units: [],
        rooms: [
          at('r-1', 'r', null),
          at('r-2', 'r', null, { situation: 'Manutenção', capacity: 3, vacancies: 3 }),
          at('r-3', 'r', null, { situation: 'Indisponível', capacity: 1, vacancies: 1 }),
        ],
      });
      expect(text(fixture, 'button.mg-place-tile .mg-room-meta')).toEqual([
        '3 quartos · 2 vagas livres',
      ]);
    });

    it('alojamento com casas mostra as casas em ordem e o quarto fora de casa abaixo', async () => {
      const fixture = await shown(village);
      await choose(fixture, 'Vila Estudantil');
      expect(text(fixture, 'button.mg-place-tile strong')).toEqual(
        Array.from({ length: 10 }, (_, index) => `Casa ${index + 1}`),
      );
      expect(text(fixture, 'button.mg-place-tile .mg-room-meta')[2]).toBe(
        '3 quartos · 6 vagas livres',
      );
      expect(fixture.nativeElement.textContent).toContain('Quartos fora de casa ou bloco');
      expect(fixture.nativeElement.querySelectorAll('.mg-room-tile')).toHaveLength(1);
      expect(text(fixture, '.mg-room-tile strong')).toEqual(['Quarto 99']);
      await choose(fixture, 'Casa 3');
      expect(fixture.nativeElement.querySelectorAll('button.mg-place-tile')).toHaveLength(0);
      expect(text(fixture, '.mg-room-tile strong')).toEqual(['Quarto 1', 'Quarto 2', 'Quarto 3']);
      expect(text(fixture, 'nav.mg-trail li')).toEqual(['Quartos', 'Vila Estudantil', 'Casa 3']);
    });

    it('alojamento sem casas abre direto na grade', async () => {
      const fixture = await shown(village);
      await choose(fixture, 'Residência Direta');
      expect(fixture.nativeElement.querySelectorAll('button.mg-place-tile')).toHaveLength(0);
      expect(text(fixture, '.mg-room-tile strong')).toEqual(['Quarto 1', 'Quarto 2']);
    });

    it('alojamento sem quartos avisa e a trilha volta ao início', async () => {
      const fixture = await shown(village);
      await choose(fixture, 'Residência Vazia');
      expect(fixture.nativeElement.textContent).toContain('Nenhum quarto neste local');
      const back = fixture.nativeElement.querySelector('nav.mg-trail button') as HTMLButtonElement;
      expect(back.textContent?.trim()).toBe('Quartos');
      back.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('button.mg-place-tile')).toHaveLength(3);
    });

    it('trilha volta ao nível anterior e o nível atual não é clicável', async () => {
      const fixture = await shown(village);
      expect(text(fixture, 'nav.mg-trail li')).toEqual(['Quartos']);
      expect(fixture.nativeElement.querySelector('nav.mg-trail button')).toBeNull();
      expect(
        fixture.nativeElement.querySelector('nav.mg-trail [aria-current="location"]').textContent,
      ).toContain('Quartos');
      await choose(fixture, 'Vila Estudantil');
      await choose(fixture, 'Casa 3');
      expect(
        fixture.nativeElement.querySelector('nav.mg-trail [aria-current="location"]').textContent,
      ).toContain('Casa 3');
      const back = [...fixture.nativeElement.querySelectorAll('nav.mg-trail button')].find(
        (item) => (item as HTMLElement).textContent?.trim() === 'Vila Estudantil',
      ) as HTMLButtonElement;
      back.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('button.mg-place-tile')).toHaveLength(10);
      expect(text(fixture, 'nav.mg-trail li')).toEqual(['Quartos', 'Vila Estudantil']);
    });

    it('foco vai ao título quando o usuário muda de nível, nunca no carregamento', async () => {
      api.map.mockResolvedValue(sortHousingMap(village));
      const fixture = TestBed.createComponent(RoomsComponent);
      document.body.appendChild(fixture.nativeElement);
      try {
        await fixture.whenStable();
        fixture.detectChanges();
        expect(document.activeElement).toBe(document.body);
        await choose(fixture, 'Vila Estudantil');
        const heading = fixture.nativeElement.querySelector('#room-map-heading') as HTMLElement;
        expect(document.activeElement).toBe(heading);
        expect(heading.textContent?.trim()).toBe('Vila Estudantil');
        (document.activeElement as HTMLElement).blur();
        (fixture.nativeElement.querySelector('nav.mg-trail button') as HTMLButtonElement).click();
        await fixture.whenStable();
        expect(document.activeElement?.id).toBe('room-map-heading');
        expect(heading.textContent?.trim()).toBe('Alojamentos');
      } finally {
        fixture.nativeElement.remove();
      }
    });

    it('volta do detalhe no mesmo nível, com a mesma trilha e o mesmo filtro', async () => {
      const first = await shown(village);
      await choose(first, 'Vila Estudantil');
      await choose(first, 'Casa 3');
      first.componentInstance.filters.controls.situation.setValue('Disponível');
      first.destroy();
      const again = await shown(village);
      expect(text(again, 'nav.mg-trail li')).toEqual(['Quartos', 'Vila Estudantil', 'Casa 3']);
      expect(again.componentInstance.filters.controls.situation.value).toBe('Disponível');
      expect(again.nativeElement.querySelectorAll('.mg-room-tile')).toHaveLength(3);
    });

    it('local lembrado que deixou de existir volta ao primeiro nível', async () => {
      TestBed.inject(FilterState).values.set('rooms', {
        accommodationId: 'removido',
        unitId: 'removida',
      });
      const fixture = await shown(village);
      const { accommodationId, unitId } = fixture.componentInstance.filters.controls;
      expect([accommodationId.value, unitId.value]).toEqual(['', '']);
      expect(fixture.nativeElement.querySelectorAll('button.mg-place-tile')).toHaveLength(3);
    });

    it('casa lembrada que deixou de existir volta às casas do alojamento', async () => {
      TestBed.inject(FilterState).values.set('rooms', {
        accommodationId: 'vila',
        unitId: 'removida',
      });
      const fixture = await shown(village);
      expect(fixture.componentInstance.filters.controls.unitId.value).toBe('');
      expect(fixture.nativeElement.querySelectorAll('button.mg-place-tile')).toHaveLength(10);
    });
  });

  describe('filtros do mapa', () => {
    it('busca no primeiro nível mostra o quarto com alojamento e casa', async () => {
      const fixture = TestBed.createComponent(RoomsComponent);
      await fixture.whenStable();
      fixture.componentInstance.filters.controls.search.setValue('TESTE-Q01');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('button.mg-place-tile')).toHaveLength(0);
      expect(fixture.componentInstance.groups()).toMatchObject([
        { name: 'Alojamento Fictício', unit: 'Casa Fictícia', floor: 'Piso não informado' },
      ]);
      expect(fixture.componentInstance.chips()).toEqual([
        { key: 'search', label: 'Busca', value: 'TESTE-Q01' },
      ]);
    });

    it('só com vagas mostra só quarto que recebe e tem vaga, com o filtro removível', async () => {
      const fixture = await shown({
        accommodations: [place('r', 'Residência')],
        units: [],
        rooms: [
          at('r-1', 'r', null),
          at('r-2', 'r', null, { situation: 'Ocupado', occupancy: 2, vacancies: 0 }),
          at('r-3', 'r', null, { situation: 'Manutenção', capacity: 3, vacancies: 3 }),
        ],
      });
      await choose(fixture, 'Residência');
      const component = fixture.componentInstance;
      expect(component.totals().vacancies).toBe(2);
      component.filters.controls.vacancies.setValue(true);
      fixture.detectChanges();
      expect(text(fixture, '.mg-room-tile strong')).toEqual(['Quarto 1']);
      expect(component.chips()).toEqual([
        { key: 'vacancies', label: 'Só com vagas', value: 'Sim' },
      ]);
      expect(text(fixture, '.filter-chips button')).toEqual(['Só com vagas: Sim']);
      component.removeFilter('vacancies');
      expect(component.filters.controls.vacancies.value).toBe(false);
      expect(component.filteredRooms()).toHaveLength(3);
    });

    it('piso só aparece quando algum quarto tem piso', async () => {
      const fixture = TestBed.createComponent(RoomsComponent);
      await fixture.whenStable();
      fixture.detectChanges();
      const hasFloor = () =>
        text(fixture, 'sager-filter-panel label').some((item) => item.startsWith('Piso'));
      expect(hasFloor()).toBe(false);
      const withFloor = structuredClone(map);
      withFloor.rooms[0].floor = 'Térreo';
      const again = await shown(withFloor);
      expect(text(again, 'sager-filter-panel label').some((item) => item.startsWith('Piso'))).toBe(
        true,
      );
    });

    it('limpar filtros dentro de uma casa mantém o nível', async () => {
      const fixture = TestBed.createComponent(RoomsComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance;
      component.open('alojamento-1');
      component.open('unidade-1');
      component.filters.controls.situation.setValue('Manutenção');
      expect(component.filteredRooms()).toHaveLength(0);
      component.clearFilters();
      fixture.detectChanges();
      expect(component.filteredRooms().map((item) => item.id)).toEqual(['quarto-1']);
      expect(text(fixture, 'nav.mg-trail li')).toEqual([
        'Quartos',
        'Alojamento Fictício',
        'Casa Fictícia',
      ]);
    });
  });

  it('legenda explica as quatro situações e nenhuma nota diz que tudo é escolhido', async () => {
    const fixture = TestBed.createComponent(RoomsComponent);
    await fixture.whenStable();
    fixture.componentInstance.open('alojamento-1');
    fixture.detectChanges();
    expect(text(fixture, '.mg-legend-list dt')).toEqual([
      'Disponível',
      'Ocupado',
      'Manutenção',
      'Indisponível',
    ]);
    expect(text(fixture, '.mg-legend-list dd')).toEqual([
      'Tem vaga e recebe residentes. Muda sozinha com os moradores.',
      'Todas as vagas estão preenchidas. Muda sozinha com os moradores.',
      'Em reparo, não recebe novos residentes. Escolhida pelo gestor ou supervisor.',
      'Fora de uso, não recebe novos residentes. Escolhida pelo gestor ou supervisor, ou quando o quarto não tem capacidade definida.',
    ]);
    expect(text(fixture, '.mg-note p')).toEqual([
      'Disponível e Ocupado mudam sozinhos com os moradores. Manutenção e Indisponível são escolhidos no cadastro do quarto.',
    ]);
    expect(fixture.nativeElement.textContent).not.toContain('escolhida por você');
  });

  it('paginação fica logo depois da grade, antes da legenda e da nota', async () => {
    api.map.mockResolvedValue({
      ...structuredClone(map),
      rooms: Array.from({ length: 30 }, (_, index) => ({
        ...room,
        id: `quarto-${index + 1}`,
        code: `TESTE-Q${index + 1}`,
        number: String(index + 1),
        unitId: null,
      })),
    });
    const fixture = TestBed.createComponent(RoomsComponent);
    await fixture.whenStable();
    fixture.componentInstance.open('alojamento-1');
    fixture.detectChanges();
    const section = fixture.nativeElement.querySelector('section.mg-section') as HTMLElement;
    const pagination = section.querySelector('sager-pagination') as HTMLElement;
    expect(pagination.querySelector('nav')).not.toBeNull();
    const groups = section.querySelectorAll('.mg-room-group');
    expect(groups[groups.length - 1].nextElementSibling).toBe(pagination);
    expect(pagination.nextElementSibling?.matches('.mg-legend-list')).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.mg-room-tile')).toHaveLength(25);
  });

  describe('quartos na demonstração', () => {
    beforeEach(() => active.set(true));

    it('abre direto na grade, sem cartões, trilha, totais nem "Só com vagas"', () => {
      const fixture = TestBed.createComponent(RoomsComponent);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelectorAll('.mg-room-tile').length).toBeGreaterThan(0);
      expect(root.querySelector('button.mg-place-tile')).toBeNull();
      expect(root.querySelector('nav.mg-trail')).toBeNull();
      expect(root.querySelector('.mg-stats')).toBeNull();
      expect(root.textContent).not.toContain('Só com vagas');
      expect(root.textContent).not.toContain('Capacidade');
      expect(
        new Set(fixture.componentInstance.rooms().map((item) => item.accommodationId)),
      ).toEqual(new Set(['A', 'B']));
      expect(text(fixture, '.mg-legend .mg-legend-item')).toEqual([
        'Disponível',
        'Ocupado',
        'Manutenção',
        'Indisponível',
      ]);
      expect(root.querySelector('.mg-legend-list')).toBeNull();
      expect(root.textContent).not.toContain('Muda sozinha');
      expect(api.map).not.toHaveBeenCalled();
    });

    it('bloco escolhido no painel deixa só os quartos dele, com o filtro removível', () => {
      const fixture = TestBed.createComponent(RoomsComponent);
      const component = fixture.componentInstance;
      component.filters.controls.block.setValue('A');
      fixture.detectChanges();
      expect(component.filteredRooms().every((item) => item.accommodationId === 'A')).toBe(true);
      expect(text(fixture, '.mg-room-group h3').every((item) => item.startsWith('Bloco A'))).toBe(
        true,
      );
      expect(component.chips()).toEqual([{ key: 'block', label: 'Bloco', value: 'Bloco A' }]);
      component.removeFilter('block');
      expect(new Set(component.filteredRooms().map((item) => item.accommodationId)).size).toBe(2);
      expect(api.map).not.toHaveBeenCalled();
    });
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
    expect(fixture.nativeElement.textContent).not.toContain('Última nota de limpeza');
    expect(api.map).not.toHaveBeenCalled();
  });

  it('demonstração não mostra nota de limpeza nos cartões dos quartos', () => {
    active.set(true);
    const fixture = TestBed.createComponent(RoomsComponent);
    fixture.detectChanges();
    const grid = fixture.nativeElement.querySelector('.mg-room-grid') as HTMLElement;
    expect(grid.textContent).toContain('Quarto 102');
    expect(grid.textContent).not.toContain('Limpeza:');
    expect(grid.textContent).not.toContain('nota');
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

  it('detalhe mostra a faixa etária herdada do alojamento', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: room.id });
    const fixture = TestBed.createComponent(RoomDetailComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Faixa etáriaSem faixa definida');

    const minors = structuredClone(map);
    minors.accommodations[0].ageGroup = 'MENORES';
    api.map.mockResolvedValue(minors);
    const withGroup = TestBed.createComponent(RoomDetailComponent);
    await withGroup.whenStable();
    withGroup.detectChanges();
    expect(withGroup.nativeElement.textContent).toContain('Faixa etáriaMenores de 18 anos');
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
    occupants([
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
    expect(fixture.nativeElement.textContent).toContain('Entrou em 29/09/2026');
    expect(fixture.nativeElement.textContent).not.toContain('saída prevista');
    expect(fixture.nativeElement.textContent).not.toContain('Última nota de limpeza');
    expect(fixture.nativeElement.textContent).not.toContain('escolhida por você');
    expect(fixture.nativeElement.textContent).toContain(
      'Disponível e Ocupado mudam sozinhos com os moradores.',
    );
    expect(allocationApi.activeInRoom).toHaveBeenCalledWith(room.id);
    expect(residentApi.page).toHaveBeenCalledWith({ roomId: room.id });
  });

  it('detalhe local mostra etapa, curso e saída prevista de cada morador', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: room.id });
    const allocation = {
      roomId: room.id,
      startedAt: '2026-02-10T02:30:00Z',
      endedAt: null,
      endReason: null,
      version: 0,
    };
    allocationApi.activeInRoom.mockResolvedValue([
      { ...allocation, id: 'alocacao-1', residentId: 'morador-1' },
      { ...allocation, id: 'alocacao-2', residentId: 'morador-2' },
    ]);
    const base = { enrollment: 'TESTE-01', birthDate: null, version: 0 };
    occupants([
      {
        ...base,
        id: 'morador-1',
        name: 'Morador Sintético',
        course: 'Curso Médio Sintético',
        stage: '2º ano',
        expectedExit: '2029-12-31',
        concluded: false,
      },
      { ...base, id: 'morador-2', name: 'Moradora Sintética', course: 'Curso Sem Nível' },
    ]);
    const fixture = TestBed.createComponent(RoomDetailComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const rows = Array.from(
      fixture.nativeElement.querySelectorAll('article.mg-row'),
    ) as HTMLElement[];
    expect(rows[0].textContent).toContain('2º ano · Curso Médio Sintético');
    expect(rows[0].textContent).toContain('Entrou em 09/02/2026 · saída prevista 31/12/2029');
    expect(rows[1].textContent).toContain('Curso Sem Nível');
    expect(rows[1].textContent).toContain('Entrou em 09/02/2026');
    expect(rows[1].textContent).not.toContain('saída prevista');
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
    for (const capacity of [1.5, 21, 500]) {
      fixture.componentInstance.localForm.controls.capacity.setValue(capacity);
      await fixture.componentInstance.save();
      expect(api.save).not.toHaveBeenCalled();
    }
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

  it('quarto lotado chega como Ocupado, mas o formulário só oferece situações manuais', async () => {
    const full: RoomRecord = {
      ...room,
      capacity: 2,
      occupancy: 2,
      vacancies: 0,
      situation: 'Ocupado',
    };
    api.map.mockResolvedValue({ ...structuredClone(map), rooms: [full] });
    route.snapshot.paramMap = convertToParamMap({ id: full.id });
    const fixture = TestBed.createComponent(RoomFormComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.localForm.controls.situation.value).toBe('Disponível');
    const options = [
      ...fixture.nativeElement.querySelectorAll('select[formcontrolname="situation"] option'),
    ].map((option: HTMLOptionElement) => option.value);
    expect(options).toEqual(['', 'Disponível', 'Manutenção', 'Indisponível']);
    expect(fixture.nativeElement.textContent).toContain('Ocupado aparece sozinho');
    await fixture.componentInstance.save();
    expect(api.save).toHaveBeenCalledWith(
      expect.objectContaining({ situation: 'Disponível', capacity: 2 }),
      { id: full.id, version: 0 },
    );
  });

  it('quarto sem capacidade exibido como Indisponível pede a situação antes de salvar', async () => {
    const unknown: RoomRecord = { ...room, situation: 'Indisponível' };
    api.map.mockResolvedValue({ ...structuredClone(map), rooms: [unknown] });
    route.snapshot.paramMap = convertToParamMap({ id: unknown.id });
    const fixture = TestBed.createComponent(RoomFormComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const form = fixture.componentInstance.localForm;
    expect(form.controls.situation.value).toBe('');
    expect(fixture.nativeElement.textContent).toContain(
      'Sem capacidade, o quarto aparece como Indisponível.',
    );
    form.controls.capacity.setValue(4);
    await fixture.componentInstance.save();
    expect(api.save).not.toHaveBeenCalled();
    form.controls.situation.setValue('Disponível');
    await fixture.componentInstance.save();
    expect(api.save).toHaveBeenCalledWith(
      expect.objectContaining({ situation: 'Disponível', capacity: 4 }),
      { id: unknown.id, version: 0 },
    );
  });

  it('quarto antigo acima do limite mantém a capacidade salva, mas não aceita outra', async () => {
    const old = structuredClone(map.rooms[0]);
    old.capacity = 500;
    api.map.mockResolvedValue({ ...map, rooms: [old] });
    route.snapshot.paramMap = convertToParamMap({ id: old.id });
    const fixture = TestBed.createComponent(RoomFormComponent);
    await fixture.whenStable();
    const capacity = fixture.componentInstance.localForm.controls.capacity;
    expect(capacity.valid).toBe(true);
    capacity.setValue(400);
    expect(capacity.valid).toBe(false);
    capacity.setValue(20);
    expect(capacity.valid).toBe(true);
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
