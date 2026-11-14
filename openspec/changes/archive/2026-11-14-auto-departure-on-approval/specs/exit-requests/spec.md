## MODIFIED Requirements

### Requirement: Decisão do supervisor

Somente o supervisor SHALL aprovar ou rejeitar um pedido aguardando análise, registrando data, hora e autor da decisão. A rejeição MUST trazer motivo de 10 a 2.000 caracteres, ou o servidor recusa com 400 sem decidir. Aprovar um pedido cuja partida pedida já chegou SHALL também registrar a partida, como define "Partida física" (RF008, RN05, UC07).

#### Scenario: Rejeição com motivo curto

- **WHEN** o supervisor rejeita uma saída curta com motivo de 9 caracteres
- **THEN** o servidor responde 400 e a saída continua aguardando análise

#### Scenario: Aprovação de saída curta

- **GIVEN** uma saída curta aguardando análise com partida agendada para daqui a 2 horas
- **WHEN** o supervisor a aprova
- **THEN** a saída passa a aprovada e o residente vê a nova situação

#### Scenario: Aprovação de saída curta para sair agora

- **GIVEN** uma saída curta aguardando análise com partida imediata
- **WHEN** o supervisor abre o diálogo de aprovação
- **THEN** o diálogo diz "Aprovar e registrar a saída agora"
- **AND** ao confirmar, a saída passa a em andamento, com a partida no instante da aprovação
- **AND** o histórico mostra a decisão e a partida, as duas com o supervisor como autor

### Requirement: Partida física

Somente o supervisor SHALL registrar a partida de uma saída aprovada, não antes da partida pedida nem da aprovação e antes do retorno previsto, e a saída passa a em andamento. Aprovar um pedido cuja partida pedida já chegou SHALL registrar a partida no mesmo ato, no instante da aprovação e em nome do supervisor que aprovou. Outra saída em andamento do mesmo residente MUST impedir a partida, e essa aprovação, com 409 `physical_exit_conflict` (RN06, RN07, RF014, UC17).

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
- **THEN** a saída passa a em andamento, com a partida no instante da aprovação
- **AND** o histórico mostra a decisão e a partida, as duas com o supervisor como autor

#### Scenario: Aprovação imediata com outra saída em andamento

- **GIVEN** um residente com uma saída longa em andamento
- **WHEN** o supervisor tenta aprovar uma saída curta dele com partida imediata
- **THEN** o servidor responde 409 `physical_exit_conflict` e a saída curta continua aguardando análise
- **AND** a tela diz para confirmar a volta da outra saída primeiro

#### Scenario: Saída agendada antes da hora

- **GIVEN** uma saída curta aprovada com partida agendada para 14h
- **WHEN** o supervisor abre o detalhe dela às 13h
- **THEN** a tela mostra "Saída marcada para" com a data e a hora, oferece cancelar e não mostra "Registrar saída"

#### Scenario: Saída agendada na hora

- **GIVEN** uma saída curta aprovada com partida agendada para 14h
- **WHEN** o supervisor abre o detalhe dela às 14h
- **THEN** a tela mostra "Registrar saída"
