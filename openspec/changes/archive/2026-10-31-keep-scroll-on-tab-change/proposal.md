## Why

Na tela do residente, clicar em Dados, Responsáveis ou Histórico faz a página pular para cima. A causa, medida no navegador, é a altura: o painel novo é mais curto, e o navegador corta a rolagem. `scrollY` foi de 108 para 8. O roteador não participa, pois não há navegação.

## What Changes

- Painéis das abas ganham altura mínima, para a rolagem não ser cortada.
- O mesmo vale para as outras telas com abas que trocam de conteúdo: avisos, comunicações próprias e saídas.
- Ao trocar de rota, a página volta ao topo (defeito medido: o detalhe abria já rolado).
- O botão Voltar do navegador continua restaurando a posição da lista. Medido: sem a exceção, a volta caía de 420 para 0, perda que a mudança causaria.
- Em comunicações próprias, o aviso de carregamento fica abaixo das abas: acima delas, ele as empurrava ao carregar.

**Fora do escopo:** `scrollPositionRestoration`, que faria `?tipo=longa` subir ao topo.

## Capabilities

### New Capabilities

- `tab-navigation`: posição da página ao trocar de aba e de rota.

### Modified Capabilities

Nenhuma.

## Impact

`resident-detail.component.ts`, `notices.page.ts`, `own-communications-local.pages.ts`, `exits-local.component.ts`, `management.scss`, `app.ts`.
