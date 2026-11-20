## Why

O PR #35 (reunião de 19/11/2026) está em produção. Uma revisão só de leitura achou 6 defeitos confirmados, 1 médio e 5 baixos. Nenhum grava dado errado, mas todos contrariam uma spec ou a regra do `AGENTS.md`:

1. **Conversas** (`whatsapp-conversations`, "Conversas na altura e na largura da tela"): quando uma conversa não lida fica fora da vista da lista, o texto só para leitores de tela ("não lida(s)") escapa da caixa que rola. A página passa a rolar além do rodapé e mostra espaço vazio. A tela da conversa aberta já tem essa correção.
2. **Registrar saída** (`exit-requests`, "Partida física"): no horário anterior, o diálogo só confere a partida pedida. Um horário entre a partida pedida e a aprovação passa no diálogo, que fecha. O servidor recusa com 400, e o supervisor precisa digitar a justificativa de novo.
3. **Demonstração** (`demo-fidelity`): na lista de saídas, a saída aprovada que espera "Registrar saída" aparece em "Concluídas" e some de "Pendentes". O contador do menu da demonstração a conta como pendente.
4. **Relatórios** (`report-generation`, "Arquivo legível"): sem avaliação de limpeza no período, a tela mostra "Sem avaliação", mas o PDF e a planilha mostram "Não informado".
5. **Celular de 320 px** (`simple-screens`, "Nada vaza no celular"): na demonstração, o número de pendências no botão "Menu" empurra "SAGER" para baixo da etiqueta "Demonstração".
6. **"Ver o banco"** (`infra/coolify/README.md`): o comando usa `$SAGER_CHECKOUT`, definido só em outra seção. Quem chega pelo link direto e cola o bloco recebe um erro.

## What Changes

- **Conversas:** a lista que rola passa a conter os textos só para leitores de tela, como a conversa aberta. O e2e "tela na altura da janela" ganha uma conversa não lida fora da vista.
- **Registrar saída:** na curta e na longa, o diálogo exige que o horário anterior seja depois da partida pedida e da aprovação. O erro aparece no diálogo, antes de enviar, com o texto "A partida não pode ser anterior à saída solicitada nem à aprovação.", e o diálogo fica aberto, com a justificativa digitada.
- **Demonstração:** o filtro "Pendentes" da lista de saídas inclui a saída aprovada, e "Concluídas" deixa de incluí-la.
- **Relatórios:** o PDF e a planilha mostram "Sem avaliação" quando a nota média de limpeza não tem avaliação.
- **Cabeçalho no celular:** de 320 px para cima, "SAGER", a etiqueta do ambiente e o botão "Menu" com o número ficam lado a lado, sem um cobrir o outro. O botão continua com o nome "Menu" ("Contador acessível", `pending-badges`).
- **README:** o bloco "Ver o banco" define `SAGER_CHECKOUT` antes de usar.

**Fora do escopo:**
- os itens que a revisão listou como já conhecidos: o painel de cima da chamada que não some, o quarto com identificação diferente entre telas, a saída em andamento sem prazo vencido, a falta de contador de limpeza e de advertências do supervisor, o residente ausente sem aviso e a paginação só no rodapé do relatório;
- mudar regras, permissões, a API ou o banco;
- os relatórios já gerados: o texto novo só vale para os arquivos gerados depois, e o código de conferência não muda.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `whatsapp-conversations`: o requisito "Conversas na altura e na largura da tela" ganha o cenário "Conversa não lida fora da vista".
- `exit-requests`: o requisito "Partida física" ganha o cenário "Horário anterior à aprovação".
- `demo-fidelity`: novo requisito "Saída aprovada entre as pendentes na demonstração".
- `report-generation`: o requisito "Arquivo legível" ganha o cenário "Limpeza sem avaliação".
- `simple-screens`: o requisito "Nada vaza no celular" ganha o cenário "Cabeçalho com pendências".

## Impact

- **Frontend:**
  - `features/communications/conversations-list.scss`;
  - `features/operations/exit-detail-local.component.ts`, `long-exit-detail.component.ts`, `review-dialog-local.component.ts`, `operations-local.utils.ts`, `operations-demo.service.ts` e `exits.component.ts` (demonstração);
  - `app.html` e `app.scss`;
  - testes: `operations-local.utils.spec.ts`, `review-dialog-local.component.spec.ts`, `operations-demo.service.spec.ts` e os e2e `conversations-local.spec.ts` e `mobile-fit.spec.ts`.
- **Backend:** `reports/ReportExportWorker.java` e o teste `CleaningReportsIntegrationTest.java`. Sem mudança de API.
- **Banco:** sem migração.
- **Infraestrutura:** `infra/coolify/README.md`.
