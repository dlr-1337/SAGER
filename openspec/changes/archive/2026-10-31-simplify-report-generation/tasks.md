## 1. Backend

- [x] 1.1 Criar `GET /api/v1/relatorios/consultas`, sem `rows`, limitado ao dono e aos válidos; verificar em `CleaningReportsIntegrationTest` com outro usuário.
- [x] 1.2 Permitir nova tentativa de arquivo com falha; verificar com job em `FAILED`.
- [x] 1.3 Ajustar renderização em `ReportExportWorker`, sem alterar o hash do snapshot; verificar lendo PDF e XLSX em teste, inclusive `=SUM` como texto.
- [x] 1.4 Atualizar OpenAPI; verificar em `ApiFoundationIntegrationTest`.

## 2. Frontend

- [x] 2.1 Reescrever `ReportsLocalPage` com cartões, períodos, geração e lista, com `intent.reset()` após sucesso; verificar em `e2e/cleaning-reports-local.spec.ts`.
- [x] 2.2 Implementar consulta automática só com preparo em andamento; verificar com timers falsos.
- [x] 2.3 Mover o baixar ao topo no detalhe e tirar jargão; verificar com captura.
- [x] 2.4 Criar serviço demo e remover a tela antiga; verificar em `reports.pages.spec.ts` e `reports-mobile-dialog.spec.ts`.
- [x] 2.5 Atualizar atalhos para "Gerar relatório"; verificar por busca.

## 3. Documentação

- [x] 3.1 Atualizar `docs/fase-6/README.md` e `CONTRATO.md`; verificar por leitura.
