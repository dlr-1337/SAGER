import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { ExitFormLocalComponent } from './exit-form-local.component';
import { OperationsApiError, OperationsLocalApiService } from './operations-local-api.service';

const now = '2026-09-30T16:00:20Z'; // 13:00:20 em São Paulo
const eligibility = (at = now) => ({
  eligible: true,
  blockers: [],
  residentName: 'Estudante Sintético',
  enrollment: 'TESTE-001',
  roomNumber: '101',
  now: at,
});
const saved = (overrides = {}) => ({
  id: 'saida-sintetica',
  departureMode: 'SCHEDULED',
  requestedDepartureAt: '2026-09-30T17:00:00Z', // 14:00
  expectedReturnAt: '2026-09-30T19:00:00Z', // 16:00
  reason: 'Buscar material escolar',
  notes: null,
  capabilities: { canEdit: true },
  ...overrides,
});

describe('Formulário local de saída curta', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['performance'] });
    api = {
      eligibility: vi.fn().mockResolvedValue(eligibility()),
      exit: vi.fn().mockResolvedValue(saved()),
      saveExit: vi.fn().mockResolvedValue({ id: 'saida-sintetica' }),
    };
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  async function create(id = '') {
    TestBed.configureTestingModule({
      imports: [ExitFormLocalComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
        {
          provide: DemoSessionService,
          useValue: { hasRole: (role: string) => role === 'residente' },
        },
        { provide: OperationsLocalApiService, useValue: api },
      ],
    });
    const fixture = TestBed.createComponent(ExitFormLocalComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const inputs = () => root.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    const departure = () => inputs()[0];
    const expectedReturn = () => inputs()[inputs().length - 1];
    return {
      fixture,
      root,
      departure,
      expectedReturn,
      async type(input: HTMLInputElement, value: string) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await fixture.whenStable();
      },
      async mode(value: 'NOW' | 'SCHEDULED') {
        const select = root.querySelector('select')!;
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await fixture.whenStable();
      },
      async submit(reason = 'Buscar material escolar') {
        const textarea = root.querySelector('textarea')!;
        textarea.value = reason;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
        await fixture.whenStable();
        await vi.waitFor(() => expect(fixture.componentInstance.saving()).toBe(false));
        await fixture.whenStable();
      },
      button: () => root.querySelector<HTMLButtonElement>('button[type="submit"]')!,
    };
  }

  it('motivo só com espaços é recusado no próprio campo', async () => {
    const form = await create();
    await form.submit('      ');
    expect(api['saveExit']).not.toHaveBeenCalled();
    expect(form.root.querySelector('.op-field-error')).not.toBeNull();
  });

  it('acompanha a partida enquanto o retorno não foi editado', async () => {
    const form = await create();
    expect(form.expectedReturn().value).toBe('2026-09-30T16:00');
    await form.mode('SCHEDULED');
    expect(form.departure().value).toBe('');
    expect(form.expectedReturn().value).toBe('');
    await form.type(form.departure(), '2026-09-30T14:00');
    expect(form.expectedReturn().value).toBe('2026-09-30T17:00');
    await form.type(form.departure(), '2026-09-30T15:00');
    expect(form.expectedReturn().value).toBe('2026-09-30T18:00');
    expect(form.root.querySelector('[role="status"]')!.textContent!.trim()).toBe('');
  });

  it('preserva a edição manual válida ao mudar a partida e o modo', async () => {
    const form = await create();
    await form.mode('SCHEDULED');
    await form.type(form.departure(), '2026-09-30T14:00');
    await form.type(form.expectedReturn(), '2026-09-30T15:30');
    await form.type(form.departure(), '2026-09-30T14:10');
    expect(form.expectedReturn().value).toBe('2026-09-30T15:30');
    await form.mode('NOW');
    expect(form.expectedReturn().value).toBe('2026-09-30T15:30');
  });

  it('substitui e anuncia o retorno editado que ficou fora do limite, voltando a sugerir', async () => {
    const form = await create();
    await form.mode('SCHEDULED');
    await form.type(form.departure(), '2026-09-30T14:00');
    await form.type(form.expectedReturn(), '2026-09-30T15:30');
    await form.type(form.departure(), '2026-09-30T16:00');
    expect(form.expectedReturn().value).toBe('2026-09-30T19:00');
    const status = form.root.querySelector('[role="status"]')!.textContent!;
    expect(status).toContain('19:00');
    expect(status).toContain('não dava');
    await form.type(form.departure(), '2026-09-30T16:10');
    expect(form.expectedReturn().value).toBe('2026-09-30T19:10');
    expect(form.root.querySelector('[role="status"]')!.textContent!.trim()).toBe('');
  });

  it('mantém o retorno salvo ao editar e o limite continua valendo', async () => {
    const form = await create('saida-sintetica');
    expect(form.departure().value).toBe('2026-09-30T14:00');
    expect(form.expectedReturn().value).toBe('2026-09-30T16:00');
    await form.type(form.departure(), '2026-09-30T14:30');
    expect(form.expectedReturn().value).toBe('2026-09-30T16:00');
    await form.type(form.departure(), '2026-09-30T16:30');
    expect(form.expectedReturn().value).toBe('2026-09-30T19:30');
  });

  it('não reaproveita a partida de um pedido NOW ao agendar na edição', async () => {
    api['exit'].mockResolvedValue(saved({ departureMode: 'NOW', requestedDepartureAt: now }));
    const form = await create('saida-sintetica');
    await form.mode('SCHEDULED');
    expect(form.departure().value).toBe('');
    expect(form.expectedReturn().value).toBe('2026-09-30T16:00');
  });

  it('mostra duração, limites e erro junto ao campo no horário de São Paulo', async () => {
    vi.stubEnv('TZ', 'Pacific/Auckland');
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-780);
    const form = await create();
    await form.mode('SCHEDULED');
    expect(form.departure().min).toBe('2026-09-30T13:01');
    await form.type(form.departure(), '2026-09-30T14:00');
    await form.type(form.expectedReturn(), '2026-09-30T16:30');
    expect(form.root.querySelector('#exit-period-hint')!.textContent).toContain(
      'Duração: 2 h 30 min (máx. 3 h)',
    );
    expect(form.expectedReturn().min).toBe('2026-09-30T14:01');
    expect(form.expectedReturn().max).toBe('2026-09-30T17:00');
    expect(form.root.querySelector('.op-field-error')).toBeNull();
    await form.type(form.expectedReturn(), '2026-09-30T17:01');
    expect(form.root.querySelector('.op-field-error')!.textContent).toContain('3 horas');
  });

  it('usa o horário do servidor mais o tempo decorrido ao voltar para Agora', async () => {
    const form = await create();
    await form.mode('SCHEDULED');
    vi.advanceTimersByTime(50 * 60_000);
    await form.mode('NOW');
    expect(form.expectedReturn().value).toBe('2026-09-30T16:50');
  });

  it('recalcula no envio somente o retorno não editado no modo Agora', async () => {
    const form = await create();
    vi.advanceTimersByTime(30 * 60_000);
    api['eligibility'].mockResolvedValue(eligibility('2026-09-30T16:30:40Z'));
    await form.submit();
    expect(api['saveExit'].mock.calls[0][0].expectedReturnAt).toBe('2026-09-30T19:30:00.000Z');
    expect(form.expectedReturn().value).toBe('2026-09-30T16:30');
  });

  it('não altera no envio o retorno editado no modo Agora', async () => {
    const form = await create();
    await form.type(form.expectedReturn(), '2026-09-30T15:00');
    vi.advanceTimersByTime(30 * 60_000);
    api['eligibility'].mockResolvedValue(eligibility('2026-09-30T16:30:40Z'));
    await form.submit();
    expect(api['saveExit'].mock.calls[0][0].expectedReturnAt).toBe('2026-09-30T18:00:00.000Z');
  });

  it('pede a partida ao agendar e não trava ao voltar para Agora', async () => {
    const form = await create();
    await form.mode('SCHEDULED');
    await form.submit();
    expect(api['saveExit']).not.toHaveBeenCalled();
    expect(form.root.querySelector('.op-field-error')!.textContent).toContain(
      'data e hora de saída',
    );
    await form.mode('NOW');
    await form.submit();
    expect(api['saveExit']).toHaveBeenCalledTimes(1);
  });

  it('sobreposição mantém o envio disponível e conflito de versão bloqueia até recarregar', async () => {
    const form = await create();
    api['saveExit'].mockRejectedValueOnce(new OperationsApiError(409, 'overlapping_exit'));
    await form.submit();
    expect(form.root.querySelector('[role="alert"]')!.textContent).toContain('nesse horário');
    expect(form.button().disabled).toBe(false);
    expect(form.root.textContent).not.toContain('Recarregar dados');
    api['saveExit'].mockRejectedValueOnce(new OperationsApiError(409, 'stale_version'));
    await form.submit();
    expect(form.button().disabled).toBe(true);
    expect(form.root.textContent).toContain('Recarregar dados');
    await form.fixture.componentInstance.load();
    await form.fixture.whenStable();
    expect(form.button().disabled).toBe(false);
    expect(form.expectedReturn().value).toBe('2026-09-30T16:00');
    await form.mode('SCHEDULED');
    await form.type(form.departure(), '2026-09-30T14:00');
    expect(form.expectedReturn().value).toBe('2026-09-30T17:00');
  });

  it('outro conflito oferece recarga sem travar o envio', async () => {
    const form = await create();
    api['saveExit'].mockRejectedValueOnce(new OperationsApiError(409, 'deadline_passed'));
    await form.submit();
    expect(form.root.textContent).toContain('Recarregar dados');
    expect(form.button().disabled).toBe(false);
  });
});
