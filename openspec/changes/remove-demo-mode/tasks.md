# Tasks

Os caminhos são relativos à raiz do repositório. Os comandos `npm` e `npx` rodam em `frontend/`. Cada grupo termina com `npm test -- --watch=false` e `npm run build` verdes, e os arquivos tocados são formatados com `npx prettier --write <arquivo>`. O grupo 1 roda sobre o código atual, com a demonstração ainda presente mas sem uso pelos testes. Os grupos 2 a 6 tiram o código, e o grupo 7 só confere.

## 1. E2E sem entrada pela demonstração

- [x] 1.1 Criar `frontend/e2e/local-session.ts` com `signIn(page, role)` e `SYNTHETIC`, conforme a decisão 8 de design.md. O helper intercepta `/api/v1/auth/me` (o residente vem com `residenteId`) e `/api/v1/auth/csrf`. Serve lista e detalhe de um registro sintético em `/api/v1/residentes`, `/api/v1/responsaveis`, `/api/v1/supervisores` e `/api/v1/saidas-curtas`: a saída é do residente sintético e ainda pode ser editada, e as formas vêm das fixtures de `residents-local.spec.ts`, `guardians-local.spec.ts`, `supervisors-local.spec.ts` e `operations-local.spec.ts`. Os demais GET recebem `[]` com `X-Total-Count: 0`, e as escritas recebem 403. Verificar com os specs migrados de 1.2 a 1.5.
- [x] 1.2 Migrar `frontend/e2e/action-links.spec.ts` e `frontend/e2e/navigation-mobile.spec.ts` para `signIn(page, 'supervisor')`, tirando o passo "Abrir ajuda". Verificar com `npx playwright test e2e/action-links.spec.ts e2e/navigation-mobile.spec.ts`.
- [x] 1.3 Migrar `frontend/e2e/route-audit.spec.ts` e `frontend/e2e/target-audit.spec.ts` para `signIn` por perfil. As ids de `SYNTHETIC` substituem `r-ana`, `g-1`, `s-1` e `S-1048`, e saem `/quartos/q-102` e `/notificacoes/N-201`. Se alguma rota não mostrar o `h1`, acrescentar a fixture daquele recurso no helper. Verificar com `npx playwright test e2e/route-audit.spec.ts e2e/target-audit.spec.ts`.
- [x] 1.4 Em `frontend/e2e/journeys.spec.ts`, manter os cinco testes da decisão 8 com `signIn`. O de teclado perde o passo das abas com setas e passa a se chamar "atalho de conteúdo e menu móvel funcionam pelo teclado". Os demais testes saem, junto com `chooseProfile`. Verificar com `npx playwright test e2e/journeys.spec.ts`.
- [x] 1.5 Migrar `frontend/e2e/visual-review.spec.ts` para `signIn`, sem mudar o título "captura telas centrais para revisão visual", do qual depende o `--grep-invert` da CI. Saem as capturas de saída longa e de aviso aberto. Verificar com `npx playwright test e2e/visual-review.spec.ts`, sem versionar as imagens de `.impeccable/reviews/`.
- [x] 1.6 Apagar `frontend/e2e/management-pagination-demo.spec.ts`, `frontend/e2e/exit-layout.spec.ts`, `frontend/e2e/notices-mobile.spec.ts` e `frontend/e2e/reports-mobile-dialog.spec.ts`. Em `frontend/e2e/tab-scroll.spec.ts`, apagar os dois testes da demonstração e passar "abrir um registro de uma lista rolada começa no topo" para o `mockSession` do próprio arquivo, com 30 residentes sintéticos. Verificar com `npx playwright test e2e/tab-scroll.spec.ts e2e/management-pagination-local.spec.ts e2e/long-exits-local.spec.ts`. Os dois últimos são os specs que passam a cobrir o que saiu.
- [ ] 1.7 Tirar dos `*-local.spec.ts` os testes e os passos da demonstração, conforme a tabela da decisão 8:
  - `accommodations-local.spec.ts`: o teste offline vira axe e rolagem a 1440 e 390 px com `mockSession` e `mockRegistry`.
  - `rooms-local.spec.ts`, `supervisors-local.spec.ts`, `residents-local.spec.ts`, `guardians-local.spec.ts`, `cleaning-reports-local.spec.ts`, `communications-local.spec.ts`, `conversations-local.spec.ts` e `enrollment-catalog-recovery.spec.ts`: saem os testes e passos indicados na tabela.
  - `local-auth.spec.ts`: sai "aba nova encerra cookie…", saem o passo da demonstração de "senha inválida…" e a conferência de `sager.demo.active`, e "rota interna exige sessão…" passa a conferir só a ida para `/acesso`.
  - `operations-local.spec.ts` e `long-exits-local.spec.ts`: mudam só os títulos que citam a demonstração.

  As conferências de falha sem dados continuam em todos esses arquivos. Verificar com `npx playwright test` nesses onze arquivos.
