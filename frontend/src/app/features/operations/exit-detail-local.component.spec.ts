import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { ERROR_CONFLICT } from '../../core/error-messages';
import { ExitDetailLocalComponent } from './exit-detail-local.component';
import { OperationsApiError, OperationsLocalApiService } from './operations-local-api.service';
import { ShortExit } from './operations-local.models';
import { LocalReviewData, LocalReviewResult } from './review-dialog-local.component';

const now = '2026-10-02T16:00:00Z';
type Capabilities = ShortExit['capabilities'];
const exit = (over: Partial<ShortExit> = {}, capabilities: Partial<Capabilities> = {}) =>
  ({
    id: 'saida-sintetica',
    residentId: 'residente-sintetico',
    residentName: 'Residente Sintético',
    enrollment: 'TESTE-001',
    departureMode: 'NOW',
    requestedDepartureAt: '2026-10-02T15:59:00Z',
    expectedReturnAt: '2026-10-02T18:00:00Z',
    reason: 'Motivo sintético',
    notes: null,
    status: 'AGUARDANDO_ANALISE',
    decision: null,
    decisionComment: null,
    decidedAt: null,
    actualDepartureAt: null,
    actualReturnAt: null,
    lateObservation: null,
    cancellationReason: null,
    expiryReason: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
    departureRecordedAt: null,
    returnRecordedAt: null,
    deadlineAt: '2026-10-02T18:00:00Z',
    deadlinePassed: false,
    now,
    zone: 'America/Sao_Paulo',
    capabilities: {
      canEdit: false,
      canDecide: false,
      canCancel: false,
      canDepart: false,
      canReturn: false,
      ...capabilities,
    },
    history: [],
    ...over,
  }) as ShortExit;
const waiting = () => exit({}, { canDecide: true, canCancel: true });
const scheduled = (canDepart: boolean) =>
  exit(
    {
      departureMode: 'SCHEDULED',
      requestedDepartureAt: '2026-10-02T17:00:00Z',
      status: 'APROVADA',
      decision: 'APPROVE',
      decidedAt: now,
    },
    { canCancel: true, canDepart },
  );
const leaving = () =>
  exit(
    {
      status: 'EM_ANDAMENTO',
      decision: 'APPROVE',
      decidedAt: now,
      actualDepartureAt: now,
      departureRecordedAt: now,
      deadlineAt: null,
      version: 3,
    },
    { canReturn: true },
  );

