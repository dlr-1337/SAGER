import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DOCUMENT } from '@angular/common';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { DemoSessionService } from '../../core/demo-session.service';
import { ReportsLocalPage } from './reports-local.pages';
import { CleaningIndicatorsLocalPage } from '../cleaning/cleaning-indicators-local.page';

type ReportKind =
  'todos' | 'presenca' | 'saidas' | 'limpeza' | 'ocorrencias' | 'notificacoes' | 'advertencias';
type FilterKey = 'type' | 'start' | 'end' | 'resident' | 'occurrence' | 'status';
interface ReportRow {
  id: string;
  kind: Exclude<ReportKind, 'todos'>;
  date: string;
  resident: string;
  occurrence: string;
  status: string;
  description: string;
}
interface ReportFilters {
  type: ReportKind;
  start: string;
  end: string;
  resident: string;
  occurrence: string;
  status: string;
}

const SAMPLE_ROWS: ReportRow[] = [
  {
    id: '1',
    kind: 'presenca',
    date: '2026-09-24',
    resident: 'Ana Luísa Ribeiro',
    occurrence: 'Presença',
    status: 'Registrada',
    description: 'Chamada noturna · presente',
  },
  {
    id: '2',
    kind: 'presenca',
    date: '2026-09-24',
    resident: 'Pedro Henrique Silva',
    occurrence: 'Presença',
    status: 'Registrada',
    description: 'Chamada noturna · ausência justificada',
  },
  {
    id: '3',
    kind: 'saidas',
    date: '2026-09-23',
    resident: 'Ana Luísa Ribeiro',
    occurrence: 'Saída curta',
    status: 'Aprovada',
    description: 'Saída curta · retorno confirmado pelo supervisor',
  },
  {
    id: '4',
    kind: 'saidas',
    date: '2026-09-22',
    resident: 'Ana Luísa Ribeiro',
    occurrence: 'Saída longa',
    status: 'Aguardando assinatura',
    description: 'Solicitação de saída longa',
  },
  {
    id: '5',
    kind: 'limpeza',
    date: '2026-09-21',
    resident: 'Ana Luísa Ribeiro',
    occurrence: 'Avaliação',
    status: 'Registrada',
    description: 'Avaliação do quarto A-102',
  },
  {
    id: '6',
    kind: 'ocorrencias',
    date: '2026-09-20',
    resident: 'Beatriz Costa',
    occurrence: 'Chamada',
    status: 'Em análise',
    description: 'Ocorrência registrada após chamada',
  },
  {
    id: '7',
    kind: 'notificacoes',
    date: '2026-09-20',
    resident: 'Beatriz Costa',
    occurrence: 'Chamada',
    status: 'Em análise',
    description: 'Notificação interna para análise',
  },
  {
    id: '8',
    kind: 'advertencias',
    date: '2026-09-18',
    resident: 'Ana Luísa Ribeiro',
    occurrence: 'Convivência',
    status: 'Registrada',
    description: 'Advertência manual após análise',
  },
  {
    id: '9',
    kind: 'saidas',
    date: '2026-09-16',
    resident: 'Ana Luísa Ribeiro',
    occurrence: 'Saída longa',
    status: 'Aprovada',
    description: 'Saída longa com assinatura simulada',
  },
];
const KIND_LABELS: Record<ReportKind, string> = {
  todos: 'Todos os relatórios',
  presenca: 'Presença',
  saidas: 'Saídas e retornos',
  limpeza: 'Limpeza',
  ocorrencias: 'Ocorrências',
  notificacoes: 'Notificações internas',
  advertencias: 'Advertências',
};

