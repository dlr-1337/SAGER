## Why

Na reunião de 14/11/2026, o dono e o coautor pediram que a notificação que o sistema abre para o supervisor analisar se chame "notificação de ocorrência". "Notificações" sozinho confunde com aviso, mensagem do WhatsApp e alerta do navegador, e o supervisor não sabe que ali estão as faltas, os atrasos e as limpezas abaixo de 6. Hoje o menu, a página de início, as telas, a Ajuda e o relatório dizem só "Notificações" (requisito "Palavras do dia a dia" de `plain-language`).

Afeta a regra do `AGENTS.md` de que a disciplina é gerida só pelo supervisor, que continua valendo: muda só o nome na tela.

## What Changes

- No acesso por conta, o menu, a página de início, a lista, o detalhe, o histórico, as mensagens de confirmação e a Ajuda passam a dizer "Notificação de ocorrência" e "Notificações de ocorrência" onde hoje dizem "Notificação" e "Notificações" da disciplina.
- O relatório "Notificações" passa a "Notificações de ocorrência", na tela de relatórios e no título do arquivo gerado. O relatório "Ocorrências" fica com o nome atual, para não haver dois relatórios com o mesmo nome.
- O guia de uso (`docs/MANUAL.md`) usa o nome novo no item do supervisor e no glossário.

**Fora do escopo:**

- Rotas (`/notificacoes`), códigos (`NOTIFICACOES`), campos da API, tabelas e permissões.
- As telas próprias da demonstração (RF027), que ficam como estão (`simple-screens`). O menu, comum aos dois modos, muda nos dois.
- Os avisos institucionais.
- A monografia, que o dono ajusta à parte.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `plain-language`: requisito novo "Nome da notificação de ocorrência".

## Impact

- **Frontend:**
  - `app.ts` (menu);
  - `features/portal/local-home.page.ts`;
  - `features/communications/notifications-local.pages.ts`, `warnings-local.pages.ts` e `communications-local.utils.ts`;
  - `shared/status-tones.ts`;
  - `features/reports/reports-local.utils.ts`;
  - a Ajuda em `features/portal/portal.pages.ts`;
  - os specs desses arquivos e o e2e `communications-local.spec.ts`.
- **Backend:** `ReportCatalog` e `ReportExportWorker` (nome do relatório e título do arquivo) e o teste de relatórios que confere o título.
- **API e banco:** sem mudança de campo, rota ou código.
- **Documentação:** `docs/MANUAL.md`.
