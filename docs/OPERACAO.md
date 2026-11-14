# Operação do SAGER

Como rodar o sistema na máquina local, como verificar cada mudança no PC e onde estão os guias de produção. A arquitetura e as decisões estão em [ARQUITETURA.md](ARQUITETURA.md).

## Ambiente local com Docker

Basta ter Docker com Compose e Bash. Node, Java, Maven e PostgreSQL rodam nos containers, e os builds usam os lockfiles do projeto. Na raiz:

```bash
./sager up
./sager account create --matricula=TESTE-GESTOR --name='Gestor de Teste' --profile=gestor
```

O segundo comando pede a senha duas vezes, sem mostrar no terminal. A senha precisa ter pelo menos 8 caracteres; senhas fáceis e a própria matrícula são recusadas. Não existe conta nem senha padrão. Depois, abra http://127.0.0.1:4200/acesso e entre com a matrícula. A primeira compilação leva alguns minutos.

| Comando | O que faz |
| --- | --- |
| `./sager up` | Constrói e inicia tudo. Repita depois de mudar código Java ou Angular. |
| `./sager status` | Mostra os serviços. |
| `./sager logs [backend]` | Acompanha os logs. |
| `./sager down` | Para tudo sem apagar os volumes. |
| `./sager backup` | Copia o banco para `backups/sager-<data>.sql`. |
| `./sager account <ação>` | Administra contas pelo terminal. |

### Contas

`create` só cria contas de gestor (`--profile=gestor`). O e-mail é opcional e só serve de contato (`--email=...`). Residentes e supervisores cadastrados pela interface já recebem a conta vinculada, com a senha escolhida no cadastro.

| Ação | Uso |
| --- | --- |
| `create` | Cria uma conta de gestor e pede a senha. |
| `reset` | Troca a senha e encerra as sessões. |
| `disable` | Desativa a conta e encerra as sessões. |
| `link-resident`, `link-supervisor`, `unlink` | Liga ou desliga uma conta já existente de um cadastro, por UUID. |
| `list` | Lista as contas, com a matrícula de cada uma ou `PENDENTE`. |
| `assign-enrollment` | Atribui a matrícula a uma conta antiga que não tem. |
| `help` | Mostra a ajuda. |

Cada comando que grava (`create`, `reset`, `disable`, `link-*`, `unlink` e `assign-enrollment`) registra um evento de conta na auditoria, com a origem `OPERATOR_CLI`, sem autor e só com os nomes dos campos. `list` e `help` não gravam nada.

```bash
./sager account reset --matricula=TESTE-GESTOR
./sager account list
./sager account assign-enrollment --account-id=UUID --matricula=MATRICULA-CONFERIDA
```

O prefixo `TESTE-` é só para registros sintéticos. Com dados reais, use os identificadores oficiais e nunca derive a matrícula do e-mail. Os detalhes de cada ação estão no [README do backend](../backend/README.md).

### Configuração privada

Na primeira execução, `./sager` cria `.env.local` com permissão 600, senha aleatória do banco, segredo dos contadores de login e os dois segredos do gateway de WhatsApp. O arquivo fica fora do Git e do contexto de build. Não apague esse arquivo nem os volumes para redefinir uma conta: use `account reset`. Se o Docker não estiver acessível ao usuário, o script tenta `sudo -n docker`, sem mudar regras de sudo nem permissões do socket.

### Rede e persistência

- Só a porta 4200 é publicada, em `127.0.0.1`. O PostgreSQL não publica portas.
- O frontend divide a rede do backend e repassa `/api` para `127.0.0.1:8080`. Assim o backend continua no perfil `local`, preso ao loopback. Não use esse servidor para acesso público.
- O banco fica no volume `sager-local_sager_postgres_data`, que `SAGER_DB_VOLUME` pode trocar para um teste isolado. Documentos e relatórios ficam em `sager-local_documents` e `sager-local_reports`, com dono `10001`, o usuário do backend.
- `./sager down` nunca apaga volumes.
- O arquivo de `./sager backup` contém dados e hashes de senha. Guarde em local privado; a pasta `backups/` é ignorada pelo Git. Documentos e relatórios ficam nos volumes e precisam de cópia à parte.

## Desenvolvimento sem Docker

O backend roda direto no host com JDK 21 e um PostgreSQL local; veja o [README do backend](../backend/README.md). A interface roda com `npm start` e repassa `/api` para `127.0.0.1:8080`; veja o [README do frontend](../frontend/README.md).

