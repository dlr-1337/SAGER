## MODIFIED Requirements

### Requirement: Aviso de horário para o adulto

A página de início do residente maior de idade SHALL mostrar o aviso "Maiores de idade podem sair do IF até 23h e voltar a partir das 6h.", sem botão, formulário nem registro de saída ou volta. O residente menor de idade MUST NOT ver esse aviso.

#### Scenario: Início do adulto

- **WHEN** um residente maior de idade abre a página de início
- **THEN** ele vê o aviso de horário, sem botão nem link de saída

#### Scenario: Início do menor

- **WHEN** um residente menor de idade abre a página de início
- **THEN** ele não vê o aviso de horário dos maiores de idade
