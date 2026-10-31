# Executar o SAGER com Docker

Na máquina local são necessários Docker, Compose e Bash. Node, npm, JDK, Maven e PostgreSQL executam nos containers. Os builds usam os lockfiles do projeto.

```bash
./sager up
./sager status
./sager logs backend
./sager account create --matricula=TESTE-GESTOR --name='Gestor de Teste' --profile=gestor
```

Informe e confirme a senha no terminal oculto (pelo menos 8 caracteres; senhas fáceis demais e a própria matrícula são recusadas). Não há conta nem senha padrão. Os perfis disponíveis são gestor, supervisor, residente e saude. O e-mail do operador é metadado opcional (`--email=...`). Cadastre residentes pela interface para criar automaticamente o vínculo com sua conta.

Acesse http://127.0.0.1:4200/acesso. A primeira compilação pode levar alguns minutos. Use `./sager down` para parar sem apagar volumes e `./sager up` para reconstruir/iniciar. Após alterações de Java ou Angular, repita `up`. `./sager account help` lista os comandos. Para redefinir uma conta operacional:

```bash
./sager account reset --matricula=TESTE-GESTOR
```

O arquivo `.env.local` é criado com permissão 600, senha aleatória de banco e segredo aleatório dos contadores. Ambos estão fora do Git e do contexto de build. Se o Docker não estiver acessível ao usuário, o script usa `sudo -n docker` quando disponível. Nenhuma regra de sudo ou permissão do socket é alterada.

## Rede e persistência

Somente a porta 4200 é publicada, em `127.0.0.1`. PostgreSQL não publica portas. O frontend compartilha o namespace de rede do backend e encaminha `/api` para `127.0.0.1:8080`. Assim, o backend mantém o perfil local exclusivo e a proteção de loopback original. Não use esse servidor de desenvolvimento para acesso público.

O banco usa o volume estável `sager-local_sager_postgres_data`; documentos e relatórios usam `sager-local_documents` e `sager-local_reports`. A preparação de dados atribui acesso ao usuário 10001 do backend. `down` nunca usa `--volumes`.

## Reaproveitar o ambiente anterior

Pare os processos antigos de Angular/Java que ocupam 4200/8080. Na migração deste workspace eram os serviços de usuário `sager-frontend.service` e `sager-backend.service`. Não pare outros projetos.

Na primeira execução, o script reaproveita `SAGER_DB_PASSWORD` de `$XDG_STATE_HOME/sager-local/runtime.env` (ou `~/.local/state/sager-local/runtime.env`) se esse arquivo existir. Em outra instalação, preencha `.env.local` com a senha real do banco antes de iniciar. Nunca gere outro volume ou apague o banco para corrigir senha.

Antes de atualizar, faça backup do banco com `./sager backup` e copie também os diretórios privados de documentos e relatórios. O backup SQL contém dados e hashes de credenciais: mantenha-o privado. Na transição do armazenamento no host, copie os conteúdos para os volumes de documentos/relatórios e ajuste o proprietário para 10001. Preserve os originais até validar os arquivos após a troca.

A V20 preserva registros, UUIDs, hashes e perfis. Cursos antigos são agrupados por espaços e caixa. Registros anteriores sem nascimento continuam legíveis; futuras alterações ainda exigem a data. Matrículas só são migradas de vínculos explícitos sem colisão. Todas as sessões antigas são encerradas.

```bash
./sager account list
./sager account assign-enrollment --account-id=UUID --matricula=MATRICULA-CONFERIDA
```

Escolha os identificadores oficiais ao mapear dados reais. Não derive matrículas de e-mails. O prefixo `TESTE-` dos exemplos é apenas para registros sintéticos.

## VPS e Coolify

Use [compose.coolify.yml](../compose.coolify.yml) e o [guia Coolify](../infra/coolify/README.md), ou o [Compose de produção](../infra/production/README.md). Esses ambientes continuam com HTTPS, frontend estático, papéis separados, segredos externos e provedores desabilitados por padrão. O Compose da raiz é exclusivamente local.

Esta revisão prepara a instalação; não publica alterações automaticamente na VPS.