describe('Detalhe da saída curta em passos', () => {
  let role: string;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let open: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;
  let dialogResult: LocalReviewResult | undefined;
  const dialogs = { open: (...args: unknown[]) => open(...args), openDialogs: [] as unknown[] };

  beforeEach(() => {
    role = 'supervisor';
    dialogResult = { reason: '', confirmed: false };
    open = vi.fn(() => ({ afterClosed: () => of(dialogResult) }));
    api = {
      exit: vi.fn().mockResolvedValue(waiting()),
      decideExit: vi.fn(),
      cancelExit: vi.fn(),
      physicalExit: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [ExitDetailLocalComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'saida-sintetica' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        {
          provide: DemoSessionService,
          useValue: {
            active: signal(false),
            hasRole: (...roles: string[]) => roles.includes(role),
          },
        },
        { provide: OperationsLocalApiService, useValue: api },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: dialogs });
  });

  async function create(): Promise<ComponentFixture<ExitDetailLocalComponent>> {
    const fixture = TestBed.createComponent(ExitDetailLocalComponent);
    await fixture.whenStable();
    return fixture;
  }
  const actions = (fixture: ComponentFixture<ExitDetailLocalComponent>) =>
    Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('.op-exit-actions :is(button, a.btn)'),
    ).map((button) => button.textContent?.trim());
  const button = (fixture: ComponentFixture<ExitDetailLocalComponent>, name: string) =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === name,
    );
  const reviewData = () => (open.mock.calls[0][1] as { data: LocalReviewData }).data;
  const text = (fixture: ComponentFixture<ExitDetailLocalComponent>) =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('aguardando análise: "Aprovar" principal e "Rejeitar" em vermelho, com o prazo à vista', async () => {
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('#exit-step').textContent.trim()).toBe('Decisão');
    expect(text(fixture)).toContain('Passo 1 de 2');
    expect(actions(fixture)).toEqual(['Aprovar', 'Rejeitar']);
    expect(button(fixture, 'Aprovar')?.classList).toContain('op-primary');
    expect(button(fixture, 'Rejeitar')?.classList).toContain('btn-danger');
    expect(text(fixture)).toContain('Prazo para análise');
    expect(fixture.nativeElement.querySelector('.op-exit-heading .status').dataset.tone).toBe(
      'warning',
    );
  });

  it('a volta aparece como 3 h depois da saída até a partida ser registrada', async () => {
    const before = await create();
    expect(text(before)).toContain('até 3 h depois da saída');
    api['exit'].mockResolvedValue({
      ...leaving(),
      actualDepartureAt: '2026-10-02T17:40:00Z',
      expectedReturnAt: '2026-10-02T20:40:00Z',
    });
    const after = await create();
    expect(text(after)).not.toContain('até 3 h depois da saída');
    expect(text(after)).toContain('02/10/2026, 17:40');
  });

  it('agendada aprovada mostra a hora marcada e, antes da hora, nenhuma ação', async () => {
    api['exit'].mockResolvedValue(scheduled(false));
    const fixture = await create();
    expect(text(fixture)).toContain('Saída marcada para 02/10/2026, 14:00.');
    expect(text(fixture)).toContain('Passo 2 de 3');
    expect(actions(fixture)).toEqual([]);
  });

  it('agendada aprovada na hora pedida: a única ação é "Registrar saída"', async () => {
    api['exit'].mockResolvedValue(scheduled(true));
    const fixture = await create();
    expect(actions(fixture)).toEqual(['Registrar saída']);
  });

  it('em andamento: a única ação é "Registrar volta" e o histórico fica em "Mais detalhes"', async () => {
    api['exit'].mockResolvedValue(leaving());
    const fixture = await create();
    expect(actions(fixture)).toEqual(['Registrar volta']);
    const details: HTMLDetailsElement = fixture.nativeElement.querySelector('details.more-details');
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent?.trim()).toBe('Mais detalhes');
    expect(details.querySelector('h2')?.textContent?.trim()).toBe('Histórico');
  });

  it('"Cancelar pedido" do supervisor fica em "Mais detalhes" e não há "Atualizar dados"', async () => {
    api['exit'].mockResolvedValue(scheduled(false));
    const fixture = await create();
    const details: HTMLElement = fixture.nativeElement.querySelector('details.more-details');
    expect(details.textContent).toContain('Cancelar pedido');
    expect(actions(fixture)).not.toContain('Cancelar pedido');
    expect(button(fixture, 'Atualizar dados')).toBeUndefined();
  });

  it('o residente vê a hora marcada e as suas ações de sempre', async () => {
    role = 'residente';
    api['exit'].mockResolvedValue(
      exit({ status: 'APROVADA', departureMode: 'SCHEDULED' }, { canEdit: true, canCancel: true }),
    );
    const fixture = await create();
    expect(actions(fixture)).toEqual(['Mudar pedido', 'Cancelar pedido']);
    expect(text(fixture)).toContain('Saída marcada para');
  });

  it('aprovar o pedido para sair agora avisa que a saída também é registrada', async () => {
    api['decideExit'].mockResolvedValue(leaving());
    const fixture = await create();
    button(fixture, 'Aprovar')!.click();
    await fixture.whenStable();
    const data: LocalReviewData = reviewData();
    expect(data.title).toBe('A saída será aprovada e registrada agora.');
    expect(data.action).toBe('Aprovar e registrar a saída agora');
    expect(api['decideExit']).toHaveBeenCalledWith(expect.anything(), 'APPROVE', '');
    expect(text(fixture)).toContain('Aprovação e saída registradas.');
    expect(actions(fixture)).toEqual(['Registrar volta']);
  });

  it('aprovar o pedido agendado só registra a aprovação', async () => {
    api['exit'].mockResolvedValue(
      exit(
        { departureMode: 'SCHEDULED', requestedDepartureAt: '2026-10-02T17:00:00Z' },
        { canDecide: true },
      ),
    );
    api['decideExit'].mockResolvedValue(scheduled(false));
    const fixture = await create();
    button(fixture, 'Aprovar')!.click();
    await fixture.whenStable();
    expect(reviewData()).toMatchObject({
      title: 'A saída será aprovada.',
      action: 'Confirmar aprovação',
    });
    expect(text(fixture)).toContain('Aprovação registrada.');
  });

  it('o conflito físico explica o que fazer e não trava as ações', async () => {
    api['decideExit'].mockRejectedValue(new OperationsApiError(409, 'physical_exit_conflict'));
    const fixture = await create();
    button(fixture, 'Aprovar')!.click();
    await fixture.whenStable();
    expect(text(fixture)).toContain(
      'O residente ainda está fora com outra saída. Confirme a volta dela primeiro.',
    );
    expect(button(fixture, 'Aprovar')?.disabled).toBe(false);
    expect(button(fixture, 'Recarregar dados')).toBeUndefined();
  });

  it('"Rejeitar" confirma em uma frase, em vermelho, e a legenda das cores está no detalhe', async () => {
    dialogResult = undefined;
    const fixture = await create();
    button(fixture, 'Rejeitar')!.click();
    await fixture.whenStable();
    expect(reviewData()).toMatchObject({
      title: 'O pedido será rejeitado.',
      action: 'Confirmar rejeição',
      danger: true,
    });
    const legend = fixture.nativeElement.querySelector('sager-status-legend');
    expect(legend.querySelector('summary').textContent).toBe('O que significa cada cor?');
    expect(legend.querySelectorAll('dl > div')).toHaveLength(8);
  });

  it('a volta pede que o supervisor veja o residente pessoalmente', async () => {
    api['exit'].mockResolvedValue(leaving());
    dialogResult = undefined;
    const fixture = await create();
    button(fixture, 'Registrar volta')!.click();
    await fixture.whenStable();
    expect(reviewData().title).toBe('A volta será registrada.');
    expect(reviewData().warning).toBe('Veja o residente pessoalmente antes de confirmar a volta.');
  });

  it('conflito de edição: a volta com o pedido alterado avisa e oferece "Recarregar dados"', async () => {
    api['exit']
      .mockResolvedValueOnce(leaving())
      .mockResolvedValueOnce({ ...leaving(), version: 4 });
    const fixture = await create();
    button(fixture, 'Registrar volta')!.click();
    await fixture.whenStable();
    expect(open).not.toHaveBeenCalled();
    expect(api['physicalExit']).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      ERROR_CONFLICT,
    );
    expect(button(fixture, 'Recarregar dados')).toBeDefined();
  });

  describe('atualização automática', () => {
    beforeEach(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });
    afterEach(() => {
      vi.useRealTimers();
      delete (document as { hidden?: boolean }).hidden;
    });
    const settle = async (fixture: ComponentFixture<ExitDetailLocalComponent>, ms = 1) => {
      await vi.advanceTimersByTimeAsync(ms);
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(1);
    };
    async function start() {
      const fixture = TestBed.createComponent(ExitDetailLocalComponent);
      await settle(fixture);
      return fixture;
    }

    it('o residente vê aos 15 s a aprovação feita pelo supervisor', async () => {
      role = 'residente';
      api['exit'].mockResolvedValue(exit({}, { canEdit: true, canCancel: true }));
      const fixture = await start();
      expect(fixture.nativeElement.querySelector('.op-exit-heading .status').textContent).toContain(
        'Aguardando análise',
      );
      api['exit'].mockResolvedValue(scheduled(false));
      await settle(fixture, 15_000);
      expect(fixture.nativeElement.querySelector('.op-exit-heading .status').textContent).toContain(
        'Aprovada',
      );
      expect(text(fixture)).toContain('Saída marcada para');
      expect(text(fixture)).not.toContain('Carregando pedido');
    });

    it('a mensagem de sucesso continua depois da atualização', async () => {
      api['decideExit'].mockResolvedValue(leaving());
      const fixture = await start();
      button(fixture, 'Aprovar')!.click();
      await settle(fixture);
      expect(text(fixture)).toContain('Aprovação e saída registradas.');
      api['exit'].mockResolvedValue(leaving());
      const calls = api['exit'].mock.calls.length;
      await settle(fixture, 15_000);
      expect(api['exit'].mock.calls.length).toBe(calls + 1);
      expect(text(fixture)).toContain('Aprovação e saída registradas.');
    });

    it('com conflito, só "Recarregar dados" atualiza', async () => {
      api['decideExit'].mockRejectedValue(new OperationsApiError(409, 'version_conflict'));
      const fixture = await start();
      button(fixture, 'Aprovar')!.click();
      await settle(fixture);
      expect(button(fixture, 'Aprovar')?.disabled).toBe(true);
      const calls = api['exit'].mock.calls.length;
      await settle(fixture, 30_000);
      expect(api['exit'].mock.calls.length).toBe(calls);
      button(fixture, 'Recarregar dados')!.click();
      await settle(fixture);
      expect(api['exit'].mock.calls.length).toBe(calls + 1);
      expect(button(fixture, 'Aprovar')?.disabled).toBe(false);
    });
  });
});
