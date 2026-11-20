import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { LongExitApiService } from './long-exit-api.service';
import { LongExitDetailComponent } from './long-exit-detail.component';
import {
  AuthorizationBinding,
  AuthorizationFile,
  LongExit,
  LongExitCapabilities,
  ReceivedFile,
} from './long-exit.models';
import { LocalReviewData, LocalReviewResult } from './review-dialog-local.component';

const now = '2026-10-02T16:00:00Z';
const revision = '00000000-0000-0000-0000-00000000d001';
const binding = (over: Partial<AuthorizationBinding> = {}): AuthorizationBinding => ({
  id: 'vinculo-sintetico',
  documentVersionId: revision,
  guardianId: 'responsavel-sintetico',
  guardianName: 'Responsável Sintético',
  status: 'PENDING',
  messageStatus: 'SENT',
  expiresAt: '2026-10-02T18:00:00Z',
  createdAt: now,
  revokedAt: null,
  signedAt: null,
  verifiedAt: null,
  verifiedBy: null,
  verifiedByName: null,
  failureCode: null,
  ...over,
});
const file = (over: Partial<AuthorizationFile> = {}): AuthorizationFile => ({
  id: 'arquivo-sintetico',
  documentVersionId: revision,
  bindingId: 'vinculo-sintetico',
  origin: 'WHATSAPP',
  state: 'CANDIDATE',
  mediaType: 'application/pdf',
  size: 1000,
  sha256: 'a'.repeat(64),
  senderPhone: '+55 64 90000-0000',
  senderDivergent: false,
  receivedAt: now,
  decidedBy: null,
  decidedByName: null,
  decidedAt: null,
  decisionReason: null,
  ...over,
});
const longExit = (over: Partial<LongExit> = {}, caps: Partial<LongExitCapabilities> = {}) =>
  ({
    id: 'saida-longa-sintetica',
    residentId: 'residente-sintetico',
    residentName: 'Residente Sintético',
    enrollment: 'TESTE-001',
    departureMode: 'NOW',
    requestedDepartureAt: '2026-10-02T15:59:00Z',
    expectedReturnAt: '2026-10-04T18:00:00Z',
    reason: 'Visita à família',
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
    guardianId: 'responsavel-sintetico',
    guardianName: 'Responsável Sintético',
    guardianRelationship: 'Mãe',
    signatureStatus: 'PENDING',
    messageStatus: 'SENT',
    currentDocument: {
      documentVersionId: revision,
      revisionNumber: 1,
      originalState: 'AVAILABLE',
      signedState: 'MISSING',
    },
    bindings: [binding()],
    authorizationFiles: [],
    whatsappAvailable: true,
    deliveryUnconfirmed: false,
    resendAvailableAt: null,
    remainingResends: 3,
    signedAt: null,
    capabilities: {
      canEdit: false,
      canApprove: false,
      canReject: true,
      canCancel: true,
      canDepart: false,
      canReturn: false,
      canResend: true,
      canAttachAuthorization: true,
      canDownloadOriginal: true,
      canDownloadSigned: false,
      ...caps,
    },
    history: [],
    ...over,
  }) as LongExit;
const verified = () =>
  longExit(
    {
      signatureStatus: 'VALID',
      signedAt: now,
      bindings: [binding({ status: 'VALID', verifiedAt: now, verifiedByName: 'Supervisor Teste' })],
      authorizationFiles: [file({ state: 'ACCEPTED', decidedAt: now })],
    },
    { canApprove: true, canResend: false, canAttachAuthorization: false },
  );
const decided = { canReject: false, canResend: false, canAttachAuthorization: false };
// Depois da conferência: mantém a autorização e troca só a situação e as ações.
const afterConference = (over: Partial<LongExit>, caps: Partial<LongExitCapabilities> = {}) => {
  const base = verified();
  return {
    ...base,
    decision: 'APPROVE',
    decidedAt: now,
    ...over,
    capabilities: { ...base.capabilities, ...decided, canApprove: false, ...caps },
  } as LongExit;
};

