## ADDED Requirements

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
