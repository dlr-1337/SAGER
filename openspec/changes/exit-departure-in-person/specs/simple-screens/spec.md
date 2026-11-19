## MODIFIED Requirements

### Requirement: Saída longa com só o próximo passo

No detalhe da saída longa, o supervisor SHALL ver o resumo do pedido (residente, saída, volta, motivo e responsável) e só o passo atual: "Autorização do responsável" até a conferência; "Decisão", com "Aprovar saída"; "Saída", na saída aprovada, com "Registrar saída" a partir da hora pedida; e, em andamento, "Volta", só com "Registrar volta". "Rejeitar" MUST continuar à vista nos dois primeiros passos, também antes da conferência.

#### Scenario: Sem arquivo recebido

- **GIVEN** uma saída longa aguardando autorização, sem arquivo recebido
- **WHEN** o supervisor abre o detalhe
- **THEN** o passo "Autorização do responsável" diz "Aguardando o responsável enviar pelo WhatsApp", "Anexar arquivo" fica à vista, "Reenviar documento" fica recolhido em "Outras opções", "Rejeitar" aparece em vermelho e "Aprovar saída" não aparece

#### Scenario: Autorização conferida

- **GIVEN** uma autorização conferida na revisão atual
- **WHEN** o supervisor abre o detalhe
- **THEN** ele vê o passo "Decisão", com "Aprovar saída" e "Rejeitar" em vermelho

#### Scenario: Saída agendada antes da hora

- **GIVEN** uma saída longa agendada, aprovada, com partida pedida para daqui a 2 horas
- **WHEN** o supervisor abre o detalhe
- **THEN** o passo "Saída" mostra "Saída marcada para" com a data e a hora, sem "Registrar saída"

#### Scenario: Pedido para sair agora aprovado

- **GIVEN** uma saída longa com partida imediata, aprovada e sem partida registrada
- **WHEN** o supervisor abre o detalhe
- **THEN** o passo "Saída" diz para registrar a saída quando o residente se apresentar e a única ação à vista é "Registrar saída"

#### Scenario: Saída em andamento

- **GIVEN** uma saída longa em andamento
- **WHEN** o supervisor abre o detalhe
- **THEN** a única ação à vista é "Registrar volta"

### Requirement: Saída curta com só a ação do momento

No detalhe da saída curta, o supervisor SHALL ver o resumo do pedido e só a ação do momento: "Aprovar" e "Rejeitar" enquanto aguarda análise; na saída aprovada, "Saída marcada para" com a data e a hora antes da hora pedida e, a partir dela, só "Registrar saída"; com a saída em andamento, só "Registrar volta". O histórico e "Cancelar pedido" ficam em "Mais detalhes", recolhido.

#### Scenario: Saída agendada na hora

- **GIVEN** uma saída curta agendada e aprovada cuja partida pedida chegou
- **WHEN** o supervisor abre o detalhe
- **THEN** a única ação à vista é "Registrar saída"

#### Scenario: Pedido para sair agora aprovado

- **GIVEN** uma saída curta com partida imediata, aprovada e sem partida registrada
- **WHEN** o supervisor abre o detalhe
- **THEN** a tela diz para registrar a saída quando o residente se apresentar e a única ação à vista é "Registrar saída"

#### Scenario: Saída em andamento

- **GIVEN** uma saída curta em andamento
- **WHEN** o supervisor abre o detalhe
- **THEN** a única ação à vista é "Registrar volta" e o histórico está recolhido em "Mais detalhes"

#### Scenario: Conflito de edição

- **GIVEN** outra pessoa alterou o pedido enquanto o detalhe estava aberto
- **WHEN** o supervisor tenta registrar a volta
- **THEN** a tela informa a alteração e oferece "Recarregar dados"
