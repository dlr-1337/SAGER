## Context

Desde 19/11 (`exit-departure-in-person`), a saída curta tem três atos do supervisor: aprovar, registrar a saída e registrar a volta. O residente escolhe "Agora" ou uma data e hora. Na reunião de 20/11, Cristiane, Guilherme e Otávio decidiram três coisas. O pedido é sempre para agora. O supervisor faz só dois atos: registrar a saída, com o residente presente, e registrar a volta. O residente é avisado de que deve procurar o supervisor.

## Goals / Non-Goals

**Goals:**
- O pedido de saída curta sem nenhum campo de horário.
- Um único ato do supervisor para liberar e começar a saída, com o residente presente.
- "Rejeitar" continua disponível para o pedido que não deve sair.
- Os pedidos antigos continuam trabalháveis: o aprovado recebe "Registrar saída" na hora pedida; o agendado que ainda espera análise pode ser rejeitado ou cancelado e expira na hora pedida, como antes.

**Non-Goals:**
- Mudar a saída longa.
- Migrar dados ou mudar o esquema do banco.
- Mudar as telas próprias da demonstração.

## Decisions

1. **"Registrar saída" sobre o pedido aguardando análise libera e começa a saída num ato só.** O servidor grava `decision = APPROVE` com `decided_at` igual ao horário da partida registrada, mais a partida e o retorno previsto em 3 horas. A versão avança 1, e o histórico tem um único evento, `DEPARTURE` ("Saída registrada"). A auditoria guarda `status`, `decision`, `actualDepartureAt` e `expectedReturnAt`.
   - Alternativa rejeitada: a tela chama `/decisao` e depois `/partida`. Não é atômico, porque uma falha entre os dois deixa a saída aprovada sem partida. Além disso, gera dois registros para um ato só.
   - Alternativa rejeitada: dois eventos no histórico, aprovação e partida, com a versão +2. O supervisor fez um único ato, e o histórico deve contar o que ele fez.
   - Alternativa rejeitada: uma migração para permitir partida sem decisão. A restrição `decided_at <= actual_departure_at` já aceita a decisão no instante da partida, e uma migração exigiria mexer em dados de produção.
2. **Decisão no instante da partida, também na partida com horário anterior.** Na partida com horário anterior, a liberação vale desde esse horário, e o horário real do registro fica no histórico e na auditoria.
   - Alternativa rejeitada: `decided_at` igual à hora do registro. Violaria a restrição `decided_at <= actual_departure_at` na partida com horário anterior.
3. **`/decisao` com `APPROVE` na saída curta responde 400.** Assim o fluxo de três atos não volta por outro cliente. `REJECT` continua igual, com motivo de 10 a 2.000 caracteres.
   - Alternativa rejeitada: manter `APPROVE`. Deixaria dois caminhos para o mesmo resultado, e a tela e a regra não bateriam.
4. **O pedido é sempre para agora: `departureMode` pode faltar ou ser `NOW`, e `SCHEDULED` responde 400.** A partida pedida é a hora do pedido, e o prazo do pedido continua sendo essa hora mais 3 horas. Depois disso, o pedido expira e o residente pede de novo.
   - Alternativa rejeitada: o pedido valer até o fim do dia. Cristiane disse "Ele vai lá a hora que ele quiser", mas a regra de expiração não foi discutida. Manter as 3 horas não exige mudar a rotina nem a contagem do menu.
5. **Aviso em janela depois do envio, e destaque no detalhe.** A janela abre uma vez, quando o detalhe chega com `?enviado=1`. Depois o endereço volta a não ter parâmetro, para a janela não reaparecer ao recarregar. Pelo mesmo motivo, "Pedido salvo." (`?saved=1`) também some do endereço.
   - Alternativa rejeitada: tela cheia. Cristiane: "Não, nem precisa. Só destacar essa frase aí."
6. **Pedidos antigos.**
   - A saída aprovada sem partida continua no passo "Saída", com "Registrar saída" a partir da hora pedida.
   - A agendada continua mostrando "Saída marcada para".
   - A agendada que ainda espera análise não recebe "Registrar saída": o prazo dela é a própria hora pedida, e a partida não pode vir antes dessa hora. O supervisor rejeita ou cancela, ou ela expira sozinha.
   - O passo é contado como "1 de 2", igual ao pedido novo.
   - Alternativa rejeitada: expirar ou converter os pedidos antigos por migração. Eles somem sozinhos pela expiração em até 3 horas, e uma migração mexeria em registros auditados.

## Risks / Trade-offs

- **Pedido feito por outra pessoa.** Quem pegar o celular do residente pode pedir uma saída. O pedido não inicia a contagem, e o supervisor só libera com o residente na frente dele. É o mesmo motivo da decisão de 19/11.
- **Sem aprovação prévia.** O supervisor que quiser recusar com antecedência usa "Rejeitar". Antes, ele podia aprovar antes de o residente aparecer. Isso foi pedido na reunião.
- **Monografia desatualizada.** RF007, RF008, RN06, UC06, UC07 e UC17 descrevem agendamento e aprovação na saída curta. Atualizar a monografia é do autor.

## Pendências institucionais

- **Validade do pedido sem registro da saída** (hoje 3 horas). Se a Assistência Estudantil preferir até o fim do dia, é uma mudança à parte.
- **Saída curta pedida pelo supervisor** para quem chega sem pedido no sistema. Não foi decidido.
- **Atualização da monografia** (RF007, RF008, RN06, UC06, UC07 e UC17).
