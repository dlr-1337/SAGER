## Why

Hoje, pela change `auto-departure-on-approval` (PR #32), aprovar uma saída curta ou longa cuja partida pedida já chegou também registra a partida, no mesmo ato e em nome do supervisor. O prazo de 3 horas da saída curta começa a contar nessa hora, mesmo que o residente não esteja diante do supervisor.

Na reunião de 19/11/2026, o dono decidiu que a contagem do tempo de ausência só começa quando o supervisor registra a partida presencialmente, ao ver o residente. O motivo: alguém pode pegar o celular do residente e pedir uma saída sem ele saber. Com a partida registrada na aprovação, o horário não bate com a saída real, a rotina abre ocorrência de atraso e o residente pode levar uma advertência injusta.

O residente continua escolhendo quando quer sair, "agora" ou agendado. O supervisor continua sendo quem registra a saída e a volta (RN06, RF014, UC17).

## What Changes

- A aprovação, na saída curta e na longa, nunca registra a partida. A saída fica "aprovada", com o histórico só da decisão.
- Quando a partida pedida já chegou, o detalhe mostra "Registrar saída" ao supervisor logo depois da aprovação, com a frase "Registre a saída quando o residente se apresentar.". Ele registra a saída num ato separado. Antes da hora pedida, o detalhe continua mostrando "Saída marcada para <data e hora>".
- O diálogo de aprovação diz numa frase que aprovar não registra a saída e que ela é registrada quando o residente se apresentar. O botão volta a ser "Confirmar aprovação", e a mensagem, "Aprovação registrada.".
- O passo "Saída" do detalhe passa a valer para toda saída aprovada, e não só para a agendada.
- O residente com saída aprovada cuja hora chegou lê no detalhe que deve se apresentar ao supervisor para ele registrar a saída.
- Outra saída física aberta do residente não recusa mais a aprovação. O registro da partida continua recusado com 409 `physical_exit_conflict` até a volta da outra saída.
- Demonstração (RF027): aprovar deixa a saída "Aprovada". O supervisor registra a saída com "Registrar saída" a partir da hora pedida.
- Ajuda ("Quando a saída começa?" e o guia da saída longa), `docs/MANUAL.md`, `docs/ARQUITETURA.md` (D05 e D06) e `AGENTS.md`.

Continua como está:
- o prazo de 3 horas da saída curta conta da partida registrada;
- antes da partida, o prazo é a partida pedida mais 3 horas, e a aprovada sem partida expira;
- a partida retroativa, com justificativa;
- o conflito `physical_exit_conflict` no registro da partida;
- a confirmação da volta pelo supervisor.

Requisitos e regras afetados:
- `exit-requests`: "Decisão do supervisor", "Partida física" e "Prazo da saída curta a partir da partida registrada". Os cenários que esperavam partida na aprovação mudam: "Aprovação de saída curta para sair agora", "Partida na aprovação da saída longa", "Aprovação imediata com outra saída em andamento" e "Aprovação de quem sai agora".
- `night-call-justification`: "Justificativa automática na abertura" deixa de citar a partida registrada na aprovação.
- `help-center`: cenário "Quando a saída começa" de "Ajuda sem login".
- `simple-screens`: "Saída longa com só o próximo passo" e "Saída curta com só a ação do momento", com o passo "Saída" em toda saída aprovada.
- AGENTS.md, "Current Domain Decisions": o trecho "approving an exit whose requested departure has arrived (a request to leave now) records the departure in the same act, ..." e a frase do prazo de 3 horas.

Fora do escopo:
- O horário fixo da chamada noturna.
- O formulário do residente: o pedido continua "agora" ou agendado, sem campo novo.
- Migração de banco e rotina nova.
- Uma ação "não saiu": o pedido aprovado em que o residente não aparece expira no prazo, ou o supervisor o cancela.
- Editar a monografia.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `exit-requests`: a aprovação só decide; a partida é sempre um registro próprio do supervisor, e o conflito físico deixa de recusar a aprovação.
- `night-call-justification`: a justificativa automática pede a partida registrada pelo supervisor, sem menção à aprovação.
- `help-center`: a pergunta "Quando a saída começa?" explica que a saída começa no registro presencial.
- `simple-screens`: o passo "Saída" aparece em toda saída aprovada, com "Registrar saída" a partir da hora pedida.

## Impact

- Backend: `operations/shortexits/ShortExitService.java` e `operations/longexits/LongExitService.java` (`decide`). A rota de partida, `canDepart`, as rotinas de expiração e a chamada noturna não mudam.
- API: sem campo novo. `POST .../decisao` com `APPROVE` devolve sempre `APROVADA`, com a versão avançada em 1, e não responde mais 409 `physical_exit_conflict`. `POST .../partida` não muda.
- Frontend:
  - `features/operations/exit-detail-local.component.ts` e `long-exit-detail.component.ts`;
  - `features/operations/review-dialog-local.component.ts` (nota do diálogo);
  - `features/operations/operations-local.utils.ts` (sai `approvalMessage`);
  - `features/operations/operations-demo.service.ts` e `exit-detail.component.ts` (demonstração);
  - `features/portal/portal.pages.ts` (Ajuda).
- Testes: `OperationsApiIntegrationTest`, `LongExitApiIntegrationTest`, `IntegrationFlowIntegrationTest`, `DisciplineApiIntegrationTest` e `CleaningReportsIntegrationTest`; specs Vitest dos detalhes, da demonstração e da Ajuda; `e2e/operations-local.spec.ts` e `e2e/long-exits-local.spec.ts`.
- Documentação: AGENTS.md, docs/MANUAL.md (Supervisor item 2 e Residente item 4) e docs/ARQUITETURA.md (D05, D06).
- Dados: nenhuma migração. As saídas que começaram na aprovação continuam válidas, com o mesmo estado e histórico de uma partida registrada.
- Monografia: RN06, RF014, UC17 e a pós-condição do UC07 ("aprovada" ou "rejeitada") voltam a valer sem ressalva.
