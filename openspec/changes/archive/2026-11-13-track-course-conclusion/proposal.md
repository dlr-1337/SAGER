## Why

O residente que termina o curso continua no quarto até alguém lembrar de tirá-lo, e a vaga fica presa. A V29 já guarda nível e duração do curso, ano de ingresso e prorrogação, mas os três primeiros são opcionais, a conta existe só no navegador (supõe ingresso no 1º semestre e usa o relógio do aparelho) e nada marca o concluinte nem libera a vaga.

Estende RF002, RF018, RF019 e RN15 (cap4.tex:108, :124, :125, :170) e a regra do AGENTS.md sobre POST/PUT de residente ("New resident POST/PUT requests require name, enrollment, birth date and courseId"), que passa a exigir o ano de ingresso. Segue a restrição de cap4.tex:218: datas civis são calculadas em America/Sao_Paulo com o relógio do servidor. Por isso a etapa, a saída prevista e a situação de concluinte passam a vir da API, e cap5.tex:27 já põe as regras de negócio nos serviços.

## What Changes

- **BREAKING:** `entryYear` passa a ser obrigatório em POST e PUT de residente, só na aplicação. Residente antigo sem ano continua legível, e a edição pede o ano. O formulário sugere o ano pelos 4 primeiros dígitos da matrícula quando o campo está vazio.
- **BREAKING:** curso novo ou alterado exige nível (ensino médio ou superior) e duração de 1 a 6 anos. Curso antigo sem esses dados continua legível e pode ser ativado ou desativado. O "Novo curso" do cadastro de residente também pede os dois.
- O semestre de ingresso sai do 5º caractere da matrícula (1 ou 2). Qualquer outro valor conta como 2º semestre, para nunca encerrar antes da hora.
- A saída prevista passa a ser uma data: 30/06 ou 31/12 do último semestre (ingresso + duração + semestres de prorrogação).
- O servidor calcula, a cada leitura, a etapa do curso, a saída prevista e a situação de concluinte, com a data civil de hoje pelo relógio do servidor em America/Sao_Paulo. As respostas de `/api/v1/residentes` (lista, item, POST e PUT) ganham os campos só de leitura `stage`, `expectedExit` e `concluded`. A ficha, a lista de residentes e os moradores do quarto só exibem esses campos, e a conta que hoje existe no navegador (`courseProgress`) sai. O quarto mostra "Entrou em dd/mm/aaaa · saída prevista dd/mm/aaaa".
- Uma rotina diária do sistema encerra o vínculo com o quarto de quem passou da saída prevista, com motivo de conclusão e auditoria da tarefa do sistema. A vaga fica livre sozinha.
- **BREAKING:** colocar ou transferir um concluinte é recusado com 409 `resident_concluded`. A prorrogação lançada adia tudo.
- Migração V31: o encerramento do vínculo passa a aceitar o motivo de conclusão.

**Fora do escopo:** módulo de saúde (sai em `remove-health-module`); preencher em massa o ano dos cadastros antigos; coluna ou campo de semestre de ingresso; duração em semestres; desativar a conta de acesso do concluinte (continua ativa); aviso ao residente; filtro ou relatório de concluintes; faixa etária (`add-accommodation-age-group`); a carga dos moradores no detalhe do quarto (`speed-up-navigation`); o texto da monografia, escrito à parte: a RN19 nova; acréscimos a RF002, RF003, RF018 e RF019 e o ator Sistema no UC19 e na figura 07; cap4.tex:61 e :220; cap5.tex:79; cap5.tex:94, que passa de seis para sete rotinas e deixa de dizer que todas usam intervalo fixo; e as figuras 12 e 19 (nível, duração, ano de ingresso, prorrogação e o motivo `CONCLUSION`).

**Modo demonstração:** continua (RF027, cap4.tex:133). O formulário de residente e a tela de cursos são os mesmos nela, então o ano de ingresso obrigatório (sugerido pela matrícula) e o nível e a duração do curso valem também ali, pelos ramos que já existem (`resident-form.component.ts`, `course-api.service.ts`). Concluinte, saída prevista, a rotina diária e o 409 `resident_concluded` existem só com a API, porque os dados fictícios não têm ano de ingresso nem duração.

## Capabilities

### New Capabilities

- `course-progress`: etapa do curso, semestre de ingresso, saída prevista, situação de concluinte calculada pelo servidor, prorrogação, encerramento automático do vínculo com o quarto e recusa de colocar concluinte no quarto.

### Modified Capabilities

- `registration-validation`: ganha o ano de ingresso obrigatório, a sugestão do ano pela matrícula (também na demonstração) e o nível e a duração obrigatórios em curso novo ou alterado.

## Impact

- Backend: novo `CourseProgress` (conta única), `ResidentRepository` (lê nível e duração do curso), `ResidentService` (recebe o `Clock`), `CourseService`, `OpenApiConfiguration`, `AllocationRepository`, `AllocationService`, novo `AllocationConclusionScheduler`, nova `V31__allocation_conclusion_reason.sql`.
- API: `GET`, `POST` e `PUT` de `/api/v1/residentes` devolvem `stage`, `expectedExit` e `concluded`; o OpenAPI os marca como só de leitura.
- Frontend: `shared/field-rules.ts`, `resident-api.service.ts`, `resident-form.component.ts`, `courses.page.ts`, `management.utils.ts` (sai `courseProgress`), `resident-detail.component.ts`, `residents.component.ts`, `room-detail.component.ts`, `allocation-api.service.ts`. A ficha e o detalhe do quarto deixam de buscar a lista de cursos só para a conta.
- Testes: `ResidentApiIntegrationTest`, `SupervisorApiIntegrationTest`, `ApiFoundationIntegrationTest`, `AuditApiIntegrationTest`, `AllocationMigrationIntegrationTest`, `AllocationApiIntegrationTest`, novos `CourseProgressTest` e `CourseConclusionIntegrationTest` (relógio fixo), specs Vitest da área (inclusive os da demonstração) e os e2e `residents-local.spec.ts`, `enrollment-catalog-recovery.spec.ts`, `rooms-local.spec.ts`, `allocations-local.spec.ts`, `management-pagination-demo.spec.ts` e `route-audit.spec.ts`.
- Documentos: `AGENTS.md`, `backend/README.md` (seção nova da rotina) e `docs/ARQUITETURA.md` (pendências institucionais).
- Operação: a rotina usa a flag existente `sager.operations.expiry.enabled`. Na primeira execução em produção, ela encerra de uma vez todos os vínculos já vencidos.
