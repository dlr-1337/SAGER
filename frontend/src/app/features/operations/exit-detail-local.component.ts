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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  departureMinimum,
  departureStepText,
  exitEventLabels,
  exitStatusLabel,
  exitStatusLabels,
  formatOperationsTime,
  isOverdue,
  shortExitPresentText,
  shortExitPresentTitle,
  shortReturnText,
  shownExitStatusLabels,
  leavesNow,
} from './operations-local.utils';
import { ExitSentDialogComponent } from './exit-sent-dialog.component';
import {
  LocalOperationsReviewDialogComponent,
  LocalReviewData,
  LocalReviewResult,
} from './review-dialog-local.component';

/** Dois passos do supervisor: registrar a saída e registrar a volta (short-exit-two-steps). */
type ExitStep = 'Saída' | 'Volta';

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
            <span class="status" [attr.data-tone]="tone(statusLabel(exit))">{{
              statusLabel(exit)
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
            O pedido vale até {{ formatTime(exit.deadlineAt) }}. Depois, perde a validade.
          </p>
        }
        <div class="op-exit-grid op-step-grid">
          <section class="panel op-panel" aria-labelledby="local-exit-overview">
            <h2 id="local-exit-overview">Dados do pedido</h2>
            <dl class="op-definition">
              <div>
                <dt>{{ requestedLabel(exit) }}</dt>
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
              <!-- A liberação é o próprio registro da saída: a decisão só aparece na rejeição e
                na saída aprovada antes de 20/11/2026. -->
              @if (exit.decision === 'REJECT' || exit.status === 'APROVADA') {
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
                @case ('Saída') {
                  @if (leavesNow(exit)) {
                    <p>{{ departureStepText }}</p>
                  } @else {
                    <p>Saída marcada para {{ formatTime(exit.requestedDepartureAt) }}.</p>
                  }
                  @if (exit.capabilities.canDepart || exit.capabilities.canDecide) {
                    <div class="op-actions">
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
                      @if (exit.capabilities.canDecide) {
                        <button
                          class="btn-danger"
                          type="button"
                          [disabled]="locked()"
                          (click)="reject()"
                        >
                          Rejeitar
                        </button>
                      }
                    </div>
                  }
                }
                @case ('Volta') {
                  <p>
                    {{ overdue(exit) ? 'A volta era até' : 'Volta até' }}
                    {{ formatTime(exit.expectedReturnAt) }}.
                  </p>
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
              <!-- O passo do residente em destaque, sem "O que você pode fazer" (short-exit-two-steps). -->
              @if (residentStep(exit); as current) {
                <div class="op-present" [class.op-present-late]="current.late">
                  <h2 id="exit-step" tabindex="-1">{{ current.title }}</h2>
                  <p>{{ current.text }}</p>
                </div>
              } @else {
                <h2 id="exit-step" tabindex="-1">Próximo passo</h2>
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
              @if (
                !residentStep(exit) &&
                (adult() || (!exit.capabilities.canEdit && !exit.capabilities.canCancel))
              ) {
                <p class="op-help">Nenhuma ação disponível para este pedido.</p>
              }
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
      /* O passo do residente em destaque (short-exit-two-steps). */
      .op-present {
        background: var(--info-bg);
        color: var(--info-ink);
        border-left: 4px solid currentColor;
        border-radius: 12px;
        padding: 16px 18px;
        margin-bottom: 16px;
      }
      .op-present h2 {
        color: inherit;
        font-size: 1.375rem;
        margin: 0 0 6px;
      }
      .op-present p {
        font-size: 1.0625rem;
        font-weight: 600;
        line-height: 1.45;
        margin: 0;
      }
      .op-present.op-present-late {
        background: var(--danger-bg);
        color: var(--danger-ink);
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
  private readonly router = inject(Router);
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
  readonly legendNames = Object.values(shownExitStatusLabels);
  readonly tone = toneAttr;
  readonly statusLabel = exitStatusLabel;
  readonly overdue = isOverdue;
  /**
   * Só a ação do momento: "Saída" registra a saída e a libera no mesmo ato, ou rejeita; "Volta"
   * registra a volta (short-exit-two-steps). A aprovada antes de 20/11/2026 também cai em "Saída".
   */
  readonly step = computed<ExitStep | null>(() => {
    const exit = this.item();
    if (exit?.capabilities.canDecide || exit?.status === 'APROVADA') return 'Saída';
    return exit?.status === 'EM_ANDAMENTO' ? 'Volta' : null;
  });
  readonly steps: ExitStep[] = ['Saída', 'Volta'];
  readonly leavesNow = leavesNow;
  readonly departureStepText = departureStepText;
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
    const query = this.route.snapshot.queryParamMap;
    const sent = query.get('enviado') === '1';
    // A janela e o aviso aparecem uma vez: recarregar a página não os mostra de novo.
    if (sent || query.has('saved'))
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
    if (sent)
      this.dialog.open(ExitSentDialogComponent, {
        width: '480px',
        maxWidth: 'calc(100vw - 32px)',
        restoreFocus: true,
      });
    void this.load();
  }
  /** "Pedido em" no pedido para agora; "Saída agendada para" no agendado antes de 20/11/2026. */
  requestedLabel(exit: ShortExit): string {
    return exit.departureMode === 'SCHEDULED' ? 'Saída agendada para' : 'Pedido em';
  }
  /** O passo do residente, em destaque; null quando não há nada a fazer. */
  residentStep(exit: ShortExit): { title: string; text: string; late: boolean } | null {
    // O maior de idade só consulta: o servidor não registra a saída dele (RN02).
    if (this.adult()) return null;
    if (exit.status === 'AGUARDANDO_ANALISE' || exit.status === 'APROVADA')
      return {
        title: shortExitPresentTitle,
        text: leavesNow(exit)
          ? shortExitPresentText
          : `Saída marcada para ${formatOperationsTime(exit.requestedDepartureAt)}. Nessa hora, vá até o supervisor.`,
        late: false,
      };
    if (exit.status !== 'EM_ANDAMENTO') return null;
    const back = formatOperationsTime(exit.expectedReturnAt);
    return isOverdue(exit)
      ? {
          title: 'Volta atrasada',
          text: `A volta era até ${back}. Apresente-se ao supervisor ao voltar.`,
          late: true,
        }
      : { title: `Volte até ${back}`, text: 'Apresente-se ao supervisor ao voltar.', late: false };
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
  /** A saída curta não tem botão de aprovar: liberar é registrar a saída (short-exit-two-steps). */
  reject(): void {
    const exit = this.item();
    if (
      !exit ||
      !this.session.hasRole('supervisor') ||
      !exit.capabilities.canDecide ||
      this.busy() ||
      this.conflict()
    )
      return;
    this.review(
      {
        title: 'O pedido será rejeitado.',
        action: 'Confirmar rejeição',
        lines: this.summary(exit),
        requireReason: true,
        danger: true,
      },
      (result) => this.api.decideExit(exit, 'REJECT', result.reason),
      'Rejeição registrada.',
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
    // O botão fica desabilitado durante a leitura e perde o foco; Esc no diálogo o devolve a ele.
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
            minimum: action === 'partida' ? departureMinimum(exit) : exit.actualDepartureAt!,
            expectedReturnAt: exit.expectedReturnAt,
            version: exit.version,
          },
        },
        (result) => this.api.physicalExit(exit.id, action, result.physical!),
        action === 'partida'
          ? (saved) =>
              `Saída registrada. Volta até ${formatOperationsTime(saved.expectedReturnAt)}.`
          : 'Volta registrada.',
        trigger,
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
      { label: this.requestedLabel(exit), value: formatOperationsTime(exit.requestedDepartureAt) },
      { label: 'Retorno previsto', value: shortReturnText(exit) },
      { label: 'Motivo', value: exit.reason },
    ];
  }
  private review(
    data: LocalReviewData,
    action: (result: LocalReviewResult) => Promise<ShortExit>,
    message: string | ((exit: ShortExit) => string),
    trigger: HTMLElement | null = null,
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
        else trigger?.focus();
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
