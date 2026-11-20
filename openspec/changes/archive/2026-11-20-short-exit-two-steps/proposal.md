## Why

Na reunião de 20/11/2026, com a Cristiane (Assistência Estudantil), o Guilherme e o Otávio, o fluxo da saída curta foi revisto. Trechos da transcrição: 01:08 a 01:10, 01:29 a 01:30 e 01:40 a 01:45. Decisões:

- **Sem horário.** Cristiane: "Não faz muito sentido o estudante marcar o horário que ele quer sair". A escolha "Agora / Escolher data e hora" sai. O pedido de saída curta é sempre para agora. Com o horário agendado, o residente pede para daqui a duas horas e ganha tempo extra.
- **Dois passos para o supervisor: registrar a saída e registrar a volta.** Cristiane: "não tem necessidade de passos extra, de confirmação extra". Guilherme: "Não precisa dessa aprovação de saída. … é só dois passos". O "Aprovar" separado sai. O supervisor libera a saída num único ato, "Registrar saída", com o residente na frente dele, e as 3 horas começam a contar ali.
- **Aviso ao residente.** Depois do pedido aparece uma janela mandando procurar o supervisor na hora de sair. No detalhe, sai o bloco "O que você pode fazer", e a frase "apresente-se ao supervisor" fica em destaque.

Continua como está:
- a contagem das 3 horas a partir do registro presencial, decidida em 19/11 (`exit-departure-in-person`);
- a partida com horário anterior, com justificativa;
- o conflito com outra saída em andamento;
- a volta registrada pelo supervisor;
- o atraso, que gera notificação de ocorrência e nunca advertência automática.

Requisitos e regras afetados:
- `exit-requests`:
  - "Tipo de saída pela duração";
  - "Pedido feito pelo próprio residente";
  - "Saída exige residente elegível";
  - "Sem sobreposição de saídas";
  - "Decisão do supervisor";
  - "Partida física";
  - "Prazo da saída curta a partir da partida registrada".
- `exit-scheduling`: "Rejeição de saída curta com motivo" e "Saída curta sem horário de volta".
- `simple-screens`: "Rejeitar e recusar em vermelho" e "Saída curta com só a ação do momento". Requisito novo: "Aviso ao residente depois do pedido de saída curta".
- `help-center`: "Ajuda sem login", cenário "Quando a saída começa".
- AGENTS.md, "Current Domain Decisions": o trecho sobre aprovação e registro da partida das saídas curtas.

## What Changes

- **Pedido do residente:**
  - "Pedir saída curta" pergunta só o motivo e as observações. Saem a pergunta "Quando você quer sair?" e o campo de data e hora.
  - O servidor grava a hora do pedido como partida pedida. Recusa com 400 o pedido ou a edição de saída curta agendada (`SCHEDULED`) e o horário enviado pelo aparelho.
- **Aviso depois do pedido:**
  - Ao enviar, o residente vê a janela "Pedido enviado": "Quando quiser sair, vá até o supervisor. As 3 horas só começam quando ele registrar a sua saída." O botão é "Entendi".
  - No detalhe, enquanto o pedido espera, o título do passo é "Apresente-se ao supervisor", em destaque, seguido de "Mudar pedido" e "Cancelar pedido". Sai o título "O que você pode fazer".
- **Supervisor, em dois passos:**
  - Passo 1 de 2, "Saída": "Registrar saída" (principal) e "Rejeitar" (vermelho), com a frase "Registre a saída quando o residente se apresentar."
  - O diálogo de registrar saída continua o mesmo: "Agora" ou horário anterior com justificativa.
  - Ao confirmar, a saída passa direto de "Aguardando análise" para "Em andamento". O servidor grava a liberação, com a decisão no instante da partida, e a partida no mesmo ato, num único registro do histórico, "Saída registrada".
  - A mensagem diz até quando o residente deve voltar: "Saída registrada. Volta até <data e hora>."
  - Passo 2 de 2, "Volta": "Registrar volta", sem mudança.