- [ ] 1.8 Apagar `frontend/e2e/demo-session.ts`. Verificar que `git grep -n -E "enterDemo|demo-session|/demonstracao|sager\.demo|role-card" -- frontend/e2e` não acha nada e que `npm run test:e2e` passa inteiro.

## 2. Sessão com nome próprio

- [ ] 2.1 Renomear com `git mv` `frontend/src/app/core/demo-session.service.ts` para `core/session.service.ts` e `core/demo-session.service.spec.ts` para `core/session.service.spec.ts`, e a classe para `SessionService`, sem mudar os membros. Trocar o import e o nome em todos os arquivos de `frontend/src`, inclusive o tipo `Role` em `core/local-auth.service.ts` e os stubs `{ provide: DemoSessionService, … }` dos specs. Verificar que `git grep -n -E "DemoSessionService|demo-session\.service" -- frontend/src` não acha nada e que `npm test -- --watch=false` e `npm run build` passam.

## 3. Entrada, portal e shell sem demonstração

- [ ] 3.1 Em `frontend/src/app/app.routes.ts`, apagar a rota `demonstracao` e apontar `inicio` para `features/portal/local-home.page.ts` → `LocalHomePage`. Em `features/portal/portal.pages.ts`:
  - apagar `HomePage` (com o import de `OperationsDemoService`) e `DemoSelectorPage`;
  - tirar de `AccessPage` o cartão de demonstração, `providers: [DemoEntry]`, a chamada a `deactivate()` e os estilos `.access-demo` e `.demo-options`. A página fica sempre no layout `solo`, com "Ajuda para acessar", a orientação de troca de senha e a mensagem de produção para login indisponível, como já acontece hoje em produção;
  - tirar os ramos `session.active()` de `HelpPage`, `ProfilePage` e `DeniedPage`, junto com `ProfilePage.label`, usado só no ramo da demonstração.

  Apagar `features/portal/demo-entry.service.ts`. Em `features/portal/portal.pages.spec.ts`, os testes do início passam a montar `LocalHomePage`, e sai "mostra contagens que acompanham os registros…". Verificar com `npm test -- --watch=false --include=src/app/features/portal/portal.pages.spec.ts`.
- [ ] 3.2 No shell:
  - em `frontend/src/app/app.html`, tirar os seletores de perfil e de cenário (desktop e `.sidebar-demo-controls`) e os textos que dependem de `active()` (selo, "Sair da demonstração" e rodapé);
  - em `app.ts`, apagar `setRoleFromSelect`, `setScenarioFromSelect`, os ramos `active()` de `navItems`, `userName` e `signOut`, e `demonstracao` da expressão de página pública;
  - renomear `.demo-flag` para `.environment-flag` em `app.html`, `portal.pages.ts` e `app.scss`, apagar de `app.scss` os estilos usados só pelos seletores e trocar o comentário de `src/styles.scss:676`.

  Em `app.spec.ts`, "identifica a demonstração e a marca no shell" passa a se chamar "identifica o ambiente local e a marca no shell", e saem as chamadas a `deactivate()`. Acrescentar um caso com a meta `sager-environment` em `production` (como no spec da sessão): o cabeçalho, o menu e o rodapé não contêm "demonstração" nem "Dados fictícios". Verificar com `npm test -- --watch=false --include=src/app/app.spec.ts` e `npm run build`.
- [ ] 3.3 Em `frontend/e2e/local-auth.spec.ts`, conferir que `/demonstracao` sem sessão mostra "Página não encontrada", que `/acesso` mostra "Ajuda para acessar" e não oferece "Explorar demonstração" e que o cabeçalho de quem entrou não tem `#profile-select-desktop`. Trocar `.demo-flag` por `.environment-flag`. Verificar com `npx playwright test e2e/local-auth.spec.ts e2e/navigation-mobile.spec.ts e2e/journeys.spec.ts`.

## 4. Operações, comunicações, limpeza e relatórios sem embrulhos

