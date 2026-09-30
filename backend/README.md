# Backend SAGER — login próprio e API local

O solicitante escolheu em 30/09/2026 o login próprio do SAGER por e-mail e senha.
A implementação atual atende somente desenvolvimento e teste no perfil `local`.
Um operador cria as contas e atribui um perfil local; não há cadastro público.
O [roteiro](../docs/ROADMAP_IMPLEMENTACAO.md) e o
[contrato de autenticação](../docs/fase-0/AUTENTICACAO_LOCAL.md) registram os limites.
A antiga prova Google OIDC está [arquivada como evidência](../docs/fase-0/AUTENTICACAO_GOOGLE.md);
integrações com Google e SUAP ficaram para avaliação futura.

## Pré-requisitos

- JDK 21 no terminal do projeto; Maven 3.9.16 vem do Wrapper.
- Docker operacional para PostgreSQL 17.11. Os testes usam Testcontainers.
- `SAGER_DB_PASSWORD` definido no ambiente local por meio seguro. Nunca registre a
  senha em argumento, `.env` rastreado, captura de tela, issue ou chat.
- Banco e aplicação de desenvolvimento executados somente no computador local.
  O perfil `local` vincula o backend a `127.0.0.1:8080`; fora dele, o login local
  fica desabilitado e o acesso falha fechado até existir configuração segura de
  implantação do login próprio, com provisionamento e proteção operacional testados.

No PowerShell, selecione o JDK apenas para o terminal do projeto:

```powershell
$env:JAVA_HOME = Join-Path $env:LOCALAPPDATA 'SAGER\toolchains\jdk-21.0.12.1+1'
$env:PATH = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:PATH
cd backend
.\mvnw.cmd -B -ntp verify
```

O `verify` usa contas sintéticas e PostgreSQL descartável de Testcontainers. Para
iniciar um banco local e o servidor, defina `SAGER_DB_PASSWORD` fora do Git e use:

```powershell
docker compose -p sager-local up -d --wait postgres
.\mvnw.cmd -B -ntp package -DskipTests
java -jar .\target\sager-backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=local
```

O Compose publica PostgreSQL apenas em `127.0.0.1:5432`. Se essa porta estiver
ocupada, defina `SAGER_DB_PORT` e `SAGER_DB_URL` para a mesma porta local antes de
iniciar. `SAGER_DB_URL` tem padrão `jdbc:postgresql://localhost:5432/sager` e
`SAGER_DB_USER` tem padrão `sager`. O comando de provisionamento abaixo usa
exatamente o mesmo banco. Não remova o volume do Compose para trocar ou desativar
contas; essas ações preservam o histórico do banco.

## Provisionamento pelo operador

Com o servidor local parado ou em outro terminal e o banco disponível, execute o
JAR a partir de `backend/`. Use um e-mail **sintético**, por exemplo um endereço no
domínio reservado `exemplo.invalid`. A senha é solicitada duas vezes por um console
interativo com entrada oculta; o comando falha se esse console não estiver disponível.
O modo de provisionamento não inicia Tomcat e encerra ao terminar a operação.

```powershell
java -jar .\target\sager-backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=local --sager-account=create --email=pessoa@exemplo.invalid --name='Pessoa de Teste' --profile=residente
```

`--profile` aceita `gestor`, `supervisor`, `residente` ou `saude`. O perfil `saude`
permite entrar na conta, mas exige habilitação profissional e vínculo assistencial
administrados pela API antes de acessar conteúdo. A CLI não cria essas permissões.
Não informe a senha em
argumentos nem use nomes/e-mails reais nesta prova. Para redefinir a senha ou
desativar a conta, sem criar outra identidade:

```powershell
java -jar .\target\sager-backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=local --sager-account=reset --email=pessoa@exemplo.invalid
java -jar .\target\sager-backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=local --sager-account=disable --email=pessoa@exemplo.invalid
```

Não existe rota HTTP de criação, redefinição ou atribuição de perfis. Redefinir a
senha ou desativar a conta revoga suas sessões existentes; a desativação também
impede novos logins.

### Vínculo explícito com cadastros

Criar um residente ou supervisor na API não cria credenciais. A migração V12
permite que o operador vincule uma conta já provisionada ao UUID de um cadastro
existente. Não há associação automática por nome, e-mail ou matrícula. Nos
exemplos abaixo, substitua os UUIDs pelos IDs dos registros sintéticos consultados
na API e use o e-mail da conta correspondente:

