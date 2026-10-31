import {
  ArchiveReason,
  DisciplineCategory,
  EvidenceValue,
  NotificationStatus,
  RecurrenceCandidate,
  WarningInput,
  WarningSeverity,
} from './communications-local.models';
import { formatOperationsTime } from '../operations/operations-local.utils';

export const categoryLabels: Record<DisciplineCategory, string> = {
  AUSENCIA: 'Ausência',
  ATRASO_RETORNO: 'Atraso no retorno',
  LIMPEZA: 'Limpeza',
  OUTRA: 'Outra categoria',
};
export const severityLabels: Record<WarningSeverity, string> = {
  LEVE: 'Leve',
  MODERADA: 'Moderada',
  GRAVE: 'Grave',
};
export const notificationLabels: Record<NotificationStatus, string> = {
  PENDENTE: 'Pendente',
  VISUALIZADA: 'Visualizada',
  EM_ANALISE: 'Em análise',
  ARQUIVADA: 'Arquivada',
  CONVERTIDA: 'Convertida em advertência',
};
export const archiveLabels: Record<ArchiveReason, string> = {
  ORIGEM_RETIFICADA: 'Origem retificada',
  SEM_EVIDENCIA: 'Sem registro suficiente',
  NAO_PROCEDE: 'Ocorrência não procede',
  OUTRO: 'Outro motivo',
};
export const sourceLabels: Record<string, string> = {
  NIGHT_CALL: 'Chamada noturna',
  SHORT_RETURN: 'Retorno de saída curta',
  LONG_RETURN: 'Retorno de saída longa',
  CLEANING: 'Avaliação de limpeza',
  CLEANING_ASSESSMENT: 'Avaliação de limpeza',
  MANUAL: 'Análise manual do supervisor',
};
export const eventLabels: Record<string, string> = {
  VISUALIZAR: 'Visualização registrada',
  ANALISAR: 'Análise iniciada',
  REVISAR_ORIGEM: 'Registro atual confirmado',
  ARQUIVAR: 'Notificação arquivada',
  CONVERTER: 'Advertência criada',
};
export const communicationLabels = {
  AVISO: 'Aviso',
  ADVERTENCIA: 'Advertência',
  TERMO: 'Termo de compromisso',
};
export const communicationStateLabels = {
  PUBLICADO: 'Valendo',
  SUPERADO: 'Versão anterior',
  RETIRADO: 'Retirado',
  ANULADO: 'Anulado',
};
export const formatCommunicationTime = formatOperationsTime;
export function formatCivilDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
export function validCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function warningFormError(input: WarningInput, currentDate: string): string {
  if (!validCivilDate(input.warningDate) || input.warningDate > currentDate)
    return 'Informe uma data válida que não seja futura no horário de São Paulo.';
  if (
    !Object.hasOwn(categoryLabels, input.category) ||
    !Object.hasOwn(severityLabels, input.severity)
  )
    return 'Selecione a categoria e a gravidade decidida pelo supervisor.';
  if (input.description.trim().length < 3 || input.description.trim().length > 1800)
    return 'A descrição deve ter de 3 a 1.800 caracteres.';
  if (input.justification.trim().length < 10 || input.justification.trim().length > 1800)
    return 'Explique a decisão em 10 a 1.800 caracteres.';
  return '';
}
/** A manual retry of one unchanged intent retains its idempotency key. */
export class CommunicationIntent {
  private fingerprint = '';
  private key = '';
  for(input: unknown): string {
    const fingerprint = JSON.stringify(input);
    if (fingerprint !== this.fingerprint || !this.key) {
      this.fingerprint = fingerprint;
      this.key = crypto.randomUUID();
    }
    return this.key;
  }
  reset(): void {
    this.fingerprint = '';
    this.key = '';
  }
}
export function recurrenceSelectionError(
  candidate: RecurrenceCandidate,
  warningIds: string[],
): string {
  const selected = candidate.warnings.filter((warning) => warningIds.includes(warning.id));
  if (!candidate.candidate || candidate.category === 'OUTRA')
    return 'Ainda não há advertências suficientes nesta categoria.';
  if (
    new Set(warningIds).size !== warningIds.length ||
    selected.length !== warningIds.length ||
    selected.length < candidate.minimumWarnings
  )
    return 'Selecione ao menos duas advertências elegíveis da mesma categoria.';
  if (
    selected.some(
      (warning) =>
        warning.status !== 'VIGENTE' ||
        warning.requiresReview ||
        warning.category !== candidate.category,
    )
  )
    return 'Há advertência anulada ou ainda em conferência. Tire-a da seleção.';
  if (
    new Set(selected.map((warning) => warning.occurrenceId)).size !== selected.length ||
    selected.some((warning) => !warning.occurrenceId)
  )
    return 'Selecione advertências de origens distintas.';
  return '';
}
export function evidenceRows(evidence: EvidenceValue): { label: string; value: string }[] {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence))
    return [{ label: 'Registro', value: String(evidence ?? 'Não informado') }];
  const labels: Record<string, string> = {
    mark: 'Marcação',
    callStatus: 'Situação da chamada',
    referenceDate: 'Data da chamada',
    expectedReturnAt: 'Retorno previsto',
    actualReturnAt: 'Voltou em',
    status: 'Situação da origem',
    manualDecision: 'Decisão manual',
    score: 'Nota de limpeza',
    roomNumber: 'Quarto',
    evaluationDate: 'Data da avaliação',
    residentIds: 'Moradores registrados na avaliação',
  };
  const values: Record<string, string> = {
    AUSENTE: 'Ausente sem justificativa',
    PRESENTE: 'Presente',
    AUSENCIA_JUSTIFICADA: 'Ausência justificada',
    FECHADA: 'Fechada',
    ABERTA: 'Aberta',
    RETORNO_CONFIRMADO_COM_ATRASO: 'Retorno confirmado com atraso',
    RETORNO_CONFIRMADO: 'Retorno confirmado',
  };
  return Object.entries(evidence).map(([key, value]) => ({
    label: labels[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2'),
    value:
      typeof value === 'boolean'
        ? value
          ? 'Sim'
          : 'Não'
        : value === null
          ? 'Não informado'
          : typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value)
            ? formatOperationsTime(value)
            : typeof value === 'string' && validCivilDate(value)
              ? formatCivilDate(value)
              : typeof value === 'string'
                ? (values[value] ?? value)
                : typeof value === 'number'
                  ? value.toLocaleString('pt-BR')
                  : Array.isArray(value)
                    ? value
                        .map((item) =>
                          typeof item === 'object' ? 'Registro vinculado' : String(item),
                        )
                        .join(', ')
                    : 'Detalhes registrados na origem',
  }));
}
