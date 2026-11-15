Comandos:

- **Backend** (em `backend/`): `.\mvnw.cmd -B -ntp -Dtest=<Classe> test` e `.\mvnw.cmd -B -ntp verify` (JDK 21 e Docker).
- **Frontend** (em `frontend/`):
  - `npx ng test --watch=false --include <spec>`;
  - `npm test -- --watch=false`;
  - `npm run build`;
  - `SAGER_E2E_PORT=4327 CI=1 npx playwright test <arquivo>`.

O modo demonstração (RF027) continua: não remover os ramos `session.active()` dos arquivos tocados.

## 1. Servidor

- [x] 1.1 Criar `V34__short_exit_recorded_departure.sql`, trocando `sager_short_exit_duration_valid` por `expected_return_at > requested_departure_at AND expected_return_at <= COALESCE(actual_departure_at, requested_departure_at) + INTERVAL '3 hours'`.
  - Verificar em `OperationsMigrationIntegrationTest` com dois casos:
    - a atualização com partida às pedida + 40 min e retorno às partida + 3 h é aceita;
    - a atualização com retorno às partida + 3 h 1 min é recusada.
  - Rodar `-Dtest=OperationsMigrationIntegrationTest`.
- [x] 1.2 Fazer o servidor calcular e fixar o retorno da saída curta.
  - Em `ShortExitController`, tirar `expectedReturnAt` do corpo aceito por `POST` e `PUT`. O campo desconhecido dá 400.
  - Em `ShortExitService.plan`, gravar como retorno a partida pedida mais 3 horas.
  - Em `depart`, e em `decide` quando ele registra a partida, gravar `expected_return_at` com a partida registrada mais 3 horas na mesma atualização, com `expectedReturnAt` na auditoria.
  - Atualizar `OperationsOpenApiConfiguration`.
  - Verificar em `OperationsApiIntegrationTest` (auxiliar `exitBody` sem o retorno):
    - pedido agendado para 14h fica com retorno às 17h;
    - pedido com `expectedReturnAt` dá 400 sem gravar;
    - aprovação de partida imediata 20 min depois do pedido fixa o retorno na aprovação + 3 h;
    - partida registrada 40 min depois da pedida fixa o retorno na partida + 3 h;
    - partida retroativa fixa o retorno no horário retroativo + 3 h;
    - partida tardia perto de outra saída aprovada não é recusada, e a partida da outra dá 409 `physical_exit_conflict` até a volta (a regra é a mesma para saída curta ou longa).
  - Rodar `-Dtest=OperationsApiIntegrationTest`.
- [x] 1.3 Em `DisciplineEvidenceService`:
  - enquadrar como `ATRASO_RETORNO` a saída curta `EM_ANDAMENTO` com prazo vencido, com o retorno previsto como hora do fato;
  - na passagem de `EM_ANDAMENTO` para `RETORNO_CONFIRMADO_COM_ATRASO`, atualizar a ocorrência sem marcar a notificação como exigindo revisão;
  - sem requisição HTTP, auditar com `recordSystem`.
  - Verificar em `DisciplineApiIntegrationTest`:
    - reescrever `actualDelayedReturnCreatesAlertButMereDeadlineAndOnTimeReturnDoNot`;
    - criar casos para os cenários "Saída curta passou do prazo sem volta", "Volta confirmada depois da ocorrência", "Volta retroativa dentro do prazo" e "Saída curta dentro do prazo".
  - Rodar `-Dtest=DisciplineApiIntegrationTest`.
- [x] 1.4 Criar a varredura das saídas vencidas.
  - Em `ShortExitExpiryService`, criar `flagOverdue`, com transação própria: ele trava o residente, relê a saída ainda `EM_ANDAMENTO` e vencida, e chama os receptores de ocorrência.
  - Em `ShortExitExpiryScheduler`, chamá-lo num `try` próprio, depois da expiração.
  - Verificar com os testes da 1.3, que chamam `flagOverdue` diretamente, e com uma segunda chamada que não cria outra ocorrência.
