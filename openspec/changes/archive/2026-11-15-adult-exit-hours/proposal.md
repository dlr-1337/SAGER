## Why

Na reunião de 14/11/2026, o dono e o coautor corrigiram o horário mostrado ao residente maior de idade. O certo é que ele pode sair do IF até 23h e voltar a partir das 6h. Hoje a página de início diz "Maiores de idade podem sair do IF até 23h e devem voltar até 5h." (requisito "Aviso de horário para o adulto" de `exit-eligibility`). Afeta só o texto do aviso; a regra do `AGENTS.md` de que o maior de idade não pede saídas continua.

## What Changes

- O aviso da página de início do residente maior de idade passa a ser "Maiores de idade podem sair do IF até 23h e voltar a partir das 6h."
- O e2e e o teste da página de início passam a conferir o texto novo.

**Fora do escopo:** controle de horário, registro de saída ou volta do maior de idade e qualquer bloqueio por horário; telas da demonstração, que não mostram o aviso; o texto da monografia, que o dono ajusta à parte.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `exit-eligibility`: texto do requisito "Aviso de horário para o adulto".

## Impact

- Frontend: `features/portal/local-home.page.ts`, `local-home.page.spec.ts` e e2e `operations-local.spec.ts`.
- Backend, API e banco: sem mudança.
- Monografia: o horário dos maiores de idade, se citado, precisa do mesmo ajuste.
