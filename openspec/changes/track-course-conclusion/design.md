## Context

Motivação em proposal.md. Estado atual, conferido no código:

- A V29 criou `sager_course.level` e `duration_years` (1 a 6) e `sager_resident.entry_year` (1990 a 2100), todos opcionais, e `extra_semesters` (0 a 10, padrão 0). Não houve preenchimento retroativo.
- `ResidentService.checkProgress` só valida o ano quando ele vem preenchido e mudou. `CourseService.save` aceita nível e duração nulos. O "Novo curso" do formulário de residente (`resident-form.component.ts`, `createCourse`) manda só o nome.
- A conta existe só em `management.utils.ts` (`courseProgress`), roda no navegador com a data do aparelho (`civilToday`), supõe ingresso no 1º semestre e devolve o semestre ("2029/2"), não uma data. A ficha (`resident-detail.component.ts`) e o detalhe do quarto (`room-detail.component.ts`) buscam `/api/v1/cursos` só para essa conta.
- A monografia manda calcular datas civis em America/Sao_Paulo com o relógio do servidor (cap4.tex:218) e põe as regras de negócio nos serviços (cap5.tex:27).
- `ResidentController` devolve o registro `Resident` em GET (lista e item), POST e PUT. A lista passa por `ManagementSearch`, inclusive com o filtro `roomId`, que `speed-up-navigation` usa no detalhe do quarto. O `Clock` da aplicação (`OperationClockConfiguration`) é UTC, e os serviços que precisam de data civil o convertem para America/Sao_Paulo.
- O vínculo com o quarto termina só à mão: `AllocationService.end` ("END") e `transfer` ("TRANSFER"). O CHECK `sager_room_allocation_end_valid` da V9 aceita só esses dois. O parser `allocation-api.service.ts` recusa qualquer outro motivo.
- A vaga e o "Ocupado" já são calculados a partir dos vínculos ativos (V28). A auditoria já aceita `ALLOCATION`/`END` com `endedAt` e `endReason` e a origem `SYSTEM_JOB` (V11, V15).
- `ShortExitExpiryScheduler` e `ShortExitExpiryService` são o modelo de rotina do sistema: travam o residente, conferem de novo e auditam com `AuditService.recordSystem`. A flag `sager.operations.expiry.enabled` liga as rotinas (padrão ligada) e é desligada nos testes que não as exercitam.
- O modo demonstração (RF027) continua. Os residentes e cursos fictícios de `management-demo.service.ts` e `CourseApiService.demoCourses` não têm ano de ingresso, nível nem duração. A ficha da demonstração não mostra etapa nem previsão, a lista da demonstração não tem situação de curso e o detalhe do quarto da demonstração lista os moradores fictícios só com nome e matrícula (`demo.residentsInRoom`), sem passar por `loadOccupants`, que sai cedo com `isDemo()`.

## Goals / Non-Goals

**Goals:**

- Uma única conta de semestre, no servidor, usada pela resposta da API, pela rotina e pela recusa de colocar no quarto.
- O navegador só exibe a etapa, a saída prevista e a situação que a API devolve, sem relógio nem fórmula próprios (cap4.tex:218).
- A vaga do concluinte fica livre em todos os módulos que leem vínculos ativos, sem mexer nas consultas deles.

**Non-Goals:**

- Guardar a situação de concluinte no banco.
- Mudar a conta de acesso do concluinte.
- Mudar como o detalhe do quarto carrega os moradores (fica para `speed-up-navigation`).
- Mostrar etapa, saída prevista ou concluinte na demonstração.

## Decisions

### D1. Concluinte calculado na leitura, no servidor

"Concluinte" é derivado de ano de ingresso, semestre de ingresso, duração e prorrogação, como o "Ocupado" da V28, a cada resposta da API de residentes. Não existe coluna nem flag.
*Rejeitada:* uma coluna de situação. Ela precisaria ser recalculada a cada edição de ano, curso ou prorrogação e a cada virada de semestre, e poderia divergir da regra.

### D2. Rotina diária encerra o vínculo

`AllocationConclusionScheduler` roda com `@Scheduled(cron = "0 10 0 * * *", zone = "America/Sao_Paulo")` e a mesma `@ConditionalOnProperty` de `sager.operations.expiry.enabled`. Ela chama `AllocationService.closeConcluded()`, que executa numa transação, com um `requestId` só. A rotina lê os vínculos ativos com matrícula, ano de ingresso, prorrogação e duração do curso, separa os vencidos com a conta da D5 e a data de hoje em America/Sao_Paulo e, para cada um, trava o residente, confere de novo, fecha com `allocations.close(id, version, "CONCLUSION")` e chama `audit.recordSystem(..., ALLOCATION, id, END, version, {endedAt, endReason})`. A condição é "passou da saída prevista", não "venceu ontem". Por isso, um dia sem execução é recuperado na seguinte.
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

### D5. Conta única no servidor

