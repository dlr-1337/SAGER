## MODIFIED Requirements

### Requirement: Recusa de senhas óbvias

O sistema MUST recusar sequências, um único caractere repetido, senhas de uma lista curta de senhas comuns e o próprio usuário, que no residente é a matrícula, ignorando maiúsculas.

#### Scenario: Sequência

- **WHEN** o usuário cria a senha 12345678
- **THEN** a tela informa que a senha é fácil demais e pede outra

#### Scenario: Matrícula como senha

- **WHEN** o usuário cria uma senha igual à própria matrícula
- **THEN** a senha é recusada

#### Scenario: Usuário do supervisor como senha

- **WHEN** o gestor cadastra um supervisor com senha igual ao usuário dele
- **THEN** a tela informa "A senha não pode ser igual ao usuário."
