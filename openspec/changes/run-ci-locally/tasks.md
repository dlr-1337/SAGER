# Tasks

## 1. Comando local

- [x] 1.1 Em `sager`, acrescentar o subcomando `ci` (decisões 1, 3 e 4 de design.md) e a linha dele na ajuda; em `.gitignore`, acrescentar `/.ci/`. Verificar: `bash -n sager` passa; `./sager ci nada` sai com código 2 e cita os quatro jobs; `./sager ci openspec` termina com `openspec: ok`; `git check-ignore -v .ci/x` imprime a regra.
- [x] 1.2 A primeira execução reprovou o frontend em 1 de 723 testes: `reports-local-api.service.spec.ts` não zerava o token CSRF que fica em memória em `core/api.ts`, e herdava o de outro arquivo de teste conforme a ordem. Zerar a sessão antes de cada teste, como os outros 15 specs que tocam CSRF já fazem. Verificar: o spec passa junto com `demo-entry.service.spec.ts`, que deixa um token na memória, e na execução da 1.3.
- [ ] 1.3 Rodar `./sager ci` sem argumentos. Verificar: o resumo mostra `ok` para openspec, backend, frontend e infra, e `docker compose ls --all` mostra o `sager-local` no mesmo estado de antes.

## 2. Documentação e GitHub

- [x] 2.1 Em `docs/OPERACAO.md`, trocar a seção "Integração contínua" por "Verificação local", com o comando, os jobs, os logs, o critério antes de mesclar e de fazer deploy e o workflow do GitHub desativado; em `README.md`, trocar "A CI roda os mesmos passos em cada pull request." por `./sager ci`; no `AGENTS.md`, trocar as duas citações da CI do GitHub por `./sager ci`. Em `docs/ARQUITETURA.md`, `backend/README.md`, `frontend/README.md` e `infra/coolify/README.md`, trocar as frases que tratam a CI como ativa. Verificar: `grep -n -E 'GitHub Actions pipeline|CI runs' AGENTS.md` não acha nada, `git grep -n -E 'A CI (roda|usa|mantém)|o projeto e a CI' -- '*.md' ':!openspec/changes'` não acha nada, `grep -c 'sager ci' docs/OPERACAO.md README.md AGENTS.md` dá pelo menos 1 em cada arquivo e os links de `docs/OPERACAO.md` continuam válidos.
- [x] 2.2 Desativar o workflow: `gh workflow disable CI --repo dlr-1337/SAGER`. Verificar: `gh workflow list --all --repo dlr-1337/SAGER` mostra CI como `disabled_manually`.
- [ ] 2.3 Verificar: `npx -y @fission-ai/openspec@2.0.0 validate run-ci-locally --strict` passa.