```powershell
java -jar .\target\sager-backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=local --sager-account=link-resident --email=pessoa@exemplo.invalid --resident-id=00000000-0000-4000-8000-000000000002
java -jar .\target\sager-backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=local --sager-account=link-supervisor --email=supervisor@exemplo.invalid --supervisor-id=00000000-0000-4000-8000-000000000003
java -jar .\target\sager-backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=local --sager-account=unlink --email=pessoa@exemplo.invalid --record-id=00000000-0000-4000-8000-000000000002
```

Os comandos de vínculo exigem conta ativa e registro existente. `link-resident`
aceita somente perfil `residente`; `link-supervisor` aceita `gestor` ou
`supervisor`. Uma conta tem no máximo um vínculo, de um desses tipos, e cada
registro pode pertencer a somente uma conta. Vincular não altera o perfil.
`unlink` exige o UUID do vínculo atual; também pode liberar o registro de uma
conta desativada, sem reativá-la. Todos esses comandos exigem somente o perfil
`local` e não iniciam um servidor HTTP.

Alterar ou remover um vínculo revoga as sessões da conta. Repetir o mesmo vínculo
é uma operação sem alteração e preserva as sessões. A cada requisição, o servidor
confere se a conta permanece ativa e se perfil e vínculo correspondem à sessão;
uma sessão com vínculo antigo é recusada. Contas anteriores à V12 permanecem sem
vínculo e podem fazer login local. O vínculo de residente permite somente caminhos
próprios implementados, como `/api/v1/minha-saude`; não concede acesso geral à
gestão ou a outros residentes.

## Operações locais

`/api/v1/chamadas` fornece contexto, listagem, abertura, marcação, fechamento e
correção motivada. Somente supervisor opera. O conjunto de menores alocados é
congelado na abertura; ausência justificada exige autorização e partida física
válidas naquele instante.

`/api/v1/saidas-curtas` fornece elegibilidade, solicitação própria, edição,
consulta, decisão e movimentos físicos. Residente usa exclusivamente o vínculo
da conta; supervisor decide, registra partida e confirma retorno. Gestor não
herda essas permissões. Versão, relógio do servidor e lock do residente protegem
decisões, sobreposição e um único movimento físico.

O job de expiração preserva histórico e auditoria na mesma transação. A origem
`SYSTEM_JOB` não pode ser usada por uma requisição HTTP. Em andamento, uma saída
não expira nem recebe retorno automático. Consulte o
[contrato](../docs/fase-3/README.md) e o [QA](../docs/fase-3/QA.md).

## API e uso no navegador

| Rota                       | Contrato                                                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/auth/csrf`    | Retorna `headerName`, `parameterName` e `token`.                                                                                                                                             |
| `POST /api/v1/auth/login`  | Formulário `application/x-www-form-urlencoded` com `email` e `password` e cabeçalho CSRF; `204` no sucesso, `401` genérico para conta inválida/desativada, `403` para CSRF ausente/inválido. |
| `GET /api/v1/auth/me`      | Com sessão, retorna `id`, `nome`, `email`, `fotoUrl: null`, `perfis`, `residenteId` e `supervisorId`; os IDs de cadastro são UUIDs ou `null`. Sem sessão válida, `401`.                      |
| `POST /api/v1/auth/logout` | Requer CSRF, invalida a sessão e retorna `204`.                                                                                                                                              |

A sessão fica em PostgreSQL por Spring Session JDBC. O cookie de HTTP local é
`HttpOnly` e `SameSite=Lax`; `Secure=false` é restrito ao perfil local em loopback.
A duração padrão é 30 minutos de inatividade. O navegador deve obter um novo token
CSRF depois do login e logout. O Angular é servido em `http://localhost:4200/acesso`
com proxy de `/api` para `127.0.0.1:8080`; `/demonstracao` permanece pública e
usa dados fictícios sem conceder acesso à API.

### Erros, OpenAPI e observabilidade locais

As falhas da API e da segurança retornam JSON com `code`, `message` e `requestId`.
Isso inclui `401/unauthorized` para sessão ausente ou inválida,
`401/invalid_credentials` no login recusado, `403/forbidden` para perfil sem
permissão e `403/csrf_invalid` para CSRF ausente ou inválido. O servidor gera um
UUID por requisição e o envia em `X-Request-Id`; o mesmo ID aparece no corpo de
erro e nos logs de correlação. Um ID enviado pelo cliente não substitui esse UUID.
As respostas de erro não expõem SQL, stack trace nem valores dos campos enviados.

