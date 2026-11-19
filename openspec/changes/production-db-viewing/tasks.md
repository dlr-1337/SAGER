# Tasks

## 1. Passo a passo

- [ ] 1.1 Em `infra/coolify/README.md`, escrever a seção "Ver o banco" com o comando somente leitura e os exemplos (decisões D1 e D2). Verificar: o mesmo comando, num PostgreSQL 17.11 descartável com autenticação `scram-sha-256` e senha em `/run/secrets/db_owner_password`, lista as tabelas com `\dt`, faz `SELECT`, e o `INSERT` falha com "cannot execute INSERT in a read-only transaction".
- [x] 1.2 Em `docs/OPERACAO.md`, apontar para a seção. Verificar: o link abre `infra/coolify/README.md#ver-o-banco`.

## 2. Validação

- [ ] 2.1 Verificar: `npx -y @fission-ai/openspec@2.0.0 validate production-db-viewing --strict` passa e `git diff --stat` lista só os dois documentos e esta change.
