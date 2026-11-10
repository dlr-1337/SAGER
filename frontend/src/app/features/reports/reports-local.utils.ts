import { signal } from '@angular/core';
import { validCivilDate } from '../communications/communications-local.utils';
import { decimal } from '../cleaning/cleaning-local.utils';
import { ReportingApiError, reportingError } from '../cleaning/reporting-local.transport';
import {
  ReportCode,
  ReportColumnKey,
  ReportFilters,
  ReportFormat,
  ReportInput,
  ReportListItem,
  ReportRow,
} from './reports-local.models';
export const reportLabels = {
  PRESENCA: 'Presença na chamada',
  SAIDAS: 'Saídas e retornos',
  LIMPEZA: 'Limpeza dos quartos',
  OCORRENCIAS: 'Ocorrências',
  NOTIFICACOES: 'Notificações',
  ADVERTENCIAS: 'Advertências',
  TERMOS: 'Termos de compromisso',
  CONSOLIDADO: 'Tudo junto',
};
export const reportDescriptions: Record<ReportCode, string> = {
  PRESENCA: 'Quem estava presente ou ausente à noite.',
  SAIDAS: 'Saídas pedidas, aprovadas e retornos.',
  LIMPEZA: 'Notas das avaliações de limpeza.',
  OCORRENCIAS: 'Fatos registrados com cada residente.',
  NOTIFICACOES: 'Alertas em análise. Não são advertências.',
  ADVERTENCIAS: 'Advertências dadas aos residentes.',
  TERMOS: 'Termos emitidos ou anulados.',
  CONSOLIDADO: 'Todos os tipos em um só relatório.',
};
export type ReportPeriodPreset = 'este-mes' | 'mes-passado' | 'ultimos-7-dias';
export function periodPreset(
  preset: ReportPeriodPreset,
  today: string,
): { from: string; to: string } {
  const [year, month, day] = today.split('-').map(Number);
  const civil = (time: number) => new Date(time).toISOString().slice(0, 10);
  if (preset === 'este-mes') return { from: today.slice(0, 8) + '01', to: today };
  if (preset === 'mes-passado')
    return { from: civil(Date.UTC(year, month - 2, 1)), to: civil(Date.UTC(year, month - 1, 0)) };
  return { from: civil(Date.UTC(year, month - 1, day - 6)), to: today };
}
export function reportFileName(
  item: Pick<ReportListItem, 'catalogCode' | 'filters'>,
  format: ReportFormat,
): string {
  const { from, to } = item.filters;
  return `relatorio-${item.catalogCode.toLowerCase()}-${from}-a-${to}.${format.toLowerCase()}`;
}
export const reportInProgress = (item: ReportListItem) =>
  item.exports.some((job) => job.status === 'PENDING' || job.status === 'PROCESSING');
