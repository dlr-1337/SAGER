## Why

No celular, os painéis de filtro ocupam a primeira tela inteira: de 4 a 9 campos de 48 px, um embaixo do outro, e Notificações e Advertências têm dois painéis cada. As listas por cursor usam "Carregar mais", que deixa a página cada vez mais longa e não deixa voltar uma página. Hoje convivem três modelos de paginação e quatro estilos de painel, e o mesmo código de cursor está copiado em seis telas. O ranking mostra os 93 quartos numa lista só, e o residente precisa rolar até achar o próprio quarto.

A mudança atende ao RNF de usabilidade e acessibilidade da monografia (cap4.tex:201: interface responsiva para computador e celular, navegação por teclado, foco visível, rótulos explícitos, alvos de 44 × 44 px e nenhuma rolagem horizontal em 320 px), à paginação como componente compartilhado com comportamento comum entre páginas (cap6.tex:48 e :77), ao achado "Filtros mantidos ocultavam registros", resolvido com "Limpar filtros" (cap8.tex:134), ao RF012 (cap4.tex:118: ranking por semana, mês ou semestre, que continua igual) e à regra do AGENTS.md de manter as ações importantes rotuladas e preservar o design responsivo aprovado. O padrão já aprovado em DESIGN.md para Relatórios ("filtros opcionais recolhidos, com os ativos sempre à vista e removíveis") serve de modelo para as demais listas longas; o formulário de Relatórios fica como está, porque a Figura 070 (cap7.tex:88-101) mostra essa tela. A busca e os filtros ativos continuam sempre à vista; só os filtros extras ficam recolhíveis.

## What Changes

- Painel de filtro compartilhado: busca sempre visível, demais filtros numa área recolhível "Mais filtros", filtros ativos como chips sempre visíveis e removíveis, com "Limpar filtros". A área abre em telas com mais de 760 px, fica fechada no celular e o estado é lembrado por tela durante a sessão.
- Paginação compartilhada de 25 itens: com total ("26–50 de 312") ou sem total, nas listas por cursor ("Página 2", Anterior e Próxima). Some quando a lista cabe numa página, e trocar de página leva o foco ao título da lista.
- Todo "Carregar mais" das telas adotadas vira Anterior e Próxima, que substituem a página em vez de acrescentar itens.
- Adoção, nesta ordem: avaliações de limpeza (filtro aplicado sozinho, sem o botão "Buscar avaliações"); ranking (25 por página, com o próprio quarto do residente fixo no topo); notificações, advertências, avisos, minhas comunicações e termos (um único painel por tela); saídas (sem o botão "Buscar"); residentes, responsáveis, cursos, supervisores e alojamentos; relatórios (só as linhas da consulta são paginadas).
- A lista da chamada noturna continua inteira: só os filtros extras passam a ser recolhíveis.
- As opções de filtro (residentes, alojamentos, casas e quartos) são buscadas uma vez ao abrir a tela, e não a cada filtro ou página.
- **BREAKING** (só interface): somem os botões "Buscar avaliações", "Buscar" (saídas, notificações, advertências) e todos os "Carregar mais …" das telas adotadas.
- O modo demonstração (RF027, cap4.tex:133) continua e acompanha a mudança nas telas que ele compartilha com o acesso por conta: residentes, responsáveis, supervisores e alojamentos paginam no cliente com a mesma paginação, residentes e responsáveis usam o mesmo painel, e as linhas de relatório da demonstração passam a vir em páginas de 25. Nenhuma carga nova chama a API com a demonstração ativa.

**Fora do escopo:**
- O mapa de quartos (`/quartos`), adotado logo depois pela mudança `simplify-room-browsing`. Esta mudança só ajusta os testes do mapa que dependem da paginação compartilhada.
- A lista de conversas do WhatsApp, que atualiza sozinha e tem interface de chat própria (capability `whatsapp-conversations`).
- O total em listas por cursor ("26–50 de N"), que exigiria contagens novas no backend.
- Filtro por alojamento no ranking e mudança na regra de posição.
- Telas novas de auditoria ou de histórico de chamadas.
- Mudanças no backend, em permissões ou em regras de domínio do AGENTS.md.
- As telas só da demonstração (`operations/ranking.component.ts`, `exits.component.ts`, `notifications.component.ts`, `night-call.component.ts` e `cleaning.component.ts`, e `communications/notices.page.ts`), que ficam iguais, para preservar a Figura 031 (cap7.tex:38-52), as capturas da demonstração (cap7.tex:20) e o ranking no menu do residente da demonstração (cap8.tex:136).
- O formulário de filtros de Relatórios (`<details class="report-filters">`, fechado, com o rótulo atual), que não adota o painel compartilhado (Figura 070, cap7.tex:88-101).
- O módulo de saúde, removido pela mudança `remove-health-module` antes desta.
- O cache das listas de referência e a memória do ranking no backend, que ficam com a mudança `speed-up-navigation`.

## Capabilities

### New Capabilities

- `list-browsing`: como o usuário filtra e percorre listas longas: painel de filtro com busca à vista e extras recolhíveis, filtros ativos removíveis, paginação de 25 com ou sem total, foco ao trocar de página, ranking paginado e chamada noturna inteira.

### Modified Capabilities

Nenhuma. O requisito "Filtros opcionais recolhidos" de `report-generation` continua como está: Relatórios mantém a área fechada e só as linhas da consulta passam a ser paginadas, pelo requisito "Páginas de 25 que substituem a lista" de `list-browsing`.

## Impact

- **Frontend novo:** `frontend/src/app/shared/filter-panel.component.ts`, helper `cursorPages` em `frontend/src/app/core/list-page.ts`, regras `.filter-panel` em `frontend/src/styles.scss`.
- **Frontend alterado:** `shared/pagination.component.ts`; `features/cleaning/cleaning-local.pages.ts` e `cleaning-local-api.service.ts`; `features/communications/communication-filters.component.ts`, `notifications-local.pages.ts`, `warnings-local.pages.ts`, `notices-local.pages.ts`, `own-communications-local.pages.ts`, `recurrence-local.pages.ts`; `features/operations/exits-local.component.ts` e `night-call-local.component.ts`; `features/management/residents.component.ts`, `guardians.pages.ts`, `courses.page.ts`, `supervisors.component.ts`, `accommodations.component.ts`; `features/reports/reports-local.pages.ts` (só as linhas da consulta), `reports-local-api.service.ts` e `reports-demo-api.service.ts` (páginas de 25 na demonstração).
- **Testes:** specs unitários das peças compartilhadas e das telas; e2e `cleaning-reports-local`, `communications-local`, `notices-mobile`, `operations-local`, `long-exits-local`, `management-pagination-local`, `supervisors-local`, `rooms-local`, `enrollment-catalog-recovery`, além de novos cenários a 320 e 390 px com axe; na demonstração, `management-demo-pagination.spec.ts`, `reports.pages.spec.ts` e os e2e `management-pagination-demo`, `journeys` e `visual-review`.
- **Documentação:** `DESIGN.md` (padrão de lista; o item "Relatório" não muda).
- **Backend, API e banco:** sem mudança. Os endpoints de cursor já aceitam `limit=25`, e as linhas de relatório aceitam `offset` e `limit`.
- **Dependências:** nenhuma nova. O Angular Material continua só com diálogos.
