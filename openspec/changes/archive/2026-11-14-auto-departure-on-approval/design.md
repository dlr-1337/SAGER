## Context

Motivação em proposal.md. Decisão final do dono, em 14/11/2026, escolhida para ficar de acordo com a monografia (RN06 "Somente o supervisor registra a partida e o retorno", RF014, UC17 e a tabela de permissões em cap4.tex:77):

1. Aprovar uma saída curta ou longa cuja partida pedida já chegou (pedido para sair agora) registra, no mesmo ato e em nome do supervisor que aprovou, a partida física no instante da aprovação. A saída passa a "em andamento". O diálogo de aprovação diz isso numa frase ("Aprovar e registrar a saída agora"). No histórico ficam a decisão e a partida, com o supervisor como autor.
2. Saída agendada: continua "aprovada" e mostra "Saída marcada para <data e hora>". "Registrar saída" só aparece quando a hora pedida chega; antes disso, o supervisor ainda pode cancelar. Nenhuma rotina do sistema registra partida.
3. Outra saída física aberta do residente ao aprovar uma saída imediata: 409 `physical_exit_conflict`, e a tela diz para confirmar a volta da outra saída primeiro.
4. A expiração não muda: aprovada sem partida expira quando o retorno previsto passa.
5. Chamada noturna: RN10 não muda. Com a partida registrada na aprovação, quem saiu entra justificado na abertura; a saída longa em andamento justifica todas as chamadas dentro do retorno previsto, sem notificação de ausência. A aprovada sem partida continua pendente.

Estado atual, conferido no código desta branch (`feat/ux-simples`):

- `ShortExitService.decide` e `LongExitService.decide` só gravam `APROVADA`. A partida vem de `depart`, que exige `APROVADA`, partida não antes da pedida nem da decisão e antes do retorno previsto, residente elegível e nenhuma saída física aberta (`ExitOccupancyLookup.physicalOpenFor`).
- `canDepart` já é `supervisor && APROVADA && dentro do prazo && agora não anterior à partida pedida` (`ShortExitService.view` e `LongExitService`). A tela mostra "Registrar saída" só com `canDepart`. Logo, "Registrar saída só a partir da hora pedida" já vale no servidor; falta a tela dizer quando a saída está marcada.
- Pela regra "Prazo vencido antes da rotina", o pedido agendado vence na partida pedida (`deadline_passed`). Assim, só o pedido para sair agora chega à aprovação com a partida pedida já alcançada; o agendado é sempre aprovado antes.
- O histórico tem uma linha por versão (`UNIQUE(exit_id, resulting_version)` em V15 e V16). As restrições das tabelas já aceitam `EM_ANDAMENTO` com partida igual à decisão. Não há migração.
- A justificativa automática da chamada (`authorizedFor` nos dois repositórios) já pede decisão `APPROVE`, partida física até a abertura, nenhum retorno até a abertura e retorno previsto não vencido. Uma saída longa de 20 dias com partida registrada já justifica as 20 chamadas.
- No frontend, todo 409 da tela de detalhe cai em "Outra pessoa alterou este registro ou o prazo terminou." (`operationsError`) e congela as ações até recarregar.

## Goals / Non-Goals

**Goals:**
- Um ato só para liberar o pedido para sair agora: aprovar.
- O supervisor continua sendo o único que registra a partida (RN06).
- Nenhuma mudança na regra da chamada noturna nem na expiração.

**Non-Goals:**
- Nenhum campo novo na API, nenhuma migração e nenhuma rotina nova.
- Nenhuma ação de desistência para saída em andamento.
- Nenhuma mudança na rota manual de partida, em `canDepart` ou no prazo dos pedidos pendentes.

## Decisions

### D1. Partida na aprovação, na mesma transação, com dois eventos no histórico

