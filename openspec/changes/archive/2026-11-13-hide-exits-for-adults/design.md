## Context

Motivação em proposal.md. Estado atual, conferido no código desta branch:

- O servidor já decide a elegibilidade: `OperationResidents.eligibility` gera `not_minor` ou `birth_date_required` pela data civil de America/Sao_Paulo, e as saídas curtas e longas respondem 409 `not_eligible`. Só a saída curta tem teste com adulto (`OperationsApiIntegrationTest.rejectsAdultUnallocatedAndUnlinkedResidents`, nascimento 30/09/2008). Pedir, editar, aprovar e registrar a partida conferem a elegibilidade; cancelar não.
- A mesma regra de menoridade está escrita duas vezes: `OperationResidents.java` (linhas 45-46) e `NightCallService.minor` (linhas 235-237).
- `GET /api/v1/auth/me` não diz nada sobre idade. O frontend mostra "Minhas saídas" a todo residente (`app.ts`, `local-home.page.ts`, ajuda em `portal.pages.ts`). As rotas que terminam em `/nova` ou `/editar` já são só do perfil residente; a lista e os detalhes são do supervisor e do residente (`app.routes.ts`, linhas 100-104).
- A lista local (`exits-local.component.ts`) mostra ao residente "Pedir saída curta" e "Pedir saída longa". Os detalhes locais (`exit-detail-local.component.ts`, `long-exit-detail.component.ts`) mostram "Mudar pedido" e "Cancelar pedido" conforme as capacidades devolvidas pelo servidor, que não olham a idade.
- Specs existentes: o cenário "Residente nas saídas" de `plain-language` exige os botões de pedido para todo residente que abre as saídas; como o adulto agora abre a lista sem eles (D4), a change traz um delta MODIFIED nessa capability.
- Esta change é implementada depois de remove-health-module e speed-up-navigation (`/auth/me` consultado só na carga ou sem principal). O modo demonstração (RF027) fica: o guarda e o menu mantêm os ramos `session.active()` da demonstração (hoje `app.routes.ts:15` e `app.ts:138`). A checagem de `maiorDeIdade` vale só para a conta local; sem principal, na demonstração, vale falso. As tarefas descrevem o comportamento a acrescentar, não as linhas atuais.

## Goals / Non-Goals

**Goals:**
- Uma única regra de menoridade no servidor, dona também do fuso civil.
- A interface tira do adulto os atalhos, o pedido e a edição de saídas usando só o que `/auth/me` já devolve, sem requisição extra, e mantém a consulta das saídas dele só para leitura.
- Cobrir com teste o limite exato do aniversário de 18 anos nos dois tipos de saída.

**Non-Goals:**
- Nenhuma mudança na resposta das APIs de saída nem na chamada noturna.
- Nenhuma configuração do horário 23h/5h e nenhum registro de circulação.
- Nenhuma mudança na demonstração (D8).

## Decisions

### D1. A maioridade vem do servidor em `/auth/me`

`MeResponse` ganha `boolean maiorDeIdade`, verdadeiro só para conta com residente vinculado, data de nascimento presente e não menor de idade pela regra única (D2). Conta de servidor ou sem data: falso.

Alternativa rejeitada: o frontend calcular a idade a partir da data de nascimento. Duplicaria a regra em TypeScript, com risco de divergir no fuso, contra a restrição de usar o relógio do servidor (cap4:218), e o residente nem sempre lê o próprio cadastro. Também rejeitado: usar `GET /saidas-curtas/elegibilidade` para decidir o menu. Custa uma requisição a mais na carga e mistura o bloqueio `active_allocation_required`, que esconderia as saídas de um menor sem quarto.

### D2. Regra única `FieldRules.minor(LocalDate nascimento, Instant agora)`

O helper converte `agora` para a data civil de America/Sao_Paulo (o `CIVIL_ZONE` que `FieldRules` já tem) e devolve verdadeiro quando há data, ela não está no futuro e o residente ainda não completou 18 anos. `OperationResidents.eligibility` passa a gerar `not_minor` quando há data e `!minor(...)`; `NightCallService` troca o método privado pelo helper; `/auth/me` usa `nascimento != null && !minor(nascimento, clock.instant())` com o `Clock` injetado. O comportamento das saídas e da chamada não muda.

Alternativa rejeitada: assinatura `minor(LocalDate, LocalDate hoje)`, como no `NightCallService`. Deixaria a conversão de fuso em cada chamador, e o limite "22h em Brasília, já outro dia em UTC" só seria testável nas integrações. Também rejeitado: pôr o helper em `OperationResidents`, que é um repositório de perfil `local/production` do pacote de operações; o pacote `auth` passaria a depender de operações. `auth` já importa `FieldRules`.

