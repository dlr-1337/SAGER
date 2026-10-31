# Spec Delta

## Purpose

Impedir dados sem sentido nos cadastros, com mensagens simples no próprio campo, sem recusar nomes e matrículas reais nem travar registros antigos.

## ADDED Requirements

### Requirement: Nome completo

Os nomes de residente, responsável e supervisor MUST ter ao menos duas palavras significativas, só com letras, apóstrofo e hífen. Não contam de, da, do, das, dos, e, em qualquer caixa, nem palavra de uma letra, exceto Ó.

#### Scenario: Nome de uma palavra

- **WHEN** o usuário informa "Maria"
- **THEN** o campo mostra "Digite o nome completo, como no documento."

#### Scenario: Nomes reais

- **WHEN** o usuário informa "Ana Li", "Maria do Ó", "Ana D'Ávila" ou "Ana-Clara dos Santos"
- **THEN** o nome é aceito

#### Scenario: Só partícula e sobrenome

- **WHEN** o usuário informa "Da Silva", "Maria de" ou "Ana2 Silva"
- **THEN** o nome é recusado

### Requirement: Matrícula de residente

A matrícula nova ou alterada de residente MUST ter de 15 a 17 posições, começando por um ano não futuro, aceitando letras maiúsculas depois do ano e ignorando espaços, pontos e traços digitados.

#### Scenario: Formato do técnico integrado

- **WHEN** o usuário informa uma matrícula no padrão 20171ABCD000123
- **THEN** a matrícula é aceita

#### Scenario: Matrícula curta

- **WHEN** o usuário informa "123"
- **THEN** o campo mostra "Confira a matrícula no SUAP."

#### Scenario: Ano futuro

- **WHEN** o usuário informa uma matrícula iniciada por ano posterior ao atual
- **THEN** a matrícula é recusada

### Requirement: Identificação de supervisor

A identificação nova ou alterada de supervisor MUST ter de 4 a 20 letras, números ou hífen, preservando zeros à esquerda.

#### Scenario: SIAPE com zero à esquerda

- **WHEN** o gestor informa 0123456
- **THEN** o valor é gravado com o zero

#### Scenario: Caractere inválido

- **WHEN** o gestor informa um valor com arroba
- **THEN** o campo recusa com mensagem simples

### Requirement: E-mail institucional de residente

O e-mail de residente SHALL continuar opcional e, quando preenchido, MUST terminar em @estudante.ifgoiano.edu.br, gravado em minúsculas.

#### Scenario: Outro domínio

- **WHEN** o usuário informa um e-mail de outro provedor
- **THEN** o campo mostra "Use o e-mail institucional, que termina em @estudante.ifgoiano.edu.br."

#### Scenario: Sem e-mail

- **WHEN** o usuário deixa o campo vazio
- **THEN** o cadastro é aceito

### Requirement: Curso obrigatório

Curso MUST ser obrigatório na criação e na edição de residente, aceitando o curso inativo que já era dele.

#### Scenario: Sem curso

- **WHEN** o usuário salva sem escolher curso
- **THEN** o campo mostra "Escolha o curso." e o servidor também recusa

#### Scenario: Residente antigo sem curso

- **GIVEN** um residente antigo sem curso
- **WHEN** o usuário abre os dados dele
- **THEN** a leitura funciona e a edição pede o curso

### Requirement: Data de nascimento plausível

A data de nascimento MUST corresponder a uma idade de 10 a 100 anos, calculada em America/Sao_Paulo.

#### Scenario: Data impossível

- **WHEN** o usuário informa 1900 ou o dia de hoje
- **THEN** o campo mostra "Confira a data de nascimento."

### Requirement: Telefone do responsável

O telefone do responsável novo ou alterado MUST ser obrigatório e válido no Brasil, com DDD, aceitando máscara na digitação e exibido com máscara.

#### Scenario: Telefone válido

- **WHEN** o usuário digita (62) 91234-5678
- **THEN** o telefone é aceito

#### Scenario: Sem DDD

- **WHEN** o usuário digita 91234-5678
- **THEN** o campo mostra "Digite o telefone com DDD."

### Requirement: Registros antigos não travam

A validação de formato MUST valer só para valor novo ou alterado, de modo que editar outro campo não exija corrigir dado antigo.

#### Scenario: Matrícula antiga fora do formato

- **GIVEN** um residente antigo com matrícula fora da faixa
- **WHEN** o usuário altera apenas o quarto ou o nome de outro campo
- **THEN** a edição é aceita

#### Scenario: Login não muda

- **GIVEN** uma conta com identificação fora da faixa
- **WHEN** a pessoa entra no sistema
- **THEN** o login funciona

#### Scenario: Matrícula digitada com pontuação

- **GIVEN** uma conta com matrícula sem pontuação
- **WHEN** a pessoa digita a matrícula com pontos ou traços no login ou na recuperação
- **THEN** a conta é encontrada, e a senha não pode ser igual à matrícula normalizada

### Requirement: Campos de texto e números coerentes

Textos só com espaços MUST ser recusados no próprio campo, o vínculo do responsável MUST conter letras, e a capacidade do quarto MUST ficar entre 1 e 20.

#### Scenario: Motivo com espaços

- **WHEN** o residente envia motivo com apenas espaços
- **THEN** o campo pede o motivo

#### Scenario: Capacidade absurda

- **WHEN** o usuário informa capacidade 500
- **THEN** o campo recusa

### Requirement: Mesma regra nos dois lados

As regras de formato MUST valer no navegador e no servidor, e formulários de terceiros MUST NOT oferecer preenchimento automático com os dados de quem está operando.

#### Scenario: Chamada direta à API

- **WHEN** uma requisição envia nome de uma palavra diretamente ao servidor
- **THEN** o servidor recusa
