# Design

## Context

O motivo e a lista dos pontos estão em proposal.md. Todos foram conferidos no código em 13/11/2026, e o estado atual de cada um é o seguinte:

- **Ficha do residente.** No acesso por conta, a aba Termos cai no `@else` "Ainda não integrado" (`resident-detail.component.ts:415-437`). Na demonstração, há um painel próprio que fala em homologação pela AE (:735-745). Os termos já existem no fluxo de reincidência do supervisor (`/residentes/:id/reincidencias`, `/termos/:id`) e chegam ao residente pelas comunicações.
- **Ajuda.** A HelpPage é pública. No ramo sem demonstração, ela responde à pergunta sobre senha com "Procure o suporte" (`portal.pages.ts:1150-1156`). A tela de acesso (`portal.pages.ts:75-78`) e a de recuperação (`recovery.page.ts:117-125`) já separam o residente, que usa a recuperação, de gestor e supervisor, que procuram o suporte.
- **Operações no acesso por conta.** Saídas e chamada usam o mesmo diálogo, `LocalOperationsReviewDialogComponent`. Ele valida pelo `validJustification`, que hoje aceita de 10 a 500 caracteres, e o servidor aceita de 10 a 2.000 (`ShortExitService.java:316-318`, `NightCallService.java:228-231`). A rejeição de saída curta abre o diálogo com `comment: true` (campo opcional). A de saída longa já usa `requireReason: decision === 'REJECT'` (`long-exit-detail.component.ts:980`).
- **Fechamento da chamada.** O servidor trata como excepcional o fechamento fora da janela e também o de uma chamada de data anterior (`NightCallService.java:172`). A tela só considera `context.outsideWindow`. O `context.referenceDate` já vem do servidor: é a data de hoje em America/Sao_Paulo pelo relógio dele (`NightCallService.java:72`).
- **Demonstração.** `OperationsDemoService.decideExit` recusa a rejeição de saída longa sem conferência (:471) e aceita qualquer motivo não vazio (:472). O diálogo `OperationsReviewDialogComponent` (`features/operations/review-dialog.component.ts`, que não deve ser confundido com `shared/review-dialog.component.ts`) só checa se o texto está vazio. As telas `cleaning.component.ts` e `ranking.component.ts` dizem que a fórmula está pendente e usam uma casa decimal. A chamada da demonstração (`OperationsDemoService.minors`) lista Beatriz Costa e Pedro Henrique Silva, cujos nascimentos fictícios estão em `management-demo.service.ts:52` e :62.
- **Contas.** `ResidentRecoveryService.recover` chama `LocalAccountRepository.updatePassword`, que troca o hash e apaga as sessões, sem evento. O `LocalAccountProvisioningRunner` chama métodos `@Transactional` do `LocalAccountProvisioningService`, também sem evento. No cadastro assistido, `ResidentService.create` e `SupervisorService.create` chamam os mesmos `create`/`link*` dentro da transação que grava o evento CREATE do residente ou do supervisor. A tabela `sager_audit_event` tem CHECK de recurso, de campos por recurso, de origem (`LOCAL_API`, `SYSTEM_JOB`) e de coerência entre origem e autor (V11, V15, V20, V29). `sager_local_account` não tem coluna de versão.

## Goals / Non-Goals

**Goals:**
- Telas, demonstração e auditoria passam a dizer e fazer o que a monografia descreve, com o menor diff em cada ponto.
- Cada ponto leva um teste focado: Vitest, Playwright ou JUnit com Testcontainers.

**Non-Goals:**
- Mudar regras do servidor das saídas e da chamada, que já seguem a RN05 e a RN09.
- Recriar a lógica real de limpeza e de ranking na demonstração, que continua com cenários preparados.
- Auditar sessões, contadores de tentativas e tentativas recusadas.

## Decisions

### D1. A aba Termos sai da ficha, nos dois modos
Saem `'termos'` do tipo `ResidentTab` (:38), os dois botões (:123-130, :494-501), o painel da demonstração (:735-745) e o título condicional do `@else`. O `@else` não sobra para nenhuma aba: Dados, Responsáveis e Histórico têm ramo próprio (:134, :307, :381). Por isso ele sai inteiro.
- **Alternativa rejeitada:** listar os termos na ficha para o supervisor. A monografia não descreve essa tela, o gestor não vê termos (cap4.tex:80), e a lista já existe no fluxo de reincidência.
- **Demonstração:** acompanha, e a aba sai também nela.

