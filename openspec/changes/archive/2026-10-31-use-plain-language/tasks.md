## 1. Textos

- [x] 1.1 Remover texto de teste do modo real (`audit.md`, item 1); verificar por busca por "fictíc", "backend" e "ambiente local" em `src/app`, e com specs.
- [x] 1.2 Remover identificadores técnicos e aplicar o glossário em chamada, limpeza, avisos, notificações e perfil (itens 7, 8, 15, 16, 19, 21, 24, 25); verificar com specs e busca.
- [x] 1.3 Simplificar pedidos de saída e mensagens de bloqueio (itens 10, 11, 12, 13); verificar em `e2e/operations-local.spec.ts` e `long-exits-local.spec.ts`.
- [x] 1.4 Reescrever mensagens de erro (item 14); verificar com specs dos serviços.
- [x] 1.5 Simplificar início e recuperação de senha (itens 17, 23); verificar em `local-auth.spec.ts`.

## 2. Legibilidade

- [x] 2.1 Aumentar texto e caixas de seleção (item 22), e corrigir quebra de palavra em tabelas (item 6); verificar com capturas em 320 px e `visual-review.spec.ts`.

## 3. Verificação

- [x] 3.1 Rodar a suíte inteira do frontend e corrigir o que depender de texto antigo; verificar com `npm test -- --watch=false` e `npm run test:e2e`.
