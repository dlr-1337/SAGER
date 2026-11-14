# supervisor-accounts Specification

## Purpose
Permitir que o gestor crie o supervisor com acesso imediato, e reservar a gestão de supervisores ao gestor.

## Requirements

### Requirement: Gestão de supervisores só pelo gestor

Somente o gestor SHALL listar, ver, criar e editar supervisores, e o sistema MUST recusar com 403 o acesso de qualquer outro perfil, ocultando menu e rotas.

#### Scenario: Supervisor tenta listar

- **WHEN** um supervisor pede a lista de supervisores
- **THEN** o sistema recusa com 403

#### Scenario: Menu do supervisor

- **WHEN** um supervisor abre o sistema
- **THEN** o menu não mostra "Supervisores"

#### Scenario: Paridade nos demais cadastros

- **WHEN** um supervisor cria um residente
- **THEN** a criação continua permitida

### Requirement: Conta criada junto do cadastro

A criação de supervisor SHALL exigir senha e confirmação, e MUST criar o registro, a conta e o vínculo na mesma transação, de modo que uma falha não deixe nenhum deles.

#### Scenario: Acesso imediato

- **WHEN** o gestor cadastra um supervisor com senha
- **THEN** o supervisor entra em seguida com o usuário e a senha informados

#### Scenario: Matrícula já usada

- **WHEN** o gestor cadastra um supervisor com um usuário que outra conta já usa, como a matrícula de um residente
- **THEN** o sistema responde com conflito e nada é criado

#### Scenario: Senhas diferentes

- **WHEN** a confirmação difere da senha
- **THEN** o sistema recusa e nada é criado

#### Scenario: Campo do usuário

- **WHEN** o gestor abre o cadastro, a edição ou o detalhe de um supervisor
- **THEN** o identificador de login aparece como "Usuário", e não como matrícula

### Requirement: Edição sem senha

A edição de supervisor MUST NOT receber nem alterar senha.

#### Scenario: Editar nome

- **WHEN** o gestor edita o nome de um supervisor
- **THEN** a senha continua a mesma

### Requirement: Auditoria sem credencial

O sistema MUST auditar a criação sem gravar a senha, e MUST NOT devolver a senha em nenhuma resposta.

#### Scenario: Supervisor criado

- **WHEN** o gestor cria um supervisor
- **THEN** a auditoria registra o ato e a resposta não traz a senha
