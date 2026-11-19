## Why

Na reunião de 19/11/2026, na tela de Conversas do supervisor:

- os cards da lista e o painel da conversa ficam pequenos, mesmo num monitor grande;
- não há como dar mais espaço à conversa aberta;
- dá para rolar a página para baixo mesmo com a área vazia, e o menu lateral parece "vir junto";
- alguém viu um "HTTP" que seria o identificador da conversa.

A causa da rolagem está na altura da tela. Ela foi fixada em `calc(100dvh - 92px)`, quando o cabeçalho tinha 92 px. O PR #34 (`fixed-navigation`) fixou o cabeçalho em 100 px, e o rodapé (cerca de 58 px) ficou abaixo da tela. A janela rola essa sobra de cerca de 66 px em qualquer altura de computador. No celular, com a conversa aberta, a sobra é o rodapé de duas linhas, cerca de 86 px.

A tela também segue o limite de largura dos formulários (`--content-wide`, 1280 px). Num monitor de 1920 px, a lista fica com 350 px, os balões com até 560 px e sobram cerca de 400 px vazios.

Regras afetadas:

- `whatsapp-conversations`: "Lista de conversas" e "Histórico da conversa" continuam como estão; esta change acrescenta dois requisitos;
- `simple-screens`: "Cabeçalho e menu sempre à vista" continua. A janela segue sendo quem rola quando a tela não cabe;
- `tab-navigation`: "Aba mantém a posição" e "Nova tela começa no topo" não mudam;
- `plain-language`: "Sem identificadores técnicos na tela". A tela já não mostra identificador; ver D7 em `design.md`.

## What Changes

- **Altura:**
  - no computador, a tela de Conversas ocupa a altura visível abaixo do cabeçalho fixo, sem o rodapé;
  - a janela e o menu lateral ficam parados, e só a lista e as mensagens rolam por dentro;
  - chegar ao fim da lista ou das mensagens não passa a rolar a janela;
  - no celular, a conversa aberta cabe na altura visível, sem o rodapé, e a lista segue a rolagem da página, como hoje;
  - em janela baixa demais ou com zoom, a janela volta a rolar.
- **Tamanho:**
  - a tela usa a largura toda da área de trabalho;
  - a lista ocupa cerca de um terço, entre 270 e 460 px;
  - cards e conversa ficam maiores: nome do contato e texto das mensagens em 18 px, avatar de 52 px, balões até 720 px.
- **Recolher a lista:**
  - no computador, com uma conversa aberta, o botão "Recolher conversas" no cabeçalho da conversa esconde a lista, e a conversa ocupa a largura toda;
  - o mesmo botão, então "Mostrar conversas", traz a lista de volta. Ele tem `aria-expanded` e `aria-controls`;
  - sem conversa aberta, a lista sempre aparece;
  - o navegador lembra a escolha, quando permite guardá-la;
  - no celular não há botão: lista e conversa continuam alternando.
- **"HTTP":** procurado na tela, nas mídias, nos links, nos títulos e nos rótulos para leitores de tela, sem achado. Nada muda; ver D7 em `design.md`.
- `docs/MANUAL.md`: o item de Conversas do supervisor cita "Recolher conversas" e "Mostrar conversas".

**Fora do escopo:**

- o envio pelo WhatsApp e o gateway;
- as outras telas e o cabeçalho e o menu do sistema;
- a demonstração: a tela de Conversas dela mostra só o aviso de modo local, sem lista (`whatsapp-conversations`, "Demonstração sem envio real"), e não muda;
- guardar a escolha de recolher no servidor.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `whatsapp-conversations`: novos requisitos "Conversas na altura e na largura da tela" e "Lista de conversas recolhível".

## Impact

- **Frontend:**
  - `features/communications/conversations-local.pages.ts`: botão de recolher e escolha guardada no navegador;
  - `conversations-page.scss`, `conversations-list.scss`, `conversation-thread.scss` e `conversation-composer.scss`: altura, largura e tamanhos;
  - testes: `conversations-page.spec.ts` (novo), `conversation-thread.component.spec.ts` e o e2e `conversations-local.spec.ts`.
- **Documentação:** `docs/MANUAL.md`.
- **Backend, API e banco:** sem mudança e sem migração.
