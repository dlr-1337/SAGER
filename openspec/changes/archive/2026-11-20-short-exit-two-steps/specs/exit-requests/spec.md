## MODIFIED Requirements

### Requirement: Tipo de saída pela duração

A saída curta SHALL durar até 3 horas contadas da partida registrada, e o pedido ou a edição de saída curta MUST NOT trazer retorno previsto: o servidor recusa o campo com 400, sem gravar. A saída longa SHALL ter retorno previsto em mais de 3 horas depois da partida pedida, e o servidor MUST recusar com 400, sem gravar, o pedido ou a edição de saída longa fora desse limite (RN01, RF007).

#### Scenario: Saída curta sem horário de volta

- **WHEN** o residente pede uma saída curta às 14h, sem retorno previsto
- **THEN** o pedido é criado com prazo às 17h

#### Scenario: Saída curta de 3 horas e 1 minuto

- **WHEN** um pedido de saída curta chega com retorno previsto 3 horas e 1 minuto depois da partida
- **THEN** o servidor responde 400 e nenhum pedido é criado, porque a saída curta não recebe retorno

#### Scenario: Saída longa de exatamente 3 horas

- **WHEN** o residente pede uma saída longa com retorno 3 horas depois da partida
- **THEN** o servidor responde 400 e nenhum pedido é criado

### Requirement: Pedido feito pelo próprio residente

Somente o residente SHALL pedir saída, sempre em nome próprio. A saída curta SHALL ser sempre para agora, com a partida pedida marcada pelo relógio do servidor, e o servidor MUST recusar com 400 a saída curta agendada ou com horário enviado. A saída longa SHALL ter partida imediata ou agendada para depois do horário atual. Na partida imediata, o servidor MUST ignorar o relógio do aparelho (RF007, UC06; reunião de 20/11/2026).

#### Scenario: Partida imediata

- **GIVEN** um formulário de saída curta aberto há 10 minutos
- **WHEN** o residente envia o pedido
- **THEN** a partida pedida gravada é o horário do servidor no envio

#### Scenario: Saída curta agendada

- **WHEN** um pedido de saída curta chega agendado para daqui a 2 horas
- **THEN** o servidor responde 400 e nenhum pedido é criado

#### Scenario: Partida agendada no passado

- **WHEN** o residente agenda a partida de uma saída longa para uma hora que já passou
- **THEN** o servidor responde 400 e nenhum pedido é criado

#### Scenario: Supervisor tenta pedir

- **WHEN** um supervisor tenta criar uma saída curta
- **THEN** o servidor responde 403

### Requirement: Saída exige residente elegível

O pedido, a edição, a aprovação e a partida de uma saída MUST ser recusados com 409 `not_eligible` quando o residente não tiver alocação ativa ou não for menor de idade na data civil de America/Sao_Paulo, como define `exit-eligibility`. O servidor SHALL conferir isso de novo em cada um desses passos, e a consulta de elegibilidade SHALL apontar `active_allocation_required` quando faltar a alocação (RN02).

#### Scenario: Residente sem quarto

- **GIVEN** um residente menor de idade cuja alocação foi encerrada
- **WHEN** ele pede uma saída curta
- **THEN** o servidor responde 409 `not_eligible` e nada é gravado

#### Scenario: Aprovação depois dos 18 anos

- **GIVEN** uma saída curta pedida aos 17 anos, aguardando análise
- **WHEN** o supervisor tenta registrar a saída dela depois do aniversário de 18 anos do residente
- **THEN** o servidor responde 409 `not_eligible` e a saída continua aguardando análise

### Requirement: Sem sobreposição de saídas

O pedido ou a edição de uma saída, curta ou longa, MUST receber 409 `overlapping_exit` quando a janela dela cruzar a de outra saída do mesmo residente aguardando análise, aprovada ou em andamento, inclusive em pedidos simultâneos. A saída curta em andamento ocupa até o retorno previsto fixado na partida, e o registro da partida MUST NOT ser recusado por sobreposição (RN07).

#### Scenario: Saída longa sobre saída curta aprovada

- **GIVEN** uma saída curta pedida às 14h, aguardando o registro da saída
- **WHEN** o mesmo residente pede uma saída longa das 15h às 20h
- **THEN** o servidor responde 409 `overlapping_exit`

#### Scenario: Partida tardia perto de outra saída

- **GIVEN** uma saída curta pedida às 14h e uma saída longa aprovada a partir das 17h30
- **WHEN** o supervisor registra a partida da saída curta às 15h
- **THEN** a partida é registrada com retorno previsto às 18h
- **AND** a partida da saída longa só é aceita depois do retorno confirmado da saída curta

### Requirement: Decisão do supervisor

Somente o supervisor SHALL decidir um pedido aguardando análise, registrando data, hora e autor da decisão. Na saída longa, ele aprova ou rejeita, e a aprovação MUST NOT registrar a partida. Na saída curta, a decisão só rejeita: a liberação é o próprio registro da saída, como define "Partida física", e o servidor MUST recusar com 400 a aprovação avulsa. A rejeição MUST trazer motivo de 10 a 2.000 caracteres (RF008, RN05, RN06, UC07).

#### Scenario: Rejeição com motivo curto

- **WHEN** o supervisor rejeita uma saída curta com motivo de 9 caracteres
- **THEN** o servidor responde 400 e a saída continua aguardando análise

#### Scenario: Aprovação de saída curta

- **GIVEN** uma saída curta aguardando análise
- **WHEN** chega ao servidor uma aprovação avulsa dela pela decisão
- **THEN** o servidor responde 400 com "Para liberar a saída curta, registre a saída." e a saída continua aguardando análise

