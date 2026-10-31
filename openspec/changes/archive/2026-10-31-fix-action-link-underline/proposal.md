## Why

Links de ação com seta aparecem sublinhados em repouso, e o traço passa também por baixo do ícone. Eles já são identificados pelo ícone, pelo peso e pela posição, e os demais links com seta do sistema (`.mg-row-link` e os links de voltar) só sublinham ao passar o mouse.

## What Changes

- `.op-row-link`, `.op-inline-link` e `.aside-block a` deixam de ser sublinhados em repouso e passam a sublinhar no hover.
- Links dentro de texto continuam sublinhados, pois dependem disso para não serem identificados só pela cor (WCAG 1.4.1 e `DESIGN.md:12`).
- A regra fica registrada em `DESIGN.md`.

**Fora do escopo:** remover o sublinhado de todos os links, e mudar o hover existente.

## Capabilities

### New Capabilities

- `action-links`: aparência de links de ação com ícone em comparação com links dentro de texto.

### Modified Capabilities

Nenhuma.

## Impact

- `frontend/src/app/features/operations/operations.scss`, `frontend/src/app/features/portal/portal.pages.ts`, `DESIGN.md`.
- 13 links afetados: 9 `.op-row-link`, 1 `.op-inline-link` e 3 `.aside-block a`.
