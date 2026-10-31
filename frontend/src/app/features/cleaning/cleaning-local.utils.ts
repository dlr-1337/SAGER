import { saoPauloInstant } from '../operations/operations-local.utils';
import {
  CleaningCriteria,
  CleaningCriterion,
  CleaningInput,
  RankingPeriod,
} from './cleaning-local.models';
export const criterionLabels: Record<CleaningCriterion, string> = {
  PISO: 'Piso',
  SUPERFICIES: 'Superfícies',
  RESIDUOS: 'Lixo',
  ORGANIZACAO: 'Organização',
};
export const criteriaKeys = Object.keys(criterionLabels) as CleaningCriterion[];
export const periodLabels: Record<RankingPeriod, string> = {
  WEEK: 'Semana',
  MONTH: 'Mês',
  SEMESTER: 'Semestre',
};
export function validCriteria(value: unknown): value is CleaningCriteria {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 4
  )
    return false;
  return criteriaKeys.every((key) => {
    const number = (value as Record<string, unknown>)[key];
    return (
      typeof number === 'number' &&
      Number.isFinite(number) &&
      number >= 0 &&
      number <= 10 &&
      Math.abs(number * 10 - Math.round(number * 10)) < 1e-8
    );
  });
}
/** Preview only: integer tenths preserve policy v1 HALF_UP without binary decimal drift. */
export function previewCleaningScore(criteria: CleaningCriteria): number | null {
  if (!validCriteria(criteria)) return null;
  const tenths = criteriaKeys.reduce((sum, key) => sum + Math.round(criteria[key] * 10), 0);
  return Math.floor((tenths * 5 + 1) / 2) / 100;
}
export function decimal(value: number | null | undefined): string {
  return value === null || value === undefined
    ? 'Sem avaliação'
    : value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function cleaningInputError(input: CleaningInput, serverNow: string): string {
  if (!validCriteria(input.criteria))
    return 'Informe os quatro critérios entre 0 e 10, em passos de 0,1.';
  if ((input.observation?.length ?? 0) > 2000) return 'A observação deve ter até 2.000 caracteres.';
  if (input.timeMode === 'RETROACTIVE') {
    const instant = Date.parse(input.evaluatedAt ?? '');
    if (!Number.isFinite(instant) || instant > Date.parse(serverNow))
      return 'Informe quando foi a avaliação. Não pode ser no futuro.';
    const reason = input.registrationReason?.trim() ?? '';
    if (reason.length < 10 || reason.length > 2000)
      return 'Explique o registro histórico em 10 a 2.000 caracteres.';
  }
  return '';
}
export function cleaningPlan(
  roomId: string,
  timeMode: 'NOW' | 'RETROACTIVE',
  criteria: CleaningCriteria,
  observation: string,
  civilTime: string,
  reason: string,
): CleaningInput {
  const base: CleaningInput = {
    roomId,
    timeMode,
    criteria,
    observation: observation.trim() || null,
  };
  return timeMode === 'NOW'
    ? base
    : { ...base, evaluatedAt: saoPauloInstant(civilTime) ?? '', registrationReason: reason.trim() };
}