`GET /api/v1/openapi` entrega o contrato JSON autenticado, incluindo cookie
`SESSION`, cabeçalho `X-CSRF-TOKEN` nas mutações e respostas de erro. A rota e
`GET /actuator/health`, `GET /actuator/metrics` e suas métricas individuais exigem
sessão de gestor ou supervisor no perfil `local`. Saúde não expõe detalhes ou
componentes; outros endpoints de Actuator não são publicados. Os logs estruturados
da aplicação correlacionam eventos pelo `requestId`, sem registrar payloads,
credenciais ou valores pessoais dos cadastros. O
[contrato da fundação](../docs/fase-1/FUNDACAO.md) detalha essa implementação e
seus limites de operação local.

## Saúde com permissões separadas

A V13 acrescenta habilitações profissionais, vínculos assistenciais e custódia
administrados por gestor/supervisor. Esses perfis não recebem conteúdo de saúde
pela autoridade de gestão. Uma conta habilitada em Medicina, Enfermagem ou
Psicologia só acessa residentes assistidos e notas compatíveis de autoria própria,
partilha explícita ou custódia vigente. A revogação vale na requisição seguinte,
incluindo sessões já abertas. A renovação gera outro episódio e não recupera
partilhas antigas.

O paciente com conta vinculada lê e exporta seu próprio conjunto em
`/api/v1/minha-saude`. Não há acesso automático do responsável legal. Notas e
revisões são imutáveis; correções acrescentam uma versão com justificativa.
Leituras de conteúdo e exportações só retornam após registrar auditoria na mesma
transação. Esses eventos protegidos não aparecem no GET global da auditoria.
O [contrato de saúde](../docs/fase-2/SAUDE_CONTRATO.md) detalha categorias, rotas,
validação, exportação JSON, retenção e limites da implementação local.

## Cadastros persistidos da Fase 2

Supervisores, alojamentos, casas/blocos opcionais, quartos, residentes,
responsáveis e alocações locais possuem APIs e telas ligadas ao PostgreSQL. O
[contrato da Fase 2](../docs/fase-2/README.md)
descreve as rotas de supervisores, `/api/v1/alojamentos`, suas unidades e
`/api/v1/quartos`, incluindo `/api/v1/quartos/mapa`, `/api/v1/residentes`,
`/api/v1/responsaveis` e `/api/v1/alocacoes`, com perfis, CSRF e erros. V5–V12
preservam as migrações anteriores. As versões iniciam em `0`; a edição e a
movimentação exigem a versão conhecida e rejeitam conflitos. Código global e
número local de quarto são textuais. Ocupação conta alocações ativas; vagas
livres ficam `null` quando a capacidade não foi definida, e a nota de limpeza
continua `null`.
Nos recursos de gestão já integrados, **gestor e supervisor locais podem consultar,
cadastrar, editar e movimentar com as mesmas permissões**; isso inclui
supervisores, alojamentos/unidades, quartos, residentes, responsáveis e alocações.
O residente local não recebe acesso a essas APIs. Essas permissões não abrangem
automaticamente futuras operações ou dados sensíveis.
No cadastro manual de residentes, nome, matrícula e data de nascimento são
obrigatórios em `POST` e `PUT`; nascimento deve ser válido e não futuro, e curso
é opcional. A matrícula é única sem diferenciar maiúsculas/minúsculas após retirar
espaços das pontas, mas sua conferência institucional ainda precisa de procedimento
AE/TI. O login não fornece matrícula; a integração com SUAP foi adiada. A migração
V10 acrescenta `CHECK (birth_date IS NOT NULL) NOT VALID`: preserva a leitura de
linhas legadas sem nascimento e exige a data em novas inserções e atualizações.
Registros legados sem data não devem ser tratados como maiores de idade.
No cadastro local de responsáveis, nome, vínculo e residente associado são
obrigatórios; telefone é opcional. O estado ativo cadastral não comprova
autorização legal ou assinatura. Para a saída longa futura, basta **uma assinatura
válida de qualquer responsável cadastrado e vinculado ao residente**, sem exigir
ambos; a comprovação do vínculo/identidade e o serviço de assinatura ainda faltam.
O fluxo persistido de saída longa aplica essa regra, com revisão/PDF privado,
convite limitado e conferência de evidência por adaptador; veja
[Fase 4](../docs/fase-4/README.md). A homologação real do provedor permanece pendente.
Na alocação provisória, um residente tem no máximo um quarto ativo. Entrada e
transferência exigem capacidade definida com vaga e quarto fora de Manutenção
e Indisponível. Encerramento e transferência preservam o histórico. A situação
do quarto permanece manual. Reservas, exceções e capacidades oficiais dependem
da AE; veja a [D19](../docs/fase-0/DECISOES.md).

