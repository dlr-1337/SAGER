import { NgTemplateOutlet } from '@angular/common';
import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { rememberFilters } from '../../core/filter-state';
import { autoRefresh } from '../../core/auto-refresh';
import { cursorPages } from '../../core/list-page';
import { AutoRefreshStatusComponent } from '../../shared/auto-refresh-status.component';
import { FilterChip, FilterPanelComponent } from '../../shared/filter-panel.component';
import { PaginationComponent } from '../../shared/pagination.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { CommunicationsStateComponent } from '../communications/communications-local.shared';
import {
  formatCivilDate,
  formatCommunicationTime,
  validCivilDate,
} from '../communications/communications-local.utils';
import { RoomApiService } from '../management/room-api.service';
import { ResidentApiService, ResidentRecord } from '../management/resident-api.service';
import {
  AccommodationUnit,
  HousingMap,
  RoomRecord,
  cascadeLocation,
  clearMissingLocation,
  roomOptionLabel,
  roomsIn,
  unitOptionLabel,
  unitsIn,
} from '../management/housing.models';
import { CleaningComponent } from '../operations/cleaning.component';
import { RankingComponent } from '../operations/ranking.component';
import { CleaningLocalApiService } from './cleaning-local-api.service';
import {
  CleaningAssessment,
  CleaningFilters,
  CleaningPolicy,
  CleaningRanking,
  OwnCleaningAssessment,
  RankingPeriod,
} from './cleaning-local.models';
import {
  criteriaKeys,
  criterionLabels,
  decimal,
  isRankingPeriod,
  periodLabels,
} from './cleaning-local.utils';
import { reportingError } from './reporting-local.transport';

