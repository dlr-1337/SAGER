## Context

Motivação em proposal.md.

**O shell hoje** (`app.html`):
- o cabeçalho `.masthead` fica acima de `.workspace`;
- `.workspace` tem o menu `aside.sidebar` e a área de conteúdo.

**Rolagem:** quem rola é a janela. O requisito "Nova tela começa no topo" e o e2e `tab-scroll.spec.ts` contam com `window.scrollY`.

**Altura do cabeçalho:**
- no computador, vai até 100 px (logotipo de 204 px de largura, mais o espaçamento);
- no celular, até 800 px de largura, tem 72 px.

**Tela de acesso** (`AccessPage`): tem cabeçalho próprio (`.public-masthead`).

## Goals / Non-Goals

**Goals:**
- cabeçalho, "Menu" e "Sair" sempre à vista nas telas internas;
- a tela de acesso cabe sem rolar nos celulares e computadores comuns.

**Non-Goals:**
- mudar a ordem ou os itens do menu;
- impedir a rolagem quando a tela não comporta o conteúdo.

## Decisions

### D1. Cabeçalho e menu com `position: sticky`

O cabeçalho das telas internas fica com `position: sticky; top: 0` e altura fixa `--masthead-h` (100 px no computador, 72 px no celular).

No computador, o menu fica com:
- `position: sticky`;
- `top: var(--masthead-h)`;
- altura `calc(100dvh - var(--masthead-h))`.

A janela continua sendo quem rola.

*Rejeitada:* tirar a rolagem da janela e rolar só a área de conteúdo, com `overflow: auto`. Isso quebraria:
- a volta ao topo e a posição restaurada pelo Voltar do navegador (`tab-navigation`);
- `scrollIntoView` da paginação;
- os e2e que medem `window.scrollY`.

### D2. Só a lista do menu rola; "Sair" fica ao pé

No computador, a lista `nav` encolhe e rola sozinha (`overflow-y: auto`). Assim, "SAGER · Campus Urutaí" e o botão de sair ficam sempre à vista, mesmo em telas baixas. Uma sombra leve na borda que ainda tem itens mostra que a lista rola. Ela é feita só com CSS (fundo `local` sobre fundo `scroll`).

Na gaveta do celular, a gaveta inteira continua rolando, como hoje. Ela tem os controles da demonstração, e a lista não pode ficar espremida.

*Rejeitada:* rolar o menu inteiro. Em notebooks de 768 px de altura, "Sair" voltaria a ficar fora da tela.

### D3. Foco abaixo do cabeçalho

Nas telas internas, `html` recebe `scroll-padding-top` igual à altura do cabeçalho, por meio de `:has(.app-shell:not(.public-shell))`. Assim, o foco pelo teclado, o "Ir para o conteúdo" e `scrollIntoView` param abaixo do cabeçalho.

*Rejeitadas:*
- corrigir cada `scrollIntoView` no código. Isso deixaria o foco por Tab sem correção;
- uma folga extra além do cabeçalho. Uma aba logo abaixo do cabeçalho rolaria a página ao receber o foco, contra "Aba mantém a posição" (`tab-navigation`).

### D4. Tela de acesso compacta em telas estreitas ou baixas

A tela de acesso troca `min-height: 100vh` por `100dvh`. No celular, `100vh` conta a barra de endereço escondida e cria uma rolagem falsa.

Em largura até 760 px ou altura até 700 px, a tela fica compacta:
- espaçamentos e título menores;
- a frase de orientação em 1rem;
- sem a linha "Assistência Estudantil · Campus Urutaí", que repete a marca do cabeçalho.

Em altura até 800 px, o espaço acima e abaixo do formulário cai para 24 px.

Medido com o marcador de produção, a tela cabe sem rolar em:
- 360×640, 375×667 e 390×844 no celular;
- 1024×600, 1366×617 e 1280×720 no computador.

*Rejeitada:* `overflow: hidden` ou `position: fixed` no formulário. Em 320×568, com o teclado do celular aberto ou com zoom de 200%, parte do formulário ficaria inalcançável, contra a WCAG 1.4.10 (reflow).

## O que a instituição e o operador ainda decidem

Nada. A mudança é só de apresentação. Vale conferir em um celular real do campus se o login cabe com a barra do navegador visível.
