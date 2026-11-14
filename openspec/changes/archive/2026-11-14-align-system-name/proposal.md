# Proposal

## Why

A monografia chama o sistema de "Sistema de Apoio à Gestão de Residentes (SAGER)", e o README passou a usar esse nome no PR #30. A interface ainda mostra o nome antigo, "Sistema de Apoio à Gestão da Residência Estudantil": no cabeçalho das páginas internas e da página de acesso, nas metas de descrição e Open Graph do `index.html` e no subtítulo da prévia de link (`og-image.png`). A regra do dono é seguir sempre a monografia, então o nome exibido precisa ser o mesmo.

## What Changes

- `frontend/src/index.html`: as metas `description`, `og:description` e `og:image:alt` passam a dizer "Sistema de Apoio à Gestão de Residentes".
- `frontend/src/app/app.html` e `frontend/src/app/features/portal/portal.pages.ts`: o subtítulo do cabeçalho passa a ser "Sistema de Apoio à / Gestão de Residentes", com a quebra de linha que já existia.
- `frontend/scripts/generate-brand-assets.mjs`: o subtítulo da prévia de link usa o nome novo, e `frontend/public/og-image.png` é regerada pelo script, com o mesmo layout, cores e fonte.

## Capabilities

### New Capabilities

Nenhuma. O change só troca texto e imagem de identidade (`skip_specs: true`); nenhuma spec em `openspec/specs` cita o nome do sistema.

### Modified Capabilities

Nenhuma.

## Impact

- Regra do AGENTS.md afetada: "Coding Style & Naming Conventions" (preservar o design responsivo aprovado) e "Security & Demo Data" (manter a marca oficial do IF Goiano sem alteração). O cabeçalho mantém a marca oficial, e a imagem regerada não usa a marca do IF.
- Arquivos: `frontend/src/index.html`, `frontend/src/app/app.html`, `frontend/src/app/features/portal/portal.pages.ts`, `frontend/scripts/generate-brand-assets.mjs`, `frontend/public/og-image.png`.
- API, banco, migrações e permissões: nada muda.

## Fora do escopo

- O título da aba ("SAGER · Residência Estudantil | IF Goiano Campus Urutaí"), o `og:title` e o rodapé de produção ("Residência Estudantil"). Eles descrevem o setor atendido, não repetem o nome do sistema; mudar fica para uma decisão do dono.
- Os demais ícones gerados pelo mesmo script (favicon, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`), que não têm texto.
- O texto da monografia.
