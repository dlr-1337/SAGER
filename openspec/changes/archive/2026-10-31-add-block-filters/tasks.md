## 1. Backend

- [x] 1.1 Adicionar `unitId` em saídas curtas e longas e em residentes; verificar em testes de integração, inclusive total paginado.
- [x] 1.2 Adicionar `unitId` em limpeza; verificar em teste com cursor.
- [x] 1.3 Adicionar `unitId` em relatórios com `@JsonInclude(NON_NULL)`; verificar exportando snapshot gravado sem a chave.

## 2. Frontend

- [x] 2.1 Criar helper em `housing.models.ts` para opções de bloco e quarto em cascata; verificar com spec.
- [x] 2.2 Aplicar em `exits-local`, `cleaning-local.pages` e `residents.component`; verificar em specs.
- [x] 2.3 Aplicar em `cleaning-form-local.page`, no cliente; verificar com spec.
- [x] 2.4 Aplicar em `reports-local`, sobre o fluxo novo; verificar em `e2e/cleaning-reports-local.spec.ts`.
