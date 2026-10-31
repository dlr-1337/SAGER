import { CommunicationFiltersComponent } from './communication-filters.component';
import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { ResidentApiService, ResidentRecord } from '../management/resident-api.service';
import {
  CommunicationsApiError,
  CommunicationsLocalApiService,
  communicationsError,
} from './communications-local-api.service';
import {
  DisciplineContext,
  DisciplineOccurrence,
  DisciplineWarning,
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
  formatCivilDate,
  formatCommunicationTime,
  severityLabels,
  warningFormError,
} from './communications-local.utils';
import { EvidenceLocalComponent } from './evidence-local.component';
import { WarningFieldsComponent, warningForm, warningInput } from './warning-fields.component';

@Component({
  standalone: true,
  selector: 'sager-warnings-local',
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
          <a class="op-back" routerLink="/notificacoes">← Notificações</a>
          <h1>Advertências</h1>
          <p>Advertências dadas pelo supervisor. O histórico fica guardado.</p>
        </div>
        @if (session.hasRole('supervisor') && !session.active()) {
          <a class="btn" routerLink="/advertencias/nova">Nova advertência</a>
        }
      </header>
      @if (!session.active() && session.hasRole('supervisor')) {
        <sager-communication-filters mode="warnings" (changed)="searchFilters = $event; load()" />
      }
      <sager-communications-state
        [demo]="session.active()"
        [blocked]="!session.hasRole('supervisor')"
        [loading]="loading()"
        [error]="error()"
        (retry)="load()"
      />
      @if (!session.active() && session.hasRole('supervisor') && !loading() && !error()) {
        <section class="panel op-panel">
          <h2>Buscar por residente</h2>
          <form class="op-filters" (submit)="$event.preventDefault(); load()">
            <label class="field"
              >Residente<select sagerSearchable [formControl]="residentId">
                <option value="">Todos os residentes</option>
                @for (resident of residents(); track resident.id) {
                  <option [value]="resident.id">
                    {{ resident.name }} · {{ resident.enrollment }}
                  </option>
                }
              </select></label
            ><button class="btn-secondary" type="submit">Buscar</button>
          </form>
          @if (appliedResident()) {
            <div class="comm-actions">
              <a [routerLink]="['/residentes', appliedResident(), 'reincidencias']"
                >Revisar possível reincidência deste residente</a
              >
            </div>
          }
        </section>
        <section class="op-section">
          <h2>Advertências registradas</h2>
          @if (!items().length) {
            <div class="op-empty" role="status">
              <h3>Nenhuma advertência encontrada</h3>
              <p>Uma ocorrência só gera advertência depois de análise e decisão do supervisor.</p>
            </div>
          } @else {
            <div class="op-list">
              @for (item of items(); track item.id) {
                <article class="op-row">
                  <div class="op-row-main">
                    <h3>{{ item.residentName }}</h3>
                    <p>
                      {{ categories[item.category] }} · {{ severities[item.severity] }} ·
                      {{ civil(item.warningDate) }}
                    </p>
                    <p>{{ item.description }}</p>
                    @if (item.requiresReview) {
                      <p>Origem em conferência · não conta para reincidência</p>
                    }
                  </div>
                  <span class="op-status">{{
                    item.status === 'VIGENTE' ? 'Valendo' : 'Anulada'
                  }}</span
                  ><a class="op-row-link" [routerLink]="['/advertencias', item.id]"
                    >Ver advertência<span class="material-symbols-outlined" aria-hidden="true"
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
                Carregar mais advertências
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
export class WarningsLocalPage {
  searchFilters: Record<string, string> = {};
  private appliedSearch: Record<string, string> = {};

  readonly session = inject(DemoSessionService);
  private readonly api = inject(CommunicationsLocalApiService);
  private readonly registry = inject(ResidentApiService);
  private readonly route = inject(ActivatedRoute);
  readonly residentId = new FormControl(this.route.snapshot.queryParamMap.get('residente') ?? '', {
    nonNullable: true,
  });
  readonly appliedResident = signal('');
  readonly residents = signal<ResidentRecord[]>([]);
  readonly items = signal<DisciplineWarning[]>([]);
  readonly nextCursor = signal<number | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly moreLoading = signal(false);
  readonly moreError = signal('');
  readonly categories = categoryLabels;
  readonly severities = severityLabels;
  readonly civil = formatCivilDate;
  private generation = 0;
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    this.appliedSearch = { ...this.searchFilters };
    if (this.session.active() || !this.session.hasRole('supervisor')) return;
    const generation = ++this.generation;
    const resident = this.residentId.value;
    this.loading.set(true);
    this.moreLoading.set(false);
    this.error.set('');
    this.moreError.set('');
    this.items.set([]);
    try {
      const [page, residents] = await Promise.all([
        this.api.warnings(resident, undefined, this.appliedSearch),
        this.registry.list(),
      ]);
      if (generation === this.generation) {
        this.items.set(page.items);
        this.nextCursor.set(page.nextCursor);
        this.residents.set(residents);
        this.appliedResident.set(resident);
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
      const page = await this.api.warnings(this.appliedResident(), cursor, this.appliedSearch);
      if (generation === this.generation) {
        this.items.update((items) => [
          ...items,
          ...page.items.filter((item) => !items.some((previous) => previous.id === item.id)),
        ]);
        this.nextCursor.set(page.nextCursor);
      }
    } catch (error) {
      if (generation === this.generation) this.moreError.set(communicationsError(error));
    } finally {
      if (generation === this.generation) this.moreLoading.set(false);
    }
  }
}

@Component({
  standalone: true,
  selector: 'sager-warning-form-local',
  imports: [
    SearchableSelectDirective,
    UnsavedFormDirective,
    RouterLink,
    ReactiveFormsModule,
    CommunicationsStateComponent,
    WarningFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-narrow">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/advertencias">← Advertências</a>
          <h1>Nova advertência</h1>
          <p>Conte o que aconteceu e o que você decidiu.</p>
        </div>
      </header>
      <sager-communications-state
        [demo]="session.active()"
        [blocked]="!session.hasRole('supervisor')"
        [loading]="loading()"
        [error]="loadError()"
        (retry)="load()"
      />
      @if (!session.active() && session.hasRole('supervisor') && !loading() && !loadError()) {
        @if (!residents().length) {
          <section class="op-empty" role="status">
            <h2>Nenhum residente disponível</h2>
            <p>É necessário um cadastro válido para vincular a advertência.</p>
          </section>
        } @else {
          <form
            sagerUnsaved
            [sagerSaving]="busy"
            class="panel op-panel comm-form"
            [formGroup]="form"
            (ngSubmit)="review()"
            novalidate
          >
            <h2>Dados da advertência</h2>
            <p class="comm-help">
              Se já existe uma notificação sobre este fato, crie a advertência por ela.
            </p>
            <label class="field"
              >Residente<select sagerSearchable [formControl]="residentId">
                <option value="">Selecione um residente</option>
                @for (resident of residents(); track resident.id) {
                  <option [value]="resident.id">
                    {{ resident.name }} · {{ resident.enrollment }}
                  </option>
                }
              </select>
              @if (residentId.touched && residentId.invalid) {
                <span class="field-error">Selecione o residente por cadastro.</span>
              }</label
            ><sager-warning-fields [form]="form" [maxDate]="context()?.currentDate || ''" />
            @if (error()) {
              <p class="comm-error" role="alert">{{ error() }}</p>
            }
            @if (conflict()) {
              <button class="btn-secondary" type="button" (click)="load()">Recarregar dados</button>
            }
            <div class="comm-actions">
              <a class="btn-secondary" routerLink="/advertencias">Cancelar</a
              ><button class="btn" type="submit" [disabled]="busy() || conflict()">
                {{ busy() ? 'Processando…' : 'Conferir e dar advertência' }}
              </button>
            </div>
          </form>
        }
      }
    </main>
  `,
  styleUrl: './communications-local.scss',
})
export class WarningFormLocalPage {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(CommunicationsLocalApiService);
  private readonly registry = inject(ResidentApiService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(MatDialog);
  private readonly intent = new CommunicationIntent();
  readonly residents = signal<ResidentRecord[]>([]);
  readonly context = signal<DisciplineContext | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly conflict = signal(false);
  readonly form = warningForm();
  readonly residentId = new FormControl('', { nonNullable: true, validators: Validators.required });
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    if (this.session.active() || !this.session.hasRole('supervisor') || this.busy()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.conflict.set(false);
    try {
      const [context, residents] = await Promise.all([this.api.context(), this.registry.list()]);
      this.context.set(context);
      this.residents.set(residents);
      this.form.reset({
        category: 'AUSENCIA',
        severity: 'LEVE',
        warningDate: context.currentDate,
        description: '',
        justification: '',
      });
      this.residentId.reset('');
    } catch (error) {
      this.loadError.set(communicationsError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async review(): Promise<void> {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (
      this.session.active() ||
      !this.session.hasRole('supervisor') ||
      this.busy() ||
      this.conflict()
    )
      return;
    this.form.markAllAsTouched();
    this.residentId.markAsTouched();
    const input = warningInput(this.form);
    const resident = this.residents().find((item) => item.id === this.residentId.value);
    let invalid = warningFormError(input, this.context()?.currentDate ?? '');
    if (this.form.invalid || !resident || invalid) {
      this.error.set(invalid || 'Revise os campos e selecione um residente cadastrado.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const context = await this.api.context();
      this.context.set(context);
      invalid = warningFormError(input, context.currentDate);
      if (invalid) {
        this.error.set(invalid);
        return;
      }
      this.dialogs
        .open<
          CommunicationReviewDialogComponent,
          CommunicationReviewData,
          CommunicationReviewResult
        >(CommunicationReviewDialogComponent, {
          data: {
            title: 'Revisar advertência manual',
            action: 'Confirmar emissão da advertência',
            warning:
              'A emissão torna o conteúdo imutável e publica a advertência para este residente. Anular depois exigirá outra decisão motivada.',
            lines: [
              { label: 'Residente', value: resident.name + ' · ' + resident.enrollment },
              { label: 'Categoria', value: categoryLabels[input.category] },
              { label: 'Gravidade humana', value: severityLabels[input.severity] },
              { label: 'Data', value: formatCivilDate(input.warningDate) },
              { label: 'Descrição', value: input.description },
              { label: 'Justificativa', value: input.justification },
            ],
          },
          width: '650px',
          maxWidth: 'calc(100vw - 32px)',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
        })
        .afterClosed()
        .subscribe((result) => {
          if (result) void this.save({ ...input, residentId: resident.id });
          else if (trigger?.isConnected) trigger.focus();
        });
    } catch (error) {
      this.error.set(communicationsError(error));
    } finally {
      this.busy.set(false);
    }
  }
  private async save(
    input: ReturnType<typeof warningInput> & { residentId: string },
  ): Promise<void> {
    if (this.busy() || this.conflict()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const warning = await this.api.createWarning({
        ...input,
        idempotencyKey: this.intent.for(input),
      });
      this.busy.set(false);
      this.form.markAsPristine();
      await this.router.navigate(['/advertencias', warning.id]);
    } catch (error) {
      this.error.set(communicationsError(error));
      if (error instanceof CommunicationsApiError && error.status === 409) this.conflict.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  standalone: true,
  selector: 'sager-warning-detail-local',
  imports: [RouterLink, CommunicationsStateComponent, EvidenceLocalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-page">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/advertencias">← Advertências</a>
          <h1>Advertência registrada</h1>
          @if (item(); as warning) {
            <p>{{ warning.residentName }} · {{ categories[warning.category] }}</p>
          }
        </div>
        @if (item(); as warning) {
          <span class="op-status">{{ warning.status === 'VIGENTE' ? 'Valendo' : 'Anulada' }}</span>
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
        as warning
      ) {
        @if (warning.requiresReview) {
          <p class="comm-warning" role="alert">
            A origem está em conferência. Esta advertência continua no histórico, mas não conta para
            reincidência por enquanto.
          </p>
        }
        <div class="comm-grid">
          <div class="comm-stack">
            <section class="panel op-panel">
              <h2>Conteúdo emitido</h2>
              <dl class="comm-definition">
                <div>
                  <dt>Residente</dt>
                  <dd>{{ warning.residentName }}</dd>
                </div>
                <div>
                  <dt>Categoria</dt>
                  <dd>{{ categories[warning.category] }}</dd>
                </div>
                <div>
                  <dt>Gravidade decidida</dt>
                  <dd>{{ severities[warning.severity] }}</dd>
                </div>
                <div>
                  <dt>Data da advertência</dt>
                  <dd>{{ civil(warning.warningDate) }}</dd>
                </div>
                <div>
                  <dt>Descrição</dt>
                  <dd>{{ warning.description }}</dd>
                </div>
                <div>
                  <dt>Justificativa da decisão</dt>
                  <dd>{{ warning.justification }}</dd>
                </div>
                <div>
                  <dt>Emitida em</dt>
                  <dd>{{ formatTime(warning.issuedAt) }}</dd>
                </div>
                @if (warning.annulmentReason) {
                  <div>
                    <dt>Justificativa da anulação</dt>
                    <dd>{{ warning.annulmentReason }}</dd>
                  </div>
                }
              </dl>
              <p class="comm-help">Mesmo anulada, a advertência continua guardada no histórico.</p>
            </section>
            @if (occurrence(); as origin) {
              <sager-local-evidence [occurrence]="origin" />
            }
          </div>
          <section class="panel op-panel">
            <h2>Ações do supervisor</h2>
            <div class="comm-links">
              <a [routerLink]="['/residentes', warning.residentId, 'reincidencias']"
                >Revisar possível reincidência</a
              >
              @if (warning.notificationId) {
                <a [routerLink]="['/notificacoes', warning.notificationId]"
                  >Ver análise da notificação</a
                >
              }
            </div>
            @if (warning.status === 'VIGENTE') {
              <button
                class="btn-secondary"
                type="button"
                [disabled]="busy() || conflict()"
                (click)="annul()"
              >
                Anular com justificativa
              </button>
            }
            @if (error()) {
              <p class="comm-error" role="alert">{{ error() }}</p>
            }
            @if (success()) {
              <p class="comm-success" role="status">{{ success() }}</p>
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
export class WarningDetailLocalPage {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(CommunicationsLocalApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(MatDialog);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly item = signal<DisciplineWarning | null>(null);
  readonly occurrence = signal<DisciplineOccurrence | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly conflict = signal(false);
  readonly categories = categoryLabels;
  readonly severities = severityLabels;
  readonly civil = formatCivilDate;
  readonly formatTime = formatCommunicationTime;
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    if (this.session.active() || !this.session.hasRole('supervisor') || this.busy()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.success.set('');
    this.conflict.set(false);
    this.item.set(null);
    try {
      const item = await this.api.warning(this.id);
      const occurrence = item.occurrenceId ? await this.api.occurrence(item.occurrenceId) : null;
      this.item.set(item);
      this.occurrence.set(occurrence);
    } catch (error) {
      this.loadError.set(communicationsError(error));
    } finally {
      this.loading.set(false);
    }
  }
  annul(): void {
    const item = this.item();
    if (!item || item.status !== 'VIGENTE' || this.busy() || this.conflict()) return;
    this.dialogs
      .open<CommunicationReviewDialogComponent, CommunicationReviewData, CommunicationReviewResult>(
        CommunicationReviewDialogComponent,
        {
          data: {
            title: 'Revisar anulação da advertência',
            action: 'Confirmar anulação',
            warning:
              'A anulação preserva o conteúdo emitido e a ciência anterior. A advertência deixa de integrar a base de reincidência.',
            requireReason: true,
            lines: [
              { label: 'Residente', value: item.residentName },
              { label: 'Descrição', value: item.description },
              { label: 'Data', value: formatCivilDate(item.warningDate) },
            ],
          },
          width: '650px',
          maxWidth: 'calc(100vw - 32px)',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
        },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) void this.save(item, result.reason);
      });
  }
  private async save(item: DisciplineWarning, reason: string): Promise<void> {
    if (this.busy() || this.conflict()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.item.set(await this.api.annulWarning(item.id, item.version, reason));
      this.success.set('Advertência anulada. O histórico continua guardado.');
    } catch (error) {
      this.error.set(communicationsError(error));
      if (error instanceof CommunicationsApiError && error.status === 409) this.conflict.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
