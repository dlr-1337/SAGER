# registration-validation Specification

## Purpose
Impedir dados sem sentido nos cadastros, com mensagens simples no próprio campo, sem recusar nomes e matrículas reais nem travar registros antigos.

## Requirements

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

### Requirement: Ano de ingresso obrigatório

O ano de ingresso MUST ser obrigatório na criação e na edição de residente, no navegador e no servidor. O residente antigo sem ano SHALL continuar legível, e a edição dele MUST pedir o ano.

#### Scenario: Sem ano de ingresso

- **WHEN** o usuário salva o cadastro com o ano de ingresso vazio
- **THEN** o campo mostra "Informe o ano de ingresso." e o servidor também recusa

#### Scenario: Residente antigo sem ano

- **GIVEN** um residente antigo sem ano de ingresso
- **WHEN** o usuário abre os dados dele
- **THEN** a leitura funciona e a edição pede o ano

#### Scenario: Chamada direta à API sem ano

- **WHEN** uma requisição cria ou edita residente sem ano de ingresso diretamente no servidor
- **THEN** o servidor recusa

### Requirement: Ano de ingresso sugerido pela matrícula

Quando o ano de ingresso estiver vazio, ou ainda com o valor que o próprio formulário sugeriu, o formulário de residente SHALL preenchê-lo com os 4 primeiros dígitos da matrícula, ao digitar a matrícula e ao abrir um cadastro para edição, também na demonstração, e o usuário MUST poder trocar o valor antes de salvar.

#### Scenario: Matrícula digitada

- **GIVEN** o ano de ingresso vazio
- **WHEN** o usuário digita a matrícula 20251ABCD000123
- **THEN** o ano de ingresso fica 2025

#### Scenario: Ano já informado

- **GIVEN** o ano de ingresso 2024 já informado
- **WHEN** o usuário digita a matrícula 20251ABCD000123
- **THEN** o ano de ingresso continua 2024

#### Scenario: Matrícula corrigida

- **GIVEN** o ano de ingresso vazio e a matrícula digitada como 20151ABCD000123, que sugeriu 2015
- **WHEN** o usuário corrige a matrícula para 20251ABCD000123
- **THEN** o ano de ingresso fica 2025

#### Scenario: Cadastro antigo aberto para edição

- **GIVEN** um residente antigo sem ano de ingresso, com a matrícula 20241ABCD000123
- **WHEN** o usuário abre a edição dele
- **THEN** o ano de ingresso aparece preenchido com 2024 e pode ser trocado

#### Scenario: Cadastro na demonstração

- **GIVEN** a demonstração com o perfil gestor
- **WHEN** o visitante cadastra um residente com a matrícula 20261PAG0000001
- **THEN** o ano de ingresso fica 2026 e o cadastro é salvo

### Requirement: Nível e duração do curso

Curso novo ou com nome, nível ou duração alterados MUST ter nível, ensino médio ou superior, e duração de 1 a 6 anos, no navegador, inclusive na demonstração, e no servidor. O curso antigo sem esses dados SHALL continuar legível e MUST poder ser ativado ou desativado sem informá-los.

#### Scenario: Curso novo sem duração

- **WHEN** o usuário cadastra um curso sem duração, pela tela de cursos ou pelo "Novo curso" do cadastro de residente
- **THEN** o campo pede a duração e o servidor também recusa

#### Scenario: Curso antigo editado

- **GIVEN** um curso antigo sem nível nem duração
- **WHEN** o usuário altera o nome dele
- **THEN** a edição pede o nível e a duração

#### Scenario: Curso antigo desativado

- **GIVEN** um curso antigo sem nível nem duração
- **WHEN** o usuário desativa o curso
- **THEN** a desativação é aceita
