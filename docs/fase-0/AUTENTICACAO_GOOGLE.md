# Fase 0 — contrato de autenticação Google

**Estado em 25/09/2026:** contrato e prova técnica local implementados em
[`backend/`](../../backend/README.md). **D21 e a homologação da Fase 0 continuam
pendentes de login real e aceite da TI/AE.** Os testes sintéticos não demonstram que
o cliente OAuth do SAGER esteja autorizado no Google Workspace.

**Base:** [PRD v2.0, E01, AC01–AC03 e D01/D21](../../SAGER_PRD_v2.0_Angular_SpringBoot.md),
[especificação técnica v2.0, seção 6](../../SAGER_Especificacao_Tecnica_v2.0.md) e
[roteiro de implementação](../ROADMAP_IMPLEMENTACAO.md).

## Fluxo e limites da identidade

1. O navegador inicia `GET /oauth2/authorization/google` na mesma origem da interface.
   O Spring Security OAuth2 Login inicia **Authorization Code**, com `state` para
   correlacionar a resposta e os escopos estritamente necessários `openid profile email`.
2. Google autentica o usuário e redireciona para
   `/login/oauth2/code/google`, URI registrada exatamente no cliente OAuth. O backend
   confere `state` e troca o código com Google por canal HTTPS. O Angular não recebe o
   código, `client_secret`, access token ou ID token.
3. O backend valida o ID token com as chaves publicadas pelo provedor: assinatura,
   emissor (`iss`), audiência (`aud` igual ao client ID configurado), prazo (`exp` e
   `iat`) e `nonce` quando enviado. Rejeita token inválido ou vencido. A biblioteca
   OIDC/Spring Security faz a validação protocolar; a aplicação acrescenta as regras
   institucionais abaixo. Não decodificar JWT sem verificação para tomar decisões.
4. O vínculo local usa a chave única **(`iss`, `sub`)**. O `sub` é estável para a conta
   Google mesmo se o e-mail mudar; o e-mail é atributo de contato, nunca chave de
   identidade. Uma mudança de endereço atualiza o atributo da identidade já vinculada,
   sujeita às regras de auditoria. Não tentar juntar automaticamente duas identidades
   porque seus e-mails coincidem.
5. Exigir `email` presente e `email_verified=true`. `name` e `picture` podem faltar;
   armazená-los como opcionais. A URL de foto é dado de apresentação, não prova de
   identidade. **Matrícula não é claim do login Google padrão, não será inferida do
   e-mail e fica fora deste contrato e da Fase 0.** A origem e a validação da matrícula
   serão decididas em D02 antes da fatia cadastral que depende dela.

