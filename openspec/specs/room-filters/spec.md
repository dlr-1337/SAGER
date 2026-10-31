# room-filters Specification

## Purpose
Permitir que supervisores e gestores cheguem direto a um quarto nas telas operacionais, com opções sempre coerentes com o alojamento e o bloco escolhidos.

## Requirements

### Requirement: Filtro de quarto na chamada noturna

A chamada noturna SHALL permitir filtrar a lista por casa ou bloco e por quarto, oferecendo somente quartos com residente na chamada aberta, e MUST NOT alterar o resumo nem a regra de fechamento da chamada.

#### Scenario: Filtrar por quarto

- **GIVEN** uma chamada com residentes em vários quartos
- **WHEN** o supervisor escolhe um quarto
- **THEN** a lista mostra só os residentes desse quarto e o contador indica o total filtrado da chamada

#### Scenario: Fechamento com filtro ativo

- **GIVEN** um filtro de quarto ativo em que todos os visíveis estão marcados, com pendências em outros quartos
- **WHEN** o supervisor consulta a ação de fechamento
- **THEN** a chamada continua sem poder ser fechada

### Requirement: Quarto dependente do alojamento e do bloco

Toda seleção de quarto SHALL oferecer somente quartos do alojamento e do bloco escolhidos, e MUST limpar o quarto quando a seleção superior mudar ou quando o quarto lembrado não existir mais nas opções.

#### Scenario: Troca de alojamento

- **GIVEN** um quarto selecionado no alojamento A
- **WHEN** o usuário troca para o alojamento B
- **THEN** o quarto volta a "Todos" e só quartos do alojamento B aparecem

### Requirement: Identificação inequívoca do quarto

A seleção de quarto MUST identificar cada opção pelo código do quarto, porque o número pode se repetir dentro de um alojamento.

#### Scenario: Mesmo número em blocos diferentes

- **GIVEN** dois quartos de número 101 em blocos diferentes
- **WHEN** o usuário abre a seleção de quarto
- **THEN** as opções são distinguíveis e cada uma filtra só o próprio quarto

### Requirement: Filtro de quarto nas saídas

A lista de saídas SHALL permitir ao supervisor filtrar por quarto, considerando a alocação do residente na data solicitada da saída, e MUST manter o residente limitado às próprias saídas.

#### Scenario: Saída de residente que mudou de quarto

- **GIVEN** um residente que estava no quarto X na data da saída e hoje está no quarto Y
- **WHEN** o supervisor filtra pelo quarto X
- **THEN** a saída aparece na lista

#### Scenario: Residente tenta filtrar por quarto

- **WHEN** um residente consulta as próprias saídas
- **THEN** o filtro de quarto não é oferecido e a resposta traz só as saídas dele

### Requirement: Filtro de alojamento na lista de limpeza

A lista de limpeza SHALL permitir filtrar por alojamento, e a seleção de quarto SHALL depender dele.

#### Scenario: Filtrar limpeza por alojamento

- **WHEN** o usuário escolhe um alojamento sem escolher quarto
- **THEN** a lista mostra só as avaliações desse alojamento

### Requirement: Dependência de quarto na demonstração

A demonstração SHALL oferecer em residentes e na chamada noturna somente quartos do bloco escolhido.

#### Scenario: Bloco escolhido na demonstração

- **WHEN** o usuário escolhe o bloco A em residentes
- **THEN** a seleção de quarto mostra somente quartos do bloco A
