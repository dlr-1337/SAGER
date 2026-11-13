# course-progress Specification

## Purpose
Mostrar em que etapa do curso cada residente está e quando ele deve sair, marcar quem já concluiu e liberar sozinha a vaga no quarto de quem passou da saída prevista.

## Requirements

### Requirement: Semestre de ingresso pela matrícula

O semestre de ingresso MUST ser o 5º caractere da matrícula quando ele for 1 ou 2. Qualquer outro caractere MUST contar como 2º semestre, para que a saída prevista nunca fique antes da real.

#### Scenario: Matrícula do 1º semestre

- **GIVEN** um residente com matrícula 20261ABCD000123 e ano de ingresso 2026
- **WHEN** o sistema calcula a etapa e a saída prevista
- **THEN** o ingresso conta como 1º semestre de 2026

#### Scenario: Caractere fora do padrão

- **GIVEN** um residente com matrícula 20260ABCD000123 e ano de ingresso 2026
- **WHEN** o sistema calcula a etapa e a saída prevista
- **THEN** o ingresso conta como 2º semestre de 2026

### Requirement: Calculado pelo servidor

A etapa, a saída prevista e a situação de concluinte MUST ser calculadas pelo servidor, com a data civil de hoje no fuso America/Sao_Paulo pelo relógio do servidor, e SHALL vir na resposta da API de residentes, inclusive na lista dos moradores de um quarto. A data e o fuso do aparelho do usuário MUST NOT mudar o que aparece.

#### Scenario: Leitura pela API

- **GIVEN** um residente com ano de ingresso e curso com nível e duração
- **WHEN** um cliente autorizado lê o residente, ou a lista de residentes, pela API
- **THEN** a resposta traz a etapa, a saída prevista e se ele concluiu o curso

#### Scenario: Aparelho com a data errada

- **GIVEN** um residente com saída prevista em 30/06/2026, o servidor em 01/07/2026 no horário de Brasília e o computador do usuário com a data de 30/06/2026
- **WHEN** o usuário abre a ficha do residente
- **THEN** a ficha mostra "Concluinte"

#### Scenario: Fim do dia no horário de Brasília

- **GIVEN** um residente com saída prevista em 30/06/2026
- **WHEN** alguém abre a ficha às 23h30 de 30/06/2026 no horário de Brasília, já 01/07/2026 em UTC
- **THEN** a ficha mostra a etapa do curso, não "Concluinte"

### Requirement: Etapa do curso conforme o nível

A etapa do curso SHALL ser contada a partir do semestre de ingresso: em anos no ensino médio ("2º ano") e em períodos no superior ("3º período"). Antes do ingresso, a etapa SHALL mostrar o ano em que o residente ingressa.

#### Scenario: Superior no segundo ano

- **GIVEN** um residente do superior que ingressou no 1º semestre de 2025
- **WHEN** alguém vê a etapa em agosto de 2026
- **THEN** a etapa mostra "4º período"

#### Scenario: Ensino médio

- **GIVEN** um residente do ensino médio que ingressou no 1º semestre de 2025
- **WHEN** alguém vê a etapa em agosto de 2026
- **THEN** a etapa mostra "2º ano"

#### Scenario: Ingresso futuro

- **GIVEN** um residente com ano de ingresso posterior ao atual
- **WHEN** alguém vê a etapa
- **THEN** a etapa mostra "Ingressa em" seguido do ano

### Requirement: Saída prevista em data

A saída prevista MUST ser o último dia do último semestre do curso, 30/06 ou 31/12, contando o semestre de ingresso, a duração do curso e os semestres de prorrogação. Sem ano de ingresso ou sem duração do curso, não há saída prevista e a tela SHALL dizer que faltam dados.

#### Scenario: Ingresso no 1º semestre

- **GIVEN** um residente que ingressou no 1º semestre de 2026 num curso de 4 anos, sem prorrogação
- **WHEN** alguém abre a ficha dele
- **THEN** a saída prevista é 31/12/2029

#### Scenario: Ingresso no 2º semestre

- **GIVEN** um residente que ingressou no 2º semestre de 2026 num curso de 4 anos, sem prorrogação
- **WHEN** alguém abre a ficha dele
- **THEN** a saída prevista é 30/06/2030

#### Scenario: Sem duração do curso

- **GIVEN** um residente cujo curso não tem duração cadastrada
- **WHEN** alguém abre a ficha dele
- **THEN** a saída prevista mostra "Sem dados para calcular"

### Requirement: Prorrogação adia a saída

Cada semestre de prorrogação MUST adiar a saída prevista em um semestre, e com ela a situação de concluinte e o encerramento automático. A prorrogação lançada depois da saída prevista MUST fazer o residente deixar de ser concluinte.

#### Scenario: Um semestre de prorrogação

- **GIVEN** um residente com saída prevista em 31/12/2029
- **WHEN** o supervisor lança 1 semestre de prorrogação
- **THEN** a saída prevista passa a 30/06/2030

#### Scenario: Prorrogação lançada depois

