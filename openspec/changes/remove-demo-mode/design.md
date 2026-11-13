# Design

## Context

A motivação está em proposal.md, em "Why". O estado atual do código (frontend em `frontend/src/app`) é este:

- **Sessão.** `core/demo-session.service.ts` serve à demonstração e à conta real. `role()` devolve o perfil da conta e, sem conta, o perfil guardado em `sager.demo.role`, que por padrão é `'supervisor'`. Por isso a ajuda pública (`/ajuda`) hoje mostra os guias do supervisor a quem não entrou. O serviço também lê a meta `sager-environment` (`production`), que controla a etiqueta "Login local · Dados fictícios" fora da produção. Cerca de 70 arquivos (código e specs) o injetam.
- **Embrulhos.** Estes componentes fazem `@if (!session.active()) <página real> @else <modelo demo>`: `operations/exits.component.ts`, `exit-form.component.ts`, `exit-detail.component.ts`, `night-call.component.ts`, `notifications.component.ts`, `notification-detail.component.ts`, `communications/notices.page.ts`, `reports/reports.pages.ts` (`IndividualReportPage`, o único que importa `chart.js`), `cleaning/cleaning-local.pages.ts` (`CleaningPage` e `RankingPage`) e `portal/portal.pages.ts` (`HomePage`). Nenhum deles acrescenta layout à página real.
- **Ramos internos.** Os ramos `isDemo()` e `session.active()` estão em `features/management/*` (14 arquivos), em `features/communications/*` (entrada `[demo]` de `CommunicationsStateComponent`, usada 9 vezes), em `features/cleaning/*`, nas páginas reais de `features/operations/*`, em `course-api.service.ts` (cursos em memória), em `accommodation-data.service.ts` (só escolhe entre memória e API) e em `reports-demo-api.service.ts` (`reportsApi()` escolhe entre o serviço demo e `ReportsLocalApiService`). Há ainda `formatResidentName` em `management.utils.ts`, usado só pela demonstração.
- **Rotas.** `app.routes.ts` declara `/demonstracao` e sobrescreve `limpeza` e `ranking`, que `operations.routes.ts` aponta para os componentes demo `cleaning.component.ts` e `ranking.component.ts`.
- **Gateway.** Os dois templates nginx (`infra/production` e `infra/coolify`) respondem 404 em `/demonstracao`, e `smoke.py` e `smoke.sh` conferem isso.
- **Testes.** Os e2e que entram pela demonstração usam `e2e/demo-session.ts` (`enterDemo`) ou abrem `/demonstracao` direto. Os `*-local.spec.ts` entram com `/api/v1/auth/me` interceptado, cada um com o próprio `mockSession`.

## Goals / Non-Goals

**Goals:**
- Uma implementação por tela: cada rota carrega a página ligada à API.
- Um bundle sem código nem dependência da demonstração, comprovado por grep e pelo build.
- Nenhuma perda de cobertura de acessibilidade nas telas que continuam. As auditorias que só existiam pela demonstração (foco, menu móvel, alvos de 44 px, axe por rota, rolagem a 320 px) passam a rodar com login e API interceptada.

**Non-Goals:**
- Mudar o comportamento das telas reais além do que a demonstração forçava (o perfil padrão sem conta).
- Unificar os `mockSession` dos `*-local.spec.ts` existentes, renomear arquivos `-local` ou mexer no gateway.

## Decisions

### 1. Apagar a demonstração inteira, sem chave de configuração

Saem a rota, o seletor, os serviços, os modelos, os embrulhos e os testes. Os componentes que sobram não leem mais `active()` nem `scenario()`.

Alternativa rejeitada: esconder a demonstração atrás de uma flag de build. Isso manteria as duas implementações e o `chart.js` no repositório, e cada mudança das ondas 3 e 4 continuaria precisando decidir o que fazer com a demonstração.

### 2. As rotas apontam direto para a página real

| Rota | Página carregada |
|---|---|
| `inicio` | `features/portal/local-home.page.ts` → `LocalHomePage` |
| `chamada` | `operations/night-call-local.component.ts` → `NightCallLocalComponent` |
| `saidas` | `operations/exits-local.component.ts` → `ExitsLocalComponent` |
| `saidas/nova`, `saidas/:id/editar` | `operations/exit-form-local.component.ts` → `ExitFormLocalComponent` |
| `saidas/:id` | `operations/exit-detail-local.component.ts` → `ExitDetailLocalComponent` |
| `notificacoes` | `communications/notifications-local.pages.ts` → `NotificationsLocalPage` |
| `notificacoes/:id` | `communications/notifications-local.pages.ts` → `NotificationDetailLocalPage` |
| `limpeza` | `cleaning/cleaning-local.pages.ts` → `CleaningListLocalPage` (em `operations.routes.ts`; sai a sobrescrita de `app.routes.ts`) |
| `ranking` | `cleaning/cleaning-local.pages.ts` → `RankingLocalPage` (idem) |
| `avisos` | `communications/own-communications-local.pages.ts` → `OwnCommunicationsLocalPage` |
| `relatorios/individual/:id` | `cleaning/cleaning-indicators-local.page.ts` → `CleaningIndicatorsLocalPage`, a mesma página de `relatorios/individual`, que já lê o `:id` |

