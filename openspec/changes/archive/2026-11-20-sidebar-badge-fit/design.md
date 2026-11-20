## Context

O menu lateral é uma grade com uma linha por item, `min-height` de 48 px e a lista rolando quando não cabe na altura (`fixed-navigation`, 16/11). Com os contadores (`pending-badges`, 19/11), o nome fica mais estreito e quebra em mais linhas. Quando a grade é mais alta que a janela, as linhas encolhem para 48 px e o texto vaza sobre o item seguinte.

## Goals / Non-Goals

**Goals:**
- Nenhum nome sai do próprio item nem cobre o vizinho, em qualquer altura de janela.
- O menu continua rolando sozinho quando não cabe.

**Non-Goals:**
- Encurtar os nomes dos itens.

## Decisions

1. **Linhas do tamanho do conteúdo.** A grade usa `grid-auto-rows: max-content` e `align-content: start`. Assim as linhas nunca encolhem abaixo do texto, e a sobra vai para a rolagem.
   - Alternativa rejeitada: cortar o nome com reticências. Esconderia parte do nome, e o item perderia o sentido para quem lê.
2. **Nome flexível ao lado do contador.** O nome ocupa o espaço entre o ícone e o contador (`flex: 1`, `min-width: 0`), com `line-height` de 1,3.
   - Alternativa rejeitada: pôr o contador embaixo do nome. Mudaria o padrão aprovado em `pending-badges`, que mostra o número ao lado do item.
3. **Margens menores só de 801 a 1180 px.** É a faixa em que o menu tem 226 px de largura. A gaveta do celular mantém as margens dela.
   - Alternativa rejeitada: aumentar a largura do menu. Tiraria espaço do conteúdo nas telas de notebook.

## Risks / Trade-offs

- Com mais linhas por item, o menu rola mais cedo em janelas baixas. É o comportamento já previsto em "Cabeçalho e menu sempre à vista".

## Pendências institucionais

Nenhuma. É uma correção de exibição.
