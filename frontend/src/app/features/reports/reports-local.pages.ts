import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DemoSessionService } from '../../core/demo-session.service';
import {
  CommunicationReviewDialogComponent,
  CommunicationReviewResult,
  CommunicationsStateComponent,
} from '../communications/communications-local.shared';
import {
  CommunicationIntent,
  formatCivilDate,
  formatCommunicationTime,
} from '../communications/communications-local.utils';
import { CleaningLocalApiService } from '../cleaning/cleaning-local-api.service';
import { decimal } from '../cleaning/cleaning-local.utils';
import { MonthlyIndicatorsComponent } from '../cleaning/monthly-indicators.component';
import { ReportingApiError, reportingError } from '../cleaning/reporting-local.transport';
import { AccommodationApiService } from '../management/accommodation-api.service';
import { RoomApiService } from '../management/room-api.service';
import { ResidentApiService, ResidentRecord } from '../management/resident-api.service';
import { Accommodation, RoomRecord } from '../management/housing.models';
import { ReportsLocalApiService } from './reports-local-api.service';
import {
  ReportCatalog,
  ReportCode,
  ReportExport,
  ReportFormat,
  ReportRow,
  ReportSnapshot,
} from './reports-local.models';
import {
  ReportDownloads,
  exportStatusLabels,
  normalizedReportInput,
  periodError,
  reportCell,
  reportLabels,
  reportStatusLabels,
} from './reports-local.utils';

