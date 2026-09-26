# QA da preparação do backend — Fase 0

**Executado inicialmente em:** 2026-09-25 · **Escopo:** documentação e ambiente da
branch `backend`. A seção inicial registra o estado anterior à prova mínima Spring
Boot; a atualização técnica está ao final. Nenhuma delas demonstra login real com
conta institucional ou integração externa em produção.

| Verificação                                                                                                                                    | Resultado                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coerência com [PRD v2.0](../../SAGER_PRD_v2.0_Angular_SpringBoot.md) e [especificação técnica v2.0](../../SAGER_Especificacao_Tecnica_v2.0.md) | Conferidos o bloqueio da saída longa sem assinatura/documento, as pendências D01/D02/D16/D21/D25, a separação entre escolha técnica e aprovação AE/TI e a referência anterior Meta direta/Clicksign. A preferência por Twilio permanece explicitamente condicionada.                  |
| D01–D26                                                                                                                                        | 26 IDs únicos, em sequência, presentes em [DECISOES.md](DECISOES.md); nenhuma aprovação institucional foi inventada.                                                                                                                                                                  |
| Markdown                                                                                                                                       | `npx prettier --check ../docs/ROADMAP_IMPLEMENTACAO.md "../docs/fase-0/*.md"` passou. `git diff --check` não apontou erro de espaços.                                                                                                                                                 |
| Links                                                                                                                                          | Todos os destinos locais foram resolvidos a partir de cada arquivo Markdown. Dos 18 links externos, 17 responderam `200` a `HEAD`; o site do ITI recusou `HEAD` com `403`, mas sua página abriu na consulta web. Nenhum link retornou `404` após corrigir duas referências quebradas. |
| Segredos e dados reais                                                                                                                         | Busca nos documentos por padrões de client ID Google, SID Twilio, chaves privadas, tokens comuns e CPF não encontrou valores. O JSON de `/api/v1/auth/me` usa `exemplo.invalid` e UUID sintético.                                                                                     |
| Java                                                                                                                                           | Temurin `21.0.12.1+1` e `javac 21.0.12.1` executados pelo diretório local do projeto; ZIP conferido pelo SHA-256 publicado pela Adoptium. `JAVA_HOME` global ainda aponta para o JBR do Android Studio e o `java` padrão continua 17.                                                 |
| Docker                                                                                                                                         | `docker info` retornou `Server=29.8.0; OSType=linux` e `docker ps` executou sem erro após recuperação. Uma nova partida falhou pelo mesmo socket e exigiu repetir o isolamento dos diretórios transitórios. Os backups ficaram fora do Git.                                           |
| Frontend                                                                                                                                       | `npm run build` passou; `npm test -- --watch=false` passou com 8 arquivos e 17 testes; `npm run test:e2e -- --grep-invert "captura telas centrais"` passou com 21 testes, incluindo jornadas e auditorias de acessibilidade.                                                          |

## Achados e limites

- Corrigidos dois links externos que retornavam `404`: ajuda antiga do Workspace
  (referência redundante removida) e URL de prévia dos termos do WhatsApp (substituída
  pelo endereço atual em português). A documentação da Twilio passou a distinguir o
  Sandbox do console legado do fluxo “Try out WhatsApp” do console atual.
- O teste Playwright de captura visual foi excluído do comando acima porque sobrescreve
  11 imagens PNG rastreadas em `.impeccable/reviews/`. Não houve alteração visual nesta
  branch. Os 21 testes funcionais e de acessibilidade restantes foram executados.
- O servidor Angular emitiu `NG0913` para a marca oficial do IF Goiano: a imagem de origem
  é muito maior que o tamanho exibido. O aviso já ocorre no frontend existente; esta fase
  não alterou a marca nem as telas.
- O Docker ficou operacional nas verificações após recuperação, mas a falha de socket
  reapareceu também após um ciclo normal de `docker desktop stop` e `start`. O ambiente
  precisa de investigação para um início estável antes dos testes com PostgreSQL na
  Fase 1; conferir `docker info` em cada sessão. Nenhum reset de dados foi feito.
- No momento desta primeira verificação ainda não existia `backend/`. A prova mínima
  foi acrescentada em seguida, com resultados abaixo. A prova Google OIDC real
  continua pendente de cliente OAuth/política Workspace autorizados pela TI.
  **A Fase 0 não está homologada.** Matrícula, conta WhatsApp e assinatura real
  permanecem abertas para as decisões indicadas no [registro](DECISOES.md).

## Atualização: prova técnica local do login

**Executado em:** 2026-09-25 · **Escopo:** `backend/`, somente valores sintéticos.

| Verificação       | Evidência                                                                     | Resultado                                                                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wrapper/JDK       | `mvnw.cmd --version` com `JAVA_HOME` local                                    | Maven 3.9.16 e Temurin 21.0.12.1                                                                                                                                                               |
| Testes Java       | `backend/mvnw.cmd -B -ntp verify`                                             | **16 testes passaram**, sem falhas ou omissões                                                                                                                                                 |
| Banco e migrações | Testcontainers/PostgreSQL 17.11 em banco vazio                                | Flyway V1/V2 aplicadas; identidade única por `iss` + `sub`; tabelas de sessão disponíveis                                                                                                      |
| Autorização       | Testes de política OIDC e API                                                 | `hd` não aprovado, lista vazia, e-mail não verificado, conta desativada/sem perfil negados; `/me` reconsulta o perfil local                                                                    |
| HTTP e sessão     | Tomcat em porta aleatória e MockMvc                                           | `/` 200, `/me` anônimo 401, CSRF 200, início OAuth 302, callback `localhost:8080` gerado corretamente, cookie protegido, callback com `state` desconhecido 403 e sessão removida do PostgreSQL |
| Empacotamento     | `backend/mvnw.cmd -B -ntp verify`                                             | JAR Spring Boot criado em `backend/target/`, ignorado pelo Git                                                                                                                                 |
| Compose           | `docker compose config --quiet` com porta local alternativa e senha sintética | Configuração válida; 5432 já estava em uso por outro processo, portanto `SAGER_DB_PORT` permite outra porta                                                                                    |

Os documentos alterados passaram no Prettier; 38 links locais foram resolvidos e a
busca por assinaturas de credenciais não encontrou valores nos novos arquivos.

Os testes OIDC usam token e principal sintéticos, além de uma URI de callback gerada
localmente. **Não houve login de servidor ou estudante pelo Google**, nem confirmação
de que a URI está cadastrada no cliente da TI. Também faltam prova de conta sem perfil
real, política de expiração/desligamento e aceite nominal da TI/AE. A lista de
[evidências ainda necessárias](AUTENTICACAO_GOOGLE.md)
permanece aberta. O aviso do Mockito sobre anexação dinâmica de agente não causou
falha; ele é questão de manutenção da suíte, sem impacto na prova executada.
