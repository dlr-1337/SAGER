## ADDED Requirements

### Requirement: Nome da notificação de ocorrência

No acesso por conta, o menu, a página de início, as telas, as mensagens, a Ajuda e o relatório SHALL chamar a notificação que o sistema abre para o supervisor analisar de "Notificação de ocorrência", no plural "Notificações de ocorrência". O relatório de ocorrências SHALL continuar "Ocorrências". Rotas, códigos e permissões MUST NOT mudar, e as telas próprias da demonstração (RF027) ficam como estão.

#### Scenario: Menu do supervisor

- **WHEN** o supervisor abre o menu
- **THEN** ele vê "Notificações de ocorrência", que leva a `/notificacoes`

#### Scenario: Detalhe da notificação

- **WHEN** o supervisor abre uma notificação de ausência
- **THEN** o título diz "Notificação de ocorrência"

#### Scenario: Relatórios

- **WHEN** o gestor abre a tela de relatórios
- **THEN** ele vê os cartões "Ocorrências" e "Notificações de ocorrência"
- **AND** o arquivo do relatório de notificações sai com o título "Notificações de ocorrência"
