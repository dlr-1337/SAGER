## MODIFIED Requirements

### Requirement: Partida física

Somente o supervisor SHALL registrar a partida de uma saída aprovada, num ato próprio, ao ver o residente sair, não antes da partida pedida nem da aprovação e antes do retorno previsto, e a saída passa a em andamento. Outra saída em andamento do mesmo residente MUST impedir a partida com 409 `physical_exit_conflict`, mas MUST NOT impedir a aprovação (RN06, RN07, RF014, UC17).

#### Scenario: Partida registrada

- **GIVEN** uma saída curta aprovada cuja partida pedida já chegou
- **WHEN** o supervisor registra a partida agora
- **THEN** a saída passa a em andamento

#### Scenario: Outra saída em andamento

- **GIVEN** um residente com uma saída longa em andamento
- **WHEN** o supervisor tenta registrar a partida de uma saída curta dele
- **THEN** o servidor responde 409 `physical_exit_conflict`

#### Scenario: Partida na aprovação da saída longa

- **GIVEN** uma saída longa aguardando análise, com partida imediata e autorização conferida na revisão atual
- **WHEN** o supervisor a aprova
- **THEN** a saída passa a aprovada, sem partida registrada
- **AND** só o registro de saída feito depois pelo supervisor a deixa em andamento, com a partida no instante desse registro e em nome dele

#### Scenario: Aprovação imediata com outra saída em andamento

- **GIVEN** um residente com uma saída longa em andamento
- **WHEN** o supervisor aprova uma saída curta dele com partida imediata
- **THEN** a saída curta passa a aprovada
- **AND** o registro da saída dela responde 409 `physical_exit_conflict` até a volta da outra, e a tela diz para confirmar a volta da outra saída primeiro

#### Scenario: Saída agendada antes da hora

- **GIVEN** uma saída curta aprovada com partida agendada para 14h
- **WHEN** o supervisor abre o detalhe dela às 13h
- **THEN** a tela mostra "Saída marcada para" com a data e a hora, oferece cancelar e não mostra "Registrar saída"

#### Scenario: Saída agendada na hora

- **GIVEN** uma saída curta aprovada com partida agendada para 14h
- **WHEN** o supervisor abre o detalhe dela às 14h
- **THEN** a tela mostra "Registrar saída"

#### Scenario: Horário anterior à aprovação

- **GIVEN** uma saída curta pedida para 14h e aprovada às 14h20
- **WHEN** o supervisor registra a saída com o horário anterior 14h10 e uma justificativa
- **THEN** o diálogo recusa antes de enviar, com "A partida não pode ser anterior à saída solicitada nem à aprovação."
- **AND** o diálogo continua aberto com a justificativa digitada
