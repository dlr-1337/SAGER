# Prova local de autenticação institucional

Este backend é a prova mínima da Fase 0. Ele oferece login Google OIDC por Authorization
Code, vínculo local por `iss` + `sub`, perfis concedidos apenas por cadastro local,
`GET /api/v1/auth/me`, token CSRF e logout. O restante da Fase 1 e a integração com o
Angular continuam no [roteiro](../docs/ROADMAP_IMPLEMENTACAO.md).

## Pré-requisitos e configuração

- JDK 21 selecionado neste terminal; Maven 3.9.16 é fornecido pelo Wrapper.
- Docker operacional para PostgreSQL 17.11. O teste automatizado usa um contêiner
  descartável e não exige credenciais Google.
- Para login real: cliente OAuth **web** autorizado pela TI/Google Workspace, com URI
  cadastrada exatamente como `http://localhost:8080/login/oauth2/code/google`.
- Variáveis locais `SAGER_DB_PASSWORD`, `SAGER_GOOGLE_CLIENT_ID` e
  `SAGER_GOOGLE_CLIENT_SECRET` fornecidas por canal seguro; nunca criar `.env` rastreado,
  copiar valores para comandos compartilhados ou registrar valores em issue/chat.
- `SAGER_ALLOWED_HD`: lista separada por vírgulas, com os valores do claim `hd`
  observados no ID token validado e aprovados pela TI. Vazia por padrão: login bloqueado.
  Os domínios de e-mail, sozinhos, não autorizam acesso.

No PowerShell, selecione o JDK apenas para o terminal do projeto:

```powershell
$env:JAVA_HOME = Join-Path $env:LOCALAPPDATA 'SAGER\toolchains\jdk-21.0.12.1+1'
$env:PATH = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:PATH
cd backend
.\mvnw.cmd -B -ntp test
```

O comando executa testes sintéticos, inclusive PostgreSQL real em Testcontainers,
Flyway e servidor HTTP em porta aleatória. Para a prova com contas institucionais,
injete as três variáveis secretas no ambiente **fora do Git**. Se a porta 5432 estiver
ocupada, use outra porta local e mantenha URL e Compose alinhados:

```powershell
$env:SAGER_DB_PORT = '15432'
$env:SAGER_DB_URL = 'jdbc:postgresql://localhost:15432/sager'
docker compose -p sager-fase0-proof up -d --wait postgres
.\mvnw.cmd spring-boot:run
```

Sem o ajuste de porta, Compose usa `127.0.0.1:5432` e o JDBC usa
`localhost:5432`. Abra **`http://localhost:8080/`** no navegador; usar outro hostname
altera a URI de retorno. O login começa em `/oauth2/authorization/google`.

## Roteiro supervisionado do login real

1. Com `SAGER_ALLOWED_HD` vazio, o acesso falha fechado. O backend registra somente o
   valor sintaticamente seguro do `hd` observado, sem token, e-mail ou `sub`. A TI
   confere e aprova os valores de servidor e estudante; reinicie com a lista aprovada.
2. O titular da conta institucional entra no navegador. No primeiro login autorizado
   pelo `hd`, a página mostra `403` e um UUID de solicitação, pois ainda não há perfil
   local. Esse UUID é o `id` da identidade local; não é o `sub` Google.
3. Depois do aceite da AE/TI para o **perfil de teste**, um operador autorizado abre
   o PostgreSQL com `docker compose -p sager-fase0-proof exec postgres psql -U sager -d sager`
   e executa, substituindo apenas UUID e perfil aprovados:

   ```sql
   SELECT id, active FROM sager_identity WHERE id = '<UUID informado ao operador>';
   INSERT INTO sager_identity_profile (identity_id, profile)
   VALUES ('<UUID informado ao operador>', '<gestor|supervisor|residente aprovado>');
   ```

   O campo `profile` aceita **um** dos valores `gestor`, `supervisor` ou `residente`;
   a notação acima representa uma escolha, não texto literal a inserir. Não conceda
   perfil pela semelhança do e-mail ou pelo `hd`. Não há endpoint público de concessão.
4. O titular repete o login. `/api/v1/auth/me` deve retornar UUID local, e-mail
   verificado, nome/foto opcionais e **somente** perfis locais aprovados. Repita para
   servidor e estudante. Uma terceira conta sem perfil deve continuar em `403`.
5. Para testar logout pelo navegador, obtenha `headerName` e `token` em
   `/api/v1/auth/csrf` e envie `POST /api/v1/auth/logout` com esse cabeçalho. Sem CSRF,
   o POST deve ser rejeitado. Verifique a ausência de sessão autenticada após logout.

Não salve senhas, tokens, cookies, e-mails, fotos ou `sub` nas evidências. Registre
apenas tipo de conta, resultado, `hd` aprovado, data, responsável e referência do
aceite em [AUTENTICACAO_GOOGLE.md](../docs/fase-0/AUTENTICACAO_GOOGLE.md). A base de
prova pode conter dados de sessão; ao encerrar e após registrar as evidências
necessárias, remova **somente o projeto descartável** `sager-fase0-proof` com
`docker compose -p sager-fase0-proof down --volumes`.

## Limites

Os testes automáticos simulam o resultado do provedor; eles não comprovam autorização
do cliente no Workspace nem que uma conta institucional consiga concluir o callback.
A aplicação ainda não integra o frontend e não implementa autorização por recurso.
A duração proposta da sessão é 30 minutos; a política institucional de desligamento
e invalidação de sessões segue pendente em D21.
