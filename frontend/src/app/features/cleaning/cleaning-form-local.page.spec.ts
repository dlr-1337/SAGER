import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { HousingMap } from '../management/housing.models';
import { RoomApiService } from '../management/room-api.service';
import { CleaningFormLocalPage } from './cleaning-form-local.page';
import { CleaningLocalApiService } from './cleaning-local-api.service';

const room = (id: string, accommodationId: string, unitId: string | null) => ({
  id,
  code: id.toUpperCase(),
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
  units: [
    { id: 'u1', accommodationId: 'a1', code: 'BA', name: 'Bloco A', version: 0 },
    { id: 'u2', accommodationId: 'a2', code: 'BA', name: 'Bloco A', version: 0 },
  ],
  rooms: [room('r1', 'a1', 'u1'), room('r2', 'a1', null), room('r3', 'a2', 'u2')],
};

describe('Escolha do quarto na avaliação de limpeza', () => {
  let map: ReturnType<typeof vi.fn>;
  let id: string | null;

  beforeEach(() => {
    id = null;
    map = vi.fn().mockResolvedValue(structuredClone(housing));
    TestBed.configureTestingModule({
      imports: [CleaningFormLocalPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => id } } },
        },
        {
          provide: DemoSessionService,
          useValue: { active: signal(false), hasRole: (role: string) => role === 'supervisor' },
        },
        {
          provide: CleaningLocalApiService,
          useValue: {
            policy: vi.fn().mockResolvedValue({ version: 1, now: '', currentDate: '' }),
            get: vi.fn().mockResolvedValue(null),
          },
        },
        { provide: RoomApiService, useValue: { map } },
      ],
    });
  });

  async function create() {
    const fixture = TestBed.createComponent(CleaningFormLocalPage);
    await fixture.whenStable();
    return fixture;
  }

  it('estreita as opções sem chamar o servidor e limpa em cascata', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    const { accommodationId, unitId, roomId } = page.form.controls;
    expect(page.visibleUnits().map((item) => page.unitLabel(item))).toEqual([
      'Bloco A · Alojamento Um',
      'Bloco A · Alojamento Dois',
    ]);
    expect(page.visibleRooms().map((item) => page.roomLabel(item))).toEqual([
      'R1 · Bloco A',
      'R2',
      'R3 · Bloco A',
    ]);
    accommodationId.setValue('a1');
    expect(page.visibleUnits().map((item) => page.unitLabel(item))).toEqual(['Bloco A']);
    expect(page.visibleRooms().map((item) => item.id)).toEqual(['r1', 'r2']);
    roomId.setValue('r2');
    unitId.setValue('u1');
    expect(roomId.value).toBe('');
    expect(page.visibleRooms().map((item) => item.id)).toEqual(['r1']);
    roomId.setValue('r1');
    accommodationId.setValue('a2');
    expect(unitId.value).toBe('');
    expect(roomId.value).toBe('');
    expect(map).toHaveBeenCalledTimes(1);
  });

  it('ao corrigir uma avaliação não carrega quartos nem mostra a escolha', async () => {
    id = 'avaliacao';
    const fixture = await create();
    expect(map).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[formcontrolname="unitId"]')).toBeNull();
  });
});

