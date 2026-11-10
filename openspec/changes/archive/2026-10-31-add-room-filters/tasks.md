## 1. Backend

- [x] 1.1 Adicionar a chave `roomId` em `ShortExitRepository` e `LongExitRepository`, com a mesma subconsulta de alocação do alojamento; verificar em `OperationsApiIntegrationTest` e `LongExitApiIntegrationTest`, inclusive residente que mudou de quarto, e cobrir o filtro `accommodationId`, hoje sem teste.
- [x] 1.2 Adicionar `accommodationId` em `CleaningController` e `CleaningService`; verificar em teste de integração da limpeza, inclusive paginação por cursor.

## 2. Chamada noturna

- [x] 2.1 Criar filtros de casa ou bloco e quarto em `night-call-local.component.ts`, derivando opções dos registros da chamada; verificar com spec novo, inclusive limpeza ao trocar de alojamento e quarto lembrado inexistente.
- [x] 2.2 Garantir que resumo e fechamento ignorem o filtro; verificar no mesmo spec.
- [x] 2.3 Criar filtro de quarto dependente do bloco em `night-call.component.ts`; verificar com spec.

## 3. Outras telas

- [x] 3.1 Adicionar quarto dependente do alojamento em `exits-local.component.ts`, visível só ao supervisor; verificar em `exits-local.component.spec.ts`.
- [x] 3.2 Adicionar alojamento e quarto dependente em `cleaning-local.pages.ts`; verificar em spec e na jornada de limpeza.
- [x] 3.3 Corrigir a dependência de bloco na demonstração em `residents.component.ts`; verificar com spec.
- [x] 3.4 Cobrir o filtro da chamada em `e2e/operations-local.spec.ts`, com checagem de acessibilidade; verificar com `npm run test:e2e`.
