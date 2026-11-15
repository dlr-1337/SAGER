## Context

Motivação em proposal.md. Estado atual, conferido no código:

- **Pedido.** `POST` e `PUT /api/v1/saidas-curtas` exigem `expectedReturnAt`. `ShortExitService.plan` recusa retorno que não supere a partida pedida ou que passe de 3 horas dela.
- **Restrição no banco.** V15 (`sager_short_exit_duration_valid`) exige `expected_return_at <= requested_departure_at + 3 horas`. `sager_short_exit_physical_valid` exige a partida física antes do retorno previsto e não antes da partida pedida.
- **Partida.** A partida é registrada em `depart` (agora ou retroativa, sempre antes do retorno previsto) ou em `decide`, quando a partida pedida já chegou. Nenhum dos dois muda o retorno previsto.
- **Prazos.** `ShortExit.deadline()` usa o retorno previsto como prazo do pedido aprovado sem partida e do pedido pendente de partida imediata. A rotina de 60 segundos (`ShortExitExpiryService`) expira esses pedidos e nunca toca a saída em andamento.
- **Sobreposição.** `ShortExitRepository.overlaps` mede a janela da saída em andamento de `requested_departure_at` a `expected_return_at`. `physicalOpenFor` impede uma segunda partida enquanto há saída física aberta, curta ou longa.
- **Ocorrências.** `DisciplineEvidenceService.reconcile("SHORT_RETURN")` roda só na confirmação da volta e enquadra só `RETORNO_CONFIRMADO_COM_ATRASO`. Quando a ocorrência já existe e a origem muda, a notificação passa a exigir revisão. A auditoria usa `audit.record`, que exige requisição HTTP.
- **Outros usos do retorno previsto.** A chamada noturna justifica a ausência pela saída em andamento com retorno previsto não vencido, lido de `expected_return_at`.
- **Telas.** O formulário de saída curta tem o campo "Que horas você volta?", com sugestão, preservação e limite. A lista e o detalhe mostram "Volta" com o retorno previsto. A demonstração tem formulário próprio.
- **Monografia.** RN01 define a saída curta pelo retorno previsto em até 3 horas. RN11 cria a ocorrência no retorno confirmado com atraso.

## Goals / Non-Goals

**Goals:**

- O residente pede a saída curta sem escolher a volta.
- O prazo de 3 horas conta da partida que o supervisor registra.
- O supervisor recebe a notificação logo que a saída curta passa do prazo, sem esperar a volta.

**Non-Goals:**

- Mudar a saída longa.
- Mudar a demonstração.
- Mudar indicadores.
- Registrar advertência automática.

## Decisions

### D1. O servidor calcula o retorno da saída curta

O pedido e a edição não aceitam `expectedReturnAt`. O servidor grava a partida pedida mais 3 horas: no modo "Agora", o horário do servidor no envio mais 3 horas. Esse horário provisório mantém os prazos de hoje para o pedido sem partida (RN08).
*Rejeitada:* aceitar e ignorar o campo. O cliente acharia que a volta escolhida foi gravada.

### D2. A partida registrada fixa o retorno

`depart` e `decide`, quando registram a partida, gravam `expected_return_at = partida registrada + 3 horas` na mesma atualização. A auditoria lista `expectedReturnAt` entre os campos mudados. Na partida retroativa, a conta parte do horário retroativo informado.

*Rejeitadas:*

- contar da partida pedida, que a reunião recusou;
- calcular o prazo na hora da leitura sem gravá-lo, porque a chamada noturna, a expiração, a disciplina e os relatórios leem `expected_return_at`.

### D3. Migração V34 troca a restrição de duração

A restrição passa a ser `expected_return_at > requested_departure_at AND expected_return_at <= COALESCE(actual_departure_at, requested_departure_at) + 3 horas`. As linhas atuais continuam válidas, porque `actual_departure_at >= requested_departure_at`.
*Rejeitada:* apagar a restrição. O banco deixaria de proteger o limite de 3 horas.

### D4. A partida não é recusada por sobreposição

Quando a partida atrasa, a janela da saída curta pode encostar numa saída seguinte já aprovada. O registro da partida segue sem 409. A saída seguinte só tem partida depois da volta confirmada (`physical_exit_conflict`), e a chamada noturna só justifica pela saída física aberta, que é uma só.
*Rejeitada:* recusar a partida com `overlapping_exit`. O residente ficaria parado na porta, e o supervisor teria de cancelar a outra saída, que pode ser uma saída longa com autorização já conferida.

### D5. Ocorrência da saída vencida pela rotina de 60 segundos

`ShortExitExpiryService` ganha uma varredura das saídas curtas `EM_ANDAMENTO` com retorno previsto vencido. A varredura roda num método e numa transação próprios, chamados pelo agendador num `try` separado da expiração, para que uma falha numa não trave a outra. Para cada saída, ela trava o residente, relê a saída e chama `reconcile("SHORT_RETURN")`, a mesma origem da volta confirmada. A ocorrência continua única por saída e residente. `reconcile` é idempotente e grava auditoria de sistema (`recordSystem`) quando não há requisição HTTP.

*Rejeitadas:*

- uma origem nova para a saída vencida, que criaria duas ocorrências e duas notificações para o mesmo atraso;
- criar a ocorrência só na chamada noturna, que atrasaria o aviso em horas.

### D6. Volta confirmada não é correção da origem

Quando a ocorrência nasceu da saída em andamento e a volta é confirmada com atraso, a ocorrência guarda uma nova revisão com o retorno, continua válida e a notificação não passa a exigir revisão. Volta retroativa dentro do prazo deixa a ocorrência inválida e pede revisão, como já define "Origem corrigida exige revisão".
*Rejeitada:* pedir revisão em toda mudança. O supervisor revisaria duas vezes cada atraso comum.

### D7. Hora da ocorrência

Enquanto a saída está em andamento, a ocorrência marca o retorno previsto como hora do fato. Na volta confirmada, ela passa à hora da volta, como hoje.
*Rejeitada:* marcar sempre o retorno previsto. Mudaria a hora das ocorrências de atraso que já existem.

### D8. Volta mostrada antes da partida

Antes da partida registrada, a lista e o detalhe mostram "até 3 h depois da saída". O horário provisório levaria o residente a voltar cedo demais ou a achar que perdeu o prazo quando a partida atrasa.
*Rejeitada:* mostrar o horário provisório.

### D9. Demonstração sem mudança

As telas próprias da demonstração (RF027) ficam como estão, como define `simple-screens`.
*Rejeitada:* mudar o formulário da demonstração nesta change.

## Riscos

- **Página aberta com a versão anterior.** Ela ainda envia `expectedReturnAt` e recebe 400 até ser recarregada. Mitigação: publicar fora do horário de pedidos.
- **Saída esquecida em andamento.** A saída ganha a ocorrência na primeira rodada depois do prazo e continua em andamento até a volta confirmada, como hoje.

## O que a instituição e o operador ainda decidem

- **Instituição:**
  - aceitar a ocorrência criada antes da volta, que muda o texto de RN11;
  - aceitar o prazo contado da partida registrada, que muda RN01;
  - decidir se a saída longa vencida também gera ocorrência antes da volta.
- **Operador:** publicar a versão quando não houver residente com o formulário de saída curta aberto.
- **Dono:** ajustar a monografia (RN01, RN11 e as figuras do formulário de saída curta).
