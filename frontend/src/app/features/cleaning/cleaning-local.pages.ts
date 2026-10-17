import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { rememberFilters } from '../../core/filter-state';
import { ChangeDetectionStrategy, Component, forwardRef, inject, signal } from '@angular/core';
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
import { RoomRecord } from '../management/housing.models';
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
import { criteriaKeys, criterionLabels, decimal, periodLabels } from './cleaning-local.utils';
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-page">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/inicio">← Início</a>
          <h1>{{ own ? 'Minhas avaliações de limpeza' : 'Avaliações de limpeza' }}</h1>
          <p>
            {{
              own
                ? 'Consulte avaliações em que sua participação foi registrada no instante avaliado.'
                : 'Confira notas, feedback e o histórico de cada avaliação do quarto.'
            }}
          </p>
        </div>
        @if (!own && session.hasRole('supervisor') && !session.active()) {
          <a class="btn" routerLink="/limpeza/nova">Registrar avaliação</a>
        }
      </header>
      <sager-communications-state
        [demo]="session.active()"
        [blocked]="!allowed()"
        [loading]="loading()"
        [error]="error()"
        (retry)="load()"
      />
      @if (!session.active() && allowed() && !loading() && !error()) {
        <nav class="comm-links" aria-label="Limpeza">
          <a routerLink="/ranking">Consultar ranking interno</a>
          @if (!own) {
            <a routerLink="/relatorios">Consultar relatórios</a>
          }
        </nav>
        <section class="panel op-panel">
          <h2>Filtrar avaliações</h2>
          <form class="op-filters" [formGroup]="filters" (ngSubmit)="load()">
            <label class="field">Data inicial<input type="date" formControlName="from" /></label
            ><label class="field">Data final<input type="date" formControlName="to" /></label>
            @if (!own) {
              <label class="field"
                >Quarto<select sagerSearchable formControlName="roomId">
                  <option value="">Todos os quartos</option>
                  @for (room of rooms(); track room.id) {
                    <option [value]="room.id">{{ room.code }}</option>
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
            }
            <button class="btn-secondary" type="submit">Buscar avaliações</button>
          </form>
          @if (filterError()) {
            <p class="comm-error" role="alert">{{ filterError() }}</p>
          }
        </section>
        <section class="op-section">
          <h2>Avaliações registradas</h2>
          <div class="op-list">
            @for (item of items(); track item.id) {
              <article class="op-row">
                <div class="op-row-main">
                  <h3>Quarto {{ item.roomCode }}</h3>
                  <p>
                    {{ civil(item.assessmentDate) }} · avaliação presencial
                    {{ formatTime(item.evaluatedAt) }}
                  </p>
                  <p>
                    Versão {{ item.version }} ·
                    {{
                      item.feedback.previousScore === null
                        ? 'Primeiro registro desta avaliação'
                        : 'Avaliação corrigida com histórico preservado'
                    }}
                  </p>
                </div>
                <div class="op-row-side">
                  <span class="cleaning-score">Nota {{ decimal(item.score) }}</span>
                </div>
                <a class="op-row-link" [routerLink]="[own ? '/minha-limpeza' : '/limpeza', item.id]"
                  >Consultar avaliação<span class="material-symbols-outlined" aria-hidden="true"
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
                      ? 'Somente avaliações com sua participação registrada aparecem aqui. Transferências posteriores não atribuem notas antigas a sua conta.'
                      : 'Altere os filtros ou registre uma avaliação do quarto.'
                  }}
                </p>
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
                Carregar mais avaliações
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
  styleUrl: './cleaning-local.scss',
})
export class CleaningListLocalPage {
  readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(CleaningLocalApiService);
  private readonly roomApi = inject(RoomApiService);
  private readonly residentApi = inject(ResidentApiService);
  readonly own = this.route.snapshot.data['ownCleaning'] === true;
  readonly filters = new FormGroup({
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    roomId: new FormControl('', { nonNullable: true }),
    residentId: new FormControl('', { nonNullable: true }),
  });
  readonly rooms = signal<RoomRecord[]>([]);
  readonly residents = signal<ResidentRecord[]>([]);
  readonly items = signal<(CleaningAssessment | OwnCleaningAssessment)[]>([]);
  readonly nextCursor = signal<number | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly filterError = signal('');
  readonly moreLoading = signal(false);
  readonly moreError = signal('');
  private generation = 0;
  private applied: CleaningFilters = {};
  readonly civil = formatCivilDate;
  readonly formatTime = formatCommunicationTime;
  readonly decimal = decimal;
  constructor() {
    rememberFilters('cleaning-local.pages', this.filters);
    void this.load();
  }
  allowed(): boolean {
    return this.own
      ? this.session.hasRole('residente')
      : this.session.hasRole('gestor', 'supervisor');
  }
  async load(): Promise<void> {
    if (this.session.active() || !this.allowed()) return;
    const filters = this.filters.getRawValue();
    if (
      (filters.from && !validCivilDate(filters.from)) ||
      (filters.to && !validCivilDate(filters.to)) ||
      (filters.from && filters.to && filters.from > filters.to)
    ) {
      this.filterError.set('Informe datas válidas com início igual ou anterior ao fim.');
      return;
    }
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    this.filterError.set('');
    this.moreError.set('');
    this.items.set([]);
    try {
      if (this.own) {
        const page = await this.api.ownList(filters.from, filters.to);
        if (generation === this.generation) {
          this.items.set(page.items);
          this.nextCursor.set(page.nextCursor);
          this.applied = { from: filters.from, to: filters.to };
        }
      } else {
        const [page, rooms, residents] = await Promise.all([
          this.api.list(filters),
          this.roomApi.list(),
          this.residentApi.list(),
        ]);
        if (generation === this.generation) {
          this.items.set(page.items);
          this.nextCursor.set(page.nextCursor);
          this.rooms.set(rooms);
          this.residents.set(residents);
          this.applied = filters;
        }
      }
    } catch (error) {
      if (generation === this.generation) this.error.set(reportingError(error));
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
      const page = this.own
        ? await this.api.ownList(this.applied.from, this.applied.to, cursor)
        : await this.api.list(this.applied, cursor);
      if (generation === this.generation) {
        this.items.update((items) => [
          ...items,
          ...page.items.filter((item) => !items.some((old) => old.id === item.id)),
        ]);
        this.nextCursor.set(page.nextCursor);
      }
    } catch (error) {
      if (generation === this.generation) this.moreError.set(reportingError(error));
    } finally {
      this.moreLoading.set(false);
    }
  }
}

