## Why

Ao informar a saída, o formulário recalcula o retorno previsto e apaga o que o residente digitou, sem avisar. O valor escolhido some até ao ajustar um único minuto da partida. A partida agendada padrão nasce no passado, o modo "Agora" usa um horário desatualizado, e os limites só aparecem depois do envio.

O preenchimento automático continua: o PRD exige a sugestão inicial de +3 h (PRD:331 e AC22). O que muda é respeitar a edição manual, o que ajusta a redação de PRD:331 ("recalculado quando a saída é alterada").

## What Changes

- O retorno é sugerido enquanto o residente não o editou (+3 h na curta, +4 h na longa).
- Uma edição manual válida sobrevive a mudanças na partida e no modo.
- Uma edição que ficou fora do limite é substituída pela sugestão, com aviso anunciado por leitor de tela.
- O formulário usa o tempo do servidor mais o tempo decorrido, em vez de um horário congelado no carregamento.
- A partida agendada começa vazia, salvo ao editar pedido já agendado.
- Os campos de data trazem `min` e `max`, e a tela mostra a duração e o limite enquanto o residente preenche.
- No modo "Agora", um retorno não editado é recalculado no envio. Retorno manual nunca é recalculado.
- Conflito `overlapping_exit` deixa de travar o formulário; só `stale_version` trava.
- A demonstração recebe as mesmas regras e passa a recusar saída longa de até 3 h.

**Fora do escopo:** botões de duração, temporizador ao vivo, máximo para saída longa, mudança nas regras do backend.

## Capabilities

### New Capabilities

- `exit-scheduling`: como os horários de saída e retorno são sugeridos, preservados e limitados nos formulários de saída curta e longa.

### Modified Capabilities

Nenhuma.

## Impact

- `frontend/src/app/features/operations/`: `exit-form-local.component.ts`, `long-exit-form.component.ts`, `exit-form.component.ts`, `operations-local.utils.ts`, `long-exit.utils.ts`, `operations-demo.service.ts`, e seus testes.
- `SAGER_PRD_v2.0_Angular_SpringBoot.md:331`: nova redação.
- A decisão D03 do PRD (recalcular no envio) segue vinculada à instituição; esta change adota uma das opções listadas.
