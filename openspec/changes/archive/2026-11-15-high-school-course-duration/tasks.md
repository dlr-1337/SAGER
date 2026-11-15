Comandos: frontend em `frontend/` com `npx ng test --watch=false --include <spec>`, `npm test -- --watch=false`, `npm run build` e `SAGER_E2E_PORT=4327 CI=1 npx playwright test <arquivo>`. O modo demonstração (RF027) continua: não remover os ramos `session.active()` dos arquivos tocados.

## 1. Interface

- [x] 1.1 Em `features/management/courses.page.ts`:
  - ao escolher "Ensino médio", gravar 3 na duração e esconder o campo;
  - ao trocar para "Superior", mostrar o campo vazio;
  - ao abrir a edição de curso médio salvo com 3 anos, esconder o campo;
  - com outra duração, mostrar o valor salvo.
  - Verificar com casos em `courses.page.spec.ts`:
    - curso médio novo salvo com `durationYears` 3 sem o campo na tela;
    - troca para superior com o campo vazio e obrigatório;
    - edição de curso médio de 3 anos sem o campo;
    - edição de curso médio de 4 anos com o campo e o 4.
  - A página é a mesma na demonstração e no acesso por conta, e a regra não depende do modo.
- [x] 1.2 Em `resident-form.component.ts`, aplicar a mesma regra ao "Novo curso". Verificar com casos em `resident-form.component.spec.ts`: curso médio criado com 3 anos sem o campo e superior com o campo obrigatório.
- [x] 1.3 Ajustar `e2e/enrollment-catalog-recovery.spec.ts` e `e2e/residents-local.spec.ts`, que deixam de digitar a duração do curso médio e conferem que o campo não aparece. Verificar com `SAGER_E2E_PORT=4327 CI=1 npx playwright test e2e/enrollment-catalog-recovery.spec.ts e2e/residents-local.spec.ts`.

## 2. Documentação e verificação final

- [x] 2.1 Em `docs/MANUAL.md`, no item de cursos do gestor, dizer que o ensino médio tem 3 anos e que no superior se informa a duração. Verificar com `grep -n "ensino médio" docs/MANUAL.md`.
- [x] 2.2 Rodar `npm test -- --watch=false`, `npm run build` e `npx -y @fission-ai/openspec@2.0.0 validate --all --strict`.
