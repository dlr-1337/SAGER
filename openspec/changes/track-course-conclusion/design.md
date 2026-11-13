## Context

Motivação em proposal.md. Estado atual, conferido no código:

- A V29 criou `sager_course.level` e `duration_years` (1 a 6) e `sager_resident.entry_year` (1990 a 2100), todos opcionais, e `extra_semesters` (0 a 10, padrão 0). Não houve preenchimento retroativo.
- `ResidentService.checkProgress` só valida o ano quando ele vem preenchido e mudou. `CourseService.save` aceita nível e duração nulos. O "Novo curso" do formulário de residente (`resident-form.component.ts`, `createCourse`) manda só o nome.
- A conta existe só em `management.utils.ts` (`courseProgress`), supõe ingresso no 1º semestre e devolve o semestre ("2029/2"), não uma data.
- O vínculo com o quarto termina só à mão: `AllocationService.end` ("END") e `transfer` ("TRANSFER"). O CHECK `sager_room_allocation_end_valid` da V9 aceita só esses dois. O parser `allocation-api.service.ts` recusa qualquer outro motivo.
- A vaga e o "Ocupado" já são calculados a partir dos vínculos ativos (V28). A auditoria já aceita `ALLOCATION`/`END` com `endedAt` e `endReason` e a origem `SYSTEM_JOB` (V11, V15).
- `ShortExitExpiryScheduler` e `ShortExitExpiryService` são o modelo de rotina do sistema: travam o residente, conferem de novo e auditam com `AuditService.recordSystem`. A flag `sager.operations.expiry.enabled` liga as rotinas (padrão ligada) e é desligada nos testes que não as exercitam.

## Goals / Non-Goals

**Goals:**

- Uma única conta de semestre no backend, usada pela rotina e pela recusa de colocar no quarto.
- A vaga do concluinte fica livre em todos os módulos que leem vínculos ativos, sem mexer nas consultas deles.

**Non-Goals:**

- Guardar a situação de concluinte no banco.
- Mudar a conta de acesso do concluinte.
- Mudar como o detalhe do quarto carrega os moradores (fica para `speed-up-navigation`).

## Decisions

### D1. Concluinte calculado na leitura

"Concluinte" é derivado de ano de ingresso, semestre de ingresso, duração e prorrogação, como o "Ocupado" da V28. Não existe coluna nem flag.
*Rejeitada:* uma coluna de situação. Ela precisaria ser recalculada a cada edição de ano, curso ou prorrogação, e poderia divergir da regra.

### D2. Rotina diária encerra o vínculo

`AllocationConclusionScheduler` roda com `@Scheduled(cron = "0 10 0 * * *", zone = "America/Sao_Paulo")` e a mesma `@ConditionalOnProperty` de `sager.operations.expiry.enabled`. Ela chama `AllocationService.closeConcluded()`, que executa numa transação, com um `requestId` só. Para cada vínculo ativo vencido, a rotina trava o residente, confere de novo, fecha com `allocations.close(id, version, "CONCLUSION")` e chama `audit.recordSystem(..., ALLOCATION, id, END, version, {endedAt, endReason})`. A condição é "passou da saída prevista", não "venceu ontem". Por isso, um dia sem execução é recuperado na seguinte.
*Rejeitada:* liberar a vaga só na leitura. Seria preciso mexer em cerca de 31 consultas com `ended_at IS NULL` em 10 arquivos (quartos, chamada, limpeza, saídas, relatórios), e o concluinte continuaria "no quarto" nos outros módulos.
*Rejeitada:* só marcar "Concluinte" e deixar o supervisor tirar do quarto. O pedido é liberar a vaga sozinha. A confirmar com a AE.
*Rejeitada:* rodar a cada minuto, como as saídas. A regra muda só uma vez por dia.
*Rejeitada:* uma flag própria. A decisão foi reaproveitar a das rotinas existentes.

### D3. Semestre de ingresso pela matrícula

O 5º caractere da matrícula define o semestre (1 ou 2), e qualquer outro valor conta como 2º semestre. A regra conservadora nunca encerra antes da hora. A confirmar com a AE: o 5º dígito da matrícula SUAP é mesmo o semestre de ingresso?
*Rejeitada:* coluna `entry_semester` com campo no formulário. É mais um dado para digitar, sem fonte melhor que a matrícula.
*Rejeitada:* supor o 1º semestre, como hoje. Quem entra no meio do ano perderia o quarto um semestre antes.

### D4. Fim do semestre em 30/06 e 31/12

A saída prevista é `ano-06-30` ou `ano-12-31` do último semestre. A confirmar com a AE: o calendário acadêmico do campus pode terminar o semestre em outra data, e a AE pode querer alguns dias de folga.
*Rejeitada:* datas por calendário acadêmico. Não há fonte nem cadastro de calendário no sistema.

### D5. Fonte única da conta no backend