Use somente registros sintéticos no ambiente local. A demonstração permanece
em memória e uma falha da API não a transforma em fonte de dados do cadastro.

### Auditoria de alterações

A migração V11 acrescenta auditoria das criações, edições e encerramentos dos
cadastros integrados. Cada evento guarda UUID da conta e perfil do autor, origem
`LOCAL_API`, UUID da requisição, recurso e UUID do registro, ação, data/hora,
versão resultante e nomes dos campos alterados. Não armazena valores anteriores
ou novos, cópias do cadastro, nomes, e-mails, telefones, senhas ou tokens. UUIDs
de autoria e de registro continuam sendo metadados de acesso restrito.

A gravação do cadastro e de seu evento ocorre na mesma transação: se o evento
falhar, a alteração é revertida. Uma transferência registra o encerramento do
vínculo anterior e a criação do novo com o mesmo `requestId`. Requisições recusadas
por validação, conflito, perfil ou CSRF não geram eventos de alteração.

`GET /api/v1/auditoria` é somente leitura para gestor e supervisor locais. Aceita
filtros `resourceId`, `actorId`, `requestId` e `resource`; retorna `items` e
`nextCursor` em ordem decrescente de `sequence`. `limit` tem padrão `50` e aceita
de `1` a `100`; para a próxima página, envie o cursor em `beforeSequence`.
Não há rota de edição ou exclusão de eventos nem preenchimento retroativo do
histórico anterior à V11.

O banco rejeita `UPDATE`, `DELETE` e `TRUNCATE` por triggers, e revoga essas
permissões de `PUBLIC`. Eventos não têm chaves estrangeiras com exclusão em
cascata para contas ou cadastros. A retenção permanente vale para a auditoria;
não se estende aos demais dados. A configuração local ainda não separa a role
da aplicação da role proprietária de migrações: owner ou superusuário podem
alterar as proteções. Separação de roles, backup e controles operacionais de
retenção precisam ser implementados e verificados antes de produção.

## Comunicações e disciplina

Notificações, advertências, avisos versionados e termos usam API e banco reais
no perfil local. O [contrato da Fase 5](../docs/fase-5/CONTRATO.md) e a
[jornada](../docs/fase-5/README.md) descrevem análise humana, correção da origem,
idempotência, propriedade do residente e ciência por versão. O
[QA integrado](../docs/fase-5/QA.md) inclui PDF privado e reinício.
Ciência não confirma assinatura e nenhuma ocorrência aplica sanção automática.

## Limpeza e relatórios

Avaliações, ranking e relatórios usam os registros persistidos. O
[contrato da Fase 6](../docs/fase-6/CONTRATO.md) e a
[jornada](../docs/fase-6/README.md) descrevem regras, participantes históricos,
consulta privada por autor e exportação do mesmo snapshot. Arquivos transitórios
de relatório têm raiz própria e expiram sem apagar documentos permanentes.

## Limite do aceite

Testes e prova manual com conta sintética receberam
[aceite técnico local](../docs/fase-0/QA.md) para desenvolvimento. A
[D21](../docs/fase-0/DECISOES.md) registra o login próprio escolhido e a Fase 0
continua sem homologação operacional. Antes de produção, é necessário implementar
e verificar configuração HTTPS/cookie seguro, provisionamento e recuperação de
contas, permissões por registro, desligamento e política de sessão, com aceite
TI/AE datado. A prova local anterior não certifica essas condições. As fatias
persistidas da Fase 2 também receberam
[aceite técnico local](../docs/fase-2/QA.md), com prova de cadastro, edição,
conflito e persistência após reinício. As demais operações das próximas
fatias continuam demonstrativas; não há autorização completa por
operação e registro de residente, nem homologação operacional da Fase 2.

O [CI](../docs/CI.md) executa o `verify` em Ubuntu com JDK 21 e Docker,
sem credenciais da aplicação. O [pacote AE/TI](../docs/fase-2/PACOTE_AE_TI.md)
reúne as decisões necessárias para homologação.