## Verificação local

`./sager ci` roda no PC, na raiz do repositório, os mesmos passos dos três jobs de [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), mais a validação do OpenSpec. Sem argumentos, roda os quatro jobs; para repetir um só, passe o nome, como em `./sager ci frontend`. Precisa de Docker, JDK 21, Node 24 e Python 3, e leva cerca de 30 minutos.

| Job | O que verifica |
| --- | --- |
| openspec | `npx @fission-ai/openspec@2.0.0 validate --all --strict` na raiz. |
| backend | `./mvnw -B -ntp clean verify` com PostgreSQL 17.11 descartável (Testcontainers): migrações, API, autorização, sessão, CSRF e concorrência. |
| frontend | `npm ci`, testes unitários, build de produção e jornadas Playwright no Chromium, com um único worker e sem nova tentativa automática. O Playwright recebe `CI=1` e a porta `SAGER_E2E_PORT` (4323 por padrão), para nunca reaproveitar o `./sager up` da porta 4200. |
| infra | Sintaxe dos scripts, testes de recuperação, do gateway de WhatsApp e do wrapper do Coolify, e smoke dos stacks de produção e do Coolify com HTTPS, cookies, CSRF e cabeçalhos. Os smokes criam projetos Docker descartáveis e não tocam no `sager-local`; no fim, o job apaga as imagens que eles construíram. Segredos e CA são sintéticos. |

- **Logs e resultado.** Cada job grava a saída em `.ci/<job>.log` (pasta ignorada pelo Git). Um job que falha não impede os seguintes. O resumo final mostra `ok` ou `falhou` por job, o commit verificado, se havia alterações sem commit e quantos caminhos fora do Git estavam na árvore, lidos antes do primeiro job. Ele avisa se o commit ou os arquivos mudaram durante a execução, e o comando sai com código 1 se algum job falhou.
- **Jornadas.** Fica de fora só "captura telas centrais", que grava imagens em `.impeccable/reviews/` (pasta ignorada pelo Git). Para gerar as capturas, use o comando descrito no [DESIGN.md](../DESIGN.md).
- **Alcance.** As jornadas com API interceptada verificam a interface. Os testes do backend verificam o PostgreSQL real. A verificação não substitui a homologação de regras, identidade ou integrações.

**Antes de mesclar e antes do deploy.** Rode `./sager ci` no commit final do PR e cole o resumo no PR. A branch `main` não exige checks no GitHub.

**Workflow do GitHub.** Desde 14/11/2026 o workflow CI está desativado no GitHub, porque a conta deixou de iniciar jobs por um problema de cobrança. O arquivo continua no repositório, com os três jobs em Ubuntu 24.04, as actions fixadas pelo SHA do commit e só a permissão `contents: read`. Para voltar a usá-lo, rode `gh workflow enable CI --repo dlr-1337/SAGER`.

## Produção

- [infra/production/README.md](../infra/production/README.md): instalação com Docker Compose, HTTPS, segredos externos, migração, contas, backup criptografado e restauração.
- [infra/coolify/README.md](../infra/coolify/README.md): homologação no Coolify com [compose.coolify.yml](../compose.coolify.yml).
- [whatsapp/OPERACAO.md](whatsapp/OPERACAO.md): como ligar e operar o gateway de WhatsApp.

O `compose.yaml` da raiz é só para uso local. No stack de `infra/production`, os três serviços permanentes têm limites de 512 MiB e 0,25 CPU para o PostgreSQL, 1.024 MiB e 0,65 CPU para o backend e 96 MiB e 0,10 CPU para o gateway HTTPS: 1.632 MiB e 1 CPU no total. Com o WhatsApp ligado, somam-se 768 MiB e 0,5 CPU do gateway de WhatsApp e 32 MiB e 0,10 CPU do seu proxy, num total de 2.432 MiB e 1,6 CPU. Nesse caso, a VPS precisa de pelo menos 2 vCPU e 4 GB de RAM, mais swap. No Coolify (`compose.coolify.yml`), o PostgreSQL tem 1,0 CPU e o backend 2,0, num total de 3,1 CPU (3,7 com o WhatsApp); a memória é a mesma. Os containers de manutenção têm limites próprios. Esses números são configuração, não medição de desempenho na VPS.