const POLL_INTERVAL = 3000;
const SLOW_AFTER = 120000;
/** One source of progress: consults the list only while a file is being prepared. */
export class ReportListPolling {
  readonly items = signal<ReportListItem[]>([]);
  readonly error = signal('');
  readonly slow = signal<ReadonlySet<string>>(new Set());
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  // Measured here because the browser clock may disagree with the server's createdAt.
  private firstSeen = new Map<string, number>();
  constructor(private readonly load: () => Promise<ReportListItem[]>) {}
  async refresh(): Promise<void> {
    clearTimeout(this.timer);
    const generation = ++this.generation;
    try {
      const items = await this.load();
      if (generation !== this.generation) return;
      this.items.set(items);
      this.error.set('');
      this.trackSlow(items);
    } catch (error) {
      if (generation !== this.generation) return;
      const denied =
        error instanceof ReportingApiError && (error.status === 401 || error.status === 403);
      if (denied || !this.items().some(reportInProgress)) {
        this.error.set(reportingError(error));
        return;
      }
    }
    if (this.items().some(reportInProgress))
      this.timer = setTimeout(() => void this.refresh(), POLL_INTERVAL);
  }
  stop(): void {
    this.generation++;
    clearTimeout(this.timer);
  }
  private trackSlow(items: ReportListItem[]): void {
    const now = Date.now();
    const seen = new Map<string, number>();
    const slow = new Set<string>();
    for (const item of items)
      for (const job of item.exports) {
        if (job.status !== 'PENDING' && job.status !== 'PROCESSING') continue;
        const first = this.firstSeen.get(job.id) ?? now;
        seen.set(job.id, first);
        if (now - first > SLOW_AFTER) slow.add(item.id);
      }
    this.firstSeen = seen;
    this.slow.set(slow);
  }
}
export const reportStatusLabels: Record<string, string> = {
  PRESENTE: 'Presente',
  AUSENTE: 'Ausente sem justificativa',
  AUSENCIA_JUSTIFICADA: 'Ausência justificada',
  PENDENTE: 'Pendente',
  CHAMADA_ABERTA: 'Chamada ainda aberta',
  AGUARDANDO_ANALISE: 'Aguardando análise',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
  CANCELADA: 'Cancelada',
  EXPIRADA: 'Expirada',
  EM_ANDAMENTO: 'Em andamento',
  RETORNO_CONFIRMADO: 'Retorno confirmado',
  RETORNO_CONFIRMADO_COM_ATRASO: 'Retorno confirmado com atraso',
  ABAIXO_LIMITE: 'Abaixo do limiar',
  DENTRO_LIMITE: 'Dentro do limiar',
  VALIDA: 'Origem válida',
  INVALIDADA: 'Origem invalidada',
  VISUALIZADA: 'Visualizada',
  EM_ANALISE: 'Em análise',
  ARQUIVADA: 'Arquivada',
  CONVERTIDA: 'Convertida',
  VIGENTE: 'Valendo',
  ANULADA: 'Anulada',
  EMITIDO: 'Termo emitido',
  ANULADO: 'Termo anulado',
};
export function periodError(from: string, to: string, maxDays = 366): string {
  if (!validCivilDate(from) || !validCivilDate(to))
    return 'Informe as datas inicial e final válidas.';
  if (from > to) return 'A data inicial deve anteceder ou ser igual à data final.';
  const days = (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000 + 1;
  return days > maxDays
    ? `O período pode ter no máximo ${maxDays} dias. Escolha um período menor.`
    : '';
}
export function normalizedReportInput(
  catalogCode: ReportInput['catalogCode'],
  filters: Record<keyof ReportFilters, string>,
): ReportInput {
  const { from, to, ...optional } = filters;
  const extras = Object.fromEntries(Object.entries(optional).filter(([, value]) => !!value));
  return { catalogCode, filters: { from, to, ...extras } };
}
export function reportCell(row: ReportRow, key: ReportColumnKey): string {
  const value = row[key];
  if (value === null) return 'Não informado';
  if (key === 'date') {
    const [year, month, day] = String(value).split('-');
    return `${day}/${month}/${year}`;
  }
  if (key === 'score') return decimal(value as number);
  if (key === 'type') return reportLabels[value as keyof typeof reportLabels] ?? String(value);
  if (key === 'status') return reportStatusLabels[String(value)] ?? String(value);
  const labels: Record<string, string> = {
    AUSENCIA: 'Ausência',
    ATRASO_RETORNO: 'Atraso no retorno',
    LIMPEZA: 'Limpeza',
    OUTRA: 'Outra categoria',
    NIGHT_CALL: 'Chamada noturna',
    SHORT_RETURN: 'Saída curta',
    LONG_RETURN: 'Saída longa',
    CLEANING_ASSESSMENT: 'Avaliação de limpeza',
    MANUAL: 'Decisão manual',
    RECURRENCE: 'Reincidência',
  };
  return labels[String(value)] ?? String(value);
}
export class ReportDownloads {
  private urls = new Map<string, ReturnType<typeof setTimeout>>();
  download(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.rel = 'noopener';
    anchor.referrerPolicy = 'no-referrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    this.urls.set(
      url,
      setTimeout(() => {
        URL.revokeObjectURL(url);
        this.urls.delete(url);
      }, 1000),
    );
  }
  destroy(): void {
    for (const [url, timer] of this.urls) {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    }
    this.urls.clear();
  }
}