Os papéis por rota continuam como estão em `app.routes.ts`.

Alternativa rejeitada: manter os embrulhos com um ramo só. É um componente a mais por rota, sem função.

### 3. `DemoSessionService` vira `SessionService`, e o perfil vem só da conta

O arquivo passa a ser `core/session.service.ts`, com `role()`, `hasRole()` e `production`, e continua exportando o tipo `Role`. `role()` passa a devolver `Role | null`: `principal()?.perfis[0] ?? null`. `hasRole()` dá falso sem conta. Os pontos que indexam por perfil tratam o nulo: `navByRole` e `roleLabels` em `app.ts`. `ProfilePage.label` sai, porque só o ramo da demonstração o usava. A ajuda pública sem conta esconde o bloco "Guias por tarefa" quando ele fica vazio. A troca de nome nos demais arquivos é mecânica (import e classe).

Alternativas rejeitadas:
- Levar `role()` e `hasRole()` para `LocalAuthService`. Muda a injeção e a chamada nos mesmos 70 arquivos e mistura a chamada HTTP de autenticação com a checagem de papel.
- Manter um perfil padrão sem conta (`'supervisor'` hoje). Mostra a visitantes guias e atalhos de servidor, e sem a demonstração não há motivo para esse padrão.

### 4. Saem os intermediários que só escolhiam o modo

`AccommodationDataService` é apagado. `accommodations.component.ts`, `accommodation-detail.component.ts` e `accommodation-form.component.ts` injetam `AccommodationApiService`, que tem os mesmos métodos (`list`, `get`, `save`, `listUnits`, `getUnit`, `saveUnit`). `reportsApi()` e `reports-demo-api.service.ts` são apagados, e `reports-local.pages.ts` injeta `ReportsLocalApiService`. `CourseApiService` perde os cursos em memória e o `ManagementDemoService`.

Alternativa rejeitada: manter os intermediários como repasse. Seria uma camada sem regra.

### 5. Sai o `chart.js`

O único import é `reports/reports.pages.ts:3-15`, que só desenha números fixos com a demonstração ativa. Os indicadores reais (`cleaning/monthly-indicators.component.ts`) não usam a biblioteca. Saem a dependência e `reports/individual-report.scss`, usado só por esse componente.

Alternativa rejeitada: manter a dependência para gráficos futuros. Instalar de novo custa um comando, e hoje ela só pesa no pacote.

### 6. A etiqueta de ambiente local e a meta `sager-environment` ficam

Fora da produção, o cabeçalho continua mostrando "Login local · Dados fictícios", e o rodapé "Login local de teste · dados fictícios". Isso descreve o ambiente local, não a demonstração. A classe CSS `.demo-flag` passa a se chamar `.environment-flag`, e saem só os textos que dependiam de `active()`.

Alternativa rejeitada: tirar também a etiqueta local. Isso mudaria `mark-production.mjs` e os smokes, que conferem a meta, e é uma decisão de produto sem relação com a demonstração.

### 7. O gateway continua recusando `/demonstracao`

`location = /demonstracao { return 404; }` e as conferências de `smoke.py` e `smoke.sh` continuam. Elas passam a provar o cenário "Endereço antigo da demonstração" de `session-access` no gateway. Localmente, o Angular cai na rota `**` ("Página não encontrada"), que é pública.

Alternativa rejeitada: apagar a regra e as conferências. Perderia a defesa no gateway e editaria os mesmos templates que `speed-up-navigation` muda na mesma onda.

### 8. E2E: uma decisão por arquivo

Entra `e2e/local-session.ts`, que substitui `e2e/demo-session.ts`. Ele exporta `signIn(page, role)`, que intercepta `/api/v1/auth/me` (residente com `residenteId`) e `/api/v1/auth/csrf`. Também serve um registro sintético em `/api/v1/residentes`, `/api/v1/responsaveis`, `/api/v1/supervisores` e `/api/v1/saidas-curtas` (lista e detalhe), com as formas copiadas das fixtures dos `*-local.spec.ts`. Qualquer outro GET de `/api/v1/**` recebe lista vazia com `X-Total-Count: 0`, e escritas recebem 403. As ids ficam em `SYNTHETIC`.

