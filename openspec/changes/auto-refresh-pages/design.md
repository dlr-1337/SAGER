## Context

Motivação em proposal.md. Estado atual, conferido no código:

- `features/communications/conversation-polling.ts` (`ConversationPolling`) já faz a consulta das conversas: `setTimeout` reagendado só depois da resposta, nenhuma consulta com a aba oculta, consulta na hora ao voltar à aba, parada depois de 30 minutos sem `pointerdown` ou `keydown` (estado `idle`) e estado `expired` num 401. As conversas usam 5 s na conversa aberta e 15 s na lista, e mostram "A atualização automática parou após 30 minutos sem interação." com "Retomar atualização".
- `ReportListPolling` (`features/reports/reports-local.utils.ts`) consulta a cada 3 s só enquanto há arquivo em preparo, sem pausa com a aba oculta.
- As demais telas buscam os dados só ao abrir, ao trocar filtro ou página e no botão "Atualizar dados". Esse botão existe em nove telas: detalhes da saída curta, da saída longa, da notificação, da advertência, do aviso, da comunicação do residente, do termo e da avaliação de limpeza, e a reincidência do residente. Em todas, menos na avaliação de limpeza, ele dá lugar a "Recarregar dados" quando a gravação é recusada por conflito de versão.
- O `load()` das listas esvazia os itens, liga "Carregando" e limpa erro (ex.: `exits-local.component.ts`). `cursorPages().reload()` (`core/list-page.ts`) descarta todas as páginas guardadas e volta à primeira.
- `core/api.ts` guarda por 60 s as listas de residentes, cursos e o mapa de quartos (`cached`). A tela de quartos usa o mapa como dado principal.
- `shared/unsaved-forms.ts` (`UnsavedForms`) registra os formulários marcados com `sagerUnsaved` e diz se algum está alterado ou gravando. Os painéis de filtro não são registrados.
- A sessão do servidor expira 30 minutos depois da última requisição (`access-control`, "Sessão guardada no servidor"); `SESSION_IDLE_MS` em `core/api.ts` repete esse valor. O Spring Session conta qualquer requisição como uso, e `api()` adia `ACCOUNT_OPEN` a cada resposta aceita. `auth/LocalAccountStatusFilter` já encerra a sessão com 401 quando a conta deixa de valer. Um 401 com usuário conhecido já leva à página de acesso (`page-loading`, "Sessão encerrada tratada em um só lugar").
- O início do residente (`local-home.page.ts`) só tem atalhos fixos; o único dado do servidor é `maiorDeIdade`, da conta conectada, que troca "Minhas saídas" pelo aviso de horário (`exit-eligibility`).

## Goals / Non-Goals

**Goals:**

- Mostrar em até 15 segundos o que outra pessoa ou o sistema mudou, sem F5 nem botão.
- Nunca apagar o que a pessoa digitou, nem tirar a lista, a página, o filtro, a rolagem ou o foco do lugar.
- Não manter consultas ligadas numa estação esquecida, nem deixar que elas mantenham a sessão viva além de 30 minutos sem ação da pessoa (monografia, cap. 4).

**Non-Goals:**

- Envio pelo servidor (WebSocket, SSE), push ou som.
- Criar rotas na API ou mudar o tempo de sessão. O backend muda só para ignorar as consultas automáticas ao contar a inatividade (D11).
- Atualizar formulários de cadastro e edição ou a demonstração.

## Decisions

### D1. Consulta a cada 15 segundos, não envio pelo servidor

Cada tela coberta pede de novo os seus dados a cada 15 s, com as rotas de leitura que já existem.
*Rejeitada:* WebSocket ou SSE. Exigiria canal novo no backend, configuração no gateway Nginx e tratamento de sessão no canal, e o dono deixou fora do escopo. *Rejeitada:* 5 s em todas as telas. Triplica as consultas sem necessidade fora das conversas.

### D2. Um utilitário comum em `core/`, a partir do das conversas

`ConversationPolling` sai de `features/communications` e vira um utilitário em `core/` com o intervalo como parâmetro (15 s por padrão), mantendo o reagendamento depois da resposta, a pausa com aba oculta, a consulta na hora ao voltar à aba e a parada após `SESSION_IDLE_MS` sem `pointerdown` ou `keydown`. Ele não liga na demonstração. As conversas passam a usá-lo com 5 s e mantêm a lista em 15 s, como hoje. O estado `expired` sai: um 401 com usuário conhecido já leva à página de acesso antes de a faixa aparecer.
*Rejeitada:* `setInterval` em cada página. Acumula pedidos quando o servidor demora e não pausa. *Rejeitada:* copiar a lógica das conversas para cada área. Seriam várias cópias da mesma regra de 30 minutos.

### D3. Recarga silenciosa nas páginas e nas listas por cursor

