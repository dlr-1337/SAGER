## Why

Cadastrar um supervisor hoje não dá acesso ao sistema. A conta é criada à parte, por um comando de operador em terminal, o que o gestor não consegue fazer. O dono do produto pediu a senha na própria criação.

Além disso, ele definiu que só o gestor gerencia supervisores, pois está acima deles. **Isso substitui uma decisão anterior dele próprio:** `docs/fase-0/DECISOES.md:41-48` e PRD D01 (30/09/2026) davam ao supervisor paridade total, inclusive sobre supervisores. A nova decisão, de 31/10/2026, vale só para esse recurso: a paridade continua nos demais cadastros. O motivo ficou mais forte com a senha no formulário: um supervisor poderia criar logins de supervisor.

## What Changes

- **BREAKING:** só o gestor lista, vê, cria e edita supervisores. Supervisor recebe 403.
- A criação de supervisor pede senha e confirmação e cria a conta na mesma transação, como no residente assistido.
- A matrícula ou SIAPE informada vira o login.
- O formulário explica de forma simples que a pessoa entra com a matrícula e a senha informadas.

**Fora do escopo:** redefinir senha de supervisor pela tela, migrar supervisores já cadastrados sem conta (seguem pelo comando do operador).

## Capabilities

### New Capabilities

- `supervisor-accounts`: criação da conta do supervisor junto do cadastro, e gestão de supervisores restrita ao gestor.

### Modified Capabilities

Nenhuma.

## Impact

- `SecurityConfiguration`, `SupervisorService`, `SupervisorController`, `OpenApiConfiguration`.
- `app.routes.ts`, `app.ts`, `supervisor-form`, `supervisors`, `supervisor-detail`, `supervisor-api.service`, `management.models`.
- `AGENTS.md`, PRD (D01, AC04), `DECISOES.md`, `PACOTE_AE_TI.md`, `PRODUCT.md`, `README.md`, `backend/README.md`. Registros históricos de QA não mudam.
- Sem migration.
