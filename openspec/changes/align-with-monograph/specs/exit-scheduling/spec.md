# Spec Delta

## ADDED Requirements

### Requirement: Rejeição de saída curta com motivo

Ao rejeitar uma saída curta no acesso por conta, a tela SHALL exigir uma justificativa de 10 a 2.000 caracteres antes de enviar a decisão, como manda a RN05. A aprovação MUST continuar com comentário opcional.

#### Scenario: Rejeição sem motivo

- **GIVEN** um supervisor revisando a rejeição de uma saída curta
- **WHEN** ele confirma sem escrever a justificativa
- **THEN** a tela informa que a justificativa precisa ter de 10 a 2.000 caracteres e não envia a decisão

#### Scenario: Rejeição com motivo

- **WHEN** o supervisor confirma a rejeição com uma justificativa de 10 caracteres
- **THEN** a decisão é enviada com esse motivo e a saída passa a rejeitada

#### Scenario: Aprovação sem comentário

- **WHEN** o supervisor confirma a aprovação sem comentário
- **THEN** a decisão é enviada e a saída passa a aprovada

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
