## 1. Regras

- [x] 1.1 Criar `shared/field-rules.ts` e o equivalente no backend, com os mesmos casos de exemplo nos dois lados; verificar com specs parametrizados dos exemplos de nome e matrícula.
- [x] 1.2 Aplicar em `ResidentService`, comparando com o valor salvo para só validar o que mudou; verificar em `ResidentApiIntegrationTest`, ajustando as fixtures de uma palavra.
- [x] 1.3 Aplicar em `SupervisorService` e `GuardianService`, sem reformatar nome de responsável já salvo; verificar em `SupervisorApiIntegrationTest` e `GuardianApiIntegrationTest`.
- [x] 1.4 Tornar `courseId` obrigatório em POST e PUT; verificar em `ResidentApiIntegrationTest` e `OpenApiConfiguration`.
- [x] 1.5 Aplicar capacidade e vínculo em quartos e responsáveis; verificar em testes de integração.

## 2. Formulários

- [x] 2.1 Aplicar nome, matrícula, e-mail, nascimento e curso em `resident-form`, com rótulo "Curso *" e erro no campo; verificar em `resident-form.component.spec.ts`, `residents-local.spec.ts` e `management-pagination-demo.spec.ts`.
- [x] 2.2 Aplicar em `supervisor-form`, `guardians.pages` e `resident-detail`, com máscara de telefone; verificar com specs.
- [x] 2.3 Validar com trim em saídas, advertências e avisos, e aplicar capacidade em `room-form`; verificar com specs.
- [x] 2.4 Desligar autocomplete do operador em formulários de terceiros; verificar por busca.
- [x] 2.5 Aplicar as regras na demonstração só para valor alterado; verificar em `management-demo.service.spec.ts`.

## 3. Documentação

- [x] 3.1 Criar `docs/fase-0/CADASTRO_IFGOIANO.md` com fontes e o que continua sem confirmação; verificar por leitura.
- [x] 3.2 Atualizar `AGENTS.md`, `backend/README.md`, `DECISOES.md`, `PACOTE_AE_TI.md` e `docs/fase-2/QA.md`; verificar por busca por "course is optional".
