# Spec Delta

## Purpose

Definir o ciclo das saídas curtas e longas pedidas pelo residente: pedido, edição, cancelamento, decisão do supervisor, partida e retorno físicos e expiração automática, sempre pelo relógio do servidor.

## ADDED Requirements

### Requirement: Tipo de saída pela duração

A saída curta SHALL ter retorno previsto depois da partida e em até 3 horas, e a saída longa, em mais de 3 horas. O servidor MUST recusar com 400, sem gravar, o pedido ou a edição fora do limite do tipo escolhido (RN01, RF007).

#### Scenario: Saída curta de 3 horas e 1 minuto

- **WHEN** o residente pede uma saída curta com retorno 3 horas e 1 minuto depois da partida
- **THEN** o servidor responde 400 e nenhum pedido é criado

#### Scenario: Saída longa de exatamente 3 horas

- **WHEN** o residente pede uma saída longa com retorno 3 horas depois da partida
- **THEN** o servidor responde 400 e nenhum pedido é criado

### Requirement: Pedido feito pelo próprio residente

Somente o residente SHALL pedir saída, sempre em nome próprio, com partida imediata, marcada pelo relógio do servidor, ou agendada para depois do horário atual. Na partida imediata, o servidor MUST ignorar o relógio do aparelho (RF007, UC06; cap. 4, Restrições e Premissas).

#### Scenario: Partida imediata

- **GIVEN** um formulário de saída curta aberto há 10 minutos
- **WHEN** o residente envia com partida imediata
- **THEN** a partida gravada é o horário do servidor no envio

#### Scenario: Partida agendada no passado

- **WHEN** o residente agenda a partida para uma hora que já passou
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
- **WHEN** o supervisor tenta aprová-la depois do aniversário de 18 anos do residente
- **THEN** o servidor responde 409 `not_eligible` e a saída continua aguardando análise

### Requirement: Sem sobreposição de saídas

Um residente MUST NOT ter saídas, curtas ou longas, com janelas sobrepostas entre os pedidos aguardando análise, aprovados ou em andamento. O pedido ou a edição que causaria sobreposição MUST receber 409 `overlapping_exit`, inclusive em pedidos simultâneos (RN07).

#### Scenario: Saída longa sobre saída curta aprovada

- **GIVEN** uma saída curta aprovada das 14h às 16h
- **WHEN** o mesmo residente pede uma saída longa das 15h às 20h
- **THEN** o servidor responde 409 `overlapping_exit`

### Requirement: Edição e cancelamento

O residente menor de idade SHALL editar ou cancelar o próprio pedido enquanto ele aguarda análise, e o supervisor SHALL cancelar pedido aguardando análise ou aprovado. Todo cancelamento MUST trazer justificativa de 10 a 2.000 caracteres, e pedido em outra situação MUST receber 409 `invalid_state` (RF007; cap. 4, tabela de permissões).

#### Scenario: Residente cancela pedido pendente

- **GIVEN** uma saída curta aguardando análise
- **WHEN** o residente a cancela com justificativa
- **THEN** a saída passa a cancelada

#### Scenario: Residente tenta cancelar saída aprovada

- **GIVEN** uma saída curta aprovada
- **WHEN** o residente tenta cancelá-la
- **THEN** o servidor responde 409 `invalid_state`

### Requirement: Decisão do supervisor

Somente o supervisor SHALL aprovar ou rejeitar um pedido aguardando análise, registrando data, hora e autor da decisão. A rejeição MUST trazer motivo de 10 a 2.000 caracteres, ou o servidor recusa com 400 sem decidir (RF008, RN05, UC07).

#### Scenario: Rejeição com motivo curto

- **WHEN** o supervisor rejeita uma saída curta com motivo de 9 caracteres
- **THEN** o servidor responde 400 e a saída continua aguardando análise

#### Scenario: Aprovação de saída curta

- **WHEN** o supervisor aprova uma saída curta aguardando análise
- **THEN** a saída passa a aprovada e o residente vê a nova situação

### Requirement: Partida física

Somente o supervisor SHALL registrar a partida de uma saída aprovada, não antes da partida pedida nem da aprovação e antes do retorno previsto, e a saída passa a em andamento. Outra saída em andamento do mesmo residente MUST impedir a partida com 409 `physical_exit_conflict` (RN06, RN07, RF014, UC17).

#### Scenario: Partida registrada

- **GIVEN** uma saída curta aprovada cuja partida pedida já chegou
- **WHEN** o supervisor registra a partida agora
- **THEN** a saída passa a em andamento

#### Scenario: Outra saída em andamento

- **GIVEN** um residente com uma saída longa em andamento
- **WHEN** o supervisor tenta registrar a partida de uma saída curta dele
- **THEN** o servidor responde 409 `physical_exit_conflict`

### Requirement: Retorno físico confirmado pelo supervisor

Somente o supervisor SHALL confirmar o retorno de uma saída em andamento, depois da partida física, e o residente MUST NOT confirmar o próprio retorno. Retorno depois do previsto MUST exigir observação de 10 a 2.000 caracteres e deixa a saída como retorno confirmado com atraso (RN06, RF014, UC17).

#### Scenario: Retorno no horário

- **WHEN** o supervisor confirma o retorno antes do horário previsto
- **THEN** a saída passa a retorno confirmado

#### Scenario: Retorno atrasado sem observação

- **WHEN** o supervisor confirma um retorno depois do horário previsto sem observação
- **THEN** o servidor responde 400 e a saída continua em andamento

#### Scenario: Residente tenta confirmar o retorno

- **WHEN** o residente tenta registrar o retorno da própria saída
- **THEN** o servidor responde 403

### Requirement: Expiração automática

A cada 60 segundos, o sistema SHALL expirar o pedido aguardando análise cuja partida agendada passou, ou cujo retorno previsto passou na partida imediata, e o pedido aprovado sem partida cujo retorno previsto passou, registrando a expiração como ato do sistema. Saída em andamento MUST NOT expirar (RN08, RF024, UC23).

#### Scenario: Aprovada sem partida

- **GIVEN** uma saída curta aprovada sem partida registrada
- **WHEN** o retorno previsto passa e a rotina roda
- **THEN** a saída passa a expirada, com a rotina do sistema como autora

#### Scenario: Em andamento depois do previsto

- **GIVEN** uma saída em andamento cujo retorno previsto já passou
- **WHEN** a rotina roda
- **THEN** a saída continua em andamento

### Requirement: Prazo vencido antes da rotina

Depois do prazo do pedido, decisão, edição, cancelamento e partida MUST ser recusados com 409 `deadline_passed`, mesmo que a rotina de expiração ainda não tenha rodado (RN08; UC07, exceção).

#### Scenario: Decisão no limite

- **GIVEN** um pedido aguardando análise cuja partida agendada acabou de passar
- **WHEN** o supervisor tenta aprová-lo antes da rotina de expiração
- **THEN** o servidor responde 409 `deadline_passed`

### Requirement: Histórico da saída

Cada pedido, edição, decisão, cancelamento, partida, retorno e expiração SHALL ficar no histórico da saída com data, hora e perfil de quem fez, e o residente SHALL ver a situação e a decisão do próprio pedido (RF007, RF008; UC07, pós-condições).

#### Scenario: Residente acompanha o pedido

- **GIVEN** uma saída curta rejeitada
- **WHEN** o residente abre o detalhe dela
- **THEN** ele vê a situação rejeitada, o motivo e o histórico do pedido
