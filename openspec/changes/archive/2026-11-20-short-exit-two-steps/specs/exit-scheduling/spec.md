## MODIFIED Requirements

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
