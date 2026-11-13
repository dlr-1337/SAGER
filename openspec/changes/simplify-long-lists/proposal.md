## Why

No celular, os painéis de filtro ocupam a primeira tela inteira: de 4 a 9 campos de 48 px, um embaixo do outro, e Notificações e Advertências têm dois painéis cada. As listas por cursor usam "Carregar mais", que deixa a página cada vez mais longa e não deixa voltar uma página. Hoje convivem três modelos de paginação e quatro estilos de painel, e o mesmo código de cursor está copiado em seis telas. O ranking mostra os 93 quartos numa lista só, e o residente precisa rolar até achar o próprio quarto.

A mudança atende ao PRD (web responsiva para computador e celular; "filtros e exportações visíveis"), ao AC67 (filtros ativos visíveis e removíveis), ao AC66 (ranking por semana, mês e semestre, que continua igual) e à regra do AGENTS.md de manter as ações importantes rotuladas e preservar o design responsivo aprovado. O padrão já aprovado em DESIGN.md para Relatórios ("filtros opcionais recolhidos, com os ativos sempre à vista e removíveis") passa a valer para todas as listas longas. A busca e os filtros ativos continuam sempre à vista; só os filtros extras ficam recolhíveis.

## What Changes

- Painel de filtro compartilhado: busca sempre visível, demais filtros numa área recolhível "Mais filtros", filtros ativos como chips sempre visíveis e removíveis, com "Limpar filtros". A área abre em telas com mais de 760 px, fica fechada no celular e o estado é lembrado por tela durante a sessão.
- Paginação compartilhada de 25 itens: com total ("26–50 de 312") ou sem total, nas listas por cursor ("Página 2", Anterior e Próxima). Some quando a lista cabe numa página, e trocar de página leva o foco ao título da lista.
- Todo "Carregar mais" das telas adotadas vira Anterior e Próxima, que substituem a página em vez de acrescentar itens.
- Adoção, nesta ordem: avaliações de limpeza (filtro aplicado sozinho, sem o botão "Buscar avaliações"); ranking (25 por página, com o próprio quarto do residente fixo no topo); notificações, advertências, avisos, minhas comunicações e termos (um único painel por tela); saídas (sem o botão "Buscar"); residentes, responsáveis, cursos, supervisores e alojamentos; relatórios (o formulário passa a usar o painel compartilhado, e as linhas da consulta são paginadas).
- A lista da chamada noturna continua inteira: só os filtros extras passam a ser recolhíveis.
- As opções de filtro (residentes, alojamentos, casas e quartos) são buscadas uma vez ao abrir a tela, e não a cada filtro ou página.
- **BREAKING** (só interface): somem os botões "Buscar avaliações", "Buscar" (saídas, notificações, advertências) e todos os "Carregar mais …" das telas adotadas. No computador, os filtros opcionais de Relatórios passam a abrir expandidos.

**Fora do escopo:**
- O mapa de quartos (`/quartos`), adotado logo depois pela mudança `simplify-room-browsing`. Esta mudança só ajusta os testes do mapa que dependem da paginação compartilhada.
- A lista de conversas do WhatsApp, que atualiza sozinha e tem interface de chat própria (capability `whatsapp-conversations`).
- O total em listas por cursor ("26–50 de N"), que exigiria contagens novas no backend.
- Filtro por alojamento no ranking e mudança na regra de posição.
- Telas novas de auditoria ou de histórico de chamadas.
- Mudanças no backend, em permissões ou em regras de domínio do AGENTS.md.
- O modo demonstração e o módulo de saúde, removidos pelas mudanças `remove-demo-mode` e `remove-health-module` antes desta.
- O cache das listas de referência e a memória do ranking no backend, que ficam com a mudança `speed-up-navigation`.

## Capabilities

### New Capabilities

- `list-browsing`: como o usuário filtra e percorre listas longas: painel de filtro com busca à vista e extras recolhíveis, filtros ativos removíveis, paginação de 25 com ou sem total, foco ao trocar de página, ranking paginado e chamada noturna inteira.

### Modified Capabilities

- `report-generation`: o requisito "Filtros opcionais recolhidos" passa a abrir a área de filtros em telas largas e a recolhê-la no celular, como todas as listas.

## Impact

- **Frontend novo:** `frontend/src/app/shared/filter-panel.component.ts`, helper `cursorPages` em `frontend/src/app/core/list-page.ts`, regras `.filter-panel` em `frontend/src/styles.scss`.
- **Frontend alterado:** `shared/pagination.component.ts`; `features/cleaning/cleaning-local.pages.ts` e `cleaning-local-api.service.ts`; `features/communications/communication-filters.component.ts`, `notifications-local.pages.ts`, `warnings-local.pages.ts`, `notices-local.pages.ts`, `own-communications-local.pages.ts`, `recurrence-local.pages.ts`; `features/operations/exits-local.component.ts` e `night-call-local.component.ts`; `features/management/residents.component.ts`, `guardians.pages.ts`, `courses.page.ts`, `supervisors.component.ts`, `accommodations.component.ts`; `features/reports/reports-local.pages.ts`, `reports-local-api.service.ts` e `reports-local.scss`.
- **Testes:** specs unitários das peças compartilhadas e das telas; e2e `cleaning-reports-local`, `communications-local`, `notices-mobile`, `operations-local`, `long-exits-local`, `management-pagination-local`, `supervisors-local`, `rooms-local`, além de novos cenários a 320 e 390 px com axe.
- **Documentação:** `DESIGN.md` (padrão de lista e de Relatórios).
- **Backend, API e banco:** sem mudança. Os endpoints de cursor já aceitam `limit=25`, e as linhas de relatório aceitam `offset` e `limit`.
- **Dependências:** nenhuma nova. O Angular Material continua só com diálogos.
