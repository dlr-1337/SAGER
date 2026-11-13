# Operação em produção

Configuração técnica para Linux com Docker Compose, Nginx, Java 21 e PostgreSQL 17.
As imagens base têm versão e digest fixos; as dependências de frontend usam o lockfile.
Nenhuma credencial ou certificado operacional pertence ao repositório.

## Preparação

1. Copie `.env.example` para um diretório privado fora do checkout. Defina o domínio,
   o nome exclusivo do stack e os caminhos absolutos dos segredos e do TLS.
2. Crie cinco arquivos com valores aleatórios **distintos**, com pelo menos 32 caracteres:
   `db_owner_password`, `db_runtime_password`, `login_rate_secret`, `waha_api_key` e
   `waha_webhook_hmac`. Os dois últimos são exigidos mesmo com o WhatsApp desligado, porque o
   stack os monta em todo início. No Linux, mantenha o diretório com
   modo `0700` e os arquivos com proprietário `root`, grupo `10001` e modo `0440`.
   O PostgreSQL lê seu segredo antes de reduzir o privilégio; a aplicação recebe
   a senha de execução, o segredo HMAC dos contadores de login e os dois segredos do gateway de
   WhatsApp. O segredo HMAC dos contadores precisa permanecer estável entre reinícios. Acesso ao daemon Docker equivale a administração
   do ambiente e deve ser restrito pela TI.
3. Disponibilize `fullchain.pem` e `privkey.pem` no diretório TLS externo. O processo
   Nginx usa UID/GID `101`; a chave precisa ser legível por esse processo e ficar
   restrita no host. Use certificado válido para o domínio configurado.
4. Reserve armazenamento para banco, documentos permanentes, relatórios temporários
   e recuperação. O orçamento de RAM em execução soma 1.632 MiB e os limites de CPU
   somam 1 CPU. Isso é configuração, não resultado de desempenho em uma VPS.

Use `docker compose --env-file /caminho/privado/sager.env -f infra/production/compose.yml`
como prefixo dos comandos abaixo. `config --quiet` verifica as variáveis obrigatórias
sem imprimir valores. Não use `config` ou `inspect` completo em logs públicos.

## Primeira instalação e atualização

1. `build backend gateway` — gera os dois artefatos do mesmo checkout.
2. `up -d database` — inicia somente o banco, sem publicação de porta no host.
3. `--profile maintenance run --rm migrate` — executa Flyway com a conta proprietária
   e encerra. A aplicação normal exige schema pronto e não executa DDL.
4. `--profile maintenance run --rm initialize-runtime` — cria/atualiza a conta de
   execução e seus privilégios, incluindo a retirada de alteração/exclusão da
   auditoria. Repita após cada migração que criar tabelas.
5. Provisione as contas necessárias pelo comando administrativo interativo do
   backend, com perfil `production` explícito; nunca use senha em argumentos. Vínculos
   continuam explícitos. Registre os operadores responsáveis. O servidor recusa iniciar
   enquanto houver conta ativa sem matrícula: `--sager-account=list` mostra as pendentes,
   e `--sager-account=assign-enrollment --account-id=UUID --matricula=...` resolve cada uma.
6. `up -d backend gateway` — inicia a aplicação e o HTTPS. As portas públicas são
   80 e 443 por padrão; backend e PostgreSQL ficam nas redes privadas.
7. Confira acesso, cookie seguro, integridade dos PDFs e métricas internas. Conserve
   a versão anterior das imagens até o aceite da atualização.

Antes de atualizar, execute o backup coordenado. Migrações são progressivas: não
reverta o schema em uso com `clean` ou SQL destrutivo. Se a versão anterior não for
compatível com a migração, restaure o ponto completo em um stack isolado, confira-o
e só então planeje a troca de tráfego.