@Component({
  standalone: true,
  selector: 'sager-cleaning-detail-local',
  imports: [RouterLink, CommunicationsStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-narrow">
      <header class="op-heading">
        <div>
          <a class="op-back" [routerLink]="own ? '/minha-limpeza' : '/limpeza'"
            >← Avaliações de limpeza</a
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
        <section class="panel op-panel">
          <h2>Notas e feedback da avaliação</h2>
          <dl class="comm-definition">
            <div>
              <dt>Instante avaliado</dt>
              <dd>{{ formatTime(assessment.evaluatedAt) }}</dd>
            </div>
            @for (key of keys; track key) {
              <div>
                <dt>{{ criteriaLabels[key] }} · peso 25%</dt>
                <dd>{{ decimal(assessment.criteria[key]) }}</dd>
              </div>
            }
            <div>
              <dt>Nota calculada pelo servidor</dt>
              <dd>{{ decimal(assessment.score) }}</dd>
            </div>
            <div>
              <dt>Versão da avaliação</dt>
              <dd>{{ assessment.version }}</dd>
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
                <dt>Período de referência</dt>
                <dd>
                  {{ periodLabels[assessment.feedback.rankingReference] }} ·
                  {{ civil(assessment.feedback.from) }} a {{ civil(assessment.feedback.to) }}
                </dd>
              </div>
            </dl>
          </div>
          <p class="comm-help">
            A nota usa os quatro critérios com peso igual, média e duas casas decimais. A primeira
            gravação não inventa nota anterior. Nenhuma advertência é automática.
          </p>
          <div class="comm-actions">
            @if (!own && session.hasRole('supervisor')) {
              <a class="btn-secondary" [routerLink]="['/limpeza', assessment.id, 'corrigir']"
                >Corrigir com justificativa</a
              >
            }
            <a
              routerLink="/ranking"
              [queryParams]="{
                referencia: assessment.assessmentDate,
                periodo: assessment.feedback.rankingReference,
              }"
              >Consultar ranking deste período</a
            ><button class="btn-secondary" type="button" (click)="load()">Atualizar dados</button>
          </div>
        </section>
        @if (administrative(); as admin) {
          <section class="panel op-panel op-section">
            <h2>Participantes capturados no instante avaliado</h2>
            <p class="comm-help">
              Estes vínculos são históricos. Transferências posteriores não alteram esta avaliação
              nem presumem responsabilidade coletiva.
            </p>
            <ul>
              @for (participant of admin.participants; track participant.allocationId) {
                <li>{{ participant.residentName }}</li>
              } @empty {
                <li>Quarto sem participantes registrados neste instante.</li>
              }
            </ul>
            <h3>Histórico das revisões</h3>
            <ol class="comm-history">
              @for (revision of admin.revisions; track revision.version) {
                <li>
                  <strong>Versão {{ revision.version }} · nota {{ decimal(revision.score) }}</strong
                  ><time [attr.datetime]="revision.recordedAt"
                    >Gravada em {{ formatTime(revision.recordedAt) }}</time
                  >
                  <p>Autoria: conta {{ revision.recordedBy }}</p>
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
  async load(): Promise<void> {
    if (this.session.active() || !this.allowed()) return;
    this.loading.set(true);
    this.error.set('');
    this.item.set(null);
    try {
      this.item.set(this.own ? await this.api.own(this.id) : await this.api.get(this.id));
    } catch (error) {
      this.error.set(reportingError(error));
    } finally {
      this.loading.set(false);
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-narrow">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/inicio">← Início</a>
          <h1>Ranking interno de limpeza</h1>
          <p>
            Compare posições no período com médias calculadas a partir das avaliações registradas.
          </p>
        </div>
      </header>
      <sager-communications-state
        [blocked]="!allowed()"
        [loading]="loading()"
        [error]="error()"
        (retry)="load()"
      />
      @if (allowed() && !loading() && !error()) {
        <section class="panel op-panel">
          <h2>Período de comparação</h2>
          <form class="comm-form-grid" [formGroup]="form" (ngSubmit)="load()">
            <label class="field"
              >Período<select sagerSearchable formControlName="period">
                <option value="WEEK">Semana</option>
                <option value="MONTH">Mês</option>
                <option value="SEMESTER">Semestre</option>
              </select></label
            ><label class="field"
              >Data de referência<input type="date" formControlName="referenceDate" /></label
            ><button class="btn-secondary" type="submit">Consultar período</button>
          </form>
          @if (filterError()) {
            <p class="comm-error" role="alert">{{ filterError() }}</p>
          }
          @if (ranking(); as result) {
            <h3>
              {{ periods[result.period] }} · {{ civil(result.from) }} a {{ civil(result.to) }}
            </h3>
            <p class="comm-help">
              Empates compartilham a posição e deixam a seguinte vaga: 1º, 1º, 3º. Sem avaliação, a
              média e a posição permanecem ausentes.
            </p>
            @if (session.hasRole('residente')) {
              <p class="comm-help">
                Outros quartos mostram apenas código e posição. Suas notas exigem participação
                registrada em uma avaliação deste período.
              </p>
            }
            <div aria-label="Posições dos quartos">
              @for (row of result.items; track row.roomCode) {
                <article class="cleaning-rank">
                  <strong>{{ row.position === null ? 'Sem posição' : row.position + 'º' }}</strong>
                  <div>
                    <strong>Quarto {{ row.roomCode }}</strong>
                    @if (row.own) {
                      <p>Sua participação registrada neste período</p>
                    }
                  </div>
                  <div>
                    @if (!session.hasRole('residente') || row.own) {
                      <span class="cleaning-score">{{ decimal(row.mean) }}</span>
                      <p>
                        {{
                          row.assessmentCount === 0
                            ? 'Sem avaliações no período'
                            : row.assessmentCount + ' avaliação(ões)'
                        }}
                      </p>
                    } @else {
                      <span>Nota privada do quarto</span>
                    }
                  </div>
                </article>
              } @empty {
                <p>Nenhum quarto disponível neste período.</p>
              }
            </div>
          }
        </section>
        <nav class="comm-links" aria-label="Avaliações">
          <a [routerLink]="session.hasRole('residente') ? '/minha-limpeza' : '/limpeza'">{{
            session.hasRole('residente')
              ? 'Consultar minhas avaliações'
              : 'Consultar avaliações de limpeza'
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
  readonly ranking = signal<CleaningRanking | null>(null);
  readonly policy = signal<CleaningPolicy | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly filterError = signal('');
  readonly periods = periodLabels;
  readonly decimal = decimal;
  readonly civil = formatCivilDate;
  constructor() {
    void this.load();
  }
  private initialPeriod(): RankingPeriod {
    const period = this.route.snapshot.queryParamMap.get('periodo');
    return period === 'WEEK' || period === 'SEMESTER' ? period : 'MONTH';
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
      this.policy.set(policy);
      this.form.controls.referenceDate.setValue(referenceDate);
      this.ranking.set(ranking);
    } catch (error) {
      this.ranking.set(null);
      this.error.set(reportingError(error));
    } finally {
      this.loading.set(false);
    }
  }
}
