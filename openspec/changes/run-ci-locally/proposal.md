# Proposal

## Why

Desde 13/11/2026 o GitHub não inicia nenhum job do workflow CI ("account is locked due to a billing issue"), e cada push no PR #28 volta com três falhas que não têm relação com o código. O dono decidiu parar de usar a CI do GitHub e verificar as mudanças no próprio PC. Hoje isso exige lembrar quatro grupos de comandos, a porta própria do Playwright e o `CI=1` que impede reaproveitar o `./sager up` da porta 4200. Um esquecimento antes do deploy pode levar ao servidor uma migração não testada. O AGENTS.md ("OpenSpec workflow") diz que a CI roda `openspec validate --all --strict`, e o `docs/OPERACAO.md` manda conferir os três jobs verdes antes de mesclar. As duas regras deixam de ser cumpríveis.

## What Changes

- Novo subcomando `./sager ci [openspec|backend|frontend|infra]...`. Sem argumentos, ele roda na máquina local os mesmos passos dos três jobs de `.github/workflows/ci.yml`, mais a validação do OpenSpec. Cada job grava seu log em `.ci/<job>.log` (ignorado pelo Git), e o comando termina com um resumo por job e o commit verificado.
- O workflow CI é desativado no GitHub (`gh workflow disable CI`). O arquivo `.github/workflows/ci.yml` continua no repositório, sem mudança.
- `docs/OPERACAO.md`, `README.md` e `AGENTS.md` passam a indicar `./sager ci` como a verificação antes de mesclar e de fazer deploy.
- `docs/ARQUITETURA.md`, `backend/README.md`, `frontend/README.md` e `infra/coolify/README.md` deixam de tratar a CI do GitHub como ativa.

## Capabilities

### New Capabilities

Nenhuma. O change só mexe em ferramenta e documentação (`skip_specs: true`).

### Modified Capabilities

Nenhuma.

## Impact

- Regras do AGENTS.md afetadas: "Build, Test, and Development Commands" (o link para o pipeline do GitHub Actions passa a citar `./sager ci`) e "OpenSpec workflow" (quem roda `validate --all --strict` passa a ser `./sager ci`).
- Arquivos: `sager`, `.gitignore`, `docs/OPERACAO.md`, `docs/ARQUITETURA.md`, `README.md`, `AGENTS.md`, `backend/README.md`, `frontend/README.md`, `infra/coolify/README.md`. No GitHub, o estado do workflow CI.
- Código, API, banco e migrações: nada muda.

## Fora do escopo

- Apagar `.github/workflows/ci.yml`. A monografia descreve esse workflow (cap4, RNF de suportabilidade; cap5, seção de testes e integração contínua; cap6; conclusão).
- Hook de pre-push, runner auto-hospedado do GitHub e publicação de status no commit.
- Mudar o texto da monografia, que fica com o dono (design.md, Pendências).
