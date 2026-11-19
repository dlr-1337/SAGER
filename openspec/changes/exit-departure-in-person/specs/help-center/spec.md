## MODIFIED Requirements

### Requirement: Ajuda sem login

A página de ajuda SHALL abrir sem login e ter link na página de acesso. As perguntas frequentes SHALL explicar ao menos quando a saída começa, que o supervisor confirma o retorno, que a saída longa só é aprovada depois da autorização conferida e que notificação não vira advertência sozinha (RF026; cap. 4, requisito não funcional Ajuda).

#### Scenario: Visitante sem conta

- **GIVEN** um visitante sem sessão
- **WHEN** ele abre a ajuda pelo link da página de acesso
- **THEN** a ajuda aparece com as perguntas frequentes, sem pedir login

#### Scenario: Quando a saída começa

- **WHEN** um visitante abre a pergunta "Quando a saída começa?"
- **THEN** ele lê que a saída começa quando o supervisor vê o residente e registra a saída, a partir do horário pedido, e que a aprovação não registra a saída
