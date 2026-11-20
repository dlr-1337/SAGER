## Why

Na reunião de 20/11/2026, uma saída curta do dia 19 continuava aparecendo como "Em andamento", embora o prazo de volta tivesse passado. Isso aparecia para o supervisor e para o residente. Trechos da transcrição:

- Guilherme (00:07): "ao invés de aparecer em andamento, … atrasado, sabe? O selo aí tem que mudar."
- Cristiane (00:46): "tem que aparecer alguma coisa aí que tá atrasado, né? Senão fica muito estranho."
- O resumo da reunião pede: "Garantir que o sistema notifique de forma adequada a situação de atraso" e corrigir as "falhas de exibição no histórico decorrentes de registros anteriores ainda em aberto". A saída do dia 19 só foi achada no fim da lista "Saídas e retornos" (01:12).

Continua como está, decidido na reunião (00:10 e 00:41): o sistema não marca atraso nem cria advertência sozinho. A saída curta vencida já abre uma notificação de ocorrência para o supervisor (`discipline`).

## What Changes

- **"Atrasada" no lugar de "Em andamento":** a saída curta ou longa em andamento cujo retorno previsto já passou, pelo relógio do servidor, aparece assim, com a cor de perigo. Vale para:
  - a lista;
  - o cabeçalho do detalhe;
  - a legenda;
  - o supervisor e o residente.
- **A situação gravada continua "Em andamento"**, até o supervisor registrar a volta. Depois disso, ela passa a "Retorno confirmado com atraso", como hoje.
- **Atrasadas no topo:** na lista de saídas, curtas ou longas, as atrasadas aparecem primeiro, e o resto segue do pedido mais novo ao mais antigo.
- **Filtro de situação:**
  - ganha "Atrasada";
  - "Em andamento" mostra só as que estão dentro do prazo;
  - assim os nomes do filtro e da lista continuam iguais (`simple-screens`, "Mesmo nome no filtro e na lista").
- **Detalhe da saída curta em andamento:**
  - o supervisor lê "Volta até <hora>." ou, depois do prazo, "A volta era até <hora>.";
  - o residente lê o título "Volte até <hora>" ou "Volta atrasada".
- **API:**
  - o filtro `status` das listas de saídas curtas e longas aceita `ATRASADA`;
  - `EM_ANDAMENTO` passa a trazer só as saídas dentro do prazo.

Requisitos afetados:
- `exit-requests`: novo requisito "Saída atrasada à vista".
- `simple-screens`: "Cor de cada situação", cenário "Saídas".

Fora do escopo:
- Advertência ou marcação automática de atraso. Foi decidido manter a regra atual.
- Notificar o residente sobre o atraso. Ficou em aberto na reunião (00:05).
- Um evento novo no histórico do pedido. O selo e a notificação de ocorrência cobrem o pedido, e um evento automático mudaria a versão do pedido enquanto o supervisor pode estar registrando a volta.
- O contador do menu: a saída atrasada não espera um ato do supervisor antes de o residente voltar.
- As telas próprias da demonstração (RF027).

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `exit-requests`: novo requisito "Saída atrasada à vista".
- `simple-screens`: "Cor de cada situação" passa a citar "Atrasada" em vermelho.

## Impact

- **Backend:**
  - `management/ManagementSearch.java`: ordem com parâmetro;
  - `operations/shortexits/ShortExitService.java` e `ShortExitRepository.java`: filtro e ordem;
  - `operations/longexits/LongExitService.java` e `LongExitRepository.java`: filtro e ordem;
  - a descrição do filtro na API.
- **Frontend:**
  - `features/operations/operations-local.utils.ts`: situação mostrada;
  - `features/operations/exits-local.component.ts`;
  - `features/operations/exit-detail-local.component.ts`;
  - `features/operations/long-exit-detail.component.ts`;
  - `shared/status-tones.ts`.
- **Testes:**
  - `OperationsApiIntegrationTest` e `LongExitApiIntegrationTest`: filtro e ordem;
  - specs Vitest da lista, dos detalhes e dos utilitários;
  - `e2e/operations-local.spec.ts`.
- **Banco:** sem migração.
