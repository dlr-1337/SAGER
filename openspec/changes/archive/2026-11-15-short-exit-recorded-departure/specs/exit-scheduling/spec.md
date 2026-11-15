## ADDED Requirements

### Requirement: Saída curta sem horário de volta

No acesso por conta, o pedido de saída curta MUST NOT pedir horário de volta e SHALL dizer que a saída dura até 3 horas a partir da hora em que o supervisor registra a saída. Antes da partida registrada, a lista e o detalhe SHALL mostrar a volta como "até 3 h depois da saída"; depois dela, o horário de volta fixado. As telas próprias da demonstração (RF027) ficam como estão.

#### Scenario: Pedido novo

- **WHEN** o residente abre "Pedir saída curta"
- **THEN** a tela pergunta quando ele quer sair e por quê, sem campo de volta
- **AND** diz que a saída curta dura até 3 horas a partir da hora em que o supervisor registra a saída

#### Scenario: Volta antes da partida registrada

- **GIVEN** uma saída curta aprovada, sem partida registrada
- **WHEN** o residente abre a lista ou o detalhe dela
- **THEN** a volta aparece como "até 3 h depois da saída"

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Limites visíveis durante o preenchimento

**Reason**: Decisão da reunião de 14/11/2026: a saída curta não pede mais horário de volta, e o prazo conta da partida registrada. A duração e o máximo de 3 horas deixam de aparecer no formulário da saída curta.

**Migration**: A saída longa mantém os limites visíveis em "Limites visíveis da saída longa". A saída curta segue "Saída curta sem horário de volta", e o servidor fixa a volta em "Prazo da saída curta a partir da partida registrada" de `exit-requests`.
