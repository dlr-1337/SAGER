## Purpose

Mostrar no menu, no botão "Menu" e nas abas quantos itens esperam uma ação ou uma leitura de quem está no sistema, com os dados que o perfil já vê e as mesmas regras de acesso, sem manter a sessão viva. Pedido da reunião de 19/11/2026.

## ADDED Requirements

### Requirement: Contador no menu do supervisor

No menu do supervisor, um contador SHALL aparecer em "Saídas e retornos" com os pedidos curtos e longos que aguardam análise dentro do prazo e os aprovados cuja saída pedida já chegou, sem saída registrada e antes do retorno previsto; em "Notificações de ocorrência" com as que aguardam decisão ou a conferência de origem corrigida; em "Chamada noturna" com a chamada aberta; e em "Conversas" com as conversas que têm mensagem recebida ainda não lida.

#### Scenario: Pedidos de saída à espera

- **GIVEN** um pedido de saída curta e um de saída longa aguardando análise dentro do prazo
- **AND** um pedido aprovado cuja hora de saída já chegou, sem saída registrada
- **WHEN** o supervisor abre qualquer tela
- **THEN** "Saídas e retornos" mostra 3

#### Scenario: Pedido fora do prazo

- **GIVEN** um pedido agendado aguardando análise cuja hora de saída já passou
- **WHEN** o supervisor abre qualquer tela
- **THEN** o pedido não entra na contagem de "Saídas e retornos"

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

### Requirement: Contador nas comunicações do residente

Para o residente, "Minhas comunicações" SHALL mostrar quantos avisos, advertências e termos de compromisso vigentes destinados a ele ainda estão sem ciência, e as abas "Avisos", "Advertências" e "Termos de compromisso" SHALL mostrar a parte de cada tipo. Abrir o item MUST NOT tirar o item da contagem; só a ciência tira. Rascunhos, itens retirados ou anulados e itens de outro residente MUST NOT contar.

#### Scenario: Aviso e advertências sem ciência

- **GIVEN** um aviso publicado e três advertências vigentes para o residente, todos sem ciência
- **WHEN** ele abre qualquer tela
- **THEN** "Minhas comunicações" mostra 4
- **AND** a aba "Avisos" mostra 1 e a aba "Advertências" mostra 3

#### Scenario: Leitura sem ciência

- **GIVEN** um aviso sem ciência contado no menu
- **WHEN** o residente abre o aviso e volta à lista sem registrar ciência
- **THEN** o aviso continua na contagem

#### Scenario: Ciência registrada

- **WHEN** o residente registra ciência do aviso
- **THEN** o aviso sai da contagem do menu e da aba

#### Scenario: Advertência anulada

- **WHEN** o supervisor anula uma advertência sem ciência
- **THEN** ela sai da contagem do residente

#### Scenario: Comunicação de outro residente

- **GIVEN** um aviso publicado só para outro residente
- **WHEN** o residente abre qualquer tela
- **THEN** o aviso não entra na contagem dele

### Requirement: Contador nas abas de saídas

Na tela de saídas do supervisor, as abas "Saídas curtas" e "Saídas longas" SHALL mostrar a parte de cada tipo na contagem de "Saídas e retornos".

#### Scenario: Abas com pedidos

- **GIVEN** dois pedidos curtos e um longo contados em "Saídas e retornos"
- **WHEN** o supervisor abre as saídas
- **THEN** a aba "Saídas curtas" mostra 2 e a aba "Saídas longas" mostra 1

### Requirement: Itens sem contador

O menu do gestor MUST NOT mostrar contador. Limpeza, ranking, advertências e avisos do supervisor, cadastros, relatórios e as saídas do residente MUST NOT mostrar contador.

#### Scenario: Gestor

- **WHEN** o gestor abre qualquer tela
- **THEN** nenhum item do menu mostra contador
- **AND** a tela não pede a contagem ao servidor

#### Scenario: Limpeza do supervisor

- **GIVEN** quartos ainda sem avaliação de limpeza na semana
- **WHEN** o supervisor abre qualquer tela
- **THEN** "Limpeza" não mostra contador

### Requirement: Contador acessível

O contador SHALL mostrar o número e SHALL ser lido pelo leitor de tela junto do nome do item, como "3 pendentes" ou "1 pendente". Acima de 99, ele SHALL mostrar "99+" e ler o número exato. Com zero, nada SHALL aparecer. A cor MUST NOT ser o único sinal. No celular, o botão "Menu" SHALL mostrar a soma dos contadores, mantendo o nome "Menu" e com a soma lida como descrição.

