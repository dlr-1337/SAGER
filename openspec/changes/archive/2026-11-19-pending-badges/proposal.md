## Why

Na reunião de 19/11/2026, o dono pediu um sinal no menu para o que espera alguém: "se o supervisor tiver chamadas noturnas para aprovar ou avaliação de limpeza para fazer, ou alguma nova conversa ou alguma advertência, mostra um ícone" e, "no residente, alguma comunicação para ele ou alguma advertência, já aparece que tem alguma coisa naquela aba". Hoje o supervisor só descobre um pedido de saída, uma notificação de ocorrência ou uma mensagem do responsável abrindo cada tela, e o residente só vê um aviso novo entrando em "Minhas comunicações".

A mudança se apoia nas regras do `AGENTS.md` (operações e disciplina só do supervisor; residente lê e dá ciência só do que é seu; conversas só do supervisor; gestor sem acesso a operações, disciplina e conversas) e em `auto-refresh` (consulta só com a aba visível, pausa depois de 30 minutos e sem manter a sessão).

## What Changes

- Contador numérico nos itens do menu lateral e da gaveta do celular:
  - supervisor: "Saídas e retornos", "Notificações de ocorrência", "Chamada noturna" e "Conversas";
  - residente: "Minhas comunicações" (na demonstração, "Avisos e advertências").
- Contador nas abas "Saídas curtas" e "Saídas longas" do supervisor e "Avisos", "Advertências" e "Termos de compromisso" do residente.
- O botão "Menu" do celular mostra a soma, lida como descrição; o nome continua "Menu".
- O leitor de tela lê "N pendentes" junto do nome do item; zero não mostra nada.
- Nova consulta `GET /api/v1/me/pendencias`, só para supervisor e residente, com um número por item, sem cache e sem marcar nada como lido.
- A contagem é buscada ao entrar, a cada troca de tela, logo depois de uma gravação e a cada 30 segundos com a aba visível. Ela para depois de 30 minutos sem interação e não renova a sessão.
- Na demonstração (RF027), os números vêm dos dados fictícios em memória, sem chamar a API.
- Nova capability `pending-badges`. `simple-screens`, `auto-refresh` e `demo-mode` não mudam.

**Fora do escopo:**
- contador de limpeza, ranking, cadastros, relatórios, advertências e avisos do supervisor, e saídas do residente (motivo em design.md);
- notificação push, som, e-mail ou mensagem;
- marcar como lido pelo menu;
- leitura de conversa por supervisor (a conversa tem uma só marca de leitura, compartilhada);
- migração de banco: os dados já existem.

## Capabilities

### New Capabilities

- `pending-badges`: contadores do que espera ação ou leitura no menu, no botão "Menu" e nas abas, com a contagem pelo servidor e na demonstração.

### Modified Capabilities

Nenhuma.

## Impact

- Backend:
  - pacote novo `pending` (`PendingController`, `PendingService`);
  - regra de acesso em `SecurityConfiguration`;
  - `springdoc.packages-to-scan` em `application-local.yml`;
  - testes `PendingApiIntegrationTest`, `AuthFlowIntegrationTest` (perfil fechado) e `ApiFoundationIntegrationTest` (OpenAPI).
- Frontend:
  - `core/pending-badges.service.ts`, `shared/pending-badge.component.ts` e `features/portal/pending-badges-demo.ts`;
  - aviso de gravação em `core/api.ts`;
  - shell (`app.html`, `app.ts`, `app.scss`);
  - abas em `exits-local.component.ts`, `own-communications-local.pages.ts` e `notices.page.ts`;
  - testes unitários e o e2e `pending-badges.spec.ts`.
- Banco: sem migração.
- Documentação: `docs/MANUAL.md` e `docs/ARQUITETURA.md`.
- Monografia: se citar o menu, o contador pode entrar como melhoria pedida em 19/11.
