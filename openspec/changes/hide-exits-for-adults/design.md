## Context

Motivação em proposal.md. Estado atual, conferido no código desta branch:

- O servidor já decide a elegibilidade: `OperationResidents.eligibility` gera `not_minor` ou `birth_date_required` pela data civil de America/Sao_Paulo, e as saídas curtas e longas respondem 409 `not_eligible`. Só a saída curta tem teste com adulto (`OperationsApiIntegrationTest.rejectsAdultUnallocatedAndUnlinkedResidents`, nascimento 30/09/2008).
- A mesma regra de menoridade está escrita duas vezes: `OperationResidents.java` (linhas 45-46) e `NightCallService.minor` (linhas 235-237).
- `GET /api/v1/auth/me` não diz nada sobre idade. O frontend mostra "Minhas saídas" a todo residente (`app.ts`, `local-home.page.ts`, ajuda em `portal.pages.ts`) e as rotas `saidas*` aceitam qualquer residente (`app.routes.ts`).
- Specs existentes: nenhuma diz que todo residente vê as saídas. O cenário "Residente nas saídas" de `plain-language` continua valendo para quem pode abrir a tela, então não há delta nessa capability.
- Esta change é implementada depois de remove-demo-mode, remove-health-module e speed-up-navigation. O guarda de acesso e o menu terão mudado de forma (sem ramos de demonstração; `/auth/me` consultado só na carga ou sem principal). As tarefas descrevem o comportamento a acrescentar, não as linhas atuais.

## Goals / Non-Goals

**Goals:**
- Uma única regra de menoridade no servidor, dona também do fuso civil.
- A interface esconde as saídas do adulto usando só o que `/auth/me` já devolve, sem requisição extra.
- Cobrir com teste o limite exato do aniversário de 18 anos nos dois tipos de saída.

**Non-Goals:**
- Nenhuma mudança na resposta das APIs de saída nem na chamada noturna.
- Nenhuma configuração do horário 23h/5h e nenhum registro de circulação.

## Decisions

### D1. A maioridade vem do servidor em `/auth/me`

`MeResponse` ganha `boolean maiorDeIdade`, verdadeiro só para conta com residente vinculado, data de nascimento presente e não menor de idade pela regra única (D2). Conta de servidor ou sem data: falso.

Alternativa rejeitada: o frontend calcular a idade a partir da data de nascimento. Duplicaria a regra em TypeScript, com risco de divergir no fuso, e o residente nem sempre lê o próprio cadastro. Também rejeitado: usar `GET /saidas-curtas/elegibilidade` para decidir o menu. Custa uma requisição a mais na carga e mistura o bloqueio `active_allocation_required`, que esconderia as saídas de um menor sem quarto.

### D2. Regra única `FieldRules.minor(LocalDate nascimento, Instant agora)`

O helper converte `agora` para a data civil de America/Sao_Paulo (o `CIVIL_ZONE` que `FieldRules` já tem) e devolve verdadeiro quando há data, ela não está no futuro e o residente ainda não completou 18 anos. `OperationResidents.eligibility` passa a gerar `not_minor` quando há data e `!minor(...)`; `NightCallService` troca o método privado pelo helper; `/auth/me` usa `nascimento != null && !minor(nascimento, clock.instant())` com o `Clock` injetado. O comportamento das saídas e da chamada não muda.

Alternativa rejeitada: assinatura `minor(LocalDate, LocalDate hoje)`, como no `NightCallService`. Deixaria a conversão de fuso em cada chamador, e o limite "22h em Brasília, já outro dia em UTC" só seria testável nas integrações. Também rejeitado: pôr o helper em `OperationResidents`, que é um repositório de perfil `local/production` do pacote de operações; o pacote `auth` passaria a depender de operações. `auth` já importa `FieldRules`.

Uma data de nascimento futura (o cadastro recusa idade abaixo de 10 anos, então só existiria em dado antigo corrompido) continua igual ao servidor de hoje: não é menor, recebe `not_minor`, e `/auth/me` devolve `maiorDeIdade` verdadeiro. A interface fica coerente com a recusa do servidor.

### D3. A data de nascimento é lida a cada `/auth/me`

`LocalAccountRepository` ganha uma consulta por chave primária da data de nascimento do residente vinculado, chamada só para conta com `residentId`.

Alternativa rejeitada: guardar a maioridade no principal da sessão. Ficaria errada no dia do aniversário e depois de uma correção da data no cadastro até o próximo login. Também rejeitado: juntar a data na consulta geral de contas, que mudaria o mapeamento de todas as leituras de conta.

### D4. Guarda nas rotas de saída

Toda rota cujo caminho começa com `saidas` recebe uma marca nos `data` da rota (`minorResident: true`). O guarda de acesso, depois de obter o principal, manda para `/acesso-negado` quando a rota tem a marca e `principal.maiorDeIdade` é verdadeiro. O supervisor não é afetado, porque conta de servidor nunca tem `maiorDeIdade` verdadeiro.

