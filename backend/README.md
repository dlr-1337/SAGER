# Backend do SAGER

API Spring Boot 4.1 em Java 21, com PostgreSQL 17 e migrações Flyway. Camadas, contrato da API, segurança e decisões estão em [docs/ARQUITETURA.md](../docs/ARQUITETURA.md).

O jeito mais simples de rodar é `./sager up` na raiz, com tudo em Docker ([docs/OPERACAO.md](../docs/OPERACAO.md)). Este guia cobre a execução direta no host.

## Pré-requisitos

- JDK 21 (o workflow do GitHub fixa o Temurin 21.0.12.1+1). O Maven 3.9.16 vem do Wrapper.
- Docker, para os testes: o Testcontainers sobe um PostgreSQL 17.11 descartável.
- Para rodar no host, um PostgreSQL 17 no próprio computador.
- `SAGER_DB_PASSWORD` definido por meio seguro. Nunca coloque a senha em argumento, arquivo rastreado, captura de tela, issue ou chat.

No PowerShell, aponte `JAVA_HOME` para o JDK 21 só no terminal do projeto e use `.\mvnw.cmd` no lugar de `./mvnw`.

## Perfis

| Perfil | Uso |
| --- | --- |
| `local` | Desenvolvimento. Escuta só em `127.0.0.1:8080`, aplica as migrações ao iniciar e publica o OpenAPI em `/api/v1/openapi`. O cookie não usa `Secure`. |
| `production` | Produção, atrás do gateway HTTPS. Não migra: exige schema pronto, papel `sager_runtime`, segredos externos e cookie seguro. Recusa iniciar com conta ativa sem matrícula. |
| `migration` | Só aplica as migrações, com o papel `sager_owner` e a opção `--sager-migrate`. Não abre servidor HTTP. |

Use um perfil por vez. Perfil desconhecido mantém a API fechada, e combinar `production` ou `migration` com outro perfil é recusado antes de abrir o banco. Em produção, migração, permissões e comandos de conta rodam pelo Compose, como descreve [infra/production/README.md](../infra/production/README.md).

## Executar no host

```bash
cd backend
./mvnw -B -ntp package -DskipTests
java -jar target/sager-backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=local
```

O banco é lido de `SAGER_DB_URL` (padrão `jdbc:postgresql://localhost:5432/sager`), `SAGER_DB_USER` (padrão `sager`) e `SAGER_DB_PASSWORD`. A sessão expira após `SAGER_SESSION_TIMEOUT` sem uso (padrão `30m`). Para trocar ou desativar contas, use os comandos abaixo; não apague o banco, que guarda o histórico.

A interface roda à parte com `npm start` em `frontend/` e repassa `/api` para `127.0.0.1:8080` ([frontend/README.md](../frontend/README.md)).

## Comandos de conta

Não há rota HTTP para criar contas, trocar senha ou mudar perfil. O operador usa o próprio JAR, com o perfil `local` ou `production` sozinho. O comando não inicia o servidor HTTP e encerra ao terminar.

```bash
java -jar target/sager-backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=local \
  --sager-account=create --matricula=TESTE-GESTOR --name='Gestor de Teste' --profile=gestor
```

Com Docker, o mesmo comando fica `./sager account create --matricula=...`. A senha é pedida duas vezes num console com entrada oculta; sem console, o comando falha. Use só nomes e matrículas sintéticos.

| Ação | Opções | Efeito |
| --- | --- | --- |
| `create` | `--matricula`, `--name`, `--profile`, `--email` (opcional) | Cria uma conta de gestor. `--profile` só aceita `gestor`; residentes e supervisores recebem a conta no próprio cadastro. |
| `reset` | conta | Troca a senha e encerra as sessões. |
| `disable` | conta | Desativa a conta, encerra as sessões e impede novos logins. |
| `link-resident` | conta, `--resident-id=UUID` | Liga uma conta de perfil `residente` a um cadastro de residente. |
| `link-supervisor` | conta, `--supervisor-id=UUID` | Liga uma conta de gestor ou supervisor a um cadastro de supervisor. |
| `unlink` | conta, `--record-id=UUID` | Desfaz o vínculo atual. Também libera o cadastro de uma conta desativada, sem reativá-la. |
| `assign-enrollment` | `--account-id=UUID`, `--matricula` | Dá matrícula a uma conta antiga que não tem. |
| `list` | nenhuma | Lista UUID, matrícula (ou `PENDENTE`), perfil, situação e contato. |
| `help` | nenhuma | Mostra a ajuda. |

"Conta" é `--account-id=UUID` ou `--matricula=...`; `--email` ainda é aceito como seletor antigo.

- O login usa o valor de `--matricula`, que a tela de acesso chama de Usuário. O e-mail é só contato e não entra no login.
- Esta CLI não aplica a regra de formato da matrícula do cadastro de residentes, por isso aceita valores como `TESTE-GESTOR`, que a API de residentes recusaria.
- Cadastrar residente ou supervisor pela API (`password` e `passwordConfirmation`) já cria a conta vinculada na mesma transação. Editar o cadastro não troca a senha.
- Uma conta tem no máximo um vínculo, e cada cadastro pertence a uma conta só. Vincular não muda o perfil. Não há vínculo automático por nome, e-mail ou matrícula.
- Mudar ou remover o vínculo encerra as sessões da conta. Repetir o mesmo vínculo não muda nada.
- Nenhuma matrícula é deduzida do e-mail: use `list` e `assign-enrollment` com o identificador conferido.

## Rotina de conclusão do curso

Todo dia às 00h10 (America/Sao_Paulo), nos perfis `local` e `production`, o backend encerra o vínculo ativo de quarto de cada residente que passou da saída prevista. A saída prevista sai do ano de ingresso, do 5º caractere da matrícula (`1` é o 1º semestre; outro valor, o 2º), da duração do curso e da prorrogação, e termina em 30/06 ou 31/12.

- O vínculo fecha com o motivo `CONCLUSION`, e a auditoria registra `END` com origem `SYSTEM_JOB`, sem autor.
- A flag `sager.operations.expiry.enabled=false` (variável `SAGER_OPERATIONS_EXPIRY_ENABLED=false`) desliga esta rotina junto com a expiração das saídas curtas e longas.
- A condição é "passou da saída prevista", não "venceu ontem": um dia sem execução, por servidor parado, é recuperado na execução seguinte.
- A API recusa colocar ou transferir um concluinte (409 `resident_concluded`) até que a prorrogação seja lançada no cadastro.
- A conta de acesso do concluinte continua ativa.

Antes do deploy, rode estas consultas no banco de produção. Quem aparece nelas nunca vira concluinte até o cadastro ser completado:

```sql
SELECT id, name FROM sager_course WHERE duration_years IS NULL;
SELECT r.id, r.enrollment FROM sager_resident r
  JOIN sager_room_allocation a ON a.resident_id = r.id AND a.ended_at IS NULL
 WHERE r.entry_year IS NULL;
```

Antes da primeira execução, abra a lista de residentes e confira quem aparece como "Concluinte". Para quem ainda estuda, lance a prorrogação no cadastro; senão, a vaga é liberada às 00h10 seguintes.

## Testes

```bash
cd backend
./mvnw -B -ntp verify
```

O `verify` usa contas sintéticas e PostgreSQL descartável do Testcontainers; não precisa de banco nem conta da aplicação. Os testes de integração cobrem migrações, restrições, permissões, CSRF, conflitos de versão e alterações concorrentes. O `./sager ci backend`, na raiz, roda o mesmo comando depois de um `clean`.
