Comandos em `frontend/`: `npx ng test --watch=false --include <spec>`, `npx ng build` e `SAGER_E2E_PORT=4337 CI=1 npx playwright test <arquivos> --workers=1`. Sem backend, sem migração.

## 1. Varredura no celular

- [x] 1.1 Criar `e2e/mobile-fit.ts` com a medida do que vaza (design D1): rolagem horizontal da página, caixa com rolagem horizontal que não é tabela, elemento ou texto que passa da borda direita da tela ou do container e diálogo fora da altura da tela; e com `capture` para as capturas de antes e depois. Verificar com o teste "a varredura acha campo, texto e caixa que passam do card e da tela" de `e2e/mobile-fit.spec.ts`.
- [x] 1.2 Criar `e2e/mobile-fit.spec.ts`: demonstração com gestor, supervisor e residente, rotas do menu com detalhes e formulários, áreas recolhidas abertas e a gaveta do menu, em 360×740 e 320×568; e os diálogos e filtros da demonstração. Verificar com `SAGER_E2E_PORT=4337 CI=1 npx playwright test e2e/mobile-fit.spec.ts --workers=1`.
- [x] 1.3 Acrescentar a varredura das telas da conta nos e2e com API interceptada:
  - `e2e/operations-local.spec.ts`: chamada antes e depois de abrir, diálogo fora do horário (também em 360×600), lista e detalhe da saída e os diálogos de aprovar e rejeitar;
  - `e2e/communications-local.spec.ts`: notificação, diálogo de arquivar, advertências, reincidência, avisos com pessoas escolhidas, diálogo de salvar aviso e as comunicações do residente;
  - `e2e/cleaning-reports-local.spec.ts`: relatório com datas, filtros e detalhe da limpeza, os três passos da avaliação, correção, ranking, indicadores, consulta e "Minhas avaliações".
  - Verificar com `SAGER_E2E_PORT=4337 CI=1 npx playwright test e2e/operations-local.spec.ts e2e/communications-local.spec.ts e2e/cleaning-reports-local.spec.ts -g "no celular \(" --workers=1`.

## 2. Correções na raiz

- [x] 2.1 Em `src/styles.scss`, o grupo `.decision-actions` (design D2) e a caixa `.confirm-check` (design D4). Verificar com os e2e da 1.3.
- [x] 2.2 Botões de decisão no grupo, com a principal primeiro:
  - `features/communications/notifications-local.pages.ts` e `features/operations/notification-detail.component.ts` (demonstração);
  - `features/cleaning/cleaning-local.pages.ts` (detalhe da avaliação, com "Ver ranking deste período" fora do grupo);
  - `features/communications/notices-local.pages.ts`, `warnings-local.pages.ts` e `recurrence-local.pages.ts`.
  - Verificar com `e2e/communications-local.spec.ts` e `e2e/cleaning-reports-local.spec.ts` (ordem, largura e altura dos botões no celular e no computador) e com `npx ng test --watch=false --include src/app/features/communications/communications-detail-refresh.spec.ts --include src/app/features/cleaning/cleaning-local.pages.spec.ts --include src/app/features/communications/notices-local.pages.spec.ts`.
- [x] 2.3 Declaração dos diálogos em `.confirm-check`, com o texto num `span`: `features/operations/review-dialog-local.component.ts` e `features/communications/communications-local.shared.ts`. Verificar com `e2e/operations-local.spec.ts` (caixa com a largura, o recuo e o raio do aviso) e `npx ng test --watch=false --include src/app/features/operations/review-dialog-local.component.spec.ts --include src/app/features/communications/communications-local.shared.spec.ts`.
- [x] 2.4 Diálogos na altura visível e botões do diálogo no celular (design D5), em `src/styles.scss` e na coluna de `features/operations/review-dialog.component.ts` (demonstração). Verificar com `e2e/operations-local.spec.ts` em 360×600 e com a medida de altura dos diálogos da 1.2.
- [x] 2.5 Campos de data e hora (design D6) em `src/styles.scss`. Verificar com os filtros de data da 1.2 e da 1.3. O Safari do iPhone fica para conferir num aparelho.

## 3. Documentação e verificação final

- [x] 3.1 `docs/MANUAL.md`: uma frase sobre o celular na seção Acesso. Verificar lendo o trecho.
- [x] 3.2 Rodar `e2e/fixed-navigation.spec.ts`, `e2e/journeys.spec.ts` (com o axe), `npx ng build` e `npx -y @fission-ai/openspec@2.0.0 validate mobile-fit --strict`.
