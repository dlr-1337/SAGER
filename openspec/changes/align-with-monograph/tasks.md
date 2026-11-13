# Tasks

Os caminhos do frontend são relativos a `frontend/`, e os do backend, a `backend/`. Rode os comandos do frontend em `frontend/` e os do backend em `backend/`. O modo demonstração (RF027) fica: nenhum ramo `isDemo()`/`session.active()` nem `*-demo.service` é removido ou renomeado. Cada grupo diz se a demonstração acompanha a mudança. Formate com `npx prettier --write <arquivo>` cada arquivo do frontend tocado.

## 1. Ficha do residente sem a aba Termos (RF002, RF022; D1)

- [x] 1.1 Em `src/app/features/management/resident-detail.component.ts`, tirar `'termos'` de `ResidentTab`, os dois botões "Termos", o `@else` "Ainda não integrado" e o painel `@if (tab() === 'termos')` da demonstração. A demonstração acompanha a mudança. Verificar com `npm run build`.
- [x] 1.2 Em `e2e/tab-scroll.spec.ts`, tirar `'Termos'` das duas listas de abas e conferir, nos dois testes (demonstração e acesso por conta), que `tabs.getByRole('button', { name: 'Termos' })` tem contagem 0. Verificar com `npx playwright test tab-scroll`.

## 2. Ajuda de senha (RF020, UC02; D2)

- [ ] 2.1 Em `src/app/features/portal/portal.pages.ts` (HelpPage, ramo sem demonstração), trocar a resposta de "Como recuperar ou alterar minha senha?" pelo texto da D2, com `<a routerLink="/recuperar-senha">Esqueci minha senha</a>`. A demonstração não acompanha: o ramo `session.active()` continua com "Esta demonstração usa dados reais?". Verificar com um caso novo em `src/app/features/portal/portal.pages.spec.ts` (describe HelpPage). Sem demonstração, o caso confere o link para `/recuperar-senha` e o texto do suporte para gestor e supervisor. Com a demonstração ativa, confere que a pergunta da demonstração continua. Rodar `npm test -- --watch=false --include=src/app/features/portal/portal.pages.spec.ts`.

## 3. Justificativas de 10 a 2.000 caracteres (RN05, UC05, UC07; D4)

- [ ] 3.1 Em `src/app/features/operations/operations-local.utils.ts`, `validJustification` passa a aceitar até 2.000 caracteres. Em `operations-local.utils.spec.ts`, trocar `'a'.repeat(501)` por `'a'.repeat(2001)` (recusado) e acrescentar `'a'.repeat(2000)` (aceito). Verificar com `npm test -- --watch=false --include=src/app/features/operations/operations-local.utils.spec.ts`.
- [ ] 3.2 Em `src/app/features/operations/review-dialog-local.component.ts`, usar `maxlength="2000"` nas duas textareas e "10 a 2.000 caracteres" na ajuda e nas duas mensagens de erro. A demonstração não acompanha esta tarefa, porque os diálogos dela não têm o limite de 500. Verificar com casos novos em `review-dialog-local.component.spec.ts`, que valem para saídas e chamada:
  - uma justificativa de 2.000 caracteres fecha o diálogo com o texto;
  - uma de 9 caracteres mostra "Informe uma justificativa com 10 a 2.000 caracteres.";
  - a textarea tem `maxlength` 2000.

  Rodar `npm test -- --watch=false --include=src/app/features/operations/review-dialog-local.component.spec.ts`.

## 4. Rejeição de saída curta com motivo (RN05; D3)

- [ ] 4.1 Em `src/app/features/operations/exit-detail-local.component.ts`, `decide()` passa `requireReason: decision === 'REJECT', comment: decision === 'APPROVE'`. A demonstração não acompanha esta tarefa, porque já exige motivo na rejeição; o mínimo de 10 chega pelo grupo 5. Depende do grupo 3, porque a mensagem "10 a 2.000" vem da tarefa 3.2. Verificar com um teste novo em `e2e/operations-local.spec.ts`, "rejeição de saída curta exige justificativa":
  - sem texto ou com 9 caracteres, o diálogo mostra o alerta "10 a 2.000" e `state.writes` fica vazio;
  - com 10 caracteres, o corpo da escrita em `/decisao` tem `decision: 'REJECT'` e `comment` igual ao texto, e a tela mostra "Rejeitada".

  Rodar `npx playwright test operations-local`.

## 5. Demonstração: rejeição antes da conferência (RN05, UC07 alternativo; D5)

