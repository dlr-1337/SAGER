# cleaning-evaluation Specification

## Purpose
Registrar e corrigir a avaliação de limpeza dos quartos por quatro critérios, calcular a nota e o ranking de organização por período e apresentar os indicadores mensais de cada residente.

## Requirements

### Requirement: Avaliação por quatro critérios

Somente o supervisor SHALL avaliar um quarto, dando nota de 0 a 10 a piso, superfícies, resíduos e organização. A nota do quarto MUST ser a média dos quatro critérios com duas casas decimais, calculada pelo servidor (RF010, RN14, UC09).

#### Scenario: Média com duas casas

- **WHEN** o supervisor avalia um quarto com 8, 7, 9 e 6,5
- **THEN** a nota gravada é 7,63

#### Scenario: Critério acima de 10

- **WHEN** o supervisor informa 11 em um dos critérios
- **THEN** o servidor responde 400 e nenhuma avaliação é criada

#### Scenario: Gestor tenta avaliar

- **WHEN** um gestor tenta registrar uma avaliação de limpeza
- **THEN** o servidor responde 403

### Requirement: Uma avaliação por quarto e data

Cada quarto SHALL ter no máximo uma avaliação por data civil de America/Sao_Paulo. Uma segunda avaliação do mesmo quarto na mesma data MUST receber 409 `assessment_exists`, e a mudança deve ser feita pela correção (RF010, UC09).

#### Scenario: Segunda avaliação no dia

- **GIVEN** o quarto 101 avaliado hoje
- **WHEN** o supervisor tenta avaliá-lo de novo hoje
- **THEN** o servidor responde 409 `assessment_exists`

### Requirement: Participantes da avaliação

A avaliação SHALL guardar como participantes os residentes com alocação ativa no quarto no instante avaliado, e mudanças de alocação posteriores MUST NOT alterar essa lista (RF010, RN14; cap. 4, diagrama entidade-relacionamento do ranking).

#### Scenario: Residente transferido depois da avaliação

- **GIVEN** uma avaliação do quarto 101 com dois participantes
- **WHEN** um deles é transferido para o quarto 205
- **THEN** a avaliação do 101 continua com os mesmos dois participantes

### Requirement: Correção preserva a avaliação anterior

O supervisor SHALL corrigir os critérios ou a observação de uma avaliação com motivo de 10 a 2.000 caracteres. A correção MUST recalcular a nota, guardar a versão anterior no histórico da avaliação e reavaliar as ocorrências ligadas a ela (RF010, UC09).

#### Scenario: Nota corrigida

- **GIVEN** uma avaliação com nota 5,50
- **WHEN** o supervisor corrige um critério com motivo e a nota passa a 6,25
- **THEN** a avaliação mostra 6,25 e o histórico guarda a versão de 5,50 com o motivo

#### Scenario: Correção sem motivo

- **WHEN** o supervisor tenta corrigir uma avaliação sem motivo
- **THEN** o servidor responde 400 e a avaliação não muda

### Requirement: Ranking por período

O ranking SHALL ordenar os quartos pela média das notas na semana, iniciada na segunda-feira, no mês ou no semestre, de janeiro a junho ou de julho a dezembro. Médias iguais MUST repetir a posição, e quarto sem avaliação no período MUST ficar sem média e sem posição, nunca com zero (RF012, RN14, UC12).

#### Scenario: Empate

- **GIVEN** na semana, o quarto A com média 9,00, o B com 9,00 e o C com 8,50
- **WHEN** alguém consulta o ranking da semana
- **THEN** A e B aparecem em 1º lugar e C em 3º

#### Scenario: Quarto não avaliado

- **GIVEN** um quarto sem avaliação no mês
- **WHEN** o gestor consulta o ranking do mês
- **THEN** o quarto aparece sem média e sem posição

### Requirement: Quem vê as notas

Gestor e supervisor SHALL consultar todas as avaliações e o ranking completo. O residente SHALL consultar apenas as avaliações de que participou e, no ranking, MUST ver a média só dos quartos de que participou no período; os demais quartos aparecem com a posição e sem a média (RF012, UC12; cap. 4, tabela de permissões).

#### Scenario: Ranking visto pelo residente

- **GIVEN** um residente que participou de avaliações do quarto 101 no mês
- **WHEN** ele consulta o ranking do mês
- **THEN** vê a média e a posição do 101 e só a posição dos outros quartos

#### Scenario: Avaliação de outro quarto

- **WHEN** um residente tenta abrir a avaliação de um quarto de que não participou
- **THEN** o servidor responde 404

### Requirement: Indicadores mensais

Gestor e supervisor SHALL consultar, por mês e opcionalmente por residente, as ausências sem justificativa (marcação ausente) em chamadas fechadas, os retornos confirmados com atraso e as advertências vigentes, num período de até 366 dias, por padrão os últimos seis meses (RF011; cap. 4, módulo Limpeza e ranking; cap. 8, tabela de correspondência da avaliação).

#### Scenario: Indicadores de um residente

- **GIVEN** um residente com uma ausência em chamada fechada e um retorno atrasado em março
- **WHEN** o supervisor consulta os indicadores dele de janeiro a março
- **THEN** março mostra uma ausência e um retorno atrasado, e janeiro e fevereiro mostram zero

#### Scenario: Residente tenta consultar indicadores

- **WHEN** um residente tenta consultar os indicadores mensais
- **THEN** o servidor responde 403
