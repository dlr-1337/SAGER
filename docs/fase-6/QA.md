# Verificação de F6 — limpeza, ranking e relatórios

**Data:** 30/09/2026. Dados exclusivamente sintéticos. Regras locais do
[contrato](CONTRATO.md), sem homologação institucional.

## Gates automatizados

Execução completa coordenada na integração de F4–F6:

| Comando                                                                 | Resultado                                                                     |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `backend/.\mvnw.cmd -B -ntp verify`, JDK 21 e PostgreSQL Testcontainers | 245 testes; zero falhas, erros ou testes ignorados; JAR produzido às 18:35:52 |
| `frontend/npm test -- --watch=false`                                    | 189 testes em 35 arquivos passaram                                            |
| `frontend/npm run build`                                                | Compilação de produção passou, incluindo rotas carregadas sob demanda         |
| `frontend/npm run test:e2e`                                             | 97 testes passaram em 4,8 minutos                                             |

O último ajuste posterior a esses gates alterou somente a espera de abertura e
fechamento por Escape em um teste F5; seus três casos focados passaram. Não houve
mudança de produto após a compilação usada abaixo.

`CleaningReportsIntegrationTest` contém 14 testes PostgreSQL/HTTP específicos de
F6. Eles verificam cálculo e concorrência por quarto/data, alocações históricas,
UUID e permissões, revisão e rollback conjunto com a evidência F5, empates e
privacidade, filtros e fontes reais, congelamento e exportação integral,
idempotência concorrente, strings literais na planilha, recuperação de lease,
revogação, integridade de arquivos e expiração apenas dos documentos transitórios.
`ApiFoundationIntegrationTest` também verifica o contrato OpenAPI de F6.

## Prova com aplicação real

Foi executado o JAR acima com perfil `local`, PostgreSQL 17.11 descartável e o
frontend final de produção, sem interceptar respostas da API. As contas próprias
de supervisor, gestor e dois residentes foram provisionadas pela CLI, com entrada
oculta da senha e vínculos explícitos por UUID. A fixture de gestão foi criada
pelas APIs. Não foram usados serviços externos nem registros reais.

O ambiente isolado usou PostgreSQL `127.0.0.1:5550`, API `8086` e proxy `4348`.
O navegador usou `Pacific/Auckland`; as datas civis e os cálculos continuaram a
usar o relógio e o fuso de São Paulo do servidor.

| Cenário real                       | Evidência observada                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Avaliação histórica pela interface | Após uma transferência real e a entrada de outro morador no quarto, `RETROACTIVE` capturou o residente e o UUID da alocação existentes no instante avaliado. Os quatro critérios `7,9; 8; 8; 8` resultaram em `7,98`, com nota anterior e variação inicialmente nulas.                                                                                                                                        |
| Correção pela interface            | Motivo obrigatório, versão incrementada e duas revisões persistidas. Quarto, instante e participantes originais permaneceram iguais. Uma correção API com versão antiga retornou `409` sem sobrescrever o resultado.                                                                                                                                                                                          |
| Ranking e acesso próprio           | Notas `8; 8; 0` produziram posições `1; 1; 3`; quarto sem avaliação manteve nota e posição nulas. O residente viu notas somente dos quartos em cujas avaliações participou; os demais expuseram apenas código e posição, sem UUID, nota ou quantidade. O novo morador do quarto recebeu `404` ao tentar consultar a avaliação histórica do anterior.                                                          |
| Evidência de limpeza               | Avaliação atual com nota `5` gerou uma ocorrência e uma notificação por participante. Corrigir para `8` preservou a ocorrência e suas duas revisões, invalidou a evidência atual e exigiu revisão humana. Nenhuma advertência foi criada automaticamente.                                                                                                                                                     |
| Relatório congelado                | Filtros combinados de data, alojamento, quarto e residente histórico retornaram a linha correta. A consulta de limpeza congelou 24 linhas: a interface mostrou 20 e carregou as 24. Após novo cadastro/avaliação, nova consulta encontrou 25; a anterior preservou exatamente suas 24 linhas e hash. Gestor tentando acessar a consulta do supervisor recebeu `404`; residente recebeu `403` para relatórios. |
| Exportações e reinício             | Os botões reais solicitaram PDF e XLSX da mesma consulta. Com worker temporariamente desativado, os dois jobs persistiram `PENDING`, tentativa `0`. Após encerrar o Java e iniciar o mesmo JAR, no mesmo banco, com worker ativo, os mesmos UUIDs ficaram `READY`, tentativa `1`. Sessões, vínculo próprio, conteúdo e revisões das avaliações, auditoria e linhas congeladas sobreviveram ao reinício.       |
| Downloads privados                 | API e interface baixaram os mesmos binários, com tamanho/hash iguais aos metadados. O PDF contém as 24 linhas em duas páginas e fontes embutidas. O XLSX contém as 24 linhas e dez colunas, metadados da mesma consulta e zero células de fórmula; nomes iniciados por `=`, `+`, `-` e `@` permaneceram texto.                                                                                                |

