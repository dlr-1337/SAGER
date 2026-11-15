Comandos: frontend em `frontend/` com `npx ng test --watch=false --include <spec>`, `npm run build` e `SAGER_E2E_PORT=4327 CI=1 npx playwright test <arquivo>`.

## 1. Interface

- [x] 1.1 Em `features/portal/local-home.page.ts`, trocar o aviso por "Maiores de idade podem sair do IF até 23h e voltar a partir das 6h.". Verificar com `local-home.page.spec.ts`, que confere o texto novo para o maior de idade e a ausência dele para o menor.
- [x] 1.2 Em `e2e/operations-local.spec.ts`, conferir o texto novo na página de início do maior de idade. Verificar com `SAGER_E2E_PORT=4327 CI=1 npx playwright test e2e/operations-local.spec.ts`.

## 2. Verificação final

- [x] 2.1 Conferir que o texto antigo sumiu com `grep -rn "devem voltar até 5h" frontend/src frontend/e2e docs openspec/specs` e rodar `npx -y @fission-ai/openspec@2.0.0 validate --all --strict`.
