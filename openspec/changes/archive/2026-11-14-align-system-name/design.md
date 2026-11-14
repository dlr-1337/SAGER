# Design

## Decisões

### 1. Usar o nome da monografia em todo texto que exibe o nome por extenso

Toda ocorrência de "Sistema de Apoio à Gestão da Residência Estudantil" em `frontend/src` e no script da prévia de link vira "Sistema de Apoio à Gestão de Residentes". No cabeçalho, a quebra de linha passa para "Sistema de Apoio à / Gestão de Residentes", que deixa as duas linhas com tamanho parecido e mais curtas que antes. A prévia de link usa a mesma quebra com `<br>`, porque a quebra automática deixaria "de" sozinho no fim da primeira linha.

- **Alternativa rejeitada:** manter a quebra depois de "Gestão" ("Sistema de Apoio à Gestão / de Residentes"). A segunda linha ficaria curta demais e o bloco, desequilibrado.
- **Alternativa rejeitada:** trocar também o título da aba, o `og:title` e o rodapé ("Residência Estudantil"). Esses textos nomeiam o setor, não o sistema, e a tarefa pede só o nome por extenso.

### 2. Regerar a prévia de link com o script existente

`frontend/scripts/generate-brand-assets.mjs` já monta a `og-image.png` (1200x630, fundo `#0c4837`, símbolo à esquerda, Open Sans 800/600) a partir de `public/favicon.svg`. Basta trocar o subtítulo e rodar o script. Ele também regrava os outros ícones; só a `og-image.png` entra no commit, e os ícones sem texto voltam ao que estava versionado.

- **Alternativa rejeitada:** editar o PNG em um editor de imagem. Perderia a reprodutibilidade e poderia trocar fonte ou cores.

## Riscos

- Redes sociais guardam a prévia em cache. A imagem nova pode demorar a aparecer em links já compartilhados.

## Pendências do dono

- Decidir se o título da aba, o `og:title` e o rodapé de produção devem trocar "Residência Estudantil" por outro texto.
- Fazer o deploy manual da `main` no Coolify depois de mesclar.
