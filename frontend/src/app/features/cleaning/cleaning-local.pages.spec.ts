import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { FilterState } from '../../core/filter-state';
import { HousingMap } from '../management/housing.models';
import { ResidentApiService } from '../management/resident-api.service';
import { RoomApiService } from '../management/room-api.service';
import { CleaningLocalApiService } from './cleaning-local-api.service';
import {
  CleaningDetailLocalPage,
  CleaningListLocalPage,
  RankingLocalPage,
} from './cleaning-local.pages';

const room = (id: string, code: string, accommodationId: string, unitId: string | null) => ({
  id,
  code,
  number: '101',
  accommodationId,
  unitId,
  floor: null,
  capacity: 4,
  situation: 'Ocupado' as const,
  occupancy: 1,
  vacancies: 3,
  version: 0,
});
const housing: HousingMap = {
  accommodations: [
    { id: 'a1', code: 'A1', name: 'Alojamento Um', version: 0 },
    { id: 'a2', code: 'A2', name: 'Alojamento Dois', version: 0 },
  ],
  units: [{ id: 'u1', accommodationId: 'a1', code: 'BA', name: 'Bloco A', version: 0 }],
  rooms: [room('r1', 'A-101', 'a1', 'u1'), room('r2', 'C-101', 'a2', null)],
};

