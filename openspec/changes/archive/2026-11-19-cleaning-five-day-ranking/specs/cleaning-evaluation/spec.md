## MODIFIED Requirements

### Requirement: Ranking por período

O ranking SHALL ordenar os quartos pela média das notas diárias no período: os últimos 5 dias, padrão, com a data de referência e os 4 dias civis anteriores em America/Sao_Paulo; a semana, iniciada na segunda-feira; o mês; ou o semestre, de janeiro a junho ou de julho a dezembro. Médias iguais MUST repetir a posição, e quarto sem avaliação no período MUST ficar sem média e sem posição, nunca com zero. O ranking MUST NOT mostrar a quantidade de avaliações (RF012, RN14, UC12).

#### Scenario: Últimos 5 dias por padrão

- **GIVEN** a data de hoje, 19/11/2026
- **WHEN** alguém abre o ranking sem escolher o período
- **THEN** o ranking mostra os últimos 5 dias, de 15/11/2026 a 19/11/2026

#### Scenario: Dia sem avaliação não conta

- **GIVEN** o quarto A avaliado com 9,00 em 19/11 e com 5,00 em 17/11, sem avaliação nos outros dias da janela
- **WHEN** alguém consulta os últimos 5 dias até 19/11
- **THEN** a média de A é 7,00

#### Scenario: Nota antiga sai da janela

- **GIVEN** o quarto A avaliado com 3,00 em 14/11 e com 9,00 em 19/11
- **WHEN** alguém consulta os últimos 5 dias até 19/11
- **THEN** a média de A é 9,00, sem a nota de 14/11

#### Scenario: Empate

- **GIVEN** na semana, o quarto A com média 9,00, o B com 9,00 e o C com 8,50
- **WHEN** alguém consulta o ranking da semana
- **THEN** A e B aparecem em 1º lugar e C em 3º

#### Scenario: Quarto não avaliado

- **GIVEN** um quarto sem avaliação no mês
- **WHEN** o gestor consulta o ranking do mês
- **THEN** o quarto aparece sem média e sem posição

#### Scenario: Linha só com posição e nota

- **GIVEN** um quarto com duas avaliações no período
- **WHEN** o gestor consulta o ranking
- **THEN** a linha do quarto mostra a posição e a média, sem o número de avaliações
