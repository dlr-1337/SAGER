# Homologação no Coolify

Estado observado em 30/09/2026, no horário de Brasília. Os horários técnicos
abaixo são registrados em UTC. Esta instância usa somente dados fictícios e
contas próprias do SAGER. Ela serve para verificação técnica; não representa
aceite institucional nem liberação para dados reais.

## Instância e versão

| Item                | Estado observado                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Endereço            | [https://sager.otavio.win/acesso](https://sager.otavio.win/acesso)                                            |
| Coolify             | 4.3.14; projeto `SAGER`, ambiente `homologacao`, servidor `localhost`                                         |
| Aplicação           | ID `14`, UUID `rhamqqvry6aidhlfkqnzysk8`; deploy manual `kkhnj2smzhu8oa2wwj7xlvnf`                            |
| Fonte implantada    | `main` no SHA `75fe265e843c6b0079d5110307f774d85c9047f8`                                                      |
| Deploy              | Iniciado às 01:38:19 UTC e concluído com sucesso às 01:41:15 UTC; banco, backend e gateway saudáveis ao final |
| Checkout preservado | `/data/coolify/applications/rhamqqvry6aidhlfkqnzysk8` no servidor, sem `.git`                                 |
| Projeto Compose     | `sager-homologacao`; volumes com prefixo `sager-homologacao_`                                                 |
| DNS                 | Registro A `sager` → `62.171.158.2`, DNS only, TTL automático (300 s)                                         |

O gate final de CI foi executado no SHA **`8a1d7a9481711c7f9b43e7a2bced1364d552eac2`** do
[PR #15](https://github.com/dlr-1337/SAGER/pull/15), integrado pelo merge `75fe265`.
A árvore de arquivos do merge corresponde à árvore aprovada pela CI.
A [execução 36801135601](https://github.com/dlr-1337/SAGER/actions/runs/36801135601)
concluiu com sucesso os três jobs: 257 testes de backend, 191 testes unitários de
frontend, 96 jornadas Chromium, 15 testes de recuperação, 20 testes do wrapper
Coolify e o smoke de build/HTTPS. Esses gates verificam o SHA da execução; a
verificação pública abaixo observa a instância implantada. Registrar novo SHA,
imagens e evidências após qualquer reimplantação.

## Topologia e configuração

O Coolify usa Docker Compose em modo **Raw**, com fonte GitHub privada e
implantação manual. O checkout contém `compose.coolify.yml`; o Coolify também
mantém `.env` e `docker-compose.yaml` renderizado. O `Custom Start` executa
`bash infra/coolify/start.sh` a partir do checkout. O wrapper usa o manifesto
fonte e fixa `--project-name sager-homologacao`. Ele para gateway e backend,
aguarda banco saudável, executa migração e inicialização da role restrita e só
então inicia backend e gateway com healthchecks. Não acione deploy durante backup.

O Traefik do Coolify termina TLS e encaminha somente ao gateway na rede externa
`coolify`. PostgreSQL e backend permanecem em redes privadas e não publicam
portas no host. O gateway reconstrói cabeçalhos de encaminhamento antes de
repassar pedidos ao backend. Os limites configurados no manifesto para os três
serviços permanentes somam **1 CPU e 1.632 MiB**, conferidos no Docker real;
os containers temporários de
manutenção têm limites adicionais. Consulte o
[runbook do Coolify](../../infra/coolify/README.md) para as opções do painel,
segurança do gateway e sequência de implantação.

Três segredos distintos e estáveis, `db_owner_password`,
`db_runtime_password` e `login_rate_secret`, ficam fora do checkout em
`/srv/sager/homologacao/secrets`. Os diretórios têm modo `0700` e os arquivos
modo `0440`, grupo `10001`. Seus valores não pertencem a este documento, ao
repositório ou ao painel do Coolify. Clicksign e WhatsApp permanecem
desabilitados. A demonstração também está desabilitada em `production`.

## Verificação pública realizada

Uma checagem externa com validação TLS estrita retornou `PASS` para o endereço
acima, sem exceções de certificado. O certificado Let's Encrypt cobre
`sager.otavio.win` e vence em **30/12/2026 às 00:42:53 UTC**. A tela pública
mostrou o formulário de login de produção; isso não comprova autenticação de
uma conta, ainda não provisionada nesta instância.

| Verificação                      | Resultado observado                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| HTTP → HTTPS                     | Redirecionamento permanente, preservando o caminho                                   |
| `/acesso` e assets               | Página e arquivos carregaram; marcador `production`, CSP e HSTS presentes            |
| Cookie de sessão                 | Atributos `Secure`, `HttpOnly` e `SameSite=Lax` observados                           |
| CSRF                             | POST sem token recusado com HTTP 403                                                 |
| Rotas privadas de infraestrutura | Actuator, readiness e `.env` não expostos; demonstração pública retorna HTTP 404     |
| Cabeçalhos falsificados de proxy | Requisição pública aceita com HTTP 200 após reconstrução dos cabeçalhos pelo gateway |

A verificação pública é um retrato do instante do teste. Acesso ao formulário e
healthchecks não comprovam login real, persistência após reimplantação ou
recuperação de dados.

## Imagens e verificação na VPS

IDs de imagem observados nos containers depois da reimplantação de `75fe265`:

| Serviço    | Referência                          | ID observado                                                              |
| ---------- | ----------------------------------- | ------------------------------------------------------------------------- |
| PostgreSQL | `postgres:17.11-bookworm`           | `sha256:639ab7ceb90e13123085b741fb31ef493fba25463002f6da665352e7b534b652` |
| Backend    | `sager-homologacao-backend:current` | `sha256:eb18f12e219b2304af1f661f51e30fa4b7db089c3b48b7edb6290792b40a306b` |
| Gateway    | `sager-homologacao-gateway:current` | `sha256:0f4c969b01473a96c10d95f59818d08b5812034f242410b42d5423dd760b0f1d` |

A inspeção de 01:53:59 UTC passou nas 20 verificações operacionais: os três
containers saudáveis; quotas PostgreSQL 512 MiB/0,25 CPU, backend
1024 MiB/0,65 CPU e gateway 96 MiB/0,10 CPU; nenhuma porta publicada no host;
somente gateway na rede `coolify`; redes de dados e gateway internas; volumes
`sager-homologacao_database`, `sager-homologacao_documents` e
`sager-homologacao_reports`; mounts de segredos somente leitura e permissões
restritas. A role runtime não pode criar objetos nem alterar a auditoria.
As migrações V1–V19 estão concluídas, sem falhas.

A conferência mais recente, às 02:28:08 UTC, repetiu 17 verificações somente
leitura, sem novo probe: serviços saudáveis, imagens da tabela acima, quotas,
isolamento, volumes, permissões e migrações passaram. A checagem pública foi
repetida com validação TLS estrita e também passou.

Um container descartável na rede `coolify` recebeu HTTP 403 ao tentar alcançar
diretamente o gateway com Host e cabeçalhos forjados. O mesmo peer não alcançou
o readiness privado; o health em loopback permaneceu funcional. O container do
probe foi removido. Os peers confiáveis correspondem somente aos IPs atuais do
`coolify-proxy`.

O banco inicialmente não continha contas, alojamentos, quartos, residentes,
documentos ou eventos de auditoria. Sessões anônimas criadas pelas verificações
públicas não são contas de usuário.

## Reimplantação e backup inicial

A implantação manual `i69yvcgdzgvzoweruer8axfo` repetiu o SHA `75fe265`,
entre 02:03:20 e 02:05:19 UTC. O Coolify recriou os três containers, preservando
os mesmos volumes físicos. O Flyway validou as 19 migrações e confirmou schema
atualizado, sem nova migração. A inicialização da role e os healthchecks passaram.

A comparação de 02:05:57 UTC preservou versão e hash do schema, auditoria e
contagens. Os hashes canônicos de origem permanecem:

- Schema: `977061c5c8b9191578f2441cf46dfbb345473ec932ea3da145b42901d859a5b5`.
- Auditoria: `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`.

Essa conferência verifica o banco inicial sem contas ou registros de domínio.
A persistência de registros de negócio e login/logout com gestor ainda dependem
da criação da primeira conta. HTTPS, assets, cookies, CSRF e bloqueios públicos
passaram novamente depois da reimplantação.

O backup manual `/srv/sager/homologacao/backups/bootstrap.age` foi criado antes
dessa reimplantação, com schema V19, sequência de auditoria 0 e nenhum documento.
A criação levou 9,09 s e retomou o backend. O arquivo foi copiado por SSH para
`C:/Users/otavi/.codex/sager-homologacao-recovery/bootstrap.age`; SHA256 igual
na origem e no computador do operador:
`d77dfb0d8d3f1b6cae9a598862fd905eb8ee75517601b1cab51e3a63edea5fe7`.

A identidade privada age fica somente no computador do operador, fora do
checkout, em diretório com ACL restrita. A VPS recebeu somente o destinatário
público. A restauração real foi verificada localmente em projeto vazio com
volumes físicos exclusivos. O utilitário retornou `isolated_restore_verified`
em **9,16 s**; a execução incluindo coleta de métricas levou **12,42 s**.
Schema V19, auditoria e contagens foram conferidos; as três sessões da baseline
foram expurgadas. Backend e gateway do destino permaneceram parados.

A comparação verificou os **1.152 objetos** do schema. Os hashes brutos de
origem e destino diferiram porque o parser PostgreSQL reescreveu 50 CHECKs e
dois índices ao restaurar. As 104 definições correspondentes foram submetidas
novamente ao PostgreSQL 17.11 local e coincidiram exatamente; as outras 1.100
definições já eram idênticas. O fingerprint canônico completo de ambos foi
`7e4fb631303a812b1abf12485bffef9be0e408cff8a8cbfcf39c9c786258aa28`.
Nenhuma expressão ou objeto foi excluído da comparação. Owners e ACLs seguem o
contrato `--no-owner --no-acl` e exigem inicialização do runtime antes de liberar
uma aplicação recuperada.

Os cinco projetos locais utilizados no ensaio e diagnóstico foram encerrados;
seus containers, redes, volumes e arquivos temporários em claro foram removidos.
O backup criptografado e a identidade privada do operador foram preservados.
O bootstrap contém **zero contas e zero documentos**: este ensaio comprova a
recuperação do banco inicial, sem comprovar dados de negócio populados ou login
após recuperação. Não reutilizar volumes físicos da homologação.

## Operação e evidências pendentes

| Etapa                                                             | Estado nesta instância                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------- |
| Login de gestor e autorização com conta real                      | Pendente: conta inicial ainda não criada                   |
| Backup criptografado e restauração isolada da instância Coolify   | Concluída para o bootstrap vazio, conforme seção acima     |
| Conferência dos IDs de imagens, quotas, isolamento e role runtime | Concluída na VPS, conforme seção acima                     |
| Piloto na VPS, disponibilidade e aceite AE/TI                     | Pendente conforme [roteiro de homologação](HOMOLOGACAO.md) |

Para inspecionar o stack no servidor, use o checkout preservado e a identidade
estável do Compose. Não imprima `docker compose config` nem o `.env` em logs:

```bash
export SAGER_CHECKOUT=/data/coolify/applications/rhamqqvry6aidhlfkqnzysk8
docker compose --project-name sager-homologacao \
  --project-directory "$SAGER_CHECKOUT" --env-file "$SAGER_CHECKOUT/.env" \
  -f "$SAGER_CHECKOUT/compose.coolify.yml" ps
```

Depois de confirmar migração, HTTPS e saúde do stack, o operador pode criar a
primeira conta em terminal interativo. A senha é definida e confirmada no
console oculto, sem argumento, variável ou registro em log:

```bash
docker compose --project-name sager-homologacao \
  --project-directory "$SAGER_CHECKOUT" --env-file "$SAGER_CHECKOUT/.env" \
  -f "$SAGER_CHECKOUT/compose.coolify.yml" run --rm --no-deps \
  backend --sager-account=create --email=gestor@sager.otavio.win \
  '--name=Gestor de Homologação' --profile=gestor
```

Para backup, serialize a operação com deployments, use o manifesto renderizado
efetivo e mantenha a identidade **privada** age fora da VPS. Somente o
destinatário público entra no comando de criação:

```bash
python3 "$SAGER_CHECKOUT/infra/production/recovery.py" \
  --compose "$SAGER_CHECKOUT/docker-compose.yaml" \
  --env-file "$SAGER_CHECKOUT/.env" --project-name sager-homologacao \
  --work-dir /srv/sager/homologacao/private-work create \
  --recipient "$SAGER_AGE_RECIPIENT" \
  --output /srv/sager/homologacao/backups/bootstrap.age
```

Copie apenas o arquivo criptografado para o posto do operador e restaure em um
**projeto isolado e vazio**, com volumes físicos próprios. O
[runbook do Coolify](../../infra/coolify/README.md) contém o comando de restore,
as verificações de schema, auditoria e documentos e as condições de segurança.
Não marque backup ou restore como concluídos até registrar saída, hashes, duração
e comparação do destino com a origem.
