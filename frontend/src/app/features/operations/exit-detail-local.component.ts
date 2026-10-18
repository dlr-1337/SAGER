import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import {
  OperationsApiError,
  OperationsLocalApiService,
  operationsError,
} from './operations-local-api.service';
import { ShortExit } from './operations-local.models';
import { exitEventLabels, exitStatusLabels, formatOperationsTime } from './operations-local.utils';
import {
  LocalOperationsReviewDialogComponent,
  LocalReviewData,
  LocalReviewResult,
} from './review-dialog-local.component';

@Component({
  standalone: true,
  selector: 'app-exit-detail-local',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page op-exit-page">
      <header class="op-heading op-exit-heading">
        <a routerLink="/saidas" class="op-back">← Saídas</a>
        <div class="op-exit-title-row">
          <h1>Solicitação de saída curta</h1>
          @if (item(); as exit) {
            <span class="op-status">{{ labels[exit.status] }}</span>
          }
        </div>
        @if (item(); as exit) {
          <p>{{ exit.residentName }} · Matrícula {{ exit.enrollment }}</p>
        }
      </header>
      @if (loading()) {
        <section class="op-state" role="status">
          <h2>Carregando solicitação</h2>
          <p>Consultando os dados e o histórico.</p>
        </section>
      } @else if (loadError()) {
        <section class="op-state" role="alert">
          <h2>Solicitação indisponível</h2>
          <p>{{ loadError() }}</p>
          <button class="btn op-secondary" type="button" (click)="load()">Tentar novamente</button>
        </section>
      } @else if (item(); as exit) {
        @if (saved()) {
          <p class="op-success" role="status">Solicitação salva.</p>
        }
        <p class="op-help">Horário de Brasília. Este pedido segue as regras de saída curta.</p>
        @if (exit.deadlineAt) {
          <p class="op-help">
            {{
              exit.status === 'AGUARDANDO_ANALISE'
                ? 'Prazo para análise'
                : 'Prazo para iniciar a saída'
            }}: {{ formatTime(exit.deadlineAt) }}. Após esse prazo, a solicitação expira se a
            partida ainda não tiver sido registrada.
          </p>
        }
        <div class="op-exit-grid">
          <section class="panel op-panel op-exit-overview" aria-labelledby="local-exit-overview">
            <h2 id="local-exit-overview">Dados da solicitação</h2>
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
          <section class="panel op-panel op-exit-timeline" aria-labelledby="local-exit-history">
            <h2 id="local-exit-history">Histórico</h2>
            @if (!exit.history.length) {
              <p class="op-help">Nenhum evento disponível.</p>
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
                      · {{ labels[event.status] }} · revisão {{ event.version }}
                    </p>
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
            <section class="panel op-panel op-exit-actions" aria-labelledby="local-exit-actions">
              <h2 id="local-exit-actions">
                {{ session.hasRole('supervisor') ? 'Ações do supervisor' : 'Ações da solicitação' }}
              </h2>
              @if (session.hasRole('residente') && exit.capabilities.canEdit) {
                <a
                  class="btn op-primary"
                  [attr.aria-disabled]="busy() || conflict()"
                  [routerLink]="busy() || conflict() ? null : ['/saidas', exit.id, 'editar']"
                  >Editar solicitação</a
                >
              }
              @if (session.hasRole('supervisor') && exit.capabilities.canDecide) {
                <div class="op-actions">
                  <button
                    class="btn op-primary"
                    type="button"
                    [disabled]="busy() || conflict()"
                    (click)="decide('APPROVE')"
                  >
                    Aprovar</button
                  ><button
                    class="btn op-secondary"
                    type="button"
                    [disabled]="busy() || conflict()"
                    (click)="decide('REJECT')"
                  >
                    Rejeitar
                  </button>
                </div>
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
              @if (session.hasRole('supervisor', 'residente') && exit.capabilities.canCancel) {
                <div class="op-actions">
                  <button
                    type="button"
                    class="btn op-secondary"
                    [disabled]="busy() || conflict()"
                    (click)="cancel()"
                  >
                    Cancelar solicitação
                  </button>
                </div>
              }
              @if (
                !exit.capabilities.canEdit &&
                !exit.capabilities.canDecide &&
                !exit.capabilities.canCancel &&
                !exit.capabilities.canDepart &&
                !exit.capabilities.canReturn
              ) {
                <p class="op-help">Nenhuma ação disponível para esta solicitação.</p>
              }
              @if (session.hasRole('residente')) {
                <p class="op-help">O supervisor registra a partida e o retorno presenciais.</p>
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
                  Recarregar solicitação
                </button>
              } @else {
                <div class="op-actions">
                  <button
                    class="btn op-secondary"
                    type="button"
                    [disabled]="busy()"
                    (click)="load()"
                  >
                    Atualizar dados
                  </button>
                </div>
              }
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
    `,
  ],
})
export class ExitDetailLocalComponent {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(OperationsLocalApiService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly item = signal<ShortExit | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly success = signal('');
  readonly conflict = signal(false);
  readonly saved = signal(this.route.snapshot.queryParamMap.get('saved') === '1');
  readonly labels = exitStatusLabels;
  readonly events = {
    ...exitEventLabels,
    EDIT: 'Solicitação alterada',
    APPROVE: 'Solicitação aprovada',
    REJECT: 'Solicitação rejeitada',
    CANCEL: 'Solicitação cancelada',
    EXPIRE: 'Solicitação expirada',
  } as Record<string, string>;
  readonly formatTime = formatOperationsTime;
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    if (this.busy()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.success.set('');
    this.conflict.set(false);
    this.item.set(null);
    try {
      this.item.set(await this.api.exit(this.id));
    } catch (error) {
      this.loadError.set(operationsError(error));
    } finally {
      this.loading.set(false);
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
    this.review(
      {
        title: decision === 'APPROVE' ? 'Revisar aprovação' : 'Revisar rejeição',
        action: decision === 'APPROVE' ? 'Confirmar aprovação' : 'Confirmar rejeição',
        lines: this.summary(exit),
        comment: true,
      },
      (result) => this.api.decideExit(exit, decision, result.reason),
      decision === 'APPROVE' ? 'Aprovação registrada.' : 'Rejeição registrada.',
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
        title: 'Revisar cancelamento da solicitação',
        action: 'Confirmar cancelamento',
        lines: this.summary(exit),
        requireReason: true,
      },
      (result) => this.api.cancelExit(exit, result.reason),
      'Solicitação cancelada.',
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
        this.error.set('A solicitação mudou. Recarregue os dados antes de registrar a presença.');
        return;
      }
      if (!(action === 'partida' ? fresh.capabilities.canDepart : fresh.capabilities.canReturn)) {
        this.conflict.set(true);
        this.error.set('A ação deixou de estar disponível. Recarregue os dados da solicitação.');
        return;
      }
      this.review(
        {
          title: action === 'partida' ? 'Revisar partida presencial' : 'Revisar retorno presencial',
          action: action === 'partida' ? 'Confirmar partida' : 'Confirmar retorno',
          lines: this.summary(exit),
          warning: 'Confirme a identidade do residente e confira os horários antes de registrar.',
          physical: {
            action,
            now: fresh.now,
            minimum: action === 'partida' ? exit.requestedDepartureAt : exit.actualDepartureAt!,
            expectedReturnAt: exit.expectedReturnAt,
            version: exit.version,
          },
        },
        (result) => this.api.physicalExit(exit.id, action, result.physical!),
        action === 'partida' ? 'Partida presencial registrada.' : 'Retorno presencial registrado.',
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
      { label: 'Saída solicitada', value: formatOperationsTime(exit.requestedDepartureAt) },
      { label: 'Retorno previsto', value: formatOperationsTime(exit.expectedReturnAt) },
      { label: 'Motivo', value: exit.reason },
    ];
  }
  private review(
    data: LocalReviewData,
    action: (result: LocalReviewResult) => Promise<ShortExit>,
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
  private async mutate(action: () => Promise<ShortExit>, message: string): Promise<void> {
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
