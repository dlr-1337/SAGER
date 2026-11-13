import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { FilterState } from '../../core/filter-state';
import { LocalAuthService } from '../../core/local-auth.service';
import { HousingMap } from '../management/housing.models';
import { RoomApiService } from '../management/room-api.service';
import { ExitsLocalComponent } from './exits-local.component';
import { LongExitApiService } from './long-exit-api.service';
import { OperationsLocalApiService } from './operations-local-api.service';

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
  cleaningScore: null,
  version: 0,
});
const housing: HousingMap = {
  accommodations: [
    { id: 'alojamento-teste', code: 'A1', name: 'Alojamento Um', version: 0 },
    { id: 'outro-alojamento', code: 'A2', name: 'Alojamento Dois', version: 0 },
  ],
  units: [
    { id: 'bloco-a', accommodationId: 'alojamento-teste', code: 'BA', name: 'Bloco A', version: 0 },
  ],
  rooms: [
    room('quarto-teste', 'A-101', 'alojamento-teste', 'bloco-a'),
    room('quarto-outro', 'C-101', 'outro-alojamento', null),
  ],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('Critérios restaurados da lista de saídas', () => {
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let shortPage: ReturnType<typeof vi.fn>;
  let longPage: ReturnType<typeof vi.fn>;
  const criteria = {
    search: 'Estudante Sintético',
    status: 'APROVADA',
    from: '2026-10-01',
    to: '2026-10-31',
    accommodationId: 'alojamento-teste',
    unitId: 'bloco-a',
    roomId: 'quarto-teste',
  };
  let role: string;
  let map: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    role = 'supervisor';
    map = vi.fn().mockResolvedValue(structuredClone(housing));
    params = new BehaviorSubject(convertToParamMap({}));
    shortPage = vi.fn().mockResolvedValue({ items: [], total: 0 });
    longPage = vi.fn().mockResolvedValue({ items: [], total: 0 });
    TestBed.configureTestingModule({
      imports: [ExitsLocalComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get queryParamMap() {
                return params.value;
              },
            },
            queryParamMap: params.asObservable(),
          },
        },
        {
          provide: DemoSessionService,
          useValue: {
            active: signal(false),
            hasRole: (...roles: string[]) => roles.includes(role),
          },
        },
        { provide: OperationsLocalApiService, useValue: { exitsPage: shortPage } },
        { provide: LongExitApiService, useValue: { page: longPage } },
        { provide: RoomApiService, useValue: { map } },
      ],
    });
    TestBed.inject(FilterState).values.set('exits-local.component', { ...criteria });
  });

  describe.each([false, true])('Ajuste da página (longa=%s)', (long) => {
    async function create() {
      params.next(convertToParamMap(long ? { tipo: 'longa' } : {}));
      const fixture = TestBed.createComponent(ExitsLocalComponent);
      await fixture.whenStable();
      const api = long ? longPage : shortPage;
      api.mockClear();
      return { fixture, component: fixture.componentInstance, api };
    }

    it.each([
      { page: 1, total: 25, expected: 0 },
      { page: 1, total: 0, expected: 0 },
      { page: 4, total: 55, expected: 2 },
      { page: 1, total: 26, expected: 1 },
      { page: 0, total: 0, expected: 0 },
    ])('limita página $page ao total $total, preservando os filtros', async (state) => {
      const { fixture, component, api } = await create();
      api.mockResolvedValue({ items: [], total: state.total });
      component.changePage(state.page);
      await fixture.whenStable();
      expect(component.page()).toBe(state.expected);
      expect(component.total()).toBe(state.total);
      expect(component.loading()).toBe(false);
      expect(component.longMode()).toBe(long);
      expect(component.filters.getRawValue()).toEqual(criteria);
      expect(api).toHaveBeenCalledTimes(state.page === state.expected ? 1 : 2);
      expect(api).toHaveBeenLastCalledWith(
        { ...criteria, limit: '25', offset: String(state.expected * 25) },
        expect.any(AbortSignal),
      );
      expect(fixture.nativeElement.textContent).not.toContain('26–25');
    });

    it('mantém o carregamento até terminar a consulta da página corrigida', async () => {
      const { fixture, component, api } = await create();
      const next = deferred<{ items: []; total: number }>();
      api.mockResolvedValueOnce({ items: [], total: 25 }).mockReturnValueOnce(next.promise);
      component.changePage(1);
      await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(2));
      expect(component.page()).toBe(0);
      expect(component.loading()).toBe(true);
      next.resolve({ items: [], total: 25 });
      await fixture.whenStable();
      expect(component.loading()).toBe(false);
    });

    it('apresenta erro da consulta corrigida e permite tentar de novo na página válida', async () => {
      const { fixture, component, api } = await create();
      api
        .mockResolvedValueOnce({ items: [], total: 25 })
        .mockRejectedValueOnce(new Error('Falha sintética'));
      component.changePage(1);
      await fixture.whenStable();
      expect(component.page()).toBe(0);
      expect(component.error()).not.toBe('');
      expect(component.loading()).toBe(false);
      api.mockResolvedValueOnce({ items: [], total: 25 });
      await component.load();
      expect(component.error()).toBe('');
      expect(api).toHaveBeenLastCalledWith(
        { ...criteria, limit: '25', offset: '0' },
        expect.any(AbortSignal),
      );
    });

    it.each(['busca', 'modalidade'])('ignora o total antigo após trocar a %s', async (change) => {
      const { fixture, component, api } = await create();
      const old = deferred<{ items: []; total: number }>();
      api.mockReturnValueOnce(old.promise);
      component.changePage(1);
      if (change === 'busca') {
        component.filters.controls.search.setValue('Busca atual', { emitEvent: false });
        component.page.set(0);
        api.mockResolvedValueOnce({ items: [], total: 26 });
        await component.load();
      } else {
        (long ? shortPage : longPage).mockResolvedValueOnce({ items: [], total: 26 });
        params.next(convertToParamMap(long ? {} : { tipo: 'longa' }));
        await fixture.whenStable();
      }
      old.resolve({ items: [], total: 0 });
      await fixture.whenStable();
      expect(component.total()).toBe(26);
      expect(component.page()).toBe(0);
      expect(component.loading()).toBe(false);
      expect(api).toHaveBeenCalledTimes(change === 'busca' ? 2 : 1);
    });
  });

  describe('Filtro de quarto', () => {
    const roomSelect = (element: HTMLElement) =>
      Array.from(element.querySelectorAll('label'))
        .find((label) => label.textContent?.trim().startsWith('Quarto'))
        ?.querySelector('select');

    it('oferece só quartos do alojamento, com código e bloco, e os envia à consulta', async () => {
      const fixture = TestBed.createComponent(ExitsLocalComponent);
      await fixture.whenStable();
      fixture.detectChanges();
      const select = roomSelect(fixture.nativeElement);
      expect(Array.from(select?.options ?? []).map((item) => item.textContent?.trim())).toEqual([
        'Todos os quartos',
        'A-101 · Bloco A',
      ]);
      expect(shortPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ roomId: 'quarto-teste' }),
        expect.any(AbortSignal),
      );
    });

    it('volta o quarto a todos ao trocar de alojamento e ao limpar', async () => {
      const fixture = TestBed.createComponent(ExitsLocalComponent);
      await fixture.whenStable();
      const { accommodationId, roomId } = fixture.componentInstance.filters.controls;
      accommodationId.setValue('outro-alojamento');
      expect(roomId.value).toBe('');
      expect(fixture.componentInstance.visibleRooms().map((item) => item.id)).toEqual([
        'quarto-outro',
      ]);
      roomId.setValue('quarto-outro');
      fixture.componentInstance.clear();
      expect(roomId.value).toBe('');
      await fixture.whenStable();
    });

    it('oferece casa ou bloco na ordem certa, envia unitId e limpa a seleção em cascata', async () => {
      const fixture = TestBed.createComponent(ExitsLocalComponent);
      await fixture.whenStable();
      fixture.detectChanges();
      const page = fixture.componentInstance;
      const labels = Array.from<HTMLLabelElement>(
        fixture.nativeElement.querySelectorAll('.op-filters label'),
      ).map((label) => label.firstChild?.textContent?.trim());
      expect(labels.slice(-3)).toEqual(['Alojamento', 'Casa ou bloco', 'Quarto']);
      const { accommodationId, unitId, roomId } = page.filters.controls;
      unitId.setValue('bloco-a');
      expect(roomId.value).toBe('');
      expect(page.visibleRooms().map((item) => item.id)).toEqual(['quarto-teste']);
      await page.load();
      expect(shortPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ unitId: 'bloco-a' }),
        expect.any(AbortSignal),
      );
      accommodationId.setValue('');
      expect(unitId.value).toBe('');
      expect(page.visibleUnits().map((item) => page.unitLabel(item))).toEqual([
        'Bloco A · Alojamento Um',
      ]);
      unitId.setValue('bloco-a');
      page.clear();
      expect(unitId.value).toBe('');
      await fixture.whenStable();
    });

    it('descarta bloco lembrado que não pertence ao alojamento', async () => {
      TestBed.inject(FilterState).values.set('exits-local.component', {
        ...criteria,
        accommodationId: 'outro-alojamento',
        unitId: 'bloco-a',
        roomId: '',
      });
      const fixture = TestBed.createComponent(ExitsLocalComponent);
      await fixture.whenStable();
      expect(fixture.componentInstance.filters.controls.unitId.value).toBe('');
    });

    it('descarta quarto lembrado que não existe mais nas opções', async () => {
      TestBed.inject(FilterState).values.set('exits-local.component', {
        ...criteria,
        roomId: 'quarto-outro',
      });
      const fixture = TestBed.createComponent(ExitsLocalComponent);
      await fixture.whenStable();
      expect(fixture.componentInstance.filters.controls.roomId.value).toBe('');
      await vi.waitFor(() => {
        const { roomId } = shortPage.mock.lastCall![0];
        expect(roomId).toBeUndefined();
      });
    });

    it('mantém o quarto lembrado quando as opções não carregam', async () => {
      map.mockRejectedValue(new Error('offline'));
      const fixture = TestBed.createComponent(ExitsLocalComponent);
      await fixture.whenStable();
      expect(fixture.componentInstance.filters.controls.roomId.value).toBe('quarto-teste');
      expect(fixture.componentInstance.optionsError()).toContain('alojamentos e quartos');
    });

    it('não oferece o filtro ao residente nem consulta o mapa', async () => {
      role = 'residente';
      TestBed.inject(FilterState).values.delete('exits-local.component');
      const fixture = TestBed.createComponent(ExitsLocalComponent);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(roomSelect(fixture.nativeElement)).toBeUndefined();
      expect(map).not.toHaveBeenCalled();
    });
  });

  it.each([false, true])(
    'preserva Aprovada na primeira consulta e no retorno (longa=%s)',
    async (long) => {
      params.next(convertToParamMap(long ? { tipo: 'longa' } : {}));
      const page = long ? longPage : shortPage;
      const fixture = TestBed.createComponent(ExitsLocalComponent);
      await fixture.whenStable();
      expect(fixture.componentInstance.filters.getRawValue()).toEqual(criteria);
      expect(page).toHaveBeenLastCalledWith(
        { ...criteria, limit: '25', offset: '0' },
        expect.any(AbortSignal),
      );
      fixture.destroy();
      const restored = TestBed.createComponent(ExitsLocalComponent);
      await restored.whenStable();
      expect(restored.componentInstance.filters.controls.status.value).toBe('APROVADA');
      expect(page).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'APROVADA' }),
        expect.any(AbortSignal),
      );
    },
  );

  it('preserva a situação em uma emissão da rota sem troca de modalidade', async () => {
    const fixture = TestBed.createComponent(ExitsLocalComponent);
    await fixture.whenStable();
    params.next(convertToParamMap({ outro: 'parametro' }));
    await fixture.whenStable();
    expect(fixture.componentInstance.filters.controls.status.value).toBe('APROVADA');
    expect(shortPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'APROVADA' }),
      expect.any(AbortSignal),
    );
  });

  it.each([false, true])(
    'limpa e memoriza a situação somente ao trocar a modalidade (longa=%s)',
    async (long) => {
      params.next(convertToParamMap(long ? { tipo: 'longa' } : {}));
      const fixture = TestBed.createComponent(ExitsLocalComponent);
      await fixture.whenStable();
      fixture.componentInstance.page.set(2);
      shortPage.mockClear();
      longPage.mockClear();
      params.next(convertToParamMap(long ? {} : { tipo: 'longa' }));
      await fixture.whenStable();
      expect(fixture.componentInstance.filters.getRawValue()).toEqual({ ...criteria, status: '' });
      expect(fixture.componentInstance.page()).toBe(0);
      const target = long ? shortPage : longPage;
      expect(target).toHaveBeenCalledTimes(1);
      const { status, ...otherCriteria } = criteria;
      expect(target).toHaveBeenCalledWith(
        { ...otherCriteria, limit: '25', offset: '0' },
        expect.any(AbortSignal),
      );
      expect(TestBed.inject(FilterState).values.get('exits-local.component')).toEqual({
        ...criteria,
        status: '',
      });
      fixture.destroy();
      const restored = TestBed.createComponent(ExitsLocalComponent);
      await restored.whenStable();
      expect(restored.componentInstance.filters.controls.status.value).toBe('');
    },
  );

  it('mostra ao adulto a lista sem os pedidos, e ao menor os dois pedidos', async () => {
    role = 'residente';
    TestBed.inject(FilterState).values.delete('exits-local.component');
    const auth = TestBed.inject(LocalAuthService);
    const resident = {
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Residente Sintético',
      email: null,
      matricula: 'TESTE-LOGIN',
      fotoUrl: null,
      perfis: ['residente' as const],
      residenteId: '00000000-0000-0000-0000-000000000002',
      supervisorId: null,
    };
    auth.principal.set({ ...resident, maiorDeIdade: true });
    const fixture = TestBed.createComponent(ExitsLocalComponent);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Pedidos de saída curta');
    expect(page.querySelector('a[href="/saidas/nova"]')).toBeNull();
    expect(page.querySelector('a[href="/saidas/longas/nova"]')).toBeNull();
    auth.principal.set({ ...resident, maiorDeIdade: false });
    await fixture.whenStable();
    expect(page.querySelector('a[href="/saidas/nova"]')).not.toBeNull();
    expect(page.querySelector('a[href="/saidas/longas/nova"]')).not.toBeNull();
  });
});
