## Context

Motivação em proposal.md. Como o banco está montado no Coolify (`compose.coolify.yml`):
- o serviço `database` fica só na rede interna `data`;
- a autenticação local é `scram-sha-256`;
- a senha do dono fica em `/run/secrets/db_owner_password`;
- o backend usa o papel `sager_runtime`.

## Goals / Non-Goals

**Goals:**
- consultar o banco de produção para mostrar como os dados ficam salvos, sem mudar o stack.

**Non-Goals:**
- acesso ao banco de fora do servidor;
- acesso de escrita.

## Decisions

### D1. `psql` somente leitura dentro do contêiner do banco

A consulta usa `docker compose ... exec database`, com o mesmo `--project-name` e o mesmo checkout de "Inspeção do stack", e roda o `psql`:
- `PGPASSWORD` é lido do segredo dentro do contêiner, então a senha não aparece na tela, no argumento nem no histórico;
- `PGOPTIONS="-c default_transaction_read_only=on"` faz o PostgreSQL recusar `INSERT`, `UPDATE` e `DELETE` na sessão.

*Rejeitadas:*
- publicar a porta 5432 no servidor (mesmo em 127.0.0.1) e abrir um túnel SSH para um cliente gráfico. Isso quebra a regra do smoke de não publicar porta e muda o Compose;
- Adminer ou pgweb atrás do Traefik. Isso exporia o banco na internet, protegido só por uma senha.

### D2. Somente leitura por sessão, sem papel novo

`default_transaction_read_only` evita mudança por engano. Não é barreira de segurança: quem tem o terminal do servidor já tem o dono do banco.

*Rejeitada:* criar um papel `sager_readonly`. Ele exigiria um segredo novo, uma migração de papéis e mudanças em `start.sh`, sem ganho para quem já opera o servidor.

## O que a instituição e o operador ainda decidem

- O operador roda o comando no terminal do servidor. O assistente não tem esse acesso.
- Se a instituição quiser um cliente gráfico, isso vira uma change própria, com túnel SSH e aprovação de quem administra o servidor.
