# Proposal

## Why

A documentação mistura cerca de 430 KB de histórico das fases (docs/fase-0 a fase-7, ROADMAP, QA-*, PESQUISA, PRD e Especificação Técnica, que ainda citam Google, Clicksign, modo demonstração e e-mail no login) com os três guias que ainda valem. O AGENTS.md, fonte canônica segundo `openspec/config.yaml`, aponta para esses arquivos e para a demonstração e a saúde que estão saindo. Sem um documento de arquitetura e outro de operação, quem chega ao projeto (inclusive a banca do TCC) não acha o essencial, e nada obriga a usar o OpenSpec: sete commits de comportamento passaram sem change desde 31/10.

## What Changes

- Novo `docs/ARQUITETURA.md`: camadas (Angular, Spring Boot, PostgreSQL, gateway), módulos por feature no frontend e no backend, segurança (sessão no servidor, CSRF, autorização no servidor, auditoria transacional, papéis de banco separados), contrato comum da API, decisões no formato ADR, cada uma com a alternativa rejeitada, e uma seção única de pendências institucionais.
- Novo `docs/OPERACAO.md`: junta a parte atual de `docs/DOCKER.md` e `docs/CI.md` e aponta para `infra/coolify/README.md`, `infra/production/README.md` e `docs/whatsapp/OPERACAO.md`.
- Remoção (o git guarda o histórico): `docs/fase-0` a `docs/fase-7`, `docs/ROADMAP_IMPLEMENTACAO.md`, `docs/QA-2026-10-16.md`, `docs/QA-RELEASE-2026-10-17.md`, `docs/whatsapp/PESQUISA.md`, `docs/DOCKER.md`, `docs/CI.md`, `SAGER_PRD_v2.0_Angular_SpringBoot.md` e `SAGER_Especificacao_Tecnica_v2.0.md`, depois de levar o que ainda vale para os documentos novos.
- `README.md` reescrito e curto: visão geral, os três perfis (gestor, supervisor, residente), uso curto por perfil com login por matrícula, como rodar, como verificar e mapa dos documentos.
- `backend/README.md`, `frontend/README.md`, `infra/production/README.md` e `infra/coolify/README.md` enxutos, sem as seções históricas (Fase 2, saúde, revisão de 16/10, V20/V21) e com os links corrigidos. Os comandos de conta inicial, inspeção e backup do antigo `docs/fase-7/COOLIFY.md` que ainda não estão no runbook do Coolify passam para ele. `docs/whatsapp/OPERACAO.md` só troca os links mortos.
- `PRODUCT.md` e `DESIGN.md` continuam como direção visual, sem referência à demonstração, à saúde, ao PRD nem à Especificação Técnica.
- `AGENTS.md` atualizado: sem demonstração e sem saúde, com os links novos, a regra de saídas restrita ao residente menor de idade e uma seção `## OpenSpec workflow`.
- `openspec/config.yaml`: o contexto passa a dizer que AGENTS.md e `openspec/specs` são canônicos, e a regra da proposta passa a pedir a citação do requisito de spec ou da regra do AGENTS.md, em vez do PRD.
- CI: passo `npx @fission-ai/openspec@2.0.0 validate --all --strict` no job do frontend.
- `.gitignore`: `/monografia*`, `/proposta_tcc*.pdf`, `/.claude/settings.local.json`, `/.claude/worktrees/`, `/.claude/noite/`, `/backups/` (já existe) e `/.impeccable/reviews/`.
- Versionar as skills do OpenSpec em `.agents/skills/` e `.claude/skills/openspec-*`.
- `.impeccable`: tirar do índice as capturas `reviews/` (46 `pr-*.png` e 11 regeneradas pelo e2e), `mocks/inicio-a.png`, `mocks/inicio-c.png`, `REVIEW.md`, `inicio-brief-body.md` e `surfaces/`. Ficam `config.json`, `build/spec.json` e os mocks citados pelo DESIGN.md.
- Nenhuma mudança de comportamento: o change declara `skip_specs: true` no `.openspec.yaml` e não traz spec delta.

## Capabilities

### New Capabilities

Nenhuma. O change só mexe em documentação, configuração do repositório e CI (`skip_specs: true`).

### Modified Capabilities

Nenhuma. Nenhum requisito de `openspec/specs` muda.

## Impact

- Regras do AGENTS.md afetadas: "Project Structure & Module Organization" (o PRD, a especificação e `.impeccable/` deixam de ser registro de requisitos), "Build, Test, and Development Commands" (`npm start` não serve mais a demonstração e `docs/CI.md` vira `docs/OPERACAO.md`), "Commit & Pull Request Guidelines" (citar o change do OpenSpec em vez dos requisitos do PRD), "Security & Demo Data" (saem as frases da demonstração e de `docs/fase-7/QA.md`, e fica a proibição de versionar originais DOCX/PDF/ZIP, que o `.gitignore` passa a cobrir) e "Current Domain Decisions" (sai a referência a D01, ao conteúdo de saúde e a `docs/fase-3/README.md` e `docs/fase-4/CONTRATO.md`).
- Arquivos: `README.md`, `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, `backend/README.md`, `frontend/README.md`, `infra/production/README.md`, `infra/coolify/README.md`, `docs/whatsapp/OPERACAO.md`, `docs/`, `openspec/config.yaml`, `.github/workflows/ci.yml`, `.gitignore`, `.agents/skills/`, `.claude/skills/`, `.impeccable/`.
- CI: o job "Frontend · Chromium" passa a falhar quando uma spec ou um change ativo não passa em `openspec validate --strict`.
- Código, API, banco e migrações: nada muda.

### Fora do escopo

- Remover o modo demonstração e o módulo de saúde do código: são os changes `remove-demo-mode` e `remove-health-module`.
- Escrever as specs de base dos módulos centrais com as regras dos contratos de fase: change `document-core-baseline`, na onda 4. Até lá, as regras ficam no AGENTS.md e no histórico do git.
- Código morto (`shared/timeline.component.ts`, `shared/index.ts`, `nonEmptyString`, rotas duplicadas de limpeza e ranking), o texto "outra entrega da Fase 2" em `resident-detail.component.ts`, formatador Java, `prettier --check` na CI, nomes `-local` e fixtures `F4-`/`F5-`/`F6-` e `f7-final`.
- Correções de redação nas specs atuais (códigos internos em cenários, títulos de transição).
- Editar as changes arquivadas: os links quebrados ali são histórico.
- Decidir se `scripts/` (scripts de carga do dono) e `.claude/launch.json` entram no repositório.
- Renomear `docs/whatsapp/OPERACAO.md`.