| Arquivo | Decisão | Motivo ou cobertura |
|---|---|---|
| `e2e/demo-session.ts` | Apagar | Substituído por `e2e/local-session.ts`. |
| `e2e/management-pagination-demo.spec.ts` | Apagar | `management-pagination-local.spec.ts` cobre o mesmo caminho em supervisores, responsáveis e alojamentos. |
| `e2e/exit-layout.spec.ts` | Apagar | Testa a saída longa fictícia `/saidas/S-1048` e a "falha demonstrativa". `long-exits-local.spec.ts` cobre a tela real a 320 px ("saída longa a 320px…") e o reenvio ("resultado incerto bloqueia reenvio…"). |
| `e2e/notices-mobile.spec.ts` | Apagar | Testa a tela de avisos fictícia. `communications-local.spec.ts` cobre `/avisos` real, leitura e ciência ("residente consulta dados próprios…") e 320 px ("320 px e teclado acessíveis…"). |
| `e2e/reports-mobile-dialog.spec.ts` | Apagar | `cleaning-reports-local.spec.ts` cobre geração, sem registros, filtros removíveis, falha com "Tentar de novo" e 320 px com axe. |
| `e2e/action-links.spec.ts` | Migrar | Entra com `signIn(page, 'supervisor')` e confere o hover no link de linha de `/saidas`. Sai o passo "Abrir ajuda", link que só existia no início da demonstração. |
| `e2e/navigation-mobile.spec.ts` | Migrar | Entra com `signIn(page, 'supervisor')`. Só ele testa a captura de foco e o fundo inerte do menu móvel. |
| `e2e/route-audit.spec.ts` | Migrar | Os três testes entram com `signIn`. As rotas usam as ids de `SYNTHETIC`, e saem `/quartos/q-102` (axe em `rooms-local.spec.ts`) e `/notificacoes/N-201` (axe em `communications-local.spec.ts`). |
| `e2e/target-audit.spec.ts` | Migrar | Mesmas rotas com `signIn` e ids de `SYNTHETIC`. Só ele confere alvos de 44 × 44 px. |
| `e2e/visual-review.spec.ts` | Migrar | Continua fora da CI pelo título "captura telas centrais para revisão visual", que não muda. Saem as capturas que dependiam de registros só da demonstração (saída longa e aviso aberto). |
| `e2e/journeys.spec.ts` | Migrar em parte | Ficam, com `signIn`: "endereço antigo de convite…", "telas no celular de 320 px…", "acesso, painel e avisos sem violações axe graves", "foco por teclado usa anel duplo…" e "atalho de conteúdo, menu móvel e abas…". Este último perde o passo das abas com setas, porque `role="tab"` só existia nos avisos da demonstração (`notices.page.ts`), e passa a se chamar "atalho de conteúdo e menu móvel funcionam pelo teclado". Saem os da demonstração: cartão de perfis, painéis por perfil, aprovação longa simulada (coberta em `long-exits-local.spec.ts`), chamada com revisão (`operations-local.spec.ts`), aviso sem ciência (`communications-local.spec.ts`), relatório demo, seletor de cenários e cadastro de responsável demo (`guardians-local.spec.ts` e `supervisors-local.spec.ts`). |
| `e2e/tab-scroll.spec.ts` | Editar | Saem "residente da demonstração…" (o gêmeo "residente do ambiente local…" fica) e "avisos da demonstração…" (o gêmeo "comunicações próprias…" fica). "abrir um registro de uma lista rolada começa no topo" passa a usar o `mockSession` do próprio arquivo com 30 residentes sintéticos. |
| `e2e/local-auth.spec.ts` | Editar | "rota interna exige sessão…" passa a conferir que `/inicio` sem sessão vai a `/acesso` e que `/demonstracao` mostra "Página não encontrada". Sai "aba nova encerra cookie… antes de abrir a demonstração". Em "login local restaura…", `.demo-flag` vira `.environment-flag` e sai a conferência de `sager.demo.active`. Em "senha inválida…", sai o passo da demonstração. |
| `e2e/accommodations-local.spec.ts` | Editar | "alojamentos são utilizáveis na demonstração offline…" passa a usar `mockSession` e `mockRegistry` e mantém axe e rolagem a 1440 e 390 px em `/alojamentos/novo`. O salvamento demo sai, porque o arquivo já cobre o salvamento real. |
| `e2e/rooms-local.spec.ts` | Editar | Sai "demonstração de quartos…". Detalhe e edição reais já estão no arquivo e em `allocations-local.spec.ts`. |
| `e2e/supervisors-local.spec.ts` | Editar | Sai "demonstração funciona sem backend…". "gestor usa API e persiste…" cobre o caminho real. |
| `e2e/residents-local.spec.ts`, `e2e/guardians-local.spec.ts` | Editar | Saem os trechos `demo.goto('/demonstracao')` dos testes de falha. "responsável demonstrativo…" passa a testar só o 404 real ("Responsável não encontrado"). |
| `e2e/cleaning-reports-local.spec.ts`, `e2e/communications-local.spec.ts` | Editar | No teste de 320 px, sai o trecho de `/demonstracao` em `cleaning-reports-local` e o trecho com `sager.demo.*` em `communications-local`. Os testes de falha continuam como prova de "Falha sem dados substitutos". |
| `e2e/conversations-local.spec.ts` | Editar | Sai "a demonstração não consulta o WhatsApp". |
| `e2e/enrollment-catalog-recovery.spec.ts` | Editar | O laço de cursos roda só com `demo=false`. |
| `e2e/operations-local.spec.ts`, `e2e/long-exits-local.spec.ts` | Editar | Só os títulos que citam a demonstração mudam de texto. |

