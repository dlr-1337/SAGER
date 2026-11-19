## Context

Motivação em proposal.md. Decisão do dono na reunião de 19/11/2026:

1. O residente continua escolhendo a data e a hora da saída: "agora" ou agendada.
2. A contagem do tempo de ausência só começa quando o supervisor registra a partida presencialmente, ao ver o residente.
3. O supervisor registra a saída e a volta.

Estado atual, conferido no código desta branch:

- `ShortExitService.decide` e `LongExitService.decide` calculam `departNow` (aprovação com a partida pedida já alcançada). Nesse caso, conferem `noPhysicalExitOpen` antes de gravar e fazem uma segunda gravação `EM_ANDAMENTO`, com evento `DEPARTURE` e auditoria. Na curta, essa gravação também fixa `expected_return_at` na aprovação mais 3 horas.
- `depart` já exige `APROVADA`, partida não antes da pedida nem da decisão e antes do retorno previsto, residente elegível e nenhuma saída física aberta. Aceita o horário agora ou retroativo, com justificativa. Na curta, fixa o retorno na partida registrada mais 3 horas.
- `canDepart` já é `supervisor && APROVADA && dentro do prazo && agora não anterior à partida pedida`. Logo, a saída "agora" aprovada sem partida já tem `canDepart` verdadeiro até o prazo.
- O prazo da aprovada sem partida é o retorno previsto (`ShortExit.deadline()`), que antes da partida é a partida pedida mais 3 horas na curta. A rotina de 60 s expira essa saída com motivo `APPROVED_WITHOUT_DEPARTURE`.
- A justificativa automática da chamada (`authorizedFor`) já exige partida física registrada.
- As restrições das tabelas já aceitam `APROVADA` sem partida em qualquer modo. Não há migração.
- No frontend, os detalhes usam `leavesNow` para trocar o diálogo para "Aprovar e registrar a saída agora" e `approvalMessage` para a mensagem "Aprovação e saída registradas.". O passo "Saída" só entra na lista de passos da agendada ou da aprovada.
- A demonstração (`OperationsDemoService.decideExit`) põe "Em andamento" na aprovação da saída cuja partida já chegou e não tem ação de registrar a saída.

## Goals / Non-Goals

**Goals:**
- A aprovação só decide; a partida é sempre um ato separado do supervisor, feito ao ver o residente.
- O prazo de 3 horas da curta só começa nesse registro.
- A tela diz ao supervisor e ao residente o que falta depois da aprovação.

**Non-Goals:**
- Mudar o formulário do residente ou o modo "agora" e agendado.
- Mudar a rota de partida, `canDepart`, a expiração ou a chamada noturna.
- Criar uma ação "não saiu".

## Decisions

### D1. A aprovação só grava a decisão

`decide` deixa de calcular `departNow`: a aprovação grava só `APROVADA`, com um evento `APPROVE` e uma auditoria `UPDATE`, e a resposta volta com a versão avançada em 1. Vale para a curta e para a longa. O retorno previsto da curta continua sendo a partida pedida mais 3 horas até o registro da partida.

Alternativas rejeitadas:
- Manter a partida na aprovação só na saída longa. A longa também pode ser pedida pelo celular de outra pessoa, e o dono decidiu a mesma regra para as duas.
- Registrar a partida na aprovação e só começar a contar o prazo numa "confirmação" posterior. A saída ficaria "em andamento" sem o residente ter saído, e a chamada noturna o justificaria.

### D2. O conflito físico passa só para o registro da partida

Sem partida na aprovação, a aprovação não confere mais `physicalOpenFor`. Uma saída aprovada com outra saída do residente ainda em andamento fica aprovada; o registro da partida continua respondendo 409 `physical_exit_conflict` até a volta da outra, e a tela continua com a mensagem "O residente ainda está fora com outra saída. Confirme a volta dela primeiro.", sem congelar as ações.

Alternativa rejeitada: continuar recusando a aprovação. A aprovação não move ninguém, e o pedido poderia vencer enquanto o supervisor espera a volta da outra saída para aprovar.

### D3. Passo "Saída" em toda saída aprovada

Nos detalhes da curta e da longa, a lista de passos passa a ter sempre "Saída" depois de "Decisão". No passo "Saída":
- com a partida pedida já alcançada (`leavesNow`, pelo `now` do servidor): "Registre a saída quando o residente se apresentar." e, com `canDepart`, o botão "Registrar saída";
- antes dela: "Saída marcada para <data e hora>.", sem botão.

O diálogo de "Registrar saída" não muda: já diz "Veja o residente pessoalmente antes de liberar a saída." e aceita horário retroativo com justificativa.

Alternativa rejeitada: mostrar "Saída marcada para <hora pedida>" também no pedido para sair agora. A hora é a do pedido, já passada, e a frase parece dizer que o residente já saiu.

### D4. Diálogo e mensagem da aprovação

