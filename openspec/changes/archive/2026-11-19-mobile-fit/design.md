## Context

Motivação em proposal.md.

**Como as telas são montadas hoje:**
- os cadastros (residentes, responsáveis, quartos, cursos, supervisores) usam o mesmo componente na conta e na demonstração;
- chamada, saídas, notificações, comunicações, limpeza e relatórios têm uma versão da conta (`*-local`) e outra da demonstração. As telas citadas na reunião são da conta;
- os botões de decisão usam três grupos diferentes: `.comm-actions` (flex que quebra, cada botão com a largura do texto e, abaixo de 540 px, largura toda), `.op-actions` (flex) e botões soltos fora de grupo;
- a declaração dos diálogos é um `label` `inline-flex` com o texto solto ao lado da caixa de marcar (`.op-check` e `.comm-check`), sem a caixa dos avisos acima dela;
- o conteúdo do diálogo do Material tem `max-height: 65vh`. No celular, `vh` conta a barra do navegador escondida, e o diálogo pode passar da altura visível;
- os campos de data têm `width: 100%`. No Safari do iPhone, o campo nativo mantém uma largura mínima própria e passa do card.

**O que a varredura achou no Chromium** (360×740 e 320×568): nenhuma rolagem horizontal nem elemento fora do container nas rotas da demonstração e nas telas da conta cobertas. Os problemas reais são de padrão (botões e confirmação), de altura do diálogo com a barra do navegador e do campo de data no Safari.

## Goals / Non-Goals

**Goals:**
- um teste permanente que falha quando algo vaza no celular;
- botões de decisão do supervisor com a mesma ordem, o mesmo tamanho e a mesma quebra de linha;
- declaração dos diálogos no padrão das caixas acima dela;
- diálogos e campos de data que cabem na tela do celular.

**Non-Goals:**
- mudar textos, regras, permissões, a ordem dos passos ou quem vê cada botão;
- redesenhar telas ou trocar o diálogo por tela cheia no celular.

## Decisions

### D1. Varredura genérica, em e2e permanente

`e2e/mobile-fit.ts` mede, em cada tela:
- a rolagem horizontal da página (`scrollWidth > innerWidth`);
- caixas com rolagem horizontal própria que não sejam tabela;
- elementos visíveis cuja borda direita, ou o texto que não quebra, passa da tela ou do container (`main`, painel, cartão, diálogo, filtro, `details`, formulário, campo, item de lista);
- o diálogo aberto fora da altura da tela.

A medida ignora o que está dentro de uma caixa com rolagem própria, como as tabelas. A lista de problemas sai inteira na falha. `mobile-fit.spec.ts` varre a demonstração com os três perfis, e as telas da conta entram nos e2e que já interceptam a API delas. Um teste com HTML próprio confere que a medida acha campo, texto e caixa que vazam.

*Rejeitadas:*
- comparar capturas pixel a pixel: quebra com qualquer mudança de dado ou fonte e não diz o que vazou;
- conferir só `scrollWidth`: não acha campo que passa do card sem passar da tela.

### D2. Grupo `.decision-actions` em `styles.scss`

O grupo é uma grade `repeat(auto-fill, minmax(min(100%, 220px), 1fr))`:
- no celular e nos painéis estreitos, um botão por linha, na largura toda;
- no computador, colunas iguais, alinhadas à esquerda; um botão sozinho não estica até a borda.

A ação principal (`.btn`) vem primeiro, e as outras seguem a ordem do fluxo (na notificação: registrar visualização, iniciar análise, arquivar). Links de consulta saem do grupo.

*Rejeitadas:*
- flex que quebra com a largura de cada texto: é o que deixa os botões desiguais hoje;
- ação principal por último, como nos diálogos: no celular, o primeiro botão é o que se vê primeiro, e nas saídas "Aprovar" já vem antes de "Rejeitar";
- CSS próprio em cada tela: o padrão voltaria a divergir.

### D3. Saídas continuam com "Aprovar" e "Rejeitar" lado a lado

O detalhe da saída curta e da longa já usa uma grade de duas colunas, com "Aprovar" primeiro e "Rejeitar" em vermelho ao lado, como pede "Rejeitar e recusar em vermelho". A varredura cobre essas telas, que não vazam.

*Rejeitada:* trocar pelo grupo de uma coluna no celular. O requisito vigente diz "ao lado", e a dupla cabe em 320 px.

### D4. Declaração em `.confirm-check`

O `label` vira `flex` com a largura toda, até `75ch`, com o recuo (16 × 18 px), o raio (12 px) e a margem dos avisos do diálogo, borda de campo e fundo branco. Marcada, ganha o verde-claro das opções de relatório. O texto fica num `span` com `min-width: 0` e `overflow-wrap: anywhere`.

*Rejeitada:* só trocar `inline-flex` por `flex`. Resolve a quebra, mas a declaração continua fora do padrão das caixas acima dela, como apontou a reunião.

### D5. Diálogo na altura visível

O painel do diálogo ganha `max-height: calc(100dvh - 32px)`, e o conteúdo perde o limite de `65vh`: ele rola por dentro, e os botões ficam sempre à vista. No celular (até 540 px), os botões do diálogo usam `flex: 1 1 140px`: dividem a largura quando cabem e ficam um por linha quando não cabem.

*Rejeitada:* diálogo em tela cheia no celular. Mudaria o desenho aprovado e esconderia a tela de trás, que dá contexto à decisão.

### D6. Campos de data e hora

`display: block`, `min-width: 0` e `max-width: 100%` em todos. Só no Safari do iPhone (`@supports (-webkit-touch-callout: none)`), sem a aparência nativa e com o valor à esquerda, que é o que respeita a largura do card.

*Rejeitada:* trocar por campo de texto com máscara: perderia o seletor de data do celular.

## Riscos

- O Playwright desta máquina só tem o Chromium. A correção do Safari (D6) e a altura com a barra do navegador (D5, simulada com 360×600) não foram vistas num aparelho real.

## O que a instituição e o operador ainda decidem

Nada. A mudança é só de apresentação. Vale conferir num celular Android e num iPhone do campus a chamada noturna fora do horário, a notificação de ocorrência e os filtros de data.
