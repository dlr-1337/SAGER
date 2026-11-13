# Design

## Context

Motivação em proposal.md (Why). Estado medido em 13/11/2026:

- `docs/` tem 36 arquivos (556 KB). Só três descrevem o sistema atual: `docs/DOCKER.md`, `docs/CI.md` e `docs/whatsapp/OPERACAO.md`. O resto é histórico das fases. O PRD e a Especificação Técnica somam 208 KB na raiz e ainda citam Google, Clicksign e a demonstração.
- O CI (`.github/workflows/ci.yml`) não lê nenhum arquivo de `docs/`. Só documentos apontam para os que vão sair: `README.md`, `AGENTS.md` (:17, :33, :39), `backend/README.md` (cerca de 20 links), `frontend/README.md`, `infra/production/README.md:135`, `infra/coolify/README.md:171`, `docs/whatsapp/OPERACAO.md:3` e `:119`, `PRODUCT.md:53-54` e o `openspec/config.yaml:11-12`. Nenhuma spec em `openspec/specs` aponta para `docs/`.
- As regras de domínio da chamada, das saídas, da disciplina, da limpeza e dos relatórios existem por extenso só em `docs/fase-3/README.md` e em `docs/fase-4/`, `fase-5/` e `fase-6/CONTRATO.md`. O AGENTS.md traz o resumo delas. As specs de base vêm depois, no change `document-core-baseline` (onda 4).
- `origin/main` está em `7d22855`, que ainda contém todos esses documentos.
- `.impeccable/` versiona 68 arquivos (14 MB). Os 57 PNG de `reviews/` são citados só pelos QAs de fase ou regenerados por `frontend/e2e/visual-review.spec.ts`. As skills do OpenSpec em `.agents/skills/` (13 arquivos, contando o marcador `.openspec-target`) e em `.claude/skills/openspec-*` (12 arquivos) não estão versionadas.
- `scripts/` não está vazio, ao contrário do que diz o mapa: tem os scripts de carga do dono (`popular_*.py`, `estrutura_if.json` e `povoar-producao.ps1`, este com caminhos pessoais). Não entra no `.gitignore` nem no índice sem decisão do dono.

## Goals / Non-Goals

**Goals:**

- Ficar com poucos documentos atuais: README, `docs/ARQUITETURA.md`, `docs/OPERACAO.md`, `docs/whatsapp/OPERACAO.md`, os READMEs de módulo e infra, PRODUCT.md, DESIGN.md e AGENTS.md.
- Nenhum link relativo morto nos markdown fora de `openspec/changes/`.
- Toda mudança futura passar pelo OpenSpec, com a CI conferindo as specs.

**Non-Goals:**

- Reescrever regras de domínio como specs. Isso fica para `document-core-baseline`.
- Mudar texto de tela, código, API, banco ou testes.

## Decisions

### 1. Remover o histórico agora e preservar as regras pelo git

Os documentos de fase saem já na onda 1, como manda DECISOES.md. Antes, o que ainda vale vai para os documentos novos (tabela abaixo). As regras de domínio por extenso continuam no AGENTS.md (resumo canônico) e no git. `docs/ARQUITETURA.md` registra que `document-core-baseline` lê os contratos com `git show 7d22855:docs/fase-3/README.md`, e o mesmo vale para `fase-4/`, `fase-5/` e `fase-6/CONTRATO.md`.

Alternativa rejeitada: manter `docs/fase-*` até a baseline ser arquivada, como sugeria o mapa. Isso manteria os links mortos no AGENTS.md até a onda 4 e contrariaria DECISOES.md. Também rejeitada: mover tudo para `docs/historico/`, o que manteria 430 KB que parecem referência e que ainda falam em e-mail no login, Google e Clicksign.

### 2. Para onde vai cada conteúdo

