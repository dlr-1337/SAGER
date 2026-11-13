# Proposal

## Why

O modo demonstração (`/demonstracao`, perfil e cenário escolhidos na tela, dados em memória) duplica quase todas as telas: cerca de dez componentes "embrulho" escolhem entre a página real e um modelo próprio, cinco serviços somam cerca de 1,5 mil linhas de dados fictícios, há ramos `isDemo()` em mais de 30 arquivos e o `chart.js` vai para o pacote de produção só para desenhar um gráfico fixo da demonstração. O dono decidiu tirar a demonstração (DECISOES.md, "Demonstração e saúde"): a defesa usa o sistema real com dados fictícios. Ela sai agora, na onda 1, para que as mudanças de listas, quartos, concluintes, faixa etária e saídas de adultos não precisem manter um caminho paralelo.

Regras afetadas:
- AGENTS.md, "Security & Demo Data": "The public demonstration uses profile selection and in-memory data", "Production disables demonstration access" e "Do not substitute demo data after a local API failure". As duas primeiras deixam de valer. A terceira passa a ser o requisito "Falha sem dados substitutos" de `session-access`.
- AGENTS.md, "Build, Test, and Development Commands": `npm start` deixa de servir a demonstração e passa a servir só o acesso por login.
- PRD v2.0, linha 872: "A liberação não pode depender de contas demonstrativas, autorização apenas visual ou dados fictícios apresentados como registros reais." Linha 284: a demonstração com dados em memória deixa de existir, e a falha da API continua sem registros inventados.

## What Changes

- **BREAKING** Sai a entrada sem conta. Deixam de existir a rota `/demonstracao`, o cartão "Explorar com um perfil fictício" da tela de acesso, os seletores de perfil e de cenário do cabeçalho e do menu móvel, e as chaves `sager.demo.*` do `sessionStorage`. O endereço antigo leva a "Página não encontrada", e o gateway de produção continua respondendo 404.
- As rotas carregam direto as páginas ligadas à API: início, chamada, saídas (lista, formulário e detalhe), notificações, limpeza, ranking, avisos do residente e indicadores individuais. Os componentes embrulho e os modelos da demonstração são apagados.
- Os serviços e os componentes que só existem para a demonstração são apagados: `operations-demo`, `management-demo`, `reports-demo-api`, `notices-demo`, `demo-entry`, `cleaning`, `ranking`, o diálogo de revisão da demonstração e `DemoSelectorPage`. Também saem o tipo `DemoScenario` e todos os ramos `isDemo()` e `session.active()`.
- `DemoSessionService` passa a se chamar `SessionService` (`core/session.service.ts`) e mantém só `role()`, `hasRole()` e `production`. O perfil vem sempre da conta autenticada. Sem sessão, nenhum perfil vale, e a ajuda pública deixa de mostrar os guias do supervisor.
- Os intermediários que só escolhiam entre demonstração e API saem (`AccommodationDataService` e `reportsApi()`), e as telas chamam o serviço da API direto.
- A dependência `chart.js` sai do `package.json`. Ela só é importada pelo gráfico fixo da demonstração (`reports.pages.ts`).
- Os testes da demonstração saem. Os e2e que entravam pela demonstração passam a entrar com login e API interceptada, como os `*-local.spec.ts`, ou são apagados quando um `*-local.spec.ts` já cobre o mesmo caminho. A decisão de cada arquivo está no design.md.
- Specs: saem os requisitos de paridade da demonstração em `exit-scheduling`, `room-filters`, `report-generation` e `whatsapp-conversations`. `plain-language` deixa de falar em "modo real". A capacidade nova `session-access` registra a entrada só com conta.

## Capabilities

### New Capabilities
- `session-access`: como se entra nas telas internas. Só há entrada com conta e sessão do servidor, o perfil é o da própria conta, não há entrada de demonstração e uma falha do servidor nunca vira registro inventado.

### Modified Capabilities
- `exit-scheduling`: sai "Paridade na demonstração".
- `room-filters`: sai "Dependência de quarto na demonstração".
- `report-generation`: sai "Demonstração com o mesmo fluxo". A garantia de não usar dados substitutos após erro passa para `session-access`.
- `whatsapp-conversations`: sai "Demonstração sem envio real".
- `plain-language`: "Sem texto de ambiente de teste no uso real" passa a valer para a produção e inclui a palavra "demonstração".

## Impact

- Frontend, núcleo: `app.routes.ts`, `app.ts`, `app.html`, `app.scss`, `styles.scss`, `core/demo-session.service.ts` (vira `core/session.service.ts`), `core/local-auth.service.ts` (tipo `Role`) e os cerca de 70 arquivos que injetam a sessão (troca mecânica de nome).
- Frontend, telas: `features/portal/portal.pages.ts` (acesso, ajuda, perfil e acesso negado; saem `HomePage` e `DemoSelectorPage`), `features/management/*` (ramos `isDemo()`), `features/operations/*` (embrulhos), `features/communications/*` (entrada `[demo]` do estado compartilhado), `features/cleaning/*`, `features/reports/*`. Nos arquivos de `features/health/` saem só as linhas que recusam a demonstração.
- Dependências: sai `chart.js` (`package.json` e `package-lock.json`).
- Testes: specs unitários da demonstração apagados, stubs da sessão atualizados, e2e migrados ou apagados conforme a tabela do design.md. Sai `e2e/demo-session.ts` e entra `e2e/local-session.ts`.
- Backend, banco e API: nenhuma mudança. A demonstração nunca chamou a API.
- Gateway: `location = /demonstracao { return 404; }` e as conferências de `smoke.py` e `smoke.sh` ficam como estão.

Fora do escopo:
- Renomear os arquivos `*-local` e reorganizar rotas por feature (refatoração posterior).
- O módulo de saúde, que sai em `remove-health-module`. Aqui só saem as linhas de saúde que tratam da demonstração.
- O texto de AGENTS.md, README.md, `frontend/README.md`, PRODUCT.md, DESIGN.md, `docs/CI.md` e dos READMEs de infraestrutura. O dono desses textos é `clean-up-documentation`.
- A etiqueta de ambiente local ("Login local · Dados fictícios") e a marca `sager-environment`, que não pertencem à demonstração.
- A aba "Termos" do residente com texto provisório, a unificação dos `mockSession` repetidos nos `*-local.spec.ts` e os textos `DEMO-*` dos testes do backend.
