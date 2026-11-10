# exit-scheduling Specification

## Purpose
Definir como os formulários de saída curta e longa sugerem, preservam e limitam os horários de partida e retorno, sem apagar o que o residente escolheu.

## Requirements

### Requirement: Sugestão do retorno enquanto não editado

O formulário SHALL preencher o retorno previsto com partida + 3 h na saída curta e partida + 4 h na saída longa, e SHALL atualizar essa sugestão quando a partida ou o modo mudar, enquanto o residente não tiver editado o retorno.

#### Scenario: Partida alterada sem edição do retorno

- **GIVEN** um formulário novo de saída curta com retorno ainda sugerido
- **WHEN** o residente agenda a partida para 14:00
- **THEN** o retorno previsto passa a 17:00

### Requirement: Preservação da edição manual válida

O formulário MUST manter um retorno editado pelo residente, ou salvo em pedido existente, quando a partida ou o modo mudar e o valor continuar dentro do limite do tipo de saída.

#### Scenario: Ajuste de minuto na partida

- **GIVEN** uma partida às 14:00 e um retorno editado para 15:30
- **WHEN** o residente muda a partida para 14:10
- **THEN** o retorno continua em 15:30

#### Scenario: Pedido existente em edição

- **GIVEN** um pedido salvo com retorno às 16:00
- **WHEN** o formulário carrega e o residente muda a partida sem sair do limite
- **THEN** o retorno continua em 16:00

### Requirement: Ajuste avisado de retorno fora do limite

Quando uma mudança na partida deixar o retorno editado fora do limite, o formulário SHALL substituí-lo pela sugestão e SHALL anunciar o ajuste em região de status, informando o novo horário.

#### Scenario: Partida movida para depois do retorno

- **GIVEN** um retorno editado para 15:30
- **WHEN** o residente muda a partida para 16:00 em saída curta
- **THEN** o retorno passa a 19:00
- **AND** a tela anuncia que o retorno foi ajustado porque o anterior ficou fora do limite

### Requirement: Limites visíveis durante o preenchimento

O formulário SHALL indicar a duração resultante e o limite do tipo de saída enquanto o residente preenche, e SHALL restringir o seletor de data pelos limites do horário de Brasília.

#### Scenario: Duração da saída curta

- **WHEN** a partida é 14:00 e o retorno é 16:30 em saída curta
- **THEN** a tela mostra duração de 2 h 30 min e o máximo de 3 h
- **AND** o seletor de retorno não oferece horário depois das 17:00

#### Scenario: Retorno fora do limite digitado

- **WHEN** o residente digita retorno com duração de 3 h 01 min em saída curta
- **THEN** a tela indica o erro junto ao campo antes do envio

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