| Origem | Destino |
| --- | --- |
| `docs/fase-1/FUNDACAO.md` (contrato comum: `X-Request-Id`, erro `{code, message, requestId}`, datas ISO, versão otimista, OpenAPI só no perfil local; auditoria transacional; vínculo entre conta e cadastro) | `docs/ARQUITETURA.md`, seções "Contrato da API" e "Segurança" |
| `docs/fase-7/README.md` (sessão JDBC de 30 min, roles `sager_owner` e `sager_runtime`, recusa de perfis combinados, contadores HMAC de 15 min, backup age com pausa de gravação, relatórios que expiram em 24 h) | ARQUITETURA, "Segurança" e decisões. Os limites de CPU e memória do Compose vão para `docs/OPERACAO.md` |
| Tabela de autenticação, erros e OpenAPI de `backend/README.md` | ARQUITETURA, "Segurança" e "Contrato da API" |
| `docs/fase-0/AUTENTICACAO_LOCAL.md`, `AUTENTICACAO_GOOGLE.md` e a D21 | Decisão "Login próprio por matrícula" |
| `docs/fase-0/INTEGRACOES.md` e `docs/whatsapp/PESQUISA.md` | Decisão "WhatsApp auto-hospedado, desligado por padrão" |
| D01 a D26 de `docs/fase-0/DECISOES.md` (com o "Complemento de escolhas delegadas"), `docs/fase-2/PACOTE_AE_TI.md`, a seção "O que segue sem confirmação" de `docs/fase-0/CADASTRO_IFGOIANO.md`, o último parágrafo de "Decisões técnicas delegadas" de `fase-7/README.md` e a tabela "Operação e evidências pendentes" de `fase-7/COOLIFY.md` | ARQUITETURA, "Pendências institucionais": uma linha por item, com a regra local adotada e o que a AE/TI decide. A lista do WhatsApp continua em `docs/whatsapp/OPERACAO.md` e só recebe um link |
| `docs/fase-7/MANUAL.md` | `README.md`, seção "Uso por perfil", corrigida para login por matrícula e sem o perfil de saúde |
| `docs/fase-7/COOLIFY.md`: inspeção do stack com `docker compose ... ps` e backup com nome datado | `infra/coolify/README.md`. Saem os hashes, os tempos e os IDs de implantação |
| `docs/DOCKER.md`, sem "Reaproveitar o ambiente anterior" nem o parágrafo da V20 | `docs/OPERACAO.md`, "Ambiente local com Docker". `account list` e `assign-enrollment` ficam como comandos administrativos |
| `docs/CI.md`, sem a cota de 29/09 nem a história do 403 | `docs/OPERACAO.md`, "Integração contínua". Fica a regra atual: `main` não exige os jobs, e o critério de mesclagem é ver os três jobs verdes no commit final. As versões fixadas (Node 24.19.0, npm 11.17.0, Temurin 21.0.12.1+1, PostgreSQL 17.11 no Testcontainers) substituem o link para `fase-0/VERSOES_E_AMBIENTE.md` |
| Contratos `fase-3`, `fase-4`, `fase-5`, `fase-6` | Não são copiados. Ficam o resumo no AGENTS.md e o git em `7d22855` |
| `fase-2/SAUDE_CONTRATO.md`, QAs, ROADMAP, `HOMOLOGACAO.md`, `fase-2/README.md` e READMEs de fase | Descartados. O git guarda tudo |

Alternativa rejeitada: um manual próprio por perfil, corrigido. A monografia já tem o manual, e uma seção curta no README basta para quem roda o sistema.

### 3. Decisões em formato ADR dentro de ARQUITETURA.md

Cada decisão ocupa uma subseção com contexto, decisão, alternativa rejeitada e consequência. Lista mínima: login próprio por matrícula (rejeitada: Google OIDC ou SUAP agora); sessão no servidor com CSRF (rejeitada: token no navegador); autorização sempre no servidor, com a interface só escondendo o que não cabe ao perfil (rejeitada: confiar nas guardas de rota); auditoria na mesma transação, sem valores pessoais e com retenção permanente (rejeitada: log assíncrono); Flyway com papéis de migração e de execução separados, sem editar migração aplicada (rejeitada: um papel só ou schema gerado pela aplicação); backup criptografado com pausa de gravação (rejeitada: cópia do volume com a aplicação gravando); WhatsApp auto-hospedado e desligado por padrão, com "autorização conferida" e nunca assinatura (rejeitadas: Cloud API oficial agora, pela contratação, e provedor externo de assinatura); sem modo demonstração (rejeitada: dados em memória paralelos à API); sem módulo de saúde (rejeitada: mantê-lo oculto); comportamento em `openspec/specs` (rejeitada: contratos por fase em `docs/`).

Alternativa rejeitada: um arquivo por ADR em `docs/adr/`. Seriam mais dez arquivos, contra o objetivo de ter poucos documentos.

### 4. PRD e Especificação Técnica saem, sem pasta de referência

Alternativa rejeitada: `docs/referencia/`. A monografia é a referência do produto, e os dois arquivos descrevem integrações abandonadas.

### 5. Fluxo OpenSpec no AGENTS.md e na configuração

