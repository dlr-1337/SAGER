import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from '../../core/session.service';
import { LongExitApiService } from './long-exit-api.service';
import { LongExitFormComponent } from './long-exit-form.component';
import { OperationsApiError } from './operations-local-api.service';

const now = '2026-09-30T16:00:20Z'; // 13:00:20 em São Paulo
const guardianId = 'responsavel-sintetico';
const eligibility = (at = now) => ({
  eligible: true,
  blockers: [],
  residentName: 'Estudante Sintético',
  enrollment: 'TESTE-001',
  roomNumber: '101',
  guardians: [
    { id: guardianId, name: 'Responsável Sintético', relationship: 'Mãe', eligible: true },
  ],
  providers: { whatsappEnabled: true },
  now: at,
});

describe('Formulário de saída longa', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['performance'] });
    api = {
      eligibility: vi.fn().mockResolvedValue(eligibility()),
      get: vi.fn().mockResolvedValue({
        id: 'saida-sintetica',
        departureMode: 'SCHEDULED',
        guardianId,
        requestedDepartureAt: '2026-09-30T17:00:00Z', // 14:00
        expectedReturnAt: '2026-09-30T22:00:00Z', // 19:00
        reason: 'Visita à família',
        notes: null,
        capabilities: { canEdit: true },
      }),
      save: vi.fn().mockResolvedValue({ id: 'saida-sintetica' }),
    };
  });
  afterEach(() => vi.useRealTimers());

  async function create(id = '') {
    TestBed.configureTestingModule({
      imports: [LongExitFormComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
        {
          provide: SessionService,
          useValue: { active: signal(false), hasRole: (role: string) => role === 'residente' },
        },
        { provide: LongExitApiService, useValue: api },
      ],
    });
    const fixture = TestBed.createComponent(LongExitFormComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const inputs = () => root.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    const select = (name: string) =>
      root.querySelector<HTMLSelectElement>(`select[formcontrolname="${name}"]`)!;
    const choose = async (name: string, value: string) => {
      select(name).value = value;
      select(name).dispatchEvent(new Event('change', { bubbles: true }));
      await fixture.whenStable();
    };
    await choose('guardianId', guardianId);
    return {
      fixture,
      root,
      departure: () => inputs()[0],
      expectedReturn: () => inputs()[inputs().length - 1],
      async type(input: HTMLInputElement, value: string) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await fixture.whenStable();
      },
      mode: (value: 'NOW' | 'SCHEDULED') => choose('departureMode', value),
      async submit() {
        const textarea = root.querySelector('textarea')!;
        textarea.value = 'Visita à família';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
        await fixture.whenStable();
        await vi.waitFor(() => expect(fixture.componentInstance.saving()).toBe(false));
        await fixture.whenStable();
      },
      button: () => root.querySelector<HTMLButtonElement>('button[type="submit"]')!,
    };
  }

  it('sugere quatro horas, começa o agendamento vazio e acompanha a partida', async () => {
    const form = await create();
    expect(form.expectedReturn().value).toBe('2026-09-30T17:00');
    await form.mode('SCHEDULED');
    expect(form.departure().value).toBe('');
    expect(form.expectedReturn().value).toBe('');
    await form.type(form.departure(), '2026-09-30T14:00');
    expect(form.expectedReturn().value).toBe('2026-09-30T18:00');
  });

  it('preserva a edição válida e anuncia o ajuste da que saiu do limite', async () => {
    const form = await create();
    await form.mode('SCHEDULED');
    await form.type(form.departure(), '2026-09-30T14:00');
    await form.type(form.expectedReturn(), '2026-09-30T20:00');
    await form.type(form.departure(), '2026-09-30T14:10');
    expect(form.expectedReturn().value).toBe('2026-09-30T20:00');
    await form.type(form.departure(), '2026-09-30T18:00');
    expect(form.expectedReturn().value).toBe('2026-09-30T22:00');
    const status = form.root.querySelector('[role="status"]')!.textContent!;
    expect(status).toContain('22:00');
    expect(status).toContain('não dava');
  });

  it('mantém o retorno salvo ao editar', async () => {
    const form = await create('saida-sintetica');
    expect(form.departure().value).toBe('2026-09-30T14:00');
    await form.type(form.departure(), '2026-09-30T15:00');
    expect(form.expectedReturn().value).toBe('2026-09-30T19:00');
  });

  it('mostra duração e limite mínimo, sem máximo, antes do envio', async () => {
    const form = await create();
    await form.mode('SCHEDULED');
    expect(form.departure().min).toBe('2026-09-30T13:01');
    await form.type(form.departure(), '2026-09-30T14:00');
    expect(form.expectedReturn().min).toBe('2026-09-30T17:01');
    expect(form.expectedReturn().max).toBe('');
    expect(form.root.querySelector('#long-exit-period-hint')!.textContent).toContain(
      'Duração: 4 h',
    );
    await form.type(form.expectedReturn(), '2026-09-30T17:00');
    expect(form.root.querySelector('.op-field-error')!.textContent).toContain('mais de 3 horas');
    await form.type(form.expectedReturn(), '2026-09-30T17:01');
    expect(form.root.querySelector('.op-field-error')).toBeNull();
  });

  it('formulário parado envia retorno sugerido a partir do horário atual do servidor', async () => {
    const form = await create();
    vi.advanceTimersByTime(2 * 3_600_000);
    api['eligibility'].mockResolvedValue(eligibility('2026-09-30T18:00:40Z'));
    await form.submit();
    expect(api['save'].mock.calls[0][0].expectedReturnAt).toBe('2026-09-30T22:00:00.000Z');
  });

  it('retorno editado parado é enviado sem recalcular e bloqueia só se sair do limite', async () => {
    const form = await create();
    await form.type(form.expectedReturn(), '2026-09-30T20:00');
    vi.advanceTimersByTime(30 * 60_000);
    await form.submit();
    expect(api['save'].mock.calls[0][0].expectedReturnAt).toBe('2026-09-30T23:00:00.000Z');
  });

  it('exige partida ao agendar, com erro junto ao campo', async () => {
    const form = await create();
    await form.mode('SCHEDULED');
    await form.submit();
    expect(api['save']).not.toHaveBeenCalled();
    expect(form.root.querySelector('.op-field-error')!.textContent).toContain(
      'data e hora de saída',
    );
    await form.mode('NOW');
    await form.submit();
    expect(api['save']).toHaveBeenCalledTimes(1);
  });

  it('sobreposição não trava; conflito de versão trava', async () => {
    const form = await create();
    api['save'].mockRejectedValueOnce(new OperationsApiError(409, 'overlapping_exit'));
    await form.submit();
    expect(form.root.querySelector('[role="alert"]')!.textContent).toContain('nesse horário');
    expect(form.button().disabled).toBe(false);
    api['save'].mockRejectedValueOnce(new OperationsApiError(409, 'stale_version'));
    await form.submit();
    expect(form.button().disabled).toBe(true);
  });
});