### D2. Um texto só na pergunta sobre senha, com link
A HelpPage abre sem login e não sabe o perfil de quem lê. A resposta cobre os dois casos: "Residente: na tela de acesso, clique em Esqueci minha senha, informe matrícula, nome completo, data de nascimento e, se houver, o nome do responsável, e crie a senha nova. Gestor ou supervisor: procure o suporte da instituição, que confere quem você é e troca sua senha." "Esqueci minha senha" vira um `routerLink="/recuperar-senha"`.
- **Alternativa rejeitada:** mudar a resposta conforme o perfil da sessão. Visitantes sem login também leem a ajuda, e o texto ficaria diferente da tela de acesso.
- **Demonstração:** não acompanha. O ramo `session.active()` mantém a pergunta "Esta demonstração usa dados reais?".

### D3. A rejeição de saída curta usa `requireReason`, como a saída longa
Em `exit-detail-local.component.ts`, `decide()` passa `requireReason: decision === 'REJECT', comment: decision === 'APPROVE'`.
- **Alternativa rejeitada:** deixar que o servidor recuse. A tela mostra "Comentário (opcional)" e só avisa depois do envio.

### D4. Um limite só, de 10 a 2.000, no diálogo das operações
`validJustification` passa a aceitar até 2.000 caracteres. As textareas de justificativa e de observação de atraso ganham `maxlength="2000"`, e os três textos de ajuda e de erro passam a "10 a 2.000 caracteres", como em comunicações e limpeza. A observação de atraso continua exigindo no mínimo 10 caracteres na tela, como hoje.
- **Alternativa rejeitada:** um limite por campo. O servidor e a monografia usam o mesmo intervalo, e um helper só evita divergência.
- **Demonstração:** os diálogos dela não têm o limite de 500. A regra de 10 a 2.000 chega pela D5.

### D5. Na demonstração, rejeitar com 10 a 2.000 caracteres e antes da conferência
Em `OperationsDemoService.decideExit`, sai a linha que bloqueia a rejeição sem conferência. A rejeição passa a exigir de 10 a 2.000 caracteres depois do `trim()`. Em `exit-detail.component.ts`, o `[disabled]` sai de "Rejeitar", e o aviso passa a "Aprovação indisponível até a conferência simulada. Você pode rejeitar antes da conferência, com justificativa de 10 a 2.000 caracteres.". `ReviewDialogData` de `features/operations/review-dialog.component.ts` ganha `minReason?: number`, e só `decide(…, 'reject')` passa `10`. Com ele, `confirm()` recusa um texto mais curto, o campo limita a 2.000 caracteres, e a mensagem diz "Escreva de 10 a 2.000 caracteres.". A regra vale também para a rejeição de saída curta da demonstração, que usa o mesmo `decideExit`.
- **Alternativa rejeitada:** esperar decisão da AE. A RN05 e o fluxo alternativo do UC07 (cap4.tex:160, :349) já decidem a regra.

### D6. Na demonstração, limpeza e ranking mudam só no texto e no formato
Em `cleaning.component.ts`:
- o título passa a "Regras da avaliação", com o texto "A nota é a média dos quatro critérios (piso, superfícies, resíduos e organização), de 0 a 10, com duas casas decimais. Uma nota abaixo de 6,00 gera ocorrência para análise. São políticas locais que aguardam o aceite da Assistência Estudantil.";
- as notas e a variação deixam o pipe `number: '1.1-1'` e passam a usar `decimal()` de `features/cleaning/cleaning-local.utils.ts`, o mesmo formatador do acesso por conta. Ele formata em pt-BR com duas casas. A aplicação não registra o locale pt-BR, então o pipe `number` imprimiria "7.50";
- a nota de posição passa a "Esta posição foi preparada para a demonstração. No ranking, quartos com a mesma nota ficam na mesma posição.".

Em `ranking.component.ts`:
- o título do aviso passa a "Como o ranking é calculado", com o texto "Média dos quatro critérios, com duas casas; empates repetem a posição e quarto sem avaliação não recebe zero. Posições e períodos são exemplos sintéticos.";
- a nota da última simulação mostra `decimal(feedback.next)` e termina em "A classificação acima é um exemplo preparado para a demonstração.".

Em `operations-demo.service.ts:257`, a evidência passa a "Nota de limpeza abaixo de 6,00.".
- **Alternativa rejeitada:** calcular nota e ranking de verdade na demonstração. Isso dá mais código sem ganho, porque o RF027 só pede dados fictícios e a monografia mostra cenários preparados.