Uma função pura `CourseProgress.of(enrollment, entryYear, extraSemesters, level, durationYears, today)`, em `management/residents`, devolve `stage`, `expectedExit` e `concluded`:

- semestre de ingresso `s` = 5º caractere da matrícula quando for 1 ou 2, senão 2 (D3);
- início = `entryYear * 2 + s - 1`; último = `início + durationYears * 2 - 1 + extraSemesters`;
- `expectedExit` = 30/06 do ano `último / 2` quando `último` é par, senão 31/12 (D4); nulo sem ano ou sem duração;
- `concluded` = `today` depois de `expectedExit`; falso sem `expectedExit`;
- `stage` = "Concluinte" quando `concluded`; senão, com ano, duração e nível, usa `decorridos = atual - início`, com atual = `ano * 2 + (mês >= 7 ? 1 : 0)` de `today`: "Ingressa em <ano>" quando `decorridos < 0`, "<decorridos / 2 + 1>º ano" no ensino médio e "<decorridos + 1>º período" no superior; nulo quando falta algum dos três.

`today` é sempre `LocalDate.now(clock.withZone(ZoneId.of("America/Sao_Paulo")))`, com o `Clock` da aplicação. Os três chamadores são `ResidentService` (resposta da API), `AllocationService.closeConcluded` (rotina) e a recusa da D6.
*Rejeitada:* calcular no navegador, como fazia a versão anterior desta change, com a fórmula repetida em `management.utils.ts`. Contraria cap4.tex:218: o relógio e o fuso do aparelho podem estar errados, e a mesma regra ficaria em dois lados, com testes de paridade.
*Rejeitada:* uma constante SQL em `AllocationRepository` para a rotina e a recusa. Seria uma segunda cópia da fórmula, ao lado da usada na resposta da API. Com até 250 residentes (RNF Desempenho, cap4.tex:197), ler os vínculos ativos e filtrar em Java uma vez por dia custa pouco.

### D6. Recusa de colocar concluinte no quarto

`AllocationService.create` e `transfer`, depois de travar o residente, leem o residente com o curso e recusam o concluinte (D5) com 409 `resident_concluded`: "Este residente concluiu o curso. Lance a prorrogação antes de colocar no quarto." A checagem fica em `checkAdmission`, onde `add-accommodation-age-group` põe a da faixa etária.
*Rejeitada:* aceitar e deixar a rotina desfazer no dia seguinte. A vaga ficaria ocupada por uma noite e o histórico ganharia um vínculo falso.

### D7. Ano de ingresso obrigatório só na aplicação

`checkProgress` recusa `entryYear` nulo em POST e PUT. A regra de formato continua valendo só para valor novo ou alterado. O formulário sugere o ano pela matrícula quando o campo está vazio, ao digitar a matrícula e ao preencher o formulário com um cadastro (`setFields`), inclusive um antigo. Esses dois caminhos são os mesmos na demonstração, que assim também sugere o ano. O OpenAPI deixa de marcar o campo como nulo e o põe entre os obrigatórios. É o mesmo modelo do curso obrigatório.
*Rejeitada:* `CHECK (entry_year IS NOT NULL) NOT VALID`. Toda migração futura que der UPDATE em `sager_resident` teria de remover e recriar a restrição, como já aconteceu na V20 e na V22.
*Rejeitada:* preencher o ano dos antigos numa migração com auditoria `SYSTEM_JOB`, como fez a V22. A decisão foi pedir o ano na próxima edição. A confirmar com a AE, porque até lá esses residentes nunca viram concluintes.

### D8. Nível e duração obrigatórios em curso novo ou alterado

`CourseService.save` recusa nível ou duração nulos ao criar, ou quando nome, nível ou duração mudam. Ativar ou desativar com os mesmos valores continua aceito. A tela de cursos perde a opção "Não informado" e ganha `Validators.required`. O "Novo curso" do formulário de residente ganha os dois campos. A rotina exige só a duração, e a etapa exige também o nível. A duração continua em anos. Na demonstração, o ramo de `CourseApiService.save` já guarda nível e duração em memória, então a mesma tela vale ali.
*Rejeitada:* tirar o "Novo curso" do formulário de residente e mandar o usuário para a tela de cursos. Ele perderia o que já digitou no cadastro.
*Rejeitada:* duração em semestres. Só faz falta se existir curso com número ímpar de semestres. A confirmar com a AE.

### D9. V31 só amplia o motivo de encerramento

A `V31__allocation_conclusion_reason.sql` remove e recria `sager_room_allocation_end_valid` com `end_reason IN ('TRANSFER', 'END', 'CONCLUSION')`. Os CHECKs de auditoria não mudam, porque já aceitam o evento.
*Rejeitada:* editar a V9, que já foi aplicada.

### D10. A resposta do residente traz a etapa, a saída prevista e a situação

