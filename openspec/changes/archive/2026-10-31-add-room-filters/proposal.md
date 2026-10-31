## Why

Os alojamentos têm muitas casas e blocos, cada um com vários quartos. Na chamada noturna o supervisor percorre todos os residentes do alojamento sem poder ir direto ao quarto. A mesma falta aparece nas saídas e na lista de limpeza, em que a escolha do quarto não acompanha o alojamento.

## What Changes

- Chamada noturna: filtros de casa ou bloco e de quarto, sem alterar resumo nem fechamento.
- Saídas curtas e longas: filtro de quarto para o supervisor, dependente do alojamento, com `roomId` no servidor.
- Lista de limpeza: filtro de alojamento, com quarto dependente, e `accommodationId` no servidor.
- Residentes na demonstração: quarto passa a depender do bloco (hoje mostra quartos de outros blocos).
- Chamada na demonstração: filtro de quarto dependente do bloco.
- O rótulo do quarto usa o código, porque o número pode se repetir dentro do alojamento (`V6__rooms.sql`).

**Fora do escopo, porque não faz sentido:** mapa de quartos (já é a lista, com busca), ranking (cada linha é um quarto), indicadores de limpeza, avisos, notificações e advertências (sem vínculo com alojamento), relatórios (já têm o filtro) e formulários de cadastro.

## Capabilities

### New Capabilities

- `room-filters`: filtragem por quarto, dependente de alojamento e bloco, nas telas operacionais.

### Modified Capabilities

Nenhuma.

## Impact

- Frontend: `night-call-local.component.ts`, `night-call.component.ts`, `exits-local.component.ts`, `cleaning-local.pages.ts`, `residents.component.ts`.
- Backend: chave `roomId` em `ShortExitRepository` e `LongExitRepository`; `accommodationId` em `CleaningController` e `CleaningService`.
- Sem migration. O residente continua limitado às próprias saídas.
