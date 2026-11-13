# Spec Delta

## Purpose

Fazer cada troca de página do SAGER custar o mínimo de idas ao servidor e de bytes. Os arquivos imutáveis ficam guardados, a página e os dados chegam sempre frescos, e o usuário vê quando uma navegação está em andamento.

## ADDED Requirements

### Requirement: Arquivos com hash em cache longo

O gateway SHALL responder a cada arquivo de código, estilo ou fonte cujo nome traz o hash do conteúdo com `Cache-Control: public, max-age=31536000, immutable`. A resposta MUST manter os mesmos cabeçalhos de segurança das demais respostas, para que o Cloudflare e o navegador reaproveitem o arquivo sem voltar à origem.

#### Scenario: Arquivo de código com hash

- **WHEN** o navegador pede o `main-<hash>.js` citado pela página publicada
- **THEN** a resposta é 200 com `Cache-Control: public, max-age=31536000, immutable`
- **AND** traz HSTS, CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy` e `Permissions-Policy` iguais aos da página

#### Scenario: Segundo pedido pelo domínio público

- **GIVEN** a versão publicada atrás do Cloudflare
- **WHEN** o mesmo arquivo com hash é pedido duas vezes
- **THEN** a segunda resposta traz `cf-cache-status: HIT`

#### Scenario: Arquivo com hash inexistente

- **WHEN** o navegador pede um `chunk-<hash>.js` que não existe na versão publicada
- **THEN** a resposta é 404
- **AND** a resposta MUST NOT ter cache longo

### Requirement: Página, arquivos sem hash e API sem cache

O gateway SHALL responder `Cache-Control: no-store` à página do sistema em qualquer rota, aos arquivos públicos sem hash no nome (ícones de marca, manifest e imagens) e a toda resposta da API. Assim, uma versão nova ou um dado novo nunca vem de uma cópia guardada.

#### Scenario: Página de acesso

- **WHEN** o navegador abre `/acesso`
- **THEN** a resposta HTML traz `Cache-Control: no-store`

#### Scenario: Ícone de marca

- **WHEN** o navegador pede `/favicon.svg`
- **THEN** a resposta traz `Cache-Control: no-store` e o tipo `image/svg+xml`

#### Scenario: Resposta da API

- **WHEN** o navegador pede `GET /api/v1/auth/csrf`
- **THEN** a resposta traz `Cache-Control: no-store`

#### Scenario: Versão nova publicada

- **GIVEN** uma versão nova publicada com arquivos de hash diferentes
- **WHEN** o usuário recarrega o sistema
- **THEN** recebe a página nova, que aponta para os arquivos novos

### Requirement: Progresso da navegação

Enquanto uma troca de página estiver em andamento, o sistema SHALL mostrar uma barra fina no topo da tela e marcar o conteúdo principal como ocupado para tecnologias assistivas. A barra MUST sumir quando a navegação terminar, for cancelada ou falhar.

#### Scenario: Página que demora

- **WHEN** o usuário escolhe uma página no menu e ela ainda não terminou de abrir
- **THEN** a barra aparece no topo
- **AND** o conteúdo principal fica marcado como ocupado

#### Scenario: Navegação concluída

- **WHEN** a página nova termina de abrir
- **THEN** a barra some e o conteúdo principal deixa de estar marcado como ocupado

#### Scenario: Navegação que falha

- **WHEN** a navegação é cancelada ou falha
- **THEN** a barra some e a página anterior continua utilizável

#### Scenario: Movimento reduzido

- **GIVEN** o sistema operacional pede movimento reduzido
- **WHEN** uma navegação está em andamento
- **THEN** a barra aparece sem animação

### Requirement: Sessão verificada ao abrir o sistema

O sistema SHALL consultar a sessão no servidor ao abrir ou recarregar uma página protegida e sempre que ainda não souber quem é o usuário. As trocas de página seguintes MUST NOT consultar a sessão de novo e MUST continuar respeitando o perfil já conhecido.

#### Scenario: Entrar e navegar

- **GIVEN** um supervisor que acabou de entrar
- **WHEN** ele abre Início, Residentes, Quartos e Limpeza pelo menu
- **THEN** a sessão foi consultada no servidor uma única vez desde a entrada

#### Scenario: Recarregar a página

- **GIVEN** um usuário com sessão ativa
- **WHEN** ele recarrega uma página protegida
- **THEN** o sistema consulta a sessão uma vez e mostra a página

#### Scenario: Perfil sem permissão

- **GIVEN** um residente já identificado
- **WHEN** um link interno o leva a `/residentes`
- **THEN** o sistema mostra o acesso negado sem consultar a sessão de novo

### Requirement: Sessão encerrada tratada em um só lugar

Quando uma chamada à API responder 401 enquanto há um usuário conhecido, o sistema SHALL esquecer o usuário, descartar as listas e o token guardados em memória e levar à página de acesso. Um 401 sem usuário conhecido, como a senha errada no login, MUST NOT redirecionar.

#### Scenario: Sessão expirada durante o uso

- **GIVEN** um gestor com a lista de residentes aberta
- **WHEN** a sessão expira no servidor e ele muda de página na lista
- **THEN** o sistema abre a página de acesso
- **AND** o menu do usuário anterior deixa de aparecer

#### Scenario: Senha errada

- **WHEN** alguém envia matrícula e senha incorretas
- **THEN** continua na página de acesso com a mensagem de credenciais inválidas

### Requirement: Token CSRF reaproveitado

As gravações SHALL reutilizar o token CSRF obtido uma vez na sessão, sem pedir um token antes de cada gravação. O token MUST ser descartado ao entrar e ao sair. Uma recusa 403 `csrf_invalid` MUST obter um token novo e repetir a gravação uma única vez.

#### Scenario: Duas gravações seguidas

- **GIVEN** um gestor que entrou no sistema
- **WHEN** ele salva dois cadastros de residente
- **THEN** o token CSRF foi pedido uma única vez

#### Scenario: Nova entrada

- **GIVEN** um usuário que saiu e entrou de novo na mesma aba
- **WHEN** ele salva um registro
- **THEN** o sistema usa um token novo, obtido depois da nova entrada

#### Scenario: Token recusado

- **WHEN** o servidor recusa uma gravação com 403 `csrf_invalid`
- **THEN** o sistema pede um token novo e repete a gravação uma vez
- **AND** se a repetição for recusada de novo, mostra o erro sem tentar outra vez

### Requirement: Fonte de ícones leve

Os ícones SHALL vir de uma fonte servida pela própria origem que contém só os ícones usados pelo sistema e tem menos de 100 kB. Todo ícone usado numa tela MUST aparecer desenhado, nunca como o nome do ícone em texto.

#### Scenario: Abrir o sistema

- **WHEN** o navegador abre o sistema pela primeira vez
- **THEN** a fonte de ícones baixada tem menos de 100 kB

#### Scenario: Ícone novo sem fonte gerada de novo

- **GIVEN** uma tela que passa a usar um ícone fora da fonte
- **WHEN** os testes do projeto rodam
- **THEN** a verificação falha e nomeia o ícone que falta

### Requirement: Código das páginas pré-carregado

Depois que o sistema abre, o navegador SHALL baixar em segundo plano o código de todas as páginas. A primeira visita a uma página MUST NOT esperar o download do código dessa página.

#### Scenario: Primeira visita aos quartos

- **GIVEN** um gestor que entrou e esperou o sistema terminar de carregar
- **WHEN** ele abre Quartos pela primeira vez
- **THEN** nenhum arquivo de código é pedido ao servidor nessa navegação

### Requirement: Listas de referência reaproveitadas

As listas de residentes e de cursos e o mapa de quartos SHALL ser reaproveitados na mesma aba por até 60 segundos. Qualquer gravação feita pelo próprio usuário MUST descartar essas cópias, e entrar, sair ou perder a sessão também.

#### Scenario: Paginar responsáveis

- **WHEN** o gestor abre Responsáveis e clica em Próxima três vezes em menos de 60 segundos
- **THEN** a lista completa de residentes é pedida ao servidor uma única vez

#### Scenario: Gravação do próprio usuário

- **GIVEN** a lista de residentes guardada
- **WHEN** o gestor salva um residente e volta a uma tela que usa a lista
- **THEN** a lista é pedida de novo ao servidor

#### Scenario: Alteração feita por outra pessoa

- **WHEN** outro usuário altera um curso
- **THEN** a alteração aparece em no máximo 60 segundos, ou logo ao recarregar a página

### Requirement: Listas de referência pedidas ao mesmo tempo

Uma tela que precisa de mais de uma lista de referência SHALL pedir todas ao mesmo tempo, sem esperar uma resposta para começar o pedido seguinte.

#### Scenario: Abrir residentes

- **WHEN** o gestor abre Residentes
- **THEN** os pedidos de cursos e do mapa de quartos começam antes de qualquer um deles responder

#### Scenario: Uma das listas falha

- **WHEN** o pedido de cursos ou o do mapa falha
- **THEN** a tela avisa que não carregou todas as opções de curso e alojamento
- **AND** a lista de residentes continua carregando

### Requirement: Detalhe do quarto com só os moradores

O detalhe de um quarto SHALL buscar apenas os residentes alocados naquele quarto, e não a lista completa de residentes.

#### Scenario: Abrir um quarto

- **WHEN** o supervisor abre o detalhe de um quarto com dois moradores
- **THEN** o pedido de residentes vem filtrado por esse quarto
- **AND** os dois moradores aparecem com nome e curso, como antes

### Requirement: Feedback da limpeza igual ao ranking

Na lista de avaliações de limpeza, tanto na gestão quanto na do residente, cada avaliação SHALL trazer a média e a posição do quarto na semana iguais às do ranking semanal daquela semana. Isso vale também quando várias avaliações da mesma página caem na mesma semana.

#### Scenario: Três avaliações na mesma semana

- **GIVEN** três quartos avaliados na mesma semana, dois empatados
- **WHEN** o supervisor abre a lista de avaliações
- **THEN** cada avaliação traz a mesma média e a mesma posição que o ranking semanal mostra para o seu quarto

#### Scenario: Lista do residente

- **WHEN** o residente abre as próprias avaliações
- **THEN** a média e a posição de cada uma são iguais às da lista da gestão

### Requirement: Código inicial dentro do orçamento

O código carregado ao abrir o sistema SHALL somar no máximo 500 kB antes da compressão. Os componentes visuais MUST continuar sem animação, como hoje.

#### Scenario: Versão de produção

- **WHEN** a versão de produção é gerada
- **THEN** o total inicial fica em até 500 kB, sem aviso de orçamento

#### Scenario: Diálogo

- **WHEN** o usuário abre um diálogo de confirmação
- **THEN** o diálogo aparece sem animação, como hoje
