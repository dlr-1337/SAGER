## 1. Menu lateral

- [x] 1.1 Fazer as linhas da grade do menu do tamanho do conteúdo, com o nome flexível entre o ícone e o contador, e diminuir as margens de 801 a 1180 px em `app.scss`. Verificação: e2e da tarefa 1.2.
- [x] 1.2 Adicionar a `e2e/pending-badges.spec.ts` o teste "menu lateral com contadores não sobrepõe itens" em 1000×560, 820×600 e 1180×620. Ele confere que cada nome cabe no próprio item e que cada item começa depois do anterior. Verificação: `npx playwright test e2e/pending-badges.spec.ts` passa, e o mesmo teste falha com o CSS anterior.
- [x] 1.3 Formatar os arquivos tocados com prettier. Verificação: `npx prettier --check src/app/app.scss e2e/pending-badges.spec.ts`.