@Component({
  standalone: true,
  selector: 'sager-reports-local',
  imports: [
    SearchableSelectDirective,
    RouterLink,
    ReactiveFormsModule,
    CommunicationsStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="page op-page comm-page">
    <header class="op-heading">
      <div>
        <a class="op-back" routerLink="/inicio">← Início</a>
        <h1>Relatórios</h1>
        <p>
          Combine filtros para preparar uma consulta dos registros autorizados. PDF e Excel usam o
          mesmo recorte preservado.
        </p>
      </div>
    </header>
    <sager-communications-state
      [blocked]="!allowed()"
      [loading]="loading()"
      [error]="error()"
      (retry)="load()"
    />
    @if (allowed() && !loading() && !error() && catalog(); as rules) {
      <section class="panel op-panel">
        <h2>Selecionar relatório e período</h2>
        <p class="comm-help">
          Até {{ rules.maxPeriodDays }} dias e {{ rules.maxRows.toLocaleString('pt-BR') }} linhas.
          Se a seleção exceder esse limite, combine filtros para reduzir o recorte.
        </p>
        <form [formGroup]="form" (ngSubmit)="review()" novalidate>
          <div class="comm-form-grid">
            <label class="field"
              >Tipo de relatório<select
                sagerSearchable
                formControlName="catalogCode"
                (change)="form.controls.status.setValue('')"
              >
                @for (item of rules.items; track item.code) {
                  <option [value]="item.code">{{ item.title }}</option>
                }
              </select></label
            ><label class="field">Data inicial<input type="date" formControlName="from" /></label
            ><label class="field">Data final<input type="date" formControlName="to" /></label
            ><label class="field"
              >Alojamento<select
                sagerSearchable
                formControlName="accommodationId"
                (change)="form.controls.roomId.setValue('')"
              >
                <option value="">Todos os alojamentos</option>
                @for (item of accommodations(); track item.id) {
                  <option [value]="item.id">{{ item.code }} · {{ item.name }}</option>
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
          @if (actionError()) {
            <p class="comm-error" role="alert">{{ actionError() }}</p>
          }
          @if (conflict()) {
            <button class="btn-secondary" type="button" (click)="load()">Recarregar filtros</button>
          }
          <div class="comm-actions">
            <button class="btn" type="submit" [disabled]="busy() || conflict()">
              {{ busy() ? 'Preparando consulta…' : 'Revisar consulta' }}</button
            ><a routerLink="/relatorios/individual">Consultar indicadores individuais</a>
          </div>
        </form>
      </section>
    }
  </main>`,
  styleUrl: './reports-local.scss',
})
export class ReportsLocalPage {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(ReportsLocalApiService);
  private readonly cleaningApi = inject(CleaningLocalApiService);
  private readonly accommodationsApi = inject(AccommodationApiService);
  private readonly roomsApi = inject(RoomApiService);
  private readonly residentsApi = inject(ResidentApiService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  readonly form = new FormGroup({
    catalogCode: new FormControl<ReportCode>('PRESENCA', { nonNullable: true }),
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    accommodationId: new FormControl('', { nonNullable: true }),
    roomId: new FormControl('', { nonNullable: true }),
    residentId: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
  });
  readonly catalog = signal<ReportCatalog | null>(null);
  readonly accommodations = signal<Accommodation[]>([]);
  readonly rooms = signal<RoomRecord[]>([]);
  readonly residents = signal<ResidentRecord[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly conflict = signal(false);
  readonly statusLabels = reportStatusLabels;
  private readonly intent = new CommunicationIntent();
  constructor() {
    void this.load();
  }
  allowed(): boolean {
    return !this.session.active() && this.session.hasRole('gestor', 'supervisor');
  }
  visibleRooms(): RoomRecord[] {
    const selected = this.form.controls.accommodationId.value;
    return this.rooms().filter((room) => !selected || room.accommodationId === selected);
  }
  statuses(): string[] {
    const rules = this.catalog();
    return this.form.controls.catalogCode.value === 'CONSOLIDADO'
      ? [...new Set(rules?.items.flatMap((item) => item.statuses) ?? [])]
      : (rules?.items.find((item) => item.code === this.form.controls.catalogCode.value)
          ?.statuses ?? []);
  }
  async load(): Promise<void> {
    if (!this.allowed()) return;
    this.loading.set(true);
    this.error.set('');
    this.actionError.set('');
    this.conflict.set(false);
    try {
      const [catalog, policy, accommodations, rooms, residents] = await Promise.all([
        this.api.catalog(),
        this.cleaningApi.policy(),
        this.accommodationsApi.list(),
        this.roomsApi.list(),
        this.residentsApi.list(),
      ]);
      this.catalog.set(catalog);
      this.accommodations.set(accommodations);
      this.rooms.set(rooms);
      this.residents.set(residents);
      if (!this.form.controls.to.value)
        this.form.patchValue({
          from: policy.currentDate.slice(0, 8) + '01',
          to: policy.currentDate,
        });
    } catch (error) {
      this.error.set(reportingError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async review(): Promise<void> {
    if (!this.allowed() || this.busy() || this.conflict()) return;
    const value = this.form.getRawValue();
    const rules = this.catalog();
    if (!rules) return;
    const invalid =
      periodError(value.from, value.to, rules.maxPeriodDays) ||
      (!rules.items.some((item) => item.code === value.catalogCode)
        ? 'Selecione um relatório do catálogo.'
        : '') ||
      ((value.accommodationId &&
        !this.accommodations().some((item) => item.id === value.accommodationId)) ||
      (value.roomId && !this.visibleRooms().some((item) => item.id === value.roomId)) ||
      (value.residentId && !this.residents().some((item) => item.id === value.residentId))
        ? 'Selecione alojamento, quarto e residente cadastrados com filtros compatíveis.'
        : '') ||
      (value.status && !this.statuses().includes(value.status)
        ? 'Selecione uma situação pertinente ao relatório.'
        : '');
    if (invalid) {
      this.actionError.set(invalid);
      return;
    }
    const trigger = document.activeElement as HTMLElement | null;
    const { catalogCode, ...filters } = value;
    const input = normalizedReportInput(catalogCode, filters);
    this.busy.set(true);
    this.actionError.set('');
    try {
      const result = await firstValueFrom(
        this.dialog
          .open<CommunicationReviewDialogComponent, unknown, CommunicationReviewResult>(
            CommunicationReviewDialogComponent,
            {
              width: '620px',
              maxWidth: 'calc(100vw - 24px)',
              autoFocus: 'first-tabbable',
              restoreFocus: true,
              data: {
                title: 'Revisar consulta de relatório',
                action: 'Preparar consulta',
                lines: [
                  {
                    label: 'Relatório',
                    value: rules.items.find((item) => item.code === catalogCode)?.title ?? '',
                  },
                  {
                    label: 'Período inclusivo',
                    value: formatCivilDate(filters.from) + ' a ' + formatCivilDate(filters.to),
                  },
                  {
                    label: 'Alojamento',
                    value:
                      this.accommodations().find((item) => item.id === filters.accommodationId)
                        ?.name ?? 'Todos',
                  },
                  {
                    label: 'Quarto',
                    value: this.rooms().find((item) => item.id === filters.roomId)?.code ?? 'Todos',
                  },
                  {
                    label: 'Residente',
                    value:
                      this.residents().find((item) => item.id === filters.residentId)?.name ??
                      'Todos',
                  },
                  {
                    label: 'Situação',
                    value: reportStatusLabels[filters.status] ?? (filters.status || 'Todas'),
                  },
                ],
                warning:
                  'A consulta preservará estes filtros, as linhas, os totais e as colunas por 24 horas. Mudanças posteriores exigem uma nova consulta.',
              },
            },
          )
          .afterClosed(),
      );
      if (!result) {
        setTimeout(() => trigger?.isConnected && trigger.focus(), 0);
        return;
      }
      const snapshot = await this.api.create({ ...input, idempotencyKey: this.intent.for(input) });
      await this.router.navigate(['/relatorios/consultas', snapshot.id]);
    } catch (error) {
      if (error instanceof ReportingApiError && error.status === 409) this.conflict.set(true);
      this.actionError.set(reportingError(error));
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  standalone: true,
  selector: 'sager-report-snapshot-local',
  imports: [RouterLink, CommunicationsStateComponent, MonthlyIndicatorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="page op-page comm-page">
    <header class="op-heading">
      <div>
        <a class="op-back" routerLink="/relatorios">← Relatórios</a>
        <h1>Consulta de {{ snapshot() ? labels[snapshot()!.catalogCode] : 'relatório' }}</h1>
        <p>Resultados e exportações pertencem ao mesmo recorte preservado.</p>
      </div>
      <a class="btn-secondary" routerLink="/relatorios">Preparar nova consulta</a>
    </header>
    <sager-communications-state
      [blocked]="!allowed()"
      [loading]="loading()"
      [error]="error()"
      (retry)="load()"
    />
    @if (allowed() && !loading() && !error() && snapshot(); as result) {
      <section class="panel op-panel">
        <h2>Recorte da consulta</h2>
        <dl class="comm-definition">
          <div>
            <dt>Período inclusivo</dt>
            <dd>{{ civil(result.filters.from) }} a {{ civil(result.filters.to) }}</dd>
          </div>
          <div>
            <dt>Preparada em</dt>
            <dd>{{ formatTime(result.asOf) }}</dd>
          </div>
          <div>
            <dt>Disponível até</dt>
            <dd>{{ formatTime(result.expiresAt) }}</dd>
          </div>
          <div>
            <dt>Total preservado</dt>
            <dd>{{ result.rowCount }} linhas</dd>
          </div>
          <div>
            <dt>Catálogo</dt>
            <dd>{{ labels[result.catalogCode] }} · versão {{ result.catalogVersion }}</dd>
          </div>
          @if (result.filters.status) {
            <div>
              <dt>Situação filtrada</dt>
              <dd>{{ statusLabels[result.filters.status] || result.filters.status }}</dd>
            </div>
          }
        </dl>
        <details class="report-integrity">
          <summary>Conferir identificação e integridade da consulta</summary>
          <dl class="comm-definition">
            <div>
              <dt>Identificador</dt>
              <dd>{{ result.id }}</dd>
            </div>
            <div>
              <dt>SHA-256 do recorte</dt>
              <dd>{{ result.contentHash }}</dd>
            </div>
            @for (filter of filterIdentities(); track filter.label) {
              <div>
                <dt>{{ filter.label }}</dt>
                <dd>{{ filter.value }}</dd>
              </div>
            }
          </dl>
        </details>
        <p class="comm-help">
          Linhas paginadas, resumo, séries mensais, PDF e Excel usam os mesmos filtros. Uma nova
          consulta é necessária para refletir alterações posteriores.
        </p>
      </section>
      <section class="panel op-panel op-section">
        <h2>Resumo do período</h2>
        <dl class="comm-definition">
          <div>
            <dt>Média de limpeza das avaliações distintas</dt>
            <dd>{{ decimal(result.summary.cleaningMean) }}</dd>
          </div>
          <div>
            <dt>Ausências sem justificativa em chamadas fechadas</dt>
            <dd>{{ result.summary.unjustifiedAbsences }}</dd>
          </div>
          <div>
            <dt>Retornos físicos confirmados com atraso</dt>
            <dd>{{ result.summary.confirmedLateReturns }}</dd>
          </div>
          <div>
            <dt>Advertências vigentes no recorte</dt>
            <dd>{{ result.summary.activeWarnings }}</dd>
          </div>
        </dl>
        <h3>Contagens por tipo de registro</h3>
        <dl class="comm-definition">
          @for (count of counts(result.summary.countsByType); track count.key) {
            <div>
              <dt>{{ labels[count.key] || count.key }}</dt>
              <dd>{{ count.value }}</dd>
            </div>
          } @empty {
            <div>
              <dt>Sem registros no recorte</dt>
              <dd>0</dd>
            </div>
          }
        </dl>
        <h3>Contagens por situação</h3>
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
        <h2>Resultados da consulta</h2>
        <p aria-live="polite">{{ rows().length }} de {{ result.rowCount }} linhas consultadas.</p>
        @if (rows().length) {
          <div class="report-desktop-table">
            <table>
              <caption>
                Linhas do recorte preservado
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
          <div class="report-local-mobile" aria-label="Linhas do recorte preservado">
            @for (row of rows(); track $index) {
              <details>
                <summary>
                  <strong>{{ labels[row.type] || row.type }} · {{ civil(row.date) }}</strong
                  ><span>{{ row.residentName || row.roomCode || 'Registro institucional' }}</span
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
          <p>Nenhum registro neste período e nestes filtros.</p>
        }
        @if (nextOffset() !== null) {
          <div class="comm-actions">
            <button class="btn-secondary" type="button" [disabled]="moreLoading()" (click)="more()">
              Carregar mais linhas
            </button>
          </div>
        }
        @if (rowsError()) {
          <p class="comm-error" role="alert">{{ rowsError() }}</p>
        }
      </section>
      <section class="panel op-panel op-section">
        <h2>Séries mensais do recorte</h2>
        <sager-monthly-indicators [items]="result.monthly" />
      </section>
      <section class="panel op-panel op-section">
        <h2>Exportar o mesmo recorte</h2>
        <p class="comm-help">
          A preparação ocorre em fila. Use “Consultar preparação” para conferir o estado. O download
          só aparece quando um arquivo real estiver disponível.
        </p>
        @for (format of formats; track format) {
          <article class="report-export">
            <h3>{{ format === 'PDF' ? 'Documento PDF' : 'Planilha Excel' }}</h3>
            @if (job(format); as exportJob) {
              <p role="status">{{ exportLabels[exportJob.status] }}</p>
              <p>
                Solicitada em {{ formatTime(exportJob.createdAt) }} · expira em
                {{ formatTime(exportJob.expiresAt) }}
              </p>
              @if (exportJob.status === 'READY' && exportJob.document; as document) {
                <p>{{ document.size.toLocaleString('pt-BR') }} bytes · arquivo privado</p>
                <details>
                  <summary>Conferir integridade do arquivo</summary>
                  <p class="report-hash">SHA-256: {{ document.sha256 }}</p>
                </details>
                <div class="comm-actions">
                  <button
                    class="btn"
                    type="button"
                    [disabled]="busy() || conflict()"
                    (click)="download(exportJob)"
                  >
                    Baixar {{ format === 'PDF' ? 'PDF' : 'Excel' }}
                  </button>
                </div>
              } @else if (exportJob.status === 'PENDING' || exportJob.status === 'PROCESSING') {
                <button
                  class="btn-secondary"
                  type="button"
                  [disabled]="busy() || conflict()"
                  (click)="refreshExport(exportJob)"
                >
                  Consultar preparação de {{ format === 'PDF' ? 'PDF' : 'Excel' }}
                </button>
              } @else {
                <p class="comm-warning">
                  {{
                    exportJob.status === 'EXPIRED'
                      ? 'O arquivo expirou. Prepare uma nova consulta.'
                      : 'A preparação não concluiu. A fila mantém o registro da falha.'
                  }}
                </p>
              }
            } @else {
              <button
                class="btn-secondary"
                type="button"
                [disabled]="busy() || conflict()"
                (click)="requestExport(format)"
              >
                Preparar {{ format === 'PDF' ? 'PDF' : 'Excel' }}
              </button>
            }
          </article>
        }
        @if (actionError()) {
          <p class="comm-error" role="alert">{{ actionError() }}</p>
        }
        @if (conflict()) {
          <button class="btn-secondary" type="button" (click)="load()">Recarregar consulta</button>
        }
        @if (downloaded()) {
          <p role="status">{{ downloaded() }}</p>
        }
      </section>
    }
  </main>`,
  styleUrl: './reports-local.scss',
})
export class ReportSnapshotLocalPage implements OnDestroy {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(ReportsLocalApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  private readonly downloads = new ReportDownloads();
  readonly snapshot = signal<ReportSnapshot | null>(null);
  readonly rows = signal<ReportRow[]>([]);
  readonly nextOffset = signal<number | null>(null);
  readonly jobs = signal<Partial<Record<ReportFormat, ReportExport>>>({});
  readonly loading = signal(false);
  readonly moreLoading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly rowsError = signal('');
  readonly actionError = signal('');
  readonly conflict = signal(false);
  readonly downloaded = signal('');
  readonly formats: ReportFormat[] = ['PDF', 'XLSX'];
  readonly labels: Record<string, string> = reportLabels;
  readonly statusLabels = reportStatusLabels;
  readonly exportLabels = exportStatusLabels;
  readonly civil = formatCivilDate;
  readonly formatTime = formatCommunicationTime;
  readonly decimal = decimal;
  readonly cell = reportCell;
  private generation = 0;
  constructor() {
    void this.load();
  }
  allowed(): boolean {
    return !this.session.active() && this.session.hasRole('gestor', 'supervisor');
  }
  visibleColumns() {
    return this.snapshot()?.columns.filter((column) => column.type !== 'UUID') ?? [];
  }
  counts(value: Record<string, number>) {
    return Object.entries(value).map(([key, value]) => ({ key, value }));
  }
  filterIdentities() {
    const filters = this.snapshot()?.filters;
    return filters
      ? [
          { label: 'Alojamento selecionado', value: filters.accommodationId },
          { label: 'Quarto selecionado', value: filters.roomId },
          { label: 'Residente selecionado', value: filters.residentId },
        ].filter((value): value is { label: string; value: string } => !!value.value)
      : [];
  }
  job(format: ReportFormat): ReportExport | undefined {
    return this.jobs()[format];
  }
  async load(): Promise<void> {
    if (!this.allowed()) return;
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    this.rowsError.set('');
    this.actionError.set('');
    this.conflict.set(false);
    this.snapshot.set(null);
    this.rows.set([]);
    this.jobs.set({});
    try {
      const [snapshot, page] = await Promise.all([this.api.get(this.id), this.api.rows(this.id)]);
      if (snapshot.rowCount !== page.total)
        throw new Error('A consulta não confirmou o total preservado.');
      if (generation === this.generation) {
        this.snapshot.set(snapshot);
        this.rows.set(page.items);
        this.nextOffset.set(page.nextOffset);
      }
    } catch (error) {
      if (generation === this.generation) this.error.set(reportingError(error));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  async more(): Promise<void> {
    const offset = this.nextOffset();
    const generation = this.generation;
    if (offset === null || this.moreLoading()) return;
    this.moreLoading.set(true);
    this.rowsError.set('');
    try {
      const page = await this.api.rows(this.id, offset);
      if (page.total !== this.snapshot()?.rowCount) throw new Error('O total preservado mudou.');
      if (generation === this.generation) {
        this.rows.update((rows) => [...rows, ...page.items]);
        this.nextOffset.set(page.nextOffset);
      }
    } catch (error) {
      this.rowsError.set(reportingError(error));
    } finally {
      this.moreLoading.set(false);
    }
  }
  private checkedJob(job: ReportExport, expected?: ReportExport): void {
    if (
      job.snapshotId !== this.id ||
      (expected && (job.id !== expected.id || job.format !== expected.format))
    )
      throw new Error('A exportação não pertence a esta consulta.');
    this.jobs.update((jobs) => ({ ...jobs, [job.format]: job }));
  }
  async requestExport(format: ReportFormat): Promise<void> {
    const snapshot = this.snapshot();
    if (!snapshot || !this.allowed() || this.busy() || this.conflict()) return;
    const trigger = document.activeElement as HTMLElement | null;
    this.busy.set(true);
    this.actionError.set('');
    try {
      const fresh = await this.api.get(this.id);
      if (
        fresh.contentHash !== snapshot.contentHash ||
        fresh.catalogCode !== snapshot.catalogCode
      ) {
        this.conflict.set(true);
        return;
      }
      const result = await firstValueFrom(
        this.dialog
          .open<CommunicationReviewDialogComponent, unknown, CommunicationReviewResult>(
            CommunicationReviewDialogComponent,
            {
              width: '620px',
              maxWidth: 'calc(100vw - 24px)',
              autoFocus: 'first-tabbable',
              restoreFocus: true,
              data: {
                title: 'Revisar exportação',
                action: 'Solicitar preparação',
                lines: [
                  { label: 'Formato', value: format === 'PDF' ? 'PDF' : 'Excel' },
                  { label: 'Relatório', value: this.labels[snapshot.catalogCode] },
                  {
                    label: 'Período',
                    value:
                      this.civil(snapshot.filters.from) + ' a ' + this.civil(snapshot.filters.to),
                  },
                  { label: 'Total preservado', value: snapshot.rowCount + ' linhas' },
                ],
                warning:
                  'O arquivo será preparado com este recorte. Solicitar novamente o mesmo formato retorna a mesma preparação.',
              },
            },
          )
          .afterClosed(),
      );
      if (!result) {
        setTimeout(() => trigger?.isConnected && trigger.focus(), 0);
        return;
      }
      this.checkedJob(await this.api.requestExport(this.id, format));
    } catch (error) {
      this.actionFailure(error);
    } finally {
      this.busy.set(false);
    }
  }
  async refreshExport(job: ReportExport): Promise<void> {
    if (!this.allowed() || this.busy() || this.conflict()) return;
    this.busy.set(true);
    this.actionError.set('');
    try {
      this.checkedJob(await this.api.getExport(job.id), job);
    } catch (error) {
      this.actionFailure(error);
    } finally {
      this.busy.set(false);
    }
  }
  async download(job: ReportExport): Promise<void> {
    if (!this.allowed() || this.busy() || this.conflict() || job.status !== 'READY') return;
    this.busy.set(true);
    this.actionError.set('');
    this.downloaded.set('');
    try {
      const fresh = await this.api.getExport(job.id);
      this.checkedJob(fresh, job);
      if (fresh.status !== 'READY') return;
      const blob = await this.api.download(job.id, job.format);
      this.downloads.download(blob, job.id, job.format);
      this.downloaded.set(
        'Download de ' +
          (job.format === 'PDF' ? 'PDF' : 'Excel') +
          ' iniciado com o arquivo preparado para esta consulta.',
      );
    } catch (error) {
      this.actionFailure(error);
    } finally {
      this.busy.set(false);
    }
  }
  private actionFailure(error: unknown): void {
    if (error instanceof ReportingApiError && error.status === 409) this.conflict.set(true);
    this.actionError.set(reportingError(error));
  }
  ngOnDestroy(): void {
    this.generation++;
    this.downloads.destroy();
  }
}
