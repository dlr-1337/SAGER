# Tasks

## 1. Texto da interface

- [x] 1.1 Em `frontend/src/index.html`, `frontend/src/app/app.html` e `frontend/src/app/features/portal/portal.pages.ts`, trocar o nome antigo pelo da monografia (decisão 1 de design.md). Verificar: `grep -rn -E "Gestão da( |<br />)Residência|Gestão da<br />" frontend/src frontend/scripts` não acha nada; `npm run build` e `npm test -- --watch=false` passam em `frontend/`.

## 2. Prévia de link

- [x] 2.1 Em `frontend/scripts/generate-brand-assets.mjs`, trocar o subtítulo e rodar `node scripts/generate-brand-assets.mjs` em `frontend/`; versionar só `public/og-image.png` (decisão 2). Verificar: a imagem tem 1200x630 e mostra "Sistema de Apoio à Gestão de Residentes"; `git status` não lista outros ícones alterados; `npx playwright test e2e/brand-assets.spec.ts` passa.

## 3. Validação

- [x] 3.1 Verificar: `npx -y @fission-ai/openspec@2.0.0 validate --all --strict` passa.