O AGENTS.md ganha `## OpenSpec workflow`. Toda mudança de comportamento nasce em `openspec/changes/<nome>` (proposal, specs, design e tasks), segue as tasks na implementação, passa em `openspec validate <nome> --strict` e termina em `openspec archive`, que atualiza `openspec/specs`. Mudança só de documentação ou de ferramenta declara `skip_specs: true`. Não se editam changes arquivadas. `openspec/config.yaml` passa a dizer que AGENTS.md e `openspec/specs` são canônicos, e a regra da proposta passa a pedir a citação do requisito de spec ou da regra do AGENTS.md.

Alternativa rejeitada: descrever o fluxo só em ARQUITETURA.md. Quem implementa lê o AGENTS.md primeiro. ARQUITETURA só aponta para a seção.

### 6. Validação do OpenSpec no job do frontend

Um passo `npx @fission-ai/openspec@2.0.0 validate --all --strict`, com `working-directory: .`, logo depois de "Set up npm 11". O job já tem Node 24, e o passo falha antes da instalação demorada.

Alternativas rejeitadas: um job separado, que repetiria checkout e setup do Node em outro runner, e pôr o OpenSpec nas devDependencies do frontend, o que prenderia o lockfile da interface a uma ferramenta do repositório.

### 7. Capturas do `.impeccable/reviews/` fora do git

Saem do índice todas as capturas de `reviews/`, além de `mocks/inicio-a.png`, `mocks/inicio-c.png`, `REVIEW.md`, `inicio-brief-body.md` e `surfaces/`, e `/.impeccable/reviews/` entra no `.gitignore`. Ficam `config.json`, `build/spec.json` e `mocks/inicio-b.png` (com `inicio-b.png.json`), `saida-detalhe.png` e `avisos-mobile.png`, citados por DESIGN.md e `spec.json`. O DESIGN.md continua explicando como gerar as capturas.

Alternativa rejeitada: manter versionadas as 11 capturas que o e2e regenera. Cada execução completa do e2e deixaria PNGs modificados no `git status`.

### 8. Skills do OpenSpec versionadas

Entram no índice `.agents/skills/` (as 12 pastas `openspec-*` e o marcador `.openspec-target`) e `.claude/skills/openspec-*`, para que o fluxo funcione num clone novo.

Alternativa rejeitada: ignorar as pastas e regenerá-las com `openspec update`. Cada máquina poderia ficar com uma versão diferente das instruções.

### 9. Um dono para cada texto entre as mudanças paralelas

Este change é o dono do texto de README.md, AGENTS.md, PRODUCT.md, DESIGN.md, dos READMEs e de `docs/`, e já escreve o estado final: sem demonstração, sem saúde e com saídas só para o residente menor. `remove-demo-mode` e `remove-health-module` mudam o código e só mexem nesses arquivos para tirar alguma sobra. A frase sobre saídas no AGENTS.md diz o que o servidor já faz (`OperationResidents.java:44-46` recusa `not_minor` e `birth_date_required`): "Operations are supervisor-only except the minor resident's own linked exit requests; the server refuses exit requests from residents who are 18 or older in America/Sao_Paulo or have no birth date." A parte da interface fica com `hide-exits-for-adults`.

Alternativa rejeitada: cada change editar as próprias linhas do AGENTS.md e do README. Seriam três edições paralelas nos mesmos parágrafos, com conflito certo.

### 10. Sem spec delta

O change declara `skip_specs: true`, porque nenhum comportamento observável muda.

Alternativa rejeitada: criar uma capacidade "documentation". Isso inventaria requisitos sobre arquivos, não sobre o sistema.

### 11. Verificação sem dependência nova

Os links mortos são conferidos com `git grep`. Os links relativos dos markdown são conferidos com um comando Python de uma linha, rodado na raiz pelo Git Bash:

```bash
python -c "import re,pathlib,subprocess as s;b=[f'{f}: {l}' for f in s.check_output(['git','ls-files','-co','--exclude-standard','*.md'],text=True).splitlines() if not f.startswith('openspec/changes/') for l in re.findall(r'\]\(([^)\s]+)\)',pathlib.Path(f).read_text('utf-8')) if (t:=l.split('#')[0]) and not re.match('[a-z]+:',t) and not (pathlib.Path(f).parent/t).exists()];print(*b or ['ok'],sep='\n');exit(bool(b))"
```

O comando imprime `ok` e sai com 0, ou lista `arquivo: link` e sai com 1. Já foi testado nos dois casos. A busca de links mortos usa os nomes exatos, porque `QA-20` também casa com a matrícula sintética `SAGER-QA-2026-001` dos testes:

