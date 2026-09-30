# Fundação técnica da API local

**Data:** 30/09/2026. **Resultado:** implementação e validação técnica em
desenvolvimento, com dados sintéticos. A configuração de produção e a
homologação institucional continuam nas fases correspondentes.

## Contrato comum

Cada requisição recebe um UUID criado pelo servidor em `X-Request-Id`. Um valor
enviado pelo cliente não substitui essa correlação. Erros retornam
`{ code, message, requestId }`, incluindo JSON inválido, tipos incorretos,
conflitos de versão, autorização, CSRF, método e formato não suportados.
Falhas inesperadas retornam uma mensagem genérica: SQL, pilha e conteúdo da
exceção não são enviados ao cliente. O log registra o tipo da falha e a
correlação, sem valores dos campos pessoais.

Datas civis usam ISO `YYYY-MM-DD`; instantes são persistidos em UTC. IDs são
UUIDs. Escritas sobre registros existentes exigem uma versão inteira não
negativa; a versão lida fica obsoleta depois de uma alteração concorrente.
Os recursos atuais de gestão mantêm suas validações e códigos de domínio.

`GET /api/v1/openapi` e `/api/v1/openapi.yaml` publicam o contrato implementado
para gestor e supervisor autenticados. O documento descreve o cookie de sessão,
o token CSRF, campos obrigatórios, tipos, versões e respostas. A documentação
permanece desabilitada fora do perfil local.

## Auditoria transacional

A migração V11 cria `sager_audit_event`. As 15 operações de gravação dos seis
serviços atuais registram criação, atualização ou encerramento na mesma
transação dos dados. A transferência de quarto encerra e cria as alocações
com a mesma correlação. Se a gravação da auditoria falhar, a alteração é
revertida; conflito ou validação recusada não produz evento de sucesso.

Cada evento contém sequência, UUID, instante, conta autora, perfil, origem,
correlação, tipo e ID do recurso, ação, versão resultante e nomes dos campos
alterados. A comparação considera os valores normalizados. Não são guardados
valores anteriores ou novos, nomes, matrícula, telefone, senha ou conteúdo
médico. Uma atualização sem mudança de valor pode registrar uma lista vazia.

`GET /api/v1/auditoria` aceita filtros `resource`, `resourceId`, `actorId` e
`requestId`. A página usa ordem decrescente de sequência, limite padrão 50,
máximo 100 e cursor `beforeSequence`; a resposta contém `items` e
`nextCursor`. Gestor e supervisor consultam; residente não tem acesso.

Triggers recusam `UPDATE`, `DELETE` e `TRUNCATE`; não há retenção com exclusão,
nem preenchimento retroativo dos registros anteriores à V11. Os eventos não
dependem de chaves estrangeiras removíveis para contas ou cadastros. A escolha
do solicitante é manter a auditoria permanentemente.

**Limite do banco local:** o proprietário ou superusuário pode alterar tabelas
e desabilitar triggers. A implantação deve separar o usuário de migrações do
usuário da aplicação e controlar o acesso administrativo; a prova local não
estabelece proteção contra um administrador do PostgreSQL.

## Vínculo entre conta e cadastro

A V12 acrescenta vínculos opcionais, exclusivos e únicos para residente ou
supervisor, compatíveis com o perfil da conta. Contas existentes permanecem
sem vínculo. Não há associação automática por e-mail, nome ou matrícula.
`/api/v1/auth/me` informa `residenteId` e `supervisorId`, UUID ou `null`.

A CLI realiza o vínculo explicitamente e invalida as sessões da conta quando
ele muda. O filtro de sessão e `/auth/me` conferem o estado vigente. O perfil
do Angular mostra a referência vinculada ou explica a ausência de vínculo;
metadados inválidos não são aceitos como identidade local. As próximas
operações próprias do residente usarão esse vínculo no servidor.

## Observabilidade

Logs de console têm estrutura JSON e correlação por requisição. Actuator
expõe somente saúde técnica e métricas a gestor/supervisor autenticados,
sem detalhes ou componentes da saúde. Não há interface pública de
monitoramento, nem registro de corpos de requisições. Alertas, infraestrutura,
backup e validação de produção pertencem à Fase 7.

## Evidência de validação

Os testes PostgreSQL/HTTP cobrem migrações, imutabilidade, autorização,
correlação, rollback, concorrência e transferência atômica. O contrato OpenAPI
é conferido contra as validações atuais; a coerção de versões fracionárias ou
textuais de supervisor foi corrigida após um teste de regressão falhar.
Os comandos e totais observados estão no [QA](../fase-2/QA.md).

A prova integrada sem interceptação de API usou PostgreSQL 17.11 descartável,
API local e Angular: criação e edição de residente, criação de supervisor,
consulta dos eventos, vínculos pela CLI, revogação de sessão e bloqueio do
residente nas APIs de gestão/auditoria. Após reiniciar a API sobre o mesmo
banco, as mesmas sessões autenticadas, cadastros, vínculos e eventos
permaneceram válidos. Não houve cookies ou senhas gravados no repositório.

Capturas sintéticas inspecionadas em [desktop](../../.impeccable/reviews/pr-auditoria-perfil-desktop.png)
e [320 px](../../.impeccable/reviews/pr-auditoria-perfil-mobile.png).
O [perfil anterior](../../.impeccable/reviews/pr-auditoria-perfil-before-desktop.png)
foi capturado da `main` anterior com `/me` sintético para comparação visual.
O banco e os processos específicos da prova foram encerrados ao final.