- **API:**
  - `POST .../saidas-curtas/{id}/partida` passa a aceitar a saída aguardando análise.
  - `POST .../decisao` aceita só `REJECT` na saída curta. `APPROVE` recebe 400 com "Para liberar a saída curta, registre a saída."
- **Pedidos antigos:**
  - a saída curta aprovada antes desta mudança continua com "Registrar saída" a partir da hora pedida;
  - a agendada continua mostrando "Saída marcada para";
  - a lista e o detalhe mostram "Pedido em" no lugar de "Saída pedida" quando o pedido é para agora.
- **Texto:**
  - a legenda "Aprovada" passa de "Pode sair no horário pedido." a "Falta o supervisor registrar a saída.", que vale para a saída longa e para a curta antiga;
  - a Ajuda "Quando a saída começa?" e os guias da saída curta;
  - `docs/MANUAL.md`, `docs/ARQUITETURA.md` (D05) e `AGENTS.md`.

Fora do escopo:
- **Saída longa:** continua com data e hora, autorização conferida, aprovação e registro da saída. Na reunião ficou dito: "Pelo menos a curta."
- **Demonstração (RF027):** as telas próprias dela seguem a monografia (RF007 e RF008, com agendamento e aprovação), como já previsto em "Saída curta sem horário de volta".
- **Saída curta criada pelo supervisor**, para quem chega sem pedido. Hoje só o residente pede, e a reunião não decidiu essa mudança.
- **Selo "Atrasada":** está em `overdue-exit-badge`.
- **Banco:** nenhuma migração. As restrições atuais aceitam a decisão no instante da partida.
- **Monografia:** RF007, RF008, RN06, UC06, UC07 e UC17 descrevem o fluxo anterior. Atualizá-la é do autor.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `exit-requests`:
  - o pedido de saída curta é sempre para agora;
  - a liberação da saída curta é o próprio registro da saída;
  - a decisão da saída curta só rejeita.
- `exit-scheduling`: o formulário da saída curta não pede horário, e a aprovação com comentário deixa de valer para a saída curta.
- `simple-screens`:
  - os dois passos do supervisor;
  - "Registrar saída" como botão principal ao lado de "Rejeitar";
  - o aviso ao residente.
- `help-center`: a resposta "Quando a saída começa?".

## Impact

- **Backend:**
  - `operations/shortexits/ShortExitService.java`: `plan`, `decide`, `depart` e as capacidades do `view`;
  - `ShortExitController.java`: `departureMode` opcional;
  - `api/OperationsOpenApiConfiguration.java`: descrição.
- **API:**
  - `departureMode` da saída curta aceita só `NOW`, e pode faltar;
  - `/decisao` com `APPROVE` na saída curta responde 400;
  - `/partida` aceita `AGUARDANDO_ANALISE`, e a versão avança 1.
- **Frontend:**
  - `features/operations/`:
    - `exit-form-local.component.ts`;
    - `exit-detail-local.component.ts`;
    - `exit-sent-dialog.component.ts` (novo);
    - `exits-local.component.ts`;
    - `operations-local.utils.ts`;
    - `operations-local.models.ts`;
    - `operations-local-api.service.ts`;
  - `shared/status-tones.ts`;
  - `features/portal/portal.pages.ts` (Ajuda).
- **Testes:**
  - `OperationsApiIntegrationTest`;
  - os auxiliares de saída curta de `DisciplineApiIntegrationTest`, `ApiFoundationIntegrationTest`, `CleaningReportsIntegrationTest`, `PendingApiIntegrationTest`, `LongExitApiIntegrationTest` e `IntegrationFlowIntegrationTest`;
  - specs Vitest das telas e utilitários;
  - `e2e/operations-local.spec.ts`.
- **Dados:** os pedidos antigos continuam válidos e trabalháveis.
