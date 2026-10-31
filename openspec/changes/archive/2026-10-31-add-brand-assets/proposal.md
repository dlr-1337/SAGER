## Why

O favicon é o padrão do Angular, idêntico ao do template, e não há Open Graph, manifest nem ícones para celular. Um link do SAGER no WhatsApp aparece sem prévia.

## What Changes

- Novo símbolo SAGER em SVG: um S com telhado, próprio para aba, tela inicial e prévia de link.
- Ícones 32, 180, 192 e 512 e imagem de prévia 1200x630, gerados uma vez por script e versionados, com um manifest estático.
- Tags Open Graph e Twitter, com a origem resolvida em tempo de deploy pelo `sub_filter` do nginx, a partir de `SAGER_PUBLIC_HOST`.
- Tipo correto para `manifest.webmanifest` no nginx.

**Marca oficial:** o cabeçalho continua com a marca do IF Goiano, sem modificação. O símbolo novo não a usa e vale só onde ela não caberia (16 px). `DESIGN.md` registra essa exceção.

**Fora do escopo:** `robots.txt`, `noindex`, cache longo, service worker.

## Capabilities

### New Capabilities

- `brand-assets`: ícones e prévia de link do SAGER.

### Modified Capabilities

Nenhuma.

## Impact

`frontend/public/`, `frontend/src/index.html`, `frontend/scripts/`, nginx de produção e coolify, smokes, `DESIGN.md`.