- [x] 1.5 Ajustar os testes que criam saída curta com retorno: `LongExitApiIntegrationTest`, `CleaningReportsIntegrationTest`, `ApiFoundationIntegrationTest` e os outros achados por `grep -rn "expectedReturnAt" backend/src/test`. Verificar com `.\mvnw.cmd -B -ntp verify`.

## 2. Interface

- [x] 2.1 Tirar `expectedReturnAt` de `ShortExitInput` (`operations-local.models.ts`) e do corpo enviado por `operations-local-api.service.ts`.
  - Remover `shortExitFormError` e `shortPeriodError` se ninguém mais os usar.
  - Manter `nextReturn` e `periodHint`, usados pelo formulário longo e pela demonstração.
  - Verificar com `operations-local-api.service.spec.ts` e `operations-local.utils.spec.ts`.
- [x] 2.2 Em `exit-form-local.component.ts`, tirar o campo "Que horas você volta?", a duração e o aviso de ajuste.
  - Subtítulo: "Diga quando sai e por quê."
  - Ajuda: "Saída curta: até 3 horas a partir da hora em que o supervisor registra sua saída. Fale com o supervisor antes de sair e ao voltar. Vai ficar mais tempo? Peça uma saída longa."
  - Verificar com `exit-form-local.component.spec.ts`:
    - sem campo de volta;
    - frase de ajuda;
    - envio sem `expectedReturnAt` nos dois modos;
    - partida exigida ao agendar;
    - sobreposição e conflito de versão;
    - remover os testes do campo de volta.
- [x] 2.3 Em `exits-local.component.ts` e `exit-detail-local.component.ts`, mostrar a volta da saída curta como "até 3 h depois da saída" enquanto `actualDepartureAt` estiver vazio, e o horário depois dela. A saída longa não muda.
  - Verificar com casos em `exits-local.component.spec.ts` e `exit-detail-local.component.spec.ts`.
- [x] 2.4 Em `communications-local.utils.ts`, dar o rótulo "Em andamento" à situação `EM_ANDAMENTO` da origem da notificação.
  - Verificar com o spec correspondente.
- [x] 2.5 Na Ajuda (`portal.pages.ts`), dizer que a saída curta dura até 3 horas a partir da saída registrada pelo supervisor e que a saída vencida abre notificação.
  - Ajustar `e2e/operations-local.spec.ts`: simulação sem retorno, formulário do pedido, lista e detalhe.
  - Verificar com `SAGER_E2E_PORT=4327 CI=1 npx playwright test e2e/operations-local.spec.ts` e com o spec do portal.

- [x] 2.6 Em `long-exit-form.component.spec.ts`, conferir o cenário "Partida movida para depois do retorno": retorno editado para 20:00 e partida movida para 21:00 levam o retorno a 01:00 do dia seguinte, com o aviso. Verificar com `npx ng test --watch=false --include src/app/features/operations/long-exit-form.component.spec.ts`.

## 3. Documentação e verificação final

- [x] 3.1 Atualizar a documentação:
  - `docs/MANUAL.md`:
    - Residente, item 4;
    - glossário, "Saída curta" e "Notificação";
    - Supervisor, item das notificações.
  - `docs/ARQUITETURA.md`: pendências institucionais, com o prazo contado da partida registrada e a ocorrência antes da volta.
  - `AGENTS.md`: a saída curta dura até 3 horas a partir da partida registrada, e a vencida abre ocorrência.
  - Verificar com `grep -n "3 horas\|saída registrada" docs/MANUAL.md docs/ARQUITETURA.md AGENTS.md`.
- [x] 3.2 Rodar a verificação completa com `./sager ci`: `.\mvnw.cmd -B -ntp verify`, `npm test -- --watch=false`, `npm run build`, os e2e sem as capturas e `npx -y @fission-ai/openspec@2.0.0 validate --all --strict`.
