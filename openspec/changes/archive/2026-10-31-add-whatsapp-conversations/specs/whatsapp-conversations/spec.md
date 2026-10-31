# Spec Delta

## Purpose

Permitir que supervisores conversem com responsáveis pelo WhatsApp de dentro do SAGER, com histórico próprio e sem manusear o celular.

## ADDED Requirements

### Requirement: Acesso restrito a supervisores

Somente supervisores SHALL acessar a aba e as rotas de conversas, inclusive arquivos, e MUST NOT existir acesso herdado por gestor, residente ou profissional de saúde.

#### Scenario: Gestor tenta acessar

- **WHEN** um gestor pede a lista de conversas
- **THEN** o sistema recusa com 403

#### Scenario: Arquivo sem sessão

- **WHEN** alguém sem sessão abre o endereço de um arquivo
- **THEN** o sistema recusa o acesso

### Requirement: Lista de conversas

O sistema SHALL listar conversas da mais recente para a mais antiga, com identificação do contato, responsável cadastrado quando houver, última mensagem e indicação de não lidas, e SHALL permitir busca por nome ou telefone.

#### Scenario: Conversa de responsável cadastrado

- **GIVEN** uma conversa de telefone que pertence a um responsável
- **WHEN** o supervisor abre a lista
- **THEN** a conversa mostra o nome cadastrado e os residentes vinculados

#### Scenario: Número desconhecido

- **WHEN** chega mensagem de número sem cadastro
- **THEN** a conversa aparece como não vinculada

### Requirement: Histórico da conversa

O sistema SHALL mostrar texto, imagem, documento e áudio em ordem cronológica, com carregamento de mensagens anteriores, e MUST exibir conteúdo recebido como texto, sem interpretá-lo como HTML.

#### Scenario: Áudio recebido

- **WHEN** chega um áudio do responsável
- **THEN** o supervisor ouve o áudio na própria tela

#### Scenario: Conteúdo malicioso

- **WHEN** chega uma mensagem contendo uma etiqueta de script
- **THEN** a tela mostra o texto literal e nada é executado

#### Scenario: Arquivo indisponível

- **WHEN** o download de um arquivo falha ou o arquivo excede o limite
- **THEN** a mensagem indica a situação em vez de parecer sem anexo

#### Scenario: Nome de arquivo disfarçado

- **WHEN** o remetente envia um arquivo cujo nome tem extensão diferente do tipo real
- **THEN** o nome mostrado e baixado usa a extensão do tipo aceito pelo sistema

### Requirement: Atualização automática moderada

A tela SHALL atualizar a conversa aberta e a lista periodicamente, e MUST pausar a consulta com a aba oculta, e depois de 30 minutos sem interação, oferecendo a retomada.

#### Scenario: Mensagem nova

- **GIVEN** uma conversa aberta
- **WHEN** chega uma mensagem
- **THEN** ela aparece sem recarregar a página e é anunciada a leitores de tela

#### Scenario: Estação sem interação

- **WHEN** passam 30 minutos sem interação
- **THEN** a consulta para e a tela oferece retomar

### Requirement: Envio de mensagens

O supervisor SHALL poder enviar texto, imagem, documento e áudio gravado, vendo o estado de cada envio, e o sistema MUST evitar duplicidade em reenvios da mesma ação.

#### Scenario: Envio de texto

- **WHEN** o supervisor envia um texto
- **THEN** a mensagem aparece como na fila e avança até entregue ou lida

#### Scenario: Clique duplo

- **WHEN** a mesma ação é enviada duas vezes com a mesma chave
- **THEN** apenas uma mensagem é criada

#### Scenario: Falha no envio

- **WHEN** o gateway recusa a mensagem
- **THEN** a mensagem mostra a falha e o texto digitado não se perde

#### Scenario: Gateway desligado

- **GIVEN** um gateway desligado
- **WHEN** o supervisor abre uma conversa
- **THEN** o histórico continua disponível e o envio fica indisponível, com o motivo

#### Scenario: Microfone negado

- **WHEN** o navegador nega acesso ao microfone
- **THEN** a tela explica como permitir e o envio de texto segue disponível

### Requirement: Início de conversa limitado

O supervisor SHALL poder iniciar conversa somente com responsável cadastrado, após o gateway confirmar que o número existe no WhatsApp.

#### Scenario: Número inexistente

- **WHEN** o supervisor inicia conversa com número que não existe no WhatsApp
- **THEN** a tela informa e nenhuma mensagem é enviada

#### Scenario: Gateway com falha na verificação

- **WHEN** o gateway falha sem confirmar que o número não existe
- **THEN** o sistema responde 503, sem afirmar que o número não existe, e nenhuma mensagem é enviada

### Requirement: PDF de autorização no histórico

O PDF enviado pelo fluxo de saída longa SHALL aparecer como mensagem enviada na conversa do responsável, sem novo envio ao WhatsApp, e a falha nesse registro MUST NOT impedir o andamento da saída.

#### Scenario: PDF enviado

- **WHEN** o gateway aceita o PDF de um pedido
- **THEN** a conversa daquele responsável mostra o documento uma única vez, como autorização de saída

#### Scenario: Histórico indisponível

- **WHEN** a gravação na conversa falha depois do envio
- **THEN** a saída segue com o envio registrado

### Requirement: Recuperação de mensagens recebidas

O sistema SHALL buscar no gateway as mensagens recebidas que faltam nas conversas com atividade nas últimas 24 horas, com limite por rodada.

#### Scenario: Webhook perdido em conversa livre

- **GIVEN** uma mensagem recebida que não chegou pelo webhook
- **WHEN** a reconciliação roda
- **THEN** a mensagem aparece uma única vez no histórico

### Requirement: Vínculo manual com saída longa

O supervisor SHALL poder vincular uma imagem ou PDF recebido a uma saída longa aberta do responsável daquela conversa, gerando um arquivo candidato que ainda exige conferência.

#### Scenario: Vínculo manual

- **GIVEN** uma foto não vinculada, com duas saídas abertas
- **WHEN** o supervisor escolhe uma das saídas
- **THEN** a foto vira candidato dela, e a autorização continua pendente

### Requirement: Aviso sobre dados sensíveis

A aba SHALL exibir aviso permanente orientando a não tratar dados de saúde pelo canal, e MUST NOT dar acesso a dados de saúde do sistema.

#### Scenario: Aba aberta

- **WHEN** o supervisor abre as conversas
- **THEN** o aviso aparece e direciona assuntos de saúde ao canal próprio

### Requirement: Auditoria sem conteúdo

O sistema MUST registrar em auditoria envio, início de conversa e vínculo, com autor e horário, e MUST NOT gravar o conteúdo da mensagem na auditoria.

#### Scenario: Mensagem enviada

- **WHEN** o supervisor envia uma mensagem
- **THEN** a auditoria registra quem enviou e quando, sem o texto

### Requirement: Demonstração sem envio real

A demonstração MUST NOT enviar mensagens reais, e SHALL indicar que as conversas exigem o modo local.

#### Scenario: Perfil de demonstração

- **WHEN** um usuário da demonstração abre as conversas
- **THEN** a tela informa a indisponibilidade na demonstração
