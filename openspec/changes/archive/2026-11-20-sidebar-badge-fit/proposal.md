## Why

Na reunião de 20/11/2026, o print de `/notificacoes` em produção mostrou o problema no menu lateral do supervisor. Os itens com contador ("Saídas e retornos", "Notificações de ocorrência", "Chamada noturna") quebram o nome em duas ou três linhas e cobrem o item vizinho. Isso acontece de 801 a 1180 px de largura, numa janela baixa. Guilherme também pediu, na reunião, para "arrumar a responsividade" das notificações.

A causa: quando a lista não cabe na altura, cada linha encolhe para 48 px, e o nome de várias linhas passa por cima da linha seguinte. Isso contraria `simple-screens`, "Cabeçalho e menu sempre à vista": quando a lista não cabe, só ela rola.

## What Changes

- Cada item do menu lateral cresce com o próprio nome e não encolhe abaixo da altura do texto. Quando a lista não cabe na altura, ela rola.
- O nome ocupa o espaço entre o ícone e o contador e quebra em linhas mais juntas.
- De 801 a 1180 px, as margens dos itens ficam menores, para o nome caber ao lado do contador. A gaveta do celular, até 800 px, não muda.
- O requisito "Cabeçalho e menu sempre à vista" ganha o cenário "Menu com contadores numa janela baixa".

Fora do escopo:
- Mudar os nomes dos itens ou a ordem do menu.
- Mudar a gaveta do celular ou o cabeçalho.
- Mudar a regra de contagem: a contagem das notificações está em `notification-seen-evidence`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `simple-screens`: o requisito "Cabeçalho e menu sempre à vista" ganha o cenário "Menu com contadores numa janela baixa".

## Impact

- Frontend: `src/app/app.scss` (menu lateral).
- Testes: `e2e/pending-badges.spec.ts`, em 1000×560, 820×600 e 1180×620.
- API, banco e demonstração: sem mudança. A demonstração usa o mesmo menu e recebe a correção junto.
