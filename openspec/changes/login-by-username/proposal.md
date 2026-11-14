## Why

O dono do produto pediu que a página de acesso peça "Usuário", e não "Matrícula", porque gestor e supervisor não têm matrícula. Hoje o campo, o subtítulo, as mensagens de erro, a ajuda e o cadastro do supervisor chamam de matrícula o identificador de login de todos os perfis, o que confunde quem não é residente. Afeta o requisito "Login por matrícula e senha" de `access-control` (RF001, UC01) e a regra "All roles log in with enrollment" do `AGENTS.md`, que continua valendo para o dado guardado.

## What Changes

- O identificador de login passa a se chamar "Usuário" em toda tela e mensagem que vale para qualquer perfil ou para gestor e supervisor: rótulo e subtítulo do login, mensagens de campo vazio e de credenciais erradas, ajuda "Usar sua conta SAGER" e resumo da rota de login na documentação da API.
- No login, um texto curto ligado ao campo diz ao residente que o usuário dele é a matrícula.
- O 401 do login passa a dizer "Usuário ou senha inválidos.", a mesma mensagem para conta inexistente, inativa ou senha errada.
- No cadastro, na edição, no detalhe e na busca de supervisores, "Matrícula ou SIAPE" vira "Usuário", inclusive nas mensagens de conflito do servidor e da demonstração e na regra "a senha não pode ser igual ao usuário".
- As mensagens gerais de conta do servidor (usuário repetido, formato do usuário, senha igual ao usuário) passam a dizer "usuário".
- A demonstração de relatórios passa a gerar matrículas fictícias no formato do IF (16 dígitos, ano de ingresso e semestre 1), no lugar de `DEMO-00n`.

**Fora do escopo:** nomes de campos da API (`matricula` no `POST /api/v1/auth/login`, `enrollment`, `institutionalId`), colunas, migrações e o comando de contas do terminal (`--matricula=`, `assign-enrollment` e suas mensagens), que continuam iguais para não quebrar a operação. Telas e mensagens sobre a matrícula do residente (cadastro, ficha, recuperação de senha, chamada, saídas, relatórios) continuam dizendo matrícula. A monografia não é editada aqui; o texto sugerido fica no relatório para o dono.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `access-control`: o requisito "Login por matrícula e senha" é renomeado para "Login por usuário e senha" e passa a falar de usuário; "Conta conferida a cada requisição", "Proteção contra CSRF nas gravações" e "Limite de tentativas de login em produção" trocam matrícula por usuário.
- `supervisor-accounts`: "Conta criada junto do cadastro" fala do usuário do supervisor.
- `password-policy`: "Recusa de senhas óbvias" recusa o próprio usuário, que no residente é a matrícula.
- `page-loading`: o cenário de senha errada de "Sessão encerrada tratada em um só lugar" fala de usuário.

## Impact

- Frontend: `portal.pages.ts` (login e ajuda), `supervisor-form`, `supervisor-detail`, `supervisors.component.ts`, `management-demo.service.ts`, `shared/password-rules.ts`, `reports-demo-api.service.ts`, specs e e2e (`local-auth`, `page-loading`, `supervisors-local`, `management-pagination-local`).
- Backend: `SecurityConfiguration` (401), `OpenApiConfiguration` (resumo da rota), `SupervisorService`, `LocalAccountProvisioningService`; testes `ApiFoundationIntegrationTest` e `LocalAccountPasswordPolicyTest`.
- Documentação: `docs/ARQUITETURA.md`, `PRODUCT.md` e o Purpose de `openspec/specs/access-control/spec.md`.
- Monografia: RF001, sequência do login, autenticação no cap. 5, fluxo de acesso no cap. 6 e as figuras do diagrama de sequência do login e da classe Conta local precisam acompanhar (ver design.md).
