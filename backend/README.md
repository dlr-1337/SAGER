# Backend SAGER — login local provisório

O login por e-mail e senha própria do SAGER atende somente desenvolvimento e teste.
Um operador cria as contas e atribui um perfil de teste; não há cadastro público.
O [roteiro](../docs/ROADMAP_IMPLEMENTACAO.md) e o
[contrato de autenticação](../docs/fase-0/AUTENTICACAO_LOCAL.md) registram os limites.
A antiga prova Google OIDC está [arquivada como evidência](../docs/fase-0/AUTENTICACAO_GOOGLE.md);
nenhuma credencial Google é necessária para iniciar este backend.

## Pré-requisitos

- JDK 21 no terminal do projeto; Maven 3.9.16 vem do Wrapper.
- Docker operacional para PostgreSQL 17.11. Os testes usam Testcontainers.
- `SAGER_DB_PASSWORD` definido no ambiente local por meio seguro. Nunca registre a
  senha em argumento, `.env` rastreado, captura de tela, issue ou chat.
- Banco e aplicação de desenvolvimento executados somente no computador local.
  O perfil `local` vincula o backend a `127.0.0.1:8080`; fora dele, o login local
  fica desabilitado e o acesso falha fechado até existir provedor institucional.

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

`--profile` aceita `gestor`, `supervisor` ou `residente`. Não informe a senha em
argumentos nem use nomes/e-mails reais nesta prova. Para redefinir a senha ou
desativar a conta, sem criar outra identidade:

```powershell
java -jar .\target\sager-backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=local --sager-account=reset --email=pessoa@exemplo.invalid
java -jar .\target\sager-backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=local --sager-account=disable --email=pessoa@exemplo.invalid
```

Não existe rota HTTP de criação, redefinição ou atribuição de perfis. A desativação
deve impedir novos logins e revogar o uso de sessões existentes.

## API e uso no navegador

| Rota                       | Contrato                                                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/auth/csrf`    | Retorna `headerName`, `parameterName` e `token`.                                                                                                                                             |
| `POST /api/v1/auth/login`  | Formulário `application/x-www-form-urlencoded` com `email` e `password` e cabeçalho CSRF; `204` no sucesso, `401` genérico para conta inválida/desativada, `403` para CSRF ausente/inválido. |
| `GET /api/v1/auth/me`      | Com sessão, retorna `id`, `nome`, `email`, `fotoUrl: null` e `perfis`; sem sessão válida, `401`.                                                                                             |
| `POST /api/v1/auth/logout` | Requer CSRF, invalida a sessão e retorna `204`.                                                                                                                                              |

A sessão fica em PostgreSQL por Spring Session JDBC. O cookie de HTTP local é
`HttpOnly` e `SameSite=Lax`; `Secure=false` é restrito ao perfil local em loopback.
A duração padrão é 30 minutos de inatividade. O navegador deve obter um novo token
CSRF depois do login e logout. O Angular é servido em `http://localhost:4200/acesso`
com proxy de `/api` para `127.0.0.1:8080`; `/demonstracao` permanece pública e
usa dados fictícios sem conceder acesso à API.

## Cadastros persistidos da Fase 2

Supervisores, alojamentos, casas/blocos opcionais, quartos e residentes já
possuem APIs e telas ligadas ao PostgreSQL. O
[contrato da Fase 2](../docs/fase-2/README.md)
descreve as rotas de supervisores, `/api/v1/alojamentos`, suas unidades e
`/api/v1/quartos`, incluindo `/api/v1/quartos/mapa`, e `/api/v1/residentes`,
com perfis, CSRF e erros. V5–V7 preservam as migrações anteriores. As versões
iniciam em `0`; a edição exige a versão conhecida e rejeita conflitos. Código
global e número local são textuais; ocupação, vagas livres e limpeza ficam
`null` nesta fatia.
No cadastro provisório de residentes, nome e matrícula são obrigatórios;
nascimento e curso são opcionais. Gestor local grava, gestor e supervisor locais
consultam. A fonte institucional da matrícula ainda depende de decisão da AE/TI.

Use somente registros sintéticos no ambiente local. A demonstração permanece
em memória e uma falha da API não a transforma em fonte de dados do cadastro.

## Limite do aceite

Testes e prova manual com conta sintética receberam
[aceite técnico local](../docs/fase-0/QA.md) para desenvolvimento. A
[D21](../docs/fase-0/DECISOES.md) e a Fase 0 continuam sem
homologação institucional. Antes de produção, TI/AE devem decidir e comprovar o
provedor, os perfis, o desligamento e a política de sessão com responsáveis, data e
referência de aceite. As fatias persistidas da Fase 2 também receberam
[aceite técnico local](../docs/fase-2/QA.md), com prova de cadastro, edição,
conflito e persistência após reinício. Responsáveis e operações das próximas
fatias continuam demonstrativos; não há autorização completa por
operação e registro de residente, nem homologação institucional da Fase 2.
