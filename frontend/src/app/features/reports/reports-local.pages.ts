import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { CommunicationsStateComponent } from '../communications/communications-local.shared';
import {
  CommunicationIntent,
  formatCivilDate,
  formatCommunicationTime,
} from '../communications/communications-local.utils';
import { decimal } from '../cleaning/cleaning-local.utils';
import { MonthlyIndicatorsComponent } from '../cleaning/monthly-indicators.component';
import { ReportingApiError, reportingError } from '../cleaning/reporting-local.transport';
import {
  AccommodationUnit,
  HousingMap,
  roomsIn,
  unitOptionLabel,
  unitsIn,
} from '../management/housing.models';
import { ResidentRecord } from '../management/resident-api.service';
import { reportsApi } from './reports-demo-api.service';
import { ReportsLocalApiService } from './reports-local-api.service';
import { PaginationComponent } from '../../shared/pagination.component';
import {
  ReportCatalog,
  ReportCode,
  ReportExport,
  ReportFormat,
  ReportListItem,
  ReportRow,
  ReportSnapshot,
} from './reports-local.models';
import {
  ReportDownloads,
  ReportListPolling,
  ReportPeriodPreset,
  normalizedReportInput,
  periodError,
  periodPreset,
  reportCell,
  reportDescriptions,
  reportFileName,
  reportInProgress,
  reportLabels,
  reportStatusLabels,
} from './reports-local.utils';

const FORMATS: ReportFormat[] = ['PDF', 'XLSX'];
const FORMAT_LABELS: Record<ReportFormat, string> = { PDF: 'PDF', XLSX: 'planilha Excel' };

