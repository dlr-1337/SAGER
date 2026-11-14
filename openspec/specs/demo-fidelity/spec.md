# demo-fidelity Specification

## Purpose
Manter o modo demonstração (RF027) coerente com as regras descritas na monografia, apesar dos dados fictícios em memória e de nunca chamar a API.

## Requirements

### Requirement: Nota de limpeza com duas casas na demonstração

A demonstração SHALL mostrar a nota de limpeza, a nota anterior, a variação e a nota citada no ranking com duas casas decimais, como a RN14.

#### Scenario: Simular avaliação

- **GIVEN** a demonstração com o perfil supervisor
- **WHEN** o usuário simula a reavaliação do quarto A-102
- **THEN** a nota anterior aparece como "7,50", a nova nota como "8,00" e a variação como "0,50 ponto(s)"

### Requirement: Regra da limpeza e do ranking descrita na demonstração

As telas de limpeza e de ranking da demonstração SHALL descrever a regra adotada (média dos quatro critérios, de 0 a 10; nota abaixo de 6,00 gera ocorrência para análise; empates repetem a posição; quarto sem avaliação não recebe zero) como política local que aguarda o aceite da Assistência Estudantil. Essas telas MUST NOT dizer que a fórmula ou os critérios estão pendentes.

#### Scenario: Tela de limpeza

- **GIVEN** a demonstração com o perfil supervisor
- **WHEN** o usuário abre a avaliação de limpeza
- **THEN** a tela mostra "Regras da avaliação" com a média dos quatro critérios e o limiar de 6,00
- **AND** não aparece "Critérios pendentes da AE"

#### Scenario: Tela de ranking

- **GIVEN** a demonstração com qualquer perfil
- **WHEN** o usuário abre o ranking
- **THEN** a tela explica que empates repetem a posição e que quarto sem avaliação não recebe zero
- **AND** não aparece "Fórmula pendente da AE"

#### Scenario: Notificação de limpeza

- **GIVEN** a demonstração com o perfil supervisor
- **WHEN** o usuário abre a notificação gerada pela limpeza
- **THEN** a evidência diz "Nota de limpeza abaixo de 6,00."

### Requirement: Chamada da demonstração só com menores

Todo residente da chamada noturna da demonstração MUST ter, no cadastro fictício, uma data de nascimento que o torne menor de 18 anos até 31/12/2026, como manda a RN02.

#### Scenario: Idades do cenário fictício

- **GIVEN** a data civil de 31/12/2026
- **WHEN** se confere a data de nascimento de cada residente listado na chamada da demonstração
- **THEN** todos têm menos de 18 anos
