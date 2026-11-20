import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
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
// Pedido agendado de antes de 20/11/2026: a edição manda só o motivo, sempre para agora.
const saved = (overrides = {}) => ({
  id: 'saida-sintetica',
  departureMode: 'SCHEDULED',
  requestedDepartureAt: '2026-09-30T17:00:00Z', // 14:00
  expectedReturnAt: '2026-09-30T19:00:00Z', // 16:00
  reason: 'Buscar material escolar',
  notes: 'Observação sintética',
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
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ExitFormLocalComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      root,
      navigate,
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

  it('cabeçalho com uma frase só', async () => {
    const form = await create();
    expect(form.root.querySelector('.op-heading p')!.textContent).toBe('Diga por que quer sair.');
  });

  it('motivo só com espaços é recusado no próprio campo', async () => {
    const form = await create();
    await form.submit('      ');
    expect(api['saveExit']).not.toHaveBeenCalled();
    expect(form.root.querySelector('.op-field-error')).not.toBeNull();
  });

  it('não pergunta quando sai nem a hora de volta e diz que o prazo conta da saída registrada', async () => {
    const form = await create();
    expect(form.root.querySelector('select')).toBeNull();
    expect(form.root.querySelectorAll('input[type="datetime-local"]')).toHaveLength(0);
    expect(form.root.textContent).not.toContain('Quando você quer sair?');
    expect(form.root.textContent).not.toContain('Que horas você volta?');
    expect(form.root.querySelector('form .op-help')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'Saída curta: até 3 horas a partir da hora em que o supervisor registra sua saída. Vai ficar mais tempo? Peça uma saída longa.',
    );
  });

  it('envia o pedido sempre para agora, sem horário, e abre o aviso "Pedido enviado"', async () => {
    const form = await create();
    await form.submit();
    expect(api['saveExit'].mock.calls[0][0]).toEqual({
      departureMode: 'NOW',
      reason: 'Buscar material escolar',
      notes: null,
    });
    expect(form.navigate).toHaveBeenCalledWith(['/saidas', 'saida-sintetica'], {
      queryParams: { enviado: '1' },
    });
  });

  it('na edição de um pedido agendado antigo envia só o motivo, para agora, e volta com "salvo"', async () => {
    const form = await create('saida-sintetica');
    expect(form.root.querySelector('h1')!.textContent).toBe('Mudar saída curta');
    await form.submit('Buscar material na biblioteca');
    expect(api['saveExit']).toHaveBeenCalledWith(
      {
        departureMode: 'NOW',
        reason: 'Buscar material na biblioteca',
        notes: 'Observação sintética',
      },
      expect.objectContaining({ id: 'saida-sintetica' }),
    );
    expect(form.navigate).toHaveBeenCalledWith(['/saidas', 'saida-sintetica'], {
      queryParams: { saved: '1' },
    });
  });

  it('sobreposição mantém o envio disponível e conflito de versão bloqueia até recarregar', async () => {
    const form = await create();
    api['saveExit'].mockRejectedValueOnce(new OperationsApiError(409, 'overlapping_exit'));
    await form.submit();
    expect(form.root.querySelector('[role="alert"]')!.textContent).toContain(
      'Você já tem outra saída nesse período. Cancele o outro pedido ou espere a volta dele.',
    );
    expect(form.button().disabled).toBe(false);
    expect(form.root.textContent).not.toContain('Recarregar dados');
    api['saveExit'].mockRejectedValueOnce(new OperationsApiError(409, 'stale_version'));
    await form.submit();
    expect(form.button().disabled).toBe(true);
    expect(form.root.textContent).toContain('Recarregar dados');
    await form.fixture.componentInstance.load();
    await form.fixture.whenStable();
    expect(form.button().disabled).toBe(false);
  });

  it('outro conflito oferece recarga sem travar o envio', async () => {
    const form = await create();
    api['saveExit'].mockRejectedValueOnce(new OperationsApiError(409, 'deadline_passed'));
    await form.submit();
    expect(form.root.textContent).toContain('Recarregar dados');
    expect(form.button().disabled).toBe(false);
  });
});
