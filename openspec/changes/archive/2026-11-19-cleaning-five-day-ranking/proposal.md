## Why

Na reunião de 19/11/2026, o dono decidiu que o ranking da limpeza se atualiza todo dia pela média das avaliações dos últimos 5 dias. Assim o ranking mostra a condição mais recente: o quarto limpo sobe, e o quarto mal avaliado desce. Hoje o ranking abre no mês, e a semana, o mês e o semestre são os únicos períodos (requisito "Ranking por período" de `cleaning-evaluation`, RF012).

Na mesma reunião, o dono pediu duas mudanças na tela:

- O ranking não precisa mostrar as avaliações. Hoje cada linha diz "1 avaliação" ou "N avaliações". A linha passa a mostrar só a posição e a nota.
- O residente viu informação repetida: a mesma participação aparece na seção "Seu quarto neste período" e de novo na lista (requisito "Ranking paginado com o próprio quarto no topo" de `list-browsing`).

Cada quarto continua com uma única nota por dia, como define "Uma avaliação por quarto e data". No mesmo dia, a nota muda pela correção.

A regra do `AGENTS.md` de que os três perfis leem o ranking e o residente vê só as notas dos próprios quartos continua valendo.

## What Changes

- Novo período "Últimos 5 dias" (`LAST_5_DAYS`): a data de referência e os 4 dias civis anteriores, em America/Sao_Paulo.
  - Ele passa a ser o padrão: `GET /api/v1/limpeza/ranking` sem `period` e a tela de ranking abrem nos últimos 5 dias de hoje.
  - A média é a das notas diárias dos dias com avaliação. Dia sem avaliação não conta como zero.
  - Quarto sem avaliação na janela fica sem média e sem posição, e empate repete a posição, como nos outros períodos.
- Semana, mês e semestre continuam como opções, porque a monografia os cita (RF012).
- A devolutiva da avaliação (`periodMean`, `position`, `rankingReference`, `from` e `to`) passa a usar os últimos 5 dias terminados na data da avaliação, no lugar da semana. O link "Ver ranking deste período" abre esse mesmo período.
- O ranking deixa de trazer a quantidade de avaliações: `assessmentCount` sai da resposta da API e a linha da tela mostra só o quarto, a posição e a nota. Quarto sem avaliação mostra "Sem posição" e "Sem nota".
- O residente vê o próprio quarto uma vez só: no topo, em "Seu quarto neste período", com posição e nota. A lista abaixo, "Outros quartos", traz só os demais, 25 por página, sem repetir essa linha e sem a frase "Nota privada do quarto" em cada linha.
- O ranking da demonstração ganha "Últimos 5 dias" como primeira opção e padrão, e mostra a nota ilustrativa ao lado da posição (para o residente, só a do próprio quarto).
- A Ajuda, `docs/MANUAL.md`, `README.md`, `docs/ARQUITETURA.md` e o `AGENTS.md` passam a citar o período de 5 dias.

**Fora do escopo:**

- Os indicadores mensais (requisito "Indicadores mensais"), que não mudam.
- O relatório de limpeza, que continua pelo período escolhido no próprio relatório.
- A regra "Uma avaliação por quarto e data" e a correção da avaliação.
- Quem vê as notas: o requisito "Quem vê as notas" continua igual.
- O texto da monografia, que o dono ajusta à parte.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `cleaning-evaluation`: requisito "Ranking por período", com os últimos 5 dias como padrão e sem a quantidade de avaliações.
- `list-browsing`: requisito "Ranking paginado com o próprio quarto no topo", sem repetir o quarto do residente na lista.
- `page-loading`: requisito "Feedback da limpeza igual ao ranking", que passa da semana aos últimos 5 dias.
- `demo-fidelity`: requisito "Regra da limpeza e do ranking descrita na demonstração", com o período de 5 dias.

## Impact

- **Backend:**
  - `CleaningService`: período `LAST_5_DAYS`, devolutiva pelos últimos 5 dias e ranking sem `assessmentCount`;
  - `CleaningModels.RankRow`, sem `assessmentCount`;
  - `CleaningController`: `period` padrão `LAST_5_DAYS`;
  - `ReportingOpenApiConfiguration`: descrição do ranking.
- **Testes de backend:** `CleaningReportsIntegrationTest`.
- **Frontend:**
  - `cleaning-local.models.ts`, `cleaning-local.utils.ts` e `cleaning-local-api.service.ts`: período novo e linha sem `assessmentCount`;
  - `cleaning-local.pages.ts`: `RankingLocalPage` e a devolutiva no detalhe;
  - `operations/ranking.component.ts` e `operations.scss`: ranking da demonstração;
  - `portal/portal.pages.ts`: resposta da Ajuda sobre o cálculo do ranking;
  - specs `cleaning-local-api.service.spec.ts`, `cleaning-local.pages.spec.ts` e `ranking.component.spec.ts`, e os e2e `cleaning-reports-local.spec.ts` e `journeys.spec.ts`.
- **API:** `GET /api/v1/limpeza/ranking` aceita `period=LAST_5_DAYS` e o usa quando `period` falta (antes, `MONTH`). `assessmentCount` sai das linhas. `rankingReference` da devolutiva passa a valer `LAST_5_DAYS`. A tela e a API mudam juntas na mesma versão.
- **Banco:** sem migração. A unicidade por quarto e data (V18) já garante uma nota por dia, e o índice `sager_cleaning_period_idx` atende a janela.
- **Monografia:** RF012 cita semana, mês e semestre. O período de 5 dias é acréscimo e precisa entrar no texto (ver design.md).