#### Scenario: Item com pendências

- **GIVEN** três notificações de ocorrência à espera
- **WHEN** o leitor de tela chega ao item "Notificações de ocorrência"
- **THEN** ele lê o nome do item seguido de "3 pendentes"

#### Scenario: Nada à espera

- **GIVEN** nenhuma notificação à espera
- **WHEN** o supervisor olha o menu
- **THEN** "Notificações de ocorrência" aparece sem número

#### Scenario: Celular com pendências

- **GIVEN** o supervisor no celular, com 6 itens à espera no menu
- **WHEN** ele olha o cabeçalho
- **THEN** o botão "Menu" mostra 6
- **AND** o leitor de tela lê "Menu" com a descrição "6 pendentes no menu"

### Requirement: Contagem pelo servidor com as regras de acesso

A contagem SHALL vir de uma consulta leve ao servidor, com um número por item, só para o supervisor e o residente, sobre os dados que o perfil já pode ver. Sem sessão, a resposta MUST ser 401; para o gestor, 403; fora dos perfis conhecidos, a API continua fechada. A consulta MUST NOT marcar nada como lido nem registrar ciência e MUST NOT ser guardada em cache.

#### Scenario: Gestor pede a contagem

- **WHEN** o gestor pede a contagem
- **THEN** o servidor responde 403

#### Scenario: Sem sessão

- **WHEN** alguém sem sessão pede a contagem
- **THEN** o servidor responde 401

#### Scenario: Consulta não lê nada

- **GIVEN** um aviso sem ciência e uma conversa com mensagem não lida
- **WHEN** o residente e o supervisor pedem a contagem várias vezes
- **THEN** o aviso continua sem ciência e a conversa continua não lida

### Requirement: Contagem atualizada sem manter a sessão

A contagem SHALL ser buscada ao entrar, a cada troca de tela, logo depois de uma gravação e a cada 30 segundos com a aba visível. Com a aba oculta, MUST NOT consultar, e ao voltar à aba consulta na hora. Depois de 30 minutos sem clique, toque ou tecla, SHALL parar até a próxima troca de tela. A consulta MUST NOT renovar a sessão. Uma falha MUST manter os números anteriores, e números de outra conta MUST NOT aparecer.

#### Scenario: Pedido novo

- **GIVEN** o supervisor numa tela qualquer, com a aba visível
- **WHEN** um residente envia um pedido de saída
- **THEN** o contador de "Saídas e retornos" sobe em até 30 segundos

#### Scenario: Estação sem uso

- **GIVEN** o supervisor com o sistema aberto e sem interação
- **WHEN** passam 30 minutos
- **THEN** a contagem deixa de ser consultada
- **AND** a consulta da contagem não impede a sessão de expirar

#### Scenario: Aba oculta

- **WHEN** o supervisor passa 1 minuto em outra aba
- **THEN** a contagem não é consultada nesse tempo
- **AND** ao voltar à aba, é consultada na hora

### Requirement: Contador na demonstração

Na demonstração (RF027), os contadores SHALL vir dos dados fictícios em memória, com as mesmas regras, e MUST NOT consultar a API. No cenário "Padrão", o supervisor vê "Saídas e retornos" com 3, "Notificações de ocorrência" com 2 e "Chamada noturna" com 1 até concluir a chamada; o residente vê "Avisos e advertências" com 2. Nos cenários "Sem dados", "Erro" e "Carregando", nenhum contador aparece.

#### Scenario: Supervisor na demonstração

- **GIVEN** a demonstração com o perfil Supervisor no cenário "Padrão"
- **WHEN** a tela de início abre
- **THEN** o menu mostra 3 em "Saídas e retornos", 2 em "Notificações de ocorrência" e 1 em "Chamada noturna"
- **AND** nenhuma consulta vai à API

#### Scenario: Ciência na demonstração

- **GIVEN** a demonstração com o perfil Residente, com "Avisos e advertências" mostrando 2
- **WHEN** o residente registra ciência do aviso
- **THEN** o menu passa a mostrar 1 e a aba "Avisos" fica sem número

#### Scenario: Cenário sem dados

- **WHEN** o supervisor troca o cenário para "Sem dados"
- **THEN** nenhum contador aparece
