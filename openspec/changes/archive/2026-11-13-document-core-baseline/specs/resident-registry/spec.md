# Spec Delta

## Purpose

Manter o cadastro dos residentes, com a conta de acesso criada no mesmo ato, e o catálogo de cursos usado nesse cadastro.

## ADDED Requirements

### Requirement: Cadastro de residentes

Gestor e supervisor SHALL cadastrar, consultar e editar residentes com nome, matrícula, data de nascimento, curso e ano de ingresso, com os formatos e as obrigatoriedades de `registration-validation`, e cada edição MUST registrar na auditoria só os campos que mudaram (RF002, UC15).

#### Scenario: Cadastrar e consultar

- **WHEN** o gestor cadastra um residente com nome, matrícula, data de nascimento, curso, ano de ingresso e senha
- **THEN** o residente aparece na lista e no detalhe com esses dados

#### Scenario: Supervisor edita

- **GIVEN** um residente cadastrado pelo gestor
- **WHEN** o supervisor muda só a data de nascimento dele
- **THEN** a alteração é gravada e a auditoria lista só o campo `birthDate`

### Requirement: Conta criada junto do cadastro do residente

A criação de residente SHALL exigir senha e confirmação, e MUST criar o cadastro e a conta de residente vinculada, com a matrícula como login, na mesma transação. Matrícula já usada por outra conta MUST receber 409, e nenhuma falha MUST deixar cadastro sem conta ou conta sem cadastro (RF002; cap. 4, Restrições e Premissas).

#### Scenario: Acesso imediato

- **WHEN** o supervisor cadastra um residente com senha
- **THEN** o residente entra em seguida com a matrícula e a senha informadas

#### Scenario: Matrícula já usada

- **GIVEN** uma conta que já usa a matrícula informada
- **WHEN** o gestor tenta cadastrar o residente
- **THEN** o servidor responde 409 e nem o cadastro nem a conta são criados

#### Scenario: Senhas diferentes

- **WHEN** a confirmação difere da senha
- **THEN** o servidor recusa e nada é criado

### Requirement: Matrícula alterada acompanha o login

Ao mudar a matrícula de um residente, o sistema SHALL mudar o login da conta vinculada na mesma transação e MUST encerrar as sessões abertas dessa conta. Matrícula usada por outra conta MUST receber 409, sem mudar o cadastro nem a conta. Editar outros campos MUST NOT encerrar a sessão do residente (RF002).

#### Scenario: Matrícula corrigida

- **GIVEN** um residente conectado
- **WHEN** o gestor corrige a matrícula dele
- **THEN** a sessão aberta recebe 401 e o residente entra com a matrícula nova

#### Scenario: Matrícula de outra conta

- **WHEN** o supervisor muda a matrícula de um residente para uma já usada por outra conta
- **THEN** o servidor responde 409 e a matrícula e o login continuam os antigos

#### Scenario: Edição de outro campo

- **GIVEN** um residente conectado
- **WHEN** o gestor muda o curso dele
- **THEN** a sessão do residente continua válida

### Requirement: Nome do residente com iniciais maiúsculas

O servidor SHALL gravar o nome do residente com a inicial de cada palavra em maiúscula e as demais letras em minúscula, preservando acentos, hífens e apóstrofos. Na criação, a conta vinculada MUST receber o mesmo nome (cap. 5, tabela de migrações, V22; AGENTS.md).

#### Scenario: Nome digitado em maiúsculas

- **WHEN** o gestor cadastra o residente "JOÃO ANTÔNIO"
- **THEN** o nome é gravado como "João Antônio" no cadastro e na conta

#### Scenario: Nome composto

- **WHEN** o supervisor informa "ANA-MARIA D'ÁVILA"
- **THEN** o nome é gravado como "Ana-Maria D'Ávila"

### Requirement: Catálogo de cursos

Gestor e supervisor SHALL criar, renomear, ativar e desativar os cursos usados no cadastro de residente. Um nome já existente MUST receber 409, e um curso desativado MUST NOT ser aceito para residente que ainda não o tinha (RF018, UC20).

#### Scenario: Curso repetido

- **GIVEN** o curso "Técnico em Agropecuária"
- **WHEN** o supervisor cadastra outro curso com o mesmo nome
- **THEN** o servidor responde 409 e o catálogo não muda

#### Scenario: Curso desativado

- **GIVEN** um curso desativado
- **WHEN** o gestor tenta escolhê-lo para um residente novo
- **THEN** o servidor recusa e pede um curso ativo
