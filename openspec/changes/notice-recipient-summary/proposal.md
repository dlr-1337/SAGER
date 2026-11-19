## Why

Na reunião de 19/11/2026, o dono pediu diálogos de aviso mais curtos. Hoje, "Quem vai receber" lista o nome e a matrícula de cada residente:

- na confirmação de "Salvar rascunho", depois da opção e da quantidade;
- em "Revisar publicação", "Publicar correção" e "Retirar com justificativa", na página do aviso salvo.

Com "Todos os moradores", são centenas de linhas: o diálogo fica comprido, com rolagem, e o botão de confirmar some no fim. O dono quer ver só o grupo e a quantidade, como "Todos os moradores · 24 residentes" ou o nome do alojamento com a quantidade. A lista com os nomes fica só na página do aviso salvo, em "Quem recebe".

Afeta o requisito "Destinatários por critério" de `institutional-notices` (RF023, UC22) e a decisão D8 da change arquivada `2026-11-14-notice-audience-options`, que punha os nomes depois da opção e da quantidade. Segue "Confirmação em uma frase" de `simple-screens`.

## What Changes

- **Salvar rascunho:** "Quem vai receber" mostra só a opção e a quantidade, sem nomes nem matrículas:
  - "Todos os moradores · 24 residentes";
  - "Alojamento Norte · 12 residentes", com o nome do alojamento;
  - "Quarto S-201, Alojamento Sul · 2 residentes";
  - "Só maiores de 18 · 10 residentes" e "Só menores de 18 · 14 residentes";
  - "Escolhidos um a um · 3 residentes".
- **Grupo gravado:** ao salvar o rascunho, a tela manda a opção escolhida, e o servidor monta o grupo com os nomes cadastrados e o grava com o aviso (migração V39). O servidor não aceita o texto do grupo vindo da tela.
- **Aviso salvo** ("Revisar publicação", "Publicar correção" e "Retirar com justificativa"): "Quem vai receber" mostra o grupo gravado e a quantidade, como "Todos os moradores · 24 residentes", sem nomes.
- **Aviso antigo**, sem grupo gravado: os mesmos diálogos mostram "Lista salva no rascunho · 24 residentes".
- A página do aviso salvo continua listando os nomes em "Quem recebe".
- O guia de uso (`docs/MANUAL.md`) explica onde ficam os nomes.

**Fora do escopo:**

- conferir no servidor se cada destinatário pertence ao grupo;
- deduzir o grupo dos avisos antigos;
- mudar a lista "Ver quem vai receber" do formulário, que continua com nome e matrícula para desmarcar alguém;
- mudar a página do aviso salvo;
- outras telas de comunicação (advertências, termos, notificações de ocorrência e conversas);
- a demonstração (RF027), que não tem as telas de aviso do supervisor.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `institutional-notices`: o requisito "Destinatários por critério" passa a dizer que os diálogos do aviso mostram só o grupo e a quantidade; novo requisito "Grupo gravado no rascunho".

## Impact

- **Frontend:**
  - `features/communications/notices-local.pages.ts` (`NoticeFormLocalPage` e `NoticeDetailLocalPage`);
  - `communications-local.models.ts` e `communications-local-api.service.ts` (campo `audienceLabel`);
  - `notices-local.pages.spec.ts`;
  - e2e `communications-local.spec.ts`.
- **Backend:**
  - `CommunicationService.createNotice` e `CommunicationModels.Notice`;
  - `CommunicationOpenApiConfiguration` (`audience` em `NoticeCreateRequest`);
  - `AuditResource` (campo `audience` de `NOTICE`);
  - testes `DisciplineApiIntegrationTest` e `ApiFoundationIntegrationTest`.
- **API:** `POST /api/v1/avisos` aceita `audience`, opcional; o aviso devolve `audienceLabel`, nulo nos antigos. Clientes que não mandam `audience` continuam funcionando.
- **Banco:** V39 cria `sager_notice.audience_label` (nulo) e libera o campo `audience` na auditoria de `NOTICE`.
- **Demonstração:** sem mudança; não há telas de aviso do supervisor nela, e `notices-demo.service.ts` serve só as comunicações do residente.
- **Documentação:** `docs/MANUAL.md` (Supervisor, item Avisos) e `docs/ARQUITETURA.md` (D18). `AGENTS.md` não muda: quem gerencia avisos e quem recebe seguem as mesmas regras.
