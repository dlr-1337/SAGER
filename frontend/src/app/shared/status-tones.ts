/** Tom de `.status[data-tone]`; neutro fica sem o atributo (cinza). */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const warning = (meaning: string) => ({ tone: 'warning', meaning }) as const;
const info = (meaning: string) => ({ tone: 'info', meaning }) as const;
const success = (meaning: string) => ({ tone: 'success', meaning }) as const;
const danger = (meaning: string) => ({ tone: 'danger', meaning }) as const;
const neutral = (meaning: string) => ({ tone: 'neutral', meaning }) as const;

/**
 * Tom e significado pelo nome que aparece na tela (simple-screens, design D5): o mesmo nome tem a
 * mesma cor em qualquer tela. Cada significado é uma frase só, usada na legenda.
 */
export const statusTones: Record<string, { tone: StatusTone; meaning: string }> = {
  // Saídas
  'Aguardando análise': warning('Espera a decisão do supervisor.'),
  Aprovada: info('Pode sair no horário pedido.'),
  'Em andamento': info('O residente saiu e ainda não voltou.'),
  'Retorno confirmado': success('Voltou no horário.'),
  'Retorno confirmado com atraso': warning('Voltou depois do horário.'),
  Rejeitada: danger('O pedido foi negado.'),
  Cancelada: neutral('O pedido foi cancelado.'),
  Expirada: neutral('O prazo passou sem a saída acontecer.'),
  // Autorização do responsável e envio do documento (saída longa)
  'Aguardando autorização do responsável': warning('Espera o responsável enviar a autorização.'),
  'WhatsApp indisponível; autorização por outro canal': warning(
    'A autorização precisa chegar por outro canal.',
  ),
  'Autorização conferida por servidor': success('Um supervisor conferiu a autorização.'),
  'Falha na autorização': danger('A autorização não pôde ser aceita.'),
  'Autorização aguardando verificação': warning('A autorização precisa ser conferida.'),
  'Prazo da autorização encerrado': neutral('O prazo para autorizar acabou.'),
  'Autorização invalidada': neutral('A autorização deixou de valer.'),
  'Envio indisponível': warning('O documento não pôde ser enviado pelo WhatsApp.'),
  'Documento aguardando envio': info('O documento está na fila de envio.'),
  'Documento aceito para envio': info('O WhatsApp aceitou o documento para envio.'),
  'Documento enviado': info('O documento saiu para o responsável.'),
  'Documento entregue': success('O documento chegou ao responsável.'),
  'Documento lido': success('O responsável abriu o documento.'),
  'Falha no envio': danger('O documento não foi enviado.'),
  'Envio aguardando verificação': warning('Confira no celular se o documento foi enviado.'),
  'Aguardando conferência': warning('O arquivo espera a conferência do supervisor.'),
  'Arquivo recusado': danger('O arquivo foi recusado.'),
  // Chamada noturna
  Aberta: warning('A chamada ainda está sendo feita.'),
  Fechada: success('A chamada terminou.'),
  Pendente: warning('Ainda falta conferir.'),
  Presente: success('O residente está no quarto.'),
  Ausente: danger('O residente não estava e gera ocorrência.'),
  'Ausência justificada': info('O residente está fora com saída autorizada.'),
  // Notificações
  Visualizada: info('O supervisor marcou que viu a notificação.'),
  'Em análise': info('A notificação está sendo analisada.'),
  Arquivada: neutral('A notificação foi encerrada sem advertência.'),
  'Convertida em advertência': neutral('A notificação virou uma advertência.'),
  // Advertências, avisos e comunicações do residente
  Valendo: success('Está em vigor.'),
  Anulada: neutral('A advertência foi anulada.'),
  Anulado: neutral('O registro foi anulado.'),
  'Versão anterior': neutral('Foi substituído por uma versão nova.'),
  Rascunho: neutral('Ainda não foi publicado.'),
  Publicado: success('Os residentes escolhidos já podem ler.'),
  Retirado: neutral('Foi retirado e fica só para consulta.'),
  // Termos de compromisso
  'Termo valendo': success('O termo está em vigor.'),
  'Termo anulado': neutral('O termo foi anulado.'),
};

/** Valor de `[attr.data-tone]` para o nome: null no neutro e no nome sem entrada (cinza). */
export function toneAttr(name: string): Exclude<StatusTone, 'neutral'> | null {
  const tone = statusTones[name]?.tone ?? 'neutral';
  return tone === 'neutral' ? null : tone;
}
