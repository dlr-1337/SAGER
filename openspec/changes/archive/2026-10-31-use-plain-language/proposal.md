## Why

Quem usa o SAGER são residentes adolescentes e servidores sem prática com computador. A auditoria percorreu 53 rotas e encontrou textos de teste em produção ("somente dados fictícios", "backend local"), identificadores técnicos na tela (UUID, SHA-256, "versão N"), jargão ("alocação", "recorte", "revisão", "evidência") e erros que não dizem o que fazer.

## What Changes

- Textos de ambiente de teste somem do modo real.
- Identificadores técnicos saem das telas. Eles continuam na auditoria e nos dados.
- Jargão vira linguagem comum, seguindo o glossário em `design.md`.
- Erros passam a dizer o que fazer.
- Residente vê os dois botões de saída o tempo todo, sem filtros que não fazem sentido para ele.
- Texto secundário sobe para 16 px e caixas de seleção para 28 px.

**Regra:** só texto e apresentação. Nenhuma regra de permissão ou de negócio muda. Um cabeçalho "Acesso restrito" continua restringindo.

**Fora do escopo:** redesenho, teste com pessoas reais (recomendado à instituição).

## Capabilities

### New Capabilities

- `plain-language`: linguagem e legibilidade para quem tem pouca prática com computador.

### Modified Capabilities

Nenhuma.

## Impact

Textos em toda `frontend/src/app/features` e `styles.scss`. Muitos testes procuram textos antigos e precisam ser atualizados junto.
