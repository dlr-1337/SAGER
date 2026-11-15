Comandos:

- **Frontend**, em `frontend/`:
  - `npx ng test --watch=false --include <spec>`;
  - `npm test -- --watch=false`;
  - `npm run build`;
  - `SAGER_E2E_PORT=4327 CI=1 npx playwright test <arquivo>`.
- **Backend**, em `backend/`: `.\mvnw.cmd -B -ntp verify`.

O modo demonstração (RF027) continua: não remover os ramos `session.active()` dos arquivos tocados.

## 1. Interface

- [x] 1.1 Trocar o texto visível de "Notificação" e "Notificações" da disciplina por "Notificação de ocorrência" e "Notificações de ocorrência" nestes arquivos:
  - `app.ts`, no menu;
  - `local-home.page.ts`, no cartão "Notificações de ocorrência e advertências" e no link "Ver notificações de ocorrência";
  - `notifications-local.pages.ts`, no título, no cabeçalho da lista, no voltar, no título do detalhe e nas mensagens;
  - `warnings-local.pages.ts`;
  - `communications-local.utils.ts`;
  - `status-tones.ts`, só se tiver texto visível;
  - `reports-local.utils.ts`, no rótulo e na descrição de `NOTIFICACOES`.
  - Verificar com os specs desses arquivos, ajustados ao nome novo, e com `npm test -- --watch=false`.
- [x] 1.2 Na Ajuda (`portal.pages.ts`), usar "notificação de ocorrência". Verificar com `portal.pages.spec.ts`.
- [x] 1.3 Ajustar `e2e/communications-local.spec.ts` ao nome novo. Verificar com `SAGER_E2E_PORT=4327 CI=1 npx playwright test e2e/communications-local.spec.ts`.

## 2. Servidor

- [x] 2.1 Em `ReportCatalog` e `ReportExportWorker`, trocar o nome do relatório `NOTIFICACOES` por "Notificações de ocorrência". Nenhum teste de backend confere esse texto: verificar com `grep -n "Notificações de ocorrência" backend/src/main/java/br/edu/ifgoiano/sager/reports/*.java` e com `.\mvnw.cmd -B -ntp verify`.

## 3. Documentação e verificação final

- [x] 3.1 Em `docs/MANUAL.md`, usar o nome novo no item 3 do supervisor e no glossário. Verificar com `grep -n "otificaç" docs/MANUAL.md`.
- [x] 3.2 Conferir com `grep -rn "'Notificações'\|>Notificações<" frontend/src/app --include=*.ts` que sobram só telas da demonstração, e rodar `npx -y @fission-ai/openspec@2.0.0 validate --all --strict`.
