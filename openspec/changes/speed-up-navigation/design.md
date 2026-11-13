# Design

## Context

A motivação está em proposal.md (Why), e os comportamentos esperados estão em `specs/page-loading/spec.md`. O estado atual que condiciona a solução:

- O gateway nginx tem dois templates (`infra/coolify/nginx.conf.template`, usado em produção pelo Coolify, e `infra/production/nginx.conf.template`, do deploy com TLS próprio). Os dois declaram `add_header Cache-Control no-store always` no nível do `server`. A location de estáticos (`location ~* \.(?:js|css|woff2?|svg|png|jpe?g|ico)$`) não declara cabeçalhos e herda tudo. No nginx, uma location que declara qualquer `add_header` deixa de herdar os do `server`.
- O build Angular usa `outputHashing: all`. Os nomes reais são `main-<8>.js`, `chunk-<8>.js`, `styles-<8>.css` e `media/<nome>-<8>.<ext>`, e o hash de 8 caracteres usa `[A-Za-z0-9_-]` (por exemplo, `chunk-BD-lnXbU.js`). Os arquivos de `frontend/public/` (favicon, ícones, `og-image.png`, `manifest.webmanifest`, `if-goiano-urutai.png`) saem sem hash.
- O frontend faz `fetch` direto em 14 arquivos (`core/local-auth.service.ts`, `core/list-page.ts`, `cleaning/reporting-local.transport.ts` e 11 `*-api.service.ts`, sem contar a saúde, que sai antes). Cada gravação pede `GET /api/v1/auth/csrf` antes. O backend guarda o token na sessão (repositório padrão do Spring Security, mascarado por `XorCsrfTokenRequestAttributeHandler`), troca o token no login (`changeSessionId`) e responde 403 `csrf_invalid` quando ele falha (`SecurityConfiguration.java`).
- O `accessGuard` (`app.routes.ts`) chama `auth.refresh()`, ou seja, `GET /api/v1/auth/me`, em toda navegação protegida fora da demonstração (`if (!session.active() && !(await auth.refresh()))`). No Angular 22, os guards rodam antes do download do código da página.
- O modo demonstração (RF027, cap4.tex:133) continua. Ele não tem usuário em `LocalAuthService` (`DemoSessionService.activate()` chama `clearPrincipal()`), guarda os dados nos `*-demo.service` e nunca chama a API. Em produção, ele fica desligado (`DemoSessionService.demoAvailable`), e o gateway responde 404 em `/demonstracao`. As rotas carregam componentes-casca que escolhem, por `session.active()`, entre a tela `*-local` e a da demonstração (por exemplo, `night-call.component.ts`, `exits.component.ts`, `notifications.component.ts` e `cleaning-local.pages.ts`, que embute `CleaningComponent` e `RankingComponent`). Assim, o código da demonstração está nos mesmos arquivos de código que as telas da conta usam. A única rota própria, `/demonstracao`, fica em `portal.pages.ts`, o mesmo arquivo de `/acesso`.
- O Chart.js 4.5.1 entra só por `features/reports/reports.pages.ts`, que o importa de forma estática e chama `Chart.register` no topo do módulo. Só a rota `relatorios/individual/:id` carrega esse arquivo. Na conta, a mesma página mostra os indicadores em HTML e CSS (`CleaningIndicatorsLocalPage`), e o link de Relatórios leva a `/relatorios/individual`, sem id (`reports-local.pages.ts:399`). O gráfico só existe na demonstração (cap6.tex:7 e :23).
- `CourseApiService` tem ramo de demonstração em `list()` e `save()` (signal `demoCourses`). `ResidentApiService` e `RoomApiService` não têm. Em `residents.component.ts`, `loadOptions()` pede só os cursos na demonstração e, na conta, pede cursos e depois o mapa, em série.
- `app.config.ts` usa `provideRouter(routes)` sem pré-carregamento e `provideNoopAnimations()`, que puxa `@angular/animations` (cerca de 73 kB) só para desligar as animações do Material. O Material 22 lê o token `MATERIAL_ANIMATIONS` (`{ animationsDisabled: true }`), e nem o Material nem o CDK declaram `@angular/animations` como dependência.
- `styles.scss` importa `material-symbols/rounded.css`, que declara a fonte variável inteira (5.399.668 bytes, `font-display: block`). O código usa cerca de 70 ícones, com FILL 0 e 1, wght 500 e opsz 24 (um ícone de 48 px na página inicial).
- `CleaningService.list()` e `ownList()` chamam `assessment()` para cada uma das até 20 linhas, e cada chamada roda `rankRows()` da semana, um agregado de todos os quartos. São cerca de 81 consultas por página.
- `compose.coolify.yml` limita o banco a 0,25 CPU e o backend a 0,65. O Hikari de produção usa `maximum-pool-size: 8` e `minimum-idle: 1`.

