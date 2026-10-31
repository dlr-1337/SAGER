# Spec Delta

## Purpose

Definir regras de senha fáceis para adolescentes e idosos, recusando só o óbvio, e permitir ver a senha digitada em todos os campos.

## ADDED Requirements

### Requirement: Política de senha simples

O sistema SHALL aceitar senhas com pelo menos 8 caracteres, e MUST NOT exigir maiúscula, número ou símbolo.

#### Scenario: Frase simples

- **WHEN** o usuário cria a senha "gato azul"
- **THEN** a senha é aceita

#### Scenario: Senha curta

- **WHEN** o usuário cria uma senha de 7 caracteres
- **THEN** a tela informa "A senha precisa ter pelo menos 8 letras ou números."

### Requirement: Recusa de senhas óbvias

O sistema MUST recusar sequências, um único caractere repetido, senhas de uma lista curta de senhas comuns e a própria matrícula, ignorando maiúsculas.

#### Scenario: Sequência

- **WHEN** o usuário cria a senha 12345678
- **THEN** a tela informa que a senha é fácil demais e pede outra

#### Scenario: Matrícula como senha

- **WHEN** o usuário cria uma senha igual à própria matrícula
- **THEN** a senha é recusada

### Requirement: Limite técnico sem jargão

O sistema SHALL recusar senha acima de 72 bytes com uma mensagem que não cite bytes, e MUST NOT cortar em silêncio o texto digitado ou colado.

#### Scenario: Senha longa colada

- **WHEN** o usuário cola uma senha de 100 caracteres
- **THEN** o campo mantém o texto e a tela informa "Essa senha é longa demais. Use uma mais curta."

### Requirement: Mostrar e ocultar senha

Todo campo de senha SHALL ter um botão de mostrar e ocultar, com nome acessível e alvo de pelo menos 44 px, e a senha MUST voltar a ficar oculta ao enviar o formulário.

#### Scenario: Conferir a senha

- **WHEN** o usuário clica em "Mostrar senha" no login
- **THEN** a senha aparece em texto e o botão passa a "Ocultar senha"

#### Scenario: Envio do formulário

- **GIVEN** uma senha visível
- **WHEN** o usuário envia o formulário
- **THEN** o campo volta a ocultar a senha

### Requirement: Contas existentes preservadas

A mudança de política MUST NOT invalidar contas existentes.

#### Scenario: Conta antiga

- **GIVEN** uma conta criada com a política anterior
- **WHEN** o usuário entra com a senha atual
- **THEN** o login funciona normalmente
