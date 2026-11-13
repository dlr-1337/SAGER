## Purpose

Definir quem pode pedir saída curta ou longa (só o residente menor de idade) e o que o residente maior de idade vê no lugar das saídas, com a idade sempre contada na data civil de America/Sao_Paulo.

## ADDED Requirements

### Requirement: Conta informa a maioridade

A resposta da conta conectada SHALL informar `maiorDeIdade` verdadeiro somente quando a conta estiver vinculada a um residente com data de nascimento e 18 anos completos na data civil de America/Sao_Paulo. Conta de servidor, residente sem data de nascimento e residente menor de idade MUST receber falso.

#### Scenario: Aniversário de 18 anos

- **GIVEN** um residente vinculado nascido em 30/09/2008
- **WHEN** ele consulta a própria conta às 22h de 30/09/2026 em Brasília (já 01/10 em UTC)
- **THEN** a resposta traz `maiorDeIdade` verdadeiro

#### Scenario: Véspera do aniversário de 18 anos

- **GIVEN** um residente vinculado nascido em 01/10/2008
- **WHEN** ele consulta a própria conta às 22h de 30/09/2026 em Brasília (já 01/10 em UTC)
- **THEN** a resposta traz `maiorDeIdade` falso

#### Scenario: Residente sem data de nascimento

- **WHEN** um residente vinculado sem data de nascimento consulta a própria conta
- **THEN** a resposta traz `maiorDeIdade` falso

#### Scenario: Servidor

- **WHEN** um supervisor ou um gestor consulta a própria conta
- **THEN** a resposta traz `maiorDeIdade` falso

### Requirement: Servidor recusa saída de quem não é menor de idade

O servidor MUST recusar o pedido de saída curta ou longa de residente que não seja menor de idade na data civil de America/Sao_Paulo com HTTP 409 `not_eligible`, e a consulta de elegibilidade SHALL devolver `eligible` falso com o bloqueio `not_minor`. Sem data de nascimento, o bloqueio SHALL ser `birth_date_required`.

#### Scenario: Saída curta no aniversário de 18 anos

- **GIVEN** um residente alocado nascido em 30/09/2008
- **WHEN** ele pede uma saída curta às 22h de 30/09/2026 em Brasília
- **THEN** o servidor responde 409 `not_eligible` e nada é gravado

#### Scenario: Saída longa de residente adulto

- **GIVEN** um residente alocado nascido em 30/09/2008
- **WHEN** ele consulta a elegibilidade da saída longa e depois pede uma saída longa às 22h de 30/09/2026 em Brasília
- **THEN** a elegibilidade traz `eligible` falso com `not_minor`
- **AND** o pedido recebe 409 `not_eligible` e nada é gravado

#### Scenario: Véspera do aniversário de 18 anos

- **GIVEN** um residente alocado nascido em 01/10/2008
- **WHEN** ele consulta a elegibilidade da saída curta e da saída longa às 22h de 30/09/2026 em Brasília (já 01/10 em UTC)
- **THEN** as duas consultas trazem `eligible` verdadeiro

### Requirement: Adulto não recebe atalhos para saídas

Para o residente maior de idade, o menu, a página de início e a ajuda MUST NOT mostrar "Minhas saídas" nem qualquer link para as telas de saída. O residente menor de idade e o residente sem data de nascimento SHALL continuar vendo esses atalhos.

#### Scenario: Menu e início do adulto

- **WHEN** um residente maior de idade entra no sistema
- **THEN** o menu e a página de início não mostram "Minhas saídas"

#### Scenario: Ajuda do adulto

- **WHEN** um residente maior de idade abre a ajuda
- **THEN** a página não mostra o guia "Acompanhar saídas" nem link para as saídas

#### Scenario: Residente menor de idade

- **WHEN** um residente menor de idade entra no sistema
- **THEN** o menu e a página de início mostram "Minhas saídas"

#### Scenario: Residente sem data de nascimento

- **WHEN** um residente sem data de nascimento entra no sistema
- **THEN** o menu e a página de início mostram "Minhas saídas"

### Requirement: URL de saída leva o adulto ao acesso negado

Quando o residente maior de idade abrir qualquer endereço de saída (lista, detalhe, pedido novo ou edição, curta ou longa), o sistema SHALL levá-lo à página de acesso negado sem mostrar dados de saída. O supervisor e o residente menor de idade MUST continuar abrindo esses endereços como antes.

#### Scenario: Adulto digita o endereço do pedido

- **WHEN** um residente maior de idade abre `/saidas/nova` ou `/saidas/longas/nova`
- **THEN** o sistema mostra a página de acesso negado e não envia pedido ao servidor

#### Scenario: Adulto abre a lista ou uma saída antiga

- **WHEN** um residente maior de idade abre `/saidas` ou o endereço de uma saída que pediu quando era menor
- **THEN** o sistema mostra a página de acesso negado

#### Scenario: Supervisor

- **WHEN** um supervisor abre `/saidas`
- **THEN** a lista de saídas abre normalmente

### Requirement: Aviso de horário para o adulto

A página de início do residente maior de idade SHALL mostrar o aviso "Maiores de idade podem sair do IF até 23h e devem voltar até 5h.", sem botão, formulário nem registro de saída ou volta. O residente menor de idade MUST NOT ver esse aviso.

#### Scenario: Início do adulto

- **WHEN** um residente maior de idade abre a página de início
- **THEN** ele vê o aviso de horário, sem botão nem link de saída

#### Scenario: Início do menor

- **WHEN** um residente menor de idade abre a página de início
- **THEN** ele não vê o aviso de horário dos maiores de idade
