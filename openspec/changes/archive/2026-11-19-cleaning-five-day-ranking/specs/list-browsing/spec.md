## MODIFIED Requirements

### Requirement: Ranking paginado com o próprio quarto no topo

No acesso por conta, o ranking SHALL mostrar 25 quartos por página. Para o residente, as linhas dos quartos em que ele participou no período SHALL aparecer uma vez, acima da lista, em qualquer página, com a posição e a nota. A lista abaixo MUST trazer só os outros quartos, sem repetir essas linhas.

#### Scenario: Residente na página 1

- **GIVEN** o quarto do residente está na 60ª posição de 93
- **WHEN** o residente abre o ranking
- **THEN** a linha do quarto dele aparece no topo, com a posição e a nota
- **AND** a lista "Outros quartos" mostra "1–25 de 92", sem o quarto dele

#### Scenario: Gestor

- **WHEN** o gestor abre o ranking
- **THEN** não há linha fixa no topo, e a paginação mostra "1–25 de 93"
