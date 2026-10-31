# action-links Specification

## Purpose
Definir a aparência dos links de ação com ícone e dos links dentro de texto, mantendo ambos identificáveis sem depender apenas de cor.

## Requirements

### Requirement: Link de ação com ícone sem sublinhado em repouso

Um link de ação isolado, com ícone de seta, MUST NOT aparecer sublinhado em repouso e SHALL sublinhar ao receber hover.

#### Scenario: Link "Ver" em uma lista

- **GIVEN** uma linha de lista com link de ação e seta
- **WHEN** a página é exibida sem interação
- **THEN** nem o texto nem a seta têm sublinhado

#### Scenario: Hover no link de ação

- **WHEN** o ponteiro está sobre o link de ação
- **THEN** o link mostra sublinhado e mudança de cor

### Requirement: Link dentro de texto continua sublinhado

Um link no meio de um texto MUST permanecer sublinhado em repouso.

#### Scenario: Link em um parágrafo

- **WHEN** um parágrafo contém um link
- **THEN** o link aparece sublinhado sem interação
