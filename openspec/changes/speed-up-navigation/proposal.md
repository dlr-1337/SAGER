# Proposal

## Why

Em produção (Coolify numa VPS, atrás do Cloudflare), cada ida ao servidor custa cerca de 230 ms, e cada troca de página encadeia várias idas em série: checagem da sessão, download do código da página, dados e, nas gravações, um pedido extra do token CSRF. Os arquivos com hash saem com `Cache-Control: no-store` (`cf-cache-status: BYPASS`), e a fonte de ícones de 5,4 MB é baixada de novo a cada recarga. O PRD v2.0, seção 20, pede resposta de no máximo 2 segundos para solicitações e consultas numa VPS de 1 CPU e 2 GB. Hoje a primeira visita a uma página leva de 0,9 a 1,4 s só em idas e voltas.

## What Changes

- Gateway (os dois templates nginx): arquivos com hash no nome (`main-`, `chunk-`, `styles-` e `media/`) passam a ter cache longo e imutável. `index.html`, arquivos sem hash e `/api` continuam `no-store`. Um arquivo com hash que não existe responde 404 sem cache longo. Os cabeçalhos de segurança passam para um arquivo incluído nas duas localizações, e o log ganha `$upstream_response_time`. Os smokes de produção e do Coolify passam a exigir as duas políticas.
- Compose do Coolify: o banco sobe de 0,25 para 1,0 CPU e o backend de 0,65 para 2,0. O pool Hikari de produção mantém as 8 conexões abertas (`minimum-idle` igual a `maximum-pool-size`).
- Backend: a lista de avaliações de limpeza (gestão e residente) calcula o ranking de cada semana uma vez por página, com a mesma resposta de hoje.
- Frontend: um único ponto de acesso à API em `core/api.ts` cuida de credenciais, JSON, erros, total da página, token CSRF guardado em memória e sessão encerrada (401). Todos os serviços de API passam a usá-lo. A sessão é consultada ao abrir o sistema, e não a cada troca de página. O código de todas as páginas é pré-carregado, uma barra fina mostra a navegação em andamento e o pacote de animações sai do carregamento inicial.
- Ícones: a fonte Material Symbols é trocada por um subconjunto só com os ícones usados (de 5,4 MB para menos de 100 kB). Um teste falha quando uma tela usa um ícone que não está na fonte.
- Listas de referência (residentes, cursos e mapa de quartos) são reaproveitadas por 60 s na mesma aba. A cópia é descartada nas gravações do próprio usuário, ao entrar, ao sair e quando a sessão termina. A tela de residentes busca cursos e mapa ao mesmo tempo, e o detalhe do quarto busca só os seus moradores.

## Capabilities

### New Capabilities

- `page-loading`: cache dos arquivos estáticos e da API, progresso da navegação, verificação da sessão, reaproveitamento do token CSRF, fonte de ícones leve, pré-carregamento e reaproveitamento das listas de referência.

### Modified Capabilities

Nenhuma. A capability `brand-assets` continua valendo: os arquivos de marca não têm hash e continuam com os cabeçalhos atuais, `no-store` incluído.

## Fora do escopo

- Modo demonstração e módulo de saúde. As mudanças `remove-demo-mode` e `remove-health-module` os removem antes da parte frontend desta mudança, e nada aqui planeja trabalho neles.
- Carregar as opções de filtro uma vez por tela (responsáveis, limpeza, notificações, advertências), paginação e painel de filtros. Isso fica com `simplify-long-lists`. O reaproveitamento por 60 s já evita a ida repetida enquanto isso.
- Índice de expressão para a busca normalizada, lote de participantes da limpeza, reaproveitamento da conta lida pelo filtro em `/auth/me`, `sendfile` e `tcp_nopush`, retirada do `MatDialogModule`, limites de CPU de `infra/production/compose.yml`, pré-carregamento por perfil, Service Worker e funcionamento offline.
- Mudanças em endpoints ou no contrato da API.

## Impact

- Regras afetadas: PRD v2.0, seção 20 (Resposta: no máximo 2 s; Infraestrutura: VPS de 1 CPU e 2 GB). Regra do AGENTS.md "Profiles `local` and `production` use ... JDBC sessions, CSRF and record authorization": o CSRF continua obrigatório e só deixa de ser pedido antes de cada gravação. Também a regra "production requires ... the HTTPS proxy in infra/production/": o gateway mantém HSTS, CSP, nosniff, Referrer-Policy e Permissions-Policy em todas as respostas.
- Infra: `infra/coolify/nginx.conf.template`, `infra/production/nginx.conf.template`, novo `infra/production/sager-security-headers.conf`, `infra/production/gateway.Dockerfile`, `infra/coolify/smoke.py`, `infra/production/smoke.sh`, `infra/coolify/test_start_gateway.py` e `compose.coolify.yml`.
- Backend: `backend/src/main/resources/application-production.yml` e `backend/src/main/java/br/edu/ifgoiano/sager/cleaning/CleaningService.java`, com teste em `backend/src/test/java/br/edu/ifgoiano/sager/reports/CleaningReportsIntegrationTest.java`.
- Frontend: `app.config.ts`, `app.routes.ts`, `app.ts`, `app.html`, `core/` (novo `api.ts`, `local-auth.service.ts`, `list-page.ts`), todos os `*-api.service.ts`, `cleaning/reporting-local.transport.ts`, `styles.scss`, `package.json`, `residents.component.ts` e `room-detail.component.ts`. Novos: fonte em `frontend/src/fonts/`, script em `frontend/scripts/` e testes em `frontend/e2e/`.
- Dependências: `material-symbols` vira dependência de desenvolvimento, só como fonte do subconjunto. A geração usa Python com fonttools e brotli, fora do build e da CI.
- Ordem: os grupos 1 e 2 (infra e backend) entram na onda 1, em paralelo com `remove-demo-mode`. Os grupos 3 a 5 (frontend) entram depois de `remove-demo-mode` e `remove-health-module`.
