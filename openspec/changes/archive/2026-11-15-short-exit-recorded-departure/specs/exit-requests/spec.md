## ADDED Requirements

### Requirement: Prazo da saída curta a partir da partida registrada

Ao registrar a partida de uma saída curta, pelo registro de saída, com horário retroativo ou na aprovação que registra a partida, o servidor SHALL fixar o retorno previsto em 3 horas depois do horário da partida registrada e guardar a mudança no histórico. Antes da partida, o retorno previsto SHALL ser a partida pedida mais 3 horas e vale como prazo do pedido (RN01, RN06, RN08).

#### Scenario: Partida registrada depois da pedida

- **GIVEN** uma saída curta aprovada com partida pedida às 14h
- **WHEN** o supervisor registra a partida às 14h40
- **THEN** a saída passa a em andamento com retorno previsto às 17h40

#### Scenario: Aprovação de quem sai agora

- **GIVEN** uma saída curta pedida às 14h com partida imediata
- **WHEN** o supervisor a aprova às 14h20
- **THEN** a saída passa a em andamento com partida às 14h20 e retorno previsto às 17h20

#### Scenario: Partida retroativa

- **GIVEN** uma saída curta aprovada com partida pedida às 14h
- **WHEN** o supervisor registra às 15h uma partida retroativa às 14h10, com justificativa
- **THEN** o retorno previsto passa a 17h10

#### Scenario: Pedido aprovado sem partida

- **GIVEN** uma saída curta aprovada com partida pedida às 14h e sem partida registrada
- **WHEN** chega 17h e a rotina de expiração roda
- **THEN** a saída passa a expirada

## MODIFIED Requirements

### Requirement: Tipo de saída pela duração

A saída curta SHALL durar até 3 horas contadas da partida registrada, e o pedido ou a edição de saída curta MUST NOT trazer retorno previsto: o servidor recusa o campo com 400, sem gravar. A saída longa SHALL ter retorno previsto em mais de 3 horas depois da partida pedida, e o servidor MUST recusar com 400, sem gravar, o pedido ou a edição de saída longa fora desse limite (RN01, RF007).

#### Scenario: Saída curta sem horário de volta

- **WHEN** o residente pede uma saída curta agendada para 14h, sem retorno previsto
- **THEN** o pedido é criado com retorno previsto às 17h

#### Scenario: Saída curta de 3 horas e 1 minuto

- **WHEN** um pedido de saída curta chega com retorno previsto 3 horas e 1 minuto depois da partida
- **THEN** o servidor responde 400 e nenhum pedido é criado, porque a saída curta não recebe retorno

#### Scenario: Saída longa de exatamente 3 horas

- **WHEN** o residente pede uma saída longa com retorno 3 horas depois da partida
- **THEN** o servidor responde 400 e nenhum pedido é criado

### Requirement: Sem sobreposição de saídas

O pedido ou a edição de uma saída, curta ou longa, MUST receber 409 `overlapping_exit` quando a janela dela cruzar a de outra saída do mesmo residente aguardando análise, aprovada ou em andamento, inclusive em pedidos simultâneos. A saída curta em andamento ocupa até o retorno previsto fixado na partida, e o registro da partida MUST NOT ser recusado por sobreposição (RN07).

#### Scenario: Saída longa sobre saída curta aprovada

- **GIVEN** uma saída curta aprovada das 14h às 17h
- **WHEN** o mesmo residente pede uma saída longa das 15h às 20h
- **THEN** o servidor responde 409 `overlapping_exit`

#### Scenario: Partida tardia perto de outra saída

- **GIVEN** uma saída curta aprovada com partida pedida às 14h e uma saída longa aprovada a partir das 17h30
- **WHEN** o supervisor registra a partida da saída curta às 15h
- **THEN** a partida é registrada com retorno previsto às 18h
- **AND** a partida da saída longa só é aceita depois do retorno confirmado da saída curta