#### Scenario: Aprovação de saída curta para sair agora

- **GIVEN** uma saída curta aguardando análise
- **WHEN** o supervisor abre o detalhe dela
- **THEN** a tela não oferece "Aprovar": oferece "Registrar saída" e "Rejeitar"

#### Scenario: Aprovação de saída longa

- **GIVEN** uma saída longa aguardando análise, com autorização conferida na revisão atual
- **WHEN** o supervisor a aprova
- **THEN** a saída passa a aprovada, sem partida registrada, e o residente vê a nova situação

### Requirement: Partida física

Somente o supervisor SHALL registrar a partida, num ato próprio, ao ver o residente sair. Na saída curta aguardando análise, esse registro libera e começa a saída no mesmo ato; na saída aprovada, a partida não vem antes da aprovação. A partida MUST NOT vir antes da partida pedida nem depois do prazo, e a saída passa a em andamento. Outra saída em andamento do mesmo residente MUST impedir a partida com 409 `physical_exit_conflict` (RN06, RN07, RF014, UC17).

#### Scenario: Partida registrada

- **GIVEN** uma saída curta pedida às 14h, aguardando análise
- **WHEN** o supervisor registra a saída às 14h30, com o residente na frente dele
- **THEN** a saída passa a em andamento, com partida às 14h30 e retorno previsto às 17h30
- **AND** o histórico mostra um único registro, "Saída registrada", feito pelo supervisor

#### Scenario: Outra saída em andamento

- **GIVEN** um residente com uma saída longa em andamento
- **WHEN** o supervisor tenta registrar a partida de uma saída curta dele
- **THEN** o servidor responde 409 `physical_exit_conflict` e a saída curta continua como estava

#### Scenario: Partida na aprovação da saída longa

- **GIVEN** uma saída longa aguardando análise, com partida imediata e autorização conferida na revisão atual
- **WHEN** o supervisor a aprova
- **THEN** a saída passa a aprovada, sem partida registrada
- **AND** só o registro de saída feito depois pelo supervisor a deixa em andamento, com a partida no instante desse registro e em nome dele

#### Scenario: Aprovação imediata com outra saída em andamento

- **GIVEN** um residente com uma saída longa em andamento e uma saída curta aguardando análise
- **WHEN** o supervisor registra a saída curta
- **THEN** o servidor responde 409 `physical_exit_conflict`, a saída curta continua aguardando análise e a tela diz para confirmar a volta da outra saída primeiro

#### Scenario: Saída agendada na hora

- **GIVEN** uma saída curta aprovada antes de 20/11/2026, com partida agendada para 14h
- **WHEN** o supervisor abre o detalhe dela às 14h
- **THEN** a tela mostra "Registrar saída"

#### Scenario: Saída agendada antes da hora

- **GIVEN** uma saída curta aprovada com partida agendada para 14h
- **WHEN** o supervisor abre o detalhe dela às 13h
- **THEN** a tela mostra "Saída marcada para" com a data e a hora, oferece cancelar e não mostra "Registrar saída"

#### Scenario: Horário anterior ao pedido

- **GIVEN** uma saída curta pedida às 14h, aguardando análise
- **WHEN** o supervisor registra a saída com o horário anterior 13h50 e uma justificativa
- **THEN** o diálogo recusa antes de enviar, com "A partida não pode ser anterior à saída solicitada nem à aprovação."
- **AND** o diálogo continua aberto com a justificativa digitada

#### Scenario: Horário anterior à aprovação

- **GIVEN** uma saída curta pedida para 14h e aprovada às 14h20, antes desta mudança
- **WHEN** o supervisor registra a saída com o horário anterior 14h10 e uma justificativa
- **THEN** o diálogo recusa antes de enviar, com "A partida não pode ser anterior à saída solicitada nem à aprovação."

### Requirement: Prazo da saída curta a partir da partida registrada

Ao registrar a partida de uma saída curta, agora ou com horário retroativo, o servidor SHALL fixar o retorno previsto em 3 horas depois do horário da partida registrada e guardar a mudança no histórico. Antes da partida, o retorno previsto SHALL ser a hora do pedido mais 3 horas e vale como prazo do pedido: depois dele, o pedido expira, e o residente faz outro (RN01, RN06, RN08).

#### Scenario: Partida registrada depois da pedida

- **GIVEN** uma saída curta pedida às 14h
- **WHEN** o supervisor registra a partida às 14h40
- **THEN** a saída passa a em andamento com retorno previsto às 17h40

#### Scenario: Aprovação de quem sai agora

- **GIVEN** uma saída curta pedida às 14h, que fica com prazo às 17h
- **WHEN** o supervisor registra a saída às 14h50, quando o residente se apresenta
- **THEN** a saída fica em andamento com partida às 14h50 e retorno previsto às 17h50

#### Scenario: Pedido sem registro da saída

- **GIVEN** uma saída curta pedida às 14h, sem saída registrada
- **WHEN** chega 17h e a rotina de expiração roda
- **THEN** a saída passa a expirada

#### Scenario: Partida retroativa

- **GIVEN** uma saída curta pedida às 14h, aguardando análise
- **WHEN** o supervisor registra às 15h uma partida retroativa às 14h10, com justificativa
- **THEN** o retorno previsto passa a 17h10

#### Scenario: Pedido aprovado sem partida

- **GIVEN** uma saída curta aprovada antes desta mudança, com partida pedida às 14h e sem partida registrada
- **WHEN** chega 17h e a rotina de expiração roda
- **THEN** a saída passa a expirada
