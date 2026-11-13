# Tasks

Os caminhos do frontend são relativos a `frontend/`, e os do backend, a `backend/`. Rode os comandos em cada pasta. Formate com `npx prettier --write <arquivo>` cada arquivo do frontend tocado. O modo demonstração (RF027) fica.

## 1. Nome da conta acompanha a edição do residente (item 11; D1)

- [x] 1.1 Em `auth/LocalAccountRepository.java` e `auth/LocalAccountProvisioningService.java`, acrescentar a troca do `display_name` da conta vinculada ao residente, sem encerrar sessões. Em `management/residents/ResidentService.update`, chamá-la quando o nome muda, antes da troca de matrícula. Verificar com `ResidentApiIntegrationTest`: em `unrelatedUpdatePreservesAssignedLoginAndSession`, a conta passa a ter o nome novo, o resto da conta não muda, `/auth/me` do residente continua 200 e devolve `nome` "Nome Editado", e a auditoria lista só `name`; em `createAndUpdateFormatResidentNameWhateverTheTypedCase`, a conta passa a "José Da Silva"; em `enrollmentChangeRollsBackCollisionAndOtherwisePreservesAccountAndRevokesSession`, o 409 deixa o nome antigo na conta e a edição aceita leva o nome novo. Rodar `./mvnw -B -ntp verify -Dtest=ResidentApiIntegrationTest -Dsurefire.failIfNoSpecifiedTests=false`.

## 2. 429 da recuperação com corpo padrão (item 13; D2)

- [x] 2.1 Em `auth/ResidentRecoveryController.java`, responder o limite com `ApiErrors.response(..., 429, "rate_limited", ...)` mais `Retry-After: 900`. Verificar em `ResidentApiIntegrationTest.recoveryWithoutGuardianDoesNotCreateNewRegistrationRequirementsAndIsThrottled` que o 429 tem `code` `rate_limited`, `message` não vazia, `requestId` igual ao cabeçalho `X-Request-Id`, `Retry-After` 900, `Cache-Control` com `no-store` e nenhum dado informado no corpo. Rodar o mesmo comando da 1.1.

## 3. Demonstração com o servidor sem resposta (item 14; D3)

- [ ] 3.1 Em `src/app/core/local-auth.service.ts`, separar a consulta de `/auth/me` em um método que devolve o principal, devolve `null` no 401 (apagando `sager.account`) e lança nas outras falhas; `refresh()` continua devolvendo `null` em qualquer falha. Gravar `sager.account` no fim do login e apagá-la na saída aceita, e expor se a conta pode estar aberta (principal em memória ou chave presente). Verificar com casos novos em `src/app/core/local-auth.service.spec.ts`: login grava e saída apaga a chave; 401 apaga a chave; falha de rede lança na consulta nova, mantém a chave e faz `refresh()` devolver `null`; sem armazenamento, nada quebra. Rodar `npm test -- --watch=false --include=src/app/core/local-auth.service.spec.ts`.
- [ ] 3.2 Em `src/app/features/portal/demo-entry.service.ts`, usar a consulta nova: conta devolvida pede a saída; 401 entra; outra falha recusa com a mensagem de tentar de novo só se a conta pode estar aberta. Verificar com o novo `src/app/features/portal/demo-entry.service.spec.ts`: rede falha sem conta conhecida entra sem pedir a saída; rede falha com a chave ou com principal em memória não entra e mostra o erro; 401 entra sem pedir a saída; conta devolvida pede a saída e entra; saída que falha não entra. Rodar `npm test -- --watch=false --include=src/app/features/portal/demo-entry.service.spec.ts`.
- [ ] 3.3 Em `e2e/local-auth.spec.ts`, um teste novo: entrar pelo formulário com a API simulada, abrir `/demonstracao` numa aba nova com `/auth/me` respondendo 503, escolher um perfil e ver o alerta, a URL parada e nenhuma chamada a `/auth/logout`; depois, com `/auth/me` respondendo 401, a demonstração começa. Conferir que `residents-local.spec.ts` e os outros testes de `local-auth.spec.ts` passam sem mudança. Rodar `SAGER_E2E_PORT=4326 CI=1 npx playwright test local-auth residents-local`.

## 4. Guias da ajuda na demonstração (item 15; D4)

- [ ] 4.1 Em `src/app/features/portal/portal.pages.ts` (HelpPage), o guia Comunicações leva o residente a `/avisos` e os outros perfis a `/comunicacoes/avisos`, nos dois modos. Verificar com um caso novo em `src/app/features/portal/portal.pages.spec.ts`: para cada perfil na demonstração, cada link de `.guide-grid` corresponde a uma rota de `app.routes.ts` cujos perfis incluem o perfil em uso, e o supervisor tem `/comunicacoes/avisos`. Rodar `npm test -- --watch=false --include=src/app/features/portal/portal.pages.spec.ts`.
- [ ] 4.2 Em `e2e/route-audit.spec.ts`, um teste novo: para cada perfil da demonstração, abrir `/ajuda`, seguir cada guia e conferir que a URL não é `/acesso-negado`. Rodar `SAGER_E2E_PORT=4326 CI=1 npx playwright test route-audit`.

## 5. Verificação final

- [ ] 5.1 Rodar `./mvnw -B -ntp verify` no backend, e `npm test -- --watch=false`, `npm run build` e `SAGER_E2E_PORT=4326 CI=1 npm run test:e2e` no frontend; tudo verde.
- [ ] 5.2 Rodar `npx -y @fission-ai/openspec@2.0.0 validate fix-baseline-divergences --strict` e conferir a implementação contra proposal.md, as specs e design.md.

## Workflow follow-up

- Arquivar a change depois da revisão do dono.
