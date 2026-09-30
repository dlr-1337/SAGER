# Operação em produção

Configuração técnica para Linux com Docker Compose, Nginx, Java 21 e PostgreSQL 17.
As imagens base têm versão e digest fixos; as dependências de frontend usam o lockfile.
Nenhuma credencial ou certificado operacional pertence ao repositório.

## Preparação

1. Copie `.env.example` para um diretório privado fora do checkout. Defina o domínio,
   o nome exclusivo do stack e os caminhos absolutos dos segredos e do TLS.
2. Crie três arquivos com valores aleatórios **distintos**, com pelo menos 32 caracteres:
   `db_owner_password`, `db_runtime_password` e `login_rate_secret`. No Linux, mantenha o diretório com
   modo `0700` e os arquivos com proprietário `root`, grupo `10001` e modo `0440`.
   O PostgreSQL lê seu segredo antes de reduzir o privilégio; a aplicação recebe
   somente a senha de execução e o segredo HMAC dos contadores de login. O segredo
   HMAC precisa permanecer estável entre reinícios. Acesso ao daemon Docker equivale a administração
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
   backend, com perfil `production` explícito; nunca use senha em argumentos. Vínculos e habilitações assistenciais
   continuam explícitos. Registre os operadores responsáveis.
6. `up -d backend gateway` — inicia a aplicação e o HTTPS. As portas públicas são
   80 e 443 por padrão; backend e PostgreSQL ficam nas redes privadas.
7. Confira acesso, cookie seguro, ausência de demonstração, integridade dos PDFs e
   métricas internas. Conserve a versão anterior das imagens até o aceite da atualização.

Antes de atualizar, execute o backup coordenado. Migrações são progressivas: não
reverta o schema em uso com `clean` ou SQL destrutivo. Se a versão anterior não for
compatível com a migração, restaure o ponto completo em um stack isolado, confira-o
e só então planeje a troca de tráfego.

Os provedores externos ficam desabilitados por padrão. A habilitação de Clicksign
e WhatsApp requer configuração e segredos próprios, credenciais autorizadas,
template aprovado e teste real da instituição. Não declare assinatura confirmada
ou entrega de mensagem a partir de teste local, callback de tela ou HTTP aceito.

Contas usam provisionamento operacional. `--sager-account=create` e `reset` leem
senha duas vezes pelo console oculto; `disable` revoga a conta e suas sessões.
`link-resident`, `link-supervisor` e `unlink` exigem UUID explícito e revogam
sessões após alteração. Recuperação de senha usa `reset`, depois de conferência
de identidade pela instituição; não existe envio automático de senha por email.
Execute com `--profile maintenance run --rm --no-deps -it backend` e os argumentos
documentados em `backend/README.md`; o comando encerra sem abrir servidor HTTP.

O login recusa cinco tentativas por conta em uma janela de 15 minutos e limita
tentativas agregadas por IP; os contadores persistem em PostgreSQL e contêm somente
HMAC, sem email/IP bruto. Login válido reinicia o contador da conta. O gateway
também limita rajadas. Resposta 429 usa erro genérico e `Retry-After`; não revela
se uma conta existe. Cookies usam `Secure`, `HttpOnly` e `SameSite=Lax`; escritas
exigem CSRF. Não habilite o perfil `local` junto com `production`.

## Backup criptografado e restauração

`recovery.py` exige Python 3.10+, Docker Compose e a CLI oficial
[age](https://github.com/FiloSottile/age/releases). A identidade privada de
recuperação deve ficar fora do host da aplicação; a criação usa apenas o destinatário
público. Defina a periodicidade e a cópia externa no ambiente operacional da TI.
Não existe agendamento criado pelo Codex para essa rotina.

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
O [QA de F7](../../docs/fase-7/QA.md) distingue smoke, prova funcional HTTPS,
medição local sob limites e recuperação da versão completa.

## Fontes técnicas

- [Segredos no Docker Compose](https://docs.docker.com/compose/how-tos/use-secrets/).
- [Configuração externa e configtree no Spring Boot](https://docs.spring.io/spring-boot/reference/features/external-config.html).
- [HTTPS no Nginx](https://nginx.org/en/docs/http/configuring_https_servers.html).
- [pg_dump do PostgreSQL 17](https://www.postgresql.org/docs/17/app-pgdump.html) e
  [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).
- [Imagens oficiais Eclipse Temurin](https://github.com/docker-library/official-images/blob/master/library/eclipse-temurin).