### D7. O fechamento em data posterior usa a data do servidor
`windowReview` passa a receber o motivo da exceção. `open()` usa `context.outsideWindow`. `close()` usa `context.outsideWindow || call.referenceDate !== context.referenceDate`, e as duas datas vêm do servidor. Quando só a data difere, o aviso é "A chamada é de um dia anterior. Marque a confirmação e escreva o motivo.", e a declaração é "Confirmo o fechamento da chamada de um dia anterior.".
- **Alternativa rejeitada:** comparar com a data do navegador. A monografia manda usar o relógio do servidor (cap4.tex:218).
- **Demonstração:** não acompanha. A chamada da demonstração é uma simulação com o próprio alerta de registro tardio, descrito em cap7.tex:41.

### D8. Datas fictícias fixas, com teste numa data fixa
Os nascimentos passam a ser Beatriz Costa em 2010-08-22 e Pedro Henrique Silva em 2009-12-03. Um teste Vitest fixa o relógio em 2026-12-31 e confere que todo residente de `OperationsDemoService.minors` tem, em `ManagementDemoService`, menos de 18 anos. Com as datas atuais, o teste falha nos dois residentes.
- **Alternativa rejeitada:** calcular os nascimentos a partir de hoje. Isso dá mais código, e os relatórios e as figuras da demonstração também usam datas fixas.

### D9. A auditoria das contas entra com um recurso e uma origem novos, na V33
- **Recurso `LOCAL_ACCOUNT`.** Os campos permitidos são `enrollment`, `email`, `name`, `profile`, `password`, `active`, `residentId` e `supervisorId`, sempre só os nomes (RN17). A conta não tem versão, por isso `resulting_version` é 0.
  - Criar grava `CREATE` com os campos informados.
  - Trocar a senha, pela recuperação ou pelo `reset`, grava `UPDATE` com `password`.
  - Desativar grava `END` com `active`.
  - Vincular ou desvincular grava `UPDATE` com `residentId` ou `supervisorId`.
  - Atribuir matrícula grava `UPDATE` com `enrollment`.
- **Recuperação.** O ator é a própria conta, com perfil `residente` e origem `LOCAL_API`, e a correlação vem da requisição (`RequestCorrelationFilter`). O `AuditService` ganha um método que recebe o ator explicitamente, porque a requisição é anônima e `AuditContextProvider.requireContext()` exige um principal. O evento é gravado depois de `updatePassword` devolver 1, na mesma transação `@Transactional`. Uma recusa sai antes, por exceção, e não grava nada.
- **Terminal.** A origem nova é `OPERATOR_CLI`, sem autor, com um `request_id` aleatório por comando. Os métodos do `LocalAccountProvisioningService` gravam o evento só quando não há requisição HTTP em curso (`RequestContextHolder.getRequestAttributes() == null`), e o método novo do `AuditService` também recusa ser chamado durante uma requisição, como já faz `recordSystem`. No cadastro assistido nada muda, e a conta fica coberta pelo evento do residente ou do supervisor.
- **V33 (`V33__local_account_audit.sql`).** Segue o padrão da V20 e da V29: lê a expressão atual de `sager_audit_event_resource_allowed` e de `sager_audit_event_changed_fields_allowed` e soma a cláusula de `LOCAL_ACCOUNT`. Também recria `sager_audit_event_origin_allowed` com `OPERATOR_CLI` e `sager_audit_event_origin_actor_valid` com `(origin = 'OPERATOR_CLI' AND actor_id IS NULL AND actor_profile IS NULL AND resource = 'LOCAL_ACCOUNT')`. Não altera nenhuma linha.
- **Consulta.** `AuditRepository.find` inclui `'LOCAL_ACCOUNT'` na lista de recursos consultáveis.
- **Alternativas rejeitadas:**
  - Auditar sem migração, como um `UPDATE` de `RESIDENT`. Seria um evento falso, e o CHECK de campos do residente não aceita `password`.
  - Usar `SYSTEM_JOB` para o terminal. A monografia separa o sistema do operador técnico (cap4.tex:51), e misturar as duas origens esconderia quem agiu.
  - Gravar o evento no runner. Ele ficaria fora da transação da escrita, contra a RN16.
  - Criar uma coluna de versão na conta. Seria uma migração maior sem controle de concorrência que a use.
  - Criar uma origem própria para a recuperação. O ator igual ao recurso já identifica a recuperação pelo próprio residente.

### D10. Ordem e arquivos compartilhados
Os grupos de frontend (1 a 8 em tasks.md) não dependem de outras changes. Eles tocam arquivos que outras também editam:
- `resident-detail.component.ts`, também editado por `track-course-conclusion` (3.4 e 4.4) e `add-accommodation-age-group` (6.1);
- `portal.pages.ts`, também editado por `hide-exits-for-adults` e `remove-health-module`;
- `management-demo.service.ts`, também editado por `simplify-room-browsing`;
- `exit-detail-local.component.ts`, também editado por `hide-exits-for-adults` (3.4);
- `night-call-local.component.ts`, também editado por `simplify-long-lists` (8.1).

