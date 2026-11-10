## Why

O dono do produto definiu que toda tela que filtra por local deve ter bloco e quarto. A change `add-room-filters` colocou casa ou bloco só na chamada noturna. Saídas, limpeza, residentes e relatórios têm alojamento e quarto, sem o bloco, e o formulário de limpeza lista todos os quartos soltos.

## What Changes

- Saídas, limpeza (lista e formulário), residentes e relatórios ganham "Casa ou bloco", entre alojamento e quarto.
- Filtro `unitId` no servidor onde a lista é paginada ou calculada lá.
- Sem alojamento escolhido, o nome do bloco vem acompanhado do alojamento, porque pode repetir.
- Em relatórios, consultas já guardadas continuam íntegras: `unitId` nulo não entra no hash.

**Fora do escopo:** ranking, indicadores, notificações, advertências e avisos, que não filtram por local.

## Capabilities

### New Capabilities

- `block-filters`: casa ou bloco em toda tela que filtra por quarto.

### Modified Capabilities

Nenhuma.

## Impact

- `ShortExitRepository`, `LongExitRepository`, `ResidentRepository`, `CleaningController`, `CleaningService`, `ReportModels`, `ReportService`, `ReportCatalog`, `ReportingOpenApiConfiguration`.
- `housing.models.ts` (helper), `exits-local`, `cleaning-local.pages`, `cleaning-form-local.page`, `residents.component`, `reports-local`.
- Depende de `simplify-report-generation` nos filtros de relatório.