## Goals / Non-Goals

**Goals:**

- Uma troca de página para uma tela já visitada, ou pré-carregada, custa só as chamadas de dados da tela.
- Nenhum arquivo imutável volta à origem depois do primeiro download, e nenhum HTML ou dado da API fica guardado.
- O comportamento de segurança fica igual: CSRF obrigatório, sessão validada pelo servidor em toda chamada e os mesmos cabeçalhos em todas as respostas.

**Non-Goals:**

- Mudar endpoints ou contratos da API. O detalhe do quarto usa o filtro `roomId`, que já existe em `GET /api/v1/residentes`.
- Cache de dados entre usuários ou entre abas. O reaproveitamento é só na memória de uma aba.
- Funcionamento offline ou Service Worker.

## Decisions

### D1. Cache longo só para nomes com hash, decidido no gateway

Os dois templates ganham, antes da location genérica de estáticos (no nginx, a primeira location de regex que casa vence), uma location para `^/(?:(?:main|chunk|styles)-[A-Za-z0-9_-]{8}\.(?:js|css)|media/[^/]+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+)$`. Ela tem `try_files $uri =404`, inclui o novo `/etc/nginx/sager-security-headers.conf` e usa `add_header Cache-Control $sager_asset_cache always`. O valor vem de um `map $status` no bloco `http`: 200 e 304 recebem `public, max-age=31536000, immutable`, e o resto recebe `no-store`. Assim, um 404 de um arquivo de outra versão nunca fica guardado no Cloudflare. No `server`, as cinco linhas de segurança viram o mesmo `include`, seguido de `add_header Cache-Control no-store always`. O arquivo `infra/production/sager-security-headers.conf` é copiado pelo estágio `gateway-runtime` do `gateway.Dockerfile`, como já acontece com `sager-proxy.conf`. O `log_format operational` dos dois templates ganha `$upstream_response_time`, para separar o tempo do backend do tempo da rede.

- Rejeitado: cache longo por extensão (`.js`, `.css`, `.svg`, `.png`). Isso congelaria favicon, `og-image.png`, manifest e a marca do IF, que não têm hash.
- Rejeitado: repetir as cinco linhas `add_header` dentro da nova location. Seriam duas cópias da CSP em cada template, que podem divergir; a decisão tomada foi o `include`.
- Rejeitado: `add_header` sem `always` para pular o 404. O 404 sairia sem `Cache-Control`, e o padrão do Cloudflare o guardaria por alguns minutos.

### D2. Mais CPU no Coolify e pool sempre aberto

Em `compose.coolify.yml`, o `database` passa a `cpus: 1.0` e o `backend` a `cpus: 2.0` (a VPS tem 6 núcleos e 11,7 GB, conforme o painel do Coolify em 13/11/2026). Em `application-production.yml`, `minimum-idle: 8`, igual ao `maximum-pool-size`. Com isso, uma rajada depois de um período ocioso não abre conexões novas com SCRAM e `connection-init-sql`.

- Rejeitado: flags de JVM (`-XX:TieredStopAtLevel=1`, SerialGC explícito). Elas trocam desempenho de pico por partida mais rápida, e o gargalo medido é CPU do banco e rede.
- Rejeitado: reduzir o pool para 5. Nenhuma medição mostra excesso de conexões, e oito backends cabem nos 512 MB do banco.
- Rejeitado: mudar também `infra/production/compose.yml`. Esse não é o stack publicado, e a decisão fica com o operador.

### D3. Ranking da limpeza calculado uma vez por semana em cada página

`list()` e `ownList()` criam um `Map` local por início de semana e o passam a `assessment()`, que só chama `rankRows()` quando a semana ainda não está no mapa. `get()`, `own()`, a criação e a correção continuam sem o mapa. A resposta não muda, e as agregações caem de 20 para o número de semanas distintas da página, normalmente 1 ou 2.

