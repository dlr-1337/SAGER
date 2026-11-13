import { CommunicationFiltersComponent } from './communication-filters.component';
import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { rememberFilters } from '../../core/filter-state';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { ResidentApiService, ResidentRecord } from '../management/resident-api.service';
import {
  CommunicationsApiError,
  CommunicationsLocalApiService,
  communicationsError,
} from './communications-local-api.service';
import {
  CursorPage,
  DisciplineContext,
  DisciplineNotification,
  DisciplineOccurrence,
  NotificationStatus,
} from './communications-local.models';
import {
  CommunicationReviewData,
  CommunicationReviewDialogComponent,
  CommunicationReviewResult,
  CommunicationsStateComponent,
} from './communications-local.shared';
import {
  CommunicationIntent,
  categoryLabels,
  eventLabels,
  formatCivilDate,
  formatCommunicationTime,
  notificationLabels,
  severityLabels,
  warningFormError,
} from './communications-local.utils';
import { EvidenceLocalComponent } from './evidence-local.component';
import { WarningFieldsComponent, warningForm, warningInput } from './warning-fields.component';

@Component({
  standalone: true,
  selector: 'sager-notifications-local',
  imports: [
    CommunicationFiltersComponent,
    SearchableSelectDirective,
    RouterLink,
    ReactiveFormsModule,
    CommunicationsStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-page">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/inicio">← Início</a>
          <h1>Notificações</h1>
          <p>Veja o que aconteceu antes de decidir.</p>
        </div>
      </header>
      <nav class="comm-links" aria-label="Disciplina e comunicações">
        <a routerLink="/advertencias">Advertências</a
        ><a routerLink="/comunicacoes/avisos">Avisos aos residentes</a>
      </nav>
      @if (!session.active() && session.hasRole('supervisor')) {
        <sager-communication-filters
          mode="notifications"
          (changed)="searchFilters = $event; load()"
        />
      }
      <sager-communications-state
        [demo]="session.active()"
        [blocked]="!session.hasRole('supervisor')"
        [loading]="loading()"
        [error]="error()"
        (retry)="load()"
      />
      @if (!session.active() && session.hasRole('supervisor') && !loading() && !error()) {
        <p class="comm-help">
          Abrir um item não registra visualização. Uma notificação não é uma advertência e nenhuma
          penalidade é automática.
        </p>
        <section class="panel op-panel">
          <h2>Filtrar notificações</h2>
          <form class="op-filters" [formGroup]="filters" (ngSubmit)="load()">
            <label class="field"
              >Residente<select sagerSearchable formControlName="residentId">
                <option value="">Todos os residentes</option>
                @for (resident of residents(); track resident.id) {
                  <option [value]="resident.id">
                    {{ resident.name }} · {{ resident.enrollment }}
                  </option>
                }
              </select></label
            ><label class="field"
              >Situação<select sagerSearchable formControlName="status">
                <option value="">Todas</option>
                @for (status of statuses; track status) {
                  <option [value]="status">{{ labels[status] }}</option>
                }
              </select></label
            ><button class="btn-secondary" type="submit">Buscar</button>
          </form>
        </section>
        <section class="op-section">
          <h2>Notificações</h2>
          @if (!items().length) {
            <div class="op-empty" role="status">
              <h3>Nenhuma notificação encontrada</h3>
              <p>Quando acontecer algo para analisar, vai aparecer aqui.</p>
            </div>
          } @else {
            <div class="op-list">
              @for (item of items(); track item.id) {
                <article class="op-row">
                  <div class="op-row-main">
                    <h3>{{ item.residentName }}</h3>
                    <p>{{ categories[item.category] }} · {{ formatTime(item.createdAt) }}</p>
                    @if (item.requiresReview) {
                      <p>Origem corrigida · falta conferir</p>
                    }
                  </div>
                  <div class="op-row-side">
                    <span class="op-status">{{ labels[item.status] }}</span>
                    @if (!item.valid) {
                      <small>Origem invalidada</small>
                    }
                  </div>
                  <a class="op-row-link" [routerLink]="['/notificacoes', item.id]"
                    >Ver notificação<span class="material-symbols-outlined" aria-hidden="true"
                      >arrow_forward</span
                    ></a
                  >
                </article>
              }
            </div>
          }
          @if (nextCursor() !== null) {
            <div class="comm-actions">
              <button
                class="btn-secondary"
                type="button"
                [disabled]="moreLoading()"
                (click)="more()"
              >
                {{ moreLoading() ? 'Carregando…' : 'Carregar mais notificações' }}
              </button>
            </div>
          }
          @if (moreError()) {
            <p class="comm-error" role="alert">{{ moreError() }}</p>
          }
        </section>
      }
    </main>
  `,
  styleUrl: './communications-local.scss',
})
export class NotificationsLocalPage {
  searchFilters: Record<string, string> = {};
  private appliedSearch: Record<string, string> = {};

  readonly session = inject(SessionService);
  private readonly api = inject(CommunicationsLocalApiService);
  private readonly registry = inject(ResidentApiService);
  readonly residents = signal<ResidentRecord[]>([]);
  readonly items = signal<DisciplineNotification[]>([]);
  readonly nextCursor = signal<number | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly moreLoading = signal(false);
  readonly moreError = signal('');
  readonly labels = notificationLabels;
  readonly categories = categoryLabels;
  readonly statuses = Object.keys(notificationLabels) as NotificationStatus[];
  readonly formatTime = formatCommunicationTime;
  readonly filters = new FormGroup({
    residentId: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
  });
  private generation = 0;
  private appliedFilters = { residentId: '', status: '' };
  constructor() {
    rememberFilters('notifications-local.pages', this.filters);
    void this.load();
  }
  async load(): Promise<void> {
    this.appliedSearch = { ...this.searchFilters };
    if (this.session.active() || !this.session.hasRole('supervisor')) return;
    const generation = ++this.generation;
    this.loading.set(true);
    this.moreLoading.set(false);
    this.error.set('');
    this.moreError.set('');
    this.items.set([]);
    try {
      const value = this.filters.getRawValue();
      const [items, residents] = await Promise.all([
        this.api.notifications(value.residentId, value.status, undefined, this.appliedSearch),
        this.registry.list(),
      ]);
      if (generation === this.generation) {
        this.appliedFilters = value;
        this.apply(items);
        this.residents.set(residents);
      }
    } catch (error) {
      if (generation === this.generation) this.error.set(communicationsError(error));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  async more(): Promise<void> {
    const cursor = this.nextCursor();
    const generation = this.generation;
    if (cursor === null || this.moreLoading()) return;
    this.moreLoading.set(true);
    this.moreError.set('');
    try {
      const value = this.appliedFilters;
      const page = await this.api.notifications(
        value.residentId,
        value.status,
        cursor,
        this.appliedSearch,
      );
      if (generation === this.generation) this.apply(page, true);
    } catch (error) {
      if (generation === this.generation) this.moreError.set(communicationsError(error));
    } finally {
      if (generation === this.generation) this.moreLoading.set(false);
    }
  }
  private apply(page: CursorPage<DisciplineNotification>, append = false): void {
    this.items.set(
      append
        ? [
            ...this.items(),
            ...page.items.filter(
              (item) => !this.items().some((previous) => previous.id === item.id),
            ),
          ]
        : page.items,
    );
    this.nextCursor.set(page.nextCursor);
  }
}

@Component({
  standalone: true,
  selector: 'sager-notification-detail-local',
  imports: [
    UnsavedFormDirective,
    RouterLink,
    ReactiveFormsModule,
    CommunicationsStateComponent,
    EvidenceLocalComponent,
    WarningFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-page">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/notificacoes">← Notificações</a>
          <h1>Analisar notificação</h1>
          @if (item(); as notification) {
            <p>{{ notification.residentName }} · {{ categories[notification.category] }}</p>
          }
        </div>
        @if (item(); as notification) {
          <span class="op-status">{{ labels[notification.status] }}</span>
        }
      </header>
      <sager-communications-state
        [demo]="session.active()"
        [blocked]="!session.hasRole('supervisor')"
        [loading]="loading()"
        [error]="loadError()"
        (retry)="load()"
      />
      @if (
        !session.active() && session.hasRole('supervisor') && !loading() && !loadError() && item();
        as notification
      ) {
        <p class="comm-help">
          Confira o que aconteceu antes de decidir. Regra aplicada:
          {{ categories[notification.category] }}.
        </p>
        @if (notification.requiresReview) {
          <p class="comm-warning" role="alert">
            A origem foi corrigida. Confira o registro atual antes de criar a advertência. Uma
            advertência já criada continua no histórico.
          </p>
        }
        <div class="comm-grid">
          <div class="comm-stack">
            @if (occurrence(); as origin) {
              <sager-local-evidence [occurrence]="origin" />
            }
            <section class="panel op-panel">
              <h2>Histórico da análise</h2>
              <ol class="comm-history">
                @for (event of notification.events; track event.id) {
                  <li>
                    <strong>{{ events[event.action] || 'Análise atualizada' }}</strong
                    ><time [attr.datetime]="event.recordedAt">{{
                      formatTime(event.recordedAt)
                    }}</time>
                    @if (event.reason) {
                      <p>{{ event.reason }}</p>
                    }
                  </li>
                } @empty {
                  <li>Nenhuma ação registrada.</li>
                }
              </ol>
            </section>
          </div>
          <section class="panel op-panel">
            <h2>Decisão do supervisor</h2>
            @if (notification.status === 'PENDENTE') {
              <button
                class="btn-secondary"
                type="button"
                [disabled]="busy() || conflict()"
                (click)="view()"
              >
                Registrar visualização
              </button>
            }
            @if (!terminal(notification)) {
              <div class="comm-actions">
                <button
                  class="btn-secondary"
                  type="button"
                  [disabled]="busy() || conflict()"
                  (click)="analyze(false)"
                >
                  Iniciar análise</button
                ><button
                  class="btn-secondary"
                  type="button"
                  [disabled]="busy() || conflict()"
                  (click)="archive()"
                >
                  Arquivar com justificativa
                </button>
              </div>
            }
            @if (
              notification.requiresReview &&
              notification.valid &&
              notification.status !== 'ARQUIVADA'
            ) {
              <div class="comm-actions">
                <button
                  class="btn-secondary"
                  type="button"
                  [disabled]="busy() || conflict()"
                  (click)="analyze(true)"
                >
                  Confirmar registro atual
                </button>
              </div>
            }
            @if (!terminal(notification)) {
              <button
                class="btn"
                type="button"
                [disabled]="
                  busy() || conflict() || notification.requiresReview || !notification.valid
                "
                (click)="showWarning.set(!showWarning())"
              >
                {{ showWarning() ? 'Fechar advertência' : 'Criar advertência' }}
              </button>
            }
            @if (showWarning() && !terminal(notification)) {
              <form
                sagerUnsaved
                [sagerSaving]="busy"
                class="comm-form"
                [formGroup]="form"
                (ngSubmit)="convert()"
                novalidate
              >
                <h3>Dados da advertência</h3>
                <sager-warning-fields
                  [form]="form"
                  [maxDate]="context()?.currentDate || ''"
                  [lockedCategory]="true"
                /><button
                  class="btn"
                  type="submit"
                  [disabled]="
                    busy() || conflict() || notification.requiresReview || !notification.valid
                  "
                >
                  Conferir advertência
                </button>
              </form>
            }
            @if (notification.status === 'CONVERTIDA') {
              <p>Esta notificação virou advertência.</p>
              <a routerLink="/advertencias" [queryParams]="{ residente: notification.residentId }"
                >Ver advertências do residente</a
              >
            }
            @if (notification.status === 'ARQUIVADA') {
              <p>Notificação arquivada. O conteúdo e a decisão permanecem no histórico.</p>
            }
            @if (error()) {
              <p class="comm-error" role="alert">{{ error() }}</p>
            }
            @if (success()) {
              <p class="comm-success" role="status">{{ success() }}</p>
            }
            @if (busy()) {
              <p role="status">Processando decisão…</p>
            }
            <div class="comm-actions">
              <button class="btn-secondary" type="button" [disabled]="busy()" (click)="load()">
                {{ conflict() ? 'Recarregar dados' : 'Atualizar dados' }}
              </button>
            </div>
          </section>
        </div>
      }
    </main>
  `,
  styleUrl: './communications-local.scss',
})
export class NotificationDetailLocalPage {
  readonly session = inject(SessionService);
  private readonly api = inject(CommunicationsLocalApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogs = inject(MatDialog);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  private readonly intent = new CommunicationIntent();
  readonly item = signal<DisciplineNotification | null>(null);
  readonly occurrence = signal<DisciplineOccurrence | null>(null);
  readonly context = signal<DisciplineContext | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly conflict = signal(false);
  readonly showWarning = signal(false);
  readonly form = warningForm();
  readonly labels = notificationLabels;
  readonly categories = categoryLabels;
  readonly events = eventLabels;
  readonly formatTime = formatCommunicationTime;
  constructor() {
    void this.load();
  }
  terminal(item: DisciplineNotification): boolean {
    return item.status === 'ARQUIVADA' || item.status === 'CONVERTIDA';
  }
  async load(): Promise<void> {
    if (this.session.active() || !this.session.hasRole('supervisor') || this.busy()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.success.set('');
    this.conflict.set(false);
    this.item.set(null);
    this.occurrence.set(null);
    this.showWarning.set(false);
    try {
      const [item, context] = await Promise.all([
        this.api.notification(this.id),
        this.api.context(),
      ]);
      const occurrence = await this.api.occurrence(item.occurrenceId);
      this.item.set(item);
      this.context.set(context);
      this.occurrence.set(occurrence);
      this.form.reset({
        category: item.category,
        severity: 'LEVE',
        warningDate: context.currentDate,
        description: '',
        justification: '',
      });
      if (item.occurrenceVersion !== occurrence.version || item.valid !== occurrence.valid) {
        this.conflict.set(true);
        this.error.set(
          'Outra pessoa alterou esta notificação. Clique em Recarregar, confira e tente de novo.',
        );
      }
    } catch (error) {
      this.loadError.set(communicationsError(error));
    } finally {
      this.loading.set(false);
    }
  }
  view(): void {
    const item = this.item();
    if (!item || item.status !== 'PENDENTE') return;
    void this.mutate(async () => {
      this.item.set(
        await this.api.notificationAction(item.id, 'visualizar', { version: item.version }),
      );
    }, 'Visualização registrada por ação explícita.');
  }
  analyze(confirm: boolean): void {
    const item = this.item();
    if (!item || item.status === 'ARQUIVADA' || this.busy() || this.conflict()) return;
    if (confirm) {
      if (!item.requiresReview || !item.valid) return;
      this.review(
        {
          title: 'Conferir registro corrigido',
          action: 'Confirmar registro atual',
          lines: this.summary(item),
          requireReason: true,
          confirmation: 'Conferi o registro atual e ele continua válido.',
          warning: 'Uma advertência já criada continua no histórico.',
        },
        (result) =>
          this.mutate(async () => {
            this.item.set(
              await this.api.notificationAction(item.id, 'analisar', {
                version: item.version,
                confirmCurrentEvidence: true,
                reason: result.reason,
              }),
            );
          }, 'Conferência registrada.'),
      );
    } else if (!this.terminal(item))
      void this.mutate(async () => {
        this.item.set(
          await this.api.notificationAction(item.id, 'analisar', { version: item.version }),
        );
      }, 'Análise iniciada.');
  }
  archive(): void {
    const item = this.item();
    if (!item || this.terminal(item) || this.busy() || this.conflict()) return;
    this.review(
      {
        title: 'Conferir antes de arquivar',
        action: 'Confirmar arquivamento',
        lines: this.summary(item),
        requireReason: true,
        archive: true,
        warning:
          'O registro e a decisão ficam guardados. Esta notificação não abre de novo sozinha.',
      },
      (result) =>
        this.mutate(async () => {
          this.item.set(
            await this.api.notificationAction(item.id, 'arquivar', {
              version: item.version,
              reasonCode: result.reasonCode,
              reason: result.reason,
            }),
          );
        }, 'Notificação arquivada com justificativa.'),
    );
  }
  async convert(): Promise<void> {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const item = this.item();
    if (
      !item ||
      this.terminal(item) ||
      item.requiresReview ||
      !item.valid ||
      this.busy() ||
      this.conflict()
    )
      return;
    this.form.markAllAsTouched();
    const input = warningInput(this.form);
    let invalid = warningFormError(input, this.context()?.currentDate ?? '');
    if (this.form.invalid || invalid) {
      this.error.set(invalid || 'Revise os campos da advertência.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const [fresh, context] = await Promise.all([
        this.api.notification(item.id),
        this.api.context(),
      ]);
      if (
        fresh.version !== item.version ||
        fresh.occurrenceVersion !== item.occurrenceVersion ||
        fresh.requiresReview ||
        !fresh.valid ||
        this.terminal(fresh)
      ) {
        this.conflict.set(true);
        this.error.set('A notificação ou a origem mudou. Recarregue os dados antes de converter.');
        return;
      }
      invalid = warningFormError(input, context.currentDate);
      if (invalid) {
        this.error.set(invalid);
        return;
      }
      this.review(
        {
          title: 'Conferir advertência',
          action: 'Criar advertência',
          lines: [
            ...this.summary(item),
            { label: 'Descrição', value: input.description },
            { label: 'Data', value: formatCivilDate(input.warningDate) },
            { label: 'Gravidade', value: severityLabels[input.severity] },
            { label: 'Justificativa', value: input.justification },
          ],
          warning:
            'O residente vai receber esta advertência. Depois, o texto não pode ser mudado. Para anular, é preciso outra decisão com motivo.',
        },
        () =>
          this.mutate(async () => {
            const payload = { ...input, version: item.version };
            const warning = await this.api.convert(item.id, {
              ...payload,
              idempotencyKey: this.intent.for(payload),
            });
            this.busy.set(false);
            this.form.markAsPristine();
            await this.router.navigate(['/advertencias', warning.id]);
          }, 'Advertência criada.'),
        trigger,
      );
    } catch (error) {
      this.error.set(communicationsError(error));
    } finally {
      this.busy.set(false);
    }
  }
  private summary(item: DisciplineNotification): { label: string; value: string }[] {
    return [
      { label: 'Residente', value: item.residentName },
      { label: 'Categoria', value: categoryLabels[item.category] },
      { label: 'Situação', value: notificationLabels[item.status] },
    ];
  }
  private review(
    data: CommunicationReviewData,
    action: (result: CommunicationReviewResult) => unknown,
    trigger: HTMLElement | null = null,
  ): void {
    this.dialogs
      .open<CommunicationReviewDialogComponent, CommunicationReviewData, CommunicationReviewResult>(
        CommunicationReviewDialogComponent,
        {
          data,
          width: '650px',
          maxWidth: 'calc(100vw - 32px)',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
        },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) void action(result);
        else if (trigger?.isConnected) trigger.focus();
      });
  }
  private async mutate(action: () => Promise<void>, success: string): Promise<void> {
    if (
      this.session.active() ||
      !this.session.hasRole('supervisor') ||
      this.busy() ||
      this.conflict()
    )
      return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await action();
      this.success.set(success);
    } catch (error) {
      this.error.set(communicationsError(error));
      if (error instanceof CommunicationsApiError && error.status === 409) this.conflict.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
