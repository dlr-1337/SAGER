# exit-scheduling Specification

## Purpose
Definir como os formulários de saída curta e longa sugerem, preservam e limitam os horários de partida e retorno, sem apagar o que o residente escolheu.

## Requirements

### Requirement: Sugestão do retorno enquanto não editado

O formulário da saída longa SHALL preencher o retorno previsto com partida + 4 h e SHALL atualizar essa sugestão quando a partida ou o modo mudar, enquanto o residente não tiver editado o retorno.

#### Scenario: Partida alterada sem edição do retorno

- **GIVEN** um formulário novo de saída longa com retorno ainda sugerido
- **WHEN** o residente agenda a partida para 14:00
- **THEN** o retorno previsto passa a 18:00

### Requirement: Preservação da edição manual válida

O formulário da saída longa MUST manter um retorno editado pelo residente, ou salvo em pedido existente, quando a partida ou o modo mudar e o valor continuar dentro do limite da saída longa.

#### Scenario: Ajuste de minuto na partida

- **GIVEN** uma partida às 14:00 e um retorno editado para 20:00
- **WHEN** o residente muda a partida para 14:10
- **THEN** o retorno continua em 20:00

#### Scenario: Pedido existente em edição

- **GIVEN** um pedido salvo com partida às 14:00 e retorno às 19:00
- **WHEN** o formulário carrega e o residente muda a partida para 15:00
- **THEN** o retorno continua em 19:00

### Requirement: Ajuste avisado de retorno fora do limite

Quando uma mudança na partida deixar fora do limite o retorno editado da saída longa, o formulário SHALL substituí-lo pela sugestão e SHALL anunciar o ajuste em região de status, informando o novo horário.

#### Scenario: Partida movida para depois do retorno

- **GIVEN** uma partida às 14:00 e um retorno editado para 20:00
- **WHEN** o residente muda a partida para 21:00
- **THEN** o retorno passa a 01:00 do dia seguinte
- **AND** a tela anuncia que o retorno foi ajustado porque o anterior ficou fora do limite

### Requirement: Horário atual derivado do servidor

O formulário MUST calcular o horário atual a partir do último horário informado pelo servidor somado ao tempo decorrido, sem depender do relógio do dispositivo.

#### Scenario: Alternância após tempo parado

- **GIVEN** um formulário carregado às 13:00 no modo "Agora"
- **WHEN** o residente alterna para "Agendar" e volta para "Agora" às 13:50
- **THEN** a sugestão de retorno parte de 13:50

### Requirement: Recalculo no envio apenas de retorno não editado

No modo "Agora", o formulário SHALL recalcular no envio o retorno não editado a partir do horário atualizado do servidor, e MUST NOT alterar um retorno editado pelo residente.

#### Scenario: Formulário parado antes do envio

- **GIVEN** um formulário de saída longa no modo "Agora", aberto há duas horas, com retorno sugerido
- **WHEN** o residente envia a solicitação
- **THEN** o pedido é enviado com retorno 4 h depois do horário atual do servidor

#### Scenario: Retorno manual parado

- **GIVEN** um retorno editado no modo "Agora" que continua dentro do limite
- **WHEN** o residente envia a solicitação
- **THEN** o pedido é enviado com o retorno editado

### Requirement: Partida agendada não preenchida no passado

O formulário MUST NOT pré-preencher a partida agendada com horário que já passou. Ela SHALL começar vazia, exceto ao editar um pedido já agendado.

#### Scenario: Escolha de agendamento

- **WHEN** o residente escolhe "Agendar" em um formulário novo
- **THEN** a partida fica vazia e o campo pede data e hora

### Requirement: Conflito de sobreposição não trava o formulário

O formulário SHALL manter o envio disponível após recusa por sobreposição com outra saída, e SHALL bloquear o envio apenas em conflito de versão do pedido.

#### Scenario: Sobreposição recusada

- **WHEN** o servidor recusa o envio por sobreposição
- **THEN** a tela mostra o erro e o residente pode mudar o horário e reenviar

### Requirement: Paridade na demonstração

A demonstração MUST aplicar as mesmas regras de sugestão, preservação e limite, e MUST recusar saída longa de até 3 h.

