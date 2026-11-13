# Tasks

Caminhos do backend relativos a `backend/src/test/java/br/edu/ifgoiano/sager/`; do frontend, a `frontend/src/app/`; os de navegador, a `frontend/e2e/`. Nenhuma tarefa muda código. Um cenário sem teste fica listado em design.md, "Divergências e lacunas".

## 1. Acesso e cadastros

- [x] 1.1 Conferir os 15 requisitos de `access-control` contra `auth/AuthFlowIntegrationTest.java`, `auth/ProductionAuthIntegrationTest.java`, `auth/LocalAccountLinksIntegrationTest.java`, `auth/LocalAccountProvisioningRunnerTest.java`, `auth/AccountCommandApplicationIntegrationTest.java`, `auth/HeaderOnlyCsrfTokenHandlerTest.java`, `api/ApiFoundationIntegrationTest.java`, `SagerApplicationCommandProfileTest.java`, `core/local-auth.service.spec.ts`, `features/portal/recovery.page.spec.ts`, `app.routes.spec.ts`, `local-auth.spec.ts`, `enrollment-catalog-recovery.spec.ts` e `route-audit.spec.ts`. Verificação: cada cenário aponta o teste que o comprova ou fica registrado como lacuna.
- [x] 1.2 Conferir os 5 requisitos de `resident-registry` contra `management/residents/ResidentApiIntegrationTest.java`, `management/residents/ResidentNameFormatTest.java`, `auth/EnrollmentCatalogMigrationIntegrationTest.java` e `residents-local.spec.ts`. Verificação: a mesma da 1.1.
- [x] 1.3 Conferir os 3 requisitos de `guardian-records` contra `management/guardians/GuardianApiIntegrationTest.java`, `operations/longexits/LongExitApiIntegrationTest.java`, `integrations/IntegrationFlowIntegrationTest.java` (`alteredStoredFilesAndChangedGuardianBlockTheDecision`) e `guardians-local.spec.ts`. Verificação: a mesma da 1.1.

## 2. Estrutura e alocação

- [x] 2.1 Conferir os 4 requisitos de `housing-records` contra `management/accommodations/AccommodationApiIntegrationTest.java`, `management/rooms/RoomApiIntegrationTest.java`, `management/rooms/RoomMigrationIntegrationTest.java`, `accommodations-local.spec.ts` e `rooms-local.spec.ts`. Verificação: cada cenário aponta o teste que o comprova ou fica registrado como lacuna.
- [x] 2.2 Conferir os 5 requisitos de `resident-allocation` contra `management/allocations/AllocationApiIntegrationTest.java`, `management/allocations/AllocationMigrationIntegrationTest.java` e `allocations-local.spec.ts`. Verificação: a mesma da 2.1, incluindo os cenários de pedidos simultâneos.

## 3. Operações

- [x] 3.1 Conferir os 7 requisitos de `night-call` contra `operations/OperationsApiIntegrationTest.java`, `operations/OperationsMigrationIntegrationTest.java` e `operations-local.spec.ts`. Verificação: cada cenário aponta o teste que o comprova ou fica registrado como lacuna.
- [x] 3.2 Conferir os 11 requisitos de `exit-requests` contra `operations/OperationsApiIntegrationTest.java`, `operations/longexits/LongExitApiIntegrationTest.java`, `operations-local.spec.ts` e `long-exits-local.spec.ts`, incluindo a expiração pela rotina de 60 segundos e o prazo vencido antes dela. Verificação: a mesma da 3.1.

## 4. Limpeza, disciplina e comunicações

- [x] 4.1 Conferir os 7 requisitos de `cleaning-evaluation` contra `reports/CleaningReportsIntegrationTest.java`, os testes de `features/cleaning/` (`cleaning-local.pages.spec.ts`, `cleaning-local.utils.spec.ts`) e `cleaning-reports-local.spec.ts`. Verificação: cada cenário aponta o teste que o comprova ou fica registrado como lacuna.
- [x] 4.2 Conferir os 9 requisitos de `discipline` contra `discipline/DisciplineApiIntegrationTest.java`, `reports/CleaningReportsIntegrationTest.java` (ocorrência de limpeza abaixo de 6,00) e `communications-local.spec.ts`. Verificação: a mesma da 4.1.
- [x] 4.3 Conferir os 5 requisitos de `institutional-notices` contra `discipline/DisciplineApiIntegrationTest.java`, `features/communications/communications-local-api.service.spec.ts`, `features/communications/communications-local.shared.spec.ts`, `communications-local.spec.ts` e `journeys.spec.ts` ("abrir aviso não equivale a registrar ciência"). Verificação: a mesma da 4.1.

## 5. Auditoria, demonstração e ajuda

- [x] 5.1 Conferir os 7 requisitos de `audit-trail` contra `audit/AuditApiIntegrationTest.java`, `audit/AuditServiceIntegrationTest.java`, `audit/AuditMigrationIntegrationTest.java`, `audit/RequestCorrelationFilterTest.java` e os testes de conflito de versão dos cadastros (`management/rooms/RoomApiIntegrationTest.java`). Verificação: cada cenário aponta o teste que o comprova ou fica registrado como lacuna.
- [x] 5.2 Conferir os 4 requisitos de `demo-mode` contra `core/demo-session.service.spec.ts`, `app.routes.spec.ts`, `journeys.spec.ts`, `page-loading.spec.ts`, `infra/coolify/smoke.py` e `infra/production/smoke.sh` (`/demonstracao` com 404). Verificação: a mesma da 5.1.
- [x] 5.3 Conferir os 2 requisitos de `help-center` contra `features/portal/portal.pages.spec.ts` ("orienta a conta autenticada e limita os guias às tarefas do perfil") e `route-audit.spec.ts`. Verificação: a mesma da 5.1.

## 6. Validação da change

- [x] 6.1 Conferir que nenhum nome de capability coincide com `openspec/specs` nem com as changes ativas. Verificação: `npx @fission-ai/openspec@2.0.0 list --specs` e `ls openspec/changes/*/specs` não mostram nenhum dos 13 nomes fora desta change.
- [x] 6.2 Validar a change. Verificação: `npx @fission-ai/openspec@2.0.0 validate document-core-baseline --strict` termina sem erro.
- [x] 6.3 Registrar em design.md, "Divergências e lacunas", os cenários sem teste encontrados nos grupos 1 a 5, somados às lacunas já encontradas na revisão (expiração da sessão em 30 minutos e recuperação pela tela de uma conta de supervisor). Verificação: a lista cita requisito e cenário de cada lacuna, ou diz que não há lacuna. Feito em 13/11/2026: dos 162 cenários, 102 têm teste completo, 45 têm teste parcial e 15 não têm teste.

## Workflow follow-up

- Arquivar com `openspec archive document-core-baseline`, e então rodar `npx @fission-ai/openspec@2.0.0 validate --all --strict`.
- Cada divergência de design.md que o dono decidir corrigir vira uma change própria, com `MODIFIED` sobre os requisitos desta base.
