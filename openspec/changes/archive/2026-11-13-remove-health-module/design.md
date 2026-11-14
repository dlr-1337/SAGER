# Design

## Context

Ver proposal.md (Why). Estado atual, conferido no código:

- A V13 criou seis tabelas (`sager_health_grant`, `sager_health_care_assignment`, `sager_health_note`, `sager_health_revision`, `sager_health_share`, `sager_health_custody`), a função `sager_reject_health_document_mutation()` e os gatilhos que impedem UPDATE, DELETE e TRUNCATE em notas e revisões. Ela também acrescentou `saude` às restrições `sager_local_account_profile_allowed` e `sager_audit_event_profile_allowed`, e os seis recursos de saúde às restrições `sager_audit_event_resource_allowed` e `sager_audit_event_changed_fields_allowed`. As migrações V14 a V29 estendem essas duas últimas restrições com `(<check anterior>) OR ...`, então os valores de saúde continuam dentro delas.
- Fora das tabelas de saúde, nenhuma chave estrangeira aponta para `sager_local_account`. Por isso, depois do DROP, uma conta `saude` não tem vínculo com nada.
- `sager_audit_event` tem retenção permanente: os gatilhos da V11 recusam UPDATE, DELETE e TRUNCATE.
- A consulta de auditoria (`AuditRepository.find`) só devolve os recursos de uma lista fixa. Hoje essa lista inclui `HEALTH_GRANT`, `CARE_ASSIGNMENT` e `HEALTH_CUSTODY` e deixa de fora as notas, partilhas e exportações. `AuditService.list` responde 403 quando o filtro pede um recurso protegido. Cada linha lida é convertida para o enum `AuditResource`, que hoje tem os seis valores de saúde.
- `SecurityConfiguration` libera `/api/v1/saude/**` e `/api/v1/minha-saude/**` para qualquer sessão autenticada e termina com `anyRequest().denyAll()`.
- No frontend, `validPrincipal` (`core/local-auth.service.ts`) só aceita perfis da lista `roles`. Um principal com perfil fora dela é tratado como sessão ausente.
- O modo demonstração (RF027, cap4.tex:133) continua. O tipo `Role` fica em `core/demo-session.service.ts`. `DemoEntry.options` e `storedRole` só oferecem gestor, supervisor e residente, então o ramo `'saude'` da `HomePage` (e os de `heading` e `intro`), que fica dentro do `@else` de `@if (!session.active())`, é inalcançável, e os de `HelpPage` e `ProfilePage` só aparecem com uma conta `saude` autenticada; com conta, o início de saúde vem de `healthTasks` em `local-home.page.ts`.
- O comando `--sager-account=create` (`auth/LocalAccountProvisioningRunner.java`) aceita qualquer perfil da lista do serviço e só depois pede a senha no console. O mesmo `LocalAccountProvisioningService.create` também cria, no ato do cadastro, as contas de residente e de supervisor (`ResidentService`, `SupervisorService`). A monografia só prevê o terminal para as contas iniciais de gestor (cap4.tex:51 e :216).

## Goals / Non-Goals

**Goals:**
- Nenhuma rota, tela, perfil ou contrato de API de saúde depois da mudança.
- Nenhum registro de saúde é apagado sem decisão humana: a migração se recusa a rodar se encontrar algum.
- Eventos de auditoria antigos e contas antigas continuam gravados e válidos diante das restrições do banco.

**Non-Goals:**
- Reescrever as restrições históricas de auditoria ou de conta para tirar os valores de saúde.
- Criar uma tela ou uma rota para consultar eventos de auditoria antigos de saúde.
- Mexer na V13 ou em qualquer migração já aplicada.

## Decisions

### D1. A V30 se recusa a rodar se houver qualquer registro de saúde

Antes de qualquer DROP, a `V30__remove_health_module.sql` verifica as seis tabelas num bloco `DO`. Se alguma tiver linha, ela lança uma exceção com mensagem clara. Como o Flyway roda a migração numa transação do PostgreSQL, nada muda e a versão continua 29. Assim, "sem dados de saúde na produção" deixa de depender só de uma conferência manual. O bloqueio também respeita a regra de que revisões de saúde não são apagadas automaticamente.

Alternativa rejeitada: DROP incondicional, confiando na conferência humana. Um engano apagaria registros imutáveis sem volta. Também foi rejeitado exportar os dados dentro da migração: a produção não tem dados, e isso seria código novo sem uso.

### D2. DROP explícito das seis tabelas, sem CASCADE

Um único `DROP TABLE` lista as seis tabelas (o PostgreSQL resolve as chaves entre elas) e um `DROP FUNCTION sager_reject_health_document_mutation()` vem em seguida. Os gatilhos e índices saem junto com as tabelas.

