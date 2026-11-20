## ADDED Requirements

### Requirement: Aviso ao residente depois do pedido de saída curta

Depois de enviar um pedido de saída curta, o residente SHALL ver uma janela "Pedido enviado" dizendo para ir até o supervisor quando quiser sair e que as 3 horas só começam quando ele registrar a saída. No detalhe do pedido que espera o registro da saída, "Apresente-se ao supervisor" SHALL ser o título do passo, em destaque, no lugar de "O que você pode fazer".

#### Scenario: Pedido enviado

- **WHEN** o residente envia um pedido de saída curta
- **THEN** abre a janela "Pedido enviado", que diz para ir até o supervisor quando quiser sair
- **AND** "Entendi" fecha a janela, e recarregar a página não a abre de novo

#### Scenario: Detalhe do pedido

- **GIVEN** uma saída curta do residente aguardando o registro da saída
- **WHEN** ele abre o detalhe
- **THEN** o título do passo é "Apresente-se ao supervisor", seguido de "Mudar pedido" e "Cancelar pedido"
- **AND** a tela não mostra "O que você pode fazer"

## MODIFIED Requirements

### Requirement: Rejeitar e recusar em vermelho

Os botões que rejeitam um pedido de saída ou recusam um arquivo de autorização SHALL usar o estilo de perigo, em vermelho, com o nome da ação escrito, e MUST NOT ser o botão principal da tela. No diálogo que confirma rejeitar, recusar ou cancelar um pedido, o botão de confirmar SHALL usar o mesmo estilo de perigo.

#### Scenario: Saída curta aguardando análise

- **WHEN** o supervisor abre uma saída curta aguardando análise
- **THEN** "Registrar saída" é o botão principal e "Rejeitar" aparece em vermelho ao lado

### Requirement: Saída curta com só a ação do momento

No detalhe da saída curta, o supervisor SHALL ver o resumo do pedido e só a ação do momento, em dois passos. No passo "Saída", com o pedido aguardando análise, aparecem "Registrar saída" e "Rejeitar" e a frase para registrar a saída quando o residente se apresentar. No passo "Volta", com a saída em andamento, aparece só "Registrar volta". O histórico e "Cancelar pedido" ficam em "Mais detalhes", recolhido.

#### Scenario: Pedido para sair agora aprovado

- **GIVEN** uma saída curta pedida para agora, aguardando análise
- **WHEN** o supervisor abre o detalhe
- **THEN** ele vê "Passo 1 de 2", "Registre a saída quando o residente se apresentar.", "Registrar saída" e "Rejeitar"

#### Scenario: Saída registrada

- **GIVEN** o supervisor no passo "Saída", com o residente na frente dele
- **WHEN** ele clica em "Registrar saída" e confirma "Agora"
- **THEN** a tela diz "Saída registrada. Volta até" com a data e a hora, e passa ao "Passo 2 de 2", com só "Registrar volta"

#### Scenario: Saída agendada na hora

- **GIVEN** uma saída curta agendada e aprovada antes de 20/11/2026, cuja partida pedida chegou
- **WHEN** o supervisor abre o detalhe
- **THEN** a única ação à vista é "Registrar saída"

#### Scenario: Saída em andamento

- **GIVEN** uma saída curta em andamento
- **WHEN** o supervisor abre o detalhe
- **THEN** a única ação à vista é "Registrar volta" e o histórico está recolhido em "Mais detalhes"

#### Scenario: Conflito de edição

- **GIVEN** outra pessoa alterou o pedido enquanto o detalhe estava aberto
- **WHEN** o supervisor tenta registrar a volta
- **THEN** a tela informa a alteração e oferece "Recarregar dados"