- **GIVEN** um concluinte com saída prevista em 30/06/2026, em julho de 2026
- **WHEN** o supervisor lança 1 semestre de prorrogação
- **THEN** a saída prevista passa a 31/12/2026 e ele deixa de aparecer como concluinte

### Requirement: Situação de concluinte

O residente cuja data de hoje, pelo relógio do servidor em America/Sao_Paulo, passou da saída prevista SHALL aparecer como "Concluinte" na ficha, na lista de residentes e nos moradores do quarto. Residente sem saída prevista MUST NOT aparecer como concluinte. Na demonstração, cujos dados fictícios não têm ano de ingresso nem duração, a etapa, a saída prevista e a situação não aparecem.

#### Scenario: Dia seguinte à saída prevista

- **GIVEN** um residente com saída prevista em 30/06/2026
- **WHEN** alguém abre a lista de residentes em 01/07/2026
- **THEN** a linha dele mostra "Concluinte"

#### Scenario: No dia da saída prevista

- **GIVEN** um residente com saída prevista em 30/06/2026
- **WHEN** alguém abre a ficha dele em 30/06/2026
- **THEN** a ficha mostra a etapa do curso, não "Concluinte"

#### Scenario: Cadastro antigo sem ano de ingresso

- **GIVEN** um residente antigo sem ano de ingresso
- **WHEN** alguém abre a lista de residentes
- **THEN** ele não aparece como concluinte

#### Scenario: Demonstração

- **GIVEN** a demonstração com o perfil gestor
- **WHEN** o visitante abre a lista de residentes e a ficha de um residente fictício
- **THEN** nenhuma das duas mostra etapa, saída prevista ou "Concluinte"

### Requirement: Datas de cada morador no quarto

O detalhe do quarto SHALL mostrar, para cada morador, a data em que entrou no quarto, no horário de Brasília, e a saída prevista, no formato "Entrou em dd/mm/aaaa · saída prevista dd/mm/aaaa". Sem saída prevista, a linha SHALL mostrar só a data de entrada.

#### Scenario: Morador com saída prevista

- **GIVEN** um morador que entrou no quarto em 10/02/2026, com saída prevista em 31/12/2029
- **WHEN** o supervisor abre o detalhe do quarto
- **THEN** a linha do morador mostra "Entrou em 10/02/2026 · saída prevista 31/12/2029"

#### Scenario: Morador sem dados do curso

- **GIVEN** um morador que entrou no quarto em 10/02/2026, sem ano de ingresso
- **WHEN** o supervisor abre o detalhe do quarto
- **THEN** a linha do morador mostra só "Entrou em 10/02/2026"

### Requirement: Vaga liberada ao fim do curso

Uma vez por dia, o sistema SHALL encerrar o vínculo com o quarto de cada residente que passou da saída prevista, com o motivo conclusão do curso, guardando o vínculo no histórico e registrando na auditoria que a tarefa do sistema fez o encerramento. A vaga MUST ficar livre sem ação de ninguém.

#### Scenario: Primeira execução depois da saída prevista

- **GIVEN** um morador com saída prevista em 30/06/2026
- **WHEN** a rotina diária roda em 01/07/2026
- **THEN** o vínculo dele com o quarto é encerrado, o quarto ganha uma vaga livre e a auditoria registra o encerramento sem autor humano

#### Scenario: Histórico do residente

- **GIVEN** um vínculo encerrado pela conclusão do curso
- **WHEN** o supervisor abre a ficha do residente
- **THEN** o histórico de quartos mostra "Concluiu o curso em" seguido da data

#### Scenario: Residente com prorrogação

- **GIVEN** um morador com saída prevista em 30/06/2026 e 1 semestre de prorrogação
- **WHEN** a rotina diária roda em 01/07/2026
- **THEN** o vínculo dele continua ativo

#### Scenario: Sem ano de ingresso ou sem duração

- **GIVEN** um morador sem ano de ingresso, ou cujo curso não tem duração
- **WHEN** a rotina diária roda
- **THEN** o vínculo dele continua ativo

#### Scenario: Acesso do concluinte

- **GIVEN** um residente cujo vínculo foi encerrado pela conclusão do curso
- **WHEN** ele entra no sistema com a matrícula e a senha
- **THEN** o acesso continua funcionando

### Requirement: Concluinte não volta ao quarto

Colocar um concluinte num quarto ou transferi-lo MUST ser recusado, com o aviso de lançar a prorrogação antes. Depois da prorrogação, o mesmo pedido MUST ser aceito.

#### Scenario: Colocar concluinte no quarto

- **GIVEN** um residente que passou da saída prevista e está sem quarto
- **WHEN** o supervisor tenta colocá-lo num quarto com vaga
- **THEN** o sistema recusa e diz para lançar a prorrogação antes de colocar no quarto

#### Scenario: Depois da prorrogação

- **GIVEN** o mesmo residente com a prorrogação lançada e nova saída prevista no futuro
- **WHEN** o supervisor tenta colocá-lo num quarto com vaga
- **THEN** o vínculo é criado