@Component({
  standalone: true,
  selector: 'sager-reports',
  imports: [SearchableSelectDirective, ReactiveFormsModule, RouterLink, ReportsLocalPage],
  template: `
    @if (!session.active()) {
      <sager-reports-local />
    } @else {
      <main class="page reports-page">
        <header class="page-header">
          <div>
            <span class="eyebrow">Consulta institucional</span>
            <h1>Relatórios</h1>
            <p>Escolha um relatório e combine filtros para consultar os registros.</p>
          </div>
        </header>
        <section class="panel filters-panel" aria-labelledby="filters-title">
          <div class="panel-heading">
            <div>
              <h2 id="filters-title">Selecionar e filtrar</h2>
              <p>Todos os filtros preenchidos serão aplicados juntos.</p>
            </div>
            <span class="demo-tag status success">Dados fictícios</span>
          </div>
          <form [formGroup]="form" (ngSubmit)="apply()" novalidate>
            <div class="filter-grid">
              <div class="field">
                <label for="report-type">Tipo de relatório</label
                ><select sagerSearchable id="report-type" formControlName="type">
                  @for (kind of kinds; track kind) {
                    <option [value]="kind">{{ labels[kind] }}</option>
                  }
                </select>
              </div>
              <div class="optional-fields">
                <button
                  class="optional-toggle"
                  type="button"
                  aria-controls="optional-filter-grid"
                  [attr.aria-expanded]="!compactFilters() || optionalFiltersOpen()"
                  (click)="optionalFiltersOpen.set(!optionalFiltersOpen())"
                >
                  <span class="material-symbols-outlined" aria-hidden="true">tune</span>Mais
                  filtros<span class="material-symbols-outlined optional-chevron" aria-hidden="true"
                    >expand_more</span
                  >
                </button>
                <div
                  id="optional-filter-grid"
                  class="optional-filter-grid"
                  [hidden]="compactFilters() && !optionalFiltersOpen()"
                >
                  <div class="field">
                    <label for="start-date">Data inicial</label
                    ><input
                      id="start-date"
                      type="date"
                      formControlName="start"
                      [attr.aria-invalid]="dateError() ? 'true' : null"
                      [attr.aria-describedby]="dateError() ? 'date-error' : null"
                    />
                  </div>
                  <div class="field">
                    <label for="end-date">Data final</label
                    ><input
                      id="end-date"
                      type="date"
                      formControlName="end"
                      [attr.aria-invalid]="dateError() ? 'true' : null"
                      [attr.aria-describedby]="dateError() ? 'date-error' : null"
                    />
                  </div>
                  <div class="field">
                    <label for="resident-filter">Residente</label
                    ><select sagerSearchable id="resident-filter" formControlName="resident">
                      <option value="">Todos os residentes</option>
                      <option>Ana Luísa Ribeiro</option>
                      <option>Pedro Henrique Silva</option>
                      <option>Beatriz Costa</option>
                    </select>
                  </div>
                  <div class="field">
                    <label for="occurrence-filter">Ocorrência</label
                    ><select sagerSearchable id="occurrence-filter" formControlName="occurrence">
                      <option value="">Todas as ocorrências</option>
                      <option>Presença</option>
                      <option>Saída curta</option>
                      <option>Saída longa</option>
                      <option>Avaliação</option>
                      <option>Chamada</option>
                      <option>Convivência</option>
                    </select>
                  </div>
                  <div class="field">
                    <label for="status-filter">Status</label
                    ><select sagerSearchable id="status-filter" formControlName="status">
                      <option value="">Todos os status</option>
                      <option>Registrada</option>
                      <option>Aprovada</option>
                      <option>Aguardando assinatura</option>
                      <option>Em análise</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            @if (dateError()) {
              <p class="form-error" id="date-error" role="alert">
                <span class="material-symbols-outlined" aria-hidden="true">error</span>A data
                inicial não pode ser posterior à data final.
              </p>
            }
            <div class="form-actions">
              <button class="btn" type="submit">
                <span class="material-symbols-outlined" aria-hidden="true">filter_alt</span>Aplicar
                filtros</button
              ><button class="btn-secondary" type="button" (click)="clear()">Limpar filtros</button
              ><span class="filter-count" aria-live="polite"
                >{{ results().length }} {{ results().length === 1 ? 'registro' : 'registros' }} na
                seleção</span
              >
            </div>
          </form>
        </section>
        <section class="panel results-panel" aria-labelledby="results-title">
          <div class="results-header">
            <div>
              <h2 id="results-title">Resultados</h2>
              <p aria-live="polite">
                {{ results().length }}
                {{ results().length === 1 ? 'registro encontrado' : 'registros encontrados' }} na
                demonstração
              </p>
            </div>
            <div class="export-actions">
              <button
                class="btn-secondary"
                type="button"
                [disabled]="session.scenario() === 'erro' || session.scenario() === 'carregando'"
                (click)="export('PDF', $event)"
              >
                <span class="material-symbols-outlined" aria-hidden="true">picture_as_pdf</span
                >Simular exportação PDF</button
              ><button
                class="btn-secondary"
                type="button"
                [disabled]="session.scenario() === 'erro' || session.scenario() === 'carregando'"
                (click)="export('Excel', $event)"
              >
                <span class="material-symbols-outlined" aria-hidden="true">table_view</span>Simular
                exportação Excel
              </button>
            </div>
          </div>
          @if (active().length > 0) {
            <div class="active-filters" aria-label="Filtros ativos">
              <strong>Filtros ativos:</strong>
              @for (filter of active(); track filter.key) {
                <button
                  type="button"
                  (click)="remove(filter.key)"
                  [attr.aria-label]="'Remover filtro ' + filter.label"
                >
                  {{ filter.label }}
                  <span class="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              }
            </div>
          }
          @if (session.scenario() === 'erro') {
            <div class="empty-results" role="alert">
              <span class="material-symbols-outlined" aria-hidden="true">error</span>
              <h3>Não foi possível carregar o relatório</h3>
              <p>
                Este é um cenário de demonstração. Tente novamente para consultar os registros
                fictícios.
              </p>
              <button class="btn" type="button" (click)="session.setScenario('padrao')">
                Tentar novamente
              </button>
            </div>
          } @else if (session.scenario() === 'carregando') {
            <div class="empty-results" role="status">
              <span class="material-symbols-outlined" aria-hidden="true">hourglass_top</span>
              <h3>Carregando relatório</h3>
              <p>Aguarde enquanto os dados são preparados nesta demonstração.</p>
            </div>
          } @else if (results().length === 0) {
            <div class="empty-results" role="status">
              <span class="material-symbols-outlined" aria-hidden="true">search_off</span>
              <h3>Nenhum registro encontrado</h3>
              <p>
                Experimente ampliar o período ou retirar um filtro. Nenhum valor será estimado para
                esta seleção.
              </p>
            </div>
          } @else {
            <div class="table-scroll">
              <table>
                <caption class="sr-only">
                  Resultados de demonstração filtrados
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Relatório</th>
                    <th scope="col">Residente</th>
                    <th scope="col">Ocorrência</th>
                    <th scope="col">Status</th>
                    <th scope="col">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of results(); track row.id) {
                    <tr>
                      <td>{{ displayDate(row.date) }}</td>
                      <td>{{ labels[row.kind] }}</td>
                      <td>{{ row.resident }}</td>
                      <td>{{ row.occurrence }}</td>
                      <td>
                        <span class="status-label">{{ row.status }}</span>
                      </td>
                      <td>{{ row.description }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="report-mobile-list" aria-label="Resultados de demonstração filtrados">
              @for (row of results(); track row.id) {
                <details class="report-mobile-row">
                  <summary>
                    <span class="report-mobile-heading"
                      ><strong>{{ labels[row.kind] }}</strong
                      ><small>{{ displayDate(row.date) }}</small></span
                    ><span class="report-mobile-resident">{{ row.resident }}</span
                    ><span class="status-label">{{ row.status }}</span
                    ><span class="report-mobile-prompt"
                      ><span class="prompt-open">Ver detalhes</span
                      ><span class="prompt-close">Ocultar detalhes</span
                      ><span class="material-symbols-outlined" aria-hidden="true"
                        >expand_more</span
                      ></span
                    >
                  </summary>
                  <dl>
                    <div>
                      <dt>Ocorrência</dt>
                      <dd>{{ row.occurrence }}</dd>
                    </div>
                    <div>
                      <dt>Descrição</dt>
                      <dd>{{ row.description }}</dd>
                    </div>
                  </dl>
                </details>
              }
            </div>
          }
        </section>
        <section class="individual-link panel">
          <div>
            <h2>Painel individual</h2>
            <p>Consulte ocorrências, histórico e indicadores disponíveis de um residente.</p>
          </div>
          <a class="btn-secondary" routerLink="/relatorios/individual/ana"
            >Abrir exemplo individual</a
          >
        </section>
        <p class="pending-note">
          <span class="material-symbols-outlined" aria-hidden="true">info</span>O catálogo final de
          relatórios, permissões de exportação e métricas de comportamento depende de homologação
          pela AE/TI.
        </p>
        @if (exportFormat()) {
          <dialog
            #exportDialog
            class="export-modal"
            aria-labelledby="export-title"
            aria-describedby="export-description"
            (keydown)="onExportKeydown($event)"
            (close)="onExportClosed()"
          >
            <span class="material-symbols-outlined" aria-hidden="true">file_download_off</span>
            <h2 id="export-title">Exportação de {{ exportFormat() }} simulada</h2>
            <p id="export-description">
              Nesta etapa, o resultado mostra os filtros ativos, mas nenhum arquivo é gerado. A
              exportação real seguirá as permissões e os mesmos filtros após a integração.
            </p>
            <button class="btn" type="button" (click)="closeExport()">Entendi</button>
          </dialog>
        }
      </main>
    }
  `,
  styleUrl: './reports-page.scss',
})
export class ReportsPage implements OnDestroy {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly document = inject(DOCUMENT);
  private readonly breakpointObserver = inject(BreakpointObserver);
  @ViewChild('exportDialog') private exportDialog?: ElementRef<HTMLDialogElement>;
  private exportTrigger?: HTMLButtonElement;
  private previousBodyOverflow: string | null = null;
  private previousHtmlOverflow: string | null = null;
  readonly session = inject(DemoSessionService);
  readonly labels = KIND_LABELS;
  readonly kinds: ReportKind[] = [
    'todos',
    'presenca',
    'saidas',
    'limpeza',
    'ocorrencias',
    'notificacoes',
    'advertencias',
  ];
  readonly form = this.fb.group({
    type: this.fb.control<ReportKind>('todos'),
    start: '',
    end: '',
    resident: '',
    occurrence: '',
    status: '',
  });
  readonly applied = signal<ReportFilters>(this.form.getRawValue());
  readonly dateError = signal(false);
  readonly exportFormat = signal<'PDF' | 'Excel' | null>(null);
  readonly compactFilters = signal(this.breakpointObserver.isMatched('(max-width: 600px)'));
  readonly optionalFiltersOpen = signal(false);
  constructor() {
    this.breakpointObserver
      .observe('(max-width: 600px)')
      .pipe(takeUntilDestroyed())
      .subscribe(({ matches }) => this.compactFilters.set(matches));
  }
  readonly results = computed(() => {
    if (!this.session.active() || this.session.scenario() !== 'padrao') return [];
    const f = this.applied();
    return SAMPLE_ROWS.filter(
      (row) =>
        (f.type === 'todos' || row.kind === f.type) &&
        (!f.start || row.date >= f.start) &&
        (!f.end || row.date <= f.end) &&
        (!f.resident || row.resident === f.resident) &&
        (!f.occurrence || row.occurrence === f.occurrence) &&
        (!f.status || row.status === f.status),
    );
  });
  readonly active = computed(() => {
    const f = this.applied();
    const items: { key: FilterKey; label: string }[] = [];
    if (f.type !== 'todos') items.push({ key: 'type', label: `Relatório: ${KIND_LABELS[f.type]}` });
    if (f.start) items.push({ key: 'start', label: `A partir de ${this.displayDate(f.start)}` });
    if (f.end) items.push({ key: 'end', label: `Até ${this.displayDate(f.end)}` });
    if (f.resident) items.push({ key: 'resident', label: f.resident });
    if (f.occurrence) items.push({ key: 'occurrence', label: f.occurrence });
    if (f.status) items.push({ key: 'status', label: f.status });
    return items;
  });
  displayDate(value: string) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  apply() {
    const filters = this.form.getRawValue();
    if (filters.start && filters.end && filters.start > filters.end) {
      this.dateError.set(true);
      if (this.compactFilters()) this.optionalFiltersOpen.set(true);
      return;
    }
    this.dateError.set(false);
    this.applied.set(filters);
  }
  clear() {
    this.form.reset({
      type: 'todos',
      start: '',
      end: '',
      resident: '',
      occurrence: '',
      status: '',
    });
    this.apply();
  }
  remove(key: FilterKey) {
    if (key === 'type') this.form.controls.type.setValue('todos');
    else this.form.controls[key].setValue('');
    this.apply();
  }
  export(format: 'PDF' | 'Excel', event: MouseEvent) {
    if (!this.session.active()) return;
    this.exportTrigger = event.currentTarget as HTMLButtonElement;
    this.exportFormat.set(format);
    setTimeout(() => {
      const dialog = this.exportDialog?.nativeElement;
      if (!dialog || dialog.open) return;
      this.lockScroll();
      dialog.showModal();
      dialog.querySelector('button')?.focus();
    }, 0);
  }
  closeExport() {
    this.exportDialog?.nativeElement.close();
  }
  onExportKeydown(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      event.preventDefault();
      this.exportDialog?.nativeElement.querySelector('button')?.focus();
    }
  }
  onExportClosed() {
    this.unlockScroll();
    this.exportFormat.set(null);
    setTimeout(() => this.exportTrigger?.focus(), 0);
  }
  ngOnDestroy() {
    this.unlockScroll();
  }
  private lockScroll() {
    if (this.previousBodyOverflow !== null) return;
    this.previousBodyOverflow = this.document.body.style.overflow;
    this.previousHtmlOverflow = this.document.documentElement.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.document.documentElement.style.overflow = 'hidden';
  }
  private unlockScroll() {
    if (this.previousBodyOverflow === null) return;
    this.document.body.style.overflow = this.previousBodyOverflow;
    this.document.documentElement.style.overflow = this.previousHtmlOverflow ?? '';
    this.previousBodyOverflow = null;
    this.previousHtmlOverflow = null;
  }
}

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

