Comandos: frontend em `frontend/` com `npx ng test --watch=false --include <spec>`, `npx ng build` e `SAGER_E2E_PORT=4336 CI=1 npx playwright test <arquivo> --workers=1`.

## 1. Altura da tela

- [ ] 1.1 Em `features/communications/conversations-page.scss`:
  - dar a `.work-area` a altura visível abaixo do cabeçalho quando a tela de Conversas está aberta, com mínimo de 500 px, e esconder o rodapé;
  - passar conteúdo, página e caixa da lista e da conversa a uma coluna flexível com `min-height: 0`;
  - no celular, fazer o mesmo só com a conversa aberta, com mínimo de 420 px; só com a lista, manter a rolagem da página e o rodapé.

  Verificar com o e2e `conversations-local.spec.ts`, em "tela na altura da janela":
  - em 1280×720 e 1920×1080, a página não passa da altura da janela, com a lista de 12 conversas e com a conversa aberta;
  - sem conversas, a área vazia também não rola a janela;
  - em 390×844, a conversa aberta cabe na janela e o campo de mensagem fica à vista.
- [ ] 1.2 Em `conversations-list.scss` e `conversation-thread.scss`, `overscroll-behavior: contain` na lista e nas mensagens. Verificar no mesmo e2e: depois de rolar com a roda do mouse até o fim da lista e das mensagens, e de volta ao começo, `scrollY` continua 0 e o menu lateral não se move. Conferir também, no navegador, a sobra de rolagem medida antes da mudança, para registrar a causa.
- [ ] 1.3 Conferir que o cabeçalho e o menu fixos e as abas não mudaram com `SAGER_E2E_PORT=4336 CI=1 npx playwright test e2e/fixed-navigation.spec.ts e2e/tab-scroll.spec.ts --workers=1`.

## 2. Tamanho da lista e da conversa

- [ ] 2.1 Em `conversations-page.scss`, `conversations-list.scss`, `conversation-thread.scss` e `conversation-composer.scss`:
  - largura toda da área de trabalho, com a lista em 32%, entre 270 e 460 px;
  - nome do contato e texto das mensagens em 18 px, título da conversa em 22 px, avatar de 52 px, cards com 88 px e balões até 720 px;
  - no celular, texto das mensagens em 17 px e cards mais justos até 480 px.

  Verificar com o e2e "no monitor grande, lista e conversa usam a largura e letras maiores", em 1920×1080, e com as capturas de tela do e2e em 1280×720, 1920×1080 e 390×844. Os testes existentes de alvos de 44 px, rolagem lateral em 320 px e acessibilidade (axe) continuam passando.

## 3. Recolher a lista

- [ ] 3.1 Em `conversations-local.pages.ts`:
  - botão "Recolher conversas" e "Mostrar conversas" no cabeçalho da conversa, com `aria-expanded` e `aria-controls="conv-list"`, só no computador;
  - lista escondida com a conversa aberta; sem conversa aberta, a lista volta;
  - escolha guardada em `localStorage`, com `try/catch`.

  Verificar com `npx ng test --watch=false --include src/app/features/communications/conversations-page.spec.ts --include src/app/features/communications/conversation-thread.component.spec.ts`:
  - recolhe e mostra, com `aria-expanded` e a escolha guardada e apagada;
  - escolha lembrada, e a lista de volta sem conversa aberta;
  - sem armazenamento, recolher funciona só na visita.
- [ ] 3.2 Verificar com o e2e "recolher a lista dá a largura toda à conversa e o navegador lembra", em 1366×860: largura da conversa, foco no botão, axe, alvos de 44 px, recarga e volta à lista; e com "no celular, a conversa cabe na janela e não oferece recolher".

## 4. Identificador na tela

- [x] 4.1 Procurar o "HTTP" da reunião na tela de Conversas: texto visível, mídias, links, `title`, `aria-label` e texto alternativo, com os dados de exemplo do e2e. Sem achado, registrar em `design.md` (D7) e não mudar a tela. Verificado com `grep -n "chatId\|\.id\b" frontend/src/app/features/communications/conversations-local.pages.ts`: `chatId` não aparece, e os identificadores só entram em `routerLink`, `href`, `src`, `id` de elemento, `track` e chamadas à API, nunca em texto, `title`, `aria-label` ou `alt`.

## 5. Documentação e verificação final

- [x] 5.1 Em `docs/MANUAL.md`, no item de Conversas do supervisor, citar "Recolher conversas" e "Mostrar conversas". Verificar com `grep -n "Recolher conversas" docs/MANUAL.md`.
- [ ] 5.2 Rodar `npx prettier --check` nos arquivos tocados, `npx ng build`, os e2e `conversations-local.spec.ts`, `fixed-navigation.spec.ts` e `tab-scroll.spec.ts`, e `npx -y @fission-ai/openspec@2.0.0 validate conversations-layout --strict`.
