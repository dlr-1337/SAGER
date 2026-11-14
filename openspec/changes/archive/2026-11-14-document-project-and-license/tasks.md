# Tasks

## 1. Documentação

- [x] 1.1 Reescrever `README.md` (design.md, decisão 1) e criar `docs/MANUAL.md` com o guia por perfil que saiu dele. Verificar: todo link relativo do README, do MANUAL e do DESENVOLVIMENTO aponta para arquivo que existe, e cada âncora usada existe no destino.
- [x] 1.2 Criar `docs/DESENVOLVIMENTO.md`. Verificar: números e afirmações conferidos na monografia, nas specs e no código (design.md, decisão 4).
- [x] 1.3 Em `docs/ARQUITETURA.md`, atualizar "Comportamento e OpenSpec" e acrescentar a licença às pendências; no `AGENTS.md`, citar os documentos novos e a licença. Verificar: `grep -n "specs parciais" docs/ARQUITETURA.md` não acha nada.

## 2. Licença

- [x] 2.1 Criar `LICENSE` (design.md, decisão 2). Verificar: o texto cita os dois autores, as Leis 9.609/1998 e 9.610/1998, a licença ao IF Goiano, a avaliação acadêmica, os Termos do GitHub, os componentes de terceiros e a marca do IF Goiano; o README e o AGENTS.md apontam para ele.
- [x] 2.2 Copiar a licença da fonte de ícones para `frontend/src/fonts/MaterialSymbols-LICENSE.txt` e fixar `sager text eol=lf` no `.gitattributes`. Verificar: `git check-attr eol sager` responde `lf` e o arquivo de licença começa por "Apache License".

## 3. Branches

- [x] 3.1 Criar e enviar as tags `arquivo/<branch>` das branches com commits fora da `main` e sem pull request aberto; salvar em `backups/arquivo-branches-2026-11-14/` as mudanças sem commit das worktrees antigas; remover as worktrees e apagar as branches mescladas e as arquivadas, no PC e no GitHub. Verificar: `git ls-remote --tags origin 'arquivo/*'` lista 9 tags; `git branch -r` mostra só `main`, `feature/db` e `refactor/reuse-cleanup`; `git worktree list` mostra só a pasta principal.

## 4. Validação

- [x] 4.1 Verificar: `npx -y @fission-ai/openspec@2.0.0 validate document-project-and-license --strict` passa e `./sager ci openspec` termina com `openspec: ok`.
