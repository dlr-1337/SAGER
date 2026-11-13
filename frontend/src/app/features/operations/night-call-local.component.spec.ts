import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from '../../core/session.service';
import { FilterState } from '../../core/filter-state';
import { HousingMap } from '../management/housing.models';
import { RoomApiService } from '../management/room-api.service';
import { NightCallLocalComponent } from './night-call-local.component';
import { OperationsLocalApiService } from './operations-local-api.service';
import { CallMark, NightCall } from './operations-local.models';

const room = (id: string, code: string, unitId: string | null) => ({
  id,
  code,
  number: '101',
  accommodationId: 'a1',
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
    { id: 'a1', code: 'A1', name: 'Alojamento Um', version: 0 },
    { id: 'a2', code: 'A2', name: 'Alojamento Dois', version: 0 },
  ],
  units: [
    { id: 'u1', accommodationId: 'a1', code: 'BA', name: 'Bloco A', version: 0 },
    { id: 'u2', accommodationId: 'a1', code: 'BB', name: 'Bloco B', version: 0 },
    { id: 'u3', accommodationId: 'a1', code: 'BC', name: 'Bloco sem residente', version: 0 },
  ],
  rooms: [room('r1', 'A-101', 'u1'), room('r2', 'B-101', 'u2'), room('r3', 'A-999', 'u1')],
};
const record = (residentId: string, roomId: string, mark: CallMark | null) => ({
  id: 'registro-' + residentId,
  residentId,
  residentName: 'Residente ' + residentId,
  enrollment: 'TESTE-' + residentId,
  birthDate: '2010-01-01',
  roomId,
  roomNumber: '101',
  mark,
  authorizedExitId: null,
  authorizedExitType: null,
  version: 0,
  history: [],
  authorizedExits: [],
});
const call: NightCall = {
  id: 'c1',
  accommodationId: 'a1',
  accommodationName: 'Alojamento Um',
  referenceDate: '2026-09-30',
  status: 'ABERTA',
  version: 0,
  openedAt: '2026-10-01T01:30:00Z',
  closedAt: null,
  outsideWindowConfirmed: false,
  justification: null,
  closeOutsideWindowConfirmed: false,
  closeJustification: null,
  summary: { total: 3, present: 2, absent: 0, justified: 0, unmarked: 1 },
  records: [record('1', 'r1', 'PRESENTE'), record('2', 'r1', 'PRESENTE'), record('3', 'r2', null)],
};

