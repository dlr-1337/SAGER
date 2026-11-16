Comandos: frontend em `frontend/` com `npx ng test --watch=false --include <spec>`, `npm run build` e `SAGER_E2E_PORT=4327 CI=1 npx playwright test <arquivo>`.

## 1. Telas internas

- [x] 1.1 Em `src/app/app.scss`:
  - deixar o cabeçalho do shell com `position: sticky` e altura `--masthead-h` (100 px; 72 px até 800 px);
  - deixar o menu lateral com `position: sticky` abaixo do cabeçalho, com a altura da janela e só a lista rolando;
  - manter a gaveta do celular rolando inteira;
  - dar `scroll-padding-top` às telas internas.

  Verificar com `e2e/fixed-navigation.spec.ts`:
  - em 1280×720, depois de rolar o ranking até o fim, o cabeçalho, "Sair" e o botão de sair do menu ficam à vista;
  - em 390×700, "Menu" fica à vista e abre a gaveta;
  - o foco num item do topo para abaixo do cabeçalho.
- [x] 1.2 Em `e2e/tab-scroll.spec.ts`, rolar até as abas descontando o cabeçalho fixo. Verificar com `SAGER_E2E_PORT=4327 CI=1 npx playwright test e2e/tab-scroll.spec.ts`.

## 2. Tela de acesso

- [x] 2.1 Em `features/portal/portal.pages.ts`:
  - trocar `100vh` por `100dvh`;
  - compactar a tela em largura até 760 px ou altura até 700 px;
  - reduzir o espaço vertical em altura até 800 px.

  Verificar com `e2e/fixed-navigation.spec.ts`, com o marcador de produção:
  - sem rolagem em 360×640 e 1366×617;
  - com rolagem e "Entrar" alcançável em 320×568.

## 3. Verificação final

- [x] 3.1 Rodar `npx ng test --watch=false --include src/app/features/portal/portal.pages.spec.ts --include src/app/app.spec.ts`, `npm run build`, os e2e de acessibilidade e jornadas e `npx -y @fission-ai/openspec@2.0.0 validate --all --strict`.
