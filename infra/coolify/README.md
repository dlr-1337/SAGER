# SAGER no Coolify

Instância de homologação com dados fictícios, autenticação própria e provedores externos
desativados. O Traefik do Coolify encerra o TLS; somente o gateway participa da rede
externa `coolify`. PostgreSQL e backend não publicam portas no host.

## Configuração da aplicação

- Projeto `SAGER`, ambiente `homologacao`, servidor `localhost`.
- Fonte GitHub existente, repositório privado `dlr-1337/SAGER`, branch `main`.
- Docker Compose em modo **Raw (deploy file as-is)**.
- Base directory `/`, Docker compose location `/compose.coolify.yml`.
- Preserve repository during deployment ativado.
- Custom build: `docker compose --profile maintenance build && docker compose --profile whatsapp pull whatsapp-gateway`.
- Custom start: `bash infra/coolify/start.sh`.
- Build arguments: **Managed manually in Dockerfile**.
- Auto deploy: **Manual deployments only**; previews desativados.
- Desativar o escape adicional de caracteres nos labels: o manifesto contém
  interpolação Compose e regras Traefik próprias.

Configurar estas variáveis **para build e execução**, sem marcar como literais:

| Variável                       | Valor nesta homologação          |
| ------------------------------ | -------------------------------- |
| `SAGER_STACK_NAME`             | `sager-homologacao`              |
| `SAGER_PUBLIC_HOST`            | `sager.otavio.win`               |
| `SAGER_SECRETS_DIR`            | `/srv/sager/homologacao/secrets` |
| `SAGER_COOLIFY_APPLICATION_ID` | `14`                             |

O ID numérico deve corresponder ao recurso real, mostrado pelo Coolify em General.
Em outra instalação, substituir pelo ID desse recurso. O UUID desta aplicação é
`rhamqqvry6aidhlfkqnzysk8`; ele não substitui o nome estável do projeto Compose.

As imagens padrão são `sager-homologacao-backend:current`,
`sager-homologacao-gateway:current` e `sager-homologacao-initializer:current`.
Registrar o SHA implantado e os IDs efetivos das imagens após cada implantação.
Os volumes físicos recebem o prefixo `sager-homologacao_`; manter esse nome para
preservar banco, documentos e relatórios nas atualizações.

O DNS escolhido é **A `sager` → `62.171.158.2`, DNS only, TTL automático**.
Os labels definem HTTP com redirecionamento permanente para HTTPS e emissão de
certificado pelo resolver `letsencrypt` existente. Não criar publicação de porta
para os containers da aplicação.

## Segredos e início

Gerar uma vez cinco valores aleatórios distintos, com 64 caracteres hexadecimais:
`db_owner_password`, `db_runtime_password`, `login_rate_secret`, `waha_api_key` e
`waha_webhook_hmac`. Os dois últimos existem mesmo com o WhatsApp desligado: sem o
arquivo, o Docker cria um diretório no lugar e bloqueia a ativação depois.
Armazenar fora do checkout, em `/srv/sager/homologacao/secrets`, com diretório
`0700`, arquivos `0440` e grupo `10001`. Cada serviço recebe somente os arquivos
necessários. Não colocar valores no painel, em argumentos, logs ou Git.
Não regenerar os arquivos durante uma reimplantação.

O wrapper lê somente configurações operacionais literais do `.env` escrito pelo
Coolify. Ele fornece projeto, diretório, manifesto e arquivo de ambiente a todas
as chamadas Compose. A ordem é:

1. Parar gateway e backend e confirmar que ambos estão parados.
2. Aguardar o PostgreSQL saudável.
3. Executar uma nova tarefa de migração e outra de permissões do runtime.
4. Aguardar readiness do backend, depois iniciar e verificar o gateway.
5. Com `SAGER_INTEGRATIONS_WHATSAPP_ENABLED=true`, subir `whatsapp-gateway` e
   `whatsapp-gateway-proxy`. Falha nesta etapa só gera aviso: o SAGER segue no ar.

O preflight valida identidade do projeto e configuração antes de alterar containers;
se ele falhar, a versão anterior permanece no estado em que estava. Depois da parada
inicial, qualquer falha interrompe a sequência e tenta manter gateway/backend parados.
Uma falha do Docker que impeça a parada exige intervenção do operador.
Não iniciar manualmente a aplicação para contornar uma migração malsucedida.

As quotas permanentes são 512 MiB/0,25 CPU para PostgreSQL,
1024 MiB/0,65 CPU para backend e 96 MiB/0,10 CPU para gateway: **1632 MiB/1 CPU**.
Com o WhatsApp ligado, somam-se 768 MiB/0,5 CPU do gateway de WhatsApp e 32 MiB/0,10 CPU
do proxy: **2432 MiB/1,6 CPU**, com mínimo de 2 vCPU e 4 GB mais swap na VPS.
Os limites dos containers temporários de manutenção são adicionais.

