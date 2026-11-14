# Proposal

## Why

O dono pediu um README profissional e completo, uma documentação curta e didática de como o sistema foi desenvolvido, uma licença que impeça o uso do código por terceiros e as branches do repositório em ordem. Hoje o README mistura apresentação com o passo a passo de cada perfil, não explica o método nem a arquitetura em uma página e não diz quem são os autores. O repositório é público e não tem licença, e o GitHub tinha 37 branches além da `main`, 27 delas já mescladas. A `docs/ARQUITETURA.md` ainda dizia que as regras centrais não tinham spec, o que deixou de ser verdade com `document-core-baseline`.

## What Changes

- `README.md` reescrito como página de apresentação: sobre, funcionalidades, perfis, arquitetura com diagrama, estrutura do repositório, como rodar, testes, implantação, segurança, como foi desenvolvido, mapa da documentação, licença e autores.
- `docs/MANUAL.md` novo: o guia de uso por perfil que estava no README, com sumário, tabela de problemas comuns e glossário.
- `docs/DESENVOLVIMENTO.md` novo: método da monografia, desenvolvimento guiado pelo OpenSpec, organização do código, padrões, testes, verificação e entrega e o passo a passo de uma mudança.
- `LICENSE` novo: licença de uso restrito, com todos os direitos reservados aos autores e licença gratuita de uso, manutenção e adaptação ao IF Goiano.
- `docs/ARQUITETURA.md`: a seção "Comportamento e OpenSpec" passa a refletir as 38 capacidades, e a licença entra nas pendências institucionais.
- `AGENTS.md`: cita os dois documentos novos e a licença.
- `frontend/src/fonts/MaterialSymbols-LICENSE.txt`: a licença Apache-2.0 da fonte de ícones passa a acompanhar o arquivo da fonte, que já estava no repositório.
- `.gitattributes`: o script `sager` sai sempre com fim de linha LF, para o `./sager up` funcionar num clone novo no Windows.
- Branches: as mescladas na `main` são apagadas; as que têm commits fora da `main` viram tags `arquivo/<branch>` antes de sair; as worktrees antigas saem depois de guardar as mudanças sem commit em `backups/`.

## Capabilities

### New Capabilities

Nenhuma. O change só mexe em documentação e na organização do repositório (`skip_specs: true`).

### Modified Capabilities

Nenhuma.

## Impact

- Regra do AGENTS.md afetada: "Project Structure & Module Organization", que passa a citar `docs/MANUAL.md`, `docs/DESENVOLVIMENTO.md` e `LICENSE`.
- Arquivos: `README.md`, `LICENSE`, `docs/MANUAL.md`, `docs/DESENVOLVIMENTO.md`, `docs/ARQUITETURA.md`, `AGENTS.md`, `.gitattributes` e `frontend/src/fonts/MaterialSymbols-LICENSE.txt`.
- No GitHub: branches apagadas e tags `arquivo/*` criadas.
- Código, API, banco, migrações e telas: nada muda.

## Fora do escopo

- Comentar o código arquivo por arquivo. O código segue a organização por área e os nomes descritos em `docs/DESENVOLVIMENTO.md`; comentário só explica o porquê que o código não mostra.
- Tornar o repositório privado. O Coolify faz o deploy a partir dele, e a decisão é do dono.
- As branches `feature/db` e `refactor/reuse-cleanup`, que têm os pull requests 16 e 17 abertos pelo coautor.
- Registrar o software no INPI e confirmar a titularidade com o IF Goiano (design.md, Pendências).
