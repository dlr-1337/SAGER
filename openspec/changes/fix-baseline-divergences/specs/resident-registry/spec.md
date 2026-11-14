## MODIFIED Requirements

### Requirement: Nome do residente com iniciais maiúsculas

O servidor SHALL gravar o nome do residente com a inicial de cada palavra em maiúscula e as demais letras em minúscula, preservando acentos, hífens e apóstrofos. Na criação e em cada edição que mude o nome, a conta vinculada MUST receber o mesmo nome, na mesma transação, sem encerrar a sessão do residente (RF002; cap. 5, tabela de migrações, V22; AGENTS.md).

#### Scenario: Nome digitado em maiúsculas

- **WHEN** o gestor cadastra o residente "JOÃO ANTÔNIO"
- **THEN** o nome é gravado como "João Antônio" no cadastro e na conta

#### Scenario: Nome composto

- **WHEN** o supervisor informa "ANA-MARIA D'ÁVILA"
- **THEN** o nome é gravado como "Ana-Maria D'Ávila"

#### Scenario: Nome editado

- **GIVEN** um residente conectado
- **WHEN** o gestor muda o nome dele para "josé DA silva"
- **THEN** o cadastro e a conta passam a "José Da Silva", a sessão do residente continua válida e devolve o nome novo, e a auditoria da edição lista só o campo `name`

#### Scenario: Edição recusada

- **GIVEN** uma conta que já usa a matrícula informada
- **WHEN** o gestor muda o nome e a matrícula de um residente para essa matrícula
- **THEN** o servidor responde 409, e o nome continua o antigo no cadastro e na conta