- [ ] 4.1 Em `frontend/src/app/features/operations/operations.routes.ts`, apontar `chamada`, `saidas`, `saidas/nova`, `saidas/:id/editar`, `saidas/:id`, `notificacoes`, `notificacoes/:id`, `limpeza` e `ranking` para as páginas reais da tabela da decisão 2. Em `app.routes.ts`, apagar a sobrescrita de `limpeza` e `ranking` e apontar `avisos` para `OwnCommunicationsLocalPage` e `relatorios/individual/:id` para `CleaningIndicatorsLocalPage`. Apagar `CleaningPage` e `RankingPage` de `features/cleaning/cleaning-local.pages.ts`. Verificar com `npm run build` e `npx playwright test e2e/route-audit.spec.ts e2e/operations-local.spec.ts e2e/cleaning-reports-local.spec.ts`.
- [ ] 4.2 Apagar os embrulhos e o que só eles usam:
  - em `features/operations/`: `exits.component.ts`, `exit-form.component.ts`, `exit-detail.component.ts`, `night-call.component.ts`, `notifications.component.ts`, `notification-detail.component.ts`, `cleaning.component.ts`, `ranking.component.ts`, `review-dialog.component.ts` e `operations-demo.service.ts`;
  - `features/communications/notices.page.ts` e `notices-demo.service.ts`;
  - `features/reports/reports.pages.ts` e `individual-report.scss`;
  - os specs `operations/exit-form.component.spec.ts`, `operations/night-call.component.spec.ts`, `operations/operations-demo.service.spec.ts`, `communications/notices-demo.service.spec.ts` e `reports/reports.pages.spec.ts`;
  - a regra `.op-demo-label` de `operations/operations.scss`.

  Verificar com `npm test -- --watch=false` e `npm run build`.
- [ ] 4.3 Rodar `npm uninstall chart.js`. Verificar que `npm ls chart.js` não lista o pacote, que `git grep -n -E "chart\.js|@kurkle" -- frontend/package.json frontend/package-lock.json frontend/src` não acha nada e que, depois de `npm run build`, `grep -rlE "@kurkle/color|chart\.js" dist/frontend` não acha nada.
- [ ] 4.4 Apagar `features/reports/reports-demo-api.service.ts` (com `reportsApi()` e `ReportsApi`). As três páginas de `features/reports/reports-local.pages.ts` passam a injetar `ReportsLocalApiService`, sem os ramos `active()` e `scenario()` (inclusive o link para `/relatorios/individual/ana`). Verificar com `npm test -- --watch=false --include=src/app/features/reports/**/*.spec.ts` e `npx playwright test e2e/cleaning-reports-local.spec.ts`.
- [ ] 4.5 Comunicações e limpeza:
  - tirar a entrada `demo` e o ramo correspondente de `CommunicationsStateComponent` (`features/communications/communications-local.shared.ts`), além das nove ligações `[demo]` em `notices-local.pages.ts`, `notifications-local.pages.ts`, `cleaning/cleaning-local.pages.ts`, `cleaning/cleaning-form-local.page.ts` e `cleaning/cleaning-indicators-local.page.ts`;
  - tirar os ramos de demonstração de `own-communications-local.pages.ts`, `recurrence-local.pages.ts`, `warnings-local.pages.ts`, `notices-local.pages.ts`, `notifications-local.pages.ts` e `conversations-local.pages.ts` (avisos de que a demonstração não usa WhatsApp);
  - atualizar os stubs de sessão em `communications-pagination.spec.ts`, `cleaning/cleaning-local.pages.spec.ts` e `cleaning/cleaning-form-local.page.spec.ts`.

  Verificar com `npm test -- --watch=false --include=src/app/features/communications/**/*.spec.ts --include=src/app/features/cleaning/**/*.spec.ts` e `npx playwright test e2e/communications-local.spec.ts e2e/conversations-local.spec.ts`.
- [ ] 4.6 Tirar os ramos `session.active()` e os textos "Esta tela não faz parte da demonstração" de `features/operations/long-exit-form.component.ts` e `long-exit-detail.component.ts`. Atualizar os stubs de sessão de `exit-form-local.component.spec.ts`, `exits-local.component.spec.ts`, `long-exit-form.component.spec.ts` e `night-call-local.component.spec.ts`, e o título de `operations-local-api.service.spec.ts`. Verificar com `npm test -- --watch=false --include=src/app/features/operations/**/*.spec.ts` e `npx playwright test e2e/operations-local.spec.ts e2e/long-exits-local.spec.ts`.

## 5. Gestão sem dados em memória

