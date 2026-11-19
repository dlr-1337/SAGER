Os caminhos são relativos à raiz do repositório. Comandos Maven rodam em `backend/` (`.\mvnw.cmd` no Windows) e comandos npm/npx em `frontend/`. Os testes de integração usam o relógio controlado. Não há migração nem rotina nova.

## 1. Backend: a aprovação só decide

- [ ] 1.1 Em `backend/src/main/java/br/edu/ifgoiano/sager/operations/shortexits/ShortExitService.java` e `backend/src/main/java/br/edu/ifgoiano/sager/operations/longexits/LongExitService.java`, `decide`: tirar `departNow`, a conferência de saída física aberta na aprovação e a segunda gravação `EM_ANDAMENTO` (design D1, D2). Verificar com os testes da 1.2 e da 1.3.
- [ ] 1.2 Em `backend/src/test/java/br/edu/ifgoiano/sager/operations/OperationsApiIntegrationTest.java`:
  - trocar o teste da aprovação que registrava a partida por um que aprova a saída `NOW` e recebe `APROVADA`, versão 1, sem partida, retorno previsto na partida pedida mais 3 h, `canDepart` verdadeiro, histórico `CREATE` e `APPROVE` e uma auditoria; 20 min depois, `POST .../partida` deixa `EM_ANDAMENTO` com a partida e o retorno contados desse registro e o evento `DEPARTURE` do supervisor;
  - trocar o teste do conflito físico na aprovação por um em que a aprovação passa e a partida responde 409 `physical_exit_conflict`, com a saída ainda `APROVADA`;
  - acrescentar: a saída `NOW` aprovada sem partida responde 409 `deadline_passed` na partida depois do prazo e expira com `APPROVED_WITHOUT_DEPARTURE`;
  - ajustar os testes que aprovavam e já contavam com a partida (`departedExit`, `concurrentOverlappingRequestsAndReturnsPersistOnlyOneChange`, `recordedDepartureFixesTheReturnThreeHoursLaterWithoutOverlapRefusal`, `authorizesThroughExactExpectedReturnButNotWhenAlreadyReturnedAtOpening` e `pendingAndPhysicallyLateExitsNeverJustifyNightAbsence`) para registrar a partida com `POST .../partida`.
  - Verificar com `.\mvnw.cmd -B -ntp -Dtest=OperationsApiIntegrationTest test`.
- [ ] 1.3 Em `backend/src/test/java/br/edu/ifgoiano/sager/operations/longexits/LongExitApiIntegrationTest.java`:
  - aprovar a saída longa `NOW` com autorização conferida devolve `APROVADA`, sem partida e com `canDepart` verdadeiro; `POST .../partida` a deixa `EM_ANDAMENTO`, com `APPROVE` e `DEPARTURE` do mesmo supervisor no histórico;
  - aprovar com outra saída em andamento é aceito, e a partida responde 409 `physical_exit_conflict`;
  - os testes da chamada noturna (`residentOutOnLongExitIsJustifiedBySystemWhenTheNightCallOpens` e `longExitOfManyDaysJustifiesEveryNightCallUntilTheExpectedReturn`) registram a partida depois de aprovar.
  - Verificar com `.\mvnw.cmd -B -ntp -Dtest=LongExitApiIntegrationTest test`.
- [ ] 1.4 Ajustar os outros testes que esperavam `EM_ANDAMENTO` na aprovação: `backend/src/test/java/br/edu/ifgoiano/sager/integrations/IntegrationFlowIntegrationTest.java` (aprovação da saída longa passa a `APROVADA`), `backend/src/test/java/br/edu/ifgoiano/sager/discipline/DisciplineApiIntegrationTest.java` (`departedShortExit` registra a partida) e `backend/src/test/java/br/edu/ifgoiano/sager/reports/CleaningReportsIntegrationTest.java` (a volta atrasada vem depois da partida registrada). Verificar com `.\mvnw.cmd -B -ntp -Dtest=IntegrationFlowIntegrationTest,DisciplineApiIntegrationTest,CleaningReportsIntegrationTest test`.

## 2. Frontend: telas, textos, ajuda e demonstração

