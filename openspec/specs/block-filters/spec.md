# block-filters Specification

## Purpose
Garantir que toda tela que filtra por quarto também filtre por casa ou bloco, com opções coerentes em cascata.

## Requirements

### Requirement: Bloco e quarto nas telas operacionais

Saídas, lista e formulário de limpeza, residentes e relatórios SHALL oferecer casa ou bloco e quarto, nessa ordem, depois do alojamento.

#### Scenario: Filtrar limpeza por bloco

- **WHEN** o usuário escolhe um bloco sem escolher quarto
- **THEN** a lista mostra as avaliações de todos os quartos desse bloco

#### Scenario: Filtrar saídas por bloco

- **WHEN** o supervisor escolhe um bloco
- **THEN** a lista mostra saídas de residentes alocados nesse bloco na data solicitada

### Requirement: Bloco inequívoco

Sem alojamento escolhido, a opção de bloco MUST mostrar também o alojamento.

#### Scenario: Blocos com o mesmo nome

- **GIVEN** dois alojamentos com "Bloco A"
- **WHEN** o usuário abre a lista sem escolher alojamento
- **THEN** as opções são distinguíveis

### Requirement: Filtro no servidor

Listas paginadas MUST aplicar o bloco no servidor, para que o total e as páginas reflitam o filtro.

#### Scenario: Paginação

- **WHEN** a lista de residentes é filtrada por bloco
- **THEN** o total e as páginas consideram só esse bloco

### Requirement: Integridade de relatórios antigos

Um relatório já guardado sem bloco MUST continuar exportável, e o filtro de bloco MUST compor o registro de integridade só quando informado.

#### Scenario: Consulta antiga

- **GIVEN** uma consulta salva antes do filtro de bloco
- **WHEN** o usuário exporta
- **THEN** a exportação conclui sem erro de integridade
