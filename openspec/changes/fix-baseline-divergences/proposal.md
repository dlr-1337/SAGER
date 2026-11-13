# Proposal

## Why

A conferência das specs base (`document-core-baseline`, arquivada em 13/11/2026, design.md, "Divergências e lacunas") achou pontos em que o código contradiz a spec. Os itens 11, 13, 14 e 15 são erros de código, sem decisão pendente da instituição, e a banca vai comparar as telas e a demonstração (RF027) com a monografia. Por isso a correção entra agora.

## What Changes

- **Nome da conta acompanha a edição do residente** (item 11; RF002, cap4.tex:108; V22, cap. 5). Hoje `ResidentService.update` só leva a matrícula para a conta vinculada. Depois de editar o nome, `GET /api/v1/auth/me` continua devolvendo o nome antigo, e a interface do residente mostra esse nome. A edição passa a gravar o mesmo nome capitalizado na conta, na mesma transação, sem encerrar a sessão do residente. A auditoria continua com o evento da edição do residente, com o campo `name`. Isso estende `resident-registry`, "Nome do residente com iniciais maiúsculas", que hoje só fixa o nome igual na criação.
- **429 da recuperação de senha com o corpo de erro padrão** (item 13; RNF de segurança, cap4.tex:199; erros padronizados, cap5.tex:25). Hoje, acima do limite, `POST /api/v1/auth/recover` devolve 429 só com `Retry-After`, sem corpo (`ResidentRecoveryController.java:18`). Passa a devolver código `rate_limited`, mensagem e identificador da requisição, como o 429 do login (`LoginRateLimitFilter.java:30`), mantendo `Retry-After: 900` e `Cache-Control: no-store`. Cumpre `access-control`, "Erros sem detalhes internos".
- **Demonstração não começa com a conta possivelmente aberta e o servidor sem resposta** (item 14; RF027, cap4.tex:133). Hoje, se a consulta da sessão falha por rede ou erro do servidor, a página trata a falha como "sem sessão" (`local-auth.service.ts:69-82`) e começa a demonstração com o cookie da conta talvez aberto (`demo-entry.service.ts:43-51`), contra o cenário "Falha ao sair da conta" de `demo-mode`. Passa a recusar a entrada e pedir para tentar de novo quando esta aba conhece a conta ou quando uma conta entrou neste navegador e não saiu. Sem sessão (401), ou sem conta conhecida, a demonstração continua entrando sem pedir mais nada ao servidor, inclusive com a API fora do ar.
- **Guia Comunicações leva o supervisor à tela dele também na demonstração** (item 15; RF026, cap4.tex:132; tabela de permissões). Hoje, na demonstração, o guia aponta para `/avisos` (`portal.pages.ts:1091-1099`), rota só do residente (`app.routes.ts:131-133`), e o supervisor cai no acesso negado. Passa a apontar para `/comunicacoes/avisos`, como no acesso por conta. Os outros guias da ajuda dos três perfis na demonstração foram conferidos contra `app.routes.ts` e estão certos; um teste passa a conferir todos.

Fora do escopo:
- Divergências 2 (ajuda do visitante sem sessão), 5 (reincidência com revisão de origem pendente), 10 (telefone do responsável), 12 (texto da mensagem ao responsável) e 16 (cancelamento por quem fez 18 anos): dependem de decisão da instituição.
- Nome da conta do supervisor: `SupervisorService.update` também só leva a identificação para a conta. Não está na lista de divergências e fica para uma change própria.
- Nova tela de avisos na demonstração do supervisor: `/comunicacoes/avisos` continua dizendo que não faz parte da demonstração, e o menu da demonstração do supervisor continua sem esse item.
- Números do limite de recuperação (5 por matrícula e 20 por endereço IP): continuam só no código (divergência 6).
- O modo demonstração (RF027) continua. Nenhum ramo `session.active()` nem `*-demo.service` é removido.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `resident-registry`: "Nome do residente com iniciais maiúsculas" passa a valer também na edição, para a conta vinculada (item 11).
- `access-control`: "Erros sem detalhes internos" ganha o cenário do 429 da recuperação de senha (item 13).
- `demo-mode`: "Entrada pela escolha de um perfil" passa a dizer quando a falha do servidor impede a demonstração e quando não impede (item 14).
- `help-center`: "Guias do perfil em uso" ganha os cenários do supervisor na demonstração e de nenhum guia levar ao acesso negado (item 15).

## Impact

- Backend: `management/residents/ResidentService.java`, `auth/LocalAccountProvisioningService.java`, `auth/LocalAccountRepository.java`, `auth/ResidentRecoveryController.java`. Testes: `management/residents/ResidentApiIntegrationTest.java`.
- Frontend: `core/local-auth.service.ts`, `features/portal/demo-entry.service.ts`, `features/portal/portal.pages.ts` (HelpPage). Testes: `core/local-auth.service.spec.ts`, `features/portal/demo-entry.service.spec.ts` (novo), `features/portal/portal.pages.spec.ts`, `e2e/local-auth.spec.ts`, `e2e/route-audit.spec.ts`.
- API: o 429 de `POST /api/v1/auth/recover` passa a ter corpo JSON. `GET /api/v1/auth/me` passa a devolver o nome editado. Nenhuma rota nova e nenhuma migração.
- Navegador: uma chave nova no `localStorage`, `sager.account`, sem dado pessoal, presente entre a entrada por login e a saída ou um 401.
