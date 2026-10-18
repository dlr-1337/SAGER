import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { LongExitApiService } from './long-exit-api.service';
import { downloadExitDocument } from './long-exit-document.utils';
import { LongExit } from './long-exit.models';
import {
  documentStateLabels,
  longExitStatusLabels,
  messageStatusLabels,
  signatureStatusLabels,
} from './long-exit.utils';
import { OperationsApiError, operationsError } from './operations-local-api.service';
import { exitEventLabels, formatOperationsTime } from './operations-local.utils';
import {
  LocalOperationsReviewDialogComponent,
  LocalReviewData,
  LocalReviewResult,
} from './review-dialog-local.component';

@Component({
  standalone: true,
  selector: 'app-long-exit-detail',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page op-exit-page">
      <header class="op-heading op-exit-heading">
        <a routerLink="/saidas" [queryParams]="{ tipo: 'longa' }" class="op-back"
          >← Saídas longas</a
        >
        <div class="op-exit-title-row">
          <h1>Solicitação de saída longa</h1>
          @if (item(); as exit) {
            <span class="op-status">{{ labels[exit.status] }}</span>
          }
        </div>
        @if (item(); as exit) {
          <p>{{ exit.residentName }} · Matrícula {{ exit.enrollment }}</p>
        }
      </header>
      @if (session.active()) {
        <section class="op-empty" role="status">
          <h2>Área do ambiente local</h2>
          <p>Na demonstração, use as solicitações demonstrativas da lista de saídas.</p>
          <a class="btn op-primary" routerLink="/saidas">Abrir demonstração de saídas</a>
        </section>
      } @else if (loading()) {
        <section class="op-state" role="status">
          <h2>Carregando solicitação</h2>
          <p>Consultando pedido, documento e autorização do responsável.</p>
        </section>
      } @else if (loadError()) {
        <section class="op-state" role="alert">
          <h2>Solicitação indisponível</h2>
          <p>{{ loadError() }}</p>
          <button class="btn op-secondary" type="button" (click)="load()">Tentar novamente</button>
        </section>
      } @else if (item(); as exit) {
        @if (saved()) {
          <p class="op-success" role="status">
            Solicitação salva. O documento e a autorização acompanham a revisão atual.
          </p>
        }
        <p class="op-help">
          Horário de Brasília. Uma assinatura confirmada do responsável permite a análise; a
          aprovação é feita pelo supervisor.
        </p>
        @if (exit.deadlineAt) {
          <p class="op-help">
            {{
              exit.status === 'AGUARDANDO_ANALISE'
                ? 'Prazo para análise'
                : 'Prazo para iniciar a saída'
            }}: {{ formatTime(exit.deadlineAt) }}. A solicitação expira após esse prazo se a partida
            ainda não tiver sido registrada.
          </p>
        }
        <div class="op-exit-grid">
          <section class="panel op-panel op-exit-overview" aria-labelledby="long-exit-overview">
            <h2 id="long-exit-overview">Dados da solicitação</h2>
            <dl class="op-definition">
              <div>
                <dt>Identificador</dt>
                <dd>{{ exit.id }}</dd>
              </div>
              <div>
                <dt>Modalidade</dt>
                <dd>
                  {{
                    exit.departureMode === 'NOW' ? 'Saída imediata solicitada' : 'Saída agendada'
                  }}
                </dd>
              </div>
              <div>
                <dt>Saída solicitada</dt>
                <dd>{{ formatTime(exit.requestedDepartureAt) }}</dd>
              </div>
              <div>
                <dt>Retorno previsto</dt>
                <dd>{{ formatTime(exit.expectedReturnAt) }}</dd>
              </div>
              <div>
                <dt>Motivo</dt>
                <dd>{{ exit.reason }}</dd>
              </div>
              <div>
                <dt>Observações</dt>
                <dd>{{ exit.notes || 'Nenhuma' }}</dd>
              </div>
              <div>
                <dt>Responsável indicado</dt>
                <dd>{{ exit.guardianName }} · {{ exit.guardianRelationship }}</dd>
              </div>
              @if (exit.decision) {
                <div>
                  <dt>Decisão do supervisor</dt>
                  <dd>
                    {{ exit.decision === 'APPROVE' ? 'Aprovada' : 'Rejeitada' }} ·
                    {{ formatTime(exit.decidedAt) }}
                  </dd>
                </div>
                @if (exit.decisionComment) {
                  <div>
                    <dt>Justificativa da decisão</dt>
                    <dd>{{ exit.decisionComment }}</dd>
                  </div>
                }
              }
              @if (exit.actualDepartureAt) {
                <div>
                  <dt>Partida presencial</dt>
                  <dd>
                    {{ formatTime(exit.actualDepartureAt)
                    }}<small>Registrada em {{ formatTime(exit.departureRecordedAt) }}</small>
                  </dd>
                </div>
              }
              @if (exit.actualReturnAt) {
                <div>
                  <dt>Retorno presencial</dt>
                  <dd>
                    {{ formatTime(exit.actualReturnAt)
                    }}<small>Registrado em {{ formatTime(exit.returnRecordedAt) }}</small>
                  </dd>
                </div>
              }
              @if (exit.lateObservation) {
                <div>
                  <dt>Observação do atraso</dt>
                  <dd>{{ exit.lateObservation }}</dd>
                </div>
              }
              @if (exit.cancellationReason) {
                <div>
                  <dt>Motivo do cancelamento</dt>
                  <dd>{{ exit.cancellationReason }}</dd>
                </div>
              }
              @if (exit.expiryReason) {
                <div>
                  <dt>Expiração</dt>
                  <dd>O prazo terminou antes da conclusão da análise ou da partida presencial.</dd>
                </div>
              }
            </dl>
          </section>
          <section class="panel op-panel op-exit-timeline" aria-labelledby="long-exit-history">
            <h2 id="long-exit-history">Histórico</h2>
            @if (!exit.history.length) {
              <p class="op-help">Nenhum evento disponível.</p>
            } @else {
              <ol class="op-timeline">
                @for (event of exit.history; track event.id) {
                  <li>
                    <strong>{{ events[event.event] || 'Registro atualizado' }}</strong
                    ><time [attr.datetime]="event.recordedAt">{{
                      formatTime(event.recordedAt)
                    }}</time>
                    <p>
                      {{
                        event.actorProfile === 'residente'
                          ? 'Residente'
                          : event.actorProfile === 'supervisor'
                            ? 'Supervisor'
                            : 'Sistema'
                      }}
                      · {{ labels[event.status] }}
                    </p>
                    @if (event.documentVersionId) {
                      <p>
                        {{
                          event.documentVersionId === exit.currentDocument?.documentVersionId
                            ? 'Documento da revisão atual'
                            : 'Documento de revisão anterior'
                        }}
                      </p>
                    }
                    @if (event.effectiveAt) {
                      <p>Horário presencial: {{ formatTime(event.effectiveAt) }}</p>
                    }
                    @if (event.justification) {
                      <p>{{ event.justification }}</p>
                    }
                    @if (event.lateObservation) {
                      <p>Atraso: {{ event.lateObservation }}</p>
                    }
                  </li>
                }
              </ol>
            }
          </section>
          <div class="op-exit-side">
            <section class="panel op-panel" aria-labelledby="long-exit-authorization">
              <h2 id="long-exit-authorization">Autorização do responsável</h2>
              <dl class="op-definition">
                <div>
                  <dt>Assinatura</dt>
                  <dd>{{ signatures[exit.signatureStatus] }}</dd>
                </div>
                <div>
                  <dt>Convite</dt>
                  <dd>{{ messages[exit.messageStatus] }}</dd>
                </div>
                @if (exit.signedAt) {
                  <div>
                    <dt>Assinado em</dt>
                    <dd>{{ formatTime(exit.signedAt) }}</dd>
                  </div>
                }
              </dl>
              @if (exit.signatureStatus === 'VALID') {
                <p class="op-help">
                  A assinatura da revisão atual foi confirmada pelo servidor. Confira o pedido antes
                  de decidir.
                </p>
              } @else if (
                exit.signatureStatus === 'UNCERTAIN' || exit.messageStatus === 'UNCERTAIN'
              ) {
                <p class="op-warning">
                  A confirmação ainda está pendente de conferência. A equipe precisa verificar o
                  resultado antes de um novo envio.
                </p>
              } @else {
                <p class="op-help">
                  Convite enviado, entregue ou lido não confirma uma assinatura. A aprovação ficará
                  disponível após a confirmação da revisão atual.
                </p>
              }
              @if (exit.currentDocument; as revision) {
                <h3>Documento · revisão {{ revision.revisionNumber }}</h3>
                <dl class="op-definition">
                  <div>
                    <dt>Original</dt>
                    <dd>{{ documents[revision.originalState] || 'Indisponível' }}</dd>
                  </div>
                  <div>
                    <dt>Assinado</dt>
                    <dd>{{ documents[revision.signedState] || 'Ainda não disponível' }}</dd>
                  </div>
                </dl>
                <div class="op-actions long-document-actions">
                  <button
                    class="btn op-secondary"
                    type="button"
                    [disabled]="!exit.capabilities.canDownloadOriginal || downloading()"
                    (click)="download('original')"
                  >
                    <span class="material-symbols-outlined" aria-hidden="true">picture_as_pdf</span>
                    Baixar PDF original</button
                  ><button
                    class="btn op-secondary"
                    type="button"
                    [disabled]="!exit.capabilities.canDownloadSigned || downloading()"
                    (click)="download('assinado')"
                  >
                    <span class="material-symbols-outlined" aria-hidden="true">download</span>
                    Baixar PDF assinado
                  </button>
                </div>
              } @else {
                <p class="op-help">O documento ainda não está disponível.</p>
              }
              @if (documentError()) {
                <p class="op-error" role="alert">{{ documentError() }}</p>
              }
              @if (downloading()) {
                <p role="status">Carregando documento…</p>
              }
              @if (exit.bindings.length) {
                <details class="long-bindings">
                  <summary>Histórico dos convites ({{ exit.bindings.length }})</summary>
                  <ol>
                    @for (binding of exit.bindings; track binding.id) {
                      <li>
                        <strong>{{ binding.guardianName }}</strong>
                        <p>
                          {{ signatures[binding.status] }} · {{ messages[binding.messageStatus] }}
                        </p>
                        <p>
                          {{
                            binding.documentVersionId === exit.currentDocument?.documentVersionId
                              ? 'Revisão atual'
                              : 'Revisão anterior'
                          }}
                          · Convite criado em {{ formatTime(binding.createdAt) }}
                        </p>
                        @if (binding.revokedAt) {
                          <p>Revogado em {{ formatTime(binding.revokedAt) }}</p>
                        } @else {
                          <p>Prazo do convite: {{ formatTime(binding.expiresAt) }}</p>
                        }
                      </li>
                    }
                  </ol>
                </details>
              }
            </section>
            <section class="panel op-panel op-exit-actions" aria-labelledby="long-exit-actions">
              <h2 id="long-exit-actions">
                {{ session.hasRole('supervisor') ? 'Ações do supervisor' : 'Ações da solicitação' }}
              </h2>
              @if (session.hasRole('residente') && exit.capabilities.canEdit) {
                <a
                  class="btn op-primary"
                  [routerLink]="busy() || conflict() ? null : ['/saidas/longas', exit.id, 'editar']"
                  [attr.aria-disabled]="busy() || conflict()"
                  >Editar solicitação</a
                >
                <p class="op-help">
                  Alterar o pedido gera uma nova revisão e invalida os convites e as assinaturas
                  anteriores.
                </p>
              }
              @if (session.hasRole('supervisor') && exit.status === 'AGUARDANDO_ANALISE') {
                <div class="op-actions">
                  <button
                    class="btn op-primary"
                    type="button"
                    [disabled]="busy() || conflict() || !canApprove(exit)"
                    (click)="decide('APPROVE')"
                  >
                    Aprovar saída longa</button
                  ><button
                    class="btn op-secondary"
                    type="button"
                    [disabled]="busy() || conflict() || !exit.capabilities.canReject"
                    (click)="decide('REJECT')"
                  >
                    Rejeitar solicitação
                  </button>
                </div>
                @if (!canApprove(exit)) {
                  <p class="op-help">
                    A aprovação exige assinatura confirmada, responsável elegível e documentos
                    disponíveis na revisão atual. A rejeição pode ser registrada antes da
                    assinatura.
                  </p>
                }
              }
              @if (session.hasRole('supervisor') && exit.capabilities.canDepart) {
                <p>Identifique o residente presencialmente antes de liberar a partida.</p>
                <button
                  class="btn op-primary"
                  type="button"
                  [disabled]="busy() || conflict()"
                  (click)="physical('partida')"
                >
                  Registrar partida presencial
                </button>
              }
              @if (session.hasRole('supervisor') && exit.capabilities.canReturn) {
                <p>Identifique o residente presencialmente antes de confirmar o retorno.</p>
                <button
                  class="btn op-primary"
                  type="button"
                  [disabled]="busy() || conflict()"
                  (click)="physical('retorno')"
                >
                  Confirmar retorno presencial
                </button>
              }
              @if (
                session.hasRole('supervisor') &&
                exit.status === 'AGUARDANDO_ANALISE' &&
                exit.signatureStatus !== 'VALID'
              ) {
                <div class="op-actions">
                  <button
                    class="btn op-secondary"
                    type="button"
                    [disabled]="busy() || conflict() || !exit.capabilities.canResend"
                    (click)="resend()"
                  >
                    Reenviar convite ao responsável
                  </button>
                </div>
                <p class="op-help">
                  {{ exit.remainingResends }} reenvio(s) restante(s) no limite de 24 horas.
                  @if (exit.resendAvailableAt) {
                    Próximo horário de reenvio informado pelo servidor:
                    {{ formatTime(exit.resendAvailableAt) }}.
                  }
                </p>
              }
              @if (session.hasRole('supervisor') && exit.capabilities.canReconcile) {
                <div class="op-actions">
                  <button
                    class="btn op-secondary"
                    type="button"
                    [disabled]="busy() || conflict()"
                    (click)="reconcile()"
                  >
                    Solicitar conferência da assinatura
                  </button>
                </div>
              }
              @if (session.hasRole('supervisor', 'residente') && exit.capabilities.canCancel) {
                <div class="op-actions">
                  <button
                    class="btn op-secondary"
                    type="button"
                    [disabled]="busy() || conflict()"
                    (click)="cancel()"
                  >
                    Cancelar solicitação
                  </button>
                </div>
              }
              @if (session.hasRole('residente')) {
                <p class="op-help">
                  O supervisor analisa o pedido e registra a partida e o retorno presenciais.
                </p>
              }
              @if (busy()) {
                <p role="status">Processando registro…</p>
              }
              @if (error()) {
                <p class="op-error" role="alert">{{ error() }}</p>
              }
              @if (success()) {
                <p class="op-success" role="status">{{ success() }}</p>
              }
              <div class="op-actions">
                <button class="btn op-secondary" type="button" [disabled]="busy()" (click)="load()">
                  {{ conflict() ? 'Recarregar solicitação' : 'Atualizar dados' }}
                </button>
              </div>
            </section>
          </div>
        </div>
      }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .op-definition small {
        display: block;
        color: var(--muted);
        font-weight: 400;
        margin-top: 5px;
      }
      .long-document-actions {
        align-items: stretch;
        flex-direction: column;
      }
      .long-bindings {
        margin-top: 20px;
      }
      summary {
        min-height: 44px;
        display: flex;
        align-items: center;
        cursor: pointer;
        color: var(--green-800);
        text-decoration: underline;
        text-underline-offset: 0.2em;
      }
      .long-bindings ol {
        padding-left: 20px;
      }
      .long-bindings li {
        margin: 16px 0;
        overflow-wrap: anywhere;
      }
      .long-bindings p {
        margin: 6px 0;
      }
    `,
  ],
})
export class LongExitDetailComponent {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(LongExitApiService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly item = signal<LongExit | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly downloading = signal(false);
  readonly documentError = signal('');
  readonly loadError = signal('');
  readonly error = signal('');
  readonly success = signal('');
  readonly conflict = signal(false);
  readonly saved = signal(this.route.snapshot.queryParamMap.get('saved') === '1');
  readonly labels = longExitStatusLabels;
  readonly signatures = signatureStatusLabels;
  readonly messages = messageStatusLabels;
  readonly documents = documentStateLabels;
  readonly events = {
    ...exitEventLabels,
    EDIT: 'Pedido alterado e nova revisão gerada',
    APPROVE: 'Solicitação aprovada',
    REJECT: 'Solicitação rejeitada',
    CANCEL: 'Solicitação cancelada',
    EXPIRE: 'Solicitação expirada',
    RESEND: 'Reenvio de convite solicitado',
    RECONCILE: 'Conferência da assinatura solicitada',
    SIGNATURE_VALID: 'Assinatura confirmada pelo servidor',
    DOCUMENT_STORED: 'Documento armazenado',
    INVITE_SENT: 'Convite enviado',
  } as Record<string, string>;
  readonly formatTime = formatOperationsTime;
  constructor() {
    if (!this.session.active()) void this.load();
  }
  async load(): Promise<void> {
    if (this.session.active() || this.busy()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.success.set('');
    this.documentError.set('');
    this.conflict.set(false);
    this.item.set(null);
    try {
      this.item.set(await this.api.get(this.id));
    } catch (error) {
      this.loadError.set(operationsError(error));
    } finally {
      this.loading.set(false);
    }
  }
  canApprove(exit: LongExit): boolean {
    return (
      exit.capabilities.canApprove &&
      exit.signatureStatus === 'VALID' &&
      exit.currentDocument?.originalState === 'STORED' &&
      exit.currentDocument.signedState === 'STORED'
    );
  }
  decide(decision: 'APPROVE' | 'REJECT'): void {
    const exit = this.item();
    if (
      !exit ||
      !this.session.hasRole('supervisor') ||
      !(decision === 'APPROVE' ? this.canApprove(exit) : exit.capabilities.canReject) ||
      this.busy() ||
      this.conflict()
    )
      return;
    this.review(
      {
        title:
          decision === 'APPROVE'
            ? 'Revisar aprovação da saída longa'
            : 'Revisar rejeição da saída longa',
        action: decision === 'APPROVE' ? 'Confirmar aprovação' : 'Confirmar rejeição',
        lines: this.summary(exit),
        requireReason: decision === 'REJECT',
        comment: decision === 'APPROVE',
      },
      (result) => this.api.decide(exit, decision, result.reason),
      decision === 'APPROVE'
        ? 'Aprovação registrada. A partida será confirmada presencialmente.'
        : 'Rejeição registrada.',
    );
  }
  cancel(): void {
    const exit = this.item();
    if (
      !exit ||
      !this.session.hasRole('supervisor', 'residente') ||
      !exit.capabilities.canCancel ||
      this.busy() ||
      this.conflict()
    )
      return;
    this.review(
      {
        title: 'Revisar cancelamento da saída longa',
        action: 'Confirmar cancelamento',
        warning: 'Cancelar invalida os convites e as autorizações pendentes desta solicitação.',
        lines: this.summary(exit),
        requireReason: true,
      },
      (result) => this.api.cancel(exit, result.reason),
      'Solicitação cancelada.',
    );
  }
  resend(): void {
    const exit = this.item();
    if (
      !exit ||
      !this.session.hasRole('supervisor') ||
      !exit.capabilities.canResend ||
      this.busy() ||
      this.conflict()
    )
      return;
    this.review(
      {
        title: 'Revisar reenvio do convite',
        action: 'Confirmar reenvio',
        warning:
          'O novo convite substitui o anterior para este responsável. Informe a providência tomada antes do reenvio.',
        lines: [
          ...this.summary(exit),
          { label: 'Reenvios restantes', value: String(exit.remainingResends) },
        ],
        requireReason: true,
      },
      (result) => this.api.resend(exit, result.reason),
      'Reenvio solicitado. Confira a situação do convite após o processamento.',
    );
  }
  reconcile(): void {
    const exit = this.item();
    if (
      !exit ||
      !this.session.hasRole('supervisor') ||
      !exit.capabilities.canReconcile ||
      this.busy() ||
      this.conflict()
    )
      return;
    this.review(
      {
        title: 'Solicitar conferência da assinatura',
        action: 'Solicitar conferência',
        lines: this.summary(exit),
      },
      () => this.api.reconcile(exit),
      'Conferência solicitada. A confirmação será atualizada pelo servidor.',
    );
  }
  async physical(action: 'partida' | 'retorno'): Promise<void> {
    const exit = this.item();
    if (
      !exit ||
      !this.session.hasRole('supervisor') ||
      !(action === 'partida' ? exit.capabilities.canDepart : exit.capabilities.canReturn) ||
      this.busy() ||
      this.conflict()
    )
      return;
    this.busy.set(true);
    this.error.set('');
    try {
      const fresh = await this.api.get(exit.id);
      if (
        fresh.version !== exit.version ||
        fresh.currentDocument?.documentVersionId !== exit.currentDocument?.documentVersionId ||
        !(action === 'partida' ? fresh.capabilities.canDepart : fresh.capabilities.canReturn)
      ) {
        this.conflict.set(true);
        this.error.set(
          'A solicitação mudou ou esta ação deixou de estar disponível. Recarregue os dados antes de registrar a presença.',
        );
        return;
      }
      this.review(
        {
          title: action === 'partida' ? 'Revisar partida presencial' : 'Revisar retorno presencial',
          action: action === 'partida' ? 'Confirmar partida' : 'Confirmar retorno',
          warning: 'Confirme a identidade do residente e confira os horários antes de registrar.',
          lines: this.summary(exit),
          physical: {
            action,
            now: fresh.now,
            minimum: action === 'partida' ? exit.requestedDepartureAt : exit.actualDepartureAt!,
            expectedReturnAt: exit.expectedReturnAt,
            version: exit.version,
          },
        },
        (result) => this.api.physical(exit.id, action, result.physical!),
        action === 'partida' ? 'Partida presencial registrada.' : 'Retorno presencial registrado.',
      );
    } catch (error) {
      this.error.set(operationsError(error));
    } finally {
      this.busy.set(false);
    }
  }
  async download(kind: 'original' | 'assinado'): Promise<void> {
    const exit = this.item();
    const document = exit?.currentDocument;
    if (
      !exit ||
      !document ||
      this.downloading() ||
      !(kind === 'original'
        ? exit.capabilities.canDownloadOriginal
        : exit.capabilities.canDownloadSigned)
    )
      return;
    this.downloading.set(true);
    this.documentError.set('');
    try {
      const blob = await this.api.document(exit.id, document.documentVersionId, kind);
      downloadExitDocument(blob, document.documentVersionId, kind);
    } catch (error) {
      this.documentError.set(operationsError(error));
    } finally {
      this.downloading.set(false);
    }
  }
  private summary(exit: LongExit): { label: string; value: string }[] {
    return [
      { label: 'Residente', value: exit.residentName },
      { label: 'Responsável indicado', value: exit.guardianName },
      {
        label: 'Documento',
        value: exit.currentDocument
          ? `Revisão ${exit.currentDocument.revisionNumber}`
          : 'Indisponível',
      },
      { label: 'Saída solicitada', value: formatOperationsTime(exit.requestedDepartureAt) },
      { label: 'Retorno previsto', value: formatOperationsTime(exit.expectedReturnAt) },
      { label: 'Motivo', value: exit.reason },
    ];
  }
  private review(
    data: LocalReviewData,
    action: (result: LocalReviewResult) => Promise<LongExit>,
    message: string,
  ): void {
    this.dialog
      .open<LocalOperationsReviewDialogComponent, LocalReviewData, LocalReviewResult>(
        LocalOperationsReviewDialogComponent,
        {
          data,
          width: '620px',
          maxWidth: 'calc(100vw - 32px)',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
        },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) void this.mutate(() => action(result), message);
      });
  }
  private async mutate(action: () => Promise<LongExit>, message: string): Promise<void> {
    if (this.busy() || this.conflict()) return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    this.saved.set(false);
    try {
      this.item.set(await action());
      this.success.set(message);
    } catch (error) {
      this.error.set(operationsError(error));
      if (error instanceof OperationsApiError && error.status === 409) this.conflict.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