`ResidentRepository` passa a ler o nível e a duração do curso junto com o residente, por subconsulta, como já lê o nome do curso. `ResidentService` recebe o `Clock` e completa `stage` (texto ou nulo), `expectedExit` (data `aaaa-mm-dd` ou nula) e `concluded` (booleano) com a D5 em toda resposta: item, lista (com qualquer filtro, inclusive `roomId`), POST e PUT. O OpenAPI acrescenta os três ao esquema `Resident` como só de leitura. No navegador, `ResidentRecord` ganha os três como opcionais e `isResident` confere o tipo quando vierem, como já faz com `extraSemesters`. A ficha, a lista e o detalhe do quarto só exibem os campos e deixam de buscar `/api/v1/cursos` para a conta.
*Rejeitada:* um endpoint próprio de progresso (`/residentes/{id}/progresso`). Seria mais um pedido por ficha e um por morador, sem ganho sobre campos na mesma resposta.
*Rejeitada:* exigir os três campos no parser. Obrigaria a reescrever as respostas simuladas de `/api/v1/residentes` em testes de outras áreas, e a falta deles cai no mesmo "Sem dados para calcular" de um cadastro incompleto.

### D11. A demonstração acompanha só o formulário

Na demonstração valem o ano de ingresso obrigatório, a sugestão pela matrícula e o nível e a duração do curso, porque o formulário e a tela de cursos são os mesmos. Etapa, saída prevista, "Concluinte", a rotina e o 409 não existem nela: os dados fictícios não têm ano nem duração, e as telas da demonstração não mostram esses dados. Os ramos `isDemo()`/`session.active()` dos arquivos tocados ficam como estão.
*Rejeitada:* dar ano, duração e situação aos dados fictícios. Exigiria calcular no navegador (contra a D5) ou fixar valores que envelheceriam com o calendário, e nenhuma tela da demonstração os mostra.

## Risks / Trade-offs

- [Dado errado (ano digitado errado, duração errada, prorrogação atrasada) tira a pessoa do quarto antes da hora] → o histórico e a auditoria ficam. O supervisor corrige o cadastro e coloca a pessoa no quarto de novo, mas ela perde a vaga se outro residente ocupar antes.
- [A resposta da API passa a depender do dia: um teste que compare etapa, saída ou situação sem relógio fixo quebra com a data] → essas asserções ficam só em `CourseProgressTest` (data como parâmetro) e em `CourseConclusionIntegrationTest` (relógio fixo).
- [Desligar a flag para parar esta rotina também para a expiração das saídas] → aceito. A rotina pode ser parada sozinha com um deploy que remova o agendamento.
- [Cursos e residentes de produção sem duração ou sem ano nunca geram concluinte] → o operador confere os dados antes do deploy (Migration Plan).
- [Arquivos tocados por outras changes da mesma leva: `room-detail.component.ts` (`loadOccupants`, de `speed-up-navigation`) e `AllocationService`/`checkAdmission` (de `add-accommodation-age-group`)] → esta change só tira a lista de cursos de `loadOccupants` e mantém a troca para `residentApi.page({ roomId })`, se já aplicada; a checagem de faixa entra depois, ao lado da de conclusão.

## Migration Plan

1. Antes do deploy, o operador confere em produção os cursos sem `duration_years` e os residentes sem `entry_year` com vínculo ativo (consultas registradas em `backend/README.md`, task 4.5).
2. A V30 da `remove-health-module` (branch `impl/saude-desempenho`) entra antes, ou no mesmo deploy. Com `outOfOrder` desligado, um banco persistente que receba a V31 antes da V30 recusa a V30 depois e a aplicação não sobe. Não renumerar nem ligar `outOfOrder`.
3. O deploy aplica a V31, de preferência durante o dia. Até as 00:10, a lista de residentes já mostra "Concluinte" em quem a primeira execução vai encerrar, porque a lista e a rotina usam a mesma conta (D5). O operador confere ali e, se for o caso, o supervisor lança a prorrogação ou corrige o ano antes da rotina.
4. A rotina roda às 00:10 e encerra de uma vez todos os vínculos já vencidos.
5. Reversão: `sager.operations.expiry.enabled=false` para a rotina. Os vínculos encerrados não voltam sozinhos: o supervisor lança a prorrogação ou corrige o ano e coloca o residente no quarto de novo. A V31 não precisa ser desfeita.

## Open Questions

A confirmar com a AE, sem mudar a implementação desta change. A task 4.5 registra cada uma, com a regra local adotada, nas pendências institucionais de `docs/ARQUITETURA.md`:

- Encerrar o vínculo sozinho ou só marcar "Concluinte"?
- O semestre termina em 30/06 e 31/12, ou em outra data? Deve haver folga depois da saída prevista?
- O 5º dígito da matrícula SUAP é o semestre de ingresso?
- Existe curso com número ímpar de semestres?
- Os residentes antigos sem ano de ingresso devem ser preenchidos de uma vez pela matrícula?
- O que fazer com a conta de acesso do concluinte depois que ele sai (hoje continua ativa)?

Cabe ao operador: conferir os dados de produção antes do deploy e a lista de concluintes antes da primeira execução.