O diálogo de aprovação ganha uma nota curta (campo `note` do diálogo local, em texto de ajuda, sem `role="alert"`): "Aprovar não registra a saída; ela é registrada quando o residente se apresentar.". O título fica "A saída será aprovada." (na longa, "A saída longa será aprovada."), o botão "Confirmar aprovação" e a mensagem depois de aprovar "Aprovação registrada.". `approvalMessage` sai de `operations-local.utils.ts`.

Alternativas rejeitadas:
- Pôr a regra no botão, como "Aprovar sem registrar a saída". O botão ficaria longo e com frase negativa.
- Usar o aviso (`warning`) do diálogo. Ele é um alerta de risco para leitores de tela, e aqui é só orientação.

### D5. O residente sabe que precisa se apresentar

No detalhe do residente, a saída aprovada mostra "Apresente-se ao supervisor para ele registrar a saída." quando a partida pedida já chegou, e "Saída marcada para <data e hora>." antes dela. A frase "O supervisor registra a saída e a volta." continua.

Alternativa rejeitada: deixar só "Saída marcada para <hora pedida>". No pedido para sair agora, a hora já passou e o residente não saberia que ainda precisa procurar o supervisor.

### D6. Demonstração com "Registrar saída"

Em `OperationsDemoService.decideExit`, a aprovação deixa sempre "Aprovada", só com "Aprovada por supervisor" na linha do tempo. Um método novo, `recordDeparture`, passa a saída aprovada cuja partida pedida chegou a "Em andamento", com "Saída registrada pelo supervisor" na linha do tempo. No detalhe da demonstração, o supervisor vê "Registre a saída quando o residente se apresentar." e "Registrar saída" nessa situação, com o mesmo diálogo simples das outras ações e o aviso "Veja o residente pessoalmente antes de liberar a saída.". O caso fixo "Em andamento" (S-1047) passa a ter a aprovação antes da saída, com a saída registrada pelo supervisor.

Alternativa rejeitada: manter a demonstração sem "Registrar saída", como decidiu a change anterior. Sem a partida na aprovação, a saída aprovada para sair agora ficaria parada na demonstração, contra `demo-fidelity`.

### D7. Expiração e chamada noturna sem código novo

A saída "agora" aprovada sem partida passa a seguir o caminho que a agendada já segue: expira no retorno previsto, com `APPROVED_WITHOUT_DEPARTURE`, e deixa o residente pendente na chamada. A saída longa de vários dias continua justificando todas as chamadas, agora a partir da partida registrada pelo supervisor. A change só ajusta os testes que aprovavam e já contavam com a partida.

Os cenários "Partida na aprovação da saída longa" e "Aprovação imediata com outra saída em andamento" mantêm o título, com o conteúdo novo: o `openspec validate --strict` 2.0.0 recusa renomear cenário em MODIFIED.

Alternativa rejeitada: dar à aprovada "agora" um prazo próprio para o residente se apresentar. Seria uma regra nova sem pedido do dono; o prazo atual (partida pedida mais 3 horas na curta, retorno previsto na longa) já limita o pedido.

### D8. `access-control` e a monografia não mudam

Aprovar e registrar a partida continuam sendo do supervisor, e o gestor recebe 403 nas duas rotas. RN06, RF014, UC17 e a pós-condição do UC07 ("aprovada" ou "rejeitada") voltam a valer sem ressalva. A sugestão de texto para o UC07 da change `auto-departure-on-approval` deixa de valer.

Alternativa rejeitada: um delta em `access-control`. Nenhum comportamento de permissão muda.

## Risks / Trade-offs

- O supervisor pode liberar o residente e esquecer de registrar a saída. Então a chamada noturna não o justifica, e a saída aprovada expira no prazo. Mitigação: "Registrar saída" é a única ação do passo, a lista mostra "Aprovada" e a partida retroativa com justificativa continua disponível até o prazo.
- O residente que não aparece deixa a saída aprovada até o prazo, quando ela expira. O supervisor pode cancelá-la antes.
- A partida retroativa continua possível e pode adiantar o início da contagem. Ela exige justificativa, não pode ser anterior à aprovação nem à partida pedida, e fica no histórico e na auditoria.

## Migration Plan

Sem migração e sem passo de operador. As saídas que começaram na aprovação continuam válidas, com o mesmo estado e histórico de uma partida registrada. Para desfazer, basta publicar a versão anterior.

## O que a instituição e o operador ainda decidem

- AE: confirmar que a partida só é registrada presencialmente, também no pedido para sair agora (RN06).
- AE: se o prazo para o residente se apresentar depois da aprovação (partida pedida mais 3 horas na curta, retorno previsto na longa) está certo, ou se deve haver um prazo menor.
- AE: o que fazer quando o pedido aprovado não é usado. Hoje ele expira no prazo ou o supervisor o cancela.
- Autores: nada a mudar na monografia; a sugestão para o UC07 da change anterior deixa de valer.
- Operador: nada.