Uma data de nascimento futura (o cadastro recusa idade abaixo de 10 anos, então só existiria em dado antigo corrompido) continua igual ao servidor de hoje: não é menor, recebe `not_minor`, e `/auth/me` devolve `maiorDeIdade` verdadeiro. A interface fica coerente com a recusa do servidor, e o spec diz o mesmo ("o servidor não considera menor de idade").

### D3. A data de nascimento é lida a cada `/auth/me`

`LocalAccountRepository` ganha uma consulta por chave primária da data de nascimento do residente vinculado, chamada só para conta com `residentId`.

Alternativa rejeitada: guardar a maioridade no principal da sessão. Ficaria errada no dia do aniversário e depois de uma correção da data no cadastro até o próximo login. Também rejeitado: juntar a data na consulta geral de contas, que mudaria o mapeamento de todas as leituras de conta.

### D4. Guarda só nas rotas de pedido e edição; lista e detalhe só para leitura

As rotas que hoje recebem só o perfil residente (`saidas/nova`, `saidas/:id/editar`, `saidas/longas/nova` e `saidas/longas/:id/editar`) ganham a marca `minorResident: true` nos `data`, no mesmo ponto de `app.routes.ts` em que os perfis são atribuídos. O guarda de acesso, depois de obter o principal, manda para `/acesso-negado` quando a rota tem a marca e `auth.principal()?.maiorDeIdade === true`. Na demonstração não há principal, então a condição é falsa e nada muda. O supervisor não entra nessas rotas (não tem o perfil), e conta de servidor nunca tem `maiorDeIdade` verdadeiro.

`saidas`, `saidas/:id` e `saidas/longas/:id` não recebem a marca: o adulto continua abrindo a lista e os detalhes pelo endereço e vê a situação e a decisão, como pede a pós-condição do UC07 (cap4:351). Na lista local, "Pedir saída curta" e "Pedir saída longa" somem para o adulto. Nos detalhes locais (curta e longa), somem "Mudar pedido" e "Cancelar pedido", porque a monografia só dá essas ações ao residente "se menor de idade" (cap4:56, :77). Os componentes da demonstração (`exits.component.ts`, `exit-detail.component.ts`, `exit-form.component.ts`) não mudam.

Alternativas rejeitadas:
- Manter "Minhas saídas" no menu do adulto, só para leitura. Contraria o pedido R5 do dono, que quer o adulto sem o atalho no menu, no início e na ajuda.
- Marcar todas as rotas `saidas*` e esconder também a lista e o detalhe. O adulto deixaria de ver a decisão das saídas que pediu quando era menor, contra a pós-condição do UC07, e a monografia precisaria de uma ressalva.
- Esconder o conteúdo dentro dos formulários de pedido. A página carregaria e chamaria a API para mostrar uma tela vazia, e cada componente repetiria a regra.
- O servidor responder 403 ao adulto. Mudaria o contrato das APIs sem proteger nada: são dados do próprio residente, e o pedido já é recusado com 409.
- Manter "Cancelar pedido" para o adulto, já que o servidor aceita. A monografia só dá o cancelamento ao menor, e o pedido que não pode mais ser aprovado expira sozinho (RN08).

### D5. Campo opcional no frontend

`LocalPrincipal` ganha `maiorDeIdade?: boolean`; ausente vale falso. `validPrincipal` aceita ausente ou booleano e recusa outro tipo. Os componentes leem `auth.principal()?.maiorDeIdade === true`.

Alternativa rejeitada: campo obrigatório. Quebraria os mocks de `/auth/me` em specs e e2e e a convivência com um backend antigo durante a publicação. O padrão ausente = menor é seguro: o servidor continua recusando com 409 e o formulário mostra o bloqueio.

### D6. Aviso no início, ajuda sem guia de saídas

No início do adulto (acesso por conta), o cartão "Minhas saídas" sai e entra, no fim da lista, um cartão sem link: título "Horário de saída e volta", texto "Maiores de idade podem sair do IF até 23h e devem voltar até 5h.", ícone `schedule` (já usado no sistema, então já está no subconjunto da fonte de ícones). O texto fica escrito uma única vez no frontend, com o comentário `shortcut: horário fixo no texto; se a AE mudar a regra ou pedir controle, vira configuração ou registro de circulação`. Na ajuda, o guia "Acompanhar saídas" some para o adulto; as perguntas gerais sobre saídas continuam, porque também aparecem para o gestor e não têm link. O início da demonstração (`HomePage`, cartão "Minhas saídas", hoje `portal.pages.ts:698-713`) e o texto de ajuda da lista da demonstração (`exits.component.ts:52-56`) ficam como estão; o guia da ajuda continua na demonstração, porque sem principal `maiorDeIdade` é falso.