- [ ] 5.1 Em `src/app/features/operations/operations-demo.service.ts`, `decideExit` deixa de recusar a rejeição de saída longa sem conferência e recusa a rejeição cujo motivo, depois do `trim()`, tenha menos de 10 ou mais de 2.000 caracteres. Este grupo é só da demonstração. Verificar com um caso novo em `operations-demo.service.spec.ts`. Em S-1048, antes da conferência:
  - 9 caracteres e 2.001 caracteres devolvem `false`, e a situação continua "Aguardando autorização";
  - 10 caracteres devolvem `true`, a situação passa a "Rejeitada" e a linha do tempo traz o motivo;
  - `decideExit('S-1048', 'approve')` continua `false`.

  Rodar `npm test -- --watch=false --include=src/app/features/operations/operations-demo.service.spec.ts`.
- [ ] 5.2 Em `src/app/features/operations/review-dialog.component.ts`, acrescentar `minReason?: number` a `ReviewDialogData`. Com ele, `confirm()` recusa um texto mais curto, o campo limita a 2.000 caracteres e a mensagem é "Escreva de 10 a 2.000 caracteres.". Em `exit-detail.component.ts`, tirar o `[disabled]` de "Rejeitar", passar `minReason: 10` só em `decide(…, 'reject')` e trocar o aviso pelo texto da D5. Verificar em `e2e/journeys.spec.ts`:
  - no teste "aprovação longa bloqueada…", "Rejeitar" está habilitado antes da conferência;
  - num teste novo em S-1048, sem conferência, 9 caracteres mostram o erro e 10 caracteres levam a "Rejeitada".

  Rodar `npx playwright test journeys`.

## 6. Demonstração: limpeza e ranking com a regra adotada (RF010, RF012, RN11, RN14; D6)

- [ ] 6.1 Aplicar os textos e os formatos da D6 em `src/app/features/operations/cleaning.component.ts`, `ranking.component.ts` e `operations-demo.service.ts:257`. Os dois componentes usam o `decimal()` de `features/cleaning/cleaning-local.utils.ts`, não o pipe `number`. Este grupo é só da demonstração. Verificar com um teste novo em `e2e/journeys.spec.ts`, com perfil supervisor:
  - em `/limpeza`, aparece "Regras da avaliação" e "Critérios pendentes da AE" tem contagem 0;
  - simular A-102 mostra "7,50", "8,00" e "0,50 ponto(s)";
  - em `/ranking`, aparece "Como o ranking é calculado" e "Fórmula pendente da AE" tem contagem 0.

  Acrescentar também, em `operations-demo.service.spec.ts`, que a evidência de N-200 é "Nota de limpeza abaixo de 6,00.". Rodar `npx playwright test journeys route-audit` e o Vitest do arquivo.

## 7. Fechamento da chamada em data posterior (RN09, diagrama de sequência da chamada, passo 9; D7)

- [ ] 7.1 Em `src/app/features/operations/night-call-local.component.ts`, `windowReview` passa a receber o motivo da exceção. `open()` usa `context.outsideWindow`. `close()` usa `context.outsideWindow || call.referenceDate !== context.referenceDate`, com o aviso e a declaração da D7 quando só a data difere. A demonstração não acompanha: a chamada dela é uma simulação com alerta próprio. Verificar com casos novos em `night-call-local.component.spec.ts`, com `MatDialog.open` substituído por um dublê que captura os dados:
  - com a chamada de 2026-09-29, o contexto de 2026-09-30 e `outsideWindow: false`, os dados têm `requireReason`, `requireConfirmation` e o aviso "A chamada é de um dia anterior…";
  - com a chamada e o contexto de 2026-09-30, os dados não pedem justificativa.

  Rodar `npm test -- --watch=false --include=src/app/features/operations/night-call-local.component.spec.ts`.

## 8. Demonstração: chamada só com menores (RN02; D8)

- [ ] 8.1 Em `src/app/features/management/management-demo.service.ts`, trocar o nascimento de Pedro Henrique Silva para `2009-12-03` e o de Beatriz Costa para `2010-08-22`. Este grupo é só da demonstração. Verificar com um caso novo em `src/app/features/management/management-demo.service.spec.ts`. Com `vi.setSystemTime` em 2026-12-31, cada nome de `OperationsDemoService.minors` corresponde a um residente de `ManagementDemoService.residents()` com menos de 18 anos. O caso precisa falhar com as datas antigas antes da troca. Rodar `npm test -- --watch=false --include=src/app/features/management/management-demo.service.spec.ts --include=src/app/features/management/residents-demo-rooms.spec.ts --include=src/app/features/management/management-demo-pagination.spec.ts`.

## 9. Auditoria das contas (RN16, RN17, RF025; D9)

