## MODIFIED Requirements

### Requirement: Feedback da limpeza igual ao ranking

Na lista de avaliações de limpeza, tanto na gestão quanto na do residente, cada avaliação SHALL trazer a média e a posição do quarto nos últimos 5 dias terminados na data da avaliação, iguais às do ranking desse período. Isso vale também quando várias avaliações da mesma página caem em janelas que se cruzam.

#### Scenario: Três avaliações na mesma semana

- **GIVEN** três quartos avaliados no mesmo dia, dois empatados
- **WHEN** o supervisor abre a lista de avaliações
- **THEN** cada avaliação traz a mesma média e a mesma posição que o ranking dos últimos 5 dias até aquela data mostra para o seu quarto

#### Scenario: Avaliações em dias diferentes

- **GIVEN** o quarto A avaliado em 15/11 e em 19/11
- **WHEN** o supervisor abre a lista de avaliações
- **THEN** a de 15/11 traz a média e a posição de 11/11 a 15/11, e a de 19/11, as de 15/11 a 19/11

#### Scenario: Lista do residente

- **WHEN** o residente abre as próprias avaliações
- **THEN** a média e a posição de cada uma são iguais às da lista da gestão
