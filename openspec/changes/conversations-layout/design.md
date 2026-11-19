## Context

Motivação em proposal.md.

**O shell** (`app.html` e `app.scss`, desde o PR #34):

- o cabeçalho `.masthead` fica parado no topo, com altura `--masthead-h` (100 px no computador, 72 px até 800 px);
- `.workspace` tem o menu lateral, parado logo abaixo do cabeçalho, e `.work-area`, com o conteúdo (`.app-main`) e o rodapé `.app-footer`;
- quem rola é a janela.

**A tela de Conversas** (`ConversationsPage`):

- tem a lista e a conversa lado a lado no computador, e uma de cada vez até 800 px;
- a altura era `max(560px, calc(100dvh - 92px))`, escrita quando o cabeçalho tinha 92 px, sem contar o rodapé;
- a largura seguia `.page`, limitada a `--content-wide` (1280 px).

**Pela leitura do CSS:** a tela fica 8 px maior que a janela (cabeçalho de 100 px, não 92), e o rodapé (cerca de 58 px) vem depois. A roda do mouse rola essa sobra mesmo com a área vazia, e, no fim da lista ou das mensagens, a rolagem passa para a página. Com o cabeçalho parado, ver a página subir sob ele dá a impressão de que o menu "vem junto".

**Pela medição no e2e:** com uma conversa que tem arquivo, a página ainda ficava cerca de 800 px mais alta que a janela no celular. O texto "Baixar", só para leitores de tela (`.sr-only`, posição absoluta), escapava da lista de mensagens, que rola por dentro mas não era referência de posição. Cada balão fora da vista esticava a página para baixo da conversa.

## Goals / Non-Goals

**Goals:**

- na tela de Conversas, a página rola só até o rodapé, com ou sem conversa aberta;
- lista e conversa maiores e mais legíveis, sobretudo em monitor grande;
- a conversa pode ocupar a largura toda.

**Non-Goals:**

- mudar o cabeçalho, o menu ou o rodapé das outras telas;
- mudar o envio, a atualização automática ou o gateway.

## Decisions

### D1. O conteúdo com a altura da janela, só na tela de Conversas

Com a tela de Conversas aberta, o conteúdo (`.app-main`) recebe `height: max(500px, calc(100dvh - var(--masthead-h)))`. Conteúdo, página e lista passam a uma coluna flexível com `min-height: 0`, e a caixa da lista e da conversa (`.conv-shell`) fica com o espaço que sobra, com no mínimo 280 px. A regra usa `:has(.conv-page)` e fica nos estilos da própria tela. As outras telas não mudam, e `fixed-navigation.spec.ts` e `tab-scroll.spec.ts` seguem valendo.

A janela continua sendo quem rola: abaixo de 600 px de altura, ou com zoom, a página rola o que faltar e nada fica inalcançável. Em 600 px, com o aviso de WhatsApp desconectado e a atualização pausada ao mesmo tempo, a página pode rolar alguns pixels a mais.

No celular, a mesma regra vale só com a conversa aberta, com mínimo de 420 px. Só com a lista, a página segue rolando como hoje.

_Rejeitadas:_

- corrigir o número para 100 px. A tela ficaria certa, mas o número voltaria a errar na próxima mudança do cabeçalho;
- `overflow: hidden` em `html` ou `body`. Trancaria a rolagem em janela baixa e com zoom (WCAG 1.4.10) e mudaria o shell de todas as telas, contra "Cabeçalho e menu sempre à vista" (`simple-screens`).

### D2. Rodapé logo abaixo da tela, como num aplicativo de conversa

O rodapé continua na tela de Conversas, logo abaixo da dobra. Rolar a página mostra o rodapé e para nele, sem espaço vazio depois. O menu lateral fica parado enquanto isso. Decisão do dono em 19/11/2026: o rodapé pode ficar abaixo da dobra, desde que alcançável.

_Rejeitadas:_

- esconder o rodapé nessa tela. O dono pediu que ele continue alcançável;
- manter o rodapé à vista dentro da altura. Tiraria cerca de 58 px da conversa: em 1280 por 720 px, pela conta do CSS, o histórico cairia de cerca de 200 px para cerca de 140 px.

### D3. A roda do mouse não passa da lista para a janela

A lista e as mensagens recebem `overscroll-behavior: contain`. No fim de uma delas, continuar rolando não move a página até o rodapé.

A lista de mensagens também recebe `position: relative`. Assim, os textos só para leitores de tela dos balões ficam presos a ela e rolam com as mensagens, sem esticar a página.

_Rejeitadas:_

- tratar a roda do mouse em código (`wheel` com `preventDefault`). Bloquearia a rolagem do teclado e do toque e exigiria cuidar de cada caso;
- mudar `.sr-only` em `styles.scss`. Valeria para todas as telas, e o problema só aparece dentro de uma área que rola por dentro.

### D4. Largura toda e letras maiores

A tela de Conversas deixa de seguir o limite de 1280 px:

- a caixa usa a largura da área de trabalho;
- a lista fica com 32% dela, entre 270 e 460 px;
- os balões vão até 80% da conversa, com no máximo 720 px, para a linha não ficar longa demais;
- nome do contato e texto das mensagens em 18 px (17 px no celular), título da conversa em 22 px, avatar de 52 px e cards com 88 px de altura mínima;
- a dica, a hora e o remetente continuam em 16 px (`plain-language`, "Legibilidade").

_Rejeitadas:_

- só aumentar as letras, com o limite de 1280 px. Em 1920 px sobrariam cerca de 400 px vazios, e a lista continuaria estreita;
- pedir zoom do navegador. É escolha de cada computador e aumenta também o menu e o cabeçalho.

### D5. Botão de recolher no cabeçalho da conversa

O botão fica à esquerda do nome do contato, no lugar em que o celular mostra "Voltar à lista", e só aparece no computador com uma conversa aberta:

- o rótulo é "Recolher conversas" ou "Mostrar conversas", com ícone de seta;
- `aria-expanded` diz se a lista está aberta, e `aria-controls` aponta a lista;
- recolhida, a lista sai da tela, da ordem do Tab e do leitor de tela (`display: none`), e a conversa fica com a largura toda;
- sem conversa aberta, a lista volta, para a tela nunca ficar vazia. A escolha continua valendo para a próxima conversa aberta.

O padrão de rótulo que muda com `aria-expanded` é o mesmo de "Nova conversa" e "Fechar", na mesma tela.

_Rejeitadas:_

- uma faixa estreita com só o ícone no lugar da lista. A conversa não ficaria com a largura toda, e o botão perderia o texto;
- o botão no cabeçalho da página, ao lado de "Conexão do WhatsApp". Ficaria longe da lista, do outro lado da tela.

### D6. A escolha fica no navegador

A escolha fica em `localStorage`, na chave `sager.conversas.lista-recolhida`, com `try/catch` na leitura e na gravação. Sem armazenamento (janela privada, dados do site bloqueados), recolher funciona e vale só até sair da tela.

_Rejeitada:_ guardar a preferência no servidor, por usuário. Exigiria API e migração para uma conveniência, e cada computador da residência tem uma tela de tamanho diferente.

### D7. O "HTTP" da reunião

A frase da reunião foi "E esse HTTP aqui? (...) É o ID da conversa", sem captura de tela. A procura na tela de Conversas, com os dados de exemplo do e2e, não achou identificador nem endereço visível:

- a lista mostra o nome do responsável, o telefone formatado ou "Número não identificado";
- os balões mostram o texto recebido, o nome do arquivo, o tamanho e "Abrir saída";
- títulos, rótulos para leitores de tela e textos alternativos usam nomes, nunca o identificador da conversa nem o endereço do WhatsApp (`@c.us`, `@lid`).

O único lugar com "http" e o identificador da conversa é o endereço da conversa (`/conversas/<identificador>`). Ele aparece na barra de endereços do navegador e na prévia de link que o Chrome mostra no canto de baixo ao passar o mouse sobre um card ou sobre "Abrir saída". Esse é o comportamento do navegador, não texto da tela. Nada muda.

_Rejeitada:_ trocar os cards por botões sem endereço. Perderia abrir a conversa em outra aba e o padrão de links das outras listas, e o endereço continuaria na barra do navegador.

## O que a instituição e o operador ainda decidem

- Vale conferir em um monitor da residência se 18 px e a lista de cerca de um terço ficaram confortáveis.
- Se o "HTTP" visto na reunião era outra coisa, uma captura de tela da próxima vez permite corrigir (D7).
