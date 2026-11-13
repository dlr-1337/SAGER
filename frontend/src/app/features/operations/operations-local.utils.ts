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
  return value.trim().length >= 10 && value.trim().length <= 2000;
}
export function minutesAfter(instant: string, minutes: number): string {
  return new Date(Date.parse(instant) + minutes * 60_000).toISOString();
}
/** Server instant plus monotonic elapsed time, so changing the device clock has no effect. */
export function serverClock(serverNow: string): () => string {
  const server = Date.parse(serverNow);
  const syncedAt = performance.now();
  return () => new Date(server + performance.now() - syncedAt).toISOString();
}
export function shortPeriodError(departure: string, expectedReturn: string): string {
  const duration = Date.parse(expectedReturn) - Date.parse(departure);
  if (duration <= 0) return 'O retorno previsto deve ser posterior à saída.';
  return duration > 3 * 3_600_000 ? 'A saída curta deve durar no máximo 3 horas.' : '';
}
export type PeriodError = (departure: string, expectedReturn: string) => string;
/** What the return becomes after the departure changes; null keeps the current value. */
export function nextReturn(
  departure: string | null,
  current: string | null,
  edited: boolean,
  suggestionMinutes: number,
  periodError: PeriodError,
): { value: string; adjusted: boolean } | null {
  if (!departure) return edited ? null : { value: '', adjusted: false };
  if (edited && current && !periodError(departure, current)) return null;
  return { value: minutesAfter(departure, suggestionMinutes), adjusted: edited && !!current };
}
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours} h` : '', rest ? `${rest} min` : ''].filter(Boolean).join(' ');
}
export interface PeriodHint {
  returnMin: string | null;
  returnMax: string | null;
  duration: string;
  error: string;
}
export function periodHint(
  departure: string | null,
  expectedReturn: string | null,
  minMinutes: number,
  maxMinutes: number | null,
  periodError: PeriodError,
  toInput: (instant: string) => string = saoPauloInput,
): PeriodHint {
  if (!departure) return { returnMin: null, returnMax: null, duration: '', error: '' };
  // Rounding up keeps the text on the same side of the limit as the seconds of the "Agora" mode.
  const minutes = expectedReturn
    ? Math.ceil((Date.parse(expectedReturn) - Date.parse(departure)) / 60_000)
    : 0;
  return {
    returnMin: toInput(minutesAfter(departure, minMinutes)),
    returnMax: maxMinutes === null ? null : toInput(minutesAfter(departure, maxMinutes)),
    duration: minutes > 0 ? formatDuration(minutes) : '',
    error: expectedReturn ? periodError(departure, expectedReturn) : '',
  };
}
export function shortExitFormError(input: ShortExitInput, serverNow: string): string {
  const departureAt =
    input.departureMode === 'NOW' ? serverNow : (input.requestedDepartureAt ?? '');
  const departure = Date.parse(departureAt);
  const expectedReturn = Date.parse(input.expectedReturnAt);
  if (!Number.isFinite(departure) || !Number.isFinite(expectedReturn))
    return 'Escolha uma data e uma hora válidas.';
  if (input.departureMode === 'SCHEDULED' && departure < Date.parse(serverNow))
    return 'A saída não pode ser antes de agora. Escolha outro horário.';
  const period = shortPeriodError(departureAt, input.expectedReturnAt);
  if (period) return period;
  if (input.reason.trim().length < 3 || input.reason.trim().length > 2000)
    return 'Escreva o motivo da saída.';
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
  CREATED: 'Pedido registrado',
  UPDATED: 'Pedido alterado',
  CREATE: 'Pedido registrado',
  UPDATE: 'Pedido alterado',
  DECISION: 'Decisão registrada',
  DEPARTURE: 'Saída registrada',
  RETURN: 'Volta registrada',
  CANCELLED: 'Pedido cancelado',
  EXPIRED: 'Pedido expirado',
};
export function eligibilityBlocker(code: string): string {
  return (
    (
      {
        birth_date_required: 'Sua data de nascimento não está no sistema. Fale com o supervisor.',
        not_minor: 'Este pedido é só para residentes menores de idade.',
        active_allocation_required: 'Você ainda não tem quarto no sistema. Fale com o supervisor.',
      } as Record<string, string>
    )[code] ?? 'Seu cadastro precisa ser atualizado. Fale com o supervisor.'
  );
}