@Component({
  standalone: true,
  selector: 'sager-report-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<article class="report-card">
    <h3 #heading [id]="'relatorio-' + item().id" tabindex="-1">
      {{ labels[item().catalogCode] }}
    </h3>
    <p class="report-card-meta">
      {{ civil(item().filters.from) }} a {{ civil(item().filters.to) }} · {{ item().rowCount }}
      {{ item().rowCount === 1 ? 'registro' : 'registros' }}
      @if (filtered()) {
        · com filtros
      }
    </p>
    <p class="report-card-status" role="status">{{ statusText() }}</p>
    @if (slow()) {
      <p class="comm-warning">
        Está demorando mais que o normal. Pode sair; ele continuará nesta lista.
      </p>
    }
    <div class="report-card-actions">
      @for (job of readyJobs(); track job.id) {
        <button class="btn" type="button" [disabled]="busy()" (click)="download(job)">
          <span class="material-symbols-outlined" aria-hidden="true">download</span>Baixar
          {{ formatLabels[job.format] }}
        </button>
      }
      @if (canRetry()) {
        <button class="btn" type="button" [disabled]="busy()" (click)="retry()">
          Tentar de novo
        </button>
      }
      @if (linkToDetail()) {
        <a class="btn-secondary" [routerLink]="['/relatorios/consultas', item().id]">
          Ver na tela
        </a>
      }
    </div>
    @if (actionError()) {
      <p class="comm-error" role="alert">{{ actionError() }}</p>
    }
    <div aria-live="polite">
      @if (downloaded()) {
        <p class="report-card-note">{{ downloaded() }}</p>
      }
    </div>
  </article>`,
  styleUrl: './reports-local.scss',
})
export class ReportCardComponent implements OnDestroy {
  readonly item = input.required<ReportListItem>();
  readonly slow = input(false);
  readonly linkToDetail = input(true);
  readonly changed = output<void>();
  private readonly session = inject(DemoSessionService);
  private readonly api = reportsApi();
  private readonly files = inject(ReportsLocalApiService);
  private readonly downloads = new ReportDownloads();
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  readonly labels = reportLabels;
  readonly formatLabels = FORMAT_LABELS;
  readonly civil = formatCivilDate;
  readonly busy = signal(false);
  readonly actionError = signal('');
  readonly downloaded = signal('');
  readonly filtered = computed(() => {
    const { accommodationId, unitId, roomId, residentId, status } = this.item().filters;
    return !!(accommodationId || unitId || roomId || residentId || status);
  });
  readonly readyJobs = computed(() =>
    FORMATS.flatMap((format) =>
      this.item().exports.filter((job) => job.format === format && job.status === 'READY'),
    ),
  );
  private readonly pendingFormats = computed(() =>
    FORMATS.filter((format) => {
      const job = this.item().exports.find((candidate) => candidate.format === format);
      return !job || job.status === 'FAILED';
    }),
  );
  private readonly expired = computed(() =>
    this.item().exports.some((job) => job.status === 'EXPIRED'),
  );
  readonly canRetry = computed(
    () => !reportInProgress(this.item()) && !this.expired() && this.pendingFormats().length > 0,
  );
  readonly statusText = computed(() => {
    if (reportInProgress(this.item())) return 'Montando os arquivos. Pode levar alguns segundos.';
    if (this.expired()) return 'Este relatório expirou. Gere de novo.';
    return this.pendingFormats().length ? 'Não deu certo montar o arquivo.' : 'Pronto para baixar.';
  });
  async download(job: ReportExport): Promise<void> {
    if (this.busy()) return;
    this.actionError.set('');
    if (this.session.active()) {
      this.downloaded.set('Na demonstração nenhum arquivo é baixado.');
      return;
    }
    this.busy.set(true);
    this.downloaded.set('');
    try {
      const blob = await this.files.download(job.id, job.format);
      this.downloads.download(blob, reportFileName(this.item(), job.format));
      this.downloaded.set(`O download de ${FORMAT_LABELS[job.format]} começou.`);
    } catch (error) {
      this.actionError.set(reportingError(error));
    } finally {
      this.busy.set(false);
    }
  }
  async retry(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    try {
      for (const format of this.pendingFormats())
        await this.api.requestExport(this.item().id, format);
    } catch (error) {
      this.actionError.set(reportingError(error));
    } finally {
      this.busy.set(false);
      this.changed.emit();
      // The retry button is about to disappear; keep keyboard users on this report.
      this.heading().nativeElement.focus();
    }
  }
  ngOnDestroy(): void {
    this.downloads.destroy();
  }
}

const PERIODS: { value: ReportPeriodPreset | 'datas'; label: string }[] = [
  { value: 'este-mes', label: 'Este mês' },
  { value: 'mes-passado', label: 'Mês passado' },
  { value: 'ultimos-7-dias', label: 'Últimos 7 dias' },
  { value: 'datas', label: 'Escolher datas' },
];
type FilterKey = 'accommodationId' | 'unitId' | 'roomId' | 'residentId' | 'status';

@Component({
  standalone: true,
  selector: 'sager-reports-local',
  imports: [
    SearchableSelectDirective,
    RouterLink,
    ReactiveFormsModule,
    CommunicationsStateComponent,
    ReportCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="page op-page comm-page">
    <header class="op-heading">
      <div>
        <a class="op-back" routerLink="/inicio">← Início</a>
        <h1>Relatórios</h1>
        <p>Escolha o que quer ver e o período. Depois, clique em “Gerar relatório”.</p>
      </div>
    </header>
    <sager-communications-state
      [blocked]="!allowed()"
      [loading]="loading()"
      [error]="error()"
      (retry)="retry()"
    />
    @if (allowed() && !loading() && !error() && catalog(); as rules) {
      <section class="panel op-panel" aria-label="Gerar relatório">
        <form [formGroup]="form" (ngSubmit)="generate()" novalidate>
          <fieldset class="report-step">
            <legend>1. O que você quer ver?</legend>
            <div class="report-types">
              @for (item of rules.items; track item.code) {
                <label class="report-option report-type">
                  <input
                    type="radio"
                    formControlName="catalogCode"
                    [value]="item.code"
                    (change)="form.controls.status.setValue('')"
                  />
                  <span>
                    <strong>{{ labels[item.code] }}</strong>
                    <small>{{ descriptions[item.code] }}</small>
                  </span>
                </label>
              }
            </div>
          </fieldset>
          <fieldset class="report-step">
            <legend>2. De qual período?</legend>
            <div class="report-periods">
              @for (period of periods; track period.value) {
                <label class="report-option">
                  <input
                    type="radio"
                    formControlName="period"
                    [value]="period.value"
                    (change)="applyPeriod()"
                  />
                  <span>{{ period.label }}</span>
                </label>
              }
            </div>
            @if (form.controls.period.value === 'datas') {
              <div class="comm-form-grid report-dates">
                <label class="field"
                  >Data inicial<input type="date" formControlName="from"
                /></label>
                <label class="field">Data final<input type="date" formControlName="to" /></label>
              </div>
            } @else {
              <p class="report-range">
                De {{ civil(form.controls.from.value) }} a {{ civil(form.controls.to.value) }}
              </p>
            }
          </fieldset>
          <details class="report-filters">
            <summary>Filtrar por alojamento, bloco, quarto ou residente (opcional)</summary>
            @if (filtersFailed()) {
              <p class="comm-warning" role="status">
                Não foi possível carregar todas as opções de filtro. Você ainda pode gerar o
                relatório.
              </p>
              <button class="btn-secondary" type="button" (click)="loadFilters()">
                Carregar filtros de novo
              </button>
            }
            <div class="comm-form-grid report-filter-grid">
              <label class="field"
                >Alojamento<select
                  sagerSearchable
                  formControlName="accommodationId"
                  (change)="form.patchValue({ unitId: '', roomId: '' })"
                >
                  <option value="">Todos os alojamentos</option>
                  @for (item of housing().accommodations; track item.id) {
                    <option [value]="item.id">{{ item.code }} · {{ item.name }}</option>
                  }
                </select></label
              ><label class="field"
                >Casa ou bloco<select
                  sagerSearchable
                  formControlName="unitId"
                  (change)="form.controls.roomId.setValue('')"
                >
                  <option value="">Todas as casas e blocos</option>
                  @for (item of visibleUnits(); track item.id) {
                    <option [value]="item.id">{{ unitLabel(item) }}</option>
                  }
                </select></label
              ><label class="field"
                >Quarto<select sagerSearchable formControlName="roomId">
                  <option value="">Todos os quartos</option>
                  @for (item of visibleRooms(); track item.id) {
                    <option [value]="item.id">{{ item.code }}</option>
                  }
                </select></label
              ><label class="field"
                >Residente<select sagerSearchable formControlName="residentId">
                  <option value="">Todos os residentes</option>
                  @for (item of residents(); track item.id) {
                    <option [value]="item.id">{{ item.name }} · {{ item.enrollment }}</option>
                  }
                </select></label
              ><label class="field"
                >Situação<select sagerSearchable formControlName="status">
                  <option value="">Todas as situações</option>
                  @for (status of statuses(); track status) {
                    <option [value]="status">{{ statusLabels[status] || status }}</option>
                  }
                </select></label
              >
            </div>
          </details>
          @if (activeFilters().length) {
            <div class="report-active" role="group" aria-label="Filtros ativos">
              <strong>Filtros ativos:</strong>
              @for (filter of activeFilters(); track filter.key) {
                <button
                  class="report-chip"
                  type="button"
                  [attr.aria-label]="'Remover filtro ' + filter.label"
                  (click)="removeFilter(filter.key)"
                >
                  {{ filter.label }}
                  <span class="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              }
              <button class="btn-secondary" type="button" (click)="clearFilters()">
                Limpar filtros
              </button>
            </div>
          }
          @if (actionError()) {
            <p class="comm-error" role="alert">{{ actionError() }}</p>
          }
          <div aria-live="polite">
            @if (notice()) {
              <p class="comm-warning">{{ notice() }}</p>
            }
          </div>
          <div class="comm-actions">
            <button class="btn report-generate" type="submit" [disabled]="busy()">
              {{ busy() ? 'Buscando registros…' : 'Gerar relatório' }}
            </button>
          </div>
        </form>
      </section>
      <section class="op-section report-list" aria-labelledby="relatorios-gerados">
        <h2 id="relatorios-gerados">Relatórios gerados</h2>
        <p class="comm-help">Ficam aqui por {{ rules.expiresAfterHours }} horas.</p>
        @if (list.error()) {
          <p class="comm-error" role="alert">{{ list.error() }}</p>
          <button class="btn-secondary" type="button" (click)="list.refresh()">
            Carregar a lista de novo
          </button>
        }
        @for (item of list.items(); track item.id) {
          <sager-report-card
            [item]="item"
            [slow]="list.slow().has(item.id)"
            (changed)="list.refresh()"
          />
        } @empty {
          @if (!list.error()) {
            <p>Nenhum relatório gerado ainda.</p>
          }
        }
      </section>
      <nav class="comm-links" aria-label="Outros relatórios">
        <a
          class="btn-secondary"
          [routerLink]="session.active() ? '/relatorios/individual/ana' : '/relatorios/individual'"
          >Ver a evolução de um residente</a
        >
      </nav>
    }
  </main>`,
  styleUrl: './reports-local.scss',
})
export class ReportsLocalPage implements OnDestroy {
  readonly session = inject(DemoSessionService);
  private readonly api = reportsApi();
  private readonly injector = inject(Injector);
  readonly form = new FormGroup({
    catalogCode: new FormControl<ReportCode>('PRESENCA', { nonNullable: true }),
    period: new FormControl<ReportPeriodPreset | 'datas'>('este-mes', { nonNullable: true }),
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    accommodationId: new FormControl('', { nonNullable: true }),
    unitId: new FormControl('', { nonNullable: true }),
    roomId: new FormControl('', { nonNullable: true }),
    residentId: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
  });
  readonly list = new ReportListPolling(() => this.api.list());
  readonly catalog = signal<ReportCatalog | null>(null);
  readonly housing = signal<HousingMap>({ accommodations: [], units: [], rooms: [] });
  readonly residents = signal<ResidentRecord[]>([]);
  readonly filtersFailed = signal(false);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly notice = signal('');
  readonly labels = reportLabels;
  readonly descriptions = reportDescriptions;
  readonly statusLabels = reportStatusLabels;
  readonly periods = PERIODS;
  readonly civil = formatCivilDate;
  private today = '';
  private generation = 0;
  private readonly intent = new CommunicationIntent();
  constructor() {
    // Reloads when the demonstration scenario changes; the real mode runs this only once.
    effect(() => {
      this.session.scenario();
      untracked(() => void this.load());
    });
    this.form.valueChanges.subscribe(() => this.notice.set(''));
  }
  allowed(): boolean {
    return this.session.hasRole('gestor', 'supervisor');
  }
  visibleUnits() {
    return unitsIn(this.housing(), this.form.controls.accommodationId.value);
  }
  visibleRooms() {
    const { accommodationId, unitId } = this.form.getRawValue();
    return roomsIn(this.housing(), accommodationId, unitId);
  }
  unitLabel(unit: AccommodationUnit): string {
    return unitOptionLabel(unit, this.housing(), this.form.controls.accommodationId.value);
  }
  statuses(): string[] {
    const items = this.catalog()?.items ?? [];
    const code = this.form.controls.catalogCode.value;
    return code === 'CONSOLIDADO'
      ? [...new Set(items.flatMap((item) => item.statuses))]
      : (items.find((item) => item.code === code)?.statuses ?? []);
  }
  activeFilters(): { key: FilterKey; label: string }[] {
    const value = this.form.getRawValue();
    const { accommodations, units, rooms } = this.housing();
    const filters: { key: FilterKey; label: string | undefined }[] = [
      {
        key: 'accommodationId',
        label:
          value.accommodationId &&
          (accommodations.find((item) => item.id === value.accommodationId)?.name ??
            'Alojamento selecionado'),
      },
      {
        key: 'unitId',
        label:
          value.unitId &&
          (units.find((item) => item.id === value.unitId)?.name ?? 'Casa ou bloco selecionada'),
      },
      {
        key: 'roomId',
        label:
          value.roomId &&
          (rooms.find((item) => item.id === value.roomId)?.code ?? 'Quarto selecionado'),
      },
      {
        key: 'residentId',
        label:
          value.residentId &&
          (this.residents().find((item) => item.id === value.residentId)?.name ??
            'Residente selecionado'),
      },
      {
        key: 'status',
        label: value.status ? (this.statusLabels[value.status] ?? value.status) : undefined,
      },
    ];
    return filters.filter((item): item is { key: FilterKey; label: string } => !!item.label);
  }
  removeFilter(key: FilterKey): void {
    this.form.controls[key].setValue('');
    if (key === 'accommodationId') this.form.patchValue({ unitId: '', roomId: '' });
    if (key === 'unitId') this.form.controls.roomId.setValue('');
  }
  clearFilters(): void {
    this.form.patchValue({
      accommodationId: '',
      unitId: '',
      roomId: '',
      residentId: '',
      status: '',
    });
  }
  applyPeriod(): void {
    const period = this.form.controls.period.value;
    if (period !== 'datas') this.form.patchValue(periodPreset(period, this.today));
  }
  retry(): void {
    if (this.session.active() && this.session.scenario() !== 'padrao')
      this.session.setScenario('padrao');
    else void this.load();
  }
  async load(): Promise<void> {
    if (!this.allowed()) return;
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    this.actionError.set('');
    try {
      const [catalog, today] = await Promise.all([this.api.catalog(), this.api.currentDate()]);
      if (generation !== this.generation) return;
      this.catalog.set(catalog);
      this.today = today;
      this.applyPeriod();
      void this.loadFilters();
      void this.list.refresh();
      this.loading.set(false);
    } catch (error) {
      if (generation !== this.generation) return;
      this.error.set(reportingError(error));
      this.loading.set(false);
    }
  }
  async loadFilters(): Promise<void> {
    const options = await this.api.filterOptions();
    this.housing.set(options.housing);
    this.residents.set(options.residents);
    this.filtersFailed.set(options.failed);
  }
  private invalidSelection(rules: ReportCatalog): string {
    const value = this.form.getRawValue();
    return (
      periodError(value.from, value.to, rules.maxPeriodDays) ||
      (!rules.items.some((item) => item.code === value.catalogCode)
        ? 'Escolha um tipo de relatório.'
        : '') ||
      ((value.accommodationId &&
        !this.housing().accommodations.some((item) => item.id === value.accommodationId)) ||
      (value.unitId && !this.visibleUnits().some((item) => item.id === value.unitId)) ||
      (value.roomId && !this.visibleRooms().some((item) => item.id === value.roomId)) ||
      (value.residentId && !this.residents().some((item) => item.id === value.residentId))
        ? 'Confira os filtros: alojamento, bloco e quarto precisam combinar.'
        : '') ||
      (value.status && !this.statuses().includes(value.status)
        ? 'Escolha uma situação deste tipo de relatório.'
        : '')
    );
  }
  async generate(): Promise<void> {
    const rules = this.catalog();
    if (!rules || !this.allowed() || this.busy()) return;
    const invalid = this.invalidSelection(rules);
    this.notice.set('');
    this.actionError.set(invalid);
    if (invalid) return;
    const trigger = document.activeElement as HTMLElement | null;
    const { catalogCode, period: _period, ...filters } = this.form.getRawValue();
    const input = normalizedReportInput(catalogCode, filters);
    this.busy.set(true);
    let created = '';
    try {
      const snapshot = await this.api.create({ ...input, idempotencyKey: this.intent.for(input) });
      // The screen no longer navigates away, so the next click must be a new report.
      this.intent.reset();
      if (!snapshot.rowCount) {
        this.notice.set('Não encontramos registros nesse período. Tente outro período.');
        return;
      }
      // A failed request leaves the report in the list with "Tentar de novo".
      await Promise.allSettled(FORMATS.map((f) => this.api.requestExport(snapshot.id, f)));
      await this.list.refresh();
      created = snapshot.id;
    } catch (error) {
      if (error instanceof ReportingApiError && error.status === 409) this.intent.reset();
      this.actionError.set(reportingError(error));
    } finally {
      this.busy.set(false);
      afterNextRender(
        {
          read: () =>
            (created ? document.getElementById('relatorio-' + created) : trigger)?.focus(),
        },
        { injector: this.injector },
      );
    }
  }
  ngOnDestroy(): void {
    this.generation++;
    this.list.stop();
  }
}