Em `decide`, na aprovação, se `now` não for anterior à partida pedida, o serviço confere a saída física aberta (D3) e, depois de gravar a aprovação, faz uma segunda gravação: `EM_ANDAMENTO` com `actual_departure_at = now`, evento `DEPARTURE` no histórico com o supervisor como autor e `effective_at = now`, e auditoria `UPDATE` de `status` e `actualDepartureAt`, como em `depart`. As duas gravações estão na mesma transação; a resposta volta com a versão avançada em 2.

A condição é o horário, não o modo `NOW`: é a mesma conferência de `canDepart` e de `depart`, e, pela regra do prazo, dá o mesmo resultado que olhar o modo.

Alternativas rejeitadas:
- Uma gravação só, já `EM_ANDAMENTO`, com um evento `APPROVE`. O histórico perderia o evento de partida, que a tela, o residente e os relatórios leem.
- O frontend chamar `POST .../partida` logo depois de aprovar. São duas requisições sem atomicidade: a aprovação poderia ficar sem partida, que é o problema de hoje.

### D2. Saída agendada: o supervisor registra a partida a partir da hora pedida

A aprovada agendada fica `APROVADA`. O detalhe mostra "Saída marcada para <data e hora>" ao supervisor e ao residente. "Registrar saída" continua ligado a `canDepart`, que já só fica verdadeiro na hora pedida; antes dela, o supervisor vê "Cancelar pedido". Com a change `auto-refresh-pages` aplicada, o botão aparece sozinho em até 15 segundos depois da hora; sem ela, aparece ao recarregar.

Alternativas rejeitadas:
- Uma rotina de 60 segundos que registra a partida agendada como ato do sistema. Contraria RN06, RF014 e UC17: a partida passaria a ter o sistema como autor.
- Registrar já na aprovação a partida agendada, com horário futuro. O residente ainda não saiu, e a partida deixaria de ser um fato registrado pelo supervisor.
- Calcular no navegador a hora em que o botão aparece. Duplicaria a regra de `canDepart`, que já vem do servidor com o relógio dele.

### D3. Conflito físico recusa a aprovação imediata

A aprovação imediata usa a mesma consulta de `depart` (`physicalOpenFor(residentId)`, sem mudança de assinatura). Se outra saída do residente estiver em andamento, por exemplo uma saída atrasada ainda sem volta, a resposta é 409 `physical_exit_conflict`, nada é gravado e o pedido continua aguardando análise. A conferência vem antes da gravação da aprovação.

Na tela, `operationsError` ganha a mensagem própria "O residente ainda está fora com outra saída. Confirme a volta dela primeiro." para esse código, e esse 409 não congela as ações: não é edição concorrente.

Alternativas rejeitadas:
- Aprovar e deixar a saída "aprovada" sem partida. O supervisor teria de voltar para registrar a saída, que é o clique que a decisão tira.
- Aprovar e registrar a partida mesmo assim. Seriam duas partidas físicas abertas, contra RN07.

### D4. Expiração e chamada noturna sem código novo

A aprovada imediata nasce `EM_ANDAMENTO`, e a expiração já ignora essa situação; a aprovada agendada sem partida expira no retorno previsto, como hoje (`APPROVED_WITHOUT_DEPARTURE`). A regra de `authorizedFor` já faz o que a decisão 5 pede. A change só acrescenta testes: a saída longa de 20 dias justificada em várias noites, sem ocorrência nem notificação, e pendente depois do retorno previsto vencido.

O texto do requisito da chamada passa a citar o retorno previsto não vencido, que é o "intervalo válido" de RN10 e o que o servidor já confere. Os cenários existentes, inclusive "Aprovada sem partida registrada", ficam com o mesmo título e conteúdo: o `openspec validate --strict` 2.0.0 recusa renomear cenário em MODIFIED.

Alternativa rejeitada: um período de justificativa próprio da chamada. Duplicaria RN10, que já está num lugar só.

### D5. Diálogo e mensagens