@Component({
  standalone: true,
  selector: 'sager-individual-report',
  imports: [RouterLink, CleaningIndicatorsLocalPage],
  template: `
    @if (!session.active()) {
      <sager-cleaning-indicators-local />
    } @else {
      <main class="page individual-page">
        <a class="back-link" routerLink="/relatorios"
          ><span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>Voltar aos
          relatórios</a
        >
        <header class="page-header">
          <div>
            <span class="eyebrow">Painel individual · Dados fictícios</span>
            <h1>Ana Luísa Ribeiro</h1>
            <p>Histórico pedagógico e ocorrências do período demonstrativo.</p>
          </div>
        </header>
        <div class="context-strip">
          <span><strong>Período:</strong> julho a setembro de 2026</span
          ><span><strong>Quarto:</strong> A-102</span
          ><span><strong>Fonte:</strong> registros da demonstração</span>
        </div>
        @if (session.scenario() !== 'padrao') {
          <section class="panel empty-results" role="status">
            <span class="material-symbols-outlined" aria-hidden="true">{{
              session.scenario() === 'carregando'
                ? 'hourglass_top'
                : session.scenario() === 'erro'
                  ? 'error'
                  : 'inbox'
            }}</span>
            <h2>
              {{
                session.scenario() === 'carregando'
                  ? 'Carregando histórico'
                  : session.scenario() === 'erro'
                    ? 'Não foi possível carregar o histórico'
                    : 'Sem registros neste período'
              }}
            </h2>
            <p>
              {{
                session.scenario() === 'vazio'
                  ? 'Não há dados suficientes para apresentar gráficos neste cenário.'
                  : 'Este é um cenário de demonstração.'
              }}
            </p>
          </section>
        } @else {
          <section class="panel chart-panel" aria-labelledby="occurrence-chart-title">
            <div>
              <h2 id="occurrence-chart-title">Evolução das ocorrências</h2>
              <p>
                Houve uma ocorrência em agosto e uma em setembro; julho não tem ocorrências no
                exemplo.
              </p>
            </div>
            <div class="chart-wrap">
              <canvas
                #occurrenceChart
                role="img"
                aria-label="Gráfico de barras: julho 0 ocorrências, agosto 1, setembro 1"
              ></canvas>
            </div>
            <div class="table-scroll">
              <table>
                <caption>
                  Ocorrências por mês
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Mês</th>
                    <th scope="col">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Julho</td>
                    <td>0</td>
                  </tr>
                  <tr>
                    <td>Agosto</td>
                    <td>1</td>
                  </tr>
                  <tr>
                    <td>Setembro</td>
                    <td>1</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <div class="analysis-grid">
            <section class="panel">
              <h2>Distribuição por tipo</h2>
              <p>Uma ocorrência de chamada e uma de convivência neste exemplo.</p>
              <div class="table-scroll">
                <table>
                  <caption>
                    Ocorrências por tipo
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Tipo</th>
                      <th scope="col">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Chamada</td>
                      <td>1</td>
                    </tr>
                    <tr>
                      <td>Convivência</td>
                      <td>1</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
            <section class="panel pending-metric">
              <span class="material-symbols-outlined" aria-hidden="true">pending_actions</span>
              <h2>Evolução do comportamento</h2>
              <p>
                A métrica de comportamento ainda precisa de definição pela Assistência Estudantil.
                Nenhuma pontuação será calculada ou apresentada neste protótipo.
              </p>
              <strong>Definição institucional pendente</strong>
            </section>
          </div>
          <section class="panel history" aria-labelledby="history-title">
            <h2 id="history-title">Histórico pedagógico</h2>
            <ol>
              <li>
                <span class="history-date">18 set. 2026</span>
                <div>
                  <strong>Advertência registrada após análise manual</strong>
                  <p>Registro demonstrativo de decisão do supervisor.</p>
                </div>
              </li>
              <li>
                <span class="history-date">20 ago. 2026</span>
                <div>
                  <strong>Ocorrência registrada</strong>
                  <p>Encaminhada para análise; nenhuma sanção automática foi aplicada.</p>
                </div>
              </li>
              <li>
                <span class="history-date">10 jul. 2026</span>
                <div>
                  <strong>Início do período consultado</strong>
                  <p>Sem ocorrências registradas neste mês.</p>
                </div>
              </li>
            </ol>
          </section>
        }
      </main>
    }
  `,
  styleUrl: './individual-report.scss',
})
export class IndividualReportPage implements OnDestroy {
  readonly session = inject(DemoSessionService);
  @ViewChild('occurrenceChart') set chartCanvas(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.chart?.destroy();
    this.chart = undefined;
    if (ref) this.createChart(ref.nativeElement);
  }
  private chart?: Chart;
  private createChart(canvas: HTMLCanvasElement): void {
    if (!this.session.active()) return;
    this.chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Julho', 'Agosto', 'Setembro'],
        datasets: [
          {
            label: 'Ocorrências',
            data: [0, 1, 1],
            backgroundColor: '#155c43', // --green-800
            borderRadius: 5,
            maxBarThickness: 70,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, precision: 0 },
            grid: { color: '#d6e0e5' }, // --line
          },
          x: { grid: { display: false } },
        },
      },
    });
  }
  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
