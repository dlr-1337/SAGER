## 1. Regras puras

- [x] 1.1 Extrair `periodError` e a sugestão de retorno para `operations-local.utils.ts` e `long-exit.utils.ts`; verificar com limites em spec: curta 1 min e 3 h aceitos, 3 h 01 recusado; longa 3 h recusado, 3 h 01 e 30 dias aceitos.
- [x] 1.2 Criar relógio derivado do servidor com `performance.now()`; verificar com timers falsos.
- [x] 1.3 Alinhar a saída longa ao backend, recusando partida igual a agora; verificar em `long-exit.utils.spec.ts`.

## 2. Formulários

- [x] 2.1 Aplicar sugestão, preservação e aviso em `exit-form-local.component.ts`; verificar com spec de componente novo.
- [x] 2.2 Aplicar o mesmo em `long-exit-form.component.ts`, removendo o arredondamento da partida; verificar com spec de componente novo.
- [x] 2.3 Adicionar `min`, `max` e duração, em horário de São Paulo; verificar com navegador em outro fuso no spec.
- [x] 2.4 Recalcular no envio apenas o retorno não editado no modo "Agora"; verificar nos specs de componente.
- [x] 2.5 Trocar o bloqueio por 409 genérico pelo teste de `stale_version`; verificar que `overlapping_exit` não trava.

## 3. Demonstração

- [x] 3.1 Aplicar as regras em `exit-form.component.ts`, sugerir +4 h na longa e validar duração em `operations-demo.service.ts`; verificar em `operations-demo.service.spec.ts`.

## 4. Jornada e documentação

- [x] 4.1 Cobrir retorno manual preservado e "Agendar" sem partida preenchida em `e2e/operations-local.spec.ts`, com horário de servidor contendo segundos; verificar com `npm run test:e2e`.
- [x] 4.2 Cobrir saída longa agendada em `e2e/long-exits-local.spec.ts`; verificar com `npm run test:e2e`.
- [x] 4.3 Atualizar `SAGER_PRD_v2.0_Angular_SpringBoot.md:331`; verificar por leitura.
