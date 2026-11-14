## Why

Hoje aprovar um pedido para sair agora só o deixa "aprovado": o supervisor volta ao detalhe, clica em "Registrar saída" e passa por um segundo diálogo. São dois cliques para um ato só, e o esquecimento custa caro: sem partida registrada, a chamada noturna não justifica quem já saiu e a saída expira como aprovada sem partida. O dono pediu, em 14/11/2026, um sistema simples para servidores com pouca prática e para quem tem TDAH.

A decisão final do dono (14/11/2026) foi escolhida para ficar de acordo com a monografia: quem registra a partida continua sendo o supervisor (RN06, "Somente o supervisor registra a partida e o retorno"; RF014; UC17; tabela de permissões do cap. 4). A diferença é que, no pedido para sair agora, a aprovação do supervisor já registra a partida, em nome dele.

## What Changes

- Aprovar uma saída curta ou longa cuja partida pedida já chegou (pedido para sair agora) registra, no mesmo ato e em nome do supervisor que aprovou, a partida física no instante da aprovação. A saída passa a "em andamento". O diálogo de aprovação diz isso numa frase: "Aprovar e registrar a saída agora". O histórico mostra a decisão e a partida, as duas com o supervisor como autor.
- Se o residente ainda estiver fora com outra saída, a aprovação imediata é recusada com 409 `physical_exit_conflict`, o pedido continua aguardando análise e a tela diz para confirmar a volta da outra saída primeiro.
- Saída agendada: pela regra "Prazo vencido antes da rotina", ela é sempre aprovada antes da partida pedida. Continua "aprovada" e mostra "Saída marcada para <data e hora>". O botão "Registrar saída" do supervisor só aparece quando a hora pedida chega; antes disso, ele ainda pode cancelar. Nenhuma rotina do sistema registra partida.
- Expiração sem mudança: a aprovada sem partida expira quando o retorno previsto passa.
- Chamada noturna: RN10 não muda. Com a partida registrada na aprovação, quem saiu com pedido para sair agora aprovado entra justificado na abertura. Uma saída longa em andamento justifica todas as chamadas abertas antes do retorno previsto (20 dias, 20 chamadas), sem notificação de ausência. A aprovada sem partida continua pendente.
- Textos: diálogo e mensagem da aprovação, saída agendada no detalhe, mensagem do conflito físico, ajuda ("Quando a saída começa?") e demonstração.

Requisitos e regras afetados:
- `exit-requests`: "Decisão do supervisor" e "Partida física". "Edição e cancelamento", "Expiração automática" e "Prazo vencido antes da rotina" continuam como estão.
- `night-call-justification`: "Justificativa automática na abertura". O texto passa a citar o retorno previsto não vencido, que é o "intervalo válido" de RN10 e que o servidor já confere.
- `help-center`: "Ajuda sem login" (nova pergunta frequente).
- AGENTS.md, "Current Domain Decisions": "only a supervisor records physical movement" continua valendo. Acrescenta-se que aprovar uma saída imediata registra a partida no mesmo ato.
- docs/ARQUITETURA.md: D05 (início da saída) e D06 (expiração).
- Monografia: RN06, RF014, UC17 e a tabela de permissões (cap4.tex:77) continuam valendo. A pós-condição do UC07 (cap4.tex:351, situação "aprovada" ou "rejeitada") fica incompleta no pedido para sair agora, que termina "em andamento"; o design sugere frases opcionais para o UC07 e para o diagrama de sequência da decisão.

Fora do escopo:
- Rotina do sistema que registre partida, partida retroativa de aprovadas antigas e partida como ato do sistema.
- Mudar RN10, a revalidação das justificativas no fechamento ou a escolha entre duas saídas válidas.
- Desistência depois da aprovação imediata: se o residente não sair, o supervisor confirma a volta (pendência no design).
- Mudar a rota `POST .../partida`, o campo `canDepart` ou o prazo dos pedidos pendentes.
- Migração de banco.
- Editar a monografia.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `exit-requests`: aprovar o pedido para sair agora registra a partida em nome do supervisor, e o conflito físico recusa essa aprovação; a saída agendada mostra o horário marcado e só oferece "Registrar saída" a partir dele.
- `night-call-justification`: o requisito cita o retorno previsto não vencido e ganha o cenário da saída longa de vários dias.
- `help-center`: as perguntas frequentes explicam quando a saída começa.

## Impact

- Backend: `operations/shortexits/ShortExitService.java` e `operations/longexits/LongExitService.java` (`decide`), com a mesma conferência de saída física aberta que `depart` já usa. Sem mudança em `ExitOccupancyLookup`, nas rotinas de expiração, na chamada noturna ou na rota de partida.
- API: sem campo novo. `POST .../decisao` com `APPROVE` de um pedido cuja partida já chegou devolve a saída `EM_ANDAMENTO`, com a versão avançada em 2, e pode responder 409 `physical_exit_conflict`. `POST .../partida` não muda.
- Frontend: `features/operations/exit-detail-local.component.ts`, `features/operations/long-exit-detail.component.ts`, `features/operations/operations-local-api.service.ts` (mensagem do conflito físico), `features/operations/operations-demo.service.ts`, `features/operations/exit-detail.component.ts` (texto da demonstração) e `features/portal/portal.pages.ts` (ajuda).
- Testes: `OperationsApiIntegrationTest`, `LongExitApiIntegrationTest`, `DisciplineApiIntegrationTest` e `CleaningReportsIntegrationTest`; specs Vitest da mensagem de erro, da demonstração e da ajuda; `e2e/operations-local.spec.ts` e `e2e/long-exits-local.spec.ts`.
- Documentação: AGENTS.md, docs/ARQUITETURA.md (D05, D06), docs/MANUAL.md (Supervisor item 2 e Residente item 4) e a página Ajuda.
- Dados: nenhuma migração. As saídas já aprovadas continuam aprovadas e seguem com "Registrar saída", como hoje.
- Outras changes ativas: `simpler-screens` já segue esta decisão (passo "Saída" só na agendada, quando a hora chega) e é aplicada depois desta; `auto-refresh-pages` faz o "Registrar saída" da agendada aparecer sem recarregar a página.
