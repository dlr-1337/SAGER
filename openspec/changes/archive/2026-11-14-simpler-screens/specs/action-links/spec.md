## MODIFIED Requirements

### Requirement: Link de ação com ícone sem sublinhado em repouso

Um link de ação isolado, com ícone, MUST NOT aparecer sublinhado em repouso. No hover, SHALL sublinhar só o texto e mudar de cor, e o sublinhado MUST NOT passar por baixo nem por cima do ícone.

#### Scenario: Link "Ver" em uma lista

- **GIVEN** uma linha de lista com link de ação e seta
- **WHEN** a página é exibida sem interação
- **THEN** nem o texto nem a seta têm sublinhado

#### Scenario: Hover no link de ação

- **WHEN** o ponteiro está sobre o link de ação
- **THEN** o texto do link mostra sublinhado e mudança de cor, e a seta continua sem sublinhado

#### Scenario: Ícone antes do texto

- **GIVEN** o link de voltar "Alojamentos", com a seta antes do texto, no detalhe de um alojamento
- **WHEN** o ponteiro está sobre o link
- **THEN** só a palavra "Alojamentos" fica sublinhada
