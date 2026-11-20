## 1. Servidor

- [x] 1.1 Fazer a busca paginada aceitar parâmetros na ordem e ordenar as listas de saídas curtas e longas com as atrasadas primeiro. Verificação: teste de ordem em `OperationsApiIntegrationTest` e `LongExitApiIntegrationTest`.
- [x] 1.2 Aceitar `status=ATRASADA` e fazer `status=EM_ANDAMENTO` trazer só as saídas dentro do prazo, pelo relógio da aplicação, nas saídas curtas e longas. Atualizar a descrição do filtro na API. Verificação: testes de filtro nas duas suítes.

## 2. Telas

- [x] 2.1 Calcular a situação mostrada ("Atrasada" para a saída em andamento depois do retorno previsto, pelo `now` do servidor) e usá-la na lista, no filtro, na legenda e no cabeçalho dos detalhes curto e longo. Verificação: specs Vitest dos utilitários, da lista e dos detalhes.
- [x] 2.2 Pôr "Atrasada" em vermelho, com o significado na legenda. Verificação: `status-tones.spec.ts`.
- [x] 2.3 Mostrar no detalhe da saída curta em andamento "Volta até <hora>." ou "A volta era até <hora>." ao supervisor, e "Volte até <hora>" ou "Volta atrasada" ao residente. Verificação: spec do detalhe e e2e de `operations-local.spec.ts`.
- [x] 2.4 Formatar com prettier e rodar os testes focados. Verificação: `npm test -- --watch=false` e `openspec validate overdue-exit-badge --strict`.
