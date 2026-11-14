# Proposal

## Why

O módulo de saúde está oculto dos menus desde o commit 39503aa, mas continua inteiro: cerca de 3,2 mil linhas no frontend, 1,3 mil no backend (2 mil com testes), um perfil de conta (`saude`), rotas `/api/v1/saude/**` e `/api/v1/minha-saude/**` abertas a qualquer sessão autenticada e seis tabelas da V13. A monografia define só três perfis (gestor, supervisor e residente, cap4.tex:51), e o dono decidiu remover o módulo (DECISOES.md, "Demonstração e saúde"). A produção recebeu carga nova em 12/11 e não tem dados de saúde. Manter o módulo é superfície de ataque e de manutenção sem uso.

Base na monografia: cap4.tex:51 fixa os três perfis e diz que o operador técnico provisiona por linha de comando só as contas iniciais de gestor; cap4.tex:216 repete que as contas de residente e de supervisor nascem no próprio cadastro, com a senha definida por quem cadastra. Nenhum capítulo da monografia cita saúde. A RN16 (cap4.tex:171) mantém a auditoria somente de inclusão e com retenção permanente. O AGENTS.md já não tem regras de saúde, retiradas por `clean-up-documentation`; continuam valendo e orientam esta mudança "Audit records have permanent retention" e "Keep APIs closed for unknown profiles". A decisão 9 de docs/ARQUITETURA.md ("Sem módulo de saúde") registra a remoção.

## What Changes

- **BREAKING** Remove a API de saúde: `/api/v1/saude/**` e `/api/v1/minha-saude/**` deixam de existir e passam a cair na regra geral que recusa qualquer rota não declarada. Saem também os contratos dessas rotas no OpenAPI.
- **BREAKING** Remove o perfil `saude`. O provisionamento de contas e a auditoria deixam de aceitá-lo, e o frontend trata como inválida uma sessão com esse perfil. Contas `saude` que existirem no banco são desativadas pela migração, não apagadas.
- **BREAKING** (operação) O comando de terminal `--sager-account=create` passa a criar só contas de gestor (cap4.tex:51 e :216). Com `--profile` diferente de `gestor`, ele recusa antes de pedir a senha, com a mensagem "Pelo terminal só se criam contas de gestor; residentes e supervisores recebem a conta no próprio cadastro", e a ajuda passa a mostrar `--profile=gestor`. Os demais comandos de contas não mudam.
- Remove o pacote `health` do backend, o tratamento de `HealthApiException` e os valores de saúde da auditoria (`HEALTH_GRANT`, `CARE_ASSIGNMENT`, `HEALTH_CUSTODY`, `HEALTH_NOTE`, `HEALTH_SHARE`, `HEALTH_EXPORT`), junto com a recusa 403 específica de conteúdo protegido.
- Nova migração `V30__remove_health_module.sql`, sem editar a V13. Ela recusa a execução se houver qualquer registro de saúde. Sem registros, apaga as seis tabelas e a função de imutabilidade e desativa contas `saude`. Não toca em nenhuma linha de `sager_audit_event` nem nas restrições de auditoria e de perfil de conta, para que eventos e contas antigos continuem válidos e legíveis.
- Remove do frontend `features/health`, as rotas `/saude/**` e `/minha-saude`, o `healthGuard`, o item de menu, o cartão do início, os atalhos da ajuda e do perfil e o valor `saude` do tipo de perfil. Isso inclui os ramos `'saude'` das telas que a demonstração usa (início, ajuda e perfil).
- Ajusta os testes de integração, os testes de componente e os e2e que usavam saúde ou o perfil `saude`, e apaga os testes do módulo.
- Delta em `whatsapp-conversations`: a lista de quem não herda o acesso deixa de citar o profissional de saúde, e o aviso sobre dados sensíveis deixa de supor que o sistema guarda dados de saúde.

