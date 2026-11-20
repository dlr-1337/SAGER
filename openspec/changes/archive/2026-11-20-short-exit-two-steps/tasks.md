## 1. Servidor

- [x] 1.1 Em `ShortExitService`, recusar com 400 a saída curta `SCHEDULED` ou com `requestedDepartureAt`, aceitar `departureMode` ausente como `NOW` e recusar `APPROVE` em `/decisao`. Verificação: novos testes em `OperationsApiIntegrationTest`.
- [x] 1.2 Fazer `/partida` aceitar a saída aguardando análise e gravar, num único evento `DEPARTURE`, a decisão no instante da partida, a partida e o retorno previsto em 3 horas. Conferir elegibilidade, prazo, horário anterior ao pedido e `physical_exit_conflict`. Verificação: testes do registro agora, com horário anterior, depois dos 18 anos e com outra saída em andamento.
- [x] 1.3 Atualizar as capacidades do detalhe: `canDepart` vale para o pedido aguardando análise dentro do prazo, e `canDecide` só rejeita. Atualizar a descrição da API em `OperationsOpenApiConfiguration`. Verificação: teste do detalhe e `ApiFoundationIntegrationTest`.
- [x] 1.4 Ajustar os auxiliares e os testes das outras áreas que aprovavam a saída curta antes da partida. Verificação: `.\mvnw.cmd -B -ntp verify` passa.

## 2. Telas do residente

- [x] 2.1 Tirar de `exit-form-local.component.ts` a pergunta "Quando você quer sair?" e o campo de data e hora, enviar sempre `NOW` e reescrever a orientação. Verificação: `exit-form-local.component.spec.ts`.
- [x] 2.2 Criar a janela "Pedido enviado", aberta no detalhe com `?enviado=1`, e limpar `enviado` e `saved` do endereço depois de mostrar. Verificação: spec do detalhe e e2e do pedido.
- [x] 2.3 No detalhe do residente, trocar "O que você pode fazer" pelo título do passo ("Apresente-se ao supervisor", "Volte até <hora>" ou "Próximo passo"). Verificação: spec do detalhe.

## 3. Telas do supervisor

- [x] 3.1 Deixar o detalhe em dois passos: "Saída", com "Registrar saída" e "Rejeitar", e "Volta", com "Registrar volta". A mensagem é "Saída registrada. Volta até <hora>.". Verificação: spec do detalhe e e2e de `operations-local.spec.ts`.
- [x] 3.2 Mostrar "Pedido em" no lugar de "Saída pedida" no pedido para agora, na lista e no detalhe, e manter "Saída marcada para" e "Saída agendada" nos pedidos antigos. Verificação: specs da lista e do detalhe.
- [x] 3.3 Trocar a legenda de "Aprovada" e a mensagem de sobreposição da saída curta. Verificação: specs de `status-tones` e da API local.

## 4. Ajuda e documentação

- [x] 4.1 Reescrever "Quando a saída começa?" e os guias da saída curta na Ajuda. Verificação: `portal.pages.spec.ts`.
- [x] 4.2 Atualizar `docs/MANUAL.md`, `docs/ARQUITETURA.md` (D05) e `AGENTS.md`. Verificação: leitura e `openspec validate short-exit-two-steps --strict`.
- [x] 4.3 Formatar com prettier e rodar os testes focados do frontend e o e2e de saídas. Verificação: `npm test -- --watch=false` e `npx playwright test e2e/operations-local.spec.ts`.
