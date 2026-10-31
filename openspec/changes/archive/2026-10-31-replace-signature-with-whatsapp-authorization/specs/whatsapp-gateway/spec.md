# Spec Delta

## Purpose

Definir como o SAGER se conecta a um gateway WhatsApp auto-hospedado, confia nos eventos recebidos e continua operando quando o canal falha.

## ADDED Requirements

### Requirement: Integração desligada por padrão

O sistema SHALL manter o gateway desligado até configuração explícita, e MUST recusar a inicialização se o gateway estiver ligado sem endereço, chave de API e segredo de webhook.

#### Scenario: Sem configuração

- **WHEN** o sistema inicia sem configurar o gateway
- **THEN** nenhum envio é tentado e as telas indicam que o WhatsApp está desligado

#### Scenario: Configuração incompleta

- **WHEN** o gateway está ligado sem segredo de webhook
- **THEN** o sistema recusa a inicialização antes de atender requisições

### Requirement: Autenticidade do webhook

O sistema MUST validar a assinatura HMAC dos bytes brutos de cada evento em comparação de tempo constante, e MUST recusar com 401 um evento sem assinatura válida, sem interpretar o conteúdo.

#### Scenario: Assinatura inválida

- **WHEN** chega um evento com assinatura incorreta
- **THEN** o sistema responde 401 e nada é gravado

### Requirement: Processamento idempotente de eventos

O sistema SHALL gravar cada mensagem recebida antes de responder sucesso, com chave única por provedor, sessão e identificador da mensagem, de modo que reenvios não criem duplicatas.

#### Scenario: Evento reenviado

- **GIVEN** uma mensagem já gravada
- **WHEN** o gateway reenvia o mesmo evento
- **THEN** o sistema responde sucesso e continua com um único registro

### Requirement: Filtragem de eventos

O sistema MUST ignorar eventos de grupos, status e canais, e mensagens anteriores à vinculação da sessão.

#### Scenario: Mensagem de grupo

- **WHEN** chega um evento de um grupo
- **THEN** o sistema responde sucesso e nada é gravado

### Requirement: Evento inválido não trava o processamento

Um evento que falhe ao ser processado MUST ser marcado com o motivo da falha e MUST NOT impedir o processamento dos seguintes.

#### Scenario: Evento malformado

- **GIVEN** um evento autêntico que falha na interpretação
- **WHEN** o processamento roda
- **THEN** o evento fica marcado com a falha e os demais são processados

### Requirement: Identidade do remetente

O sistema SHALL identificar o remetente pelo telefone canônico, resolvendo identificadores LID pelo gateway e tratando a variação do nono dígito, e MUST NOT usar o nome exibido no WhatsApp para identificar alguém.

#### Scenario: Número antigo sem nono dígito

- **GIVEN** um responsável cadastrado como +5562912345678
- **WHEN** chega um arquivo de 556212345678
- **THEN** o remetente é reconhecido como esse responsável

#### Scenario: LID sem resolução

- **WHEN** chega um arquivo de um LID que o gateway não resolve
- **THEN** o remetente fica sem identificação e o arquivo não é vinculado automaticamente

### Requirement: Mídia guardada no SAGER

O sistema SHALL baixar a mídia recebida para armazenamento privado próprio com hash SHA-256 e retentativa, e MUST registrar falha visível para arquivo indisponível, acima de 10 MiB ou de tipo não permitido, sem descartá-lo em silêncio.

#### Scenario: Arquivo acima do limite

- **WHEN** chega um vídeo de 50 MiB
- **THEN** a mensagem fica registrada com a indicação de que o arquivo excede o limite

#### Scenario: Endereço de mídia suspeito

- **WHEN** um evento traz endereço de mídia fora do caminho de arquivos do gateway
- **THEN** o sistema não faz o download nem envia a chave de API, e registra a falha

### Requirement: Estado da conexão

O sistema SHALL mostrar a supervisores o estado da sessão, o QR de vinculação e o motivo de queda, considerando também o tempo sem eventos, e MUST registrar em auditoria o início da vinculação e o encerramento da sessão.

#### Scenario: Sessão aguardando vinculação

- **GIVEN** uma sessão em SCAN_QR_CODE
- **WHEN** o supervisor abre a tela de conexão
- **THEN** a tela mostra o QR e as orientações de vinculação

#### Scenario: Passkey exigida

- **GIVEN** uma sessão em PASSKEY_REQUIRED
- **WHEN** o supervisor abre a tela de conexão
- **THEN** a tela informa que o dono do número precisa concluir a confirmação no aparelho

#### Scenario: Sessão em falha

- **GIVEN** uma sessão em FAILED
- **WHEN** o supervisor inicia a sessão
- **THEN** o sistema usa a rota de reinício do gateway, porque a rota de início não tem efeito nesse estado

#### Scenario: Leitura periódica não é evento

- **WHEN** a reconciliação lê o estado da sessão
- **THEN** o horário do último evento recebido não muda

#### Scenario: Fim da sessão

- **GIVEN** uma sessão em WORKING
- **WHEN** um webhook ou a reconciliação informa outro estado
- **THEN** o encerramento fica registrado em auditoria uma vez

#### Scenario: Acesso sem perfil

- **WHEN** um usuário que não é supervisor pede o QR
- **THEN** o sistema recusa com 403

### Requirement: Reconciliação de mensagens perdidas

O sistema SHALL consultar periodicamente o gateway por mensagens recebidas das conversas com autorização pendente e das conversas com atividade nas últimas 24 horas, com limite por rodada, gravando somente as que faltam.

#### Scenario: Backend fora do ar durante o envio do responsável

- **GIVEN** um arquivo enviado pelo responsável enquanto o backend estava fora, com as tentativas do webhook esgotadas
- **WHEN** a reconciliação roda
- **THEN** o arquivo aparece como candidato do pedido, sem duplicatas

#### Scenario: Conversa sem autorização pendente

- **GIVEN** uma conversa com atividade nas últimas 24 horas, que perdeu uma mensagem recebida
- **WHEN** a reconciliação roda
- **THEN** a mensagem entra uma única vez no histórico

#### Scenario: Muitas conversas ativas

- **GIVEN** mais conversas ativas do que o limite da rodada
- **WHEN** a reconciliação roda
- **THEN** o gateway é consultado no máximo até o limite, e as demais ficam para as próximas rodadas
