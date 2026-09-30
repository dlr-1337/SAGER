import { ShortExitInput, ShortExitStatus } from './operations-local.models';

export const operationsZone = 'America/Sao_Paulo';
const civil = new Intl.DateTimeFormat('en-CA', {
  timeZone: operationsZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const display = new Intl.DateTimeFormat('pt-BR', {
  timeZone: operationsZone,
  dateStyle: 'short',
  timeStyle: 'short',
});
function parts(time: number): Record<string, string> {
  return Object.fromEntries(civil.formatToParts(time).map((part) => [part.type, part.value]));
}
/** datetime-local always represents São Paulo, independently of the browser's timezone. */
export function saoPauloInput(instant: string): string {
  const time = Date.parse(instant);
  if (!Number.isFinite(time)) return '';
  const p = parts(time);
  return `${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}`;
}
export function saoPauloInstant(input: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(input);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (year < 1900 || month < 1 || month > 12 || hour > 23 || minute > 59) return null;
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(target);
  if (check.getUTCDate() !== day || day < 1) return null;
  let time = target;
  for (let i = 0; i < 3; i++) {
    const p = parts(time);
    const local = Date.UTC(
      +p['year'],
      +p['month'] - 1,
      +p['day'],
      +p['hour'],
      +p['minute'],
      +p['second'],
    );
    time += target - local;
  }
  const instant = new Date(time).toISOString();
  return saoPauloInput(instant) === input ? instant : null;
}
export function formatOperationsTime(instant: string | null | undefined): string {
  if (!instant || !Number.isFinite(Date.parse(instant))) return 'Não registrado';
  return display.format(new Date(instant));
}
export function formatCivilDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}
export function validJustification(value: string): boolean {
  return value.trim().length >= 10 && value.trim().length <= 500;
}
export function shortExitFormError(input: ShortExitInput, serverNow: string): string {
  const departure = Date.parse(
    input.departureMode === 'NOW' ? serverNow : (input.requestedDepartureAt ?? ''),
  );
  const expectedReturn = Date.parse(input.expectedReturnAt);
  if (!Number.isFinite(departure) || !Number.isFinite(expectedReturn))
    return 'Informe datas e horas válidas no horário de Brasília.';
  if (input.departureMode === 'SCHEDULED' && departure < Date.parse(serverNow))
    return 'A saída agendada deve ser igual ou posterior ao horário informado pelo servidor.';
  if (expectedReturn <= departure) return 'O retorno previsto deve ser posterior à saída.';
  if (expectedReturn - departure > 3 * 3_600_000)
    return 'A saída curta deve durar no máximo 3 horas.';
  if (input.reason.trim().length < 3 || input.reason.trim().length > 2000)
    return 'Informe um motivo com 3 a 2.000 caracteres.';
  if ((input.notes?.length ?? 0) > 2000) return 'As observações devem ter até 2.000 caracteres.';
  return '';
}
export const exitStatusLabels: Record<ShortExitStatus, string> = {
  AGUARDANDO_ANALISE: 'Aguardando análise',
  APROVADA: 'Aprovada',
  EM_ANDAMENTO: 'Em andamento',
  RETORNO_CONFIRMADO: 'Retorno confirmado',
  RETORNO_CONFIRMADO_COM_ATRASO: 'Retorno confirmado com atraso',
  REJEITADA: 'Rejeitada',
  CANCELADA: 'Cancelada',
  EXPIRADA: 'Expirada',
};
export const callMarkLabels = {
  PRESENTE: 'Presente',
  AUSENTE: 'Ausente',
  AUSENCIA_JUSTIFICADA: 'Ausência justificada',
};
export const exitEventLabels: Record<string, string> = {
  CREATED: 'Solicitação registrada',
  UPDATED: 'Solicitação alterada',
  CREATE: 'Solicitação registrada',
  UPDATE: 'Solicitação alterada',
  DECISION: 'Decisão registrada',
  DEPARTURE: 'Partida presencial registrada',
  RETURN: 'Retorno presencial registrado',
  CANCELLED: 'Solicitação cancelada',
  EXPIRED: 'Solicitação expirada',
};
export function eligibilityBlocker(code: string): string {
  return (
    (
      {
        birth_date_required: 'A data de nascimento precisa ser cadastrada.',
        not_minor: 'A saída curta é destinada a residentes menores de idade.',
        active_allocation_required: 'É necessária uma alocação ativa em quarto.',
      } as Record<string, string>
    )[code] ?? 'O cadastro precisa ser atualizado antes de solicitar a saída.'
  );
}
