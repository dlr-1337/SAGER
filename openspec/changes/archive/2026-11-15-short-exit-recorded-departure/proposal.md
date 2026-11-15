## Why

Na reunião de 14/11/2026, o dono e o coautor decidiram que o residente não escolhe mais a hora de voltar da saída curta: ele tem até 3 horas contadas da saída registrada pelo supervisor. Hoje o formulário pede "Que horas você volta?" e o prazo conta da partida pedida (requisito "Tipo de saída pela duração" de `exit-requests` e "Sugestão do retorno enquanto não editado" de `exit-scheduling`). A reunião também pediu que a saída curta que passa do prazo sem volta confirmada gere ocorrência e notificação para o supervisor. Hoje isso só acontece quando o retorno é confirmado com atraso (requisito "Ocorrências automáticas" de `discipline`, RN11).

Afeta as regras do `AGENTS.md` de que as saídas usam o relógio do servidor e de que só o supervisor registra a movimentação física. As duas continuam valendo: o prazo nasce do horário da partida que o supervisor registra.

## What Changes

- O pedido e a edição de saída curta deixam de receber o retorno previsto. O servidor recusa com 400 o pedido que ainda traga o campo. Até a partida ser registrada, ele grava como retorno previsto a partida pedida mais 3 horas, e esse horário vale como prazo do pedido aprovado sem partida.
- Ao registrar a partida da saída curta, pelo botão de saída, na aprovação de quem sai agora ou com horário retroativo, o servidor fixa o retorno previsto em 3 horas depois da partida registrada. A mudança fica no histórico.
- Migração V34: a restrição de duração da saída curta passa a medir as 3 horas a partir da partida registrada, quando houver.
- A partida registrada não é recusada por sobreposição. A outra saída do residente continua sem partida até o retorno confirmado, porque já vale `physical_exit_conflict`.
- A rotina que roda a cada 60 segundos passa a criar uma ocorrência de atraso no retorno e uma notificação pendente para a saída curta em andamento que passou do retorno previsto sem volta confirmada, com auditoria de sistema. Quando o supervisor confirma a volta, a mesma ocorrência guarda o retorno, sem nova notificação e sem exigir revisão. Volta retroativa dentro do prazo invalida a ocorrência e pede revisão, como já define "Origem corrigida exige revisão".
- Formulário "Pedir saída curta" no acesso por conta: sai o campo "Que horas você volta?" e a duração. A tela diz que a saída curta dura até 3 horas a partir da hora em que o supervisor registra a saída. A lista e o detalhe mostram a volta como "até 3 h depois da saída" enquanto a partida não foi registrada, e o horário fixado depois dela.
- A notificação de uma saída em andamento mostra a situação "Em andamento" na origem.
- Ajuda, `docs/MANUAL.md`, `docs/ARQUITETURA.md` e `AGENTS.md` passam a descrever o prazo de 3 horas a partir da saída registrada.

**Fora do escopo:**

- A saída longa, que continua com o retorno escolhido pelo residente e sem ocorrência antes da volta confirmada.
- As telas próprias da demonstração (RF027), que ficam como estão (`simple-screens`).
- Os indicadores mensais da limpeza e dos relatórios, que continuam contando só retornos confirmados com atraso.
- Advertência automática, que continua proibida (RN11).
- O texto da monografia, que o dono ajusta à parte.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `exit-requests`:
  - requisitos alterados "Tipo de saída pela duração" e "Sem sobreposição de saídas";
  - requisito novo "Prazo da saída curta a partir da partida registrada".
- `exit-scheduling`:
  - requisitos da sugestão, preservação e limites do retorno passam a valer para a saída longa;
  - requisito novo "Saída curta sem horário de volta".
- `discipline`: requisito alterado "Ocorrências automáticas", com a saída curta em andamento fora do prazo.
- `plain-language`: cenário do pedido de saída curta em "Palavras do dia a dia".

## Impact

- **Backend:**
  - `ShortExitController` e `ShortExitService`: pedido sem retorno, retorno fixado na partida;
  - `ShortExitExpiryService` e `ShortExitExpiryScheduler`: varredura da saída vencida;
  - `DisciplineEvidenceService`: enquadramento da saída em andamento vencida e auditoria de sistema;
  - `OperationsOpenApiConfiguration`;
  - migração `V34__short_exit_recorded_departure.sql`.
- **Testes de backend:** `OperationsApiIntegrationTest`, `OperationsMigrationIntegrationTest`, `DisciplineApiIntegrationTest` e os testes que criam saídas curtas (`LongExitApiIntegrationTest`, `CleaningReportsIntegrationTest`, `ApiFoundationIntegrationTest`).
- **Frontend:**
  - `exit-form-local.component.ts`;
  - `exit-detail-local.component.ts`;
  - `exits-local.component.ts`;
  - `operations-local.models.ts`;
  - `operations-local-api.service.ts`;
  - `operations-local.utils.ts`, onde `shortExitFormError` sai;
  - `communications-local.utils.ts`;
  - a Ajuda em `portal.pages.ts`;
  - specs e e2e `operations-local.spec.ts`.
- **API:** `expectedReturnAt` sai do corpo aceito por `POST` e `PUT /api/v1/saidas-curtas`. A resposta continua trazendo o campo. Página aberta com a versão anterior recebe 400 até ser recarregada.
- **Banco:** V34 troca a restrição `sager_short_exit_duration_valid`. Os registros existentes continuam válidos, porque a partida física nunca é anterior à partida pedida.
- **Monografia:** RN01 e RN11 descrevem o retorno escolhido no pedido e a ocorrência só na volta confirmada. O texto precisa de ajuste (ver design.md).