- Rejeitado: participantes em lote (`WHERE assessment_id = ANY(?)`) e revisão anterior por JOIN. É uma mudança maior, que mexe em SQL já testado, para um ganho menor.
- Rejeitado: guardar o ranking entre requisições. Ele ficaria defasado logo depois de uma avaliação nova.

### D4. Um só ponto de acesso à API em `core/api.ts`, sem injeção de dependência

`core/api.ts` exporta funções de módulo com estado de módulo:

- `api(url, init)` aplica `credentials: 'same-origin'`, `cache: 'no-store'` e `Accept: application/json`. Serializa como JSON o corpo que for objeto e deixa `FormData` e `URLSearchParams` como estão. Repassa o `AbortSignal` e devolve a `Response` já conferida. Quando a resposta não é ok, lança o erro montado pela fábrica que o serviço passa, para que cada serviço mantenha sua classe de erro (`ResidentApiError`, `RoomApiError`, ...), seus guards de tipo e a leitura de `X-Total-Count` (em `readArrayPage`).
- Em métodos que não são GET, envia o cabeçalho CSRF de um token guardado em memória. O token é buscado uma vez, e gravações simultâneas esperam a mesma Promise. Numa resposta 403 com `code: csrf_invalid`, o token é descartado, buscado de novo, e a chamada é repetida uma única vez.
- Numa resposta 401, chama o tratador registrado por `onUnauthorized()`. `app.config.ts` registra esse tratador com `provideAppInitializer`: se `auth.principal()` existe, chama `auth.clearPrincipal()` e navega para `/acesso`; sem usuário conhecido, não faz nada. Por isso a senha errada no login e o `/auth/me` da abertura não redirecionam. A demonstração não tem usuário e não chama a API, então o tratador nunca age nela.
- Os `*-demo.service` não usam `fetch` e ficam fora de `api()`.
- `cached(key, loader)` guarda a Promise por 60 s. Uma Promise rejeitada é esquecida na hora, e toda chamada não-GET bem-sucedida limpa todas as cópias (D9).
- `resetSession()` descarta o token e as cópias. `LocalAuthService` a chama depois do login, no logout e em `clearPrincipal()`.

A repetição depois de `csrf_invalid` é segura: o filtro do Spring Security recusa antes do controlador, então a gravação não aconteceu. Nenhum serviço envia corpo em stream, que não poderia ser reenviado. Uma gravação com a sessão já expirada recebe primeiro 403 `csrf_invalid`, porque o token guardado é da sessão antiga. A repetição com o token novo recebe 401, que leva ao acesso.

- Rejeitado: `HttpClient` com interceptors. Seria preciso reescrever todos os serviços, que usam Promises, e todos os specs, que simulam `fetch`, para Observables e `HttpTestingController`.
- Rejeitado: um serviço injetável que recebe `Router` e `LocalAuthService`. Criaria um ciclo, porque `LocalAuthService` também usa a API.

### D5. Sessão consultada só sem usuário conhecido

O `accessGuard` só chama `auth.refresh()` quando a demonstração não está ativa e `auth.principal()` é nulo: `if (!session.active() && !auth.principal() && !(await auth.refresh()))`. Na conta, isso acontece ao abrir ou recarregar a página e depois de um 401. O perfil das rotas continua sendo conferido por `session.hasRole()`, com o perfil da demonstração ou o do usuário em memória. O login mantém o seu único `refresh()`. O primeiro termo é obrigatório: a demonstração não tem principal (`demo-session.service.ts:60`), e sem ele a guarda chamaria `/auth/me` e levaria a demonstração para `/acesso`.

- Rejeitado: manter `/auth/me` em toda navegação. Custa pelo menos 230 ms por troca de página, e o backend já valida a sessão e a conta em toda chamada (`LocalAccountStatusFilter`).
- Rejeitado: consultar `/auth/me` periodicamente. É tráfego extra sem ganho, porque o 401 central já cobre a sessão perdida.

### D6. Pré-carregar as páginas, exceto o relatório individual com gráfico

