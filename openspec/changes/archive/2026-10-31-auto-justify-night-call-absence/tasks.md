## 1. Backend

- [x] 1.1 Criar a próxima migration livre, permitindo `sistema` em `actor_profile` só para `AUSENCIA_JUSTIFICADA` com versão da chamada 0; verificar em `OperationsMigrationIntegrationTest`.
- [x] 1.2 Marcar em `NightCallService.open` e ajustar `NightCallRepository.history`, mantendo a chamada na versão 0; verificar em `OperationsApiIntegrationTest` os casos da spec, com saída curta e saída longa reais.
- [x] 1.3 Ajustar testes existentes que afirmam marcação nula ou clique manual; verificar com os testes de `operations`.

## 2. Frontend

- [x] 2.1 Mostrar "Sistema", a saída por tipo com link, e o aviso, em `night-call-local.component.ts`; verificar em spec e `e2e/operations-local.spec.ts`.
- [x] 2.2 Replicar na demonstração; verificar em `operations-demo.service.spec.ts` e `night-call.component.spec.ts`.

## 3. Documentação

- [x] 3.1 Atualizar `AGENTS.md`, `docs/fase-3/README.md`, `docs/fase-7/MANUAL.md` e PRD AC20; verificar por leitura.