- [ ] 9.1 Pré-condição: `remove-health-module` aplicada, e `V30__*.sql`, `V31__*.sql` e `V32__*.sql` presentes em `src/main/resources/db/migration/`. A demonstração não acompanha, porque nunca chama a API. Verificar com `ls src/main/resources/db/migration/V3*`; se faltar alguma, parar o grupo.
- [ ] 9.2 Criar `src/main/resources/db/migration/V33__local_account_audit.sql` como na D9. Verificar com um teste novo em `src/test/java/br/edu/ifgoiano/sager/audit/AuditMigrationIntegrationTest.java`, que migra até `32`, grava um evento antigo e migra até `33`. Ele confere que:
  - o evento antigo continua igual;
  - o banco aceita `LOCAL_ACCOUNT`/`UPDATE`/`{password}` com `LOCAL_API` e ator, e `LOCAL_ACCOUNT`/`CREATE` com `OPERATOR_CLI` sem ator;
  - o banco recusa `{passwordHash}`, `OPERATOR_CLI` com ator e `OPERATOR_CLI` com recurso `RESIDENT`.

  Rodar `.\mvnw.cmd -B -ntp -Dtest=AuditMigrationIntegrationTest test`.
- [ ] 9.3 Em `audit/AuditResource.java`, acrescentar `LOCAL_ACCOUNT` com os campos da D9. Em `AuditRepository.java`, acrescentar a inserção com origem `OPERATOR_CLI` e `'LOCAL_ACCOUNT'` à lista de `find`. Em `AuditService.java`, criar dois métodos: o do terminal, que recusa rodar durante uma requisição HTTP, e o da recuperação, que recebe ator e perfil e exige a correlação da requisição. Verificar com casos novos em `AuditServiceIntegrationTest.java`: o método do terminal recusa contexto de requisição, e o da recuperação recusa a falta de correlação. Rodar `.\mvnw.cmd -B -ntp -Dtest=AuditServiceIntegrationTest test`.
- [ ] 9.4 Em `auth/ResidentRecoveryService.java`, gravar `LOCAL_ACCOUNT`/`UPDATE`/`{password}` com a própria conta como ator e o perfil `residente`, depois de `updatePassword` devolver 1. Verificar em `management/residents/ResidentApiIntegrationTest.java`:
  - em `recoversOnlyAfterMatchingRegisteredIdentityAndActiveGuardianAndRevokesSessions`, há exatamente um evento desses depois do 204 e nenhum depois dos 400;
  - em `GET /api/v1/auditoria?resource=LOCAL_ACCOUNT`, um gestor recebe o evento sem valores.

  Rodar `.\mvnw.cmd -B -ntp -Dtest=ResidentApiIntegrationTest test`.
- [ ] 9.5 Em `auth/LocalAccountProvisioningService.java`, fazer `create`, `resetPassword`, `disable`, `link*`, `unlink` e `assignEnrollment` gravarem o evento de terminal da D9 quando não houver requisição HTTP. Para isso, `LocalAccountRepository.create` passa a devolver o id. Um vínculo que não muda nada não grava evento. Verificar com casos novos em `auth/LocalAccountLinksIntegrationTest.java`:
  - `provisioning.create(...)`, chamado no fio do teste sem requisição HTTP, gera `CREATE` com `OPERATOR_CLI` e sem ator. O comando `create` do runner não serve aqui, porque lê a senha de `System.console()`, que é nulo no Surefire;
  - pelos comandos do runner (`commands.run(...)`), `disable` gera `END` com `{active}`, `link-resident` gera `UPDATE` com `{residentId}` e `list` não gera evento.

  Rodar `.\mvnw.cmd -B -ntp -Dtest=LocalAccountLinksIntegrationTest+ResidentApiIntegrationTest+SupervisorApiIntegrationTest test`, para confirmar que as contagens do cadastro assistido não mudam.
- [ ] 9.6 Em `docs/ARQUITETURA.md` (seção "Auditoria", :78) e `docs/OPERACAO.md` (comandos de contas), registrar que a recuperação de senha e os comandos do terminal gravam evento de conta, os do terminal com a origem `OPERATOR_CLI`. Verificar com `git grep -n "OPERATOR_CLI" docs/`.

## 10. Verificação geral

- [ ] 10.1 Frontend completo, com a demonstração preservada. Rodar `npm run build`, `npm test -- --watch=false` e `npx playwright test tab-scroll operations-local journeys route-audit management-pagination-demo visual-review`, todos sem falhas. Em /demonstracao, conferir à mão que a ficha, as saídas, a limpeza, o ranking e a chamada abrem com os perfis gestor, supervisor e residente.
- [ ] 10.2 Backend completo. Rodar `.\mvnw.cmd -B -ntp verify` sem falhas.
- [ ] 10.3 Rodar `openspec validate align-with-monograph --strict` na raiz e conferir que passa.

## Workflow follow-up

- Depois de aplicada a V33, levar à monografia o texto da seção "Pendências" de design.md.
- Arquivar a change depois da revisão do dono.