Alternativa rejeitada: `DROP ... CASCADE`. Ele apagaria em silêncio qualquer objeto inesperado que dependa dessas tabelas, como uma view criada à mão pelo operador. É melhor que a migração falhe e mostre o que existe.

### D3. Contas `saude` são desativadas, não apagadas, e a restrição de perfil da conta não muda

A V30 faz `UPDATE sager_local_account SET active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE profile = 'saude'`. O filtro de estado da conta já encerra as sessões de conta inativa. Na aplicação, o provisionamento passa a aceitar só gestor, supervisor e residente.

Alternativas rejeitadas:
- Restringir `sager_local_account_profile_allowed` aos três perfis. A restrição falharia em qualquer banco que tenha uma conta `saude`.
- Fazer a mesma restrição com `NOT VALID`. O PostgreSQL passaria a recusar até a atualização dessas linhas, e DECISOES.md (R1) já evita `NOT VALID`.
- Apagar as contas. Isso perde histórico, e eventos de auditoria ficariam apontando para um ator que não existe mais.

### D4. As restrições de auditoria não mudam

`sager_audit_event_profile_allowed`, `resource_allowed` e `changed_fields_allowed` mantêm os valores de saúde. Recriar a restrição sem esses valores revalidaria todas as linhas e falharia num banco com eventos antigos de saúde, e não dá para apagar esses eventos. Como a aplicação deixa de escrever esses valores, aceitá-los no banco só serve para manter válidas as linhas antigas.

Alternativa rejeitada: recriar as três restrições com `NOT VALID`. Seriam três restrições reescritas a partir do texto atual, que vem encadeado desde a V14, para barrar valores que nenhum código escreve.

### D5. A consulta de auditoria deixa de ver os eventos antigos de saúde

Saem do enum `AuditResource` os seis valores de saúde, o campo `protectedHealthContent` e a recusa 403 em `AuditService.list`. Também saem `HEALTH_GRANT`, `CARE_ASSIGNMENT` e `HEALTH_CUSTODY` da lista fixa da consulta. Os eventos antigos de saúde continuam na tabela, mas não ocupam páginas nem mexem no cursor, como já acontece hoje com as notas. Um filtro `resource=HEALTH_NOTE` (ou qualquer valor removido) vira parâmetro inválido e recebe 400 pelo tratamento existente de `MethodArgumentTypeMismatchException`. O operador ainda lê esses eventos por SQL.

Alternativa rejeitada: manter `HEALTH_GRANT`, `CARE_ASSIGNMENT` e `HEALTH_CUSTODY` como valores "legados" só para leitura. Isso deixaria vocabulário do módulo no código para um conjunto de linhas que é vazio na produção. Também foi rejeitado criar um valor genérico de evento legado: seria código novo para zero linhas.

### D6. As rotas de saúde da API caem na recusa geral

Sai a regra de `/api/v1/saude/**` e `/api/v1/minha-saude/**` em `SecurityConfiguration`. Essas rotas passam a receber `anyRequest().denyAll()`: 401 sem sessão e 403 com sessão. Isso cumpre "Keep APIs closed for unknown profiles".

Alternativa rejeitada: responder 410 Gone numa rota própria. Seria código novo para um endereço que nenhum cliente chama.

### D7. O OpenAPI perde os contratos de saúde e os ajudantes que só eles usavam

Saem `healthContracts`, `optionalRequest` e `reasonAndVersion` de `OpenApiConfiguration.java`, depois de confirmar com grep que nenhum outro contrato os usa. Sai também `br.edu.ifgoiano.sager.health` de `springdoc.packages-to-scan` em `application-local.yml`.

Alternativa rejeitada: manter os ajudantes "para depois". Seria código morto.

### D8. O frontend recusa o perfil e não redireciona as rotas antigas

O tipo `Role` e a lista `roles` perdem `saude`. Uma sessão com esse perfil é tratada como ausente e vai para `/acesso`. Os endereços `/saude/**` e `/minha-saude` caem na rota `**` e mostram a página "não encontrada". `app.ts` perde o item de menu, o rótulo do perfil, `/saude/acessos` dos cadastros e o sinal `healthAccessPage`. `app.html` perde a condição `exact` ligada a ele. Os ramos `session.active()`/`isDemo()` e os `*-demo.service` ficam: a demonstração acompanha a mudança sem trabalho próprio, porque nunca ofereceu o perfil `saude`.

Alternativa rejeitada: redirecionar `/saude` para `/inicio`. Seria uma rota mantida só para um endereço que ninguém usa.

### D9. Testes: apagar os do módulo e reescrever os que ainda verificam outra regra

