# Versões e ambiente da Fase 0

**Registro:** 2026-09-25 · **Base:** [roteiro de implementação](../ROADMAP_IMPLEMENTACAO.md),
[PRD v2.0](../../SAGER_PRD_v2.0_Angular_SpringBoot.md) e
[especificação técnica v2.0](../../SAGER_Especificacao_Tecnica_v2.0.md).

As versões abaixo são a referência reproduzível para iniciar a Fase 1. A instalação local
verificada é diferente da escolha de versão para serviços que ainda serão criados.

| Componente                         | Versão definida                      | Evidência e situação em 2026-09-25                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Angular                            | 22.2.0                               | `frontend/package-lock.json` e `frontend/node_modules/@angular/core/package.json`: 22.2.0. Manter o lockfile e instalar com `npm ci`.                                                                                                                                                                                       |
| Node.js                            | 24.19.0                              | `node --version`: `v24.19.0`.                                                                                                                                                                                                                                                                                               |
| Java do backend                    | Eclipse Temurin 21.0.12.1+1, JDK x64 | Instalado localmente em `%LOCALAPPDATA%\SAGER\toolchains\jdk-21.0.12.1+1`; `java -version` e `javac -version` desse diretório confirmam 21.0.12.1. O SHA-256 do ZIP foi conferido com o checksum publicado pela Adoptium. [Release oficial](https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.12.1%2B1). |
| Spring Boot                        | 4.1.1                                | Versão escolhida para o `pom.xml` da Fase 1; backend ainda não existe. [Anúncio oficial](https://spring.io/blog/2026/08/20/spring-boot-4-1-1-available-now/).                                                                                                                                                               |
| PostgreSQL                         | 17.11                                | Versão escolhida para o banco de desenvolvimento, teste e implantação; instância do projeto ainda não criada. [Política de versões oficial](https://www.postgresql.org/support/versioning/).                                                                                                                                |
| Maven pela distribuição do Wrapper | 3.9.16                               | Na Fase 1, gerar e versionar os arquivos do Maven Wrapper com `distributionUrl` fixada em Maven 3.9.16. A versão dos scripts do Wrapper é distinta da distribuição Maven que eles executam. Maven global não é exigido para operar o projeto. [Download oficial](https://maven.apache.org/download.cgi).                    |

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

- `dev`: dados sintéticos, segredos locais fora do Git e serviços externos em sandbox ou
  adaptadores explicitamente demonstrativos.
- `test`: banco descartável, migrações Flyway e testes automatizados com dados sintéticos.
- `prod`: segredos injetados pela infraestrutura institucional, dados e documentos privados,
  integração real somente após as decisões e aprovações correspondentes.
- `frontend/package-lock.json` continua sendo a fonte das versões npm; `npm ci` é o comando
  reproduzível. O futuro backend deve versionar `mvnw`, `mvnw.cmd`, `.mvn/wrapper/` e `pom.xml`.

O cliente Docker e o Compose estão instalados (`29.8.0` e `5.5.1` respectivamente).
O Docker Desktop 4.91.0 iniciou e `docker info` retornou
`Server=29.8.0; OS=Docker Desktop; OSType=linux`, comprovando o daemon operacional
em 2026-09-25. A inicialização inicial falhou ao acessar sockets locais antigos; após
parar o Desktop e o WSL, as pastas **somente de sockets transitórios** foram preservadas
com sufixo `.recovery-*` fora do repositório e o Desktop iniciou normalmente. Nenhum
volume, contêiner ou imagem foi apagado ou redefinido. Essa recuperação é uma observação
local, não parte da instalação reproduzível do SAGER; se o erro voltar, consultar os logs
do Docker Desktop antes de alterar o ambiente.