O IF Goiano [publica o uso de contas institucionais Google nos domínios
`ifgoiano.edu.br` e `estudante.ifgoiano.edu.br`](https://www.ifgoiano.edu.br/home/index.php/noticias-ppgaq/25083-informes-sobre-armazenamento-da-conta-google.html).
Isso é evidência de uso de contas, **não** de que o cliente OAuth do SAGER esteja
autorizado, nem dos valores reais do claim `hd` nessas contas. A TI deverá autorizar o
cliente e o teste deverá observar o `hd` de cada tipo de conta permitido. A lista de
valores aceitos será configurada após essa verificação; sem lista aprovada a
autenticação institucional falha fechada. O servidor rejeita `hd` ausente ou fora da
lista. O parâmetro `hd` da requisição pode facilitar a escolha de conta, mas **não é
controle de acesso**; a decisão usa apenas o claim `hd` do ID token validado. O sufixo
do `email` também não comprova associação ao Workspace.

Google comprova a identidade; o SAGER decide acesso. Só um cadastro local ativo,
provisionado por pessoa autorizada e vinculado à identidade `iss` + `sub`, recebe
perfis funcionais. A existência de conta institucional, o domínio, o nome ou a foto
não concedem `gestor`, `supervisor` ou `residente`. A matriz final de perfis e o
provisionamento inicial do gestor dependem de **D01/AE e TI**. A autorização ocorre
no servidor por operação e por registro; conta sem perfil autorizado ou desabilitada
localmente não acessa recursos. O processo de desligamento no Google Workspace e sua
propagação para sessões existentes dependem de acordo com a TI em D21.

## Contrato HTTP inicial

`GET /api/v1/auth/me`, autenticado, devolve `200` com JSON em `camelCase`:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "nome": null,
  "email": "usuario@exemplo.invalid",
  "fotoUrl": null,
  "perfis": ["residente"]
}
```

| Campo     | Contrato                                                                 |
| --------- | ------------------------------------------------------------------------ |
| `id`      | UUID interno do usuário local, estável na aplicação; não é `sub`.        |
| `nome`    | Texto ou `null` quando Google não fornecer nome.                         |
| `email`   | E-mail verificado da identidade vinculada.                               |
| `fotoUrl` | URL da foto ou `null`; opcional para a interface.                        |
| `perfis`  | Perfis locais autorizados; valores finais e combinações dependem de D01. |

Não retornar matrícula, `sub`, ID token, access token, client ID ou segredo nesse
endpoint. Sem sessão válida, responder `401`; usuário autenticado externamente mas
sem cadastro/perfil ativo recebe acesso negado (`403`) e não obtém acesso funcional.
Para erro de provedor ou credencial, apresentar mensagem compreensível sem criar
sessão válida, como exigido por AC02. O contrato de erro seguirá o padrão da
especificação técnica.

O backend manterá sessão com Spring Session JDBC e cookie `Secure`, `HttpOnly` e
`SameSite=Lax` como ponto de partida para o callback GET. A interface e a API
ficarão na mesma origem. CSRF permanece ativo para mutações; o Angular obtém o token
de modo compatível com a versão do Spring Security. `POST /api/v1/auth/logout`
invalida a sessão. Access/refresh tokens não são persistidos em `localStorage` ou
`sessionStorage`. O escopo de login não pede acesso offline nem APIs Google
adicionais. Duração e inatividade propostas na especificação técnica dependem da
política institucional em D21.

## Configuração necessária para a prova real

| Item                                | Preparação                                                                                                                                                             | Situação                                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Cliente OAuth do tipo aplicação web | TI/instituição confirma projeto, proprietário, tela de consentimento, público de teste e política de acesso no Google Workspace.                                       | Existência informada pelo solicitante; autorização da TI/Workspace não comprovada aqui            |
| `client_id` e `client_secret`       | Fornecidos por canal seguro e injetados no backend como variáveis/gerenciador de segredos; nunca em Git, exemplos preenchidos, logs ou frontend.                       | Local seguro ainda não informado ao projeto                                                       |
| Escopos                             | `openid`, `profile`, `email`; sem Directory API ou escopo de matrícula.                                                                                                | Definido para o projeto                                                                           |
| Redirecionamento local              | Registrar exatamente `http://localhost:8080/login/oauth2/code/google` para a prova local.                                                                              | URI gerada pelo backend e verificada em teste sintético; cadastro no cliente ainda não confirmado |
| Redirecionamento institucional      | Registrar `https://<dominio-aprovado>/login/oauth2/code/google` após a TI definir o domínio; validar cabeçalhos de proxy confiáveis para formar a URL externa correta. | Pendente de infraestrutura                                                                        |
| Domínios hospedados                 | Configurar apenas `hd` observado no teste e aprovado pela TI; lista ausente bloqueia todos os logins.                                                                  | Pendente de observação e aceite                                                                   |
| Contas de teste                     | TI/AE indicam titulares de contas institucionais de servidor e estudante e aprovam o perfil local da prova.                                                            | Titulares e perfil não indicados                                                                  |

A prova mínima já declara `spring.security.oauth2.client.registration.google` em
[`application.yml`](../../backend/src/main/resources/application.yml), com client ID e
segredo lidos do ambiente, os três escopos e o redirecionamento padrão
`{baseUrl}/login/oauth2/code/{registrationId}`. O início é
`/oauth2/authorization/google` e o sucesso vai para `/api/v1/auth/me`, sem aceitar
URL pós-login arbitrária. O Nginx e a integração com Angular são trabalho posterior.

## Prova técnica executada e limites

Em 25/09/2026, `backend/mvnw.cmd -B -ntp verify` passou com **16 testes** em
Temurin 21.0.12.1 e Spring Boot 4.1.1. O Testcontainers iniciou PostgreSQL 17.11;
Flyway aplicou as migrações V1 e V2 em banco vazio. Os testes cobriram recusa de `hd`
fora da lista ou lista vazia, e-mail não verificado, identidade desabilitada ou sem
perfil, vínculo estável por `iss` + `sub`, contrato de `/me`, CSRF, logout, cookie
`Secure`/`HttpOnly`/`SameSite=Lax` e revogação de sessão após callback com `state`
desconhecido. Um servidor HTTP real em porta aleatória respondeu `200` em `/`, `401`
em `/api/v1/auth/me`, `200` no endpoint CSRF e `302` no início OAuth. O teste de
redirect em porta 8080 confirmou a URI de retorno exata planejada. A evidência
detalhada está em [QA.md](QA.md) e no [teste de integração](../../backend/src/test/java/br/edu/ifgoiano/sager/auth/AuthFlowIntegrationTest.java).

