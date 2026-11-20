## ADDED Requirements

### Requirement: Saída aprovada entre as pendentes na demonstração

Na lista de saídas da demonstração, o filtro "Pendentes" SHALL incluir a saída aprovada que ainda espera o registro da saída, e o filtro "Concluídas" MUST NOT incluí-la, como o contador do menu, que já a conta como pendente.

#### Scenario: Aprovada à espera da saída

- **GIVEN** o supervisor na demonstração, com uma saída curta aprovada sem saída registrada
- **WHEN** ele filtra a lista de saídas por "Pendentes"
- **THEN** a saída aparece na lista
- **AND** ela não aparece no filtro "Concluídas"
