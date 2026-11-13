# Spec Delta

## MODIFIED Requirements

### Requirement: Quarto dependente do alojamento e do bloco

Toda seleção de casa ou bloco e de quarto SHALL oferecer somente opções do alojamento e do bloco escolhidos. Trocar o alojamento MUST limpar a casa ou bloco e o quarto, trocar a casa ou bloco MUST limpar o quarto, e o quarto MUST ser limpo também quando o quarto lembrado não existir mais nas opções.

#### Scenario: Troca de alojamento

- **GIVEN** um quarto selecionado no alojamento A
- **WHEN** o usuário troca para o alojamento B
- **THEN** o quarto volta a "Todos" e só quartos do alojamento B aparecem

#### Scenario: Troca de alojamento com bloco escolhido

- **GIVEN** bloco e quarto selecionados
- **WHEN** o usuário troca o alojamento
- **THEN** bloco e quarto voltam a "Todos"

#### Scenario: Troca de bloco

- **GIVEN** um quarto selecionado no bloco A
- **WHEN** o usuário troca para o bloco B do mesmo alojamento
- **THEN** o quarto volta a "Todos" e só quartos do bloco B aparecem

## ADDED Requirements

### Requirement: Ordem natural dos locais

O mapa de quartos e toda seleção de alojamento, casa ou bloco e quarto SHALL listar os locais em ordem natural, com os alojamentos em ordem alfabética e os números comparados como números ("2" antes de "10", "Casa 2" antes de "Casa 10").

#### Scenario: Quartos 1, 2 e 10

- **GIVEN** os quartos 1, 10 e 2 no mesmo alojamento
- **WHEN** o supervisor abre a seleção de quarto dos residentes
- **THEN** as opções aparecem na ordem 1, 2 e 10

#### Scenario: Casas 2 e 10

- **GIVEN** a "Casa 10" e a "Casa 2" na Vila Estudantil
- **WHEN** o gestor abre a Vila Estudantil no mapa de quartos
- **THEN** o cartão da Casa 2 vem antes do cartão da Casa 10
