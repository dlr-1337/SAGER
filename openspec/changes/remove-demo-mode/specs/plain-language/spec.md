# Spec Delta

## MODIFIED Requirements

### Requirement: Sem texto de ambiente de teste no uso real

Em produção, as telas MUST NOT mencionar ambiente de teste, demonstração, dados fictícios, backend ou API.

#### Scenario: Cadastro em produção

- **WHEN** um gestor abre o cadastro de residente
- **THEN** a tela não fala em dados fictícios nem em backend

#### Scenario: Cabeçalho e rodapé em produção

- **WHEN** uma pessoa autenticada navega em produção
- **THEN** o cabeçalho, o menu e o rodapé não falam em demonstração nem em dados fictícios