Duas changes conferem com `git diff` que arquivos só da demonstração não mudaram, e esta change altera alguns deles:
- o grupo 5 altera `exit-detail.component.ts`, e os grupos 5 e 6 alteram `operations-demo.service.ts`. A tarefa 5.1 de `hide-exits-for-adults` confere os dois com `git diff --name-only`;
- o grupo 6 altera `cleaning.component.ts` e `ranking.component.ts`, que a tarefa 9.2 de `simplify-long-lists` confere com `git diff --stat`.

Se uma dessas changes for aplicada junto com esta, sem commit entre as duas, a conferência dela deve comparar com o estado anterior à própria aplicação, não com o HEAD.

Esses grupos se aplicam sobre a versão do momento. O grupo 9 (auditoria) vem depois de `remove-health-module`, que edita `AuditResource`, `AuditRepository`, `AuditService`, `LocalAccountProvisioningService` e o runner. O grupo 9 também edita `LocalAccountRepository.java`, que `hide-exits-for-adults` (2.1) altera, e `AuditResource.java`, que `add-accommodation-age-group` (2.1) altera. Ele só entra quando V30, V31 e V32 já estiverem em `db/migration`, porque o Flyway recusa uma versão menor criada depois de uma maior já aplicada.

## Risks / Trade-offs

- [As datas fictícias envelhecem: Ana Luísa faz 18 anos em 14/06/2027 e Pedro em 03/12/2027] → O teste usa a data fixa de 31/12/2026. Antes de junho de 2027, é preciso revisar o cenário fictício.
- [Algum dia, um endpoint da API pode chamar um método de conta sem gravar evento próprio] → Dentro de uma requisição, os métodos de conta não gravam evento. Um comentário no ramo registra que eles são cobertos pelo cadastro assistido, e o teste do terminal confere a origem `OPERATOR_CLI`.
- [A V33 pode chegar ao banco antes de V30–V32 e quebrar o Flyway] → A tarefa 9.1 é uma pré-condição explícita, e a V33 só é criada depois de conferir os arquivos.
- [A recuperação passa a expor ao gestor e ao supervisor, pela auditoria, que um residente trocou a senha] → É o objetivo da RN16. O evento não leva a senha, o hash nem os dados informados.
- [O texto "aguardam o aceite da Assistência Estudantil" fica velho quando a AE aceitar] → Basta trocar o texto. Nenhuma regra depende dele.

## Migration Plan

1. Implantar os grupos de frontend em qualquer ordem, desde que o grupo 4 não entre antes do grupo 3. Eles não mexem em dados.
2. Depois que V30, V31 e V32 estiverem aplicadas, implantar o grupo 9. A V33 só troca restrições e não altera linhas. O papel de migração (`sager_owner`) aplica a V33, e o `sager_runtime` já tem INSERT na auditoria.
3. Reversão: o código antigo continua funcionando com a V33, porque as restrições só ficam mais permissivas para o recurso e a origem novos. Basta voltar o código. Os eventos gravados ficam, como manda a retenção permanente.

## Pendências

- **Assistência Estudantil:** aceite da fórmula da nota, do limiar de 6,00 e do desempate do ranking (cap4.tex:220). A tela já diz que são políticas locais.
- **Monografia, depois de aplicada a V33** (complementa a seção 5.7 do plano de reconciliação):
  - cap5.tex:25 e :45 passam a "da V1 à V33"; cap5.tex:102 passa a "33 versões de migração, de V1 a V33"; conclusao.tex:10 passa a "33 migrações versionadas, de V1 a V33";
  - em cap5.tex:140, no fim do fecho estendido pela seção 5.7 do plano, "…, a conclusão do curso e a faixa etária do alojamento." passa a "…, a conclusão do curso, a faixa etária do alojamento e a auditoria das contas (recuperação de senha e comandos do terminal).";
  - na tab:migracoes, entra a linha "V33 & Auditoria das contas: recuperação de senha do residente e comandos de contas do terminal, com origem própria. \\ \hline";
  - opcional em cap5.tex:173: "A recuperação de senha do residente e os comandos de contas do operador também geram eventos; os do terminal têm origem própria e não têm autor."
- **Operador:** nenhuma ação nova. A consulta de auditoria passa a mostrar os comandos de contas com origem `OPERATOR_CLI`.
