# Integração contínua

O workflow [CI](../.github/workflows/ci.yml) executa em pull requests para
`main`, pushes em `main` e execução manual pela aba Actions. Cada atualização
substitui uma execução anterior ainda em andamento da mesma referência.

## Verificações

| Job                  | Ambiente                                                        | Comandos e evidência                                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend · PostgreSQL | Ubuntu 24.04, Temurin 21.0.12.1+1, Maven Wrapper 3.9.16, Docker | `./mvnw -B -ntp verify`; PostgreSQL 17.11 descartável por Testcontainers; migrações, API, autorização, sessão, CSRF e concorrência.                                                                   |
| Frontend · Chromium  | Ubuntu 24.04, Node 24.19.0, npm 11.17.0                         | `npm ci`, `npm test -- --watch=false`, `npm run build`, `npx playwright install --with-deps chromium`, `npx playwright test --grep-invert 'captura telas centrais' --workers=1 --reporter=line,html`. |

O job **Infrastructure · HTTPS** também usa Ubuntu 24.04 e Docker Compose. Executa
sintaxe Bash, nove testes de recuperação, build das imagens do commit e smoke
descartável de produção: migração isolada, role de execução, HTTPS, cookies, CSRF,
cabeçalhos e ausência da demonstração. Seus segredos e CA são sintéticos e temporários.

As actions estão fixadas pelo SHA do commit. O checkout não mantém credenciais
no Git; o workflow tem somente `contents: read`. Não usa segredos da aplicação.
O cache depende dos arquivos de build/lock; as dependências do frontend são
instaladas pelo lockfile. Backend/frontend têm limite de 20 minutos;
infraestrutura tem limite de 25 minutos.

O identificador `21.0.12+101.0.LTS` do setup-java seleciona o release Temurin
21.0.12.1+1. O [ambiente local](fase-0/VERSOES_E_AMBIENTE.md) registra as
versões do projeto.

## Jornadas e relatórios

O CI seleciona todas as jornadas Chromium e exclui somente a captura global
“captura telas centrais”, que grava imagens rastreadas em `.impeccable/reviews/`.
O servidor Playwright desliga HMR e recarga automática. As jornadas usam um
único worker, sem retentativas automáticas; falha não se torna sucesso pela
repetição do teste.

Quando há armazenamento disponível, cada execução guarda por sete dias os
resultados XML/TXT do backend e o relatório HTML do Playwright, com screenshots
e traces das falhas. A consulta depende do acesso ao repositório privado.
Os testes e artefatos usam somente registros sintéticos.

A publicação de relatórios é uma etapa auxiliar: sua falha deixa um aviso e um
resumo explícito, mantendo o resultado dos testes como condição para o job
passar. Em 29/09/2026, o GitHub recusou uploads por cota de armazenamento da
conta; o repositório SAGER não tinha artefatos armazenados. Enquanto a cota
estiver indisponível, consulte os logs das etapas. O workflow retomará os
uploads nas próximas execuções que tiverem armazenamento disponível.

As jornadas com API interceptada verificam a interface. Os testes do backend
verificam PostgreSQL real; a prova integrada de navegador com backend e banco
está registrada separadamente no [QA](fase-2/QA.md). O CI não substitui a
homologação de regras, identidade ou integrações institucionais.

## Executar e consultar

Na aba Actions, abra **CI** e use **Run workflow** quando necessário. Em um
pull request, os três jobs aparecem nas verificações. Para executar localmente,
use os comandos da tabela; o backend exige JDK 21 e Docker, e o navegador
exige Chromium instalado pelo Playwright.

O [QA](fase-2/QA.md) registra URLs, commits e resultados efetivamente executados.
A presença do workflow não torna a aprovação dos jobs obrigatória para mesclar:
essa exigência depende das regras de proteção da branch no GitHub.

Em 29/09/2026, a tentativa de exigir os dois jobs na proteção de `main` recebeu
`403`: o GitHub solicitou upgrade de plano ou tornar o repositório público.
O repositório continua privado e `main` não ficou protegida. O pipeline executa
e informa os resultados; conferir manualmente ambos os jobs aprovados no
commit final do PR é o critério para mesclar as entregas anteriores. F7 acrescenta
infraestrutura e exige os três jobs aprovados no commit final. Não há bloqueio
obrigatório de mesclagem pelo GitHub enquanto essa restrição existir.
