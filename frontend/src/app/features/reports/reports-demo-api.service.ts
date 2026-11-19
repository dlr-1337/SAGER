import { Injectable, inject } from '@angular/core';
import { DemoSessionService } from '../../core/demo-session.service';
import { ReportsLocalApiService } from './reports-local-api.service';
import { reportMetrics } from './reports-local.utils';
import {
  ReportCatalog,
  ReportCode,
  ReportColumn,
  ReportColumnKey,
  ReportExport,
  ReportFilterOptions,
  ReportFormat,
  ReportInput,
  ReportListItem,
  ReportRow,
  ReportRows,
  ReportSnapshot,
  ReportSummary,
} from './reports-local.models';

export type ReportsApi = Pick<
  ReportsLocalApiService,
  'catalog' | 'currentDate' | 'filterOptions' | 'list' | 'create' | 'get' | 'rows' | 'requestExport'
>;
/** Same screen in both modes. The real mode never falls back to this data after an API error. */
export function reportsApi(): ReportsApi {
  return inject(DemoSessionService).active()
    ? inject(ReportsDemoApiService)
    : inject(ReportsLocalApiService);
}

// The synthetic records are from September 2026, so "Este mês" finds them on any real date.
const DEMO_TODAY = '2026-09-30';
const PREPARE_MS = 2000;
const id = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const accommodation = id(1);
const blockA = id(2);
const blockB = id(3);
const rooms = { 'A-102': id(11), 'A-205': id(12), 'B-110': id(13) };
const people = {
  ana: { residentId: id(21), residentName: 'Ana Luísa Ribeiro', room: 'A-102' as const },
  pedro: { residentId: id(22), residentName: 'Pedro Henrique Silva', room: 'A-205' as const },
  beatriz: { residentId: id(23), residentName: 'Beatriz Costa', room: 'B-110' as const },
};
function row(
  n: number,
  date: string,
  type: ReportCode,
  status: string,
  person: keyof typeof people,
  sourceType: string,
  extra: Pick<ReportRow, 'score' | 'category'> = { score: null, category: null },
): ReportRow {
  const { residentId, residentName, room } = people[person];
  return {
    id: id(100 + n),
    date,
    type,
    status,
    residentId,
    residentName,
    roomId: rooms[room],
    roomCode: room,
    accommodationId: accommodation,
    sourceType,
    ...extra,
  };
}
const SAMPLE_ROWS: ReportRow[] = [
  row(1, '2026-09-24', 'PRESENCA', 'PRESENTE', 'ana', 'NIGHT_CALL'),
  row(2, '2026-09-24', 'PRESENCA', 'AUSENCIA_JUSTIFICADA', 'pedro', 'NIGHT_CALL'),
  row(3, '2026-09-23', 'SAIDAS', 'RETORNO_CONFIRMADO', 'ana', 'SHORT_RETURN'),
  row(4, '2026-09-22', 'SAIDAS', 'AGUARDANDO_ANALISE', 'ana', 'LONG_RETURN'),
  row(5, '2026-09-21', 'LIMPEZA', 'DENTRO_LIMITE', 'ana', 'CLEANING_ASSESSMENT', {
    score: 8.5,
    category: 'LIMPEZA',
  }),
  row(6, '2026-09-20', 'OCORRENCIAS', 'VALIDA', 'beatriz', 'NIGHT_CALL', {
    score: null,
    category: 'AUSENCIA',
  }),
  row(7, '2026-09-20', 'NOTIFICACOES', 'EM_ANALISE', 'beatriz', 'NIGHT_CALL', {
    score: null,
    category: 'AUSENCIA',
  }),
  row(8, '2026-09-18', 'ADVERTENCIAS', 'VIGENTE', 'ana', 'MANUAL', {
    score: null,
    category: 'OUTRA',
  }),
  row(9, '2026-09-17', 'TERMOS', 'EMITIDO', 'ana', 'RECURRENCE'),
  row(10, '2026-09-16', 'SAIDAS', 'APROVADA', 'ana', 'LONG_RETURN'),
  row(11, '2026-09-19', 'SAIDAS', 'RETORNO_CONFIRMADO_COM_ATRASO', 'pedro', 'SHORT_RETURN'),
  row(12, '2026-09-20', 'PRESENCA', 'AUSENTE', 'beatriz', 'NIGHT_CALL'),
];
const column = (
  key: ReportColumnKey,
  label: string,
  type: ReportColumn['type'] = 'STRING',
): ReportColumn => ({ key, label, type });
const DATE = column('date', 'Data', 'DATE');
const RESIDENT = column('residentName', 'Residente');
const ROOM = column('roomCode', 'Quarto');
const STATUS = column('status', 'Situação');
const DISCIPLINE = [
  DATE,
  RESIDENT,
  ROOM,
  column('category', 'Categoria'),
  column('sourceType', 'Origem'),
  STATUS,
];
/** Same columns as the server catalog (ReportCatalog): only what has meaning in each report. */
export const DEMO_COLUMNS: Record<ReportCode, ReportColumn[]> = {
  PRESENCA: [DATE, RESIDENT, ROOM, STATUS],
  SAIDAS: [DATE, RESIDENT, ROOM, column('sourceType', 'Tipo de saída'), STATUS],
  LIMPEZA: [DATE, ROOM, RESIDENT, column('score', 'Nota', 'DECIMAL'), STATUS],
  OCORRENCIAS: DISCIPLINE,
  NOTIFICACOES: DISCIPLINE,
  ADVERTENCIAS: DISCIPLINE,
  TERMOS: [DATE, RESIDENT, ROOM, STATUS],
  CONSOLIDADO: [
    DATE,
    column('type', 'Tipo'),
    RESIDENT,
    ROOM,
    column('score', 'Nota', 'DECIMAL'),
    column('category', 'Categoria'),
    column('sourceType', 'Origem'),
    STATUS,
  ],
};
const STATUSES: Record<ReportCode, string[]> = {
  PRESENCA: ['PRESENTE', 'AUSENTE', 'AUSENCIA_JUSTIFICADA', 'PENDENTE', 'CHAMADA_ABERTA'],
  SAIDAS: ['AGUARDANDO_ANALISE', 'APROVADA', 'RETORNO_CONFIRMADO', 'RETORNO_CONFIRMADO_COM_ATRASO'],
  LIMPEZA: ['ABAIXO_LIMITE', 'DENTRO_LIMITE'],
  OCORRENCIAS: ['VALIDA', 'INVALIDADA'],
  NOTIFICACOES: ['PENDENTE', 'EM_ANALISE', 'ARQUIVADA'],
  ADVERTENCIAS: ['VIGENTE', 'ANULADA'],
  TERMOS: ['EMITIDO', 'ANULADO'],
  CONSOLIDADO: [],
};
/** Total and counts by status always; by type only in the consolidated report; then its metrics. */
function summaryOf(code: ReportCode, rows: ReportRow[]): ReportSummary {
  const countBy = (key: 'type' | 'status') =>
    rows.reduce<Record<string, number>>(
      (counts, item) => ({ ...counts, [item[key]]: (counts[item[key]] ?? 0) + 1 }),
      {},
    );
  const count = (type: ReportCode, status: string) =>
    rows.filter((item) => item.type === type && item.status === status).length;
  const scores = rows.flatMap((item) => (item.score === null ? [] : [item.score]));
  const summary: ReportSummary = { totalRows: rows.length, countsByStatus: countBy('status') };
  if (code === 'CONSOLIDADO') summary.countsByType = countBy('type');
  for (const metric of reportMetrics[code]) {
    if (metric === 'cleaningMean')
      summary.cleaningMean = scores.length
        ? scores.reduce((sum, n) => sum + n, 0) / scores.length
        : null;
    if (metric === 'unjustifiedAbsences')
      summary.unjustifiedAbsences = count('PRESENCA', 'AUSENTE');
    if (metric === 'confirmedLateReturns')
      summary.confirmedLateReturns = count('SAIDAS', 'RETORNO_CONFIRMADO_COM_ATRASO');
    if (metric === 'activeWarnings') summary.activeWarnings = count('ADVERTENCIAS', 'VIGENTE');
  }
  return summary;
}
/** Newest first; on the same day, by resident name, as the server query. */
const newestFirst = (a: ReportRow, b: ReportRow) =>
  b.date.localeCompare(a.date) ||
  (a.residentName ?? '').localeCompare(b.residentName ?? '', 'pt-BR') ||
  a.type.localeCompare(b.type);

