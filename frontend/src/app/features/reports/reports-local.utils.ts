import { validCivilDate } from '../communications/communications-local.utils';
import { decimal } from '../cleaning/cleaning-local.utils';
import { ReportColumnKey, ReportFilters, ReportInput, ReportRow } from './reports-local.models';
export const reportLabels = {
  PRESENCA: 'Presença',
  SAIDAS: 'Saídas',
  LIMPEZA: 'Limpeza',
  OCORRENCIAS: 'Ocorrências',
  NOTIFICACOES: 'Notificações',
  ADVERTENCIAS: 'Advertências',
  TERMOS: 'Termos',
  CONSOLIDADO: 'Consolidado administrativo',
};
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
  VIGENTE: 'Vigente',
  ANULADA: 'Anulada',
  EMITIDO: 'Termo emitido',
  ANULADO: 'Termo anulado',
};
export const exportStatusLabels = {
  PENDING: 'Na fila',
  PROCESSING: 'Em preparação',
  READY: 'Arquivo disponível',
  FAILED: 'Falha na preparação',
  EXPIRED: 'Arquivo expirado',
};
export function periodError(from: string, to: string, maxDays = 366): string {
  if (!validCivilDate(from) || !validCivilDate(to))
    return 'Informe as datas inicial e final válidas.';
  if (from > to) return 'A data inicial deve anteceder ou ser igual à data final.';
  const days = (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000 + 1;
  return days > maxDays
    ? `O período pode ter no máximo ${maxDays} dias. Reduza as datas da consulta.`
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
  download(blob: Blob, id: string, format: 'PDF' | 'XLSX'): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sager-relatorio-${/^[0-9a-f-]{36}$/i.test(id) ? id : 'documento'}.${format.toLowerCase()}`;
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
