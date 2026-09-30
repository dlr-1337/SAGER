import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { ResidentApiService, ResidentRecord } from '../management/resident-api.service';
import {
  CommunicationsApiError,
  CommunicationsLocalApiService,
  communicationsError,
} from './communications-local-api.service';
import { DisciplineTerm, RecurrenceCandidate } from './communications-local.models';
import {
  CommunicationDownloads,
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
  recurrenceSelectionError,
  severityLabels,
} from './communications-local.utils';

@Component({
  standalone: true,
  selector: 'sager-recurrence-local',
  imports: [RouterLink, ReactiveFormsModule, CommunicationsStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-page">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/advertencias">← Advertências</a>
          <h1>Revisar possível reincidência</h1>
          @if (resident(); as person) {
            <p>{{ person.name }} · {{ person.enrollment }}</p>
          }
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
        <p class="comm-help">
          Dois registros da mesma categoria e de origens distintas em até 90 dias podem formar uma
          base. O candidato exige análise e decisão humana; a consulta não emite termo.
        </p>
        <div class="comm-grid">
          <div class="comm-stack">
            @for (candidate of candidates(); track candidate.category) {
              <section class="panel op-panel">
                <h2>{{ categories[candidate.category] }}</h2>
                <p>
                  {{ candidate.minimumWarnings }} advertências · janela de
                  {{ candidate.windowDays }} dias ·
                  {{
                    candidate.candidate ? 'Base disponível para revisão' : 'Sem candidato elegível'
                  }}
                </p>
                @for (warning of candidate.warnings; track warning.id) {
                  <label class="comm-check"
                    ><input
                      type="checkbox"
                      [checked]="selected().includes(warning.id)"
                      [disabled]="busy() || conflict() || !candidate.candidate"
                      (change)="toggle(candidate, warning.id, $any($event.target).checked)"
                    /><span
                      ><strong
                        >{{ civil(warning.warningDate) }} ·
                        {{ severities[warning.severity] }}</strong
                      ><span class="comm-check-description">{{ warning.description }}</span
                      ><span class="comm-check-description"
                        >Origem {{ warning.occurrenceId }}</span
                      ></span
                    ></label
                  ><a [routerLink]="['/advertencias', warning.id]">Consultar conteúdo e origem</a>
                } @empty {
                  <p>Nenhuma advertência elegível nesta categoria.</p>
                }
              </section>
            }
          </div>
          <section class="panel op-panel">
            <h2>Decisão sobre a base selecionada</h2>
            <p>{{ selected().length }} advertência(s) selecionada(s)</p>
            <label class="field"
              >Justificativa da decisão<textarea
                rows="5"
                maxlength="2000"
                [formControl]="decision"
              ></textarea>
            </label>
            <p class="field-hint">Explique a decisão em 10 a 2.000 caracteres.</p>
            <div class="comm-actions">
              <button
                class="btn"
                type="button"
                [disabled]="busy() || conflict()"
                (click)="review()"
              >
                Revisar emissão de termo</button
              ><button class="btn-secondary" type="button" [disabled]="busy()" (click)="load()">
                {{ conflict() ? 'Recarregar base' : 'Atualizar base' }}
              </button>
            </div>
            @if (error()) {
              <p class="comm-error" role="alert">{{ error() }}</p>
            }
          </section>
        </div>
        <section class="op-section">
          <h2>Termos já emitidos</h2>
          <div class="op-list">
            @for (term of terms(); track term.id) {
              <article class="op-row">
                <div class="op-row-main">
                  <h3>{{ term.status === 'EMITIDO' ? 'Termo vigente' : 'Termo anulado' }}</h3>
                  <p>{{ formatTime(term.issuedAt) }} · {{ term.warningIds.length }} advertências</p>
                  <p>{{ term.decision }}</p>
                </div>
                <a class="op-row-link" [routerLink]="['/termos', term.id]"
                  >Consultar termo<span class="material-symbols-outlined" aria-hidden="true"
                    >arrow_forward</span
                  ></a
                >
              </article>
            } @empty {
              <div class="op-empty" role="status">
                <h3>Nenhum termo emitido</h3>
                <p>A base apresentada não gera um termo automaticamente.</p>
              </div>
            }
          </div>
          @if (nextCursor() !== null) {
            <div class="comm-actions">
              <button
                class="btn-secondary"
                type="button"
                [disabled]="moreLoading()"
                (click)="more()"
              >
                Carregar mais termos
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
export class RecurrenceLocalPage {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(CommunicationsLocalApiService);
  private readonly registry = inject(ResidentApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly intent = new CommunicationIntent();
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly resident = signal<ResidentRecord | null>(null);
  readonly candidates = signal<RecurrenceCandidate[]>([]);
  readonly terms = signal<DisciplineTerm[]>([]);
  readonly selected = signal<string[]>([]);
  readonly selectedCategory = signal('');
  readonly decision = new FormControl('', { nonNullable: true });
  readonly nextCursor = signal<number | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly moreLoading = signal(false);
  readonly moreError = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
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
    this.conflict.set(false);
    this.selected.set([]);
    this.selectedCategory.set('');
    try {
      const [resident, candidates, terms] = await Promise.all([
        this.registry.get(this.id),
        this.api.recurrences(this.id),
        this.api.terms(this.id),
      ]);
      this.resident.set(resident);
      this.candidates.set(candidates);
      this.terms.set(terms.items);
      this.nextCursor.set(terms.nextCursor);
    } catch (error) {
      this.loadError.set(communicationsError(error));
    } finally {
      this.loading.set(false);
    }
  }
  toggle(candidate: RecurrenceCandidate, id: string, checked: boolean): void {
    if (!candidate.candidate || this.busy() || this.conflict()) return;
    if (checked && this.selectedCategory() !== candidate.category) this.selected.set([]);
    this.selectedCategory.set(candidate.category);
    this.selected.update((items) =>
      checked ? [...items.filter((item) => item !== id), id] : items.filter((item) => item !== id),
    );
  }
  async more(): Promise<void> {
    const cursor = this.nextCursor();
    if (cursor === null || this.moreLoading()) return;
    this.moreLoading.set(true);
    this.moreError.set('');
    try {
      const page = await this.api.terms(this.id, cursor);
      this.terms.update((items) => [
        ...items,
        ...page.items.filter((item) => !items.some((old) => old.id === item.id)),
      ]);
      this.nextCursor.set(page.nextCursor);
    } catch (error) {
      this.moreError.set(communicationsError(error));
    } finally {
      this.moreLoading.set(false);
    }
  }
  async review(): Promise<void> {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (
      this.busy() ||
      this.conflict() ||
      this.session.active() ||
      !this.session.hasRole('supervisor')
    )
      return;
    const candidate = this.candidates().find((item) => item.category === this.selectedCategory());
    const warningIds = [...this.selected()];
    const decision = this.decision.value.trim();
    const invalid = candidate
      ? recurrenceSelectionError(candidate, warningIds)
      : 'Selecione uma base elegível da mesma categoria.';
    if (invalid || decision.length < 10 || decision.length > 2000) {
      this.error.set(invalid || 'Explique a decisão em 10 a 2.000 caracteres.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const fresh = (await this.api.recurrences(this.id)).find(
        (item) => item.category === candidate!.category,
      );
      if (
        !fresh ||
        recurrenceSelectionError(fresh, warningIds) ||
        warningIds.some(
          (id) =>
            fresh.warnings.find((item) => item.id === id)?.version !==
            candidate!.warnings.find((item) => item.id === id)?.version,
        )
      ) {
        this.conflict.set(true);
        this.error.set(
          'A base mudou. Recarregue as advertências e revise a seleção antes de emitir o termo.',
        );
        return;
      }
      this.dialogs
        .open<
          CommunicationReviewDialogComponent,
          CommunicationReviewData,
          CommunicationReviewResult
        >(CommunicationReviewDialogComponent, {
          data: {
            title: 'Revisar termo de reincidência',
            action: 'Confirmar emissão do termo',
            warning:
              'O termo terá conteúdo e PDF imutáveis e será publicado para o residente. A base e a decisão permanecerão preservadas.',
            confirmation: 'Conferi as origens distintas, a categoria e a decisão sobre esta base.',
            lines: [
              { label: 'Residente', value: this.resident()?.name ?? '' },
              { label: 'Categoria', value: categoryLabels[candidate!.category] },
              ...fresh.warnings
                .filter((item) => warningIds.includes(item.id))
                .map((item) => ({
                  label: 'Advertência de ' + formatCivilDate(item.warningDate),
                  value: item.description,
                })),
              { label: 'Decisão', value: decision },
            ],
          },
          width: '650px',
          maxWidth: 'calc(100vw - 32px)',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
        })
        .afterClosed()
        .subscribe((result) => {
          if (result) void this.save({ warningIds, decision, confirmed: true });
          else if (trigger?.isConnected) trigger.focus();
        });
    } catch (error) {
      this.error.set(communicationsError(error));
    } finally {
      this.busy.set(false);
    }
  }
  private async save(input: {
    warningIds: string[];
    decision: string;
    confirmed: true;
  }): Promise<void> {
    if (this.busy() || this.conflict()) return;
    this.busy.set(true);
    try {
      const item = await this.api.issueTerm(this.id, {
        ...input,
        idempotencyKey: this.intent.for(input),
      });
      await this.router.navigate(['/termos', item.id]);
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
  selector: 'sager-term-detail-local',
  imports: [RouterLink, CommunicationsStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-narrow">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/advertencias">← Advertências</a>
          <h1>Termo de reincidência</h1>
          @if (item(); as term) {
            <p>{{ term.residentName }} · emitido em {{ formatTime(term.issuedAt) }}</p>
          }
        </div>
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
        as term
      ) {
        <section class="panel op-panel">
          <h2>{{ term.status === 'EMITIDO' ? 'Termo vigente' : 'Termo anulado' }}</h2>
          <p class="comm-message">{{ term.decision }}</p>
          <h3>Advertências que formaram a base</h3>
          <ul class="comm-basis">
            @for (id of term.warningIds; track id) {
              <li>
                <a [routerLink]="['/advertencias', id]">Consultar advertência {{ id }}</a>
              </li>
            }
          </ul>
          <p class="comm-help">
            A base e o conteúdo emitido são históricos. Anulação de uma advertência ou mudança na
            origem não apaga este termo.
          </p>
          @if (term.annulmentReason) {
            <dl class="comm-definition">
              <div>
                <dt>Justificativa da anulação</dt>
                <dd>{{ term.annulmentReason }}</dd>
              </div>
            </dl>
          }
          <div class="comm-actions">
            <a [routerLink]="['/residentes', term.residentId, 'reincidencias']"
              >Consultar base atual do residente</a
            ><button
              class="btn-secondary"
              type="button"
              [disabled]="downloading() || term.document.state !== 'STORED'"
              (click)="download()"
            >
              {{ downloading() ? 'Preparando PDF…' : 'Baixar PDF original' }}
            </button>
            @if (term.status === 'EMITIDO') {
              <button
                class="btn-secondary"
                type="button"
                [disabled]="busy() || conflict()"
                (click)="annul()"
              >
                Anular termo com justificativa
              </button>
            }
          </div>
          <p class="comm-help">
            PDF privado · {{ term.document.size.toLocaleString('pt-BR') }} bytes · documento
            preservado.
          </p>
          @if (error()) {
            <p class="comm-error" role="alert">{{ error() }}</p>
          }
          @if (success()) {
            <p class="comm-success" role="status">{{ success() }}</p>
          }
          <button class="btn-secondary" type="button" [disabled]="busy()" (click)="load()">
            {{ conflict() ? 'Recarregar termo' : 'Atualizar dados' }}
          </button>
        </section>
      }
    </main>
  `,
  styleUrl: './communications-local.scss',
})
export class TermDetailLocalPage implements OnDestroy {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(CommunicationsLocalApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(MatDialog);
  private readonly downloads = new CommunicationDownloads();
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  private alive = true;
  readonly item = signal<DisciplineTerm | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly success = signal('');
  readonly busy = signal(false);
  readonly downloading = signal(false);
  readonly conflict = signal(false);
  readonly formatTime = formatCommunicationTime;
  constructor() {
    void this.load();
  }
  ngOnDestroy(): void {
    this.alive = false;
    this.downloads.destroy();
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
      this.item.set(await this.api.term(this.id));
    } catch (error) {
      this.loadError.set(communicationsError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async download(): Promise<void> {
    const item = this.item();
    if (!item || this.downloading() || item.document.state !== 'STORED') return;
    this.downloading.set(true);
    this.error.set('');
    try {
      const blob = await this.api.document(item.id);
      if (this.alive) this.downloads.download(blob, item.id);
    } catch (error) {
      this.error.set(communicationsError(error));
    } finally {
      this.downloading.set(false);
    }
  }
  annul(): void {
    const item = this.item();
    if (!item || item.status !== 'EMITIDO' || this.busy() || this.conflict()) return;
    this.dialogs
      .open<CommunicationReviewDialogComponent, CommunicationReviewData, CommunicationReviewResult>(
        CommunicationReviewDialogComponent,
        {
          data: {
            title: 'Revisar anulação do termo',
            action: 'Confirmar anulação do termo',
            requireReason: true,
            warning: 'A decisão, a base, o PDF e a ciência anterior permanecem no histórico.',
            lines: [
              { label: 'Residente', value: item.residentName },
              { label: 'Decisão emitida', value: item.decision },
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
  private async save(item: DisciplineTerm, reason: string): Promise<void> {
    if (this.busy() || this.conflict()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.item.set(await this.api.annulTerm(item.id, item.version, reason));
      this.success.set(
        'Termo anulado por decisão humana. O documento e o histórico foram preservados.',
      );
    } catch (error) {
      this.error.set(communicationsError(error));
      if (error instanceof CommunicationsApiError && error.status === 409) this.conflict.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
