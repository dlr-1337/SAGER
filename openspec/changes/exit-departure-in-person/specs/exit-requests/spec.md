## MODIFIED Requirements

### Requirement: Decisão do supervisor

Somente o supervisor SHALL aprovar ou rejeitar um pedido aguardando análise, registrando data, hora e autor da decisão. A rejeição MUST trazer motivo de 10 a 2.000 caracteres, ou o servidor recusa com 400 sem decidir. A aprovação MUST NOT registrar a partida, mesmo quando a partida pedida já chegou: a saída fica aprovada até o supervisor registrar a partida, como define "Partida física" (RF008, RN05, RN06, UC07).

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
- **THEN** o diálogo diz que aprovar não registra a saída e que ela é registrada quando o residente se apresentar
- **AND** ao confirmar, a saída passa a aprovada, sem partida registrada, e o histórico mostra só a decisão
- **AND** o detalhe oferece "Registrar saída" ao supervisor

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

### Requirement: Prazo da saída curta a partir da partida registrada

Ao registrar a partida de uma saída curta, agora ou com horário retroativo, o servidor SHALL fixar o retorno previsto em 3 horas depois do horário da partida registrada e guardar a mudança no histórico. Antes da partida, o retorno previsto SHALL ser a partida pedida mais 3 horas e vale como prazo do pedido; a aprovação MUST NOT mudar esse prazo (RN01, RN06, RN08).

#### Scenario: Partida registrada depois da pedida

- **GIVEN** uma saída curta aprovada com partida pedida às 14h
- **WHEN** o supervisor registra a partida às 14h40
- **THEN** a saída passa a em andamento com retorno previsto às 17h40

#### Scenario: Aprovação de quem sai agora

- **GIVEN** uma saída curta pedida às 14h com partida imediata
- **WHEN** o supervisor a aprova às 14h20 e registra a saída às 14h50, quando o residente se apresenta
- **THEN** depois da aprovação, a saída continua com retorno previsto às 17h
- **AND** depois do registro, a saída fica em andamento com partida às 14h50 e retorno previsto às 17h50

#### Scenario: Partida retroativa

- **GIVEN** uma saída curta aprovada com partida pedida às 14h
- **WHEN** o supervisor registra às 15h uma partida retroativa às 14h10, com justificativa
- **THEN** o retorno previsto passa a 17h10

#### Scenario: Pedido aprovado sem partida

- **GIVEN** uma saída curta aprovada com partida pedida às 14h e sem partida registrada
- **WHEN** chega 17h e a rotina de expiração roda
- **THEN** a saída passa a expirada