- [x] 2.1 Em `frontend/src/app/features/operations/review-dialog-local.component.ts`, acrescentar o campo opcional `note`, mostrado como texto de ajuda acima do resumo (design D4). Em `operations-local.utils.ts`, tirar `approvalMessage`. Verificar com as specs da 2.2 e da 2.3.
- [x] 2.2 Em `frontend/src/app/features/operations/exit-detail-local.component.ts` (design D3, D4, D5):
  - passos sempre "Decisão", "Saída" e "Volta";
  - no passo "Saída", "Registre a saída quando o residente se apresentar." com a partida pedida alcançada, ou "Saída marcada para <data e hora>." antes dela;
  - diálogo de aprovação com título "A saída será aprovada.", a nota "Aprovar não registra a saída; ela é registrada quando o residente se apresentar.", botão "Confirmar aprovação" e mensagem "Aprovação registrada.";
  - o residente lê "Apresente-se ao supervisor para ele registrar a saída." na aprovada cuja hora chegou.
  - Cobrir em `exit-detail-local.component.spec.ts` (aprovar o pedido para sair agora deixa "Aprovada" com "Registrar saída"; conflito físico no registro da saída não trava as ações; texto do residente). Verificar com `npx ng test --watch=false --include src/app/features/operations/exit-detail-local.component.spec.ts`.
- [x] 2.3 O mesmo da 2.2 em `frontend/src/app/features/operations/long-exit-detail.component.ts`, com o título "A saída longa será aprovada.". Cobrir em `long-exit-detail.component.spec.ts`. Verificar com `npx ng test --watch=false --include src/app/features/operations/long-exit-detail.component.spec.ts`.
- [x] 2.4 Ajuda em `frontend/src/app/features/portal/portal.pages.ts`: "Quando a saída começa?" passa a "A saída começa quando o supervisor vê o residente e registra a saída, a partir do horário pedido. A aprovação não registra a saída."; no guia da saída longa, o passo "Decisão" deixa de dizer que aprovar registra a saída, e o passo "Saída" vale para toda saída aprovada. Cobrir em `portal.pages.spec.ts`. Verificar com `npx ng test --watch=false --include src/app/features/portal/portal.pages.spec.ts`.
- [x] 2.5 Demonstração (design D6): em `frontend/src/app/features/operations/operations-demo.service.ts`, `decideExit` deixa sempre "Aprovada"; `recordDeparture` passa a aprovada cuja hora chegou a "Em andamento", com "Saída registrada pelo supervisor"; o caso S-1047 tem a aprovação antes da saída. Em `exit-detail.component.ts`, o supervisor vê "Registrar saída" nessa situação. Cobrir em `operations-demo.service.spec.ts`. Verificar com `npx ng test --watch=false --include src/app/features/operations/operations-demo.service.spec.ts`.
- [x] 2.6 Formatar os arquivos tocados com `npx prettier --write <arquivos>` e conferir com `npx prettier --check <arquivos>`; compilar com `npx ng build`.

## 3. Jornadas no navegador

- [x] 3.1 Em `frontend/e2e/operations-local.spec.ts`, o `mockApi` deixa de registrar a partida na aprovação. O teste do pedido para sair agora passa a aprovar ("Confirmar aprovação", nota no diálogo, "Aprovada", "Registrar saída"), registrar a saída (versão 1) e depois a volta tardia (versão 2), com três eventos no histórico. O conflito físico passa a vir do registro da saída e mantém "Registrar saída" ativo. O teste do conflito de edição usa "Confirmar aprovação". Verificar com `SAGER_E2E_PORT=4331 CI=1 npx playwright test e2e/operations-local.spec.ts --workers=1`.
- [x] 3.2 Em `frontend/e2e/long-exits-local.spec.ts`, a mesma mudança no `mockApi` e nos testes que aprovavam e já saíam: a aprovação deixa "Aprovada", "Registrar saída" registra a partida e a volta retroativa continua preservando os horários. Verificar com `SAGER_E2E_PORT=4331 CI=1 npx playwright test e2e/long-exits-local.spec.ts --workers=1`.

## 4. Documentação

- [x] 4.1 AGENTS.md, "Current Domain Decisions": trocar "approving an exit whose requested departure has arrived (a request to leave now) records the departure in the same act, ..." por "approval never records the departure; the supervisor records it in a separate act, in person, from the requested time" e dizer na frase do prazo que as 3 horas contam da partida registrada em pessoa. Verificar com `rg -n "same act" AGENTS.md` sem resultado.
- [x] 4.2 docs/ARQUITETURA.md, D05 e D06: a aprovação não registra a partida, o supervisor registra a partida presencialmente a partir do horário pedido, e a aprovada sem partida, "agora" ou agendada, expira no retorno previsto. Verificar com `rg -n "no mesmo ato" docs/ARQUITETURA.md` sem resultado.
- [x] 4.3 docs/MANUAL.md: Supervisor item 2 (registre a saída quando o residente se apresentar; passo "Saída" em toda aprovada) e Residente item 4 (apresente-se ao supervisor; a aprovação não registra a saída). Verificar com `rg -n "já registra a saída" docs/MANUAL.md` sem resultado.

## 5. Validação

- [x] 5.1 Rodar `npx @fission-ai/openspec@2.0.0 validate exit-departure-in-person --strict` na raiz; verificar que passa.
