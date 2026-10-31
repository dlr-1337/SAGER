import { DocumentMessageStatus, LongExitInput, SignatureStatus } from './long-exit.models';
import { exitStatusLabels } from './operations-local.utils';

export const longExitStatusLabels = exitStatusLabels;
export const signatureStatusLabels: Record<SignatureStatus, string> = {
  UNAVAILABLE: 'WhatsApp indisponível; autorização por outro canal',
  PENDING: 'Aguardando autorização do responsável',
  VALID: 'Autorização conferida por servidor',
  FAILED: 'Falha na autorização',
  UNCERTAIN: 'Autorização aguardando verificação',
  EXPIRED: 'Prazo da autorização encerrado',
  INVALIDATED: 'Autorização invalidada',
};
export const messageStatusLabels: Record<DocumentMessageStatus, string> = {
  UNAVAILABLE: 'Envio indisponível',
  QUEUED: 'Documento aguardando envio',
  ACCEPTED: 'Documento aceito para envio',
  SENT: 'Documento enviado',
  DELIVERED: 'Documento entregue',
  READ: 'Documento lido',
  FAILED: 'Falha no envio',
  UNCERTAIN: 'Envio aguardando verificação',
};
/** Same code printed on the PDF, so the supervisor can match the returned file at a glance. */
export const documentShortCode = (documentVersionId: string): string =>
  documentVersionId.replaceAll('-', '').slice(0, 8).toUpperCase();
export const documentStateLabels: Record<string, string> = {
  PENDING: 'Aguardando geração',
  STORED: 'Disponível',
  FAILED: 'Falha no armazenamento',
  MISSING: 'Arquivo indisponível',
  CORRUPT: 'Arquivo não íntegro',
  UNAVAILABLE: 'Indisponível',
  NOT_AVAILABLE: 'Ainda não disponível',
};
export function longPeriodError(departure: string, expectedReturn: string): string {
  const duration = Date.parse(expectedReturn) - Date.parse(departure);
  if (duration <= 0) return 'A volta precisa ser depois da saída. Escolha outro horário.';
  return duration <= 3 * 3_600_000
    ? 'A saída longa precisa durar mais de 3 horas. Para até 3 horas, peça uma saída curta.'
    : '';
}
export function longExitFormError(input: LongExitInput, serverNow: string): string {
  const departureAt =
    input.departureMode === 'NOW' ? serverNow : (input.requestedDepartureAt ?? '');
  const departure = Date.parse(departureAt);
  const expectedReturn = Date.parse(input.expectedReturnAt);
  if (!Number.isFinite(departure) || !Number.isFinite(expectedReturn))
    return 'Escolha uma data e uma hora válidas.';
  if (input.departureMode === 'SCHEDULED' && departure <= Date.parse(serverNow))
    return 'A saída precisa ser depois de agora. Escolha outro horário.';
  const period = longPeriodError(departureAt, input.expectedReturnAt);
  if (period) return period;
  if (!input.guardianId) return 'Escolha quem vai autorizar.';
  if (input.reason.trim().length < 3 || input.reason.trim().length > 2000)
    return 'Escreva o motivo da saída.';
  if ((input.notes?.length ?? 0) > 2000) return 'As observações devem ter até 2.000 caracteres.';
  return '';
}
export function guardianBlocker(code: string): string {
  return (
    (
      {
        inactive: 'Cadastro desativado',
        guardian_inactive: 'Cadastro desativado',
        brazilian_e164_required: 'Telefone inválido. Fale com o supervisor',
        not_linked: 'Não está ligado ao seu cadastro',
        phone_required: 'Telefone não cadastrado',
        invalid_phone: 'Telefone inválido',
        unsupported_country: 'Telefone fora do Brasil',
        guardian_required: 'Você precisa de um responsável no sistema. Fale com o supervisor.',
      } as Record<string, string>
    )[code] ?? 'Cadastro precisa ser atualizado. Fale com o supervisor'
  );
}