Uma constante SQL em `AllocationRepository` calcula o último semestre: `entry_year * 2 + semestre de ingresso - 1 + duration_years * 2 - 1 + extra_semesters`, com o semestre de ingresso tirado de `substr(enrollment, 5, 1)`. A mesma constante serve à consulta da rotina e à verificação da recusa. O semestre atual (`ano * 2 + (mês >= 7 ? 1 : 0)`) vem da data civil do `Clock` em America/Sao_Paulo e entra como parâmetro. `management.utils.ts` repete a fórmula, com um comentário que aponta para a constante, e os testes dos dois lados usam os mesmos casos (ver tasks 3.1 e 4.3).
*Rejeitada:* devolver `expectedExit` e `concluded` na API de residentes. Evitaria a cópia no navegador, mas a leitura e a busca de residentes passariam a juntar curso e relógio, e mudariam o contrato da API e os parsers. Hoje a ficha, a lista e o quarto já carregam os cursos.

### D6. Recusa de colocar concluinte no quarto

`AllocationService.create` e `transfer`, depois de travar o residente, recusam o concluinte com 409 `resident_concluded`: "Este residente concluiu o curso. Lance a prorrogação antes de colocar no quarto."
*Rejeitada:* aceitar e deixar a rotina desfazer no dia seguinte. A vaga ficaria ocupada por uma noite e o histórico ganharia um vínculo falso.

### D7. Ano de ingresso obrigatório só na aplicação

`checkProgress` recusa `entryYear` nulo em POST e PUT. A regra de formato continua valendo só para valor novo ou alterado. O formulário sugere o ano pela matrícula quando o campo está vazio, inclusive ao abrir um cadastro antigo. O OpenAPI deixa de marcar o campo como nulo e o põe entre os obrigatórios. É o mesmo modelo do curso obrigatório.
*Rejeitada:* `CHECK (entry_year IS NOT NULL) NOT VALID`. Toda migração futura que der UPDATE em `sager_resident` teria de remover e recriar a restrição, como já aconteceu na V20 e na V22.
*Rejeitada:* preencher o ano dos antigos numa migração com auditoria `SYSTEM_JOB`, como fez a V22. A decisão foi pedir o ano na próxima edição. A confirmar com a AE, porque até lá esses residentes nunca viram concluintes.

### D8. Nível e duração obrigatórios em curso novo ou alterado

`CourseService.save` recusa nível ou duração nulos ao criar, ou quando nome, nível ou duração mudam. Ativar ou desativar com os mesmos valores continua aceito. A tela de cursos perde a opção "Não informado" e ganha `Validators.required`. O "Novo curso" do formulário de residente ganha os dois campos. A rotina exige só a duração, e a etapa exige também o nível. A duração continua em anos.
*Rejeitada:* tirar o "Novo curso" do formulário de residente e mandar o usuário para a tela de cursos. Ele perderia o que já digitou no cadastro.
*Rejeitada:* duração em semestres. Só faz falta se existir curso com número ímpar de semestres. A confirmar com a AE.

### D9. V31 só amplia o motivo de encerramento

A `V31__allocation_conclusion_reason.sql` remove e recria `sager_room_allocation_end_valid` com `end_reason IN ('TRANSFER', 'END', 'CONCLUSION')`. Os CHECKs de auditoria não mudam, porque já aceitam o evento.
*Rejeitada:* editar a V9, que já foi aplicada.

## Risks / Trade-offs

- [Dado errado (ano digitado errado, duração errada, prorrogação atrasada) tira a pessoa do quarto antes da hora] → o histórico e a auditoria ficam. O supervisor corrige o cadastro e coloca a pessoa no quarto de novo, mas ela perde a vaga se outro residente ocupar antes.
- [A conta do navegador diverge da do backend] → mesmos casos nos testes dos dois lados e comentário apontando a constante.
- [Desligar a flag para parar esta rotina também para a expiração das saídas] → aceito. A rotina pode ser parada sozinha com um deploy que remova o agendamento.
- [Cursos e residentes de produção sem duração ou sem ano nunca geram concluinte] → o operador confere os dados antes do deploy (Migration Plan).
- [Arquivos de teste com nomes que `remove-demo-mode` pode mudar] → a implementação usa o nome que existir depois da onda 1.

## Migration Plan

1. Antes do deploy, o operador confere em produção os cursos sem `duration_years` e os residentes sem `entry_year` com vínculo ativo. Em seguida, lista quem a primeira execução vai encerrar, rodando a consulta da rotina com a data do dia (registrada em `backend/README.md`, task 4.5).
2. O deploy aplica a V31. A rotina roda às 00:10 do dia seguinte e encerra de uma vez todos os vínculos já vencidos.
3. Reversão: `sager.operations.expiry.enabled=false` para a rotina. Os vínculos encerrados não voltam sozinhos: o supervisor lança a prorrogação ou corrige o ano e coloca o residente no quarto de novo. A V31 não precisa ser desfeita.

## Open Questions

A confirmar com a AE, sem mudar a implementação desta change:

- Encerrar o vínculo sozinho ou só marcar "Concluinte"?
- O semestre termina em 30/06 e 31/12, ou em outra data? Deve haver folga depois da saída prevista?
- O 5º dígito da matrícula SUAP é o semestre de ingresso?
- Existe curso com número ímpar de semestres?
- Os residentes antigos sem ano de ingresso devem ser preenchidos de uma vez pela matrícula?
- O que fazer com a conta de acesso do concluinte depois que ele sai (hoje continua ativa)?

Cabe ao operador: conferir os dados de produção e a prévia da primeira execução antes do deploy.
