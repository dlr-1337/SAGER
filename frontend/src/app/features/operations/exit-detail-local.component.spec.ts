import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, from, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { ERROR_CONFLICT } from '../../core/error-messages';
import { LocalAuthService } from '../../core/local-auth.service';
import { ExitDetailLocalComponent } from './exit-detail-local.component';
import { ExitSentDialogComponent } from './exit-sent-dialog.component';
import { OperationsApiError, OperationsLocalApiService } from './operations-local-api.service';
import { ShortExit } from './operations-local.models';
import { LocalReviewData, LocalReviewResult } from './review-dialog-local.component';

const now = '2026-10-02T16:00:00Z';
const presentText =
  'Quando quiser sair, vá até o supervisor. As 3 horas só começam quando ele registrar a sua saída.';
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
/** Pedido para agora aguardando análise: o supervisor registra a saída ou rejeita. */
const waiting = () => exit({}, { canDecide: true, canCancel: true, canDepart: true });
/** Saída curta agendada e aprovada antes de 20/11/2026. */
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
/** Pedido para agora aprovado antes de 20/11/2026, com a saída ainda não registrada. */
const approvedNow = () =>
  exit(
    { status: 'APROVADA', decision: 'APPROVE', decidedAt: now, version: 2 },
    { canCancel: true, canDepart: true },
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
/** Em andamento com o retorno previsto (15:00) já passado no relógio do servidor. */
const overdue = () => ({ ...leaving(), now: '2026-10-02T18:30:00Z' });
const rejected = () =>
  exit({
    status: 'REJEITADA',
    decision: 'REJECT',
    decisionComment: 'Motivo sintético da rejeição',
    decidedAt: now,
    deadlineAt: null,
    version: 2,
  });

describe('Detalhe da saída curta em passos', () => {
  let role: string;
  let query: Record<string, string>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let open: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;
  let dialogResult: LocalReviewResult | undefined;
  const dialogs = { open: (...args: unknown[]) => open(...args), openDialogs: [] as unknown[] };

  beforeEach(() => {
    role = 'supervisor';
    query = {};
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
              get queryParamMap() {
                return convertToParamMap(query);
              },
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
    ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
  const stepTitle = (fixture: ComponentFixture<ExitDetailLocalComponent>) =>
    fixture.nativeElement.querySelector('#exit-step').textContent.trim();
  const status = (fixture: ComponentFixture<ExitDetailLocalComponent>): HTMLElement =>
    fixture.nativeElement.querySelector('.op-exit-heading .status');
  const terms = (fixture: ComponentFixture<ExitDetailLocalComponent>) =>
    Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.op-definition dt')).map(
      (term) => term.textContent?.trim(),
    );

  it('aguardando análise: "Registrar saída" principal e "Rejeitar" em vermelho, sem "Aprovar"', async () => {
    const fixture = await create();
    expect(stepTitle(fixture)).toBe('Saída');
    expect(text(fixture)).toContain('Passo 1 de 2');
    expect(text(fixture)).toContain('Registre a saída quando o residente se apresentar.');
    expect(actions(fixture)).toEqual(['Registrar saída', 'Rejeitar']);
    expect(button(fixture, 'Registrar saída')?.classList).toContain('op-primary');
    expect(button(fixture, 'Rejeitar')?.classList).toContain('btn-danger');
    expect(button(fixture, 'Aprovar')).toBeUndefined();
    expect(text(fixture)).toContain(
      'O pedido vale até 02/10/2026, 15:00. Depois, perde a validade.',
    );
    expect(status(fixture).dataset['tone']).toBe('warning');
  });

  it('"Pedido em" no pedido para agora, sem "Quando", e a decisão só na rejeição ou na aprovada', async () => {
    expect(terms(await create())).toEqual(['Pedido em', 'Retorno previsto', 'Motivo']);
    api['exit'].mockResolvedValue(leaving());
    expect(terms(await create())).toEqual(['Pedido em', 'Retorno previsto', 'Motivo', 'Saiu em']);
    api['exit'].mockResolvedValue(scheduled(false));
    expect(terms(await create())).toEqual([
      'Saída agendada para',
      'Retorno previsto',
      'Motivo',
      'Decisão',
    ]);
    api['exit'].mockResolvedValue(rejected());
    const refused = await create();
    expect(terms(refused)).toEqual([
      'Pedido em',
      'Retorno previsto',
      'Motivo',
      'Decisão',
      'Comentário da análise',
    ]);
    expect(text(refused)).toContain('Rejeitada · 02/10/2026, 13:00');
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
    expect(text(fixture)).toContain('Passo 1 de 2');
    expect(actions(fixture)).toEqual([]);
  });

  it('agendada aprovada na hora pedida: a única ação é "Registrar saída"', async () => {
    api['exit'].mockResolvedValue(scheduled(true));
    const fixture = await create();
    expect(actions(fixture)).toEqual(['Registrar saída']);
  });

  it('a saída aprovada antes da mudança também fica no passo "Saída", sem "Rejeitar"', async () => {
    api['exit'].mockResolvedValue(approvedNow());
    const fixture = await create();
    expect(stepTitle(fixture)).toBe('Saída');
    expect(text(fixture)).toContain('Passo 1 de 2');
    expect(text(fixture)).toContain('Decisão Aprovada · 02/10/2026, 13:00');
    expect(actions(fixture)).toEqual(['Registrar saída']);
  });

  it('em andamento: "Volta até" e a única ação é "Registrar volta", com o histórico em "Mais detalhes"', async () => {
    api['exit'].mockResolvedValue(leaving());
    const fixture = await create();
    expect(stepTitle(fixture)).toBe('Volta');
    expect(text(fixture)).toContain('Passo 2 de 2');
    expect(text(fixture)).toContain('Volta até 02/10/2026, 15:00.');
    expect(actions(fixture)).toEqual(['Registrar volta']);
    const details: HTMLDetailsElement = fixture.nativeElement.querySelector('details.more-details');
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent?.trim()).toBe('Mais detalhes');
    expect(details.querySelector('h2')?.textContent?.trim()).toBe('Histórico');
  });

  it('em andamento com a volta passada: selo "Atrasada" em vermelho e "A volta era até"', async () => {
    api['exit'].mockResolvedValue(overdue());
    const fixture = await create();
    expect(status(fixture).textContent?.trim()).toBe('Atrasada');
    expect(status(fixture).dataset['tone']).toBe('danger');
    expect(text(fixture)).toContain('A volta era até 02/10/2026, 15:00.');
    expect(actions(fixture)).toEqual(['Registrar volta']);
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
      exit(
        {
          status: 'APROVADA',
          departureMode: 'SCHEDULED',
          requestedDepartureAt: '2026-10-02T17:00:00Z',
        },
        { canEdit: true, canCancel: true },
      ),
    );
    const fixture = await create();
    expect(actions(fixture)).toEqual(['Mudar pedido', 'Cancelar pedido']);
    expect(text(fixture)).toContain('Saída marcada para 02/10/2026, 14:00.');
  });

  it('o residente com o pedido aguardando vê em destaque "Apresente-se ao supervisor"', async () => {
    role = 'residente';
    api['exit'].mockResolvedValue(exit({}, { canEdit: true, canCancel: true }));
    const fixture = await create();
    const present: HTMLElement = fixture.nativeElement.querySelector('.op-present');
    expect(present.querySelector('h2')?.textContent?.trim()).toBe('Apresente-se ao supervisor');
    expect(present.querySelector('p')?.textContent?.trim()).toBe(presentText);
    expect(present.classList).not.toContain('op-present-late');
    expect(actions(fixture)).toEqual(['Mudar pedido', 'Cancelar pedido']);
    expect(text(fixture)).not.toContain('O que você pode fazer');
    expect(text(fixture)).not.toContain('O supervisor registra a saída e a volta.');
    expect(text(fixture)).not.toContain('Nenhuma ação disponível');
  });

  it('o residente com a saída aprovada e a hora chegada procura o supervisor', async () => {
    role = 'residente';
    api['exit'].mockResolvedValue(approvedNow());
    const fixture = await create();
    expect(stepTitle(fixture)).toBe('Apresente-se ao supervisor');
    expect(text(fixture)).toContain(presentText);
    expect(text(fixture)).not.toContain('Saída marcada para');
  });

  it('o residente fora vê até quando volta e, passado o prazo, "Volta atrasada"', async () => {
    role = 'residente';
    api['exit'].mockResolvedValue(leaving());
    const onTime = await create();
    expect(stepTitle(onTime)).toBe('Volte até 02/10/2026, 15:00');
    expect(text(onTime)).toContain('Apresente-se ao supervisor ao voltar.');
    expect(status(onTime).textContent?.trim()).toBe('Em andamento');
    api['exit'].mockResolvedValue(overdue());
    const late = await create();
    expect(stepTitle(late)).toBe('Volta atrasada');
    expect(text(late)).toContain(
      'A volta era até 02/10/2026, 15:00. Apresente-se ao supervisor ao voltar.',
    );
    expect(late.nativeElement.querySelector('.op-present').classList).toContain('op-present-late');
    expect(status(late).textContent?.trim()).toBe('Atrasada');
    expect(text(late)).not.toContain('Nenhuma ação disponível');
  });

  it('o residente maior de idade só consulta: sem "Apresente-se ao supervisor" e sem ações', async () => {
    role = 'residente';
    TestBed.inject(LocalAuthService).principal.set({
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Residente Sintético',
      email: null,
      matricula: 'TESTE-001',
      fotoUrl: null,
      perfis: ['residente'],
      residenteId: 'residente-sintetico',
      supervisorId: null,
      maiorDeIdade: true,
    });
    api['exit'].mockResolvedValue(exit({}, { canEdit: true, canCancel: true }));
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('.op-present')).toBeNull();
    expect(stepTitle(fixture)).toBe('Próximo passo');
    expect(text(fixture)).not.toContain('Apresente-se ao supervisor');
    expect(text(fixture)).toContain('Nenhuma ação disponível para este pedido.');
    expect(actions(fixture)).toEqual([]);
  });

  it('o residente maior de idade só consulta: sem "Apresente-se ao supervisor" nem ações', async () => {
    role = 'residente';
    TestBed.inject(LocalAuthService).principal.set({
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Residente Sintético',
      email: null,
      matricula: 'TESTE-001',
      fotoUrl: null,
      perfis: ['residente'],
      residenteId: 'residente-sintetico',
      supervisorId: null,
      maiorDeIdade: true,
    });
    api['exit'].mockResolvedValue(exit({}, { canEdit: true, canCancel: true }));
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('.op-present')).toBeNull();
    expect(stepTitle(fixture)).toBe('Próximo passo');
    expect(text(fixture)).not.toContain('Apresente-se ao supervisor');
    expect(text(fixture)).toContain('Nenhuma ação disponível para este pedido.');
    expect(actions(fixture)).toEqual([]);
  });

  it('com ?enviado=1 abre a janela "Pedido enviado" e limpa o endereço', async () => {
    role = 'residente';
    query = { enviado: '1' };
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    api['exit'].mockResolvedValue(exit({}, { canEdit: true, canCancel: true }));
    const fixture = await create();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toBe(ExitSentDialogComponent);
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: {},
      replaceUrl: true,
    });
    expect(text(fixture)).not.toContain('Pedido salvo.');
  });

  it('com ?saved=1 mostra "Pedido salvo." sem a janela e também limpa o endereço', async () => {
    role = 'residente';
    query = { saved: '1' };
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    api['exit'].mockResolvedValue(exit({}, { canEdit: true, canCancel: true }));
    const fixture = await create();
    expect(open).not.toHaveBeenCalled();
    expect(text(fixture)).toContain('Pedido salvo.');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: {}, replaceUrl: true }),
    );
  });

  it('sem aviso no endereço, não abre a janela nem mexe no endereço', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await create();
    expect(open).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('"Registrar saída" no pedido aguardando análise libera e começa a saída no mesmo ato', async () => {
    api['physicalExit'].mockResolvedValue(leaving());
    dialogResult = { reason: '', confirmed: false, physical: { version: 1, timeMode: 'NOW' } };
    // Como o diálogo real, a escolha chega depois do clique, fora da mesma tarefa.
    open = vi.fn(() => ({ afterClosed: () => from(Promise.resolve(dialogResult)) }));
    const fixture = await create();
    button(fixture, 'Registrar saída')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    expect(reviewData()).toMatchObject({
      title: 'A saída será registrada.',
      action: 'Confirmar saída',
      warning: 'Veja o residente pessoalmente antes de liberar a saída.',
    });
    expect(reviewData().lines).toContainEqual({ label: 'Pedido em', value: '02/10/2026, 12:59' });
    // Sem aprovação antes: o horário anterior não pode vir antes do pedido.
    expect(reviewData().physical!.minimum).toBe('2026-10-02T15:59:00Z');
    expect(api['decideExit']).not.toHaveBeenCalled();
    expect(api['physicalExit']).toHaveBeenCalledWith('saida-sintetica', 'partida', {
      version: 1,
      timeMode: 'NOW',
    });
    expect(text(fixture)).toContain('Saída registrada. Volta até 02/10/2026, 15:00.');
    expect(stepTitle(fixture)).toBe('Volta');
    expect(text(fixture)).toContain('Passo 2 de 2');
    expect(actions(fixture)).toEqual(['Registrar volta']);
  });

  it.each([
    { name: 'Registrar saída', current: waiting },
    { name: 'Registrar volta', current: leaving },
  ])(
    'fechar sem confirmar devolve o foco a "$name" e não grava nada',
    async ({ name, current }) => {
      api['exit'].mockResolvedValue(current());
      const closed = new Subject<LocalReviewResult | undefined>();
      open = vi.fn(() => ({ afterClosed: () => closed }));
      const fixture = await create();
      const trigger = button(fixture, name)!;
      trigger.focus();
      trigger.click();
      await fixture.whenStable();
      expect(open).toHaveBeenCalledTimes(1);
      // O diálogo real tira o foco da página enquanto está aberto.
      trigger.blur();
      expect(document.activeElement).not.toBe(trigger);
      closed.next(undefined);
      closed.complete();
      await fixture.whenStable();
      expect(document.activeElement).toBe(trigger);
      expect(api['physicalExit']).not.toHaveBeenCalled();
      expect(trigger.disabled).toBe(false);
    },
  );

  it('o conflito físico ao registrar a saída explica o que fazer e não trava as ações', async () => {
    api['exit'].mockResolvedValue(approvedNow());
    api['physicalExit'].mockRejectedValue(new OperationsApiError(409, 'physical_exit_conflict'));
    dialogResult = { reason: '', confirmed: false, physical: { version: 2, timeMode: 'NOW' } };
    // Como o diálogo real, a escolha chega depois do clique, fora da mesma tarefa.
    open = vi.fn(() => ({ afterClosed: () => from(Promise.resolve(dialogResult)) }));
    const fixture = await create();
    button(fixture, 'Registrar saída')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    expect(reviewData().title).toBe('A saída será registrada.');
    expect(reviewData().warning).toBe('Veja o residente pessoalmente antes de liberar a saída.');
    // Pedida às 15h59 e aprovada às 16h00 (UTC): o horário anterior não pode vir antes da aprovação.
    expect(reviewData().physical!.minimum).toBe(now);
    expect(api['physicalExit']).toHaveBeenCalledWith('saida-sintetica', 'partida', {
      version: 2,
      timeMode: 'NOW',
    });
    expect(text(fixture)).toContain(
      'O residente ainda está fora com outra saída. Confirme a volta dela primeiro.',
    );
    expect(button(fixture, 'Registrar saída')?.disabled).toBe(false);
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
      requireReason: true,
      danger: true,
    });
    expect(api['decideExit']).not.toHaveBeenCalled();
    const legend = fixture.nativeElement.querySelector('sager-status-legend');
    expect(legend.querySelector('summary').textContent).toBe('O que significa cada cor?');
    expect(
      Array.from<HTMLElement>(legend.querySelectorAll('dl > div dt')).map((term) =>
        term.textContent?.trim(),
      ),
    ).toEqual([
      'Aguardando análise',
      'Aprovada',
      'Em andamento',
      'Atrasada',
      'Retorno confirmado',
      'Retorno confirmado com atraso',
      'Rejeitada',
      'Cancelada',
      'Expirada',
    ]);
    expect(legend.textContent).toContain('Falta o supervisor registrar a saída.');
  });

  it('"Rejeitar" com o motivo grava só a rejeição e encerra os passos', async () => {
    dialogResult = { reason: 'Motivo sintético da rejeição', confirmed: false };
    api['decideExit'].mockResolvedValue(rejected());
    const fixture = await create();
    button(fixture, 'Rejeitar')!.click();
    await fixture.whenStable();
    expect(api['decideExit']).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'saida-sintetica', version: 1 }),
      'REJECT',
      'Motivo sintético da rejeição',
    );
    expect(api['physicalExit']).not.toHaveBeenCalled();
    expect(text(fixture)).toContain('Rejeição registrada.');
    expect(status(fixture).textContent?.trim()).toBe('Rejeitada');
    expect(actions(fixture)).toEqual([]);
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

    it('o residente vê aos 15 s a saída registrada pelo supervisor', async () => {
      role = 'residente';
      api['exit'].mockResolvedValue(exit({}, { canEdit: true, canCancel: true }));
      const fixture = await start();
      expect(status(fixture).textContent).toContain('Aguardando análise');
      expect(stepTitle(fixture)).toBe('Apresente-se ao supervisor');
      api['exit'].mockResolvedValue(leaving());
      await settle(fixture, 15_000);
      expect(status(fixture).textContent).toContain('Em andamento');
      expect(stepTitle(fixture)).toBe('Volte até 02/10/2026, 15:00');
      expect(text(fixture)).not.toContain('Carregando pedido');
    });

    it('a mensagem de sucesso continua depois da atualização', async () => {
      dialogResult = { reason: 'Motivo sintético da rejeição', confirmed: false };
      api['decideExit'].mockResolvedValue(rejected());
      const fixture = await start();
      button(fixture, 'Rejeitar')!.click();
      await settle(fixture);
      expect(text(fixture)).toContain('Rejeição registrada.');
      api['exit'].mockResolvedValue(rejected());
      const calls = api['exit'].mock.calls.length;
      await settle(fixture, 15_000);
      expect(api['exit'].mock.calls.length).toBe(calls + 1);
      expect(text(fixture)).toContain('Rejeição registrada.');
    });

    it('com conflito, só "Recarregar dados" atualiza', async () => {
      api['decideExit'].mockRejectedValue(new OperationsApiError(409, 'version_conflict'));
      const fixture = await start();
      button(fixture, 'Rejeitar')!.click();
      await settle(fixture);
      expect(button(fixture, 'Rejeitar')?.disabled).toBe(true);
      expect(button(fixture, 'Registrar saída')?.disabled).toBe(true);
      const calls = api['exit'].mock.calls.length;
      await settle(fixture, 30_000);
      expect(api['exit'].mock.calls.length).toBe(calls);
      button(fixture, 'Recarregar dados')!.click();
      await settle(fixture);
      expect(api['exit'].mock.calls.length).toBe(calls + 1);
      expect(button(fixture, 'Rejeitar')?.disabled).toBe(false);
      expect(button(fixture, 'Registrar saída')?.disabled).toBe(false);
    });
  });
});

describe('Janela "Pedido enviado"', () => {
  it('diz para procurar o supervisor e fecha em "Entendi"', async () => {
    const close = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: MatDialogRef, useValue: { close } }] });
    const fixture = TestBed.createComponent(ExitSentDialogComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h2')?.textContent?.trim()).toBe('Pedido enviado');
    expect(element.querySelector('.exit-sent-text')?.textContent?.trim()).toBe(presentText);
    const buttons = Array.from(element.querySelectorAll('button'));
    expect(buttons.map((item) => item.textContent?.trim())).toEqual(['Entendi']);
    buttons[0].click();
    expect(close).toHaveBeenCalled();
  });
});
