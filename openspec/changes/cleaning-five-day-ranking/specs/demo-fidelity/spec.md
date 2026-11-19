## MODIFIED Requirements

### Requirement: Regra da limpeza e do ranking descrita na demonstração

As telas de limpeza e de ranking da demonstração SHALL descrever a regra adotada (média dos quatro critérios, de 0 a 10; nota abaixo de 6,00 gera ocorrência para análise; ranking pela média dos últimos 5 dias, com semana, mês e semestre como opções; empates repetem a posição; quarto sem avaliação não recebe zero) como política local que aguarda o aceite da Assistência Estudantil. Essas telas MUST NOT dizer que a fórmula ou os critérios estão pendentes.

#### Scenario: Tela de limpeza

- **GIVEN** a demonstração com o perfil supervisor
- **WHEN** o usuário abre a avaliação de limpeza
- **THEN** a tela mostra "Regras da avaliação" com a média dos quatro critérios e o limiar de 6,00
- **AND** não aparece "Critérios pendentes da AE"

#### Scenario: Tela de ranking

- **GIVEN** a demonstração com qualquer perfil
- **WHEN** o usuário abre o ranking
- **THEN** a tela abre em "Últimos 5 dias", com a posição e a nota de cada quarto
- **AND** explica que empates repetem a posição e que quarto sem avaliação não recebe zero
- **AND** não aparece "Fórmula pendente da AE"

#### Scenario: Notificação de limpeza

- **GIVEN** a demonstração com o perfil supervisor
- **WHEN** o usuário abre a notificação gerada pela limpeza
- **THEN** a evidência diz "Nota de limpeza abaixo de 6,00."
