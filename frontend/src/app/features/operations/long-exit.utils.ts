import { LongExitInput, InvitationMessageStatus, SignatureStatus } from './long-exit.models';
import { exitStatusLabels } from './operations-local.utils';

export const longExitStatusLabels = exitStatusLabels;
export const signatureStatusLabels: Record<SignatureStatus, string> = {
  UNAVAILABLE: 'Serviço de assinatura indisponível',
  PENDING: 'Aguardando assinatura',
  VALID: 'Assinatura confirmada pelo servidor',
  FAILED: 'Falha na assinatura',
  UNCERTAIN: 'Assinatura aguardando conferência',
  EXPIRED: 'Prazo de assinatura encerrado',
  INVALIDATED: 'Assinatura invalidada',
};
export const messageStatusLabels: Record<InvitationMessageStatus, string> = {
  UNAVAILABLE: 'Envio indisponível',
  QUEUED: 'Convite aguardando envio',
  ACCEPTED: 'Convite aceito para envio',
  SENT: 'Convite enviado',
  DELIVERED: 'Convite entregue',
  READ: 'Convite lido',
  FAILED: 'Falha no envio',
  UNCERTAIN: 'Envio aguardando conferência',
};
export const documentStateLabels: Record<string, string> = {
  PENDING: 'Aguardando geração',
  STORED: 'Disponível',
  FAILED: 'Falha no armazenamento',
  MISSING: 'Arquivo indisponível',
  CORRUPT: 'Arquivo não íntegro',
  UNAVAILABLE: 'Indisponível',
  NOT_AVAILABLE: 'Ainda não disponível',
};
export function longExitFormError(input: LongExitInput, serverNow: string): string {
  const departure = Date.parse(
    input.departureMode === 'NOW' ? serverNow : (input.requestedDepartureAt ?? ''),
  );
  const expectedReturn = Date.parse(input.expectedReturnAt);
  if (!Number.isFinite(departure) || !Number.isFinite(expectedReturn))
    return 'Informe datas e horas válidas no horário de Brasília.';
  if (input.departureMode === 'SCHEDULED' && departure < Date.parse(serverNow))
    return 'A saída agendada deve ser igual ou posterior ao horário informado pelo servidor.';
  if (expectedReturn <= departure) return 'O retorno previsto deve ser posterior à saída.';
  if (expectedReturn - departure <= 3 * 3_600_000)
    return 'A saída longa deve durar mais de 3 horas. Para até 3 horas, solicite uma saída curta.';
  if (!input.guardianId)
    return 'Selecione um responsável elegível para receber o convite individual.';
  if (input.reason.trim().length < 3 || input.reason.trim().length > 2000)
    return 'Informe um motivo com 3 a 2.000 caracteres.';
  if ((input.notes?.length ?? 0) > 2000) return 'As observações devem ter até 2.000 caracteres.';
  return '';
}
export function guardianBlocker(code: string): string {
  return (
    (
      {
        inactive: 'Cadastro inativo',
        guardian_inactive: 'Cadastro inativo',
        brazilian_e164_required: 'Telefone brasileiro inválido; solicite atualização do cadastro',
        not_linked: 'Sem vínculo com o residente',
        phone_required: 'Telefone não cadastrado',
        invalid_phone: 'Telefone inválido',
        unsupported_country: 'Telefone fora do Brasil',
        guardian_required: 'É necessário um responsável elegível cadastrado e vinculado.',
      } as Record<string, string>
    )[code] ?? 'Cadastro do responsável precisa ser atualizado'
  );
}
