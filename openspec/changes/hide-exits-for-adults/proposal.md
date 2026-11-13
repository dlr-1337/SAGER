## Why

O servidor já recusa pedidos de saída de residentes maiores de idade (409 `not_eligible`), mas a interface não sabe a idade da conta: o menu, o início e a ajuda oferecem "Minhas saídas" a todo residente, e o adulto só descobre o bloqueio ao abrir o formulário. A regra de horário dos maiores de idade também não aparece em lugar nenhum.

## What Changes

- `GET /api/v1/auth/me` passa a devolver `maiorDeIdade`: verdadeiro só quando a conta está vinculada a um residente com data de nascimento que o servidor não considera menor de idade na data civil de America/Sao_Paulo. Sem data, vale falso.
- O residente maior de idade não vê "Minhas saídas" no menu, no início nem na ajuda.
- Os endereços de pedido e de edição (`/saidas/nova`, `/saidas/:id/editar`, `/saidas/longas/nova` e `/saidas/longas/:id/editar`) levam o adulto ao acesso negado.
- A lista `/saidas` e os detalhes (`/saidas/:id`, `/saidas/longas/:id`) continuam abertos ao adulto pelo endereço, só para leitura: sem os botões de pedir, mudar ou cancelar. Ele continua vendo a decisão das saídas que pediu quando era menor.
- O início do adulto mostra o aviso "Maiores de idade podem sair do IF até 23h e devem voltar até 5h." Só informação: o sistema não registra a circulação de adultos.
- A recusa do servidor não muda. Entram os testes que faltam: saída longa com residente adulto e o limite exato do aniversário de 18 anos nos dois tipos de saída.
- A regra de menoridade passa a existir num único ponto do servidor, usado pela elegibilidade das saídas, pela chamada noturna e por `/auth/me`. O comportamento da chamada noturna não muda.

Referências (monografia, versão de 10/11/2026):
- RN02 (cap4:157): só o residente menor de 18 anos, com data de nascimento e alocação ativa, solicita saída.
- Perfil Residente (cap4:56) e tabela de permissões (cap4:77): o residente solicita, edita e cancela as próprias saídas "se menor de idade". RF007 (cap4:113).
- UC07, pós-condição (cap4:351): depois da decisão, o residente passa a ver a nova situação. Por isso a lista e o detalhe continuam abertos ao adulto.
- Restrições (cap4:218): datas civis e idade são calculadas em America/Sao_Paulo, com o relógio do servidor.
- Navegação (cap6:61): a guarda de rota só orienta a navegação; a autorização efetiva é feita pelo back-end.
- AGENTS.md, "Current Domain Decisions": "Operations are supervisor-only except the minor resident's own linked exit requests" (frase já atualizada pela clean-up-documentation).

Fora do escopo:
- Registrar ou controlar a saída e a volta de adultos (portaria, catraca, horário de recolher). Nenhum requisito da monografia (RF001 a RF027) cobre isso; o aviso é só texto.
- Mudar as APIs de saída: elas continuam listando as saídas próprias do adulto e aceitando o cancelamento pelo próprio residente. Só a interface do adulto deixa de oferecer pedir, mudar e cancelar.
- Tratar pedidos pendentes ou aprovados de quem faz 18 anos no meio do processo (continuam expirando como hoje, RN08).
- Filtro de alojamentos da chamada noturna por faixa etária (fica na add-accommodation-age-group).
- Modo demonstração: não muda (RF027). A residente fictícia Ana Luísa Ribeiro (nascida em 14/06/2009) é menor e continua vendo "Minhas saídas" e os botões de pedido, como na Figura 6.6 (cap7:108).
- Módulo de saúde: sai na remove-health-module, aplicada antes desta.

## Capabilities

### New Capabilities
- `exit-eligibility`: quem pode pedir saída (só o residente menor de idade com data de nascimento e alocação), como a conta informa a maioridade, o que o residente adulto vê (aviso de horário e consulta das próprias saídas só para leitura) e a recusa do servidor.

### Modified Capabilities
- `plain-language`: o cenário "Residente nas saídas" passa a valer só para o residente que pode pedir saída; o adulto vê a lista sem os botões de pedido (D4).

## Impact

- Backend: `auth/AuthController.java` (campo novo em `MeResponse`), `auth/LocalAccountRepository.java` (data de nascimento do residente vinculado), `management/FieldRules.java` (regra de menoridade), `operations/OperationResidents.java` e `operations/nightcalls/NightCallService.java` (passam a usar a regra única).
- API: `GET /api/v1/auth/me` ganha um campo booleano. Mudança aditiva; clientes antigos ignoram o campo.
- Frontend: `core/local-auth.service.ts`, `app.ts` (menu), `app.routes.ts` (guarda das rotas de pedido e edição), `features/operations/exits-local.component.ts` (botões de pedido), `features/operations/exit-detail-local.component.ts` e `features/operations/long-exit-detail.component.ts` (mudar e cancelar), `features/portal/local-home.page.ts` (início) e `features/portal/portal.pages.ts` (ajuda). Os ramos da demonstração não mudam.
- Testes: `FieldRulesTest`, `LocalAccountLinksIntegrationTest`, `OperationsApiIntegrationTest`, `LongExitApiIntegrationTest`, specs Vitest do menu, das rotas, do serviço de autenticação, da lista de saídas, do início e da ajuda, `e2e/operations-local.spec.ts` e `e2e/long-exits-local.spec.ts`. `exits-local.component.ts`, `exits-local.component.spec.ts` e esses dois e2e também são editados pela simplify-long-lists, da mesma onda (ordem em tasks.md). A demonstração é conferida com `e2e/route-audit.spec.ts` e `e2e/journeys.spec.ts`, sem mudança.
- Documentação: nenhuma no repositório (o AGENTS.md já traz a regra). O texto da monografia fica para depois da confirmação da AE (tasks.md, "Workflow follow-up").
- Sem migração e sem dado novo no banco.
