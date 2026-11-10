## 1. Backend

- [x] 1.1 Restringir `/api/v1/supervisores/**` a `GESTOR` em `SecurityConfiguration`; verificar 403 em GET, POST e PUT em `SupervisorApiIntegrationTest`.
- [x] 1.2 Criar conta e vínculo em `SupervisorService.create`, com e-mail nulo na conta; verificar rollback, conflito, senha divergente, login após criar, e mensagens sem "password".
- [x] 1.3 Atualizar `OpenApiConfiguration`; verificar em `ApiFoundationIntegrationTest`.

## 2. Frontend

- [x] 2.1 Restringir rotas e menu ao gestor; verificar em `supervisors.component.spec.ts`, `route-audit.spec.ts` e `target-audit.spec.ts`.
- [x] 2.2 Adicionar senha e confirmação ao criar, reaproveitando o campo de `simplify-password-rules`, e trocar o rótulo para "Matrícula ou SIAPE (usada para entrar)"; verificar com spec do formulário e `e2e/supervisors-local.spec.ts`.
- [x] 2.3 Remover textos que dizem que o cadastro não cria acesso; verificar por busca.
- [x] 2.4 Ajustar a demonstração, sem guardar senha; verificar em `management-pagination-demo.spec.ts`.

## 3. Documentação

- [x] 3.1 Registrar a nova decisão datada, que substitui D01 só para supervisores, em `AGENTS.md`, PRD, `DECISOES.md`, `PACOTE_AE_TI.md`, `PRODUCT.md`, `README.md` e `backend/README.md`; verificar por busca.