Alternativa rejeitada: pôr o aviso como primeiro cartão (destaque). O destaque do início carrega a ação principal com botão; um cartão sem ação ali quebraria o padrão. Também rejeitado: repetir o aviso na ajuda ou buscar o texto no servidor. Ninguém pediu, e seriam dois lugares para corrigir.

### D7. Testes do limite do aniversário com os relógios fixos que já existem

`OperationsApiIntegrationTest` e `LongExitApiIntegrationTest` usam `START = 2026-10-01T01:00:00Z`, que é 22h de 30/09/2026 em Brasília. Nascimento 30/09/2008 = 18 anos completos (recusa); nascimento 01/10/2008 = ainda menor em Brasília, embora em UTC já seja 01/10 (elegível). O segundo caso prova que a data civil é a de São Paulo. O caso adulto da saída curta já existe; faltam o caso da véspera nos dois tipos e o caso adulto da saída longa. `/auth/me` é testado com datas relativas a hoje, porque o contexto de `LocalAccountLinksIntegrationTest` usa o relógio real; o limite e o fuso ficam no teste unitário do helper.

Alternativa rejeitada: trocar o relógio do contexto de `LocalAccountLinksIntegrationTest` por um relógio fixo. Afetaria sessões e o limitador de login nos outros testes da classe.

### D8. A demonstração não acompanha a mudança

A demonstração (RF027) não tem principal nem `maiorDeIdade`, e a residente fictícia (Ana Luísa Ribeiro, nascida em 14/06/2009) é menor. Logo, menu, início, ajuda, lista, detalhes e formulários da demonstração continuam iguais, como na Figura 6.6 (cap7:108). Os testes de demonstração que já abrem `/saidas`, `/saidas/nova`, `/saidas/S-1048` e `/saidas/S-1048/editar` com o perfil residente (`e2e/route-audit.spec.ts`, `e2e/journeys.spec.ts`) passam a provar que o guarda novo não a atinge.

Alternativa rejeitada: criar na demonstração um residente maior de idade ou um cenário "residente maior". Exigiria um perfil ou cenário que a monografia não descreve (cap7:20, :108) e dados fictícios novos, só para mostrar um aviso.

## Risks / Trade-offs

- [O adulto não tem atalho para as saídas antigas: só chega a elas digitando `/saidas` ou por um link guardado] → Decisão do dono (R5) para menu, início e ajuda; a pós-condição do UC07 fica atendida porque a lista e o detalhe continuam abertos. Se a AE pedir o atalho, basta devolver o item do menu, só para leitura.
- [Pedido pendente ou aprovado de quem faz 18 anos fica travado: aprovar e registrar a partida conferem a elegibilidade de novo, e o adulto vê o pedido, mas não tem mais o botão de cancelar] → O pedido expira pela rotina atual (RN08), e o supervisor ainda pode cancelá-lo. Fora do escopo; listado para a AE.
- [A API ainda aceita o cancelamento pelo próprio adulto] → Só sobre os próprios pedidos, sem dado de terceiros; o efeito é encerrar um pedido que já não pode ser aprovado. A interface não oferece a ação.
- [Com `/auth/me` consultado só na carga (speed-up-navigation), `maiorDeIdade` pode ficar desatualizado durante uma sessão que atravessa a meia-noite do aniversário] → O servidor continua recusando com 409 e o formulário mostra o bloqueio; o próximo carregamento corrige.
- [O aviso 23h/5h não é cumprido pelo sistema] → O texto só informa. Não há registro de circulação; nenhum requisito da monografia o prevê.
- [Residente sem data de nascimento continua vendo "Minhas saídas"] → Intencional: registro sem data não é tratado como maior de idade (AGENTS.md: o servidor recusa por falta de data); o formulário mostra `birth_date_required` (RN02).

## Migration Plan

Sem migração de banco. Publicar backend e frontend juntos; se o frontend chegar antes, o campo ausente vale falso e nada muda para o usuário. Reverter é reverter o commit: um frontend antigo ignora o campo novo.

## Pendências institucionais (a confirmar com a AE)

- O texto e a origem da regra "Maiores de idade podem sair do IF até 23h e devem voltar até 5h.": qual regulamento a define e se o sentido é "sair até 23h e voltar até 5h" ou "não sair entre 23h e 5h". Só depois disso o texto entra na monografia.
- Se o residente que fez 18 anos deve ter um atalho para as saídas antigas (hoje elas continuam legíveis só pelo endereço `/saidas`, sem item no menu, no início ou na ajuda).
- O que fazer com pedido pendente ou aprovado de quem completa 18 anos antes da partida, e se o adulto deve poder cancelá-lo pela interface.
- A data de nascimento cadastrada é a fonte da maioridade; a conferência dessa data continua com a secretaria.

Para o operador: nada a configurar.