O gateway resolve `coolify-proxy` no DNS interno do Docker ao iniciar e confia
somente nos IPs exatos retornados. Host e `X-Forwarded-Proto: https` são obrigatórios.
Cabeçalhos enviados ao backend são reconstruídos. Se o proxy mudar de IP,
reiniciar o gateway para atualizar os peers; não confiar na rede inteira como correção.
O health do gateway é privado, em `127.0.0.1:8081/readiness`.

## Conta inicial

Depois de verificar migrações e HTTPS, abrir o terminal do servidor e executar
com Compose apontando para o checkout preservado e seu `.env`:

```bash
docker compose --project-name sager-homologacao \
  --project-directory "$SAGER_CHECKOUT" --env-file "$SAGER_CHECKOUT/.env" \
  -f "$SAGER_CHECKOUT/compose.coolify.yml" run --rm --no-deps \
  backend --sager-account=create --matricula=TESTE-GESTOR --email=gestor@sager.otavio.win \
  '--name=Gestor de Homologação' --profile=gestor
```

`SAGER_CHECKOUT` deve ser o diretório real do código implantado, conferido nos logs
de deployment. A execução precisa de terminal interativo. O operador define e
confirma a senha com entrada oculta; não fornecer senha em variável ou argumento.
O comando administrativo encerra ao concluir e não inicia outro servidor HTTP.

## Backup manual e recuperação

Serializar backup e implantação: manter auto deploy desativado, conferir que não
há deployment ativo ou na fila e não acionar Deploy durante o backup. O backup
para/reinicia o backend para obter um ponto consistente. Não existe lock compartilhado
entre o helper do Coolify e o host; não presumir que `flock` em caminhos diferentes
protege os dois processos.

Gerar a identidade privada `age` no computador do operador, fora do checkout, e
guardar uma cópia segura. Enviar para a VPS somente o destinatário **público**.
Usar diretórios de trabalho privados; para dados reais, o armazenamento temporário
deve ser criptografado. Esta homologação contém somente dados fictícios.

```bash
python3 "$SAGER_CHECKOUT/infra/production/recovery.py" \
  --compose "$SAGER_CHECKOUT/docker-compose.yaml" \
  --env-file "$SAGER_CHECKOUT/.env" --project-name sager-homologacao \
  --work-dir /srv/sager/homologacao/private-work create \
  --recipient "$SAGER_AGE_RECIPIENT" \
  --output /srv/sager/homologacao/backups/bootstrap.age
```

Conferir o manifesto efetivamente usado pelo Coolify e os labels
`com.docker.compose.project` antes de executar. Se o arquivo renderizado tiver
outro nome, usar seu caminho real. `--project-name` é global e precede `create` ou
`restore`. O modo standalone continua funcionando quando a opção é omitida.

Copiar o arquivo criptografado para o computador do operador e testar a restauração
localmente, mantendo a identidade privada fora da VPS:

```bash
python infra/production/recovery.py --compose "$SAGER_RESTORE_COMPOSE" \
  --env-file "$SAGER_RESTORE_ENV" --project-name sager-restore-bootstrap \
  restore --archive "$SAGER_ARCHIVE" --identity "$SAGER_AGE_IDENTITY"
```

O projeto de restauração deve ter banco e volume de documentos vazios e **volumes
físicos diferentes** da homologação. Nome de projeto diferente não basta se o
manifesto fixar nomes externos. Manter backend/gateway parados. O utilitário confere
schema, ponto de auditoria e hashes de documentos, descarta sessões antigas e não
inicia a aplicação. Relatórios temporários não fazem parte do arquivo de recuperação.

## Verificação

```bash
python -B -m unittest discover -s infra/production -p test_recovery.py -v
python -B -m unittest discover -s infra/coolify -p 'test_*.py' -v
python -B infra/coolify/smoke.py --build
```

A CI mantém também o smoke standalone com TLS e os testes de backend/frontend.
No servidor, verificar certificado sem exceções, HTTP→HTTPS, `/acesso`, assets,
CSRF, login/logout, endpoints internos bloqueados, banco sem dados demo, isolamento,
persistência após reimplantação e backup/restauração. Registrar evidências efetivas
em `docs/fase-7/COOLIFY.md`; não tratar a configuração do painel como deployment concluído.

Referências: [Compose no Coolify](https://coolify.io/docs/applications/builds/docker-compose),
[domínios e TLS](https://coolify.io/docs/core/networking/domains),
[lifecycle da versão 4.3.14](https://github.com/coollabsio/coolify/blob/v4.3.14/app/Jobs/ApplicationDeploymentJob.php).

## Atualização de matrícula e cursos

Os manifests do Coolify continuam usando as imagens de produção, segredos privados e os mesmos volumes. Siga a [preparação V20/V21](../production/README.md#atualização-para-matrícula-e-catálogo-v20v21) antes de iniciar a aplicação atualizada. Depois de migrar, liste as contas pelo comando administrativo, atribua as matrículas pendentes por UUID e reaplique os privilégios do runtime. A implantação encerra sessões antigas. Não substitua esse manifesto pelo Compose local.
