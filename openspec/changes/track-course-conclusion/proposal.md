## Why

O residente que termina o curso continua no quarto até alguém lembrar de tirá-lo, e a vaga fica presa. A V29 já guarda nível e duração do curso, ano de ingresso e prorrogação, mas os três primeiros são opcionais, a conta existe só no navegador (supõe ingresso no 1º semestre) e nada marca o concluinte nem libera a vaga.

A mudança atende a PRD E02 (cadastro e histórico do residente; AC06, campo exigido em novos registros e edições) e E04 (alocação: "transições automáticas ainda dependem da AE"), e a regra do AGENTS.md "New resident POST/PUT requests require name, enrollment, birth date and courseId", que passa a incluir o ano de ingresso.

## What Changes

- **BREAKING:** `entryYear` passa a ser obrigatório em POST e PUT de residente, só na aplicação. Residente antigo sem ano continua legível, e a edição pede o ano. O formulário sugere o ano pelos 4 primeiros dígitos da matrícula quando o campo está vazio.
- **BREAKING:** curso novo ou alterado exige nível (ensino médio ou superior) e duração de 1 a 6 anos. Curso antigo sem esses dados continua legível e pode ser ativado ou desativado. O "Novo curso" do cadastro de residente também pede os dois.
- O semestre de ingresso sai do 5º caractere da matrícula (1 ou 2). Qualquer outro valor conta como 2º semestre, para nunca encerrar antes da hora.
- A saída prevista passa a ser uma data: 30/06 ou 31/12 do último semestre (ingresso + duração + semestres de prorrogação).
- "Concluinte" é calculado na leitura e aparece na ficha, na lista de residentes e nos moradores do quarto. O quarto mostra "Entrou em dd/mm/aaaa · saída prevista dd/mm/aaaa".
- Uma rotina diária do sistema encerra o vínculo com o quarto de quem passou da saída prevista, com motivo de conclusão e auditoria da tarefa do sistema. A vaga fica livre sozinha.
- **BREAKING:** colocar ou transferir um concluinte é recusado com 409 `resident_concluded`. A prorrogação lançada adia tudo.
- Migração V31: o encerramento do vínculo passa a aceitar o motivo de conclusão.

**Fora do escopo:** modo demonstração e módulo de saúde (saem em `remove-demo-mode` e `remove-health-module`); preencher em massa o ano dos cadastros antigos; coluna ou campo de semestre de ingresso; duração em semestres; desativar a conta de acesso do concluinte (continua ativa); aviso ao residente; filtro ou relatório de concluintes; faixa etária (`add-accommodation-age-group`); a carga dos moradores no detalhe do quarto (`speed-up-navigation`).

## Capabilities

### New Capabilities

- `course-progress`: etapa do curso, semestre de ingresso, saída prevista, situação de concluinte, prorrogação, encerramento automático do vínculo com o quarto e recusa de colocar concluinte no quarto.

### Modified Capabilities

- `registration-validation`: ganha o ano de ingresso obrigatório, a sugestão do ano pela matrícula e o nível e a duração obrigatórios em curso novo ou alterado.

## Impact

- Backend: `ResidentService`, `CourseService`, `OpenApiConfiguration`, `AllocationRepository`, `AllocationService`, novo `AllocationConclusionScheduler`, nova `V31__allocation_conclusion_reason.sql`.
- Frontend: `shared/field-rules.ts`, `resident-form.component.ts`, `courses.page.ts`, `management.utils.ts`, `resident-detail.component.ts`, `residents.component.ts`, `room-detail.component.ts`, `allocation-api.service.ts`.
- Testes: `ResidentApiIntegrationTest`, `SupervisorApiIntegrationTest`, `ApiFoundationIntegrationTest`, `AllocationMigrationIntegrationTest`, novo `AllocationConclusionIntegrationTest`, specs Vitest da área e os e2e `residents-local.spec.ts` e `enrollment-catalog-recovery.spec.ts`.
- Documentos: `AGENTS.md` e `backend/README.md`.
- Operação: a rotina usa a flag existente `sager.operations.expiry.enabled`. Na primeira execução em produção, ela encerra de uma vez todos os vínculos já vencidos.