Alternativa rejeitada: esconder o conteúdo dentro de `ExitsComponent` e dos formulários. A página carregaria e chamaria a API para mostrar uma tela vazia, e cada componente repetiria a regra. Também rejeitado: o servidor responder 403 na listagem para adultos. Mudaria o contrato das APIs e não protege nada: são dados do próprio residente.

### D5. Campo opcional no frontend

`LocalPrincipal` ganha `maiorDeIdade?: boolean`; ausente vale falso. `validPrincipal` aceita ausente ou booleano e recusa outro tipo.

Alternativa rejeitada: campo obrigatório. Quebraria os mocks de `/auth/me` em specs e e2e e a convivência com um backend antigo durante a publicação. O padrão ausente = menor é seguro: o servidor continua recusando com 409 e o formulário mostra o bloqueio.

### D6. Aviso no início, ajuda sem guia de saídas

No início do adulto, o cartão "Minhas saídas" sai e entra, no fim da lista, um cartão sem link: título "Horário de saída e volta", texto "Maiores de idade podem sair do IF até 23h e devem voltar até 5h.", ícone `schedule` (já usado no sistema, então já está no subconjunto da fonte de ícones). O texto fica escrito uma única vez no frontend, com o comentário `shortcut: horário fixo no texto; se a AE mudar a regra ou pedir controle, vira configuração ou registro de circulação`. Na ajuda, o guia "Acompanhar saídas" some para o adulto; as perguntas gerais sobre saídas continuam, porque também aparecem para o gestor e não têm link.

Alternativa rejeitada: pôr o aviso como primeiro cartão (destaque). O destaque do início carrega a ação principal com botão; um cartão sem ação ali quebraria o padrão. Também rejeitado: repetir o aviso na ajuda ou buscar o texto no servidor. Ninguém pediu, e seriam dois lugares para corrigir.

### D7. Testes do limite do aniversário com os relógios fixos que já existem

`OperationsApiIntegrationTest` e `LongExitApiIntegrationTest` usam `START = 2026-10-01T01:00:00Z`, que é 22h de 30/09/2026 em Brasília. Nascimento 30/09/2008 = 18 anos completos (recusa); nascimento 01/10/2008 = ainda menor em Brasília, embora em UTC já seja 01/10 (elegível). O segundo caso prova que a data civil é a de São Paulo. O caso adulto da saída curta já existe; faltam o caso da véspera nos dois tipos e o caso adulto da saída longa. `/auth/me` é testado com datas relativas a hoje, porque o contexto de `LocalAccountLinksIntegrationTest` usa o relógio real; o limite e o fuso ficam no teste unitário do helper.

Alternativa rejeitada: trocar o relógio do contexto de `LocalAccountLinksIntegrationTest` por um relógio fixo. Afetaria sessões e o limitador de login nos outros testes da classe.

## Risks / Trade-offs

- [O adulto deixa de ver as saídas que pediu quando era menor] → Decisão tomada (DECISOES R5). A API continua listando; se a AE pedir consulta, basta liberar só a lista e o detalhe no guarda.
- [Pedido pendente ou aprovado de quem faz 18 anos fica travado: aprovar e registrar a partida conferem a elegibilidade de novo, e o residente já não vê a tela para cancelar] → O pedido expira pela rotina atual. Fora do escopo; listado para a AE.
- [Com `/auth/me` consultado só na carga (speed-up-navigation), `maiorDeIdade` pode ficar desatualizado durante uma sessão que atravessa a meia-noite do aniversário] → O servidor continua recusando com 409 e o formulário mostra o bloqueio; o próximo carregamento corrige.
- [O aviso 23h/5h não é cumprido pelo sistema] → O texto só informa. Não há registro de circulação (fora do escopo do PRD).
- [Residente sem data de nascimento continua vendo "Minhas saídas"] → Intencional (backend/README.md: registro sem data não é tratado como maior de idade); o formulário mostra `birth_date_required`.

## Migration Plan

Sem migração de banco. Publicar backend e frontend juntos; se o frontend chegar antes, o campo ausente vale falso e nada muda para o usuário. Reverter é reverter o commit: um frontend antigo ignora o campo novo.

## Pendências institucionais (a confirmar com a AE)

- O texto e a origem da regra "Maiores de idade podem sair do IF até 23h e devem voltar até 5h.": qual regulamento a define e se o sentido é "sair até 23h e voltar até 5h" ou "não sair entre 23h e 5h".
- Se o residente que fez 18 anos deve continuar consultando as saídas antigas (hoje elas somem).
- O que fazer com pedido pendente ou aprovado de quem completa 18 anos antes da partida.
- A data de nascimento cadastrada é a fonte da maioridade; a conferência dessa data continua com a secretaria.

Para o operador: nada a configurar.
