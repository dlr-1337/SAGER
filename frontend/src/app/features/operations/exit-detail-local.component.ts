import { ERROR_CONFLICT } from '../../core/error-messages';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { autoRefresh } from '../../core/auto-refresh';
import { DemoSessionService } from '../../core/demo-session.service';
import { LocalAuthService } from '../../core/local-auth.service';
import { AutoRefreshStatusComponent, StatusLegendComponent, toneAttr } from '../../shared';
import {
  OperationsLocalApiService,
  freezesActions,
  operationsError,
} from './operations-local-api.service';
import { ShortExit } from './operations-local.models';
import {
  approvalNote,
  departureStepText,
  exitEventLabels,
  exitStatusLabels,
  formatOperationsTime,
  residentDepartureText,
  shortReturnText,
  leavesNow,
} from './operations-local.utils';
import {
  LocalOperationsReviewDialogComponent,
  LocalReviewData,
  LocalReviewResult,
} from './review-dialog-local.component';

type ExitStep = 'Decisão' | 'Saída' | 'Volta';

@Component({
  standalone: true,
  selector: 'app-exit-detail-local',
  imports: [RouterLink, AutoRefreshStatusComponent, StatusLegendComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page op-exit-page">
      <header class="op-heading op-exit-heading">
        <a routerLink="/saidas" class="op-back"
          ><span class="back-arrow" aria-hidden="true">←</span>Saídas</a
        >
        <div class="op-exit-title-row">
          <h1>Pedido de saída curta</h1>
          @if (item(); as exit) {
            <span class="status" [attr.data-tone]="tone(labels[exit.status])">{{
              labels[exit.status]
            }}</span>
          }
        </div>
        @if (item(); as exit) {
          <p>{{ exit.residentName }} · Matrícula {{ exit.enrollment }}</p>
        }
      </header>
      <sager-auto-refresh-status [refresh]="refresh" />
      @if (loading()) {
        <section class="op-state" role="status">
          <h2>Carregando pedido</h2>
          <p>Aguarde um momento.</p>
        </section>
      } @else if (loadError()) {
        <section class="op-state" role="alert">
          <h2>Não foi possível abrir o pedido</h2>
          <p>{{ loadError() }}</p>
          <button class="btn op-secondary" type="button" (click)="load()">Tentar novamente</button>
        </section>
      } @else if (item(); as exit) {
        <sager-status-legend [names]="legendNames" />
        @if (saved()) {
          <p class="op-success" role="status">Pedido salvo.</p>
        }
        @if (exit.deadlineAt) {
          <p class="op-help">
            {{
              exit.status === 'AGUARDANDO_ANALISE'
                ? 'Prazo para análise'
                : 'Prazo para iniciar a saída'
            }}: {{ formatTime(exit.deadlineAt) }}. Depois, o pedido perde a validade.
          </p>
        }
        <div class="op-exit-grid op-step-grid">
          <section class="panel op-panel" aria-labelledby="local-exit-overview">
            <h2 id="local-exit-overview">Dados do pedido</h2>
            <dl class="op-definition">
              <div>
                <dt>Quando</dt>
                <dd>
                  {{ exit.departureMode === 'NOW' ? 'Assim que liberar' : 'Saída agendada' }}
                </dd>
              </div>
              <div>
                <dt>Saída pedida</dt>
                <dd>{{ formatTime(exit.requestedDepartureAt) }}</dd>
              </div>
              <div>
                <dt>Retorno previsto</dt>
                <dd>{{ shortReturn(exit) }}</dd>
              </div>
              <div>
                <dt>Motivo</dt>
                <dd>{{ exit.reason }}</dd>
              </div>
              @if (exit.notes) {
                <div>
                  <dt>Observações</dt>
                  <dd>{{ exit.notes }}</dd>
                </div>
              }
              @if (exit.decision) {
                <div>
                  <dt>Decisão</dt>
                  <dd>
                    {{ exit.decision === 'APPROVE' ? 'Aprovada' : 'Rejeitada' }} ·
                    {{ formatTime(exit.decidedAt) }}
                  </dd>
                </div>
                @if (exit.decisionComment) {
                  <div>
                    <dt>Comentário da análise</dt>
                    <dd>{{ exit.decisionComment }}</dd>
                  </div>
                }
              }
              @if (exit.actualDepartureAt) {
                <div>
                  <dt>Saiu em</dt>
                  <dd>
                    {{ formatTime(exit.actualDepartureAt)
                    }}<small>Registrada em {{ formatTime(exit.departureRecordedAt) }}</small>
                  </dd>
                </div>
              }
              @if (exit.actualReturnAt) {
                <div>
                  <dt>Voltou em</dt>
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
                  <dd>O prazo terminou antes da resposta ou da saída.</dd>
                </div>
              }
            </dl>
          </section>
          <section class="panel op-panel op-exit-actions" aria-labelledby="exit-step">
            @if (session.hasRole('supervisor')) {
              @if (step(); as current) {
                <p class="step-count">
                  Passo {{ steps.indexOf(current) + 1 }} de {{ steps.length }}
                </p>
              }
              <h2 id="exit-step" tabindex="-1">{{ step() ?? 'Próximo passo' }}</h2>
              @switch (step()) {
                @case ('Decisão') {
                  <div class="op-actions">
                    <button
                      class="btn op-primary"
                      type="button"
                      [disabled]="locked()"
                      (click)="decide('APPROVE')"
                    >
                      Aprovar</button
                    ><button
                      class="btn-danger"
                      type="button"
                      [disabled]="locked()"
                      (click)="decide('REJECT')"
                    >
                      Rejeitar
                    </button>
                  </div>
                }
                @case ('Saída') {
                  @if (leavesNow(exit)) {
                    <p>{{ departureStepText }}</p>
                  } @else {
                    <p>Saída marcada para {{ formatTime(exit.requestedDepartureAt) }}.</p>
                  }
                  @if (exit.capabilities.canDepart) {
                    <button
                      class="btn op-primary"
                      type="button"
                      [disabled]="locked()"
                      (click)="physical('partida')"
                    >
                      Registrar saída
                    </button>
                  }
                }
                @case ('Volta') {
                  @if (exit.capabilities.canReturn) {
                    <button
                      class="btn op-primary"
                      type="button"
                      [disabled]="locked()"
                      (click)="physical('retorno')"
                    >
                      Registrar volta
                    </button>
                  }
                }
                @default {
                  <p class="op-help">Nenhuma ação disponível para este pedido.</p>
                }
              }
            } @else {
              <h2 id="exit-step" tabindex="-1">O que você pode fazer</h2>
              @if (exit.status === 'APROVADA') {
                @if (leavesNow(exit)) {
                  <p>{{ residentDepartureText }}</p>
                } @else {
                  <p>Saída marcada para {{ formatTime(exit.requestedDepartureAt) }}.</p>
                }
              }
              @if (exit.capabilities.canEdit && !adult()) {
                <a
                  class="btn op-primary"
                  [attr.aria-disabled]="locked()"
                  [routerLink]="locked() ? null : ['/saidas', exit.id, 'editar']"
                  >Mudar pedido</a
                >
              }
              @if (exit.capabilities.canCancel && !adult()) {
                <div class="op-actions">
                  <button
                    type="button"
                    class="btn op-secondary"
                    [disabled]="locked()"
                    (click)="cancel()"
                  >
                    Cancelar pedido
                  </button>
                </div>
              }
              @if (adult() || (!exit.capabilities.canEdit && !exit.capabilities.canCancel)) {
                <p class="op-help">Nenhuma ação disponível para este pedido.</p>
              }
              <p class="op-help">O supervisor registra a saída e a volta.</p>
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
            @if (conflict()) {
              <button class="btn op-secondary" type="button" (click)="load()">
                Recarregar dados
              </button>
            }
          </section>
        </div>
        <details class="more-details">
          <summary>Mais detalhes</summary>
          <section aria-labelledby="local-exit-history">
            <h2 id="local-exit-history">Histórico</h2>
            @if (!exit.history.length) {
              <p class="op-help">Nada registrado ainda.</p>
            } @else {
              <ol class="op-timeline">
                @for (event of exit.history; track event.id) {
                  <li>
                    <strong>{{ events[event.event] || 'Situação atualizada' }}</strong
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
                    @if (event.effectiveAt) {
                      <p>Horário: {{ formatTime(event.effectiveAt) }}</p>
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
          @if (session.hasRole('supervisor') && exit.capabilities.canCancel) {
            <div class="op-actions">
              <button
                type="button"
                class="btn op-secondary"
                [disabled]="locked()"
                (click)="cancel()"
              >
                Cancelar pedido
              </button>
            </div>
          }
        </details>
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
    `,
  ],
})
export class ExitDetailLocalComponent {
  readonly session = inject(DemoSessionService);
  private readonly auth = inject(LocalAuthService);
  /** O adulto só consulta: pedir, mudar e cancelar são do residente menor (RN02). */
  readonly adult = computed(() => this.auth.principal()?.maiorDeIdade === true);
  private readonly api = inject(OperationsLocalApiService);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly item = signal<ShortExit | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly success = signal('');
  readonly conflict = signal(false);
  readonly locked = computed(() => this.busy() || this.conflict());
  readonly saved = signal(this.route.snapshot.queryParamMap.get('saved') === '1');
  readonly labels = exitStatusLabels;
  readonly legendNames = Object.values(exitStatusLabels);
  readonly tone = toneAttr;
  /** Só a ação do momento: Decisão, Saída (toda aprovada) e Volta (exit-departure-in-person, D3). */
  readonly step = computed<ExitStep | null>(() => {
    const exit = this.item();
    if (exit?.capabilities.canDecide) return 'Decisão';
    if (exit?.status === 'APROVADA') return 'Saída';
    return exit?.status === 'EM_ANDAMENTO' ? 'Volta' : null;
  });
  readonly steps: ExitStep[] = ['Decisão', 'Saída', 'Volta'];
  readonly leavesNow = leavesNow;
  readonly departureStepText = departureStepText;
  readonly residentDepartureText = residentDepartureText;
  readonly events = {
    ...exitEventLabels,
    EDIT: 'Pedido alterado',
    APPROVE: 'Pedido aprovado',
    REJECT: 'Pedido rejeitado',
    CANCEL: 'Pedido cancelado',
    EXPIRE: 'Pedido expirado',
  } as Record<string, string>;
  readonly formatTime = formatOperationsTime;
  readonly shortReturn = shortReturnText;
  private sequence = 0;
  readonly refresh = autoRefresh(() => this.load(true), {
    busy: () => this.busy() || this.conflict() || this.loading(),
  });
  constructor() {
    void this.load();
  }
  /** `silent`: atualização automática; mantém mensagens e conflito e lança a falha. */
  async load(silent = false): Promise<void> {
    if (!silent && this.busy()) return;
    const sequence = ++this.sequence;
    if (!silent) {
      this.loading.set(true);
      this.loadError.set('');
      this.error.set('');
      this.success.set('');
      this.conflict.set(false);
      this.item.set(null);
    }
    try {
      const exit = await this.api.exit(this.id);
      if (sequence !== this.sequence) return;
      this.item.set(exit);
      this.loadError.set('');
    } catch (error) {
      if (sequence !== this.sequence) return;
      if (silent) throw error;
      this.loadError.set(operationsError(error));
    } finally {
      if (sequence === this.sequence) this.loading.set(false);
    }
  }
  decide(decision: 'APPROVE' | 'REJECT'): void {
    const exit = this.item();
    if (
      !exit ||
      !this.session.hasRole('supervisor') ||
      !exit.capabilities.canDecide ||
      this.busy() ||
      this.conflict()
    )
      return;
    const approve = decision === 'APPROVE';
    this.review(
      {
        title: approve ? 'A saída será aprovada.' : 'O pedido será rejeitado.',
        action: approve ? 'Confirmar aprovação' : 'Confirmar rejeição',
        note: approve ? approvalNote : undefined,
        lines: this.summary(exit),
        requireReason: !approve,
        comment: approve,
        danger: !approve,
      },
      (result) => this.api.decideExit(exit, decision, result.reason),
      approve ? 'Aprovação registrada.' : 'Rejeição registrada.',
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
        title: 'O pedido será cancelado.',
        action: 'Cancelar pedido',
        lines: this.summary(exit),
        requireReason: true,
        danger: true,
      },
      (result) => this.api.cancelExit(exit, result.reason),
      'Pedido cancelado.',
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
      const fresh = await this.api.exit(exit.id);
      if (fresh.version !== exit.version) {
        this.conflict.set(true);
        this.error.set(ERROR_CONFLICT);
        return;
      }
      if (!(action === 'partida' ? fresh.capabilities.canDepart : fresh.capabilities.canReturn)) {
        this.conflict.set(true);
        this.error.set(ERROR_CONFLICT);
        return;
      }
      this.review(
        {
          title: action === 'partida' ? 'A saída será registrada.' : 'A volta será registrada.',
          action: action === 'partida' ? 'Confirmar saída' : 'Confirmar volta',
          lines: this.summary(exit),
          warning:
            action === 'partida'
              ? 'Veja o residente pessoalmente antes de liberar a saída.'
              : 'Veja o residente pessoalmente antes de confirmar a volta.',
          physical: {
            action,
            now: fresh.now,
            minimum: action === 'partida' ? exit.requestedDepartureAt : exit.actualDepartureAt!,
            expectedReturnAt: exit.expectedReturnAt,
            version: exit.version,
          },
        },
        (result) => this.api.physicalExit(exit.id, action, result.physical!),
        action === 'partida' ? 'Saída registrada.' : 'Volta registrada.',
      );
    } catch (error) {
      this.error.set(operationsError(error));
    } finally {
      this.busy.set(false);
    }
  }
  private summary(exit: ShortExit): { label: string; value: string }[] {
    return [
      { label: 'Residente', value: exit.residentName },
      { label: 'Matrícula', value: exit.enrollment },
      { label: 'Saída pedida', value: formatOperationsTime(exit.requestedDepartureAt) },
      { label: 'Retorno previsto', value: shortReturnText(exit) },
      { label: 'Motivo', value: exit.reason },
    ];
  }
  private review(
    data: LocalReviewData,
    action: (result: LocalReviewResult) => Promise<ShortExit>,
    message: string | ((exit: ShortExit) => string),
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
  private async mutate(
    action: () => Promise<ShortExit>,
    message: string | ((exit: ShortExit) => string),
  ): Promise<void> {
    if (this.busy() || this.conflict()) return;
    this.busy.set(true);
    this.sequence++; // Descarta a atualização automática que saiu antes da gravação.
    this.error.set('');
    this.success.set('');
    this.saved.set(false);
    const step = this.step();
    try {
      const exit = await action();
      this.item.set(exit);
      this.success.set(typeof message === 'string' ? message : message(exit));
      // O botão clicado sumiu com o passo: o foco vai ao título do passo novo.
      if (this.step() !== step)
        afterNextRender(() => document.getElementById('exit-step')?.focus(), {
          injector: this.injector,
        });
    } catch (error) {
      this.error.set(operationsError(error));
      if (freezesActions(error)) this.conflict.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
