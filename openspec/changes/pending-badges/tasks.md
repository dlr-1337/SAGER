Comandos:
- backend em `backend/` com `./mvnw -B -ntp -Dtest=<Classe> test` (`.\mvnw.cmd` no Windows), JDK 21 e Docker;
- frontend em `frontend/` com `npx ng test --watch=false --include <spec>`, `npm run build` e `SAGER_E2E_PORT=4335 CI=1 npx playwright test <arquivo>`.

## 1. Contagem no servidor

- [x] 1.1 Criar o pacote `pending`:
  - `PendingService`, com as contagens de D2 a D6 num único `SELECT` de leitura;
  - `PendingController` em `GET /api/v1/me/pendencias`, com `Cache-Control: no-store`.

  Verificar com `PendingApiIntegrationTest`:
  - supervisor: saídas no prazo, fora do prazo e aprovadas com a saída chegada, em três horários;
  - notificações visualizadas, convertidas e com origem corrigida;
  - chamada aberta e encerrada;
  - conversa com mensagem recebida, enviada e lida;
  - residente: rascunho, publicado, lido sem ciência, com ciência, anulado e de outro residente.
- [x] 1.2 Liberar `GET /api/v1/me/pendencias` só para supervisor e residente em `SecurityConfiguration`. Verificar com `PendingApiIntegrationTest`:
  - sem sessão: 401;
  - gestor: 403;
  - `POST`: 403;
  - com `X-Sager-Auto-Refresh`: 200 e `no-store`.
- [x] 1.3 Incluir o pacote no OpenAPI local e conferir a API fechada no perfil desconhecido. Verificar com `ApiFoundationIntegrationTest` (caminho no OpenAPI) e `AuthFlowIntegrationTest` (perfil fechado responde 401 ou 403).

## 2. Contadores na interface

- [x] 2.1 Criar `core/pending-badges.service.ts`:
  - consulta ao entrar, ao trocar de tela, depois de gravação, a cada 30 s com a aba visível e ao voltar à aba;
  - pausa depois de 30 minutos sem interação;
  - cabeçalho de consulta automática;
  - resposta conferida por perfil e presa à conta.

  Avisar as gravações em `core/api.ts`. Verificar com `pending-badges.service.spec.ts` e `api.spec.ts`.
- [x] 2.2 Criar `shared/pending-badge.component.ts`, com número, "99+", texto "N pendentes" e nada com zero. Verificar com `pending-badge.component.spec.ts`.
- [x] 2.3 No shell (`app.html`, `app.ts`, `app.scss`), mostrar o contador nos itens do menu e da gaveta e a soma no botão "Menu", com `aria-describedby`. Verificar com `app.spec.ts`:
  - itens do supervisor e do residente com contador;
  - gestor sem contador;
  - "Menu" com nome estável e descrição.
- [x] 2.4 Mostrar o contador nas abas:
  - "Saídas curtas" e "Saídas longas" (`exits-local.component.ts`);
  - "Avisos", "Advertências" e "Termos de compromisso" (`own-communications-local.pages.ts`);
  - abas da demonstração em `notices.page.ts`, que passam a mostrar só os itens sem ciência.

  Verificar com `exits-local.component.spec.ts` e `own-communications-local.pages.spec.ts`; as abas da demonstração, com `e2e/pending-badges.spec.ts`.

## 3. Demonstração

- [x] 3.1 Criar `features/portal/pending-badges-demo.ts`, com os números calculados dos serviços `*-demo` e carregado por `import()`. Verificar com `pending-badges-demo.spec.ts`:
  - cenário "Padrão" com 3, 2 e 1 para o supervisor e 2 para o residente;
  - ciência e chamada concluída mudam os números;
  - outros cenários sem números.
- [x] 3.2 Escrever o e2e `e2e/pending-badges.spec.ts`:
  - supervisor e residente da demonstração no computador e no celular, com o botão "Menu";
  - ciência que tira o contador;
  - nenhuma consulta à API;
  - axe sem violações.

  Ajustar `e2e/tab-scroll.spec.ts` ao nome do item com contador. Verificar com `SAGER_E2E_PORT=4335 CI=1 npx playwright test e2e/pending-badges.spec.ts e2e/tab-scroll.spec.ts e2e/navigation-mobile.spec.ts`.

## 4. Documentação e verificação final

- [x] 4.1 Descrever os contadores em `docs/MANUAL.md` (Acesso, Supervisor e Residente) e o pacote `pending` e a consulta de 30 s em `docs/ARQUITETURA.md`. Verificar relendo as seções.
- [ ] 4.2 Rodar:
  - `npx -y @fission-ai/openspec@2.0.0 validate pending-badges --strict`;
  - `npm run build`;
  - os testes das tarefas 1 a 3.