Fora do escopo:
- AGENTS.md, README.md, PRODUCT.md, `backend/README.md` e `docs/`: `clean-up-documentation` (já aplicada) reescreveu esses textos sem saúde. O que ainda falta neles, como o exemplo de `backend/README.md` que cria conta de residente pelo terminal e as frases de `backend/README.md` e `docs/OPERACAO.md` segundo as quais `--profile` aceita supervisor e residente, é corrigido junto com os demais documentos da reconciliação com a monografia, não aqui. Esta mudança só confere com `git grep` (tarefa 5.2).
- docs/fase-2/SAUDE_CONTRATO.md e as capturas `.impeccable/reviews/pr-saude-*.png`, já removidos por `clean-up-documentation`.
- Remover ou alterar o modo demonstração (RF027, cap4.tex:133), que fica. Esta mudança só remove os ramos `'saude'` das telas da demonstração; a demonstração já oferece só gestor, supervisor e residente e continua igual.
- O aviso "Não trate dados de saúde por aqui" nas conversas do WhatsApp continua: é orientação sobre dado sensível no canal, não depende do módulo.
- Exportar, migrar ou reter dados de saúde: a produção não tem nenhum, e a V30 se recusa a rodar se houver.
- A spec de perfis e permissões (`access-control`), que a mudança `document-core-baseline` vai escrever já com três perfis e com a criação de contas de gestor só pelo terminal.

## Capabilities

### New Capabilities

Nenhuma. Não existe spec de saúde em `openspec/specs`, e as regras dos três perfis e do provisionamento pelo terminal entram na base de `document-core-baseline`.

### Modified Capabilities

- `whatsapp-conversations`: "Acesso restrito a supervisores" deixa de citar o profissional de saúde, e "Aviso sobre dados sensíveis" deixa de prometer que o sistema não dá acesso a dados de saúde que ele não guarda mais.

## Impact

- Backend: `health/` (5 classes), `api/ApiExceptionHandler.java`, `api/OpenApiConfiguration.java`, `audit/AuditResource.java`, `audit/AuditService.java`, `audit/AuditRepository.java`, `audit/AuditContextProvider.java`, `auth/SecurityConfiguration.java`, `auth/LocalAccountProvisioningService.java`, `auth/LocalAccountProvisioningRunner.java`, `application-local.yml` e a nova `db/migration/V30__remove_health_module.sql`.
- Testes do backend: apaga `health/HealthApiIntegrationTest.java`, `health/HealthMigrationIntegrationTest.java` e `audit/AuditHealthPrivacyApiIntegrationTest.java`, e ajusta `api/ApiFoundationIntegrationTest.java`, `auth/AuthFlowIntegrationTest.java`, `auth/LocalAccountProvisioningRunnerTest.java`, `management/residents/ResidentApiIntegrationTest.java`, `management/supervisors/SupervisorApiIntegrationTest.java` e `discipline/DisciplineApiIntegrationTest.java`. Entra um teste novo da V30.
- Frontend: `features/health/` (11 arquivos), `app.routes.ts`, `app.routes.spec.ts`, `app.ts`, `app.html`, `app.spec.ts`, `core/demo-session.service.ts` (só o tipo `Role`; o serviço e os ramos da demonstração ficam), `core/local-auth.service.ts` e o spec dele, `features/portal/local-home.page.ts`, `features/portal/portal.pages.ts` e o spec dele, `shared/_back-link.scss`, além de `e2e/health-local.spec.ts`, `e2e/conversations-local.spec.ts` e `e2e/cleaning-reports-local.spec.ts`.
- Banco: seis tabelas e uma função a menos. Contas `saude` ficam inativas. Eventos de auditoria antigos continuam gravados e deixam de aparecer na consulta da API.
- Operação: um banco local com registros sintéticos de saúde precisa ser recriado antes de subir a nova versão. A produção precisa da conferência de contagem zero antes do deploy. O operador passa a criar pelo terminal só contas de gestor; o smoke de `infra/coolify/smoke.py` já usa `--profile=gestor`. O `--saude` de `scripts/popular_demonstracao.py`, que chamava a API de saúde, sai junto.
- Ordem: onda 2, depois de `clean-up-documentation` e antes da parte frontend de `speed-up-navigation`.
