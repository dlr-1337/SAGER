## Why

Quando o residente está fora com saída aprovada e partida registrada, o supervisor ainda precisa localizá-lo e clicar em "Ausência justificada". Isso é retrabalho e abre espaço para marcar "Ausente" por engano, o que gera análise disciplinar ao fechar.

## What Changes

- Ao abrir a chamada, quem tem exatamente uma saída autorizada e com partida física válida naquele instante já nasce marcado como ausência justificada, vinculada à saída.
- O histórico atribui a marcação ao sistema. O supervisor pode corrigir.
- A tela identifica a saída por tipo, com link, em vez de identificador técnico.

**Regra mantida de `AGENTS.md`:** exige autorização e partida física válidas na abertura. Aprovada sem partida registrada continua pendente, porque ninguém confirmou que a pessoa saiu. Se o supervisor esquecer de registrar a partida, a marcação não é automática.

**Fora do escopo:** saída iniciada depois da abertura; escrita do módulo de saídas na chamada; atualização da chamada quando a partida é registrada depois.

## Capabilities

### New Capabilities

- `night-call-justification`: justificativa automática de ausência a partir das saídas.

### Modified Capabilities

Nenhuma.

## Impact

- `NightCallService`, `NightCallRepository`, nova migration com CHECK de ator em `sager_night_call_mark_history`.
- `night-call-local.component.ts`, `operations-demo.service.ts`, testes.
- `AGENTS.md`, `docs/fase-3/README.md`, `docs/fase-7/MANUAL.md`, PRD (AC20).