`provideRouter(routes, withPreloading(SagerPreloading))`. `SagerPreloading`, exportada de `app.routes.ts`, tem cerca de 6 linhas: chama `load()` em toda rota com código sob demanda, exceto quando `route.data.preload === false`, caso em que devolve `of(null)`. A única rota marcada é `relatorios/individual/:id`, porque o seu arquivo traz o Chart.js (cerca de 158 kB brutos, medidos em 13/11/2026), que só desenha o gráfico da demonstração (Context). Em produção, o Chart.js só é baixado se alguém digitar esse endereço. Na demonstração, ele é baixado ao abrir o relatório da Ana, como hoje. O download das demais páginas começa depois da primeira navegação, inclusive na página de acesso, enquanto o usuário digita. Com D1, ele acontece uma vez por versão.

As páginas só da demonstração não têm o que excluir: o código delas está nos mesmos arquivos das telas da conta (Context), e `/demonstracao` usa o arquivo de `/acesso`, que já foi baixado. Em produção, esse código é baixado mas nunca roda, porque `demoAvailable` é falso.

- Rejeitado: `PreloadAllModules` sem exceção. Baixaria o Chart.js em todo acesso de produção, para um gráfico que só a demonstração desenha.
- Rejeitado: importar o Chart.js de forma dinâmica dentro do ramo da demonstração de `reports.pages.ts`. Isso tira o Chart.js até do acesso direto pelo endereço, mas mexe na criação do gráfico e no seu teste, para um caminho que nenhum link da conta alcança.
- Rejeitado: separar em arquivos próprios o código da demonstração das cascas das telas, para tirá-lo do pré-carregamento. Seria preciso reescrever várias telas para economizar bytes que se baixam uma vez por versão. O código é público, e a autorização continua no servidor.
- Rejeitado: uma estratégia por perfil (cerca de 10 linhas). Sem a saúde, a diferença para o residente se resume às páginas de gestão e relatórios, baixadas uma vez por versão.

### D7. Barra fina de navegação no App

`App` ganha um signal `navigating`: liga em `NavigationStart` e desliga em `NavigationEnd`, `NavigationCancel` e `NavigationError`. `app.html` mostra uma barra fixa de 3 px no topo, com `aria-hidden="true"`, e põe `aria-busy` em `#conteudo-principal`. A animação indeterminada fica em CSS. A barra só aparece depois de 150 ms (`animation-delay`), para não piscar em navegações instantâneas, e fica parada com `prefers-reduced-motion: reduce`. A barra vale também na demonstração. Os ramos `session.active()` de `app.ts` e `app.html` (selo da demonstração, perfil e cenário no cabeçalho e na gaveta) ficam como estão.

- Rejeitado: reaproveitar `ProgressBarComponent`. Ele é determinado (`done` e `total`) e tem `role="img"` com rótulo, mas a navegação não tem percentual conhecido.

### D8. Animações desligadas pelo token do Material

`provideNoopAnimations()` sai e entra `{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }` (de `@angular/material/core`). `@angular/animations` sai do `package.json`, porque nada mais o importa. O orçamento inicial de 500 kB volta a ser cumprido (559 kB menos cerca de 73 kB). A demonstração continua e já estava nessa medição.

- Rejeitado: manter `provideNoopAnimations()` e só subir o orçamento. Os 73 kB continuariam em todo primeiro acesso e em toda recarga.

### D9. Listas de referência guardadas por 60 s, descartadas em qualquer gravação

`ResidentApiService.list()`, `CourseApiService.list()` e `RoomApiService.map()` passam por `cached()`. Em `CourseApiService.list()`, só o ramo da conta passa pelo cache: `return this.session.active() ? this.demoCourses() : cached('cursos', () => this.request<Course[]>('/api/v1/cursos'));`. O ramo de demonstração de `save()` continua atualizando `demoCourses` sem `api()`, então a lista seguinte já traz o curso novo. Qualquer gravação bem-sucedida feita pela aba limpa as três cópias, porque o mapa muda com quarto, alocação e alojamento, e a lista de residentes mostra o nome do curso. Login, logout e 401 também limpam. No acesso por conta, a tela de residentes pede cursos e mapa com `Promise.all`, mantendo a mensagem de erro atual. Na demonstração, `loadOptions()` mantém o ramo `isDemo()` (`residents.component.ts:333-347`): cursos da memória e ajuste da página, sem pedir o mapa. O detalhe do quarto troca `residentApi.list()` por `residentApi.page({ roomId })`, filtro já aceito pelo backend (`ResidentRepository`, com alocação ativa), que sem `limit` devolve todos os moradores. O ramo `isDemo()` do detalhe (`demo.room()` e `demo.residentsInRoom()`) fica, e `loadOccupants()` continua sem rodar na demonstração.

