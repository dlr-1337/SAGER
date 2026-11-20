## ADDED Requirements

### Requirement: Nomes da troca de quarto

No detalhe do residente, o campo do quarto SHALL se chamar "Selecione o novo quarto" quando ele já tem quarto e "Selecione um quarto" quando não tem, e o botão SHALL se chamar "Confirmar mudança" na troca e "Colocar no quarto" na primeira alocação. A palavra "mudar" MUST NOT aparecer no campo e no botão ao mesmo tempo.

#### Scenario: Troca de quarto

- **GIVEN** um residente com quarto ativo
- **WHEN** o supervisor abre o detalhe dele
- **THEN** ele vê o campo "Selecione o novo quarto" e o botão "Confirmar mudança"

#### Scenario: Primeira alocação

- **GIVEN** um residente sem quarto ativo
- **WHEN** o gestor abre o detalhe dele
- **THEN** ele vê o campo "Selecione um quarto" e o botão "Colocar no quarto"
