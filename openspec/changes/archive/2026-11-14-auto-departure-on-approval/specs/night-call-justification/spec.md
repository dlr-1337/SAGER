## MODIFIED Requirements

### Requirement: Justificativa automática na abertura

Ao abrir a chamada, o sistema SHALL marcar como ausência justificada o residente com exatamente uma saída aprovada, com partida física registrada, sem retorno e com retorno previsto não vencido no instante da abertura, vinculando a saída. Isso SHALL valer em cada chamada aberta enquanto a saída está em andamento, também quando a partida foi registrada na aprovação (RN10).

#### Scenario: Residente fora com saída válida

- **GIVEN** um residente com saída aprovada e partida física antes da abertura
- **WHEN** o supervisor abre a chamada
- **THEN** ele aparece como ausência justificada, com a saída indicada

#### Scenario: Aprovada sem partida registrada

- **GIVEN** uma saída aprovada sem partida física registrada
- **WHEN** o supervisor abre a chamada
- **THEN** o residente fica pendente de marcação

#### Scenario: Retorno antes da abertura

- **GIVEN** um residente cujo retorno foi registrado antes da abertura
- **WHEN** o supervisor abre a chamada
- **THEN** o residente fica pendente de marcação

#### Scenario: Mais de uma saída válida

- **GIVEN** um residente com duas saídas válidas na abertura
- **WHEN** o supervisor abre a chamada
- **THEN** o residente fica pendente e o supervisor escolhe a saída

#### Scenario: Saída longa de vários dias

- **GIVEN** uma saída longa de 20 dias cuja partida foi registrada na aprovação, sem retorno confirmado
- **WHEN** o supervisor abre a chamada em cada uma das 20 noites, antes do retorno previsto
- **THEN** o residente aparece como ausência justificada em todas elas
- **AND** o fechamento dessas chamadas não gera ocorrência nem notificação de ausência para ele

#### Scenario: Retorno previsto vencido

- **GIVEN** uma saída em andamento cujo retorno previsto passou sem retorno confirmado
- **WHEN** o supervisor abre a chamada
- **THEN** o residente fica pendente de marcação