- Rejeitado: passar também os cursos da demonstração pelo cache. A cópia de 60 s esconderia o curso recém-criado no signal, e a demonstração não tem ida ao servidor a economizar.
- Rejeitado: invalidar por serviço. É fácil esquecer um caminho de escrita, como a alocação, que muda a ocupação do mapa.
- Rejeitado: `shareReplay` ou um store de estado. Os serviços trabalham com Promises, e isso seria mais código.
- Rejeitado: guardar sem prazo e limpar só nas gravações. Alterações de outras pessoas nunca apareceriam sem recarregar.
- Rejeitado, no detalhe do quarto: um `residentApi.get(id)` por morador. Seriam até tantas idas quanto a capacidade, contra uma só.

### D10. Fonte de ícones com subconjunto gerado por script e conferido por teste Playwright

`frontend/scripts/subset-icons.py` (Python, fonttools e brotli, executado à mão) lê a lista de `frontend/src/fonts/material-symbols-rounded.json` e a fonte de `node_modules/material-symbols/material-symbols-rounded.woff2`. O script fixa wght 500, GRAD 0 e opsz 24 (mantendo o eixo FILL), retira do GSUB as ligaduras cujo resultado não está na lista e subconjunta para a–z, 0–9, `_` e os glifos mantidos. O resultado é gravado em `frontend/src/fonts/material-symbols-rounded-subset.woff2`, e o `sha256` é registrado no JSON. `styles.scss` troca o `@import` por um `@font-face` próprio, com `url('./fonts/material-symbols-rounded-subset.woff2')` e `font-display: block`. O build copia a fonte para `media/` com hash, e D1 a guarda. `material-symbols` vira `devDependency`. `frontend/e2e/icon-font.spec.ts` lê os `.ts` e `.html` de `src/app`: o texto dos elementos com `material-symbols-rounded` ou `-outlined`, os literais dentro deles e as propriedades `icon: '...'`. O teste falha nomeando cada ícone ausente do JSON, quando o `sha256` não bate com a fonte e quando ela passa de 100 kB. A mensagem traz o comando para gerar a fonte de novo. Um segundo teste, no navegador, confere em `/acesso` que um ícone ocupa no máximo 30 px de largura, ou seja, foi desenhado e não escrito.

- Rejeitado: spec Vitest. O pacote de testes unitários roda como código de navegador e não lê o sistema de arquivos para varrer os templates.
- Rejeitado: fonte em `frontend/public/`. Ela seria copiada sem hash e continuaria `no-store`, baixada a cada recarga.
- Rejeitado: `pyftsubset --text` só com os nomes. Isso mantém toda ligadura formada por letras, ou seja, todos os ícones.
- Rejeitado: parâmetro `icon_names` do Google Fonts. Cada nova geração dependeria de um serviço externo. A CSP (`font-src 'self'`) exige servir a fonte pela origem de qualquer forma.
- Rejeitado: remover `material-symbols`. A próxima geração exigiria baixar a fonte de origem à mão.

## Medições

**Antes**, levantadas em 13/11/2026 em produção (Coolify atrás do Cloudflare, ponto GRU) e no build local:

| Medida | Valor |
| --- | --- |
| TTFB de qualquer pedido que chega à origem | cerca de 230–235 ms com conexão reaproveitada; cerca de 300 ms com conexão nova |
| `main-WJFN5VBD.js`, `chunk-*.js`, `styles-EFZDFVRE.css`, `media/material-symbols-rounded-6ZHFLZPN.woff2` | `Cache-Control: no-store`, `cf-cache-status: BYPASS` |
| Fonte de ícones | 5.399.668 bytes; de 0,54 a 2,5 s numa conexão rápida; estimativa de 4 a 5 s em 4G |
| Código inicial | 559,13 kB brutos (139,88 kB estimados de transferência), acima do orçamento de 500 kB; `main` com 316,7 kB, dos quais 73 kB de `@angular/animations` |
| Código das páginas | 1,68 MB brutos em 75 arquivos, com cadeia de imports de até 3 níveis |
| `/auth/me` | um por navegação protegida (5 ou mais em 5 navegações); dois no login |
| Gravação | 2 idas em série (CSRF e gravação), pelo menos 470 ms |
| Lista de avaliações de limpeza | cerca de 81 consultas por página de 20 |
| Responsáveis com 3 cliques em Próxima | 4 listas completas de residentes |
| Detalhe do quarto | 4 pedidos pesados (mapa, alocações, todos os residentes e cursos) |
| Primeira visita a `/residentes` (estimativa) | de 0,9 a 1,4 s; meta de cerca de 1 ida (235 ms) |