- [ ] 5.1 Apagar `frontend/src/app/features/management/accommodation-data.service.ts` e o spec dele. `accommodations.component.ts`, `accommodation-detail.component.ts` e `accommodation-form.component.ts` passam a injetar `AccommodationApiService` e perdem os ramos `isDemo()`. Atualizar `accommodation-form.component.spec.ts`. Verificar com `npm test -- --watch=false --include=src/app/features/management/accommodation*.spec.ts` e `npx playwright test e2e/accommodations-local.spec.ts e2e/management-pagination-local.spec.ts`.
- [ ] 5.2 Tirar os ramos `isDemo()` e `scenario()` e o `ManagementDemoService` de `residents.component.ts`, `resident-detail.component.ts`, `resident-form.component.ts`, `rooms.component.ts`, `room-detail.component.ts`, `room-form.component.ts`, `guardians.pages.ts`, `supervisors.component.ts`, `supervisor-detail.component.ts`, `supervisor-form.component.ts` e `course-api.service.ts` (sai `demoCourses`), mantendo o ramo da API. Atualizar os specs:
  - `residents-local.component.spec.ts`, `rooms-local.component.spec.ts`, `resident-form.component.spec.ts`, `supervisor-form.component.spec.ts` e `management-pagination.spec.ts`;
  - `guardians.pages.spec.ts`, de onde saem os casos com `active: signal(true)`;
  - `supervisors.component.spec.ts`, de onde sai o caso `demo: true`.

  Verificar com `npm test -- --watch=false --include=src/app/features/management/**/*.spec.ts` e `npx playwright test e2e/residents-local.spec.ts e2e/rooms-local.spec.ts e2e/guardians-local.spec.ts e2e/supervisors-local.spec.ts e2e/allocations-local.spec.ts e2e/enrollment-catalog-recovery.spec.ts`.
- [ ] 5.3 Apagar `management-demo.service.ts`, `management-demo.service.spec.ts`, `management-demo-pagination.spec.ts`, `residents-demo-rooms.spec.ts` e `formatResidentName` de `management.utils.ts`. Trocar os títulos que citam dados demonstrativos em `accommodation-api.service.spec.ts` e `guardian-api.service.spec.ts`, e os textos `DEMO-A` e `DEMO-SUP-001` de `frontend/src/app/shared/field-rules.spec.ts` por outros textos sintéticos do mesmo formato. Verificar que `git grep -n -E "ManagementDemoService|management-demo|formatResidentName" -- frontend/src` não acha nada e que `npm test -- --watch=false` e `npm run build` passam.

## 6. Perfil só da conta autenticada

- [ ] 6.1 Em `frontend/src/app/core/session.service.ts`, apagar `active`, `scenario`, `demoAvailable`, `setRole`, `activate`, `deactivate`, `setScenario`, o tipo `DemoScenario` e o uso de `sessionStorage`. `role()` passa a `principal()?.perfis[0] ?? null`, `hasRole()` dá falso sem conta e `production` continua. Reescrever `core/session.service.spec.ts` para cobrir o perfil da conta, o perfil nulo com `hasRole` falso sem conta e `production` lido da meta. Verificar com `npm test -- --watch=false --include=src/app/core/session.service.spec.ts`.
- [ ] 6.2 Tratar o perfil nulo:
  - em `app.ts` (`navByRole` e `roleLabels`);
  - em `HelpPage`, que esconde "Guias por tarefa" quando nenhum guia se aplica.

  Tirar `session.active()` de `accessGuard` e `healthGuard` (`app.routes.ts`) e as linhas que recusam a demonstração em `features/health/health.pages.ts` e `features/health/health-access.page.ts`, sem outra mudança na saúde. Em `app.routes.spec.ts`, saem "recusa a demonstração antes de consultar permissões locais" e o stub `active`. Em `health-access.page.spec.ts`, sai o stub `active`. Cobrir em `features/portal/portal.pages.spec.ts` a ajuda sem conta, sem "Fazer a chamada", "Acompanhar saídas", "Gerar relatório" nem "Minha limpeza". Verificar com `npm test -- --watch=false` e `npm run build`.
- [ ] 6.3 Em `frontend/e2e/local-auth.spec.ts`, conferir que `/ajuda` sem sessão mostra "Perguntas frequentes" e não mostra "Fazer a chamada" nem "Gerar relatório". Verificar com `npx playwright test e2e/local-auth.spec.ts e2e/route-audit.spec.ts`.

## 7. Verificação final

- [ ] 7.1 Conferir que `git grep -n -i -E "demo([^r]|$)" -- frontend/src frontend/e2e frontend/package.json` não acha nada. O padrão deixa de fora só "demora".
- [ ] 7.2 Rodar `npm test -- --watch=false`, `npm run build` e `npm run test:e2e`, todos verdes. `npx prettier --check src e2e` só aponta os três arquivos que já falhavam antes (`src/app/app.config.ts`, `src/main.ts` e `src/app/shared/page-header.component.ts`).
- [ ] 7.3 Registrar no PR o total inicial e os chunks lazy de início, saídas e relatórios em `npm run build`, antes (commit de partida) e depois. Rodar `openspec validate remove-demo-mode --strict` e conferir que passa.

## Workflow follow-up

- Arquivar a mudança depois da revisão, com `openspec validate remove-demo-mode --strict` antes de `openspec archive`.
- `clean-up-documentation` tira as menções à demonstração de AGENTS.md, README.md, `frontend/README.md`, PRODUCT.md, DESIGN.md e `docs/CI.md` (lista em design.md, "Coordenação com mudanças paralelas").
