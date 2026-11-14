## Purpose

Fazer as telas do SAGER mostrarem o que outra pessoa ou o próprio sistema mudou, sem F5 e sem botão de atualizar, sem atrapalhar quem está lendo ou digitando, sem manter a consulta ligada numa estação esquecida e sem manter a sessão viva. As telas próprias do modo demonstração (RF027) ficam como estão.

## ADDED Requirements

### Requirement: Telas atualizadas a cada 15 segundos

No acesso por conta, a chamada noturna, o início do residente e as listas e os detalhes de saídas, notificações, advertências, termos, reincidências, avisos, comunicações do residente, limpeza, ranking, residentes, quartos, alojamentos, responsáveis, supervisores e relatórios gerados SHALL buscar os dados de novo a cada 15 segundos com a aba visível e logo ao voltar à aba. Com a aba oculta, a tela MUST NOT consultar o servidor.

#### Scenario: Pedido novo nas saídas

- **GIVEN** o supervisor com a lista de saídas aberta
- **WHEN** um residente envia um pedido de saída
- **THEN** o pedido aparece na lista em até 15 segundos, sem recarregar a página

#### Scenario: Resposta ao residente

- **GIVEN** o residente com o detalhe do seu pedido de saída aberto
- **WHEN** o supervisor aprova o pedido
- **THEN** o detalhe passa a mostrar a decisão e a nova situação em até 15 segundos

#### Scenario: Aba oculta

- **GIVEN** a lista de saídas aberta
- **WHEN** o supervisor passa 1 minuto em outra aba
- **THEN** a lista não é consultada nesse tempo
- **AND** ao voltar à aba, a lista é consultada na hora

#### Scenario: Cadastro não se atualiza

- **WHEN** o gestor preenche o cadastro de um residente novo
- **THEN** a tela não busca dados de novo enquanto ele preenche

### Requirement: Atualização sem interromper

A atualização automática SHALL mostrar os dados novos sem esvaziar a lista, sem mostrar "Carregando", sem mover o foco e mantendo página, filtros, rolagem e mensagens de sucesso ou erro. Enquanto a tela tiver dados digitados e não gravados, diálogo aberto, gravação em andamento ou aviso de que outra pessoa alterou o registro, a atualização MUST esperar e acontecer só depois.

#### Scenario: Página e filtro mantidos

- **GIVEN** o supervisor na página 2 das saídas, com a situação "Aprovada"
- **WHEN** a tela se atualiza
- **THEN** ela continua na página 2, com o mesmo filtro e a mesma rolagem
- **AND** a lista não some nem mostra "Carregando"

#### Scenario: Formulário em edição

- **GIVEN** o supervisor preenchendo os dados da advertência no detalhe de uma notificação, sem salvar
- **WHEN** passam 15 segundos
- **THEN** o que ele digitou continua nos campos
- **AND** a tela só se atualiza depois que ele salva ou desiste

#### Scenario: Mensagem de sucesso

- **GIVEN** a mensagem de sucesso de uma aprovação no detalhe de uma saída
- **WHEN** a tela se atualiza
- **THEN** a mensagem continua na tela

### Requirement: Pausa depois de 30 minutos sem interação

Depois de 30 minutos sem clique, toque ou tecla, a atualização automática SHALL parar, e a tela MUST mostrar "Atualização pausada" com o botão "Retomar", que busca os dados na hora e volta a contar o tempo. Uma atualização que falhar MUST manter os dados na tela com um aviso discreto e tentar de novo no ciclo seguinte; uma sessão encerrada leva à página de acesso, como nas demais consultas.

#### Scenario: Estação sem uso

- **GIVEN** a lista de saídas aberta e visível
- **WHEN** passam 30 minutos sem interação
- **THEN** a lista deixa de ser consultada
- **AND** a tela mostra "Atualização pausada" e o botão "Retomar"

#### Scenario: Retomar

- **GIVEN** a atualização pausada
- **WHEN** o supervisor clica em "Retomar"
- **THEN** a lista é consultada na hora e volta a se atualizar a cada 15 segundos

#### Scenario: Falha de rede

- **GIVEN** a lista de saídas com pedidos na tela
- **WHEN** uma atualização não consegue falar com o servidor
- **THEN** os pedidos continuam na tela, com um aviso discreto de que a atualização falhou
- **AND** o aviso some na primeira atualização seguinte que der certo

#### Scenario: Sessão encerrada

- **GIVEN** a sessão expirou no servidor
- **WHEN** a tela faz a atualização automática
- **THEN** o sistema abre a página de acesso

### Requirement: Atualização que não mantém a sessão

A atualização automática MUST NOT manter a sessão viva. A sessão SHALL terminar 30 minutos depois da última ação da pessoa que chegou ao servidor, como abrir uma tela, trocar página ou filtro ou gravar, mesmo com a tela se atualizando sozinha nesse tempo (`access-control`, "Sessão guardada no servidor"; monografia, cap. 4). Depois disso, qualquer consulta, automática ou não, MUST ser recusada como sessão encerrada e levar à página de acesso.

#### Scenario: Tela aberta e esquecida

- **GIVEN** a lista de saídas aberta e visível, atualizando-se sozinha
- **WHEN** passam 30 minutos sem nenhuma ação do supervisor
- **THEN** a sessão termina, mesmo com as consultas automáticas feitas nesse tempo
- **AND** a consulta seguinte da tela, sozinha ou por "Retomar", leva à página de acesso

#### Scenario: Ação da pessoa renova a sessão

- **GIVEN** o supervisor sem ação há 20 minutos, com a lista de saídas se atualizando sozinha
- **WHEN** ele troca a página da lista
- **THEN** a sessão passa a terminar 30 minutos depois dessa troca

### Requirement: Imagens carregadas pelo navegador

Imagens que o navegador carrega sozinho, como o QR do WhatsApp e as fotos da conversa, MUST NOT contar como ação da pessoa ao medir os 30 minutos.

#### Scenario: QR trocado sozinho

- **GIVEN** a tela de conexão do WhatsApp aberta, trocando a imagem do QR sozinha
- **WHEN** passam 30 minutos sem nenhuma ação do supervisor
- **THEN** a sessão termina, mesmo com as imagens carregadas nesse tempo

### Requirement: Novo acesso depois da sessão encerrada

O pedido de proteção do login e a recuperação de senha MUST seguir sem a sessão encerrada, em vez de recusá-los, para que o login seguinte entre na primeira tentativa.

#### Scenario: Login depois da sessão encerrada

- **GIVEN** uma sessão encerrada por 30 minutos sem ação
- **WHEN** a pessoa entra com usuário e senha certos na página de acesso
- **THEN** o login entra na primeira tentativa

### Requirement: Sem botão "Atualizar dados"

As telas que se atualizam sozinhas MUST NOT ter o botão "Atualizar dados". Quando uma gravação é recusada porque outra pessoa alterou o registro, a tela SHALL continuar oferecendo "Recarregar dados".

#### Scenario: Detalhe de saída

- **WHEN** o supervisor abre o detalhe de uma saída curta ou longa
- **THEN** a tela não tem o botão "Atualizar dados"

#### Scenario: Conflito de edição

- **GIVEN** outra pessoa alterou a saída longa aberta
- **WHEN** o supervisor tenta reenviar o documento ao responsável
- **THEN** a tela informa que outra pessoa alterou e oferece "Recarregar dados"