Não foram medidos: requisições autenticadas em produção, throttling real do Postgres e região da VPS.

**Como medir depois:**

- Cache: `curl -s -o /dev/null -D - https://<host>/main-<hash>.js -w '%{time_starttransfer}\n'` duas vezes. Esperado: `cache-control: public, max-age=31536000, immutable`, `cf-cache-status: HIT` na segunda vez e TTFB de cerca de 30–40 ms. O mesmo para `/acesso` e `/api/v1/auth/csrf`, que devem mostrar `no-store` e nunca HIT.
- DevTools (Network, Fast 4G): depois de entrar, navegar por Início → Residentes → Quartos → Limpeza pelo menu. Contar `auth/me` (meta 1, o do login) e `chunk-*.js` depois de cada clique (meta 0). Recarregar e conferir "(disk cache)" nos arquivos com hash. Salvar dois residentes e contar `auth/csrf` (meta 1).
- Responsáveis: abrir e clicar 3 vezes em Próxima; contar `GET /api/v1/residentes` sem parâmetros (meta 1).
- Fonte: tamanho de `dist/frontend/browser/media/material-symbols-rounded-subset-*.woff2` (meta abaixo de 100 kB).
- Código inicial: linha "Initial total" de `npm run build` (meta de até 500 kB, sem aviso).
- Backend: `$upstream_response_time` no log do gateway para `GET /api/v1/limpeza/avaliacoes`, antes e depois. Dentro dos containers, `cat /sys/fs/cgroup/cpu.stat` (`nr_throttled`, `throttled_usec`) e `/actuator/metrics/hikaricp.connections.acquire` em `localhost:8080`.

## Risks / Trade-offs

- [Uma location com `add_header` perde os cabeçalhos do `server`] → `include` nas duas localizações. Os smokes exigem HSTS e CSP também no arquivo com hash.
- [A location com hash depois da genérica nunca casaria] → Fica antes da genérica. Um teste estático em `test_start_gateway.py` confere a ordem e casa nomes reais, e o smoke exige `immutable`.
- [Uma aba aberta antes de um deploy pede um arquivo de código que não existe mais] → 404 sem cache. A barra some e a página atual continua utilizável. Recarregar resolve, e o pré-carregamento reduz a janela, porque o código chega logo depois da abertura.
- [Conta desativada ou com perfil trocado continua vendo o menu antigo até a próxima chamada à API] → O servidor recusa toda chamada, e o 401 central leva ao acesso. Mudanças de perfil aparecem ao recarregar.
- [Outra aba do mesmo navegador sai e entra com outra conta; o cookie é o mesmo, e a aba antiga, sem `/auth/me` na navegação, mostraria a conta anterior e gravaria como a nova depois de renovar o token CSRF] → O login e o logout gravam `sager.session` no `localStorage`, e as outras abas consultam a sessão de novo (tarefa 3.10). Se o armazenamento falhar, a repetição por `csrf_invalid` confere `/auth/me` e não grava para outra conta. Só leituras podem mostrar, nesse caso, dados da conta nova sob o nome antigo até a próxima gravação ou recarga.
- [Alteração de outra pessoa em residentes, cursos ou mapa leva até 60 s para aparecer] → As gravações da própria aba limpam as cópias, e recarregar também.
- [Todos os chamadores recebem o mesmo objeto guardado; um que o ordene no lugar o altera para os outros] → A tarefa 5.2 confere os chamadores e copia antes de ordenar.
- [e2e que mudam o fixture entre navegações sem gravar pela interface podem ver a cópia guardada] → Esses testes recarregam a página ou passam a gravar pela interface.
- [Ícone fora do subconjunto aparece como texto] → Teste em `e2e/icon-font.spec.ts`. Nomes de ícone ficam como literais no código para o teste encontrá-los.
- [O ícone de 48 px da página inicial passa a usar o desenho de opsz 24] → Diferença visual pequena, conferida na captura da página inicial.
- [Outras mudanças mexem nos mesmos arquivos (`app.routes.ts`, `app.html`, `app.ts` e os serviços de gestão)] → Os grupos 1 e 2 já foram aplicados. Os grupos 3 a 5 começam depois de `remove-health-module`, que tira as rotas e os ramos de saúde de `app.routes.ts` e `app.ts`. `simplify-room-browsing`, `simplify-long-lists` e `hide-exits-for-adults` vêm depois: as duas primeiras mexem em `map()` e nos carregamentos das telas, e a terceira acrescenta à mesma guarda a checagem de maioridade. Como o `cached()` envolve o `map()` inteiro, a ordenação natural feita ali roda uma vez por cópia.
- [A demonstração não tem usuário em memória; uma guarda que só olhasse `principal()` a mandaria para `/acesso`] → `session.active()` vem primeiro na condição (D5). `app.routes.spec.ts` e `e2e/page-loading.spec.ts` conferem que a demonstração navega sem pedir nada a `/api/`, e `e2e/route-audit.spec.ts` continua abrindo todas as rotas da demonstração.
- [A primeira abertura do relatório individual por id espera o download do Chart.js] → Só a demonstração chega a essa rota pelo menu, e a barra de navegação (D7) mostra a espera. Hoje toda página já espera o próprio download.
- [Os limites de CPU podem passar da capacidade da VPS, compartilhada com Coolify, Traefik e WAHA] → `cpus` é teto, não reserva. O operador confirma a capacidade antes do deploy.