describe('Filtro de alojamento na lista de limpeza', () => {
  let list: ReturnType<typeof vi.fn>;
  let map: ReturnType<typeof vi.fn>;
  let own: boolean;
  let demo: boolean;
  let residents: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    own = false;
    demo = false;
    residents = vi
      .fn()
      .mockResolvedValue([{ id: 'p1', name: 'Pessoa Sintética', enrollment: 'TESTE-001' }]);
    list = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    map = vi.fn().mockResolvedValue(structuredClone(housing));
    TestBed.configureTestingModule({
      imports: [CleaningListLocalPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get data() {
                return { ownCleaning: own };
              },
            },
          },
        },
        {
          provide: DemoSessionService,
          useValue: {
            get active() {
              return signal(demo);
            },
            hasRole: (...roles: string[]) => roles.includes(own ? 'residente' : 'supervisor'),
          },
        },
        {
          provide: CleaningLocalApiService,
          useValue: { list, ownList: vi.fn().mockResolvedValue({ items: [], nextCursor: null }) },
        },
        { provide: RoomApiService, useValue: { map } },
        { provide: ResidentApiService, useValue: { list: residents } },
      ],
    });
  });

  async function create() {
    const fixture = TestBed.createComponent(CleaningListLocalPage);
    await fixture.whenStable();
    return fixture;
  }

  it('envia o alojamento sem quarto e oferece só os quartos dele', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    expect(page.visibleRooms().map((item) => page.roomLabel(item))).toEqual([
      'A-101 · Bloco A',
      'C-101',
    ]);
    page.filters.controls.accommodationId.setValue('a2');
    await page.load();
    expect(page.visibleRooms().map((item) => item.id)).toEqual(['r2']);
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ accommodationId: 'a2', roomId: '' }),
      undefined,
    );
  });

  it('volta o quarto a todos ao trocar de alojamento', async () => {
    const fixture = await create();
    const { accommodationId, roomId } = fixture.componentInstance.filters.controls;
    accommodationId.setValue('a1');
    roomId.setValue('r1');
    accommodationId.setValue('a2');
    expect(roomId.value).toBe('');
  });

  it('filtra por casa ou bloco, com quarto dependente e cascata', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    const { accommodationId, unitId, roomId } = page.filters.controls;
    expect(page.visibleUnits().map((item) => page.unitLabel(item))).toEqual([
      'Bloco A · Alojamento Um',
    ]);
    roomId.setValue('r2');
    unitId.setValue('u1');
    expect(roomId.value).toBe('');
    expect(page.visibleRooms().map((item) => item.id)).toEqual(['r1']);
    await page.load();
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ unitId: 'u1', roomId: '' }),
      undefined,
    );
    accommodationId.setValue('a1');
    expect(unitId.value).toBe('');
    expect(page.visibleUnits().map((item) => page.unitLabel(item))).toEqual(['Bloco A']);
  });

  it('descarta bloco lembrado fora do alojamento e consulta sem ele', async () => {
    TestBed.inject(FilterState).values.set('cleaning-local.pages', {
      from: '',
      to: '',
      accommodationId: 'a2',
      unitId: 'u1',
      roomId: '',
      residentId: '',
    });
    const fixture = await create();
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await fixture.whenStable();
    expect(fixture.componentInstance.filters.controls.unitId.value).toBe('');
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ accommodationId: 'a2', unitId: '' }),
      undefined,
    );
  });

  it('descarta quarto lembrado fora do alojamento e consulta sem ele', async () => {
    TestBed.inject(FilterState).values.set('cleaning-local.pages', {
      from: '',
      to: '',
      accommodationId: 'a1',
      roomId: 'r2',
      residentId: '',
    });
    const fixture = await create();
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await fixture.whenStable();
    expect(fixture.componentInstance.filters.controls.roomId.value).toBe('');
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ accommodationId: 'a1', roomId: '' }),
      undefined,
    );
    expect(fixture.componentInstance.list.loading()).toBe(false);
  });

  it('não consulta o mapa em "Minhas avaliações"', async () => {
    own = true;
    await create();
    expect(map).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });
  it('aplica o filtro sozinho, sem botão de busca, e mostra filtros ativos com nomes legíveis', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).not.toContain('Buscar avaliações');
    page.filters.patchValue({ accommodationId: 'a1', unitId: 'u1' });
    page.filters.patchValue({ roomId: 'r1', residentId: 'p1', from: '2026-09-01' });
    await vi.waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ accommodationId: 'a1', roomId: 'r1', residentId: 'p1' }),
        undefined,
      ),
    );
    fixture.detectChanges();
    expect(page.chips().map((chip) => `${chip.label}: ${chip.value}`)).toEqual([
      'De: 01/09/2026',
      'Alojamento: Alojamento Um',
      'Casa ou bloco: Bloco A',
      'Quarto: A-101 · Bloco A',
      'Residente: Pessoa Sintética · TESTE-001',
    ]);
    expect(element.querySelector('.filter-chips')?.textContent).not.toContain('a1');
  });

  it('mantém à vista e removíveis os filtros lembrados quando as opções falham', async () => {
    map.mockRejectedValue(new Error('Falha sintética'));
    residents.mockRejectedValue(new Error('Falha sintética'));
    TestBed.inject(FilterState).values.set('cleaning-local.pages', {
      from: '',
      to: '',
      accommodationId: 'a1',
      unitId: 'u1',
      roomId: 'r1',
      residentId: 'p1',
    });
    const fixture = await create();
    fixture.detectChanges();
    expect(fixture.componentInstance.chips().map((chip) => `${chip.label}: ${chip.value}`)).toEqual(
      [
        'Alojamento: Alojamento selecionado',
        'Casa ou bloco: Casa ou bloco selecionada',
        'Quarto: Quarto selecionado',
        'Residente: Residente selecionado',
      ],
    );
    const element: HTMLElement = fixture.nativeElement;
    expect(
      [...element.querySelectorAll('button')].some(
        (button) => button.textContent?.trim() === 'Limpar filtros',
      ),
    ).toBe(true);
  });

  it('mantém o painel na tela enquanto a lista carrega', async () => {
    const fixture = await create();
    list.mockReturnValueOnce(new Promise(() => undefined));
    void fixture.componentInstance.load();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Carregando registros');
    expect(element.querySelector('sager-filter-panel input[type=date]')).not.toBeNull();
    expect(element.querySelector('#cleaning-results-title')?.textContent).toBe(
      'Avaliações registradas',
    );
  });

  it('troca de página com Próxima e volta com Anterior sem consultar de novo', async () => {
    const item = (id: string) => ({
      id,
      roomCode: id,
      assessmentDate: '2026-09-30',
      evaluatedAt: '2026-09-30T16:00:00Z',
      score: 6,
      feedback: { previousScore: null },
    });
    list
      .mockResolvedValueOnce({ items: [item('p1-a')], nextCursor: 31 })
      .mockResolvedValueOnce({ items: [item('p2-a')], nextCursor: null });
    const fixture = await create();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const button = (name: string) =>
      [...element.querySelectorAll<HTMLButtonElement>('sager-pagination button')].find(
        (candidate) => candidate.textContent?.trim() === name,
      )!;
    expect(element.textContent).toContain('Página 1');
    button('Próxima').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(list).toHaveBeenLastCalledWith(expect.anything(), 31);
    expect(element.textContent).toContain('Quarto p2-a');
    expect(element.textContent).not.toContain('Quarto p1-a');
    expect(document.activeElement?.id).toBe('cleaning-results-title');
    button('Anterior').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.textContent).toContain('Quarto p1-a');
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('busca mapa e residentes uma vez, mesmo depois de duas mudanças de filtro', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    page.filters.controls.accommodationId.setValue('a1');
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    page.filters.controls.from.setValue('2026-09-01');
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(3));
    expect(map).toHaveBeenCalledTimes(1);
    expect(residents).toHaveBeenCalledTimes(1);
  });

  it('não chama a API com a demonstração ativa', async () => {
    demo = true;
    await create();
    expect(map).not.toHaveBeenCalled();
    expect(residents).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it('tem uma só frase no cabeçalho', async () => {
    const fixture = await create();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('header p')).toHaveLength(1);
  });

  it('mostra aos 15 s a avaliação nova na lista filtrada, sem passar por "Carregando"', async () => {
    vi.useFakeTimers();
    try {
      list.mockResolvedValue({ items: [assessment('antiga')], nextCursor: null });
      const fixture = TestBed.createComponent(CleaningListLocalPage);
      const page = fixture.componentInstance;
      page.filters.controls.accommodationId.setValue('a1');
      await vi.advanceTimersByTimeAsync(300);
      fixture.detectChanges();
      const calls = list.mock.calls.length;
      list.mockResolvedValue({
        items: [assessment('nova'), assessment('antiga')],
        nextCursor: null,
      });
      await vi.advanceTimersByTimeAsync(14_000);
      expect(list).toHaveBeenCalledTimes(calls);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(page.list.loading()).toBe(false);
      fixture.detectChanges();
      expect(list).toHaveBeenCalledTimes(calls + 1);
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ accommodationId: 'a1' }),
        undefined,
      );
      expect(fixture.nativeElement.textContent).toContain('Quarto nova');
      expect(page.filters.controls.accommodationId.value).toBe('a1');
    } finally {
      vi.useRealTimers();
    }
  });
});

