import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { FilterState } from '../../core/filter-state';
import { HousingMap } from '../management/housing.models';
import { ResidentApiService } from '../management/resident-api.service';
import { RoomApiService } from '../management/room-api.service';
import { CleaningLocalApiService } from './cleaning-local-api.service';
import { CleaningListLocalPage } from './cleaning-local.pages';

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
});
