## Context

Motivação em proposal.md. "Notificação" aparece em textos fixos do frontend: menu, início, lista, detalhe, mensagens, rótulos de histórico e Ajuda. Aparece também no nome do relatório, que o servidor devolve no catálogo e escreve no título do arquivo. As rotas e os códigos (`/notificacoes`, `NOTIFICACOES`, `sager_discipline_notification`) não aparecem para o usuário. As telas da demonstração têm componentes próprios em `features/operations` e `features/communications/notices.page.ts`.

## Goals / Non-Goals

**Goals:** o supervisor lê "notificação de ocorrência" em todo lugar do acesso por conta.

**Non-Goals:**

- Mudar rotas, códigos, API ou permissões.
- Mudar as telas próprias da demonstração.

## Decisions

### D1. Troca só do texto visível

Os rótulos mudam onde estão escritos. Rotas, códigos e nomes internos ficam, para não quebrar links salvos, relatórios já gerados nem a API.
*Rejeitada:* renomear rota e código para `notificacoes-de-ocorrencia`. Quebraria links e relatórios antigos sem ganho para o usuário.

### D2. O relatório de ocorrências mantém o nome

Só o relatório "Notificações" vira "Notificações de ocorrência".
*Rejeitada:* chamar os dois relatórios de "Notificações de ocorrência". A tela teria dois cartões com o mesmo nome.

### D3. Demonstração

As telas próprias da demonstração ficam como estão. O menu é comum e muda nos dois modos.
*Rejeitada:* criar um menu só para a demonstração com o nome antigo, que seria código a mais para manter um nome que a reunião trocou.

## O que a instituição e o operador ainda decidem

- Nada novo. O dono ajusta a monografia, que usa "notificação" no texto e nas figuras.
