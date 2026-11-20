## ADDED Requirements

### Requirement: Saída atrasada à vista

A saída curta ou longa em andamento cujo retorno previsto já passou, pelo relógio do servidor, SHALL aparecer como "Atrasada", em vermelho, no lugar de "Em andamento", na lista, no detalhe e na legenda, para o supervisor e para o residente. A lista SHALL trazer as atrasadas primeiro, e o filtro de situação SHALL ter "Atrasada", com "Em andamento" só dentro do prazo. A situação gravada MUST NOT mudar e nenhuma advertência é criada sozinha.

#### Scenario: Saída curta vencida

- **GIVEN** uma saída curta com partida registrada às 14h e retorno previsto às 17h, sem volta registrada
- **WHEN** o supervisor abre a lista de saídas às 17h05
- **THEN** a saída aparece como "Atrasada", em vermelho
- **AND** o detalhe diz "A volta era até" com a data e as 17h

#### Scenario: Saída esquecida de ontem no topo

- **GIVEN** uma saída curta atrasada pedida ontem e dez pedidos feitos hoje
- **WHEN** o supervisor abre a lista de saídas
- **THEN** a saída atrasada aparece primeiro

#### Scenario: Filtro de atrasadas

- **GIVEN** uma saída curta em andamento dentro do prazo e outra atrasada
- **WHEN** o supervisor filtra a lista por "Atrasada"
- **THEN** só a atrasada aparece
- **AND** com o filtro "Em andamento", só a que está dentro do prazo aparece

#### Scenario: Residente atrasado

- **GIVEN** a saída do residente em andamento depois do retorno previsto
- **WHEN** ele abre a lista ou o detalhe das próprias saídas
- **THEN** a saída aparece como "Atrasada"

#### Scenario: Volta registrada

- **GIVEN** uma saída atrasada
- **WHEN** o supervisor registra a volta com observação
- **THEN** a saída passa a "Retorno confirmado com atraso" e deixa de aparecer como "Atrasada"
