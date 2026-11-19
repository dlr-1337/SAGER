# Proposal

## Why

Na reunião de 19/11/2026, o grupo pediu para conseguir abrir o banco de produção e mostrar à Assistência Estudantil como os dados ficam salvos. Hoje o banco do Coolify fica numa rede interna, sem porta publicada (`infra/coolify/smoke.py` recusa porta publicada), e não há um passo a passo para consultá-lo.

## What Changes

- `infra/coolify/README.md` ganha a seção "Ver o banco". Ela abre, no terminal do servidor, uma sessão do `psql` somente leitura dentro do contêiner do banco:
  - a senha sai do segredo do contêiner;
  - `default_transaction_read_only=on` recusa escrita por engano;
  - a seção traz comandos de exemplo.
- `docs/OPERACAO.md` aponta para essa seção.

## Capabilities

### New Capabilities

Nenhuma. A mudança é só de documentação operacional (`skip_specs: true`).

### Modified Capabilities

Nenhuma.

## Impact

- Regras do AGENTS.md afetadas:
  - "Security & Demo Data": produção com segredos externos e sem dado de residente fora do servidor;
  - a regra de operação: comandos no servidor ficam com o operador.
- Arquivos: `infra/coolify/README.md` e `docs/OPERACAO.md`.
- API, banco, migrações, Compose e permissões: nada muda.

## Fora do escopo

- Ferramenta gráfica de banco (Adminer, pgweb) publicada na internet ou porta do banco publicada no servidor. As duas abririam o banco para fora da rede interna.
- Papel de banco novo só de leitura, com senha própria. Ele precisaria de segredo novo e de migração de papéis, e a sessão somente leitura atende ao pedido.
