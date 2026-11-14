## MODIFIED Requirements

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