```bash
git grep -n -E 'docs/fase|fase-[0-7]/|ROADMAP|QA-2026-10-16|QA-RELEASE|PESQUISA|SAGER_PRD|Especificacao|docs/DOCKER|docs/CI\.md' -- . ':!openspec/changes'
```

A busca exclui `openspec/changes/` inteira: as changes arquivadas são histórico, e as ativas (esta e as paralelas) citam os arquivos que removem.

Alternativa rejeitada: `markdown-link-check` na CI. Seria uma dependência nova, e os links externos falham de forma intermitente.

## Risks / Trade-offs

- [As regras de fase não viram spec antes da onda 4] → AGENTS.md mantém o resumo, ARQUITETURA registra a revisão `7d22855` para `git show`, e a tabela de pendências guarda os parâmetros locais (chamada de 22:00 a 23:30, saída curta de até 3 h, limpeza abaixo de 6,00, duas advertências em 90 dias).
- [O AGENTS.md descreve o sistema sem demonstração e sem saúde antes de `remove-health-module` (onda 2) chegar ao código] → É o estado final já decidido em DECISOES.md, e as ondas 1 e 2 são implementadas no mesmo branch (`feat/simplifica-sistema`) antes de chegar a `main`. Se `remove-health-module` for cancelado, as frases de saúde voltam ao AGENTS.md a partir de `git show 7d22855:AGENTS.md`.
- [Conflito de texto com changes paralelas] → Decisão 9. Quem implementar `remove-demo-mode` confere README, DESIGN.md e PRODUCT.md antes de editar.
- [`openspec validate --all --strict` na CI reprova um PR com change ativa incompleta] → É o objetivo. As changes da onda precisam passar em `--strict` antes de abrir o PR.
- [Versionar `.claude/` e `.agents/` põe pastas com nome de ferramenta no repositório, e a regra do dono proíbe atribuição a IA] → As pastas são configuração do OpenSpec, não atribuição. Commits e textos continuam sem menção. DECISOES.md já decidiu versionar.
- [Um `git add -A` publicaria a monografia (55 MB), `.claude/noite/` ou `scripts/`] → O grupo 1 ignora os dois primeiros antes de qualquer outra coisa. As tasks usam `git add` e `git rm` com caminhos explícitos, nunca `-A`. `scripts/` e `.claude/launch.json` ficam como decisão do dono.
- [O runbook do Coolify perde comandos de recuperação] → Os comandos do `COOLIFY.md` que faltam são copiados antes da remoção (task 2.3).

## Migration Plan

1. Grupos 1 a 4 de tasks.md criam e atualizam os documentos enquanto os antigos ainda existem, então os links resolvem a cada passo.
2. O grupo 5 remove o histórico, e a busca de links mortos tem de voltar vazia.
3. Rollback: `git restore --staged --worktree` nos caminhos do change antes do commit, ou `git revert` do commit depois. O git guarda tudo o que foi apagado.

## Pendências

A confirmar com a AE/TI (vão para "Pendências institucionais" em ARQUITETURA.md, sem que este change decida nenhuma):

- D01 a D26, sem aprovação institucional registrada, incluindo as regras locais delegadas (D03 a D09, D12 a D14 e D18), a escala e os pesos da limpeza (D10), a métrica de comportamento (D11), o nível da autorização do responsável (D16 e D17), as exportações por perfil (D20), a retenção, o descarte e a recuperação (D22), os relatórios offline (D23), a carga na VPS (D24), as licenças (D25) e os diagramas (D26).
- Os sete itens de "O que segue sem confirmação" do cadastro: formato atual da matrícula do técnico integrado, vigência da Norma 04, regulamento disciplinar de 2026, SIAPE como usuário, faixa de idade de 10 a 100 anos, limite de 20 vagas por quarto e nome social.
- A retenção dos demais dados, a custódia da recuperação, a frequência e a cópia externa dos backups, as responsabilidades de operação, o piloto na VPS e o aceite AE/TI.
- Os onze itens do WhatsApp, que continuam em `docs/whatsapp/OPERACAO.md`.
- Se o residente maior de idade fica de fora de todo controle de saída, como o AGENTS.md vai dizer (regra que o servidor já aplica). A confirmar com a AE.

Do dono ou do operador:

- Versionar ou ignorar `scripts/` (scripts de carga com caminhos pessoais) e `.claude/launch.json`.
- Exigir os jobs da CI na proteção de `main`. Hoje o GitHub recusa no plano do repositório privado, e a conferência é manual.
- Conferir se os slides da defesa citam algum documento removido.