#### Scenario: Saída longa curta demais na demonstração

- **WHEN** o usuário da demonstração envia saída longa com duração de 3 h
- **THEN** a demonstração recusa e indica o mínimo

### Requirement: Rejeição de saída curta com motivo

Ao rejeitar uma saída curta no acesso por conta, a tela SHALL exigir uma justificativa de 10 a 2.000 caracteres antes de enviar a decisão, como manda a RN05. A tela MUST NOT oferecer a aprovação avulsa da saída curta, liberada pelo registro da saída, e a aprovação da saída longa MUST continuar com comentário opcional.

#### Scenario: Rejeição sem motivo

- **GIVEN** um supervisor revisando a rejeição de uma saída curta
- **WHEN** ele confirma sem escrever a justificativa
- **THEN** a tela informa que a justificativa precisa ter de 10 a 2.000 caracteres e não envia a decisão

#### Scenario: Rejeição com motivo

- **WHEN** o supervisor confirma a rejeição com uma justificativa de 10 caracteres
- **THEN** a decisão é enviada com esse motivo e a saída passa a rejeitada

#### Scenario: Aprovação sem comentário

- **WHEN** o supervisor confirma a aprovação de uma saída longa sem comentário
- **THEN** a decisão é enviada e a saída passa a aprovada

#### Scenario: Sem botão de aprovar

- **WHEN** o supervisor abre uma saída curta aguardando análise
- **THEN** a tela não mostra "Aprovar"

### Requirement: Justificativas das saídas de até 2.000 caracteres

No acesso por conta, os campos de justificativa e de observação de atraso das saídas SHALL aceitar de 10 a 2.000 caracteres e informar esse limite na tela, o mesmo que o servidor aceita.

#### Scenario: Justificativa longa

- **WHEN** o supervisor registra um retorno retroativo com justificativa de 2.000 caracteres
- **THEN** a tela aceita e envia o registro

#### Scenario: Justificativa acima do limite

- **WHEN** o supervisor tenta escrever 2.001 caracteres na justificativa
- **THEN** a tela não aceita mais do que 2.000 caracteres

#### Scenario: Justificativa curta demais

- **WHEN** o supervisor confirma com uma justificativa de 9 caracteres
- **THEN** a tela informa o limite de 10 a 2.000 caracteres e não envia

### Requirement: Saída curta sem horário de volta

No acesso por conta, o pedido de saída curta MUST NOT pedir horário de saída nem de volta: ele é sempre para agora. A tela SHALL dizer que a saída dura até 3 horas a partir do registro da saída pelo supervisor. Antes desse registro, a lista e o detalhe SHALL mostrar a hora do pedido e a volta como "até 3 h depois da saída"; depois dele, a partida e a volta fixadas. As telas próprias da demonstração (RF027) ficam como estão.

#### Scenario: Pedido novo

- **WHEN** o residente abre "Pedir saída curta"
- **THEN** a tela pergunta só por que ele quer sair, sem campo de horário
- **AND** diz que a saída curta dura até 3 horas a partir da hora em que o supervisor registra a saída

#### Scenario: Volta antes da partida registrada

- **GIVEN** uma saída curta pedida às 14h, sem saída registrada
- **WHEN** o residente abre a lista ou o detalhe dela
- **THEN** ele vê "Pedido em" com 14h e a volta como "até 3 h depois da saída"

#### Scenario: Volta depois da partida registrada

- **GIVEN** uma saída curta com partida registrada às 14h40
- **WHEN** o residente abre o detalhe dela
- **THEN** a volta aparece às 17h40

### Requirement: Limites visíveis da saída longa

O formulário da saída longa SHALL indicar a duração resultante e o mínimo de mais de 3 horas enquanto o residente preenche, e SHALL restringir o seletor de data pelos limites do horário de Brasília.

#### Scenario: Duração da saída longa

- **WHEN** a partida é 14:00 e o retorno sugerido é 18:00
- **THEN** a tela mostra duração de 4 h
- **AND** o seletor de retorno não oferece horário antes das 17:01

#### Scenario: Retorno da saída longa fora do limite digitado

- **WHEN** o residente digita retorno com duração de exatamente 3 h
- **THEN** a tela indica o erro junto ao campo antes do envio
