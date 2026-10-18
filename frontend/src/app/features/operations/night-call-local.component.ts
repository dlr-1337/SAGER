import { normalizeSearch } from '../../shared/search';
import { rememberFilters } from '../../core/filter-state';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { ProgressBarComponent } from '../../shared/progress-bar.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import {
  OperationsApiError,
  OperationsLocalApiService,
  operationsError,
} from './operations-local-api.service';
import { CallContext, CallMark, CallResident, NightCall } from './operations-local.models';
import { callMarkLabels, formatCivilDate, formatOperationsTime } from './operations-local.utils';
import {
  LocalOperationsReviewDialogComponent,
  LocalReviewData,
  LocalReviewResult,
} from './review-dialog-local.component';

@Component({
  standalone: true,
  selector: 'app-night-call-local',
  imports: [SearchableSelectDirective, ProgressBarComponent, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page">
      <header class="op-heading">
        <div>
          <a routerLink="/inicio" class="op-back">← Início</a>
          <h1>Chamada noturna</h1>
          <p>Registre a presença dos residentes menores de idade alocados no alojamento.</p>
        </div>
      </header>
      @if (!session.hasRole('supervisor')) {
        <section class="op-empty" role="alert">
          <h2>Acesso restrito</h2>
          <p>A chamada é registrada pelo supervisor.</p>
        </section>
      } @else {
        @if (context(); as ctx) {
          <section class="panel op-panel" aria-labelledby="call-selection">
            <h2 id="call-selection">Alojamento e data</h2>
            <div class="op-filters">
              <label class="field"
                >Alojamento<select sagerSearchable [formControl]="accommodation" (change)="load()">
                  @for (option of ctx.accommodations; track option.id) {
                    <option [value]="option.id">{{ option.name }} · {{ option.code }}</option>
                  }
                </select></label
              ><label class="field"
                >Data da chamada<input
                  type="date"
                  [formControl]="date"
                  [max]="ctx.referenceDate" /></label
              ><button
                type="button"
                class="btn op-secondary"
                [disabled]="loading() || busy()"
                (click)="load()"
              >
                Consultar chamadas
              </button>
            </div>
            <p class="op-help">
              Janela de registro: 22h a 23h30 · Horário de Brasília. Data atual do servidor:
              {{ formatDate(ctx.referenceDate) }}.
            </p>
          </section>
        }
        @if (loading()) {
          <div class="op-state" role="status">
            <h2>Carregando chamada</h2>
            <p>Consultando os registros do alojamento.</p>
          </div>
        } @else if (loadError()) {
          <div class="op-state" role="alert">
            <h2>Não foi possível carregar a chamada</h2>
            <p>{{ loadError() }}</p>
            <button type="button" class="btn op-secondary" (click)="load()">
              Tentar novamente
            </button>
          </div>
        } @else if (context(); as ctx) {
          @if (!ctx.accommodations.length) {
            <div class="op-empty" role="status">
              <h2>Nenhum alojamento cadastrado</h2>
              <p>Cadastre o alojamento e aloque os residentes antes da chamada.</p>
            </div>
          } @else if (call(); as current) {
            <section class="panel op-panel" aria-labelledby="call-summary">
              <div class="op-section-heading">
                <h2 id="call-summary">
                  {{ current.accommodationName }} · {{ formatDate(current.referenceDate) }}
                </h2>
                <span class="op-status">{{
                  current.status === 'ABERTA' ? 'Aberta' : 'Fechada'
                }}</span>
              </div>
              <dl class="op-call-summary">
                <div>
                  <dt>Marcações</dt>
                  <dd>
                    {{ current.summary.total - current.summary.unmarked }} de
                    {{ current.summary.total }}
                  </dd>
                </div>
                <div>
                  <dt>Presentes</dt>
                  <dd>{{ current.summary.present }}</dd>
                </div>
                <div>
                  <dt>Ausentes</dt>
                  <dd>{{ current.summary.absent }}</dd>
                </div>
                <div>
                  <dt>Justificadas</dt>
                  <dd>{{ current.summary.justified }}</dd>
                </div>
              </dl>
              <sager-progress-bar
                [done]="current.summary.total - current.summary.unmarked"
                [total]="current.summary.total"
                noun="marcações registradas"
              />
              <p class="op-help">
                Aberta em {{ formatTime(current.openedAt) }}. A relação de residentes e saídas
                justificadoras preserva a situação no momento da abertura.
              </p>
              @if (current.outsideWindowConfirmed) {
                <p class="op-warning">Abertura fora da janela: {{ current.justification }}</p>
              }
              @if (current.closedAt) {
                <p class="op-success" role="status">
                  Fechada em {{ formatTime(current.closedAt) }}.
                </p>
              }
              @if (current.closeOutsideWindowConfirmed) {
                <p class="op-warning">
                  Fechamento fora da janela: {{ current.closeJustification }}
                </p>
              }
            </section>
            <section class="op-section" aria-labelledby="call-roster">
              <div class="op-section-heading"><h2 id="call-roster">Residentes da chamada</h2></div>
              <div class="op-filters">
                <label class="field"
                  >Buscar por nome ou matrícula<input
                    type="search"
                    [formControl]="search"
                    (input)="searchValue.set(search.value)"
                /></label>
                <label class="field"
                  >Marcação<select
                    [value]="markFilter()"
                    (change)="markFilter.set($any($event.target).value)"
                  >
                    <option value="">Todas</option>
                    <option value="PENDENTE">Pendente</option>
                    <option value="PRESENTE">Presente</option>
                    <option value="AUSENTE">Ausente</option>
                    <option value="AUSENCIA_JUSTIFICADA">Ausência justificada</option>
                  </select></label
                >
                <button class="btn op-secondary" (click)="search.setValue(''); markFilter.set('')">
                  Limpar filtros
                </button>
              </div>
              <p role="status">
                {{ filtered().length }} de {{ current.records.length }} residentes
              </p>
              @if (!current.records.length) {
                <div class="op-empty" role="status"><h3>Nenhum residente nesta chamada</h3></div>
              } @else if (!filtered().length) {
                <div class="op-empty" role="status">
                  <h3>Nenhum residente encontrado</h3>
                  <p>Altere a busca para consultar as demais marcações.</p>
                </div>
              } @else {
                <div class="op-list">
                  @for (row of filtered(); track row.residentId) {
                    <article class="op-row op-call-row">
                      <div class="op-row-main">
                        <h3>{{ row.residentName }}</h3>
                        <p>Matrícula {{ row.enrollment }} · Quarto {{ row.roomNumber }}</p>
                        @if (row.authorizedExits.length) {
                          <span class="op-inline-note"
                            >Saída autorizada em andamento na abertura</span
                          >
                        }
                        @if (row.mark) {
                          <p>
                            {{ labels[row.mark] }}
                            @if (row.authorizedExitId) {
                              · saída {{ row.authorizedExitId }}
                            }
                          </p>
                        }
                        @if (row.history.length) {
                          <details>
                            <summary>Histórico da marcação ({{ row.history.length }})</summary>
                            <ol class="local-history">
                              @for (event of row.history; track event.id) {
                                <li>
                                  <strong>{{ labels[event.mark] }}</strong> ·
                                  {{ formatTime(event.recordedAt) }}
                                  <p>
                                    Revisão {{ event.version }} ·
                                    {{
                                      event.actorProfile === 'supervisor'
                                        ? 'Supervisor'
                                        : event.actorProfile
                                    }}
                                    @if (event.justification) {
                                      · {{ event.justification }}
                                    }
                                  </p>
                                </li>
                              }
                            </ol>
                          </details>
                        }
                      </div>
                      @if (current.status === 'ABERTA') {
                        <div
                          class="op-mark-group"
                          role="group"
                          [attr.aria-label]="'Presença de ' + row.residentName"
                        >
                          <button
                            type="button"
                            [disabled]="busy() || conflict()"
                            [class.selected]="row.mark === 'PRESENTE'"
                            [attr.aria-pressed]="row.mark === 'PRESENTE'"
                            (click)="mark(row, 'PRESENTE')"
                          >
                            Presente</button
                          ><button
                            type="button"
                            [disabled]="busy() || conflict()"
                            [class.selected]="row.mark === 'AUSENTE'"
                            [attr.aria-pressed]="row.mark === 'AUSENTE'"
                            (click)="mark(row, 'AUSENTE')"
                          >
                            Ausente
                          </button>
                          @if (row.authorizedExits.length) {
                            <button
                              type="button"
                              [disabled]="busy() || conflict()"
                              [class.selected]="row.mark === 'AUSENCIA_JUSTIFICADA'"
                              [attr.aria-pressed]="row.mark === 'AUSENCIA_JUSTIFICADA'"
                              (click)="mark(row, 'AUSENCIA_JUSTIFICADA')"
                            >
                              Ausência justificada
                            </button>
                          }
                        </div>
                      } @else {
                        <button
                          type="button"
                          class="btn op-secondary"
                          [disabled]="busy() || conflict()"
                          (click)="correct(row)"
                        >
                          Corrigir marcação<span class="sr-only"> de {{ row.residentName }}</span>
                        </button>
                      }
                    </article>
                  }
                </div>
              }
            </section>
            @if (current.status === 'ABERTA') {
              <div class="op-footer-action">
                <p aria-live="polite">{{ current.summary.unmarked }} marcações pendentes</p>
                <button
                  type="button"
                  class="btn op-primary"
                  [disabled]="busy() || conflict() || current.summary.unmarked > 0"
                  (click)="close()"
                >
                  Revisar e fechar chamada
                </button>
              </div>
            }
          } @else {
            <section class="op-empty" role="status">
              <h2>Nenhuma chamada nesta data</h2>
              @if (date.value === ctx.referenceDate) {
                <p>
                  {{ ctx.eligibleResidents }} residente(s) menor(es) de idade abrangido(s) neste
                  alojamento.
                </p>
                @if (ctx.missingBirthDates.length) {
                  <p class="op-warning">
                    A abertura está bloqueada: {{ ctx.missingBirthDates.length }} residente(s)
                    alocado(s) sem data de nascimento.
                  </p>
                  <ul>
                    @for (resident of ctx.missingBirthDates; track resident.residentId) {
                      <li>
                        {{ resident.residentName }} · Matrícula {{ resident.enrollment }} · Quarto
                        {{ resident.roomNumber }}
                      </li>
                    }
                  </ul>
                } @else if (ctx.outsideWindow) {
                  <p class="op-warning">
                    A abertura está fora da janela de 22h a 23h30. Será necessário confirmar o
                    alerta e justificar o registro.
                  </p>
                }
                <button
                  type="button"
                  class="btn op-primary"
                  [disabled]="
                    busy() ||
                    conflict() ||
                    ctx.missingBirthDates.length > 0 ||
                    ctx.eligibleResidents === 0
                  "
                  (click)="open()"
                >
                  Revisar e abrir chamada
                </button>
              } @else {
                <p>
                  Uma nova chamada só pode ser aberta na data atual do servidor. Selecione
                  {{ formatDate(ctx.referenceDate) }} para abrir.
                </p>
              }
            </section>
          }
          @if (error()) {
            <p class="op-error" role="alert">{{ error() }}</p>
          }
          @if (success()) {
            <p class="op-success" role="status">{{ success() }}</p>
          }
          @if (conflict()) {
            <button type="button" class="btn op-secondary" (click)="load()">
              Recarregar dados da chamada
            </button>
          }
        }
      }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      details {
        margin-top: 10px;
      }
      summary {
        cursor: pointer;
        color: var(--green-800);
        min-height: 44px;
        display: flex;
        align-items: center;
        text-decoration: underline;
        text-underline-offset: 0.2em;
      }
      .local-history {
        padding-left: 20px;
      }
      .local-history li {
        margin-bottom: 12px;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class NightCallLocalComponent {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(OperationsLocalApiService);
  private readonly dialog = inject(MatDialog);
  readonly context = signal<CallContext | null>(null);
  readonly call = signal<NightCall | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly success = signal('');
  readonly conflict = signal(false);
  readonly accommodation = new FormControl('', { nonNullable: true });
  readonly date = new FormControl('', { nonNullable: true });
  readonly search = new FormControl('', { nonNullable: true });
  readonly searchValue = signal('');
  readonly markFilter = signal('');
  readonly filtered = computed(() =>
    (this.call()?.records ?? []).filter(
      (row) =>
        normalizeSearch(`${row.residentName} ${row.enrollment}`).includes(
          normalizeSearch(this.searchValue()),
        ) &&
        (!this.markFilter() || (row.mark ?? 'PENDENTE') === this.markFilter()),
    ),
  );
  readonly formatDate = formatCivilDate;
  readonly formatTime = formatOperationsTime;
  readonly labels = callMarkLabels;
  private sequence = 0;
  constructor() {
    rememberFilters('call-roster-search', this.search);
    this.searchValue.set(this.search.value);
    this.search.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.searchValue.set(value));
    if (this.session.hasRole('supervisor')) void this.load();
  }
  async load(): Promise<void> {
    if (!this.session.hasRole('supervisor') || this.busy()) return;
    const seq = ++this.sequence;
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.success.set('');
    this.conflict.set(false);
    this.call.set(null);
    try {
      let context = await this.api.callContext(this.accommodation.value || undefined);
      if (!this.accommodation.value && context.accommodations.length) {
        this.accommodation.setValue(context.accommodations[0].id);
        context = await this.api.callContext(this.accommodation.value);
      }
      if (seq !== this.sequence) return;
      this.context.set(context);
      if (!this.date.value) this.date.setValue(context.referenceDate);
      if (this.accommodation.value) {
        const calls = await this.api.calls(this.accommodation.value, this.date.value);
        if (seq === this.sequence) this.call.set(calls[0] ?? null);
      }
    } catch (error) {
      if (seq === this.sequence) this.loadError.set(operationsError(error));
    } finally {
      if (seq === this.sequence) this.loading.set(false);
    }
  }
  async open(): Promise<void> {
    const previous = this.context();
    if (
      !previous ||
      this.date.value !== previous.referenceDate ||
      !this.accommodation.value ||
      previous.missingBirthDates.length ||
      !previous.eligibleResidents ||
      this.busy() ||
      this.conflict()
    )
      return;
    const accommodationId = this.accommodation.value;
    this.busy.set(true);
    this.error.set('');
    try {
      const context = await this.api.callContext(accommodationId);
      this.context.set(context);
      if (context.existingCallId || this.date.value !== context.referenceDate) {
        this.conflict.set(true);
        this.error.set(
          'A data mudou ou uma chamada já foi aberta. Recarregue os dados da chamada.',
        );
        return;
      }
      if (context.missingBirthDates.length || !context.eligibleResidents) {
        this.error.set('A relação de residentes mudou. Revise os impedimentos de abertura.');
        return;
      }
      this.review(
        {
          title: 'Revisar abertura da chamada',
          action: 'Abrir chamada',
          lines: [
            {
              label: 'Alojamento',
              value: context.accommodations.find((a) => a.id === accommodationId)?.name ?? '',
            },
            { label: 'Data', value: formatCivilDate(context.referenceDate) },
            { label: 'Residentes abrangidos', value: String(context.eligibleResidents) },
            { label: 'Consulta do servidor', value: formatOperationsTime(context.now) },
          ],
          ...this.windowReview(context),
        },
        (result) =>
          this.api.openCall({
            accommodationId,
            ...(result.confirmed
              ? { outsideWindowConfirmed: true, justification: result.reason }
              : {}),
          }),
        'Chamada aberta.',
      );
    } catch (error) {
      this.error.set(operationsError(error));
    } finally {
      this.busy.set(false);
    }
  }
  mark(row: CallResident, mark: CallMark): void {
    const call = this.call();
    if (!call || call.status !== 'ABERTA' || this.busy() || this.conflict()) return;
    if (mark === 'AUSENCIA_JUSTIFICADA' && !row.authorizedExits.length) return;
    if (mark === 'AUSENCIA_JUSTIFICADA' && row.authorizedExits.length > 1) {
      this.review(
        {
          title: 'Vincular ausência justificada',
          action: 'Registrar ausência justificada',
          lines: [{ label: 'Residente', value: row.residentName }],
          initialMark: mark,
          authorizedExits: row.authorizedExits,
        },
        (result) =>
          this.api.mark(call, row.residentId, result.mark!, undefined, result.authorizedExit),
        'Marcação registrada.',
      );
    } else
      void this.mutate(
        () =>
          this.api.mark(
            call,
            row.residentId,
            mark,
            undefined,
            mark === 'AUSENCIA_JUSTIFICADA' ? row.authorizedExits[0] : undefined,
          ),
        'Marcação registrada.',
      );
  }
  correct(row: CallResident): void {
    const call = this.call();
    if (!call || call.status !== 'FECHADA' || this.busy() || this.conflict()) return;
    this.review(
      {
        title: 'Corrigir marcação da chamada fechada',
        action: 'Salvar correção',
        lines: [
          { label: 'Residente', value: row.residentName },
          { label: 'Data da chamada', value: formatCivilDate(call.referenceDate) },
          { label: 'Marcação atual', value: row.mark ? this.labels[row.mark] : 'Sem marcação' },
        ],
        requireReason: true,
        initialMark: row.mark ?? 'PRESENTE',
        authorizedExits: row.authorizedExits,
      },
      (result) =>
        this.api.mark(call, row.residentId, result.mark!, result.reason, result.authorizedExit),
      'Correção registrada no histórico.',
    );
  }
  async close(): Promise<void> {
    const call = this.call();
    if (
      !call ||
      call.status !== 'ABERTA' ||
      call.summary.unmarked ||
      this.busy() ||
      this.conflict()
    )
      return;
    this.busy.set(true);
    try {
      const context = await this.api.callContext(call.accommodationId);
      this.context.set(context);
      this.review(
        {
          title: 'Revisar fechamento da chamada',
          action: 'Fechar chamada',
          lines: [
            { label: 'Data', value: formatCivilDate(call.referenceDate) },
            { label: 'Presentes', value: String(call.summary.present) },
            { label: 'Ausentes', value: String(call.summary.absent) },
            { label: 'Ausências justificadas', value: String(call.summary.justified) },
          ],
          ...this.windowReview(context),
        },
        (result) => this.api.closeCall(call, result.confirmed, result.reason),
        'Chamada fechada.',
      );
    } catch (error) {
      this.error.set(operationsError(error));
    } finally {
      this.busy.set(false);
    }
  }
  private windowReview(context: CallContext): Partial<LocalReviewData> {
    return context.outsideWindow
      ? {
          warning:
            'Este registro está fora da janela de 22h a 23h30. Confirme expressamente e descreva o motivo.',
          requireReason: true,
          requireConfirmation: true,
        }
      : {};
  }
  private review(
    data: LocalReviewData,
    action: (result: LocalReviewResult) => Promise<NightCall>,
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
  private async mutate(action: () => Promise<NightCall>, message: string): Promise<void> {
    if (this.busy() || this.conflict()) return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      this.call.set(await action());
      this.success.set(message);
    } catch (error) {
      this.error.set(operationsError(error));
      if (error instanceof OperationsApiError && error.status === 409) this.conflict.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
