# guardian-authorization Specification

## Purpose
Definir como o responsável recebe o documento da saída longa, devolve a autorização do jeito que preferir e como um servidor a confere antes da decisão humana.

## Requirements

### Requirement: Envio do documento ao responsável

Ao criar ou editar uma saída longa com o gateway ligado, o sistema SHALL gerar o PDF da revisão atual e enviá-lo pelo WhatsApp ao responsável escolhido, registrando cada tentativa e o estado de entrega.

#### Scenario: Pedido criado

- **WHEN** o residente cria uma saída longa com responsável elegível
- **THEN** o PDF da revisão é enviado ao telefone do responsável e a tentativa fica registrada

#### Scenario: Pedido editado

- **GIVEN** um documento enviado na revisão 1
- **WHEN** o residente edita o pedido
- **THEN** a autorização anterior é invalidada e o PDF da revisão 2 é enviado

#### Scenario: Limite de envios pelo residente

- **GIVEN** um residente que acabou de disparar um envio
- **WHEN** ele edita o pedido ou abre outro pedido antes de 10 minutos, ou passa de 3 envios em 24 horas
- **THEN** o envio fica agendado para o próximo horário permitido, e só a revisão mais recente é enviada

### Requirement: Conteúdo mínimo do documento

O PDF MUST conter nome do residente, período, motivo, nome do responsável, espaço para assinatura, código curto e revisão, e MUST NOT conter data de nascimento, matrícula ou quarto.

#### Scenario: Documento gerado

- **WHEN** o sistema gera o documento de uma revisão
- **THEN** ele traz o código e a revisão impressos e não traz data de nascimento

### Requirement: Mensagem nunca autoriza

Entrega, leitura ou recebimento de mensagem MUST NOT tornar uma autorização válida nem aprovar um pedido.

#### Scenario: Documento lido

- **GIVEN** um documento com confirmação de leitura
- **WHEN** o supervisor consulta o pedido
- **THEN** a autorização continua pendente e a aprovação indisponível

#### Scenario: Arquivo recebido sem conferência

- **GIVEN** um arquivo vinculado ao pedido como candidato
- **WHEN** o supervisor tenta aprovar o pedido
- **THEN** o sistema recusa com `signature_required`

### Requirement: Vinculação do arquivo ao pedido

O sistema SHALL vincular automaticamente uma imagem ou PDF recebido de responsável quando a mensagem citar o documento enviado ou houver um único pedido aberto para aquele telefone, e MUST NOT vincular automaticamente quando houver mais de um pedido aberto.

#### Scenario: Único pedido aberto

- **GIVEN** um único pedido aberto para o telefone do responsável
- **WHEN** chega uma foto desse telefone
- **THEN** a foto aparece como candidato no pedido

#### Scenario: Irmãos com o mesmo responsável

- **GIVEN** dois pedidos abertos para o mesmo telefone
- **WHEN** chega uma foto sem citar nenhum documento
- **THEN** a foto não é vinculada e o supervisor pode escolher o pedido

#### Scenario: Resposta citando o documento

- **GIVEN** dois pedidos abertos para o mesmo telefone
- **WHEN** chega uma foto respondendo à mensagem do documento de um deles
- **THEN** a foto é vinculada a esse pedido

#### Scenario: Número desconhecido

- **WHEN** chega uma foto de um número que não é de responsável com pedido aberto
- **THEN** nenhum vínculo é criado

#### Scenario: Citação de documento de outra revisão

- **GIVEN** um pedido com revisão nova depois de uma edição
- **WHEN** chega uma foto citando a mensagem da revisão anterior
- **THEN** a foto fica fora da conferência da revisão atual, sem virar candidata dela

#### Scenario: Reenvio com arquivo aguardando conferência

- **GIVEN** um arquivo candidato na revisão atual
- **WHEN** o supervisor tenta reenviar o documento
- **THEN** o sistema recusa com `authorization_pending` até o arquivo ser conferido ou recusado

### Requirement: Conferência humana da autorização

Somente um supervisor SHALL poder confirmar um arquivo candidato, declarando ter conferido responsável, documento e revisão, e o sistema MUST registrar quem conferiu, quando, o método de recebimento e o hash do arquivo.

#### Scenario: Confirmação

- **GIVEN** um arquivo candidato da revisão atual
- **WHEN** o supervisor confirma a conferência
- **THEN** a autorização fica conferida, o arquivo é preservado sem alteração e a auditoria registra o ato sem o conteúdo do arquivo

#### Scenario: Perfil sem permissão

- **WHEN** um gestor ou residente tenta confirmar um arquivo
- **THEN** o sistema recusa com 403

#### Scenario: Revisão desatualizada

- **GIVEN** um arquivo da revisão 1 e um pedido já na revisão 2
- **WHEN** o supervisor tenta confirmar o arquivo
- **THEN** o sistema recusa com `stale_document`

#### Scenario: Remetente divergente

- **GIVEN** um arquivo de telefone diferente do responsável escolhido, vinculado manualmente
- **WHEN** o supervisor o confirma
- **THEN** a tela destaca a divergência e exige justificativa

### Requirement: Recusa do arquivo

