## Context

Motivação em proposal.md. Estado conferido no commit b083ab2, que está em produção:

- `conversation-thread.scss` já tem `position: relative` em `.conv-log`, para prender os `.sr-only` (posição absoluta, em `styles.scss`) dos balões. `.conv-rows`, em `conversations-list.scss`, não tem. O `.sr-only` de "não lida(s)" de uma linha fora da vista se posiciona pelo bloco de contenção acima da caixa que rola e estica a página.
- `ShortExitService.depart` e `LongExitService.depart` recusam com 400 a partida antes de `requestedDepartureAt` ou de `decidedAt`. Os detalhes da conta mandam ao diálogo `minimum: exit.requestedDepartureAt`. O diálogo compara o horário retroativo só com esse mínimo e fecha. O erro do servidor aparece no detalhe, e a justificativa digitada se perde.
- `exits.component.ts` (demonstração) filtra "Pendentes" e "Concluídas" por uma lista de situações sem "Aprovada". `pending-badges-demo.ts` conta a aprovada cuja partida chegou.
- `ReportExportWorker.metric` devolve "Não informado" para qualquer métrica nula. A tela usa `decimal`, de `cleaning-local.utils.ts`, que devolve "Sem avaliação". Só `cleaningMean` pode ser nula: as outras métricas são contagens.
- Em 320 px, na demonstração, o cabeçalho tem "SAGER", a etiqueta "Demonstração" e o botão "Menu" com o contador. Somadas, as larguras passam do espaço, e "SAGER", que pode encolher, fica embaixo da etiqueta.
- O bloco "Ver o banco" do `infra/coolify/README.md` usa `$SAGER_CHECKOUT` sem defini-lo. A variável é definida em "Inspeção do stack".

## Goals / Non-Goals

**Goals:**
- Corrigir os 6 defeitos sem mudar regra, permissão, API ou banco.
- Cobrir cada correção com um teste que falharia sem ela.

**Non-Goals:**
- Os itens conhecidos que a revisão deixou de fora (proposal.md).
- Mudar a validação do servidor, que já está certa.

## Decisions

### D1. A lista de conversas prende os textos para leitores de tela

`.conv-rows` ganha `position: relative`, como `.conv-log`.

Alternativa rejeitada: tirar o `.sr-only` do contador e usar `aria-label` na linha. Isso muda o que o leitor de tela lê e a estrutura que os testes de acessibilidade já cobrem. O CSS resolve sem mexer no que é lido.

### D2. O mínimo do horário anterior é o mais tardio entre a partida pedida e a aprovação

Os detalhes da conta passam ao diálogo o maior instante entre `requestedDepartureAt` e `decidedAt`, por uma função comum em `operations-local.utils.ts`. Na partida, o diálogo diz "A partida não pode ser anterior à saída solicitada nem à aprovação.". Na volta, nada muda.

Alternativa rejeitada: manter o diálogo e mostrar melhor o erro 400 do servidor. O supervisor continuaria perdendo a justificativa, e o erro chegaria depois de fechar o diálogo.

### D3. Na demonstração, "Aprovada" é pendente

Uma função exportada de `operations-demo.service.ts` diz se a situação da demonstração está pendente: aguardando análise, aguardando autorização, falha no envio, aprovada ou em andamento. "Concluídas" é o resto. A lista usa essa função nos dois filtros.

Alternativa rejeitada: só a aprovada cuja partida chegou, como o contador. A agendada para depois também não está concluída. Com só dois filtros, ela sumiria dos dois.

### D4. O arquivo usa o mesmo texto da tela

`metric` devolve "Sem avaliação" quando `cleaningMean` é nula e mantém "Não informado" para as outras métricas, que não chegam nulas.

Alternativa rejeitada: trocar a tela para "Não informado". "Sem avaliação" é o texto da limpeza em todas as telas (`cleaning-local.utils.ts`).

### D5. No celular estreito, o cabeçalho cabe sem esconder o nome "Menu"

Medido em 320 px: o espaço para os três itens é de 276 px, e "SAGER" (68 px), "Demonstração" (131 px) e o botão (112 px), com os espaços, somam 325 px. Só diminuir espaços e margens ganha uns 30 px, e não basta.

Até 400 px, o nome "Menu" passa para baixo do ícone, com o número ao lado, numa grade dentro do botão. As margens laterais do cabeçalho caem para 12 px, o espaço entre os itens para 5 px e "SAGER" para 1,3 rem. O botão continua com 48 px de altura e mostrando "Menu" e o número, como pede o requisito "Contador acessível" (`pending-badges`). O e2e de 320 e 360 px confere que as três caixas não se cruzam, ficam dentro da tela e que o botão cabe no cabeçalho.

Alternativa rejeitada: esconder visualmente a palavra "Menu" e deixar só o ícone e o número. O nome seguiria lido pelo leitor de tela, mas o requisito pede o botão com o nome "Menu", e o `AGENTS.md` pede ações importantes com rótulo claro.

Alternativa rejeitada: diminuir a letra da etiqueta "Demonstração". O `DESIGN.md` pede texto que favoreça a leitura, e o cabeçalho já usa 1 rem no celular.

### D6. O bloco "Ver o banco" define a variável

O bloco começa com `export SAGER_CHECKOUT=...`, o mesmo caminho de "Inspeção do stack".

Alternativa rejeitada: só um link para "Inspeção do stack". Quem copia o bloco continuaria recebendo um erro.

## Risks / Trade-offs

- [O caminho do checkout aparece em dois lugares do README] → É o mesmo caminho fixo do Coolify. Uma mudança dele já exigiria rever as duas seções e a "Conta inicial".
- [Em 320 px, um contador "99+" e a etiqueta "Login local" mudam as larguras] → O e2e mede com o contador da demonstração. "Login local" é mais curto que "Demonstração", e o contador tem no máximo três caracteres, que cabem na folga que sobra.

## Pendências institucionais ou do operador

Nenhuma. As correções só alinham o sistema às specs vigentes.
