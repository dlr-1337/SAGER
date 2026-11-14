# Spec Delta

## ADDED Requirements

### Requirement: Rejeição antes da conferência

O supervisor SHALL poder rejeitar uma saída longa pendente antes da conferência da autorização, com justificativa de 10 a 2.000 caracteres, no acesso por conta e na demonstração (RN05; UC07, fluxo alternativo). A aprovação MUST continuar indisponível até a autorização conferida.

#### Scenario: Demonstração antes da conferência

- **GIVEN** a demonstração com o perfil supervisor e uma saída longa sem autorização conferida
- **WHEN** o usuário abre o detalhe da saída
- **THEN** "Rejeitar" está disponível e "Aprovar" continua bloqueado
- **AND** a tela explica que a rejeição antes da conferência exige justificativa de 10 a 2.000 caracteres

#### Scenario: Motivo curto na demonstração

- **GIVEN** a demonstração com uma saída longa sem autorização conferida
- **WHEN** o supervisor confirma a rejeição com uma justificativa de 9 caracteres
- **THEN** a demonstração recusa e a saída continua pendente

#### Scenario: Rejeição válida na demonstração

- **GIVEN** a demonstração com uma saída longa sem autorização conferida
- **WHEN** o supervisor confirma a rejeição com uma justificativa de 10 caracteres
- **THEN** a saída passa a rejeitada e o histórico mostra o motivo

#### Scenario: Acesso por conta antes da conferência

- **GIVEN** uma saída longa pendente sem autorização conferida
- **WHEN** o supervisor a rejeita com justificativa válida
- **THEN** a saída passa a rejeitada