describe('Filtros de casa ou bloco e quarto na chamada noturna', () => {
  let map: ReturnType<typeof vi.fn>;
  let calls: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    map = vi.fn().mockResolvedValue(structuredClone(housing));
    calls = vi.fn().mockResolvedValue([structuredClone(call)]);
    TestBed.configureTestingModule({
      imports: [NightCallLocalComponent],
      providers: [
        provideRouter([]),
        { provide: RoomApiService, useValue: { map } },
        {
          provide: SessionService,
          useValue: { active: signal(false), hasRole: (role: string) => role === 'supervisor' },
        },
        {
          provide: OperationsLocalApiService,
          useValue: {
            calls,
            callContext: vi.fn().mockResolvedValue({
              accommodationId: 'a1',
              referenceDate: '2026-09-30',
              now: '2026-10-01T01:30:00Z',
              zone: 'America/Sao_Paulo',
              windowStart: '22:00:00',
              windowEnd: '23:30:00',
              outsideWindow: false,
              existingCallId: 'c1',
              eligibleResidents: 3,
              accommodations: housing.accommodations,
              missingBirthDates: [],
            }),
          },
        },
      ],
    });
  });

  async function create(): Promise<ComponentFixture<NightCallLocalComponent>> {
    const fixture = TestBed.createComponent(NightCallLocalComponent);
    await fixture.whenStable();
    await fixture.whenStable();
    return fixture;
  }
  const select = (fixture: ComponentFixture<NightCallLocalComponent>, label: string) =>
    Array.from<HTMLLabelElement>(fixture.nativeElement.querySelectorAll('label'))
      .find((item) => item.textContent?.trim().startsWith(label))
      ?.querySelector('select') ?? null;
  const options = (element: HTMLSelectElement | null) =>
    Array.from(element?.options ?? []).map((option) => option.textContent?.trim());

  it('oferece só quartos com residente na chamada, distinguíveis pelo código', async () => {
    const fixture = await create();
    expect(options(select(fixture, 'Quarto'))).toEqual([
      'Todos os quartos',
      'A-101 · Bloco A',
      'B-101 · Bloco B',
    ]);
    expect(options(select(fixture, 'Casa ou bloco'))).toEqual([
      'Todos os blocos',
      'Bloco A',
      'Bloco B',
    ]);
  });

  it('filtra pelo quarto escolhido e indica o total filtrado da chamada', async () => {
    const fixture = await create();
    fixture.componentInstance.room.setValue('r2');
    await fixture.whenStable();
    expect(fixture.componentInstance.filtered().map((row) => row.residentId)).toEqual(['3']);
    expect(fixture.nativeElement.textContent).toContain('1 de 3 residentes');
  });

  it('o bloco restringe quartos e residentes e limpa o quarto ao mudar', async () => {
    const fixture = await create();
    const component = fixture.componentInstance;
    component.room.setValue('r1');
    component.unit.setValue('u2');
    await fixture.whenStable();
    expect(component.room.value).toBe('');
    expect(options(select(fixture, 'Quarto'))).toEqual(['Todos os quartos', 'B-101 · Bloco B']);
    expect(component.filtered().map((row) => row.residentId)).toEqual(['3']);
  });

  it('trocar de alojamento volta bloco e quarto a todos', async () => {
    const fixture = await create();
    const component = fixture.componentInstance;
    component.unit.setValue('u1');
    component.room.setValue('r1');
    await fixture.whenStable();
    const accommodation = select(fixture, 'Alojamento')!;
    accommodation.value = 'a2';
    accommodation.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(component.unit.value).toBe('');
    expect(component.room.value).toBe('');
    expect(calls).toHaveBeenLastCalledWith('a2', '2026-09-30');
  });

  it('descarta quarto e bloco lembrados que não existem nas opções', async () => {
    const memory = TestBed.inject(FilterState);
    memory.values.set('call-roster-unit', 'u3');
    memory.values.set('call-roster-room', 'r3');
    const fixture = await create();
    expect(fixture.componentInstance.unit.value).toBe('');
    expect(fixture.componentInstance.room.value).toBe('');
    expect(fixture.componentInstance.filtered()).toHaveLength(3);
  });

  it('preserva quarto lembrado que continua na chamada', async () => {
    TestBed.inject(FilterState).values.set('call-roster-room', 'r2');
    const fixture = await create();
    expect(fixture.componentInstance.room.value).toBe('r2');
    expect(fixture.componentInstance.filtered().map((row) => row.residentId)).toEqual(['3']);
  });

  it('resumo e fechamento ignoram o filtro com todos os visíveis marcados', async () => {
    const fixture = await create();
    fixture.componentInstance.room.setValue('r1');
    await fixture.whenStable();
    expect(fixture.componentInstance.filtered().every((row) => row.mark)).toBe(true);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('2 de 3 residentes');
    expect(text).toContain('Falta marcar 1 residente');
    const close = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('Fechar chamada'));
    expect(close?.disabled).toBe(true);
  });

  describe('marcação automática', () => {
    const exitId = '00000000-0000-0000-0000-00000000e001';
    const automatic = (type: 'SHORT' | 'LONG') => ({
      ...record(type, 'r1', 'AUSENCIA_JUSTIFICADA'),
      authorizedExitId: exitId,
      authorizedExitType: type,
      version: 1,
      history: [
        {
          id: 'h-' + type,
          mark: 'AUSENCIA_JUSTIFICADA' as const,
          authorizedExitId: exitId,
          authorizedExitType: type,
          justification: null,
          recordedAt: '2026-10-01T01:30:00Z',
          actorId: '00000000-0000-0000-0000-000000000001',
          actorProfile: 'sistema',
          version: 1,
          callVersion: 0,
        },
      ],
      authorizedExits: [{ id: exitId, type }],
    });
    beforeEach(() => {
      calls.mockResolvedValue([
        {
          ...structuredClone(call),
          summary: { total: 2, present: 0, absent: 0, justified: 2, unmarked: 0 },
          records: [automatic('SHORT'), automatic('LONG')],
        },
      ]);
    });

    it('mostra Sistema, o tipo da saída com link e o aviso, sem identificador técnico', async () => {
      const fixture = await create();
      const element: HTMLElement = fixture.nativeElement;
      const text = element.textContent ?? '';
      expect(text).toContain('Sistema');
      expect(text).toContain('Residentes com saída em andamento já entram como ausência');
      expect(text).not.toContain(exitId);
      expect(element.querySelector(`a[href="/saidas/${exitId}"]`)?.textContent).toContain(
        'saída curta',
      );
      expect(element.querySelector(`a[href="/saidas/longas/${exitId}"]`)?.textContent).toContain(
        'saída longa',
      );
    });

    it('libera o fechamento quando todos nasceram justificados', async () => {
      const fixture = await create();
      const close = Array.from<HTMLButtonElement>(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((button) => button.textContent?.includes('Fechar chamada'));
      expect(close?.disabled).toBe(false);
    });

    it('não mostra o aviso depois de fechada', async () => {
      calls.mockResolvedValue([
        {
          ...structuredClone(call),
          status: 'FECHADA',
          closedAt: '2026-10-01T01:40:00Z',
          summary: { total: 1, present: 0, absent: 0, justified: 1, unmarked: 0 },
          records: [automatic('SHORT')],
        },
      ]);
      const fixture = await create();
      expect(fixture.nativeElement.textContent).not.toContain('Residentes com saída em andamento');
    });
  });

  it('sem o mapa de quartos mantém a chamada e filtra pelo número', async () => {
    map.mockRejectedValue(new Error('offline'));
    const fixture = await create();
    expect(fixture.componentInstance.call()).not.toBeNull();
    expect(select(fixture, 'Casa ou bloco')).toBeNull();
    expect(options(select(fixture, 'Quarto'))).toEqual([
      'Todos os quartos',
      'Quarto 101',
      'Quarto 101',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar casas');
  });
});