@Component({
  standalone: true,
  selector: 'sager-report-snapshot-local',
  imports: [
    RouterLink,
    CommunicationsStateComponent,
    MonthlyIndicatorsComponent,
    ReportCardComponent,
    PaginationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="page op-page comm-page">
    <header class="op-heading">
      <div>
        <a class="op-back" routerLink="/relatorios">← Relatórios</a>
        <h1>{{ snapshot() ? labels[snapshot()!.catalogCode] : 'Relatório' }}</h1>
        @if (snapshot(); as result) {
          <p>{{ civil(result.filters.from) }} a {{ civil(result.filters.to) }}</p>
        }
      </div>
      <a class="btn-secondary" routerLink="/relatorios">Gerar outro relatório</a>
    </header>
    <sager-communications-state
      [blocked]="!allowed()"
      [loading]="loading()"
      [error]="error()"
      (retry)="load()"
    />
    @if (allowed() && !loading() && !error() && snapshot(); as result) {
      <section class="op-section">
        <h2>Baixar arquivos</h2>
        @if (card(); as item) {
          <sager-report-card
            [item]="item"
            [slow]="list.slow().has(item.id)"
            [linkToDetail]="false"
            (changed)="list.refresh()"
          />
        }
        @if (list.error()) {
          <p class="comm-error" role="alert">{{ list.error() }}</p>
          <button class="btn-secondary" type="button" (click)="list.refresh()">
            Carregar os arquivos de novo
          </button>
        }
      </section>
      <section class="panel op-panel op-section">
        <h2>Resumo do período</h2>
        <dl class="comm-definition">
          <div>
            <dt>Gerado em</dt>
            <dd>{{ formatTime(result.asOf) }}</dd>
          </div>
          <div>
            <dt>Disponível até</dt>
            <dd>{{ formatTime(result.expiresAt) }}</dd>
          </div>
          <div>
            <dt>Total de registros</dt>
            <dd>{{ result.rowCount }}</dd>
          </div>
          @if (result.filters.status) {
            <div>
              <dt>Situação filtrada</dt>
              <dd>{{ statusLabels[result.filters.status] || result.filters.status }}</dd>
            </div>
          }
          <div>
            <dt>Nota média de limpeza</dt>
            <dd>{{ decimal(result.summary.cleaningMean) }}</dd>
          </div>
          <div>
            <dt>Faltas sem justificativa</dt>
            <dd>{{ result.summary.unjustifiedAbsences }}</dd>
          </div>
          <div>
            <dt>Voltaram atrasados</dt>
            <dd>{{ result.summary.confirmedLateReturns }}</dd>
          </div>
          <div>
            <dt>Advertências ativas</dt>
            <dd>{{ result.summary.activeWarnings }}</dd>
          </div>
        </dl>
        <h3>Registros por tipo</h3>
        <dl class="comm-definition">
          @for (count of counts(result.summary.countsByType); track count.key) {
            <div>
              <dt>{{ labels[count.key] || count.key }}</dt>
              <dd>{{ count.value }}</dd>
            </div>
          } @empty {
            <div>
              <dt>Sem registros</dt>
              <dd>0</dd>
            </div>
          }
        </dl>
        <h3>Registros por situação</h3>
        <dl class="comm-definition">
          @for (count of counts(result.summary.countsByStatus); track count.key) {
            <div>
              <dt>{{ statusLabels[count.key] || count.key }}</dt>
              <dd>{{ count.value }}</dd>
            </div>
          }
        </dl>
      </section>
      <section class="panel op-panel op-section">
        <h2 id="report-rows-title" tabindex="-1">Registros</h2>
        <p aria-live="polite">{{ rows().length }} de {{ result.rowCount }} registros na tela.</p>
        @if (rows().length) {
          <div class="report-desktop-table">
            <table>
              <caption>
                Registros do relatório
              </caption>
              <thead>
                <tr>
                  @for (column of visibleColumns(); track column.key) {
                    <th scope="col">{{ column.label }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track $index) {
                  <tr>
                    @for (column of visibleColumns(); track column.key) {
                      <td>{{ cell(row, column.key) }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="report-local-mobile" role="group" aria-label="Registros do relatório">
            @for (row of rows(); track $index) {
              <details>
                <summary>
                  <strong>{{ labels[row.type] || row.type }} · {{ civil(row.date) }}</strong
                  ><span>{{ row.residentName || row.roomCode || 'Registro' }}</span
                  ><span>{{ statusLabels[row.status] || row.status }}</span>
                </summary>
                <dl class="comm-definition">
                  @for (column of visibleColumns(); track column.key) {
                    <div>
                      <dt>{{ column.label }}</dt>
                      <dd>{{ cell(row, column.key) }}</dd>
                    </div>
                  }
                </dl>
              </details>
            }
          </div>
        } @else {
          <p>Não encontramos registros nesse período.</p>
        }
        <sager-pagination
          [page]="page()"
          [total]="result.rowCount"
          [busy]="rowsLoading()"
          anchor="report-rows-title"
          (pageChange)="go($event)"
        />
        @if (rowsError()) {
          <p class="comm-error" role="alert">{{ rowsError() }}</p>
        }
      </section>
      <section class="panel op-panel op-section">
        <h2>Mês a mês</h2>
        <sager-monthly-indicators [items]="result.monthly" />
      </section>
    }
  </main>`,
  styleUrl: './reports-local.scss',
})
export class ReportSnapshotLocalPage implements OnDestroy {
  readonly session = inject(DemoSessionService);
  private readonly api = reportsApi();
  private readonly route = inject(ActivatedRoute);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly list = new ReportListPolling(() => this.api.list());
  readonly card = computed(() => this.list.items().find((item) => item.id === this.id));
  readonly snapshot = signal<ReportSnapshot | null>(null);
  readonly rows = signal<ReportRow[]>([]);
  readonly page = signal(0);
  readonly loading = signal(false);
  readonly rowsLoading = signal(false);
  readonly error = signal('');
  readonly rowsError = signal('');
  readonly labels: Record<string, string> = reportLabels;
  readonly statusLabels = reportStatusLabels;
  readonly civil = formatCivilDate;
  readonly formatTime = formatCommunicationTime;
  readonly decimal = decimal;
  readonly cell = reportCell;
  private generation = 0;
  constructor() {
    void this.load();
  }
  allowed(): boolean {
    return this.session.hasRole('gestor', 'supervisor');
  }
  visibleColumns() {
    return this.snapshot()?.columns.filter((column) => column.type !== 'UUID') ?? [];
  }
  counts(value: Record<string, number>) {
    return Object.entries(value).map(([key, value]) => ({ key, value }));
  }
  async load(): Promise<void> {
    if (!this.allowed()) return;
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    this.rowsError.set('');
    this.snapshot.set(null);
    this.rows.set([]);
    this.page.set(0);
    try {
      const [snapshot, page] = await Promise.all([this.api.get(this.id), this.api.rows(this.id)]);
      if (snapshot.rowCount !== page.total)
        throw new Error('A consulta não confirmou o total de registros.');
      if (generation === this.generation) {
        this.snapshot.set(snapshot);
        this.rows.set(page.items);
        void this.list.refresh();
      }
    } catch (error) {
      if (generation === this.generation) this.error.set(reportingError(error));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  // A página substitui as linhas; uma resposta de página pedida antes é descartada.
  async go(page: number): Promise<void> {
    const generation = ++this.generation;
    this.rowsLoading.set(true);
    this.rowsError.set('');
    try {
      const result = await this.api.rows(this.id, page * 25);
      if (result.total !== this.snapshot()?.rowCount)
        throw new Error('O total de registros mudou.');
      // A página só avança com as linhas dela: após uma falha, a faixa mostrada continua certa.
      if (generation === this.generation) {
        this.rows.set(result.items);
        this.page.set(page);
      }
    } catch (error) {
      if (generation === this.generation) this.rowsError.set(reportingError(error));
    } finally {
      if (generation === this.generation) this.rowsLoading.set(false);
    }
  }
  ngOnDestroy(): void {
    this.generation++;
    this.list.stop();
  }
}
