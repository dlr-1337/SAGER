Comandos: frontend em `frontend/` com `npx ng test --watch=false --include <spec>`, `npx ng build` e `SAGER_E2E_PORT=4333 CI=1 npx playwright test <arquivo> --workers=1`.

## 1. Confirmação do rascunho

- [ ] 1.1 Em `NoticeFormLocalPage` (`notices-local.pages.ts`), deixar "Quem vai receber" com uma só linha: o grupo (D1) e a quantidade, sem nomes nem matrículas.

  Verificar com `notices-local.pages.spec.ts`:
  - "Todos os moradores" depois de desmarcar um: "Todos os moradores · 1 residente";
  - "Um alojamento": "Alojamento Um · 2 residentes";
  - "Um quarto": "Quarto U-101, Alojamento Um · 2 residentes";
  - nenhum nome nem matrícula no diálogo.

## 2. Diálogos do aviso salvo

- [ ] 2.1 Em `NoticeDetailLocalPage`, deixar "Quem vai receber" de "Revisar publicação", "Publicar correção" e "Retirar com justificativa" como "Lista salva no rascunho · N residentes" (D2). A página continua listando os nomes em "Quem recebe".

  Verificar com `notices-local.pages.spec.ts`: o diálogo de publicação e o de retirada mostram "Lista salva no rascunho · 2 residentes", sem nomes, e a página lista os dois nomes.

## 3. Jornadas no navegador

- [ ] 3.1 Em `e2e/communications-local.spec.ts`:
  - cada opção de "Quem recebe?" confere o grupo novo no diálogo, sem nomes;
  - "Revisar publicação", "Publicar correção" e "Retirar com justificativa" mostram "Lista salva no rascunho · 1 residente", sem o nome;
  - a página do aviso lista o nome em "Quem recebe".

  Verificar com `SAGER_E2E_PORT=4333 CI=1 npx playwright test e2e/communications-local.spec.ts --workers=1 -g "aviso|Quem recebe|receber|Escolher pessoas"`.

## 4. Documentação

- [ ] 4.1 Em `docs/MANUAL.md` (Supervisor, item Avisos), dizer que a confirmação mostra o grupo e a quantidade, e os nomes ficam na página do aviso, em **Quem recebe**. Verificar lendo o trecho.

## 5. Verificação final

- [ ] 5.1 Rodar `npx prettier --check` nos arquivos tocados, `npx ng build` e `npx -y @fission-ai/openspec@2.0.0 validate notice-recipient-summary --strict`.
