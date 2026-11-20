Os caminhos são relativos à raiz do repositório. Comandos Maven rodam em `backend/` (`.\mvnw.cmd` no Windows) e comandos npm/npx em `frontend/`. Não há migração.

## 1. Conversas

- [x] 1.1 Em `frontend/src/app/features/communications/conversations-list.scss`, pôr `position: relative` em `.conv-rows`, com o comentário de `.conv-log` (design D1). Em `frontend/e2e/conversations-local.spec.ts`, "tela na altura da janela": incluir uma conversa não lida no fim de uma lista maior que a tela e conferir que a página só rola até o rodapé. Verificar com `npx playwright test e2e/conversations-local.spec.ts`, que falha sem a linha de CSS.

## 2. Registrar saída

- [x] 2.1 Em `frontend/src/app/features/operations/operations-local.utils.ts`, criar a função do mínimo da partida, o maior instante entre a partida pedida e a aprovação, e usá-la em `exit-detail-local.component.ts` e `long-exit-detail.component.ts`. Em `review-dialog-local.component.ts`, trocar a mensagem da partida por "A partida não pode ser anterior à saída solicitada nem à aprovação." (design D2). Verificar com `npx ng test --watch=false` nos testes de `operations-local.utils.spec.ts` (função), `review-dialog-local.component.spec.ts` (o diálogo recusa, mostra a mensagem e não fecha) e `exit-detail-local.component.spec.ts` e `long-exit-detail.component.spec.ts` (os detalhes mandam a aprovação como mínimo; falham com a linha antiga).

## 3. Demonstração

- [x] 3.1 Em `frontend/src/app/features/operations/operations-demo.service.ts`, exportar a função que diz se a situação da saída está pendente, com "Aprovada" entre elas, e usá-la nos filtros "Pendentes" e "Concluídas" de `exits.component.ts` (design D3). Verificar com um teste em `operations-demo.service.spec.ts` e com `npx ng test --watch=false`.

## 4. Relatórios

- [x] 4.1 Em `backend/src/main/java/br/edu/ifgoiano/sager/reports/ReportExportWorker.java`, `metric`: devolver "Sem avaliação" para `cleaningMean` nula (design D4). Em `backend/src/test/java/br/edu/ifgoiano/sager/reports/CleaningReportsIntegrationTest.java`, esperar "Nota média de limpeza: Sem avaliação" no PDF. Verificar com `.\mvnw.cmd -B -ntp test -Dtest=CleaningReportsIntegrationTest`.

## 5. Cabeçalho no celular

- [x] 5.1 Em `frontend/src/app/app.scss` e `app.html`, até 400 px, pôr o nome "Menu" embaixo do ícone, com o número ao lado, e diminuir margens e espaços do cabeçalho (design D5). Em `frontend/e2e/mobile-fit.spec.ts`, entrar na demonstração como supervisor em 360×740 e 320×568 e conferir que as três caixas não se cruzam, ficam dentro da tela e que o botão tem 48 px e cabe no cabeçalho. Verificar com `npx playwright test e2e/mobile-fit.spec.ts e2e/pending-badges.spec.ts e2e/navigation-mobile.spec.ts`.

## 6. README

- [x] 6.1 Em `infra/coolify/README.md`, "Ver o banco": começar o bloco com `export SAGER_CHECKOUT=/data/coolify/applications/rhamqqvry6aidhlfkqnzysk8` (design D6). Verificar lendo o bloco: ele roda sozinho, sem depender de outra seção.

## 7. Verificação final

- [x] 7.1 `npx @fission-ai/openspec@2.0.0 validate review-fixes-pr35 --strict` na raiz. Verificar pela saída sem erro.
- [ ] 7.2 `./sager ci` na raiz. Verificar pelos logs em `.ci/`, com backend, frontend, infraestrutura e OpenSpec verdes.