Um supervisor SHALL poder recusar um arquivo candidato com justificativa, mantendo o arquivo e o histórico, e o pedido MUST continuar aguardando autorização.

#### Scenario: Foto ilegível

- **WHEN** o supervisor recusa uma foto ilegível com justificativa
- **THEN** o arquivo fica marcado como recusado e um novo arquivo pode ser recebido

### Requirement: Decisão separada da conferência

A aprovação MUST continuar sendo um ato próprio de supervisor, exigindo autorização conferida na revisão atual, responsável ainda elegível e arquivos íntegros.

#### Scenario: Aprovação após conferência

- **GIVEN** uma autorização conferida na revisão atual
- **WHEN** o supervisor aprova o pedido
- **THEN** o pedido passa a aprovado

#### Scenario: Arquivo alterado no armazenamento

- **GIVEN** uma autorização conferida cujo arquivo foi alterado em disco
- **WHEN** o supervisor aprova o pedido
- **THEN** o sistema recusa com `document_unavailable`

### Requirement: Anexo manual

Um supervisor SHALL poder anexar um arquivo recebido por outro meio a um pedido aberto, com o gateway ligado ou desligado, passando pela mesma conferência e registrando a origem como manual.

#### Scenario: WhatsApp fora do ar

- **GIVEN** um gateway desligado
- **WHEN** o supervisor anexa a foto de um documento entregue em mãos
- **THEN** o arquivo aparece como candidato de origem manual e pode ser conferido

#### Scenario: Responsável corrigido com o gateway desligado

- **GIVEN** um pedido cujo responsável teve o cadastro alterado depois do documento
- **WHEN** o supervisor anexa ou liga um arquivo
- **THEN** o sistema cria uma revisão nova com os dados atuais, registra `GUARDIAN_CHANGED` e aceita o arquivo nessa revisão

#### Scenario: Tipo não permitido

- **WHEN** o supervisor anexa um arquivo executável
- **THEN** o sistema recusa o arquivo

### Requirement: Alerta de entrega não confirmada

O detalhe do pedido SHALL avisar o supervisor quando o documento não tiver confirmação de entrega em 15 minutos, ou quando o WhatsApp estiver indisponível, indicando o uso de outro canal.

#### Scenario: Sem confirmação

- **GIVEN** um documento enviado há 20 minutos sem confirmação de entrega
- **WHEN** o supervisor abre o pedido
- **THEN** a tela avisa e oferece o anexo manual

### Requirement: Linguagem honesta sobre a evidência

Telas e documentos MUST descrever o resultado como autorização conferida por servidor, e MUST NOT afirmar assinatura válida, validade jurídica garantida ou assinatura eletrônica.

#### Scenario: Pedido conferido

- **WHEN** o supervisor abre um pedido com autorização conferida
- **THEN** a tela mostra o nome de quem conferiu e quando, sem identificador técnico, com o texto de autorização conferida

#### Scenario: Residente acompanha o próprio pedido

- **WHEN** o residente consulta um pedido já conferido
- **THEN** a resposta não traz o nome de quem conferiu nem de quem decidiu

### Requirement: Fim dos provedores externos e do convite público

O sistema MUST NOT depender de provedor externo de assinatura, e as rotas públicas de convite SHALL deixar de existir.

#### Scenario: Link de convite antigo

- **WHEN** alguém abre um endereço antigo de convite
- **THEN** o sistema mostra a página de não encontrado

### Requirement: Telefone do responsável normalizado

O cadastro de responsável SHALL gravar telefones brasileiros no formato canônico, aceitando digitação com ou sem código do país e pontuação.

#### Scenario: Telefone digitado com máscara

- **WHEN** o usuário cadastra (62) 91234-5678
- **THEN** o telefone é gravado como +5562912345678 e o responsável fica elegível

### Requirement: Rejeição antes da conferência

O supervisor SHALL poder rejeitar uma saída longa pendente antes da conferência da autorização, com justificativa de 10 a 2.000 caracteres, no acesso por conta e na demonstração (RN05; UC07, fluxo alternativo). A aprovação MUST continuar indisponível até a autorização conferida.

#### Scenario: Demonstração antes da conferência

- **GIVEN** a demonstração com o perfil supervisor e uma saída longa sem autorização conferida
- **WHEN** o usuário abre o detalhe da saída
- **THEN** "Rejeitar" está disponível e "Aprovar" continua bloqueado
- **AND** a tela explica que a rejeição antes da conferência exige justificativa de 10 a 2.000 caracteres

#### Scenario: Motivo curto na demonstração

- **GIVEN** a demonstração com uma saída longa sem autorização conferida
- **WHEN** o supervisor confirma a rejeição com uma justificativa de 9 caracteres
- **THEN** a demonstração recusa e a saída continua pendente

#### Scenario: Rejeição válida na demonstração

- **GIVEN** a demonstração com uma saída longa sem autorização conferida
- **WHEN** o supervisor confirma a rejeição com uma justificativa de 10 caracteres
- **THEN** a saída passa a rejeitada e o histórico mostra o motivo

#### Scenario: Acesso por conta antes da conferência

- **GIVEN** uma saída longa pendente sem autorização conferida
- **WHEN** o supervisor a rejeita com justificativa válida
- **THEN** a saída passa a rejeitada
