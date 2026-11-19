Comandos:
- frontend, em `frontend/`: `npx ng test --watch=false --include <spec>`, `npx ng build` e `SAGER_E2E_PORT=4333 CI=1 npx playwright test <arquivo> --workers=1`;
- backend, em `backend/`: `./mvnw -B -ntp -Dtest=<Classe1,Classe2> test`, com Docker.

## 1. Confirmação do rascunho

- [x] 1.1 Em `NoticeFormLocalPage` (`notices-local.pages.ts`), deixar "Quem vai receber" com uma só linha: o grupo (D1) e a quantidade, sem nomes nem matrículas.

  Verificar com `notices-local.pages.spec.ts`:
  - "Todos os moradores" depois de desmarcar um: "Todos os moradores · 1 residente";
  - "Um alojamento": "Alojamento Um · 2 residentes";
  - "Um quarto": "Quarto U-101, Alojamento Um · 2 residentes";
  - nenhum nome nem matrícula no diálogo.

## 2. Grupo gravado no servidor

- [x] 2.1 Criar `V39__notice_audience_label.sql`: coluna `sager_notice.audience_label` (nula, até 500 caracteres) e o campo `audience` na auditoria de `NOTICE`. Em `CommunicationService.createNotice`, aceitar `audience` (D2), montar o grupo com os nomes cadastrados, gravá-lo e devolvê-lo em `audienceLabel`; em `AuditResource`, aceitar `audience`; na OpenAPI, descrever `audience`.

  Verificar com `./mvnw -B -ntp -Dtest=DisciplineApiIntegrationTest,ApiFoundationIntegrationTest test`:
  - cada opção grava o grupo de D1, inclusive o quarto com unidade;
  - a criação audita o campo `audience`;
  - o grupo continua o mesmo depois de publicar, corrigir e renomear o alojamento;
  - sem `audience`, `audienceLabel` vem nulo;
  - texto do grupo, campo a mais, opção desconhecida e alojamento ou quarto inexistente recebem 400, sem aviso criado;
  - a OpenAPI descreve `audience` com as seis opções, sem campo de texto.

## 3. Diálogos do aviso salvo

- [x] 3.1 Em `NoticeDetailLocalPage`, deixar "Quem vai receber" de "Revisar publicação", "Publicar correção" e "Retirar com justificativa" sem nomes, com o grupo e a quantidade. A página continua listando os nomes em "Quem recebe".
- [x] 3.2 No formulário, mandar `audience` com a opção e o lugar (`audienceInput`), nunca o texto. Nos diálogos do aviso salvo, usar `audienceLabel` e, sem ele, "Lista salva no rascunho" (D4).

  Verificar 3.1 e 3.2 com `notices-local.pages.spec.ts`:
  - `audienceInput` manda só a opção e o lugar que ela pede;
  - o formulário envia `audience` de cada opção;
  - com grupo gravado, publicação, correção e retirada mostram "Todos os moradores · 2 residentes", sem nomes;
  - sem grupo, mostram "Lista salva no rascunho · 2 residentes", e a página lista os dois nomes.

## 4. Jornadas no navegador

- [x] 4.1 Em `e2e/communications-local.spec.ts`, com a API simulada montando o grupo como o servidor:
  - cada opção de "Quem recebe?" confere o grupo no diálogo, sem nomes, envia `audience` e mostra o mesmo grupo em "Revisar publicação";
  - "Revisar publicação", "Publicar correção" e "Retirar com justificativa" mostram "Escolhidos um a um · 1 residente", sem o nome;
  - aviso antigo, sem grupo, mostra "Lista salva no rascunho · 2 residentes";
  - a página do aviso lista os nomes em "Quem recebe".

  Verificar com `SAGER_E2E_PORT=4333 CI=1 npx playwright test e2e/communications-local.spec.ts --workers=1 -g "aviso|quem recebe|receber|Escolher pessoas"`.

## 5. Documentação

- [x] 5.1 Em `docs/MANUAL.md` (Supervisor, item Avisos), dizer que as confirmações, inclusive "Revisar publicação", mostram o grupo e a quantidade, que os nomes ficam na página do aviso, em **Quem recebe**, e que aviso antigo mostra "Lista salva no rascunho". Em `docs/ARQUITETURA.md` (D18), registrar o grupo gravado (V39). Verificar lendo os trechos.

## 6. Verificação final

- [x] 6.1 Rodar `npx prettier --check` nos arquivos tocados do frontend, `npx ng build` e `npx -y @fission-ai/openspec@2.0.0 validate notice-recipient-summary --strict`.
- [x] 6.2 Rodar os testes do backend da tarefa 2.1 com Docker.