O carregamento de cada tela ganha um modo silencioso: não esvazia itens, não liga "Carregando", não limpa sucesso, erro nem conflito, não move o foco, e descarta a resposta se o filtro ou a página mudou enquanto ela vinha (o contador de sequência que as telas já têm). Nas listas por deslocamento, a consulta repete o mesmo deslocamento; se a página deixou de existir, vale o ajuste que já existe, sem levar o foco ao título. Em `cursorPages`, uma função `refresh()` pede de novo a página atual com o mesmo cursor, troca só essa página e descarta as páginas seguintes guardadas, cujo cursor pode ter mudado; as anteriores continuam como foram vistas até serem abertas de novo (`list-browsing`, "Voltar à página anterior").
*Rejeitada:* chamar o `load()` atual. Pisca a lista, perde a rolagem e apaga mensagens. *Rejeitada:* nas listas por cursor, recarregar da primeira página. Tira a pessoa da página em que está.

### D4. Quando a atualização espera

Em cada ciclo, o utilitário pula a consulta (e tenta no ciclo seguinte) quando `UnsavedForms` tem formulário alterado ou gravando, quando há diálogo aberto (`MatDialog.openDialogs`) ou quando a tela informa que está ocupada: gravação em andamento, conflito mostrado ou campo digitado fora de formulário registrado. Com o conflito à vista, os dados só mudam quando a pessoa usa "Recarregar dados", para ela ver a mudança acontecer.
*Rejeitada:* atualizar e mesclar o que foi digitado. Misturaria versões do registro e arriscaria gravar sobre dado que a pessoa não viu. *Rejeitada:* esperar com qualquer `FormGroup` alterado. O painel de filtro alterado travaria a atualização para sempre.

### D5. Falha discreta, sessão encerrada como hoje

Uma atualização que falha mantém os dados e mostra, perto do título, uma linha com `role="status"`: "Não foi possível atualizar. A tela tenta de novo sozinha.", que some na próxima consulta bem-sucedida. O 401 continua no tratamento central de `core/api.ts`. O primeiro carregamento da tela continua com o bloco de erro e "Tentar novamente".
*Rejeitada:* trocar a lista pelo bloco de erro. Tiraria da tela dados ainda úteis por causa de uma falha passageira. *Rejeitada:* espera crescente entre tentativas. 15 s já é moderado, e a regra fica mais simples de explicar.

### D6. Um só aviso de pausa, também nas conversas

Um componente em `shared/` mostra "Atualização pausada" e o botão "Retomar" (`role="status"`) em todas as telas cobertas, inclusive nas conversas, que deixam o texto e o botão próprios.
*Rejeitada:* manter o texto das conversas. Seriam dois textos para a mesma situação, contra o pedido de um caminho claro. *Rejeitada:* nunca pausar. As conversas já exigem a pausa (`whatsapp-conversations`, "Atualização automática moderada"), e a tela esquecida só pararia de consultar no primeiro 401.

### D7. Dado principal sem a cópia de 60 s

A atualização automática pede o dado principal da tela ao servidor mesmo que haja cópia de 60 s e renova a cópia (`cached` com opção de ignorar a cópia). Isso vale para o mapa na tela de quartos; as listas usadas só como opção de filtro continuam com a cópia (`page-loading`, "Listas de referência reaproveitadas").
*Rejeitada:* usar a cópia. Na tela de quartos, a mudança de outra pessoa poderia levar até 60 s, e não 15 s.

### D8. Relatórios: rápido em preparo, 15 s fora dele

`ReportListPolling` passa a usar o utilitário: 3 s enquanto há arquivo em preparo, 15 s quando não há, com a mesma pausa.
*Rejeitada:* parar quando nada está em preparo, como hoje. O dono incluiu os relatórios gerados, e a lista muda sozinha quando um relatório expira ou quando a pessoa gera outro em outra aba.

### D9. Início do residente confere a conta

No início do residente, a atualização consulta de novo a conta conectada, a mesma consulta de "Troca de conta em outra aba" (`page-loading`), para trocar "Minhas saídas" pelo aviso de horário quando o residente faz 18 anos. As trocas de página continuam sem consultar a sessão.
*Rejeitada:* deixar o início de fora. O dono incluiu essa tela, e a maioridade é o único dado dela que o sistema muda.

### D10. Telas cobertas e botão retirado

Ficam cobertas as listas e os detalhes das áreas que o dono listou. Termos e reincidências entram com as advertências, por serem a mesma área (disciplina), e o detalhe da avaliação de limpeza e a limpeza do residente entram com a limpeza. Assim "Atualizar dados" sai de todas as telas; "Recarregar dados" e "Tentar novamente" continuam. Formulários de cadastro e edição, cursos, consulta de relatório, relatório individual, perfil, ajuda e início de gestor e supervisor ficam de fora.
*Rejeitada:* só as telas literalmente listadas. "Atualizar dados" ficaria em sete telas, e a pessoa teria dois jeitos de ver dado novo conforme a tela.

