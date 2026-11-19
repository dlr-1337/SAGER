Comandos:

- **Backend**, em `backend/`: `.\mvnw.cmd -B -ntp -Dtest=CleaningReportsIntegrationTest,LongExitPdfGeneratorTest test`.
- **Frontend**, em `frontend/`:
  - `npx ng test --watch=false --include <spec>`;
  - `npx ng build`;
  - `SAGER_E2E_PORT=4332 CI=1 npx playwright test <arquivo> --workers=1`.

O modo demonstração (RF027) continua: não remover os ramos `session.active()` dos arquivos tocados.

## 1. Servidor

- [ ] 1.1 Em `ReportCatalog`, dar a cada relatório a própria lista de colunas (D1), calcular o resumo e o mês a mês só com as métricas do relatório (D2), ordenar a consulta do mais recente para o mais antigo e pelo nome do residente (D3) e passar o catálogo à versão 2 (D4). Em `ReportService`, gravar a versão do catálogo. Verificar com `CleaningReportsIntegrationTest`:
  - o catálogo de saídas e o de presença trazem só as suas colunas, e o consolidado traz as oito;
  - o resumo das saídas não tem `cleaningMean` e o da presença tem `unjustifiedAbsences`;
  - as linhas vêm da data mais recente para a mais antiga;
  - o relatório novo guarda `catalogVersion` 2.
- [ ] 1.2 Conferir que um relatório guardado na versão 1, com as oito colunas, o resumo completo e a ordem crescente, ainda exporta PDF e Excel e mantém o código de conferência. Verificar com o teste `snapshotStoredBeforeObjectiveColumnsStillExportsWithSameHash` de `CleaningReportsIntegrationTest`.

## 2. PDF em tabela

- [ ] 2.1 Em `PdfTextRenderer`, acrescentar o bloco de tabela, com cabeçalho repetido em cada página, largura pelo conteúdo e quebra de texto na célula, e a opção de página deitada, sem mudar os documentos atuais (D5). Verificar com `LongExitPdfGeneratorTest`:
  - uma tabela de 300 linhas ocupa várias páginas deitadas e repete o cabeçalho em cada uma;
  - um texto longo numa célula quebra sem sair da página;
  - a autorização de saída longa continua em A4 em pé.
- [ ] 2.2 Em `ReportExportWorker`, gerar o PDF em A4 deitado com "Resumo" (filtros, geração, total, métricas e contagem por situação), "Registros" em tabela e "Conferência" no fim. Verificar com `CleaningReportsIntegrationTest`: o PDF de limpeza traz o cabeçalho "Data Quarto Residente Nota Situação", a nota "8,00", as métricas e o código depois do último registro, sem UUID nem código interno.

## 3. Excel em tabela

- [ ] 3.1 Em `ReportExportWorker`, dar filtro automático, fundo e borda ao cabeçalho da aba "Resultados", largura de coluna pelo conteúdo e renomear a aba "Consulta" para "Resumo", com as métricas do relatório antes do código de conferência (D6). Verificar com `CleaningReportsIntegrationTest`: o cabeçalho da limpeza é exatamente "Data, Quarto, Residente, Nota, Situação", o filtro cobre o cabeçalho e as linhas, a primeira linha é a data mais recente, a aba "Resumo" traz "Nota média de limpeza" e o código na última linha, e o texto `=SUM(1,1)` continua texto.

## 4. Tela e demonstração

- [ ] 4.1 Em `features/reports`, mostrar no "Resumo do período" só as métricas que o resumo traz, a contagem por tipo só quando existir, e no "Mês a mês" os registros e a métrica do relatório. Ajustar o contrato em `reports-local-api.service.ts` e `reports-local.models.ts` e deixar `monthly-indicators.component.ts` receber as séries. Verificar com `npx ng test --watch=false --include src/app/features/reports/reports-local.utils.spec.ts --include src/app/features/reports/reports-local-api.service.spec.ts --include src/app/features/reports/reports-local.pages.spec.ts --include src/app/features/reports/reports.pages.spec.ts`. A evolução do residente, que usa as três listas padrão do mesmo componente, é conferida pelo e2e "indicadores reais apresentam três listas" da tarefa 4.3.
- [ ] 4.2 Em `reports-demo-api.service.ts`, usar as mesmas colunas e métricas por relatório e ordenar do mais recente para o mais antigo (D7). Verificar com `reports-local.utils.spec.ts` (demonstração das saídas sem `cleaningMean`, com "Tipo de saída", e consolidado em ordem decrescente).
- [ ] 4.3 Ajustar os e2e.
  - No modo real, o relatório de saídas mostra "Voltaram atrasados" e não mostra "Nota média de limpeza", "Nota" nem "Categoria". Verificar com `SAGER_E2E_PORT=4332 CI=1 npx playwright test e2e/cleaning-reports-local.spec.ts e2e/reports-mobile-dialog.spec.ts --workers=1`.
  - Na demonstração, o relatório de saídas mostra "Tipo de saída" e "Voltaram atrasados", sem "Nota média de limpeza", e a primeira linha é a mais recente. Verificar com `SAGER_E2E_PORT=4332 CI=1 npx playwright test e2e/journeys.spec.ts -g "relatório na demonstração" --workers=1`.

## 5. Documentação e verificação final

- [ ] 5.1 Em `docs/MANUAL.md`, item de relatórios do gestor, dizer que cada relatório mostra só o seu assunto, do mais recente ao mais antigo, e que o PDF e a planilha vêm em tabela. Em `docs/ARQUITETURA.md`, acrescentar ao D20 as colunas por relatório e a pendência do significado das colunas. Verificar com `grep -n "mais recente" docs/MANUAL.md` e `grep -n "D20" docs/ARQUITETURA.md`.
- [ ] 5.2 Rodar `npx ng build`, `npx prettier --check` nos arquivos tocados do frontend e `npx -y @fission-ai/openspec@2.0.0 validate objective-reports --strict`.