/** In-memory reports of the demonstration. It has no download method on purpose. */
@Injectable({ providedIn: 'root' })
export class ReportsDemoApiService implements ReportsApi {
  private readonly session = inject(DemoSessionService);
  private readonly reports = new Map<
    string,
    { snapshot: ReportSnapshot; rows: ReportRow[]; jobs: ReportExport[] }
  >();
  private async scenario(): Promise<void> {
    const scenario = this.session.scenario();
    if (scenario === 'erro') throw new Error('Cenário de erro da demonstração.');
    if (scenario === 'carregando') await new Promise(() => undefined);
  }
  private report(reportId: string) {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Relatório não encontrado na demonstração.');
    return report;
  }
  async catalog(): Promise<ReportCatalog> {
    await this.scenario();
    return {
      version: 2,
      items: (Object.keys(STATUSES) as ReportCode[]).map((code) => ({
        code,
        title: code,
        statuses: STATUSES[code],
        columns: DEMO_COLUMNS[code],
      })),
      maxPeriodDays: 366,
      maxRows: 10000,
      defaultPageSize: 20,
      maxPageSize: 100,
      expiresAfterHours: 24,
    };
  }
  async currentDate(): Promise<string> {
    return DEMO_TODAY;
  }
  async filterOptions(): Promise<ReportFilterOptions> {
    const room = (code: keyof typeof rooms, unitId: string, number: string) => ({
      id: rooms[code],
      code,
      number,
      accommodationId: accommodation,
      unitId,
      floor: null,
      capacity: 4,
      situation: 'Ocupado' as const,
      occupancy: 1,
      vacancies: 3,
      version: 0,
    });
    return {
      housing: {
        accommodations: [
          { id: accommodation, code: 'M', name: 'Alojamento Masculino', version: 0 },
        ],
        units: [
          { id: blockA, accommodationId: accommodation, code: 'A', name: 'Bloco A', version: 0 },
          { id: blockB, accommodationId: accommodation, code: 'B', name: 'Bloco B', version: 0 },
        ],
        rooms: [
          room('A-102', blockA, '102'),
          room('A-205', blockA, '205'),
          room('B-110', blockB, '110'),
        ],
      },
      residents: Object.values(people).map((person, index) => ({
        id: person.residentId,
        name: person.residentName,
        enrollment: '20241012020190' + String(index + 1).padStart(2, '0'),
        birthDate: null,
        course: null,
        version: 0,
      })),
      failed: false,
    };
  }
  async list(): Promise<ReportListItem[]> {
    await this.scenario();
    return [...this.reports.values()]
      .filter((report) => report.rows.length > 0)
      .reverse()
      .map(({ snapshot, jobs }) => ({
        id: snapshot.id,
        catalogCode: snapshot.catalogCode,
        filters: snapshot.filters,
        rowCount: snapshot.rowCount,
        asOf: snapshot.asOf,
        expiresAt: snapshot.expiresAt,
        exports: jobs.map((job) =>
          Date.now() - Date.parse(job.createdAt) < PREPARE_MS
            ? { ...job, status: 'PROCESSING' as const }
            : {
                ...job,
                status: 'READY' as const,
                document: { id: job.id, sha256: '0'.repeat(64), size: 1, state: 'STORED' },
              },
        ),
      }));
  }
  async create(input: ReportInput & { idempotencyKey: string }): Promise<ReportSnapshot> {
    await this.scenario();
    const { catalogCode, filters } = input;
    const unitRooms: Record<string, string[]> = {
      [blockA]: [rooms['A-102'], rooms['A-205']],
      [blockB]: [rooms['B-110']],
    };
    const rows =
      this.session.scenario() === 'vazio'
        ? []
        : SAMPLE_ROWS.filter(
            (item) =>
              (catalogCode === 'CONSOLIDADO' || item.type === catalogCode) &&
              item.date >= filters.from &&
              item.date <= filters.to &&
              (!filters.accommodationId || item.accommodationId === filters.accommodationId) &&
              (!filters.unitId || unitRooms[filters.unitId]?.includes(item.roomId ?? '')) &&
              (!filters.roomId || item.roomId === filters.roomId) &&
              (!filters.residentId || item.residentId === filters.residentId) &&
              (!filters.status || item.status === filters.status),
          ).sort(newestFirst);
    const months = [...new Set(rows.map((item) => item.date.slice(0, 7)))].sort();
    const asOf = new Date();
    const snapshot: ReportSnapshot = {
      id: crypto.randomUUID(),
      catalogCode,
      catalogVersion: 2,
      filters: {
        from: filters.from,
        to: filters.to,
        accommodationId: filters.accommodationId ?? null,
        unitId: filters.unitId ?? null,
        roomId: filters.roomId ?? null,
        residentId: filters.residentId ?? null,
        status: filters.status ?? null,
      },
      columns: DEMO_COLUMNS[catalogCode],
      rowCount: rows.length,
      summary: summaryOf(catalogCode, rows),
      monthly: months.map((month) => ({
        month,
        ...summaryOf(
          catalogCode,
          rows.filter((item) => item.date.startsWith(month)),
        ),
      })),
      contentHash: '0'.repeat(64),
      asOf: asOf.toISOString(),
      expiresAt: new Date(asOf.getTime() + 86400000).toISOString(),
    };
    this.reports.set(snapshot.id, { snapshot, rows, jobs: [] });
    return snapshot;
  }
  async get(reportId: string): Promise<ReportSnapshot> {
    await this.scenario();
    return this.report(reportId).snapshot;
  }
  async rows(reportId: string, offset = 0): Promise<ReportRows> {
    await this.scenario();
    const { rows } = this.report(reportId);
    const end = offset + 25;
    return {
      snapshotId: reportId,
      offset,
      limit: 25,
      total: rows.length,
      nextOffset: end < rows.length ? end : null,
      items: rows.slice(offset, end),
    };
  }
  async requestExport(snapshotId: string, format: ReportFormat): Promise<ReportExport> {
    await this.scenario();
    const report = this.report(snapshotId);
    const job: ReportExport = {
      id: crypto.randomUUID(),
      snapshotId,
      format,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt: report.snapshot.expiresAt,
      attempts: 0,
      errorCode: null,
      document: null,
    };
    report.jobs.push(job);
    return job;
  }
}