### D11. Consultas automáticas não renovam a sessão

Toda consulta feita pelo utilitário (inclusive conversas, relatórios e a conta no início do residente) vai com o cabeçalho `X-Sager-Auto-Refresh: 1` e não adia `ACCOUNT_OPEN`. O servidor guarda na sessão a hora da última ação da pessoa, gravada no login e em cada requisição sem esse cabeçalho. O próprio `LocalAccountStatusFilter`, que já confere a conta, confere toda requisição com sessão: se passaram mais de 30 minutos (`SAGER_SESSION_TIMEOUT`) desde a última ação, invalida a sessão e responde 401, como numa sessão expirada, e o tratamento central de `core/api.ts` leva à página de acesso. Valem as duas exceções abaixo. A consulta de "Retomar" é ação da pessoa e vai sem o cabeçalho; a da volta à aba vai com ele. O cabeçalho só deixa de renovar a hora; enviá-lo de propósito nunca prolonga a sessão. Numa tela esquecida, a pausa dos 30 minutos (D6) chega junto com o fim da sessão: a tela para de consultar, e a consulta seguinte, inclusive por "Retomar", leva à página de acesso.
*Rejeitada:* aceitar até 1 hora de sessão numa tela aberta e esquecida (30 minutos de consultas mais 30 de expiração). Contraria a expiração após 30 minutos de inatividade da monografia (cap. 4) e de `access-control`, e deixaria a conta usável por mais tempo num computador compartilhado. *Rejeitada:* pausar antes, aos 15 minutos. Encurta o problema sem resolvê-lo, porque as consultas ainda renovariam a sessão.

Exceções:

- `GET /api/v1/auth/csrf` e `POST /api/v1/auth/recover` com sessão ociosa ou conta que deixou de valer não recebem 401: o filtro invalida a sessão e o pedido segue como anônimo (o de `csrf` cria a sessão nova com o token novo), para o login e a recuperação seguintes darem certo na primeira tentativa. *Rejeitada:* responder 401 também a eles. O pedido de proteção do login falhava, e o primeiro login depois da sessão encerrada parecia senha errada.
- Os `GET` que o navegador faz sozinho por `<img>`, sem o cabeçalho, não renovam a última ação: o QR do WhatsApp (`/api/v1/conversas/sessao/qr`), a mídia da conversa (`/api/v1/conversas/mensagens/{id}/midia`) e a prévia da autorização da saída longa (`/api/v1/saidas-longas/{id}/autorizacao/arquivos/{fileId}`). Com a sessão ociosa, eles também recebem 401. Como a regra olha a rota, baixar esses mesmos arquivos por clique (link de download) também não renova a última ação; erra para o lado de encerrar antes. *Rejeitada:* buscar essas imagens por `api()`, com o cabeçalho, e mostrá-las por URL de objeto. Cada tela teria de buscar, guardar e liberar cada imagem só para enviar um cabeçalho.

## Risks / Trade-offs

- **Clique sem consulta não renova a sessão.** Rolar, ler ou clicar sem abrir tela, trocar página ou filtro ou gravar não chega ao servidor; 30 minutos assim encerram a sessão, como já acontece hoje sem a atualização automática. → O 401 leva à página de acesso pelo tratamento central.
- **Carga no servidor.** Uma consulta de leitura a cada 15 s por aba visível; 100 abas abertas dão cerca de 7 consultas por segundo, quase todas de 25 linhas. O mapa de quartos é a maior. O requisito não funcional de desempenho da monografia (cap. 4: respostas em até 2 segundos, 50 transações por minuto no pico) não contava com essas leituras; 20 abas visíveis já somam 80 por minuto. → Abas ocultas e estações paradas não consultam; o ensaio de carga do cap. 5 (300 leituras, nenhuma acima de 2 s) é a referência, e a medição na VPS segue pendente (D24).
- **Leitores de tela.** Regiões `aria-live` que mostram contagem (ex.: "N pedidos") anunciam a mudança quando o total muda. → É a informação nova; a atualização sem mudança não altera o texto e não é anunciada.
- **Versão usada nas ações.** A atualização troca a versão que a próxima ação envia. Como ela espera com dado digitado, diálogo aberto ou conflito, a ação usa a versão que a pessoa viu, e o 409 continua protegendo.
- **Testes com tempo.** Testes que contam pedidos podem ver consultas extras se passarem de 15 s numa tela. → Os testes de tempo usam relógio controlado (Vitest com timers falsos, Playwright `page.clock`).

## O que o dono ou a instituição ainda decide

- Se cursos, a consulta de relatório e o relatório individual também devem se atualizar sozinhos.
- Se 15 segundos bastam na chamada noturna quando dois supervisores marcam o mesmo alojamento.
- Se a carga das consultas automáticas cabe no requisito de desempenho da monografia (50 transações por minuto no pico, respostas em até 2 s), medida na VPS antes de ligar em produção.