A posição global de uma avaliação pode mudar quando entra nova nota no período.
Na retomada foram comparados os campos imutáveis, revisões e cálculos da avaliação;
a posição foi conferida como projeção atual do ranking.

### Identificadores e integridade

- Consulta: `f8f36f7a-6b86-4255-8b29-a9912673d305`.
- Hash do conteúdo congelado: `9c63615be4c90d6b94edf284419b8166fe3294c3a4a23fb4f6066f29b3bf4709`.
- Job PDF retomado: `f44e6314-a1c6-48d5-8073-609ea29fb274`.
- Job XLSX retomado: `9a550503-090b-41aa-a6f4-bb398b980811`.
- JAR, antes/depois: `168d995b2aa24e63e879316866cd8e2f0a35c8c29fa2d7286400b881a34ff278`.
- PDF, 20.946 bytes: `93a30bdfa7a7ec597d025ad93302c9b47c026c72e9f41d1894d3cd59bf3478a7`.
- XLSX, 6.124 bytes: `6a775fc0b5ac3602c5c2e7ccea22fb6abc8ddd63ad27ae1ff0e9e6e405c4755e`.

Os UUIDs do PDF foram conferidos no texto extraído com normalização Unicode NFKC,
que expande as ligaturas tipográficas da fonte. Isso não altera o arquivo baixado
nem seu hash. `pypdf` verificou conteúdo/fontes e `openpyxl` verificou os valores,
tipos de célula, cabeçalhos e metadados da planilha.

## Interface e acessibilidade

Na primeira rodada, capturas antes e após o reinício. Em cada estado, a análise
axe da região `main` encontrou zero violações e a página não apresentou overflow
horizontal. Desktop: 1440 px; celular: 320 px.

| Captura                                                                           | Estado                                                           |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [Avaliação desktop](../../.impeccable/reviews/pr-limpeza-avaliacao-desktop.png)   | Avaliação histórica corrigida, participante capturado e revisões |
| [Ranking desktop](../../.impeccable/reviews/pr-limpeza-ranking-desktop.png)       | Empates, nota zero e ausência de avaliação                       |
| [Ranking celular](../../.impeccable/reviews/pr-limpeza-ranking-mobile.png)        | Projeção privada do residente                                    |
| [Relatório desktop](../../.impeccable/reviews/pr-relatorios-consulta-desktop.png) | Consulta congelada com primeira página de 20/24 linhas           |
| [Relatório celular](../../.impeccable/reviews/pr-relatorios-consulta-mobile.png)  | Consulta retomada e downloads PDF/XLSX disponíveis               |

A segunda rodada revisou somente o ranking a 320 px e substituiu sua captura
celular após ampliar a coluna de posição de 60 para 72 px e preservar as palavras
do rótulo. Essa captura usa resposta HTTP simulada com os mesmos códigos,
posições e valores visíveis da primeira rodada; a prova PostgreSQL foi encerrada
antes dessa correção de CSS. As duas jornadas existentes de ranking passaram
(36,4 s), com participação histórica, projeção privada, empates, nulos e erro
sem dados de demonstração. A conferência específica encontrou uma única caixa de
texto para a palavra “posição”, largura da página de 320/320 px, zero violações
axe em `main` e zero escritas na API. O detector Impeccable executado uma vez no
CSS alterado retornou `[]`.

## Evidências privadas e encerramento

Scripts, logs e arquivos de conferência permanecem no diretório privado
`.git/qa-auditoria/` da cópia principal: `f6-real-proof.log`,
`f6-real-restart.log`, `f6-proof-state.json`, `f6-runtime-before.json`,
`f6-runtime-after.json`, `f6-pending-before-restart.txt`, `f6-files-parsed.json`
e `f6-cleanup.json`. Credenciais de fixture e cookies não foram versionados.

O Java original foi PID `50400` e o reiniciado `28908`; o proxy foi PID `4676`.
Após conferir as linhas de comando e a identidade do container, foram encerrados
somente o Java/proxy próprios e `sager-f6-proof` (`postgres:17.11`, `--rm`). A
conferência final encontrou zero processos/listeners próprios nas três portas e
nenhum container remanescente. Nenhuma fonte de produto foi alterada nesta prova.

## Limites da evidência

A retomada real comprovou jobs persistidos em `PENDING`; a recuperação de
`PROCESSING` com lease vencido foi comprovada no teste de integração, sem simular
uma interrupção durante a renderização nesta execução. Expiração de 24 horas,
recusa de excesso de 10.000 linhas, revogação e integridade adversa também têm
evidência automatizada PostgreSQL/HTTP. A prova visual não substitui avaliação
manual completa de acessibilidade nem homologação institucional das regras locais.