@Component({
  standalone: true,
  selector: 'sager-cleaning-page',
  imports: [CleaningComponent, forwardRef(() => CleaningListLocalPage)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (session.active()) {
      <app-cleaning />
    } @else {
      <sager-cleaning-list-local />
    }`,
})
export class CleaningPage {
  readonly session = inject(DemoSessionService);
}

@Component({
  standalone: true,
  selector: 'sager-cleaning-list-local',
  imports: [
    SearchableSelectDirective,
    RouterLink,
    ReactiveFormsModule,
    CommunicationsStateComponent,
    FilterPanelComponent,
    PaginationComponent,
    AutoRefreshStatusComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-page">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/inicio"
            ><span class="back-arrow" aria-hidden="true">←</span>Início</a
          >
          <h1>{{ own ? 'Minhas avaliações de limpeza' : 'Avaliações de limpeza' }}</h1>
          <p>
            {{
              own
                ? 'Veja as avaliações dos quartos em que você estava.'
                : 'Veja as notas e o histórico de cada avaliação do quarto.'
            }}
          </p>
        </div>
        @if (!own && session.hasRole('supervisor') && !session.active()) {
          <a class="btn" routerLink="/limpeza/nova">Registrar avaliação</a>
        }
      </header>
      <sager-communications-state [demo]="session.active()" [blocked]="!allowed()" />
      @if (!session.active() && allowed()) {
        <sager-auto-refresh-status [refresh]="refresh" />
        <nav class="comm-links" aria-label="Limpeza">
          <a routerLink="/ranking">Ver ranking</a>
          @if (!own) {
            <a routerLink="/relatorios">Gerar relatório</a>
          }
        </nav>
        @if (own) {
          <section class="panel op-panel">
            <h2>Filtrar avaliações</h2>
            <form class="op-filters" [formGroup]="filters">
              <label class="field">Data inicial<input type="date" formControlName="from" /></label
              ><label class="field">Data final<input type="date" formControlName="to" /></label>
            </form>
          </section>
        } @else {
          <sager-filter-panel
            heading="Filtrar avaliações"
            key="cleaning"
            [chips]="chips()"
            (remove)="filters.get($event)?.setValue('')"
            (clear)="filters.reset()"
          >
            <div filterMain class="op-filters" [formGroup]="filters">
              <label class="field">Data inicial<input type="date" formControlName="from" /></label
              ><label class="field">Data final<input type="date" formControlName="to" /></label>
            </div>
            <div class="op-filters" [formGroup]="filters">
              <label class="field"
                >Alojamento<select sagerSearchable formControlName="accommodationId">
                  <option value="">Todos</option>
                  @for (accommodation of housing().accommodations; track accommodation.id) {
                    <option [value]="accommodation.id">{{ accommodation.name }}</option>
                  }
                </select></label
              ><label class="field"
                >Casa ou bloco<select sagerSearchable formControlName="unitId">
                  <option value="">Todos</option>
                  @for (unit of visibleUnits(); track unit.id) {
                    <option [value]="unit.id">{{ unitLabel(unit) }}</option>
                  }
                </select></label
              ><label class="field"
                >Quarto<select sagerSearchable formControlName="roomId">
                  <option value="">Todos os quartos</option>
                  @for (room of visibleRooms(); track room.id) {
                    <option [value]="room.id">{{ roomLabel(room) }}</option>
                  }
                </select></label
              ><label class="field"
                >Residente participante<select sagerSearchable formControlName="residentId">
                  <option value="">Todos os participantes</option>
                  @for (resident of residents(); track resident.id) {
                    <option [value]="resident.id">
                      {{ resident.name }} · {{ resident.enrollment }}
                    </option>
                  }
                </select></label
              >
            </div>
          </sager-filter-panel>
        }
        @if (filterError()) {
          <p class="comm-error" role="alert">{{ filterError() }}</p>
        }
        @if (optionsError()) {
          <p class="comm-error" role="alert">{{ optionsError() }}</p>
        }
        <section class="op-section">
          <h2 id="cleaning-results-title" tabindex="-1">Avaliações registradas</h2>
          <sager-communications-state
            [loading]="list.loading()"
            [error]="list.error()"
            (retry)="load()"
          />
          @if (!list.loading() && !list.error()) {
            <div class="op-list">
              @for (item of list.items(); track item.id) {
                <article class="op-row">
                  <div class="op-row-main">
                    <h3>Quarto {{ item.roomCode }}</h3>
                    <p>
                      {{ civil(item.assessmentDate) }} · avaliado em
                      {{ formatTime(item.evaluatedAt) }}
                    </p>
                    <p>
                      {{
                        item.feedback.previousScore === null
                          ? 'Primeira avaliação'
                          : 'Avaliação corrigida'
                      }}
                    </p>
                  </div>
                  <div class="op-row-side">
                    <span class="cleaning-score">Nota {{ decimal(item.score) }}</span>
                  </div>
                  <a
                    class="op-row-link"
                    [routerLink]="[own ? '/minha-limpeza' : '/limpeza', item.id]"
                    >Ver avaliação<span class="material-symbols-outlined" aria-hidden="true"
                      >arrow_forward</span
                    ></a
                  >
                </article>
              } @empty {
                <div class="op-empty" role="status">
                  <h3>Nenhuma avaliação encontrada</h3>
                  <p>
                    {{
                      own
                        ? 'Só aparecem avaliações de quartos em que você estava.'
                        : 'Altere os filtros ou registre uma avaliação do quarto.'
                    }}
                  </p>
                </div>
              }
            </div>
          }
          <sager-pagination
            [page]="list.page()"
            [hasNext]="list.hasNext()"
            [busy]="list.loading()"
            anchor="cleaning-results-title"
            (pageChange)="list.go($event)"
          />
        </section>
      }
    </main>
  `,
  styleUrl: './cleaning-local.scss',
})
export class CleaningListLocalPage {
  readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(CleaningLocalApiService);
  private readonly roomApi = inject(RoomApiService);
  private readonly residentApi = inject(ResidentApiService);
  private readonly destroy = inject(DestroyRef);
  readonly own = this.route.snapshot.data['ownCleaning'] === true;
  readonly filters = new FormGroup({
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    accommodationId: new FormControl('', { nonNullable: true }),
    unitId: new FormControl('', { nonNullable: true }),
    roomId: new FormControl('', { nonNullable: true }),
    residentId: new FormControl('', { nonNullable: true }),
  });
  private readonly location = toSignal(this.filters.valueChanges, {
    initialValue: this.filters.getRawValue(),
  });
  readonly housing = signal<HousingMap>({ accommodations: [], units: [], rooms: [] });
  readonly visibleUnits = computed(() => unitsIn(this.housing(), this.location().accommodationId));
  readonly visibleRooms = computed(() =>
    roomsIn(this.housing(), this.location().accommodationId, this.location().unitId),
  );
  readonly residents = signal<ResidentRecord[]>([]);
  readonly chips = computed<FilterChip[]>(() => {
    const value = { ...this.filters.getRawValue(), ...this.location() };
    const housing = this.housing();
    const room = housing.rooms.find((item) => item.id === value.roomId);
    const resident = this.residents().find((item) => item.id === value.residentId);
    const chips: [string, string, string | undefined][] = [
      ['from', 'De', value.from && this.civil(value.from)],
      ['to', 'Até', value.to && this.civil(value.to)],
      [
        'accommodationId',
        'Alojamento',
        value.accommodationId &&
          (housing.accommodations.find((item) => item.id === value.accommodationId)?.name ??
            'Alojamento selecionado'),
      ],
      [
        'unitId',
        'Casa ou bloco',
        value.unitId &&
          (housing.units.find((item) => item.id === value.unitId)?.name ??
            'Casa ou bloco selecionada'),
      ],
      ['roomId', 'Quarto', value.roomId && (room ? this.roomLabel(room) : 'Quarto selecionado')],
      [
        'residentId',
        'Residente',
        value.residentId &&
          (resident ? `${resident.name} · ${resident.enrollment}` : 'Residente selecionado'),
      ],
    ];
    return chips
      .filter((chip): chip is [string, string, string] => !!chip[2])
      .map(([key, label, chipValue]) => ({ key, label, value: chipValue }));
  });
  readonly list = cursorPages<CleaningAssessment | OwnCleaningAssessment>(
    (cursor) =>
      this.own
        ? this.api.ownList(this.applied.from, this.applied.to, cursor)
        : this.api.list(this.applied, cursor),
    reportingError,
  );
  readonly refresh = autoRefresh(() => this.list.refresh());
  readonly filterError = signal('');
  readonly optionsError = signal('');
  private applied: CleaningFilters = {};
  readonly civil = formatCivilDate;
  readonly formatTime = formatCommunicationTime;
  readonly decimal = decimal;
  constructor() {
    rememberFilters('cleaning-local.pages', this.filters);
    cascadeLocation(this.filters.controls);
    this.filters.valueChanges
      .pipe(debounceTime(250), takeUntilDestroyed())
      .subscribe(() => void this.load());
    if (!this.own && !this.session.active() && this.allowed()) void this.loadOptions();
    void this.load();
  }
  roomLabel(room: RoomRecord): string {
    return roomOptionLabel(room, this.housing().units);
  }
  unitLabel(unit: AccommodationUnit): string {
    return unitOptionLabel(unit, this.housing(), this.location().accommodationId);
  }
  allowed(): boolean {
    return this.own
      ? this.session.hasRole('residente')
      : this.session.hasRole('gestor', 'supervisor');
  }
  // As opções saem uma vez, separadas da lista: mudar filtro ou página não as pede de novo.
  private async loadOptions(): Promise<void> {
    try {
      const [housing, residents] = await Promise.all([this.roomApi.map(), this.residentApi.list()]);
      if (this.destroy.destroyed) return;
      this.housing.set(housing);
      this.residents.set(residents);
      clearMissingLocation(housing, this.filters.controls);
    } catch {
      if (!this.destroy.destroyed)
        this.optionsError.set(
          'Não foi possível carregar alojamentos, quartos e residentes. Recarregue a página para tentar novamente.',
        );
    }
  }
  load(): Promise<void> {
    if (this.session.active() || !this.allowed()) return Promise.resolve();
    const filters = this.filters.getRawValue();
    if (
      (filters.from && !validCivilDate(filters.from)) ||
      (filters.to && !validCivilDate(filters.to)) ||
      (filters.from && filters.to && filters.from > filters.to)
    ) {
      this.filterError.set('Informe datas válidas com início igual ou anterior ao fim.');
      return Promise.resolve();
    }
    this.filterError.set('');
    this.applied = this.own ? { from: filters.from, to: filters.to } : filters;
    return this.list.reload();
  }
}

@Component({
  standalone: true,
  selector: 'sager-cleaning-detail-local',
  imports: [RouterLink, CommunicationsStateComponent, AutoRefreshStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-narrow">
      <header class="op-heading">
        <div>
          <a class="op-back" [routerLink]="own ? '/minha-limpeza' : '/limpeza'"
            ><span class="back-arrow" aria-hidden="true">←</span>Avaliações de limpeza</a
          >
          <h1>Avaliação do quarto</h1>
          @if (item(); as assessment) {
            <p>{{ assessment.roomCode }} · {{ civil(assessment.assessmentDate) }}</p>
          }
        </div>
      </header>
      <sager-communications-state
        [demo]="session.active()"
        [blocked]="!allowed()"
        [loading]="loading()"
        [error]="error()"
        (retry)="load()"
      />
      @if (!session.active() && allowed() && !loading() && !error() && item(); as assessment) {
        <sager-auto-refresh-status [refresh]="refresh" />
        <section class="panel op-panel">
          <h2>Notas da avaliação</h2>
          <dl class="comm-definition">
            <div>
              <dt>Avaliado em</dt>
              <dd>{{ formatTime(assessment.evaluatedAt) }}</dd>
            </div>
            @for (key of keys; track key) {
              <div>
                <dt>{{ criteriaLabels[key] }}</dt>
                <dd>{{ decimal(assessment.criteria[key]) }}</dd>
              </div>
            }
            <div>
              <dt>Nota</dt>
              <dd>{{ decimal(assessment.score) }}</dd>
            </div>
            @if (assessment.observation) {
              <div>
                <dt>Observação</dt>
                <dd>{{ assessment.observation }}</dd>
              </div>
            }
          </dl>
          <div class="cleaning-feedback">
            <h3>Comparação e posição no período</h3>
            <dl class="comm-definition">
              <div>
                <dt>Nota anterior desta avaliação</dt>
                <dd>
                  {{
                    assessment.feedback.previousScore === null
                      ? 'Sem comparação anterior'
                      : decimal(assessment.feedback.previousScore)
                  }}
                </dd>
              </div>
              <div>
                <dt>Nota atual</dt>
                <dd>{{ decimal(assessment.feedback.newScore) }}</dd>
              </div>
              <div>
                <dt>Diferença da correção</dt>
                <dd>
                  {{
                    assessment.feedback.delta === null
                      ? 'Sem comparação anterior'
                      : decimal(assessment.feedback.delta)
                  }}
                </dd>
              </div>
              <div>
                <dt>Média do quarto no período</dt>
                <dd>{{ decimal(assessment.feedback.periodMean) }}</dd>
              </div>
              <div>
                <dt>Posição no período</dt>
                <dd>
                  {{
                    assessment.feedback.position === null
                      ? 'Sem posição'
                      : assessment.feedback.position + 'º'
                  }}
                </dd>
              </div>
              <div>
                <dt>Período</dt>
                <dd>
                  {{ periodLabels[assessment.feedback.rankingReference] }} ·
                  {{ civil(assessment.feedback.from) }} a {{ civil(assessment.feedback.to) }}
                </dd>
              </div>
            </dl>
          </div>
          <details class="learn-more">
            <summary>Saiba mais</summary>
            <p class="comm-help">
              A nota é a média dos quatro itens. Ninguém recebe advertência automática por causa
              dela.
            </p>
          </details>
          @if (!own && session.hasRole('supervisor')) {
            <div class="decision-actions">
              <a class="btn-secondary" [routerLink]="['/limpeza', assessment.id, 'corrigir']"
                >Corrigir com justificativa</a
              >
            </div>
          }
          <div class="comm-links">
            <a
              routerLink="/ranking"
              [queryParams]="{
                referencia: assessment.assessmentDate,
                periodo: assessment.feedback.rankingReference,
              }"
              >Ver ranking deste período</a
            >
          </div>
        </section>
        @if (administrative(); as admin) {
          <section class="panel op-panel op-section">
            <h2>Quem estava no quarto na hora da avaliação</h2>
            <p class="comm-help">Esta lista não muda se alguém trocar de quarto depois.</p>
            <ul>
              @for (participant of admin.participants; track participant.allocationId) {
                <li>{{ participant.residentName }}</li>
              } @empty {
                <li>Ninguém registrado no quarto nessa hora.</li>
              }
            </ul>
            <h3>Histórico de correções</h3>
            <ol class="comm-history">
              @for (revision of admin.revisions; track revision.version) {
                <li>
                  <strong>Nota {{ decimal(revision.score) }}</strong
                  ><time [attr.datetime]="revision.recordedAt"
                    >Gravada em {{ formatTime(revision.recordedAt) }}</time
                  >
                  @for (key of keys; track key) {
                    <p>{{ criteriaLabels[key] }}: {{ decimal(revision.criteria[key]) }}</p>
                  }
                  @if (revision.reason) {
                    <p>Justificativa: {{ revision.reason }}</p>
                  }
                  @if (revision.observation) {
                    <p>Observação: {{ revision.observation }}</p>
                  }
                </li>
              }
            </ol>
          </section>
        }
      }
    </main>
  `,
  styleUrl: './cleaning-local.scss',
})
export class CleaningDetailLocalPage {
  readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(CleaningLocalApiService);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly own = this.route.snapshot.data['ownCleaning'] === true;
  readonly item = signal<CleaningAssessment | OwnCleaningAssessment | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly keys = criteriaKeys;
  readonly criteriaLabels = criterionLabels;
  readonly periodLabels = periodLabels;
  readonly decimal = decimal;
  readonly civil = formatCivilDate;
  readonly formatTime = formatCommunicationTime;
  readonly refresh = autoRefresh(() => this.load(true), { busy: () => this.loading() });
  private sequence = 0;
  constructor() {
    void this.load();
  }
  allowed(): boolean {
    return this.own
      ? this.session.hasRole('residente')
      : this.session.hasRole('supervisor', 'gestor');
  }
  administrative(): CleaningAssessment | null {
    const item = this.item();
    return item && 'participants' in item ? item : null;
  }
  /** `silent`: atualização automática, sem "Carregando" e sem tirar a avaliação da tela. */
  async load(silent = false): Promise<void> {
    if (this.session.active() || !this.allowed()) return;
    const current = ++this.sequence;
    if (!silent) {
      this.loading.set(true);
      this.error.set('');
      this.item.set(null);
    }
    try {
      const item = this.own ? await this.api.own(this.id) : await this.api.get(this.id);
      if (current === this.sequence) {
        this.item.set(item);
        this.error.set('');
      }
    } catch (error) {
      if (silent) throw error;
      if (current === this.sequence) this.error.set(reportingError(error));
    } finally {
      if (!silent && current === this.sequence) this.loading.set(false);
    }
  }
}

@Component({
  standalone: true,
  selector: 'sager-ranking-page',
  imports: [RankingComponent, forwardRef(() => RankingLocalPage)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (session.active()) {
      <app-ranking />
    } @else {
      <sager-ranking-local />
    }`,
})
export class RankingPage {
  readonly session = inject(DemoSessionService);
}

@Component({
  standalone: true,
  selector: 'sager-ranking-local',
  imports: [
    SearchableSelectDirective,
    RouterLink,
    ReactiveFormsModule,
    CommunicationsStateComponent,
    NgTemplateOutlet,
    PaginationComponent,
    AutoRefreshStatusComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-narrow">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/inicio"
            ><span class="back-arrow" aria-hidden="true">←</span>Início</a
          >
          <h1>Ranking de limpeza</h1>
          <p>Veja a posição de cada quarto pela média das notas.</p>
        </div>
      </header>
      <sager-communications-state
        [blocked]="!allowed()"
        [loading]="loading()"
        [error]="error()"
        (retry)="load()"
      />
      @if (allowed() && !loading() && !error()) {
        <sager-auto-refresh-status [refresh]="refresh" />
        <section class="panel op-panel">
          <h2>Escolha o período</h2>
          <form class="comm-form-grid" [formGroup]="form" (ngSubmit)="load()">
            <label class="field"
              >Período<select sagerSearchable formControlName="period">
                <option value="LAST_5_DAYS">Últimos 5 dias</option>
                <option value="WEEK">Semana</option>
                <option value="MONTH">Mês</option>
                <option value="SEMESTER">Semestre</option>
              </select></label
            ><label class="field"
              >{{ dateLabel() }}<input type="date" formControlName="referenceDate" /></label
            ><button class="btn-secondary" type="submit">Ver período</button>
          </form>
          @if (filterError()) {
            <p class="comm-error" role="alert">{{ filterError() }}</p>
          }
          @if (ranking(); as result) {
            <h3 id="ranking-period-title" tabindex="-1">
              {{ periods[result.period] }} · {{ civil(result.from) }} a {{ civil(result.to) }}
            </h3>
            <details class="learn-more">
              <summary>Saiba mais</summary>
              <p class="comm-help">
                Últimos 5 dias: média das notas do último dia escolhido e dos 4 dias antes dele.
                Cada quarto tem uma nota por dia, e dia sem avaliação não entra na conta.
              </p>
              <p class="comm-help">
                Quartos com a mesma média ficam na mesma posição. Quarto sem avaliação fica sem
                posição.
              </p>
              @if (session.hasRole('residente')) {
                <p class="comm-help">
                  Dos outros quartos, você vê só o código e a posição. Você vê a nota do seu quarto
                  se estava nele em uma avaliação deste período.
                </p>
              }
            </details>
            <!-- Só posição e nota; o residente não vê a nota dos outros quartos. -->
            <ng-template #rankRow let-row>
              <article class="cleaning-rank">
                <strong>{{ row.position === null ? 'Sem posição' : row.position + 'º' }}</strong>
                <div>
                  <strong>Quarto {{ row.roomCode }}</strong>
                </div>
                @if (!session.hasRole('residente') || row.own) {
                  <div>
                    <span class="cleaning-score">{{
                      row.mean === null ? 'Sem nota' : decimal(row.mean)
                    }}</span>
                  </div>
                }
              </article>
            </ng-template>
            @if (ownRows().length) {
              <section class="cleaning-own" aria-labelledby="ranking-own-title">
                <h4 id="ranking-own-title">
                  {{
                    ownRows().length === 1
                      ? 'Seu quarto neste período'
                      : 'Seus quartos neste período'
                  }}
                </h4>
                @for (row of ownRows(); track row.roomCode) {
                  <ng-container *ngTemplateOutlet="rankRow; context: { $implicit: row }" />
                }
              </section>
              <h4 class="cleaning-others-title">Outros quartos</h4>
            }
            <div aria-label="Posições dos quartos">
              @for (row of pageRows(); track row.roomCode) {
                <ng-container *ngTemplateOutlet="rankRow; context: { $implicit: row }" />
              } @empty {
                <p>Nenhum quarto disponível neste período.</p>
              }
            </div>
            <sager-pagination
              [page]="rankingPage()"
              [total]="listRows().length"
              anchor="ranking-period-title"
              (pageChange)="rankingPage.set($event)"
            />
          }
        </section>
        <nav class="comm-links" aria-label="Avaliações">
          <a [routerLink]="session.hasRole('residente') ? '/minha-limpeza' : '/limpeza'">{{
            session.hasRole('residente') ? 'Ver minhas avaliações' : 'Ver avaliações de limpeza'
          }}</a>
        </nav>
      }
    </main>
  `,
  styleUrl: './cleaning-local.scss',
})
export class RankingLocalPage {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(CleaningLocalApiService);
  private readonly route = inject(ActivatedRoute);
  readonly form = new FormGroup({
    period: new FormControl<RankingPeriod>(this.initialPeriod(), { nonNullable: true }),
    referenceDate: new FormControl(this.route.snapshot.queryParamMap.get('referencia') ?? '', {
      nonNullable: true,
    }),
  });
  private readonly chosenPeriod = toSignal(this.form.controls.period.valueChanges, {
    initialValue: this.form.controls.period.value,
  });
  /** Nos últimos 5 dias, a data escolhida é o fim da janela. */
  readonly dateLabel = computed(() =>
    this.chosenPeriod() === 'LAST_5_DAYS' ? 'Último dia' : 'Um dia do período',
  );
  readonly ranking = signal<CleaningRanking | null>(null);
  readonly rankingPage = signal(0);
  // O residente vê a linha do próprio quarto só no topo, em qualquer página.
  readonly ownRows = computed(() =>
    this.session.hasRole('residente') ? (this.ranking()?.items ?? []).filter((row) => row.own) : [],
  );
  /** A lista paginada não repete o quarto que já aparece no topo. */
  readonly listRows = computed(() => {
    const items = this.ranking()?.items ?? [];
    return this.ownRows().length ? items.filter((row) => !row.own) : items;
  });
  readonly pageRows = computed(() =>
    this.listRows().slice(this.rankingPage() * 25, (this.rankingPage() + 1) * 25),
  );
  readonly policy = signal<CleaningPolicy | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly filterError = signal('');
  readonly periods = periodLabels;
  readonly decimal = decimal;
  readonly civil = formatCivilDate;
  readonly refresh = autoRefresh(() => this.update());
  /** Período à vista: a atualização automática repete este, não o que está escolhido no campo. */
  private shown: { period: RankingPeriod; referenceDate: string } | null = null;
  private sequence = 0;
  constructor() {
    void this.load();
  }
  private initialPeriod(): RankingPeriod {
    const period = this.route.snapshot.queryParamMap.get('periodo');
    return isRankingPeriod(period) ? period : 'LAST_5_DAYS';
  }
  allowed(): boolean {
    return !this.session.active() && this.session.hasRole('gestor', 'supervisor', 'residente');
  }
  async load(): Promise<void> {
    if (!this.allowed()) return;
    const value = this.form.getRawValue();
    if (value.referenceDate && !validCivilDate(value.referenceDate)) {
      this.filterError.set('Informe uma data de referência válida.');
      return;
    }
    const current = ++this.sequence;
    this.loading.set(true);
    this.error.set('');
    this.filterError.set('');
    try {
      const policy = await this.api.policy();
      const referenceDate = value.referenceDate || policy.currentDate;
      const ranking = await this.api.ranking(
        value.period,
        referenceDate,
        this.session.hasRole('residente'),
      );
      if (current !== this.sequence) return;
      this.policy.set(policy);
      this.form.controls.referenceDate.setValue(referenceDate);
      this.rankingPage.set(0);
      this.ranking.set(ranking);
      this.shown = { period: value.period, referenceDate };
    } catch (error) {
      if (current !== this.sequence) return;
      this.ranking.set(null);
      this.shown = null;
      this.error.set(reportingError(error));
    } finally {
      if (current === this.sequence) this.loading.set(false);
    }
  }
  /** Atualização automática: mesmo período e mesma página, sem "Carregando"; a falha volta. */
  private async update(): Promise<void> {
    const shown = this.shown;
    if (!shown || this.loading()) return;
    const current = this.sequence;
    const ranking = await this.api.ranking(
      shown.period,
      shown.referenceDate,
      this.session.hasRole('residente'),
    );
    if (current !== this.sequence) return;
    this.ranking.set(ranking);
    const last = Math.max(0, Math.ceil(this.listRows().length / 25) - 1);
    this.rankingPage.update((page) => Math.min(page, last));
  }
}
