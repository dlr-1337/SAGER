# password-policy Specification

## Purpose
Definir regras de senha fáceis para adolescentes e idosos, recusando só o óbvio, e permitir ver a senha digitada em todos os campos.

## Requirements

### Requirement: Política de senha simples

O sistema SHALL aceitar senhas com pelo menos 8 caracteres, e MUST NOT exigir maiúscula, número ou símbolo.

#### Scenario: Frase simples

- **WHEN** o usuário cria a senha "gato azul"
- **THEN** a senha é aceita

#### Scenario: Senha curta

- **WHEN** o usuário cria uma senha de 7 caracteres
- **THEN** a tela informa "A senha precisa ter pelo menos 8 letras ou números."

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

### Requirement: Ajuda indica a recuperação de senha de cada perfil

No acesso por conta, a pergunta frequente sobre senha SHALL orientar o residente a usar "Esqueci minha senha", com link para a recuperação, informando matrícula, nome completo, data de nascimento e, se houver, o nome do responsável. A mesma pergunta SHALL orientar gestor e supervisor a procurar o suporte da instituição (RF020, UC02). A pergunta da demonstração não muda.

#### Scenario: Residente consulta a ajuda

- **WHEN** um visitante sem sessão abre a ajuda e a pergunta sobre senha
- **THEN** a resposta orienta o residente a clicar em "Esqueci minha senha" e oferece o link para a recuperação
- **AND** não manda o residente ao suporte

#### Scenario: Gestor ou supervisor consulta a ajuda

- **WHEN** um gestor lê a mesma pergunta
- **THEN** a resposta diz que gestor e supervisor procuram o suporte da instituição, que confere a identidade e troca a senha

#### Scenario: Ajuda na demonstração

- **GIVEN** a demonstração ativa
- **WHEN** o usuário abre a ajuda
- **THEN** as perguntas frequentes da demonstração continuam as mesmas de hoje
