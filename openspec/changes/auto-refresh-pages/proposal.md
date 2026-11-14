## Why

O dono do produto pediu (14/11/2026) que as páginas se atualizem sozinhas, sem F5: hoje o supervisor nas saídas só vê um pedido novo depois de recarregar a página ou clicar em "Atualizar dados". O sistema deve ser simples para servidores com pouca prática e para quem tem TDAH: um caminho claro por tela, sem botão que repete o que o sistema pode fazer sozinho. Só as conversas se atualizam hoje (`whatsapp-conversations`, "Atualização automática moderada"), e os relatórios só enquanto há arquivo em preparo (`report-generation`, "Andamento automático").

## What Changes

- As listas e os detalhes de saídas (curta e longa, do supervisor e do residente), notificações, advertências, termos, reincidências, avisos do supervisor, comunicações do residente, limpeza (gestão e do residente), ranking, residentes, quartos, alojamentos, responsáveis, supervisores e relatórios gerados, a chamada noturna e o início do residente passam a buscar os dados de novo a cada 15 segundos com a aba visível, e logo ao voltar à aba.
- A atualização é silenciosa: não esvazia a lista, não mostra "Carregando", não move o foco, mantém página, filtros, rolagem e mensagens. Com dados digitados e não gravados, diálogo aberto, gravação em andamento ou aviso de conflito, ela espera.
- Depois de 30 minutos sem clique, toque ou tecla, a atualização para e a tela mostra "Atualização pausada" com "Retomar". Uma falha mantém os dados com um aviso discreto e tenta de novo no ciclo seguinte; 401 segue o tratamento atual de `page-loading` ("Sessão encerrada tratada em um só lugar").
- A atualização automática não mantém a sessão viva: a sessão continua terminando 30 minutos depois da última ação da pessoa (`access-control`, "Sessão guardada no servidor"; monografia, cap. 4, sessão com expiração após 30 minutos de inatividade), mesmo com a tela se atualizando sozinha. O servidor passa a ignorar as consultas automáticas ao contar esse tempo.
- O botão "Atualizar dados" sai de todas essas telas. "Recarregar dados", do conflito de edição (`plain-language`, "Erros que dizem o que fazer"), continua.
- O mecanismo das conversas vira um utilitário comum em `frontend/src/app/core`. As conversas mantêm 5 s na conversa aberta e 15 s na lista, e passam a usar o mesmo aviso "Atualização pausada" / "Retomar".
- Relatórios: continuam com a consulta rápida enquanto há arquivo em preparo e passam a 15 s quando não há, com a mesma pausa das outras telas.
- `list-browsing`, "Páginas de 25 que substituem a lista": a frase final deixa de dizer que só as conversas se atualizam sozinhas.

**Fora do escopo:** WebSocket, SSE ou outro envio pelo servidor; notificação push; som; rotas e respostas novas na API; mudança no tempo de sessão do servidor (`access-control`, "Sessão guardada no servidor"); modo demonstração (RF027), cujos dados ficam na memória e nunca mudam por outra pessoa; formulários de cadastro e edição, cursos, consulta de relatório, relatório individual, perfil, ajuda e início de gestor e supervisor, que continuam sem atualização automática.

## Capabilities

### New Capabilities

- `auto-refresh`: telas que se atualizam sozinhas a cada 15 segundos, sem interromper quem está usando, com pausa após 30 minutos sem interação, sem manter a sessão viva e sem o botão "Atualizar dados".

### Modified Capabilities

- `list-browsing`: "Páginas de 25 que substituem a lista" mantém "Carregar mais" só nas conversas, sem dizer que elas são a única lista que se atualiza.
- `report-generation`: "Andamento automático" continua consultando a cada 15 segundos quando nada está em preparo e pausa como as demais telas.

## Impact

- Frontend `core/`: utilitário de atualização novo (a partir de `features/communications/conversation-polling.ts`), recarga silenciosa em `list-page.ts` e opção de ignorar a cópia de 60 s em `api.ts`; `shared/`: aviso comum de pausa e de falha.
- Frontend por área: `operations` (saídas, saída longa, chamada), `communications` (notificações, advertências, reincidências, termos, avisos, comunicações do residente, conversas), `management` (residentes, quartos, alojamentos, responsáveis, supervisores e seus detalhes), `cleaning` (lista, detalhe, ranking, limpeza do residente), `reports` (`ReportListPolling`) e `portal` (`local-home.page.ts`, ajuda).
- Testes: IT JUnit da sessão em `AuthFlowIntegrationTest`; Vitest focados por área; e2e `operations-local.spec.ts` (pedido novo sem recarregar), `long-exits-local.spec.ts` e `conversations-local.spec.ts` (botões que mudam de nome ou saem).
- Documentação: `docs/MANUAL.md` (frase curta e tabela "Quando algo dá errado"), `docs/ARQUITETURA.md` (decisão, sessão e contagem de capacidades) e texto da página Ajuda. `AGENTS.md` não muda: nenhuma regra de domínio ou permissão muda.
- Servidor: mais consultas de leitura, uma a cada 15 segundos por aba visível. Backend `auth/`: a sessão guarda a hora da última ação da pessoa, as consultas marcadas como automáticas não a renovam, e uma requisição que chega mais de 30 minutos depois dela encerra a sessão com 401, salvo o pedido de proteção do login e a recuperação de senha, que seguem como anônimos, e as imagens que o navegador carrega sozinho não renovam a hora (design.md, D11).