Nos detalhes locais da saída curta e da longa:
- No diálogo de aprovação, quando a partida pedida não é posterior ao `now` devolvido pelo servidor, o botão de confirmar passa de "Confirmar aprovação" para "Aprovar e registrar a saída agora". É a frase única que diz o que o clique faz.
- Depois de aprovar, a mensagem segue a situação devolvida: "Aprovação e saída registradas." (`EM_ANDAMENTO`) ou "Aprovação registrada." (`APROVADA`). Na longa, "Pedido aprovado. O supervisor vai registrar a saída." dá lugar ao mesmo par.
- Os textos do residente ("O supervisor registra a saída e a volta." e "O supervisor analisa o pedido e registra a saída e a volta.") continuam: seguem verdadeiros e iguais à RN06.

Alternativas rejeitadas:
- Uma linha de aviso no diálogo, além do botão. Duas frases dizendo a mesma coisa, contra o pedido de pouco texto.
- Tirar "Registrar saída" da tela. A saída agendada ficaria sem caminho para começar.

### D6. Demonstração acompanha a regra

Em `decideExit`, aprovar uma saída cuja partida pedida já chegou deixa "Em andamento", com "Aprovada por supervisor" e "Saída registrada na aprovação" na linha do tempo; a agendada fica "Aprovada". O texto da demonstração que diz que o evento que inicia a saída depende da AE passa a "Saída marcada para <data e hora>.", e o caso fixo "Em andamento" deixa de dizer que a partida depende da AE.

Alternativa rejeitada: acrescentar "Registrar saída" à demonstração. É uma função nova num protótipo que já tem um caso em andamento para testar a volta.

### D7. `access-control` e a monografia não mudam

"Operações só do supervisor" continua verdadeira: aprovar e registrar a partida são do supervisor, e o gestor recebe 403 nas duas rotas. RN06, RF014, UC17 e a tabela de permissões continuam corretos, porque a partida registrada na aprovação tem o supervisor como autor.

Alternativa rejeitada: um delta em `access-control`. Não mudaria nenhum comportamento observável.

## Risks / Trade-offs

- Residente com pedido para sair agora aprovado que desiste fica "em andamento" e entra justificado na chamada. Mitigação: o supervisor confirma a volta na hora; o aviso de conferência da chamada já pede que ele confira as marcações.
- A change ativa `simpler-screens` mexe nos mesmos detalhes de saída e já segue esta decisão (passos "Decisão", "Saída" só na agendada e "Volta"). Aplicar esta antes dela.
- Sem `auto-refresh-pages`, um detalhe aberto antes da hora só mostra "Registrar saída" depois de recarregar.

## Migration Plan

Sem migração de banco e sem passo de operador. As saídas já aprovadas continuam aprovadas e seguem com "Registrar saída", como hoje. Para desfazer, basta publicar a versão anterior: as saídas que começaram na aprovação continuam válidas, porque o estado e o histórico são os mesmos da partida manual.

## O que a instituição e o operador ainda decidem

- AE: confirmar que, no pedido para sair agora, a aprovação do supervisor vale como o registro da partida de RN06.
- AE: o que fazer quando o residente desiste depois da aprovação imediata. Hoje o supervisor confirma a volta; a AE pode pedir uma ação "não saiu".
- Autores: acrescentar à monografia a partida registrada na aprovação do pedido para sair agora (UC07 e diagrama da decisão), conforme a seção abaixo.
- Operador: nada.

## Monografia: sugestão opcional

A decisão segue RN06, RF014 e UC17. Um ponto fica incompleto: as pós-condições do UC07 (cap4.tex:351) dizem só "aprovada" ou "rejeitada", e o pedido para sair agora aprovado termina "em andamento" (o histórico guarda a aprovação e a partida). Frases possíveis, se os autores quiserem alinhar o texto:

- UC07, pós-condições, depois de "Situação 'aprovada' ou 'rejeitada'": "; no pedido para sair agora, a aprovação também registra a partida, e a saída fica 'em andamento' (UC17)".
- Diagrama de sequência da conferência, decisão, partida e retorno da saída longa (cap4.tex:426, depois de "a partida coloca a saída em andamento"): "No pedido para sair agora, a aprovação registra a partida no mesmo ato, em nome do supervisor que aprovou."