Alternativas rejeitadas:
- Apagar todos os e2e que entravam pela demonstração. Perderia o único teste de alvos de 44 px, de axe por rota, de foco do menu móvel e de anel de foco.
- Levar os `*-local.spec.ts` para o helper novo. Seria uma refatoração grande sem mudança de comportamento, fora do escopo.

### 9. Specs: remover a paridade e registrar a entrada só com conta

Os quatro requisitos de demonstração saem com **Reason** e **Migration**. `plain-language` passa a dizer "Em produção", porque o ambiente local continua com a etiqueta de dados fictícios (decisão 6). A garantia de AGENTS.md "Do not substitute demo data after a local API failure", que `clean-up-documentation` tira do AGENTS.md, vira o requisito "Falha sem dados substitutos" de `session-access`.

Alternativa rejeitada: só remover requisitos. A verificação ficaria sem um comportamento a conferir para a entrada, o perfil e a falha.

### Coordenação com mudanças paralelas

- `clean-up-documentation` é o dono do texto de AGENTS.md (linhas 12, 21, 31 e 33), README.md (85, 105 e 115), `frontend/README.md` (3, 14 e 22), PRODUCT.md (29 e 62), DESIGN.md (14, 29, 32 e 34), `docs/CI.md` (17) e dos READMEs de infraestrutura. Esta mudança não edita esses arquivos.
- `remove-health-module` (onda 2) apaga `features/health`. Aqui só saem as linhas que recusam a demonstração em `health.pages.ts:48`, `health-access.page.ts:605` e `app.routes.ts` (`healthGuard`), além do teste "recusa a demonstração…" de `app.routes.spec.ts`. O tipo `Role` continua com `'saude'` até lá.
- `speed-up-navigation` (parte frontend, onda 2) muda `accessGuard` depois desta mudança. Aqui o guard só perde o ramo `session.active()`.

## Risks / Trade-offs

- [A defesa ou um treinamento contava com a demonstração sem conta] → A decisão do dono é usar o sistema real com dados fictícios. O operador cria contas sintéticas por perfil (`./sager account`) antes da apresentação.
- [O GET vazio de `local-session.ts` faz uma tela da auditoria mostrar estado de erro em vez de conteúdo] → A auditoria continua valendo para foco, axe e alvos do estado mostrado. Se uma rota não renderizar o título, quem implementa acrescenta a fixture daquele recurso no helper.
- [Perda das capturas de saída longa e de aviso aberto na revisão visual] → A revisão visual fica fora da CI. As telas reais são auditadas em `long-exits-local.spec.ts` e `communications-local.spec.ts`.
- [`role()` nulo quebra uma tela que assumia um perfil] → O `npm run build` acusa os acessos por índice, e as rotas internas só abrem depois de `auth.refresh()`. `session.service.spec.ts` cobre o caso sem conta.
- [Conflito de merge com as mudanças paralelas da onda 1] → Os arquivos de texto ficam com `clean-up-documentation`, e o gateway não é editado. O nome da sessão muda num commit só, antes das demais edições do grupo.
- [Chaves `sager.demo.*` antigas no `sessionStorage` de quem já usou a demonstração] → Ninguém lê essas chaves, e elas somem ao fechar a aba. Nada a migrar.

## Migration Plan

1. Implementar na ordem de tasks.md. Cada grupo termina com `npm test -- --watch=false` e `npm run build` verdes.
2. Implantar como uma versão comum do frontend. Backend, banco e gateway não mudam.
3. Para voltar atrás, reverter os commits do frontend. Não há dado nem migração para desfazer.

## Decisões pendentes da instituição e do operador

- Apresentações, treinamentos e a defesa passam a usar uma instância real com contas e registros fictícios, sem acesso de visitante. A confirmar com a AE.
- O operador decide quais contas sintéticas cria para cada apresentação e quando as desativa, porque elas são contas reais na instância.
- O dono decide se a etiqueta "Login local · Dados fictícios" continua nos ambientes que não são de produção (decisão 6 a mantém).
