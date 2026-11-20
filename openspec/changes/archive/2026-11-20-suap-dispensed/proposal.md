## Why

Na reunião de 20/11/2026 (00:20), Cristiane, da Assistência Estudantil, disse que "não tem necessidade de integrar com SUAP". O sistema funciona sozinho, com contas próprias e cadastro manual. Até agora a documentação trata a integração com o SUAP como "adiada", à espera de autorização. Ela deixa de ser uma pendência.

## What Changes

- **`AGENTS.md`:**
  - "Google and SUAP integrations are deferred" passa a dizer que a integração com o SUAP foi dispensada em 20/11/2026 e que a do Google continua adiada;
  - "Resident enrollment is entered manually until an authorized SUAP integration exists" passa a dizer que a matrícula é digitada à mão.
- **`PRODUCT.md`:** a mesma correção na lista de restrições.
- **`docs/ARQUITETURA.md`:**
  - a decisão 1 (login próprio) registra a dispensa;
  - D02 deixa de dizer "SUAP adiado".
- **A recuperação de senha por e-mail** fica registrada como pendência institucional em `docs/ARQUITETURA.md`. Na reunião, Cristiane disse: "No máximo aí uma recuperação por e-mail para garantir mais segurança." Otávio lembrou que o aluno chega sem e-mail institucional.

Fora do escopo:
- Mudar o login, a recuperação de senha ou o cadastro.
- As faixas de formato da matrícula, que continuam como pendência própria em `docs/ARQUITETURA.md`.
- Editar a monografia.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

Nenhuma. A mudança é só de documentação (`skip_specs: true`).

## Impact

- Documentação: `AGENTS.md`, `PRODUCT.md` e `docs/ARQUITETURA.md`.
- Código, API, banco e testes: sem mudança.