describe('Detalhe da saída longa em passos', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let open: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;
  let dialogResult: LocalReviewResult | undefined;

  beforeEach(() => {
    dialogResult = { reason: 'Justificativa sintética', confirmed: true };
    open = vi.fn(() => ({ afterClosed: () => of(dialogResult) }));
    api = {
      get: vi.fn().mockResolvedValue(longExit()),
      unlinkedFiles: vi.fn().mockResolvedValue([]),
      confirmAuthorization: vi.fn(),
      refuseAuthorization: vi.fn(),
      decide: vi.fn(),
      authorizationFileUrl: vi.fn(() => 'about:blank'),
    };
    TestBed.configureTestingModule({
      imports: [LongExitDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'saida-longa-sintetica' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        {
          provide: DemoSessionService,
          useValue: {
            active: signal(false),
            hasRole: (...roles: string[]) => roles.includes('supervisor'),
          },
        },
        { provide: LongExitApiService, useValue: api },
      ],
    });
    TestBed.overrideProvider(MatDialog, {
      useValue: { open: (...args: unknown[]) => open(...args), openDialogs: [] },
    });
  });

  async function create(): Promise<ComponentFixture<LongExitDetailComponent>> {
    const fixture = TestBed.createComponent(LongExitDetailComponent);
    await fixture.whenStable();
    return fixture;
  }
  const step = (fixture: ComponentFixture<LongExitDetailComponent>): HTMLElement =>
    fixture.nativeElement.querySelector('.op-exit-actions');
  // Nome do botão sem o ícone decorativo.
  const name = (button: Element) =>
    Array.from(button.childNodes)
      .filter((node) => !(node instanceof Element && node.getAttribute('aria-hidden')))
      .map((node) => node.textContent)
      .join('')
      .trim();
  // Botões à vista no passo, fora dos recolhidos em "Outras opções".
  const actions = (fixture: ComponentFixture<LongExitDetailComponent>) =>
    Array.from(step(fixture).querySelectorAll('button'))
      .filter((button) => !button.closest('details'))
      .map(name);
  const button = (fixture: ComponentFixture<LongExitDetailComponent>, label: string) =>
    Array.from<HTMLButtonElement>(step(fixture).querySelectorAll('button')).find(
      (item) => name(item) === label,
    );
  const heading = (fixture: ComponentFixture<LongExitDetailComponent>) =>
    step(fixture).querySelector('#exit-step')?.textContent?.trim();
  const reviewData = () => (open.mock.calls[0][1] as { data: LocalReviewData }).data;

  it('sem arquivo recebido: aguarda o responsável, com "Anexar arquivo" à vista e "Rejeitar" em vermelho', async () => {
    const fixture = await create();
    expect(heading(fixture)).toBe('Autorização do responsável');
    expect(step(fixture).textContent).toContain('Passo 1 de 4');
    expect(step(fixture).textContent).toContain('Aguardando o responsável enviar pelo WhatsApp.');
    expect(step(fixture).querySelector('input[type=file]')?.closest('details')).toBeNull();
    expect(step(fixture).querySelector('label')?.textContent).toContain('Anexar arquivo');
    const others: HTMLDetailsElement = step(fixture).querySelector('details.more-details')!;
    expect(others.querySelector('summary')?.textContent?.trim()).toBe('Outras opções');
    expect(others.open).toBe(false);
    expect(others.textContent).toContain('Reenviar documento');
    expect(actions(fixture)).toEqual(['Rejeitar']);
    expect(button(fixture, 'Rejeitar')?.classList).toContain('btn-danger');
    expect(fixture.nativeElement.textContent).not.toContain('Aprovar saída');
  });

  it('entrega não confirmada: avisa e deixa "Anexar arquivo" fora de "Mais detalhes"', async () => {
    api['get'].mockResolvedValue(longExit({ deliveryUnconfirmed: true }));
    const fixture = await create();
    expect(step(fixture).textContent).toContain('sem confirmação de entrega após 15 minutos');
    const input = fixture.nativeElement.querySelector('input[type=file]');
    expect(input.closest('.op-exit-actions')).not.toBeNull();
    expect(input.closest('details')).toBeNull();
  });

  it('cada arquivo candidato tem "Baixar arquivo", "Confirmar conferência" e "Recusar arquivo"', async () => {
    api['get'].mockResolvedValue(longExit({ authorizationFiles: [file()] }));
    const fixture = await create();
    expect(actions(fixture)).toEqual([
      'Baixar arquivo',
      'Confirmar conferência',
      'Recusar arquivo',
      'Rejeitar',
    ]);
    expect(button(fixture, 'Recusar arquivo')?.classList).toContain('btn-danger');
    expect(step(fixture).textContent).not.toContain('Aguardando o responsável');
  });

  it('confirmar a conferência abre o diálogo atual e leva ao passo "Decisão", sem aprovar', async () => {
    api['get'].mockResolvedValue(longExit({ authorizationFiles: [file()] }));
    api['confirmAuthorization'].mockResolvedValue(verified());
    const fixture = await create();
    button(fixture, 'Confirmar conferência')!.click();
    await fixture.whenStable();
    const data = reviewData();
    expect(data.title).toBe('Conferir autorização recebida');
    expect(data.requireConfirmation).toBe(true);
    expect(data.confirmationLabel).toContain('Declaro que conferi o responsável e o documento');
    expect(api['decide']).not.toHaveBeenCalled();
    expect(heading(fixture)).toBe('Decisão');
    expect(fixture.nativeElement.querySelector('.op-exit-heading .status').textContent).toContain(
      'Aguardando análise',
    );
  });

  it('recusar o arquivo pede a justificativa e volta a aguardar o responsável', async () => {
    api['get'].mockResolvedValue(longExit({ authorizationFiles: [file()] }));
    api['refuseAuthorization'].mockResolvedValue(
      longExit({ authorizationFiles: [file({ state: 'REFUSED', decidedAt: now })] }),
    );
    const fixture = await create();
    const refuse = button(fixture, 'Recusar arquivo')!;
    refuse.focus();
    refuse.click();
    await fixture.whenStable();
    expect(reviewData()).toMatchObject({
      title: 'O arquivo será recusado e o pedido continua aguardando autorização.',
      requireReason: true,
      danger: true,
    });
    expect(heading(fixture)).toBe('Autorização do responsável');
    expect(step(fixture).textContent).toContain('Aguardando o responsável enviar pelo WhatsApp.');
    // O botão sumiu com o arquivo, mas o passo é o mesmo: o foco vai ao título do passo.
    expect(document.activeElement?.id).toBe('exit-step');
    const refused = fixture.nativeElement.querySelector('.long-files .status');
    expect(refused.textContent.trim()).toBe('Arquivo recusado');
    expect(refused.dataset.tone).toBe('danger');
  });

  it('vincular arquivo sem vínculo leva o foco ao título do passo quando a lista volta', async () => {
    const received: ReceivedFile = {
      messageId: 'mensagem-sintetica',
      senderPhone: '+55 64 90000-0000',
      fromGuardian: true,
      mediaState: 'STORED',
      failureCode: null,
      mediaType: 'application/pdf',
      size: 1000,
      receivedAt: now,
    };
    // A lista sem vínculo volta depois do pedido: o botão só some nessa hora.
    let release!: (files: ReceivedFile[]) => void;
    api['unlinkedFiles']
      .mockResolvedValueOnce([received])
      .mockReturnValueOnce(new Promise<ReceivedFile[]>((resolve) => (release = resolve)));
    api['linkAuthorization'] = vi
      .fn()
      .mockResolvedValue(longExit({ authorizationFiles: [file()] }));
    const fixture = await create();
    const link: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label^="Vincular a este pedido"]',
    );
    link.focus();
    link.click();
    await fixture.whenStable();
    expect(api['linkAuthorization']).toHaveBeenCalled();
    expect(link.isConnected).toBe(true);
    release([]);
    await vi.waitFor(() => expect(link.isConnected).toBe(false));
    await fixture.whenStable();
    expect(document.activeElement?.id).toBe('exit-step');
    const waiting = fixture.nativeElement.querySelector('.long-files .status');
    expect(waiting.textContent.trim()).toBe('Aguardando conferência');
    expect(waiting.dataset.tone).toBe('warning');
  });

  it('autorização conferida: passo "Decisão" com "Aprovar saída" e "Rejeitar" em vermelho', async () => {
    api['get'].mockResolvedValue(verified());
    const fixture = await create();
    expect(heading(fixture)).toBe('Decisão');
    expect(actions(fixture)).toEqual(['Aprovar saída', 'Rejeitar']);
    expect(button(fixture, 'Rejeitar')?.classList).toContain('btn-danger');
    expect(step(fixture).textContent).toContain('Autorização conferida em');
    const situation = fixture.nativeElement.querySelector(
      '[aria-labelledby="long-exit-authorization"] .status',
    );
    expect(situation.textContent.trim()).toBe('Autorização conferida por servidor');
    expect(situation.dataset.tone).toBe('success');
    const legend = fixture.nativeElement.querySelector('sager-status-legend');
    expect(legend.querySelector('summary').textContent).toBe('O que significa cada cor?');
    expect(legend.textContent).toContain('Aguardando conferência');
  });

  it('a aprovação continua indisponível antes da conferência, e "Rejeitar" funciona', async () => {
    api['decide'].mockResolvedValue(
      longExit({ status: 'REJEITADA', decision: 'REJECT', decidedAt: now }, decided),
    );
    const fixture = await create();
    expect(button(fixture, 'Aprovar saída')).toBeUndefined();
    button(fixture, 'Rejeitar')!.click();
    await fixture.whenStable();
    expect(reviewData()).toMatchObject({
      title: 'O pedido será rejeitado.',
      action: 'Confirmar rejeição',
      danger: true,
    });
    expect(api['decide']).toHaveBeenCalledWith(
      expect.anything(),
      'REJECT',
      'Justificativa sintética',
    );
    expect(step(fixture).textContent).toContain('Rejeição registrada.');
  });

  it('aprovar o pedido para sair agora só aprova; a saída fica para quando o residente se apresentar', async () => {
    api['get'].mockResolvedValue(verified());
    api['decide'].mockResolvedValue(
      afterConference({ status: 'APROVADA' }, { canDepart: true, canCancel: true }),
    );
    const fixture = await create();
    button(fixture, 'Aprovar saída')!.click();
    await fixture.whenStable();
    expect(reviewData()).toMatchObject({
      title: 'A saída longa será aprovada.',
      action: 'Confirmar aprovação',
      note: 'Aprovar não registra a saída; ela é registrada quando o residente se apresentar.',
    });
    expect(step(fixture).textContent).toContain('Aprovação registrada.');
    expect(heading(fixture)).toBe('Saída');
    expect(step(fixture).textContent).toContain('Passo 3 de 4');
    expect(step(fixture).textContent).toContain(
      'Registre a saída quando o residente se apresentar.',
    );
    expect(step(fixture).textContent).not.toContain('Saída marcada para');
    expect(actions(fixture)).toEqual(['Registrar saída']);
  });

  it('"Registrar saída" não aceita horário anterior à aprovação', async () => {
    // Pedida às 15h59 e aprovada às 16h00 (UTC): o mínimo do horário anterior é a aprovação.
    const approved = afterConference({ status: 'APROVADA' }, { canDepart: true, canCancel: true });
    api['get'].mockResolvedValue(approved);
    dialogResult = undefined;
    const fixture = await create();
    button(fixture, 'Registrar saída')!.click();
    await fixture.whenStable();
    expect(reviewData().title).toBe('A saída será registrada.');
    expect(reviewData().physical).toMatchObject({ action: 'partida', minimum: now });
  });

  it('agendada aprovada antes da hora: "Saída marcada para", sem "Registrar saída"', async () => {
    api['get'].mockResolvedValue(
      afterConference({
        departureMode: 'SCHEDULED',
        requestedDepartureAt: '2026-10-02T18:00:00Z',
        status: 'APROVADA',
      }),
    );
    const fixture = await create();
    expect(heading(fixture)).toBe('Saída');
    expect(step(fixture).textContent).toContain('Passo 3 de 4');
    expect(step(fixture).textContent).toContain('Saída marcada para 02/10/2026, 15:00.');
    expect(actions(fixture)).toEqual([]);
  });

  it('em andamento: a única ação é "Registrar volta"', async () => {
    api['get'].mockResolvedValue(
      afterConference(
        { status: 'EM_ANDAMENTO', actualDepartureAt: now },
        { canReturn: true, canCancel: false },
      ),
    );
    const fixture = await create();
    expect(actions(fixture)).toEqual(['Registrar volta']);
  });

  it('"Mais detalhes" começa fechado, com histórico, documento e "Cancelar pedido"', async () => {
    const fixture = await create();
    const details: HTMLDetailsElement[] = Array.from(
      fixture.nativeElement.querySelectorAll(':scope main > details.more-details'),
    );
    expect(details).toHaveLength(1);
    expect(details[0].open).toBe(false);
    const titles = Array.from(details[0].querySelectorAll('h2')).map((h2) =>
      h2.textContent?.trim(),
    );
    expect(titles).toEqual(['Histórico', 'Documento enviado', 'Situação da autorização']);
    expect(details[0].textContent).toContain('Cancelar pedido');
    expect(actions(fixture)).not.toContain('Cancelar pedido');
    expect(fixture.nativeElement.textContent).not.toContain('Atualizar dados');
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
    const settle = async (fixture: ComponentFixture<LongExitDetailComponent>, ms = 1) => {
      await vi.advanceTimersByTimeAsync(ms);
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(1);
    };

    it('mostra aos 15 s o arquivo que o responsável enviou, sem "Carregando"', async () => {
      const fixture = TestBed.createComponent(LongExitDetailComponent);
      await settle(fixture);
      expect(button(fixture, 'Confirmar conferência')).toBeUndefined();
      let loadingSeen = false;
      api['get'].mockImplementation(async () => {
        loadingSeen ||= fixture.componentInstance.loading();
        return longExit({ authorizationFiles: [file()] });
      });
      await settle(fixture, 15_000);
      expect(loadingSeen).toBe(false);
      expect(button(fixture, 'Confirmar conferência')).toBeDefined();
    });

    it('não consulta com uma gravação em andamento', async () => {
      const fixture = TestBed.createComponent(LongExitDetailComponent);
      await settle(fixture);
      const calls = api['get'].mock.calls.length;
      fixture.componentInstance.busy.set(true);
      await settle(fixture, 15_000);
      expect(api['get'].mock.calls.length).toBe(calls);
      fixture.componentInstance.busy.set(false);
      await settle(fixture, 15_000);
      expect(api['get'].mock.calls.length).toBe(calls + 1);
    });
  });
});
