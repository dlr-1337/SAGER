## MODIFIED Requirements

### Requirement: Contador no menu do supervisor

No menu do supervisor, um contador SHALL aparecer em "Saídas e retornos" com os pedidos curtos e longos que aguardam análise dentro do prazo e os aprovados cuja saída pedida já chegou, sem saída registrada e antes do retorno previsto; em "Notificações de ocorrência" com as pendentes, ainda não vistas, e as que aguardam a conferência de origem corrigida; em "Chamada noturna" com a chamada aberta; e em "Conversas" com as que têm mensagem recebida não lida.

#### Scenario: Pedidos de saída à espera

- **GIVEN** um pedido de saída curta e um de saída longa aguardando análise dentro do prazo
- **AND** um pedido aprovado cuja hora de saída já chegou, sem saída registrada
- **WHEN** o supervisor abre qualquer tela
- **THEN** "Saídas e retornos" mostra 3

#### Scenario: Pedido fora do prazo

- **GIVEN** um pedido agendado aguardando análise cuja hora de saída já passou
- **WHEN** o supervisor abre qualquer tela
- **THEN** o pedido não entra na contagem de "Saídas e retornos"

#### Scenario: Notificação vista

- **GIVEN** uma notificação de ocorrência pendente contada no menu
- **WHEN** o supervisor registra a visualização dela
- **THEN** ela sai da contagem de "Notificações de ocorrência" e continua na lista como "Visualizada"

#### Scenario: Notificação decidida

- **GIVEN** uma notificação de ocorrência pendente contada no menu
- **WHEN** o supervisor a converte em advertência ou a arquiva
- **THEN** ela sai da contagem de "Notificações de ocorrência"

#### Scenario: Chamada encerrada

- **GIVEN** a chamada noturna aberta, com "Chamada noturna" mostrando 1
- **WHEN** o supervisor encerra a chamada
- **THEN** "Chamada noturna" deixa de mostrar o contador

#### Scenario: Conversa lida

- **GIVEN** uma conversa com mensagem recebida do responsável depois da última leitura
- **WHEN** o supervisor abre a conversa
- **THEN** ela sai da contagem de "Conversas"
- **AND** uma mensagem enviada pelo supervisor não volta a contá-la