Nesses testes, o cliente OAuth e os tokens são **sintéticos**. Não houve navegação de
um titular até o Google, troca real de código por token nem confirmação de política
Workspace. O teste de perfil usa um principal OIDC simulado; ele verifica a consulta
ao cadastro local, não substitui a prova institucional. Não foram testados ainda
expiração por inatividade e desligamento institucional; a política depende da TI.

### Registro necessário para homologar D21

| Evidência                                                            | Resultado atual | Responsável, data e referência exigidos                                            |
| -------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------- |
| Cliente web autorizado no Workspace e URI exata cadastrada           | Pendente        | TI: nome/cargo, data e referência da confirmação                                   |
| `hd` do ID token validado para servidor e estudante; lista permitida | Pendente        | TI: valores aceitos, nome/cargo, data e referência                                 |
| Perfil local de teste e regra de concessão                           | Pendente        | AE e TI: perfil aprovado, nome/cargo, data e referência                            |
| Sessão, expiração e desligamento/revogação                           | Pendente        | TI: política, nome/cargo, data e referência                                        |
| Login real de servidor, estudante e conta sem perfil                 | Pendente        | Executores autorizados: data, ambiente e resultado por cenário, sem dados pessoais |
| Aceite final da Fase 0                                               | Pendente        | TI/AE: nomes, datas, referência e eventuais restrições                             |

O [procedimento operacional](../../backend/README.md) explica como iniciar o backend,
observar o `hd` sem copiar o token e conceder um perfil apenas após autorização.

## Roteiro de teste institucional para D21

**Pré-condições:** cliente OAuth autorizado para o público de teste pela TI, política
do Workspace liberada, URI de retorno registrada, backend da prova disponível em
`localhost`, sessão e cadastro local de teste configurados com dados
sintéticos. O teste será executado por titulares/autorizados; este repositório não
guarda senha, token, cookie, captura de ID token nem dados pessoais dos participantes.

1. Com uma conta institucional de servidor autorizada, iniciar o login; confirmar
   retorno à aplicação, `GET /api/v1/auth/me` com UUID local, e-mail verificado,
   nome/foto opcionais e somente o perfil previamente provisionado. Repetir com
   conta estudantil autorizada, se ambas forem destinadas ao SAGER. Registrar apenas
   se o `hd` observado correspondeu ao valor aprovado, sem copiar token ou e-mail.
2. Repetir login da mesma conta após alteração controlada de e-mail, se a TI puder
   disponibilizar o cenário; verificar que o UUID local continua ligado ao mesmo
   `iss` + `sub` e que não surgem duplicatas. Se a TI não puder executar essa
   simulação, registrar a limitação e cobrir a regra com teste automatizado.
3. Tentar conta Google pessoal, conta de outro Workspace, conta sem perfil local e
   conta localmente desabilitada. Todas devem ficar sem acesso funcional; domínio
   do e-mail parecido não supera ausência ou divergência de `hd`.
4. Testar callback com `state` inválido e token inválido/vencido em ambiente de teste
   controlado. Confirmar ausência de sessão válida. Confirmar também mensagem de
   indisponibilidade quando o provedor não responder, sem expor detalhes técnicos.
5. Verificar acesso a endpoint de outro perfil e a registro de outro residente;
   ambos devem ser negados pelo backend. Confirmar cookie protegido, CSRF nas
   mutações, logout, expiração por inatividade e ausência de tokens no armazenamento
   do navegador. Registrar a política real de sessão e desligamento informada pela TI.

**Evidência para encerrar D21:** data/ambiente, aprovação do cliente e da política
Workspace pela TI, tipos de contas testados, valores de `hd` aprovados (sem claims
individuais), resultado por cenário, política de sessão/desligamento e responsável
institucional pela aceitação. Falhas ou cenários indisponíveis permanecem explícitos.
Até executar e registrar essa prova, **AC01/AC02 e AT03 não estão homologados** e a
Fase 0 permanece não homologada quanto ao login real.

## Referências externas

- [Google OpenID Connect: fluxo de servidor, claims e `hd`](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google OpenID Connect: referência de ID token](https://developers.google.com/identity/openid-connect/reference)
- [Spring Security: configuração de OAuth2 Login e URI de retorno](https://docs.spring.io/spring-security/reference/servlet/oauth2/login/core.html)
- [Google Workspace: controles de acesso a aplicativos OAuth](https://developers.google.com/identity/protocols/oauth2/production-readiness/google-workspace)
