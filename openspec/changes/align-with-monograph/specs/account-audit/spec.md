# Spec Delta

## Purpose

Registrar na auditoria, na mesma transação e só com nomes de campos, as escritas em contas de acesso que não vêm de um cadastro já auditado: a recuperação de senha do residente e os comandos de contas do terminal (RN16, RN17, RF025).

## ADDED Requirements

### Requirement: Recuperação de senha auditada

A troca de senha pela recuperação do residente SHALL gravar, na mesma transação, um evento de atualização da conta com o próprio residente como autor, o identificador da requisição e só o nome do campo "password". O evento MUST NOT conter a senha nem o hash. Uma tentativa recusada MUST NOT gravar evento.

#### Scenario: Recuperação aceita

- **GIVEN** um residente com conta ativa e dados cadastrais conferidos
- **WHEN** ele redefine a senha pela recuperação
- **THEN** a auditoria tem um evento de atualização da conta, com autor igual à própria conta, perfil residente e campo alterado "password"

#### Scenario: Recuperação recusada

- **GIVEN** uma data de nascimento que não confere com o cadastro
- **WHEN** alguém tenta redefinir a senha
- **THEN** a resposta é a mesma recusa de hoje e nenhum evento de auditoria é gravado

### Requirement: Comandos de conta do terminal auditados

Cada comando de contas do terminal que grava (criar, trocar senha, desativar, vincular, desvincular e atribuir matrícula) SHALL gravar, na mesma transação, um evento de conta com a origem terminal do operador, sem autor de conta, e com os nomes dos campos alterados, nunca os valores.

#### Scenario: Operador cria a conta de gestor

- **WHEN** o operador cria uma conta de gestor pelo terminal
- **THEN** a auditoria tem um evento de criação da conta, com origem do terminal e sem autor

#### Scenario: Operador desativa uma conta

- **WHEN** o operador desativa uma conta ativa pelo terminal
- **THEN** a auditoria tem um evento de encerramento da conta com o campo "active"

#### Scenario: Comando de consulta

- **WHEN** o operador lista as contas pelo terminal
- **THEN** nenhum evento de auditoria é gravado

#### Scenario: Conta criada no cadastro assistido

- **WHEN** o gestor cadastra um residente com senha
- **THEN** a auditoria continua com o evento de criação do residente, como hoje, sem evento de conta pelo terminal

### Requirement: Consulta da auditoria inclui as contas

A consulta de auditoria da API SHALL listar e filtrar os eventos de conta para gestor e supervisor, como faz com os demais recursos, e MUST NOT expor senha, hash ou outro valor de campo.

#### Scenario: Filtro por recurso

- **GIVEN** um evento de recuperação de senha gravado
- **WHEN** um gestor consulta a auditoria filtrando pelo recurso de conta
- **THEN** o evento aparece com recurso, ação, origem, autor e nomes de campos, sem valores

### Requirement: Banco recusa evento de conta inválido

O banco MUST recusar um evento de conta com campo fora da lista permitida e um evento da origem terminal que tenha autor ou que seja de outro recurso. Os eventos gravados antes da mudança MUST continuar válidos e legíveis.

#### Scenario: Campo não permitido

- **WHEN** se tenta gravar um evento de conta com o campo "passwordHash"
- **THEN** o banco recusa a gravação

#### Scenario: Origem do terminal com autor

- **WHEN** se tenta gravar um evento da origem terminal com autor preenchido
- **THEN** o banco recusa a gravação

#### Scenario: Eventos antigos

- **GIVEN** um banco com eventos gravados antes da migração
- **WHEN** a migração é aplicada
- **THEN** a quantidade e o conteúdo dos eventos antigos não mudam