## Migration Plan

1. Onda 1, já aplicada: grupos 1 e 2 (gateway, compose, Hikari e limpeza). Não há migração Flyway nem mudança de dados. Para voltar atrás, basta reimplantar o commit anterior no Coolify. Arquivos já guardados com hash são inofensivos, porque a página `no-store` passa a apontar para os nomes antigos.
2. Medir com os comandos acima logo depois do deploy e anotar os números na descrição do PR.
3. Onda 2: grupos 3, 4 e 5, depois de `remove-health-module`. São só frontend, com volta pelo mesmo reimplante. Os usuários recebem a versão nova ao recarregar, porque a página não fica guardada. A demonstração muda junto, no mesmo build, e continua fora de produção.

## O que a instituição ou o operador ainda decide

- Operador: a região da VPS: o TTFB de 230 ms até para um favicon indica origem distante.
- Operador: conferir que nenhuma regra do painel do Cloudflare força "Bypass cache" nem sobrepõe o `Cache-Control` da origem. Ajustar os limites de `infra/production/compose.yml`, se esse deploy for usado.
- Operador e instituição: o servidor definitivo, que, com o WAHA na mesma VPS, precisa de no mínimo 2 vCPU e 4 GB, mais swap (RNF Desempenho, cap4.tex:197; cap5.tex:274).
- Instituição: método de medição do requisito de resposta em até 2 segundos do RNF Desempenho (cap4.tex:197): operações, massa de dados e fronteira da medição. A medição no servidor definitivo continua pendente (cap5.tex:274). A confirmar com a AE e a TI.
- Instituição: aceitar que alterações feitas por outra pessoa em residentes, cursos e mapa de quartos podem levar até 60 s para aparecer numa aba já aberta. A confirmar com a AE.
- Instituição: aceitar que uma conta desativada ou com perfil trocado veja o menu antigo até a próxima chamada ao servidor, que é sempre recusada. A confirmar com a AE.

## Reflexo na monografia

O dono decide o texto; esta mudança não edita a monografia.

- Novidades visíveis que entram no texto: o 401 tratado em um só lugar (no fim de cap6.tex:71) e a barra fina de navegação com o conteúdo marcado como ocupado e sem animação com movimento reduzido (no fim de cap6.tex:77).
- Ficam imprecisos depois dos grupos 3 a 5: cap6.tex:61 diz que as páginas carregam conforme a navegação e que a guarda consulta `/api/v1/auth/me` no acesso por conta. Passa a valer que as páginas são pré-carregadas, exceto o relatório individual da demonstração, e que a guarda só consulta a sessão ao abrir o sistema ou sem usuário conhecido. cap6.tex:71 diz que o serviço obtém o token CSRF em cada operação que altera informações. Passa a valer que o token é obtido uma vez por sessão e renovado quando o servidor o recusa.
- cap6.tex:7 e :23 continuam corretos: o Chart.js 4.5.1 desenha só o gráfico da demonstração, e esta mudança não troca a versão.