Os testes do módulo são apagados. Os testes que usavam `saude` só como "outro perfil" passam a usar `gestor`, que também é uma conta sem vínculo. `AuditHealthPrivacyApiIntegrationTest` vira `AuditLegacyEventsApiIntegrationTest`, que prova D5. O novo `audit/HealthRemovalMigrationIntegrationTest` prova D1 a D4, no mesmo molde de `OperationsMigrationIntegrationTest`: migra até a 29, insere dados e migra até o fim.

Alternativa rejeitada: só apagar os testes. Isso deixaria sem prova a preservação da auditoria e o bloqueio da V30.

### D10. O terminal só cria contas de gestor

No `case "create"` do runner, um `--profile` diferente de `gestor` vira `IllegalArgumentException` antes de `readConfirmedPassword()`. O tratamento existente devolve código de saída 2 e imprime "Comando de contas recusado: Pelo terminal só se criam contas de gestor; residentes e supervisores recebem a conta no próprio cadastro." Nenhuma senha é pedida e o banco não muda. A ajuda mostra `--profile=gestor`. A opção continua obrigatória, então quem já passa `--profile=gestor` (o smoke de `infra/coolify/smoke.py`, os exemplos de README.md e docs/OPERACAO.md) não muda nada.

Alternativas rejeitadas:
- Restringir em `LocalAccountProvisioningService`. Quebraria a criação da conta no cadastro de residente e de supervisor, que usa o mesmo serviço.
- Tirar a opção `--profile` e assumir gestor. Um comando antigo com `--profile=residente` criaria um gestor sem aviso.

## Risks / Trade-offs

- [Um banco local com dados sintéticos de saúde não sobe a nova versão] → A mensagem da V30 explica o motivo. Como os dados são sintéticos, basta recriar o volume do banco local (`SAGER_DB_VOLUME` próprio ou `./sager down` seguido da remoção do volume).
- [A produção tem uma conta ou um registro de saúde que ninguém lembra] → A V30 aborta sem alterar nada, e o deploy para antes de mudar o esquema. Antes do deploy, o operador confere as contagens (Migration Plan).
- [Eventos antigos de saúde somem da consulta da API] → Eles continuam na tabela, com retenção permanente, e o operador os lê por SQL. Na produção esse conjunto é vazio.
- [Conflito de arquivos com `speed-up-navigation` (app.routes.ts, core/)] → Ordem fixa por ondas: esta mudança vem antes da parte frontend de `speed-up-navigation`. As tarefas citam o arquivo e o símbolo, não números de linha.
- [Um operador ou script ainda cria residente ou supervisor pelo terminal] → O comando falha com código 2, sem pedir senha nem mudar o banco, e a mensagem diz onde criar a conta (D10). Os documentos que ainda mostram `--profile=residente` são corrigidos fora desta mudança, e a tarefa 5.2 os lista.
- [O vocabulário "saúde" continua em lugares legítimos] → A varredura final tem uma lista explícita de exceções: V13, V30, o teste da V30, os probes `/actuator/health` e o aviso das conversas do WhatsApp.

## Migration Plan

1. Antes do deploy, na produção, o operador roda a contagem das seis tabelas e de `sager_local_account WHERE profile = 'saude'` e guarda o resultado. Se alguma contagem passar de zero, o deploy para e a AE decide (abaixo).
2. Fazer backup do banco pelo roteiro do Coolify (`infra/coolify/README.md`).
3. Fazer o deploy. A V30 roda no papel de migração. Conferir em `flyway_schema_history` que a versão 30 entrou com sucesso.
4. Rollback: a versão anterior do backend não valida um histórico com a V30, porque o Flyway recusa migração aplicada e desconhecida. Voltar exige restaurar o backup do passo 2 e a imagem anterior. Como as tabelas apagadas estavam vazias, nenhum dado se perde nesse caminho.

## Open Questions

O que a instituição (AE) ou o operador ainda decide:

- A confirmar com a AE: o SAGER fica com três perfis (gestor, supervisor e residente), como na monografia, e não guarda registro de atendimento de saúde. Uma volta futura seria uma mudança nova, com spec própria, base legal (LGPD, art. 11) e regras de sigilo profissional definidas pela instituição.
- A confirmar com a AE: o canal institucional que o aviso das conversas chama de "canal próprio" para assuntos de saúde. O texto da tela não muda nesta mudança.
- Operador: conferir as contagens zero na produção antes do deploy (Migration Plan, passo 1).
- Operador: recriar bancos locais que ainda tenham dados sintéticos de saúde.
- AE: a retenção dos eventos antigos de auditoria de saúde, que guardam só metadados e que, pela regra atual, são permanentes. Na produção eles não existem.
