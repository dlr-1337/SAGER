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

Supervisores, alojamentos, casas/blocos opcionais, quartos, residentes,
responsáveis e alocações locais possuem APIs e telas ligadas ao PostgreSQL. O
[contrato da Fase 2](../docs/fase-2/README.md)
descreve as rotas de supervisores, `/api/v1/alojamentos`, suas unidades e
`/api/v1/quartos`, incluindo `/api/v1/quartos/mapa`, `/api/v1/residentes`,
`/api/v1/responsaveis` e `/api/v1/alocacoes`, com perfis, CSRF e erros. V5–V10
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
Essa regra de saída longa ainda não foi implementada.
Na alocação provisória, um residente tem no máximo um quarto ativo. Entrada e
transferência exigem capacidade definida com vaga e quarto fora de Manutenção
e Indisponível. Encerramento e transferência preservam o histórico. A situação
do quarto permanece manual. Reservas, exceções e capacidades oficiais dependem
da AE; veja a [D19](../docs/fase-0/DECISOES.md).

Use somente registros sintéticos no ambiente local. A demonstração permanece
em memória e uma falha da API não a transforma em fonte de dados do cadastro.

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
