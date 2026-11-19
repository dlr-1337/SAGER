## Why

Na reunião de 19/11/2026, o dono pediu relatórios objetivos e didáticos. Hoje todo relatório usa o mesmo resumo e as mesmas oito colunas:

- em "Saídas curtas e longas" e em "Presença", o "Resumo do período" traz "Nota média de limpeza", "Advertências ativas" e as demais métricas, que não são do assunto;
- nas saídas, as colunas "Nota" e "Categoria" aparecem como "Não informado" em todas as linhas;
- o "Mês a mês" de qualquer relatório mostra faltas, atrasos e advertências;
- os registros vêm do mais antigo para o mais recente;
- o PDF sai como texto corrido, duas linhas por registro, difícil de ler e de comparar.

O pedido toca três requisitos de `report-generation`: "Arquivo legível", o resumo e as colunas da tela de cada relatório e a ordem dos registros. O requisito "Demonstração com o mesmo fluxo" e a spec `demo-fidelity` pedem que a demonstração siga a mesma regra.

## What Changes

- **Só o assunto do relatório.** Cada relatório tem as próprias colunas e as próprias métricas do resumo. A tela, o PDF e o Excel mostram só elas:
  - "Presença" mostra as faltas sem justificativa;
  - "Saídas" mostra quem voltou atrasado e o tipo de saída (curta ou longa);
  - "Limpeza" mostra a nota e a nota média;
  - "Advertências" mostra as advertências ativas;
  - o "Consolidado administrativo" continua com todas as colunas e métricas.
- **Mês a mês** segue o assunto: o total de registros de cada mês e a métrica do relatório. O consolidado continua com faltas, atrasos e advertências.
- **Mais recentes primeiro.** A consulta grava os registros da data mais recente para a mais antiga e, no mesmo dia, pelo nome do residente. A tela, o PDF e o Excel seguem essa ordem.
- **PDF em tabela.** O PDF do relatório sai em A4 deitado, com cabeçalho de colunas repetido em cada página e uma linha por registro. O resumo, os filtros e o código de conferência continuam.
- **Excel em tabela.** A aba "Resultados" ganha filtro no cabeçalho e largura de coluna pelo conteúdo. A aba "Consulta" passa a se chamar "Resumo" e traz também as métricas do relatório.
- **Relatórios já gerados.** A versão do catálogo passa a 2. Um relatório gerado antes continua com as colunas, o resumo e a ordem que guardou, até expirar em 24 horas, e o código de conferência dele continua válido.
- **Demonstração.** Os dados fictícios usam as mesmas colunas, métricas e ordem.
- **Documentação.** `docs/MANUAL.md` (item de relatórios do gestor) e `docs/ARQUITETURA.md` (D20).

**Fora do escopo:**

- separar as saídas curtas e as longas em seções: o dono ainda não decidiu;
- o significado de cada coluna (por exemplo, qual data a coluna "Data" mostra em cada relatório): o grupo vai perguntar à servidora da AE;
- mudar os filtros, as situações do catálogo, os limites de período e de linhas, a validade de 24 horas ou as permissões;
- migrar ou alterar relatórios já gravados: eles são imutáveis;
- os outros documentos em PDF (autorização de saída longa e termo de compromisso), que continuam em texto.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `report-generation`: novos requisitos "Só o assunto do relatório" e "Mais recentes primeiro"; o requisito "Arquivo legível" passa a exigir a tabela no PDF e no Excel.

## Impact

- **Backend:**
  - `reports/ReportCatalog`: colunas e métricas por relatório, ordem decrescente, versão 2 do catálogo;
  - `reports/ReportService`: grava a versão do catálogo;
  - `reports/ReportExportWorker`: PDF em tabela, Excel com filtro, resumo com as métricas do relatório;
  - `documents/PdfTextRenderer`: bloco de tabela e página deitada, sem mudar os documentos que já usam o renderizador;
  - testes `reports/CleaningReportsIntegrationTest` e `documents/LongExitPdfGeneratorTest`.
- **Frontend:**
  - `features/reports`: resumo, "Mês a mês" e contrato pelo que o relatório traz;
  - `reports-demo-api.service.ts`: mesmas colunas, métricas e ordem;
  - `features/cleaning/monthly-indicators.component.ts`: séries escolhidas por quem usa;
  - specs unitários e e2e `cleaning-reports-local.spec.ts` e `reports-mobile-dialog.spec.ts`.
- **Banco:** sem migração. A coluna `catalog_version` já existe e não tem restrição de valor.
- **API:** mesmas rotas. O catálogo e os relatórios novos trazem menos colunas, e o resumo traz só as métricas do relatório.
