## 1. Documentação

- [x] 1.1 Atualizar `AGENTS.md` e `PRODUCT.md`: o SUAP foi dispensado em 20/11/2026, o Google segue adiado e a matrícula é digitada à mão. Verificação: `grep -n SUAP AGENTS.md PRODUCT.md` não mostra mais "deferred" nem "adiadas" para o SUAP.
- [x] 1.2 Em `docs/ARQUITETURA.md`, registrar a dispensa na decisão 1 e em D02, e pôr a recuperação de senha por e-mail entre as pendências institucionais. Verificação: leitura do diff.
- [x] 1.3 Validar a change. Verificação: `npx -y @fission-ai/openspec@2.0.0 validate suap-dispensed --strict`.