const assessment = (id: string) => ({
  id,
  roomCode: id,
  assessmentDate: '2026-09-30',
  evaluatedAt: '2026-09-30T16:00:00Z',
  criteria: { PISO: 6, SUPERFICIES: 6, RESIDUOS: 6, ORGANIZACAO: 6 },
  score: 6,
  observation: null,
  feedback: {
    previousScore: null,
    newScore: 6,
    delta: null,
    periodMean: 6,
    position: 1,
    rankingReference: 'MONTH',
    from: '2026-09-01',
    to: '2026-09-30',
  },
});

describe('Detalhe e ranking da limpeza se atualizam sozinhos', () => {
  let get: ReturnType<typeof vi.fn>;
  let ranking: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    get = vi.fn().mockResolvedValue(assessment('A-101'));
    ranking = vi.fn().mockResolvedValue({
      period: 'MONTH',
      from: '2026-09-01',
      to: '2026-09-30',
      items: [{ roomId: 'r1', roomCode: 'A-101', mean: 6, position: 1, assessmentCount: 1 }],
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {},
              paramMap: { get: () => 'avaliacao' },
              queryParamMap: { get: () => null },
            },
          },
        },
        {
          provide: DemoSessionService,
          useValue: {
            active: signal(false),
            hasRole: (...roles: string[]) => roles.includes('gestor'),
          },
        },
        {
          provide: CleaningLocalApiService,
          useValue: {
            get,
            ranking,
            policy: vi.fn().mockResolvedValue({ currentDate: '2026-09-30' }),
          },
        },
      ],
    });
  });
  afterEach(() => vi.useRealTimers());

  it('o detalhe mostra a correção aos 15 s e não tem "Atualizar dados"', async () => {
    const fixture = TestBed.createComponent(CleaningDetailLocalPage);
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Avaliação do quarto');
    expect(element.textContent).not.toContain('Atualizar dados');
    get.mockResolvedValue({ ...assessment('A-101'), score: 9.5 });
    await vi.advanceTimersByTimeAsync(15_000);
    fixture.detectChanges();
    expect(get).toHaveBeenCalledTimes(2);
    expect(element.textContent).toContain('9,50');
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('o detalhe sai de "Carregando" quando a primeira carga passa de 15 s', async () => {
    let answer!: (value: unknown) => void;
    get.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const fixture = TestBed.createComponent(CleaningDetailLocalPage);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(get).toHaveBeenCalledTimes(1);
    answer(assessment('A-101'));
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Avaliação do quarto');
  });

  it('o detalhe tira o erro quando a atualização automática consegue carregar', async () => {
    get.mockRejectedValueOnce(new Error('offline'));
    const fixture = TestBed.createComponent(CleaningDetailLocalPage);
    await vi.advanceTimersByTimeAsync(0);
    expect(fixture.componentInstance.error()).not.toBe('');
    await vi.advanceTimersByTimeAsync(15_000);
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Avaliação do quarto');
  });

  it('o ranking reflete a correção aos 15 s no mesmo período', async () => {
    const fixture = TestBed.createComponent(RankingLocalPage);
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    ranking.mockResolvedValue({
      period: 'MONTH',
      from: '2026-09-01',
      to: '2026-09-30',
      items: [{ roomId: 'r1', roomCode: 'A-101', mean: 8.25, position: 1, assessmentCount: 2 }],
    });
    fixture.componentInstance.form.controls.period.setValue('WEEK');
    await vi.advanceTimersByTimeAsync(15_000);
    fixture.detectChanges();
    expect(ranking).toHaveBeenLastCalledWith('MONTH', '2026-09-30', false);
    expect(fixture.nativeElement.textContent).toContain('8,25');
  });
});