O gateway de WhatsApp fica desligado por padrão e não há provedor externo de assinatura.
Ligar o gateway exige segredos próprios, número dedicado, o teste de aceite e o aceite
formal da integração não oficial. Com ele, a VPS precisa de no mínimo 2 vCPU e 4 GB
mais swap, porque os limites somados chegam a 2.432 MiB, e o volume da sessão fica fora
do backup. O passo a passo, incluindo a regra `DOCKER-USER` no host, está em
[docs/whatsapp/OPERACAO.md](../../docs/whatsapp/OPERACAO.md). Não declare autorização
conferida ou entrega de mensagem a partir de teste local, evento recebido ou HTTP aceito.

Contas usam provisionamento operacional. `--sager-account=create` e `reset` leem
senha duas vezes pelo console oculto; `disable` revoga a conta e suas sessões.
`link-resident`, `link-supervisor` e `unlink` exigem UUID explícito e revogam
sessões após alteração. Servidores recuperam a senha com `reset`, após conferência presencial/administrativa. Residentes com cadastro completo usam a recuperação por dados pessoais, sem e-mail. Consulte os [comandos de conta](../../backend/README.md#comandos-de-conta).
Execute com `--profile maintenance run --rm --no-deps -it backend` e os argumentos
documentados em `backend/README.md`; o comando encerra sem abrir servidor HTTP.

O login recusa cinco tentativas por conta em uma janela de 15 minutos e limita
tentativas agregadas por IP; os contadores persistem em PostgreSQL e contêm somente
HMAC, sem matrícula/IP bruto. Login válido reinicia o contador da conta. O gateway
também limita rajadas. Resposta 429 usa erro genérico e `Retry-After`; não revela
se uma conta existe. Cookies usam `Secure`, `HttpOnly` e `SameSite=Lax`; escritas
exigem CSRF. Não habilite o perfil `local` junto com `production`.

## Backup criptografado e restauração

`recovery.py` exige Python 3.10+, Docker Compose e a CLI oficial
[age](https://github.com/FiloSottile/age/releases). A identidade privada de
recuperação deve ficar fora do host da aplicação; a criação usa apenas o destinatário
público. Defina a periodicidade e a cópia externa no ambiente operacional da TI.
Os scripts entregues não criam agendamento para essa rotina.

```sh
python infra/production/recovery.py --env-file /srv/sager/operator.env \
  --work-dir /srv/sager/private-encrypted-tmp create \
  --recipient age1DESTINATARIO_PUBLICO --output /srv/sager/backups/2026-09-30.age
```

O procedimento pausa o backend, captura o dump e os documentos permanentes no mesmo
período sem gravações, calcula hashes e criptografa o pacote completo. Reinicia o
backend que estava em execução mesmo se a criação falhar. O Nginx pode apresentar
indisponibilidade durante a pausa; combine a janela e acompanhe sua duração.
Não copie arquivos reais para `/tmp` em disco aberto: o diretório temporário deve
estar em filesystem criptografado e acessível apenas ao operador. A implementação
usa transferência em blocos para não carregar todo o banco ou volume na RAM.
Relatórios temporários não integram o ponto permanente. Após restaurar, prepare
uma nova consulta para gerar arquivos; não reutilize um job restaurado cujo arquivo
transitório não foi incluído no backup.

Crie um **outro stack**, com nomes e volumes próprios, e inicie apenas seu banco.
O restore recusa o mesmo nome do stack de origem, tabelas existentes, documentos
existentes ou aplicação/gateway em execução:

```sh
python infra/production/recovery.py --env-file /srv/sager/recovery/operator.env \
  --work-dir /srv/sager/recovery/private-encrypted-tmp restore \
  --archive /srv/sager/backups/2026-09-30.age --identity /media/operador/identity.txt
```

Restaure somente pontos da procedência confiável da instituição: um dump contém
código SQL executável. A criptografia e os hashes verificam a integridade do pacote;
não comprovam por si só quem produziu o arquivo.

O restore usa transação única no banco, confere hashes dos documentos, versão do
schema e último evento de auditoria, e descarta as sessões antigas. Mantém a aplicação
parada. Execute `initialize-runtime`, inicie a versão correspondente do backend e
confira os fluxos antes de direcionar tráfego. Qualquer falha parcial deixa o stack
isolado para revisão; o comando não apaga nem sobrescreve dados existentes.

Registre data/hora, versão do software e schema, sequência de auditoria recuperada,
duração, verificação dos fluxos e pessoa responsável. Guarde o relatório sem dados
pessoais. A retenção de backups deve acompanhar a política institucional para os
dados originais; auditoria e documentos permanentes não têm descarte automático.

## Verificação técnica

`bash infra/production/smoke.sh --build` cria um stack descartável com credenciais
e CA sintéticas, compila as imagens do checkout e verifica migrações, role runtime,
HTTPS, cookies, CSRF, cabeçalhos e limites públicos. O script exige Docker Compose,
Python3.10+, OpenSSL e curl; remove somente seu próprio stack e diretório temporário.
Em Windows/Schannel, usa `--ssl-revoke-best-effort` para a CA sintética sem CRL,
preservando a validação da CA e do hostname. Não usa `-k`.

Para usar imagens já compiladas, informe `--backend-image` e `--gateway-image`.

## Política de cache do gateway

Vale para os dois templates, `nginx.conf.template` daqui e `infra/coolify/nginx.conf.template`:

- Arquivos do build com hash de 8 caracteres no nome (`main-<hash>.js`, `chunk-<hash>.js`,
  `styles-<hash>.css` e `media/<nome>-<hash>.<ext>`) saem com
  `Cache-Control: public, max-age=31536000, immutable`. Um nome com hash que não existe na
  versão publicada responde 404 com `no-store`, para que o Cloudflare nunca guarde o erro.
- A página (`index.html`, em qualquer rota), os arquivos de `frontend/public/` sem hash
  (favicon, ícones, `og-image.png`, manifest e marca do IF) e toda resposta de `/api` saem com
  `Cache-Control: no-store`.
- Os cabeçalhos de segurança ficam em `sager-security-headers.conf`, incluído no `server` e na
  location dos arquivos com hash, porque no nginx uma location com `add_header` próprio deixa
  de herdar os do `server`. O `gateway.Dockerfile` copia o arquivo para a imagem.
- O log `operational` traz `$upstream_response_time` depois de `$request_time`, separando o
  tempo do backend do tempo total do pedido.

`infra/coolify/test_start_gateway.py` e os dois smokes conferem essa política. Depois de cada
deploy, confira pelo domínio público (troque `<host>`):

```sh
host=<host>
main=$(curl -s "https://$host/acesso" | grep -oE 'main-[A-Za-z0-9_-]{8}\.js' | head -n 1)
for i in 1 2; do
  curl -s -o /dev/null -D - -w 'ttfb=%{time_starttransfer}\n' "https://$host/$main" \
    | grep -iE '^(cache-control|cf-cache-status)|^ttfb'
done
for path in /acesso /api/v1/auth/csrf; do
  curl -s -o /dev/null -D - "https://$host$path" | grep -iE '^(cache-control|cf-cache-status)'
done
```

Esperado: `cache-control: public, max-age=31536000, immutable` no arquivo com hash,
`cf-cache-status: HIT` no segundo pedido e TTFB de cerca de 30–40 ms. `/acesso` e
`/api/v1/auth/csrf` mostram `no-store` e nunca `HIT`. Anote os números na descrição do PR.
Se o arquivo com hash continuar `BYPASS`, confira no painel do Cloudflare se alguma regra
força "Bypass cache" ou sobrepõe o `Cache-Control` da origem.

## Fontes técnicas

- [Segredos no Docker Compose](https://docs.docker.com/compose/how-tos/use-secrets/).
- [Configuração externa e configtree no Spring Boot](https://docs.spring.io/spring-boot/reference/features/external-config.html).
- [HTTPS no Nginx](https://nginx.org/en/docs/http/configuring_https_servers.html).
- [pg_dump do PostgreSQL 17](https://www.postgresql.org/docs/17/app-pgdump.html) e
  [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).
- [Imagens oficiais Eclipse Temurin](https://github.com/docker-library/official-images/blob/master/library/eclipse-temurin).

