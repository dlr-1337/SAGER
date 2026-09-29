# Versões e ambiente da Fase 0

**Registro inicial:** 2026-09-25 · **Atualização do Docker:** 2026-09-26 · **Base:** [roteiro de implementação](../ROADMAP_IMPLEMENTACAO.md),
[PRD v2.0](../../SAGER_PRD_v2.0_Angular_SpringBoot.md) e
[especificação técnica v2.0](../../SAGER_Especificacao_Tecnica_v2.0.md).

As versões abaixo são a referência reproduzível para iniciar a Fase 1. A prova mínima
do backend já exercitou Spring Boot, PostgreSQL e Maven Wrapper; a fundação completa
da Fase 1 ainda está por implementar.

| Componente                         | Versão definida                      | Evidência e situação em 2026-09-25                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Angular                            | 22.2.0                               | `frontend/package-lock.json` e `frontend/node_modules/@angular/core/package.json`: 22.2.0. Manter o lockfile e instalar com `npm ci`.                                                                                                                                                                                       |
| Node.js                            | 24.19.0                              | `node --version`: `v24.19.0`.                                                                                                                                                                                                                                                                                               |
| Java do backend                    | Eclipse Temurin 21.0.12.1+1, JDK x64 | Instalado localmente em `%LOCALAPPDATA%\SAGER\toolchains\jdk-21.0.12.1+1`; `java -version` e `javac -version` desse diretório confirmam 21.0.12.1. O SHA-256 do ZIP foi conferido com o checksum publicado pela Adoptium. [Release oficial](https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.12.1%2B1). |
| Spring Boot                        | 4.1.1                                | Fixado em [`backend/pom.xml`](../../backend/pom.xml); aplicação e testes executados. [Anúncio oficial](https://spring.io/blog/2026/08/20/spring-boot-4-1-1-available-now/).                                                                                                                                                 |
| PostgreSQL                         | 17.11                                | Banco descartável iniciado por Testcontainers; Flyway aplicou V1/V2. Compose local fixado em `postgres:17.11`. [Política de versões oficial](https://www.postgresql.org/support/versioning/).                                                                                                                               |
| Maven pela distribuição do Wrapper | 3.9.16                               | Scripts e `.mvn/wrapper/` versionados; `mvnw.cmd --version` confirmou Maven 3.9.16 com JDK 21. Maven global não é exigido. [Download oficial](https://maven.apache.org/download.cgi).                                                                                                                                       |

## Seleção do Java para este projeto

O Java padrão do terminal permanece Temurin 17.0.20.1. O `JAVA_HOME` global permanece no JBR
do Android Studio; a instalação do Temurin 21 não mudou essas configurações. Para um terminal
PowerShell dedicado ao SAGER:

```powershell
$env:JAVA_HOME = Join-Path $env:LOCALAPPDATA 'SAGER\toolchains\jdk-21.0.12.1+1'
$env:PATH = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:PATH
java -version
javac -version
```

Essas variáveis valem apenas para o processo atual do terminal. No CI e em outra máquina,
instalar a mesma versão do JDK e apontar `JAVA_HOME` para o respectivo diretório. O ZIP local
foi conferido com o SHA-256
`f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e` do
[arquivo de checksum oficial](https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1.zip.sha256.txt).
O arquivo binário e qualquer cache de download ficam fora do Git.

## Ambientes da Fase 1

- `local`: login provisório por e-mail/senha própria, banco e dados sintéticos, bind
  do backend em `127.0.0.1` e segredos fora do Git. Não é ambiente de produção.
- `dev`: futuro ambiente de desenvolvimento com serviços externos em sandbox ou
  adaptadores explicitamente demonstrativos; o login local não deve ser exposto em rede.
- `test`: banco descartável, migrações Flyway e testes automatizados com dados sintéticos.
- `prod`: segredos injetados pela infraestrutura institucional, dados e documentos privados,
  integração real somente após as decisões e aprovações correspondentes.
- `frontend/package-lock.json` continua sendo a fonte das versões npm; `npm ci` é o comando
  reproduzível. O backend versiona `mvnw`, `mvnw.cmd`, `.mvn/wrapper/` e `pom.xml`.

O cliente Docker e o Compose estavam instalados (`29.8.0` e `5.5.1`
respectivamente). Em 25/09/2026, o Docker Desktop 4.91.0 iniciou e `docker info`
retornou `Server=29.8.0; OS=Docker Desktop; OSType=linux`. Uma falha ao acessar
`sailor-ingest.sock` reapareceu após reinício limpo. Com o Desktop e o WSL parados,
foram isolados **somente** `%LOCALAPPDATA%\Docker\run` e
`%LOCALAPPDATA%\docker-secrets-engine` em backups fora do Git. Nenhum volume,
contêiner ou imagem foi apagado ou redefinido.

Em 26/09/2026, o Desktop foi atualizado para **4.92.0.240144**.
`docker desktop restart --timeout 45` concluiu em aproximadamente 7 segundos e
`docker info` voltou a responder com Engine `29.8.0` e `OSType=linux`. Após todos
os testes, `docker ps` não mostrou contêineres ativos;
`docker desktop stop --timeout 45` concluiu em cerca de 13 segundos e
`docker desktop start --timeout 60` em cerca de 3 segundos, ambos com código 0.
`docker desktop status` retornou `running` e `docker info` confirmou Engine
`29.8.0`, `OSType=linux`. Essa partida fria, que antes reproduzia a falha,
passou após a atualização; isso não garante que toda
partida futura será estável. Conferir `docker info` em cada sessão de teste e
registrar eventual recorrência. Não foi usado reset de fábrica.

**Atualização da prova local:** Docker respondeu em execuções repetidas da suíte do
backend em 25/09/2026. Testcontainers iniciou e removeu PostgreSQL 17.11 sem usar
dados reais. Em 26/09/2026, a suíte final do login local aplicou Flyway V1–V3 e
passou com 11 testes no mesmo PostgreSQL 17.11. A porta local 5432 já estava ocupada por outro
processo; [`compose.yaml`](../../backend/compose.yaml) permite `SAGER_DB_PORT` alternativo.
