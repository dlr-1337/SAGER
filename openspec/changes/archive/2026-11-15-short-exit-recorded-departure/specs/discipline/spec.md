## MODIFIED Requirements

### Requirement: Ocorrências automáticas

O sistema SHALL criar uma ocorrência e uma notificação interna pendente, uma única vez por origem e residente, quando uma chamada fechada tiver o residente como ausente sem saída autorizada, quando uma saída curta em andamento passar do retorno previsto sem volta confirmada, quando um retorno for confirmado com atraso e, para cada participante, quando a nota de limpeza ficar abaixo de 6,00 (RF004, RN11, UC10).

#### Scenario: Limpeza abaixo de 6,00

- **GIVEN** um quarto com dois participantes
- **WHEN** o supervisor registra uma avaliação com nota 5,75
- **THEN** cada participante recebe uma ocorrência de limpeza e uma notificação pendente

#### Scenario: Nota exatamente 6,00

- **WHEN** o supervisor registra uma avaliação com nota 6,00
- **THEN** nenhuma ocorrência é criada

#### Scenario: Chamada ainda aberta

- **GIVEN** um residente marcado como ausente numa chamada aberta
- **WHEN** ninguém fecha a chamada
- **THEN** nenhuma ocorrência de ausência é criada

#### Scenario: Saída curta passou do prazo sem volta

- **GIVEN** uma saída curta em andamento com retorno previsto às 17h
- **WHEN** passa das 17h sem volta confirmada e a rotina de 60 segundos roda
- **THEN** o residente recebe uma ocorrência de atraso no retorno e uma notificação pendente
- **AND** nenhuma advertência é registrada

#### Scenario: Volta confirmada depois da ocorrência

- **GIVEN** a ocorrência de atraso criada para uma saída curta ainda em andamento
- **WHEN** o supervisor confirma a volta às 17h30, com observação
- **THEN** a mesma ocorrência passa a guardar o retorno, sem outra ocorrência nem outra notificação
- **AND** a notificação não passa a exigir revisão

#### Scenario: Volta retroativa dentro do prazo

- **GIVEN** a ocorrência de atraso criada para uma saída curta ainda em andamento com retorno previsto às 17h
- **WHEN** o supervisor registra a volta com horário retroativo às 16h50, com justificativa
- **THEN** a ocorrência fica inválida e a notificação passa a exigir revisão

#### Scenario: Saída curta dentro do prazo

- **GIVEN** uma saída curta em andamento com retorno previsto às 17h
- **WHEN** a rotina roda às 16h59
- **THEN** nenhuma ocorrência é criada