describe('Avaliação de limpeza em três passos', () => {
  let id: string | null;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  const existing = {
    id: 'avaliacao',
    roomId: 'r1',
    roomCode: 'R1',
    evaluatedAt: '2026-11-10T13:00:00Z',
    criteria: { PISO: 5, SUPERFICIES: 5, RESIDUOS: 5, ORGANIZACAO: 5 },
    observation: null,
    version: 3,
  };

  beforeEach(() => {
    id = null;
    api = {
      policy: vi.fn().mockResolvedValue({ version: 1, now: '2026-11-14T15:00:00Z' }),
      get: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockResolvedValue({ id: 'nova' }),
      correct: vi.fn().mockResolvedValue({ id: 'avaliacao' }),
    };
    TestBed.configureTestingModule({
      imports: [CleaningFormLocalPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => id } } } },
        {
          provide: DemoSessionService,
          useValue: { active: signal(false), hasRole: (role: string) => role === 'supervisor' },
        },
        { provide: CleaningLocalApiService, useValue: api },
        { provide: RoomApiService, useValue: { map: vi.fn().mockResolvedValue(housing) } },
      ],
    });
  });

  async function open() {
    const fixture = TestBed.createComponent(CleaningFormLocalPage);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const text = (selector: string) => element.querySelector(selector)?.textContent?.trim();
    const button = (name: string) =>
      [...element.querySelectorAll('button')].find((item) => item.textContent?.trim() === name);
    const click = async (name: string) => {
      button(name)!.click();
      await fixture.whenStable();
    };
    return { fixture, page: fixture.componentInstance, element, text, button, click };
  }

  it('começa só em "Qual quarto?" e Continuar sem quarto pede o quarto', async () => {
    const { page, element, text, click } = await open();
    expect(text('.step-count')).toBe('Passo 1 de 3');
    expect(text('#cleaning-step-title')).toBe('Qual quarto?');
    expect(element.querySelector('sager-cleaning-criteria-fields')).toBeNull();
    expect(element.querySelectorAll('header p')).toHaveLength(1);
    await click('Continuar');
    expect(page.step()).toBe(1);
    expect(text('[role="alert"]')).toBe('Escolha o quarto.');
    expect(document.activeElement?.id).toBe('cleaning-room');
  });

  it('mostra as notas com a média 7,63, mantém ao voltar e envia os mesmos campos', async () => {
    const { page, element, text, click } = await open();
    page.form.controls.roomId.setValue('r1');
    await click('Continuar');
    expect(text('.step-count')).toBe('Passo 2 de 3');
    expect(document.activeElement?.id).toBe('cleaning-step-title');
    expect(element.querySelectorAll('sager-cleaning-criteria-fields input')).toHaveLength(4);
    expect(element.querySelector('#cleaning-observation')).not.toBeNull();
    await click('Continuar');
    expect(page.step()).toBe(2);
    expect(document.activeElement?.id).toBe('cleaning-PISO');
    page.criteria.setValue({ PISO: 8, SUPERFICIES: 7, RESIDUOS: 9, ORGANIZACAO: 6.5 });
    page.form.controls.observation.setValue('Janela suja.');
    await click('Continuar');
    expect(text('#cleaning-step-title')).toBe('Conferir e salvar');
    expect(element.querySelector('dl')?.textContent).toContain('7,63');
    expect(element.querySelector('dl')?.textContent).toContain('Janela suja.');
    await click('Voltar');
    expect(page.step()).toBe(2);
    expect((element.querySelector('#cleaning-PISO') as HTMLInputElement).value).toBe('8');
    expect(text('.comm-help strong')).toBe('7,63');
    await click('Continuar');
    await click('Salvar avaliação');
    expect(api['create']).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'r1',
        timeMode: 'NOW',
        criteria: { PISO: 8, SUPERFICIES: 7, RESIDUOS: 9, ORGANIZACAO: 6.5 },
        observation: 'Janela suja.',
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it('deixa a avaliação de outro dia recolhida e, aberta, pede data e motivo', async () => {
    const { fixture, page, element, text, click } = await open();
    const details = element.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent).toBe('Foi em outro dia?');
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    await fixture.whenStable();
    expect(page.form.controls.timeMode.value).toBe('RETROACTIVE');
    page.form.controls.roomId.setValue('r1');
    await click('Continuar');
    expect(text('[role="alert"]')).toContain('Informe quando foi a avaliação');
    expect(document.activeElement?.id).toBe('cleaning-time');
    page.form.controls.civilTime.setValue('2026-11-13T09:00');
    await click('Continuar');
    expect(document.activeElement?.id).toBe('cleaning-reason');
    page.form.controls.registrationReason.setValue('Sistema fora do ar ontem.');
    await click('Continuar');
    expect(page.step()).toBe(2);
  });

  it('a correção começa em "Notas" com o quarto fixo e pede o motivo ao salvar', async () => {
    id = 'avaliacao';
    const { page, element, text, click, button } = await open();
    expect(text('.step-count')).toBe('Passo 1 de 2');
    expect(text('#cleaning-step-title')).toBe('Notas');
    expect(element.querySelector('#cleaning-room')).toBeNull();
    expect(button('Voltar')).toBeUndefined();
    page.criteria.controls.PISO.setValue(9);
    await click('Continuar');
    expect(text('.step-count')).toBe('Passo 2 de 2');
    await click('Salvar avaliação');
    expect(api['correct']).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('cleaning-correction');
    page.form.controls.correctionReason.setValue('Nota do piso digitada errada.');
    await click('Salvar avaliação');
    expect(api['correct']).toHaveBeenCalledWith('avaliacao', {
      version: 3,
      criteria: { PISO: 9, SUPERFICIES: 5, RESIDUOS: 5, ORGANIZACAO: 5 },
      observation: null,
      reason: 'Nota do piso digitada errada.',
    });
  });
});
