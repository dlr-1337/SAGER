## Why

O servidor já recusa pedidos de saída de residentes maiores de idade (409 `not_eligible`), mas a interface não sabe a idade da conta: o menu, o início e a ajuda oferecem "Minhas saídas" a todo residente, e o adulto só descobre o bloqueio ao abrir o formulário. A regra de horário dos maiores de idade também não aparece em lugar nenhum.

## What Changes

- `GET /api/v1/auth/me` passa a devolver `maiorDeIdade`: verdadeiro só quando a conta está vinculada a um residente com data de nascimento e 18 anos completos na data civil de America/Sao_Paulo. Sem data, vale falso.
- O residente maior de idade não vê "Minhas saídas" no menu, no início nem na ajuda. Qualquer URL de saída (`/saidas`, `/saidas/nova`, `/saidas/:id`, `/saidas/longas/...`) leva ao acesso negado. As saídas antigas do adulto deixam de aparecer junto com o menu.
- O início do adulto mostra o aviso "Maiores de idade podem sair do IF até 23h e devem voltar até 5h." Só informação: o sistema não registra a circulação de adultos.
- A recusa do servidor não muda. Entram os testes que faltam: saída longa com residente adulto e o limite exato do aniversário de 18 anos nos dois tipos de saída.
- A regra de menoridade passa a existir num único ponto do servidor, usado pela elegibilidade das saídas, pela chamada noturna e por `/auth/me`. O comportamento da chamada noturna não muda.
- AGENTS.md: a exceção das operações passa a dizer "the minor resident's own linked exit requests".

Referências: SAGER_PRD_v2.0 (linha 75: as saídas formais valem para residentes menores de idade; linha 99: o residente pede saída "quando menor de idade"; linha 81: o controle de saídas de maiores de idade fica fora do escopo). AGENTS.md, seção "Current Domain Decisions": "Operations are supervisor-only except the resident's own linked exit requests". O PRD sai do repositório na clean-up-documentation e continua no histórico do git.

Fora do escopo:
- Registrar ou controlar a saída e a volta de adultos (portaria, catraca, horário de recolher). O aviso é só texto.
- Mudar o que o servidor responde nas listas de saídas do adulto (a API continua listando as saídas próprias; só a interface deixa de mostrá-las).
- Tratar pedidos pendentes ou aprovados de quem faz 18 anos no meio do processo (continuam expirando como hoje).
- Filtro de alojamentos da chamada noturna por faixa etária (fica na add-accommodation-age-group).
- Modo demonstração e módulo de saúde (saem nas changes remove-demo-mode e remove-health-module, antes desta).

## Capabilities

### New Capabilities
- `exit-eligibility`: quem pode pedir saída (só o residente menor de idade com data de nascimento e alocação), como a conta informa a maioridade, o que o residente adulto vê no lugar das saídas e a recusa do servidor.

### Modified Capabilities
(nenhuma)

## Impact

- Backend: `auth/AuthController.java` (campo novo em `MeResponse`), `auth/LocalAccountRepository.java` (data de nascimento do residente vinculado), `management/FieldRules.java` (regra de menoridade), `operations/OperationResidents.java` e `operations/nightcalls/NightCallService.java` (passam a usar a regra única).
- API: `GET /api/v1/auth/me` ganha um campo booleano. Mudança aditiva; clientes antigos ignoram o campo.
- Frontend: `core/local-auth.service.ts`, `app.ts` (menu), `app.routes.ts` (guarda das rotas de saída), `features/portal/local-home.page.ts` (início) e `features/portal/portal.pages.ts` (ajuda).
- Testes: `FieldRulesTest`, `LocalAccountLinksIntegrationTest`, `OperationsApiIntegrationTest`, `LongExitApiIntegrationTest`, specs Vitest do menu, das rotas, do serviço de autenticação, do início e da ajuda, e `e2e/operations-local.spec.ts`.
- Documentação: AGENTS.md (uma frase).
- Sem migração e sem dado novo no banco.
