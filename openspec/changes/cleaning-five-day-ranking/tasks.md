Comandos:

- **Backend** (em `backend/`): `.\mvnw.cmd -B -ntp -Dtest=CleaningReportsIntegrationTest test` (JDK 21 e Docker).
- **Frontend** (em `frontend/`):
  - `npx ng test --watch=false --include <spec>`;
  - `npx ng build`;
  - `SAGER_E2E_PORT=4334 CI=1 npx playwright test <arquivo> --workers=1`.

O modo demonstração (RF027) continua: não remover os ramos `session.active()` dos arquivos tocados.

## 1. Servidor

- [ ] 1.1 Criar o período `LAST_5_DAYS` e torná-lo o padrão.
  - Em `CleaningService.period`, aceitar `LAST_5_DAYS`: da referência menos 4 dias até a referência. A mensagem de período inválido cita os quatro valores.
  - Em `CleaningController`, usar `LAST_5_DAYS` quando `period` falta.
  - Atualizar a descrição do ranking em `ReportingOpenApiConfiguration`.
  - Verificar em `CleaningReportsIntegrationTest`:
    - o empate 1, 1, 3 e o quarto sem avaliação valem também para `LAST_5_DAYS`;
    - sem `period`, a resposta vem com `LAST_5_DAYS`, de 26/09/2026 a 30/09/2026;
    - nota de 9,00 em 30/09 e de 5,00 em 28/09 dão média 7,00;
    - nota de 25/09 fica fora da janela de 30/09;
    - `period=DAY` dá 400.
- [ ] 1.2 Tirar `assessmentCount` de `RankRow` e da projeção do residente.
  - Verificar em `CleaningReportsIntegrationTest` que nenhuma linha traz `assessmentCount`, para gestor ou residente.
- [ ] 1.3 Passar a devolutiva da avaliação para os últimos 5 dias terminados na data da avaliação, com o mapa da lista guardado por início da janela.
  - Verificar em `CleaningReportsIntegrationTest`, no teste da lista que reúne avaliações de janelas diferentes:
    - `rankingReference` vale `LAST_5_DAYS`, com `from` e `to` da janela;
    - média e posição são iguais às do ranking `LAST_5_DAYS` na data de cada avaliação, na lista da gestão e na do residente.
  - Rodar `.\mvnw.cmd -B -ntp -Dtest=CleaningReportsIntegrationTest test`.

## 2. Interface

- [ ] 2.1 Aceitar o período novo e a linha sem quantidade.
  - Em `cleaning-local.models.ts`, incluir `LAST_5_DAYS` em `RankingPeriod` e tirar `assessmentCount` de `CleaningRankRow`.
  - Em `cleaning-local.utils.ts`, dar o rótulo "Últimos 5 dias".
  - Em `cleaning-local-api.service.ts`, aceitar `LAST_5_DAYS` em `period` e tirar `assessmentCount` da conferência da linha e da projeção do residente.
  - Verificar em `cleaning-local-api.service.spec.ts`:
    - ranking e devolutiva com `LAST_5_DAYS` são aceitos;
    - período desconhecido é recusado;
    - nota de outro quarto na projeção do residente continua recusada.
- [ ] 2.2 Em `RankingLocalPage` (`cleaning-local.pages.ts`):
  - abrir em "Últimos 5 dias", com Semana, Mês e Semestre como opções, e aceitar `periodo=LAST_5_DAYS` no endereço;
  - com "Últimos 5 dias", o campo de data se chama "Último dia";
  - a linha mostra só o quarto, a posição e a nota, ou "Sem posição" e "Sem nota";
  - para o residente, o próprio quarto aparece só no topo, e a lista "Outros quartos" traz os demais, sem "Sua participação registrada neste período" e sem "Nota privada do quarto";
  - o "Saiba mais" explica a janela de 5 dias.
  - Verificar em `cleaning-local.pages.spec.ts`:
    - o primeiro pedido usa `LAST_5_DAYS`;
    - o título mostra "Últimos 5 dias" com as datas;
    - a linha não mostra quantidade de avaliações;
    - o residente vê o quarto dele uma vez, e a paginação conta só os outros quartos.
- [ ] 2.3 Na Ajuda (`portal.pages.ts`), dizer que o ranking abre com a média dos últimos 5 dias e que dia sem avaliação não conta. Verificar lendo a resposta "Como são calculados o ranking e os relatórios?" e com `npx ng build`.
- [ ] 2.4 Ajustar `e2e/cleaning-reports-local.spec.ts`: dados simulados sem `assessmentCount`, período padrão `LAST_5_DAYS`, "Sem nota", residente sem repetição e a paginação "1–25 de 29" na lista dos outros quartos.
  - Verificar com `SAGER_E2E_PORT=4334 CI=1 npx playwright test e2e/cleaning-reports-local.spec.ts --workers=1 -g "ranking|residente consulta"`.

## 3. Demonstração

- [ ] 3.1 Em `operations/ranking.component.ts`:
  - pôr "Últimos 5 dias" como primeira opção e padrão;
  - mostrar a nota ilustrativa com duas casas ao lado da posição, e para o residente só a do próprio quarto;
  - citar a média dos últimos 5 dias em "Como o ranking é calculado".
  - Verificar com `ranking.component.spec.ts` e com `e2e/journeys.spec.ts`:
    - "limpeza e ranking da demonstração descrevem a regra adotada com duas casas" confere "Últimos 5 dias" selecionado e a nota 8,50;
    - "telas no celular de 320 px sem rolagem horizontal da página" confere o ranking do residente sem rolagem lateral.

## 4. Documentação e validação

- [x] 4.1 Atualizar a documentação:
  - `docs/MANUAL.md`: Gestor, item 3; Residente, item 3; glossário, "Ranking";
  - `README.md`: linha da limpeza;
  - `docs/ARQUITETURA.md`: D10, com os últimos 5 dias como padrão;
  - `AGENTS.md`: o ranking abre nos últimos 5 dias.
  - Verificar com `grep -n "5 dias\|5 days" docs/MANUAL.md README.md docs/ARQUITETURA.md AGENTS.md`.
- [ ] 4.2 Rodar `npx ng build` e `npx @fission-ai/openspec@2.0.0 validate cleaning-five-day-ranking --strict`.
