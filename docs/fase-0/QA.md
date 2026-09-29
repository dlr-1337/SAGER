# QA da preparação do backend — Fase 0

**Revisão de 26/09/2026:** a prova Google OIDC abaixo é evidência **histórica**.
O [login local provisório](AUTENTICACAO_LOCAL.md) a substitui para desenvolvimento
e teste. Os resultados do novo login foram registrados após a execução;
o aceite técnico local não homologa D21 nem a Fase 0.

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
- Em 25/09/2026, o Docker ficou operacional após recuperação, mas a falha de
  `sailor-ingest.sock` reapareceu após reinício limpo no Desktop 4.91.0. O
  acompanhamento após a atualização está registrado abaixo. Nenhum reset de dados
  foi feito.
- No momento desta primeira verificação ainda não existia `backend/`. A prova mínima
  foi acrescentada em seguida, com resultados abaixo. Na proposta da época, uma
  prova Google OIDC real exigiria cliente OAuth e política Workspace autorizados
  pela TI; o provedor institucional hoje continua indefinido.
  **A Fase 0 não está homologada.** Matrícula, conta WhatsApp e assinatura real
  permanecem abertas para as decisões indicadas no [registro](DECISOES.md).

## Histórico: prova técnica Google OIDC descontinuada

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
real, política de expiração/desligamento e aceite nominal da TI/AE. O
[roteiro de evidências da proposta Google](AUTENTICACAO_GOOGLE.md) é histórico;
o fechamento de D21 dependerá do provedor que a TI definir. O aviso do Mockito
sobre anexação dinâmica de agente não causou
falha; ele é questão de manutenção da suíte, sem impacto na prova executada.

## Revisão: login local provisório

**Estado em 26/09/2026:** implementação e prova técnica local concluídas. Após reproduzir
a falha de `sailor-ingest.sock` no Desktop 4.91.0, foram preservados em backups
fora do Git apenas `%LOCALAPPDATA%\Docker\run` e
`%LOCALAPPDATA%\docker-secrets-engine`. O Desktop foi atualizado para
**4.92.0.240144**. `docker desktop restart --timeout 45` concluiu em cerca de 7
segundos e `docker info` retornou Engine `29.8.0`, `OSType=linux`. Após todos os
testes, `docker ps` não mostrou contêineres ativos;
`docker desktop stop --timeout 45` passou em cerca de 13 segundos e
`docker desktop start --timeout 60` em cerca de 3 segundos, ambos com código 0.
`docker desktop status` retornou `running` e `docker info` confirmou Engine
`29.8.0`, `OSType=linux`. Essa partida fria passou no cenário que antes falhava.
Esses resultados não garantem estabilidade permanente; repetir `docker info` em cada
sessão. Nenhum volume, contêiner ou imagem foi apagado ou redefinido.

A tabela abaixo distingue testes automatizados da prova manual integrada.

| Verificação         | Comando ou cenário                                                                                | Resultado                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend e migrações | `.\mvnw.cmd -B -ntp clean verify` em `backend/`, com Temurin 21 e Testcontainers/PostgreSQL 17.11 | **11 testes, 0 falhas, BUILD SUCCESS**; Flyway V1–V3, hash e restrições verificados.                                                                                                                              |
| CLI local           | Criar, redefinir senha e desativar conta sintética com console oculto                             | Criação com senha oculta e desativação verificadas manualmente; redefinição e despacho cobertos por testes automatizados.                                                                                         |
| Segurança HTTP      | Login, CSRF, `/me`, perfis, logout e revogação após reset/desativação                             | Testes usam HTTP real em porta aleatória e PostgreSQL Testcontainers; prova manual separada integrou Angular e backend em 8080.                                                                                   |
| Limite de ambiente  | Bind em `127.0.0.1` no perfil `local`; acesso negado fora dele                                    | Testes automatizados de perfil não local, bind externo e perfis mistos passaram.                                                                                                                                  |
| Angular             | `npm run build` e `npm test -- --watch=false` em `frontend/`                                      | Build e **21/21 testes unitários** passaram.                                                                                                                                                                      |
| Navegador           | Playwright: suíte geral, casos focados e prova integrada                                          | **25/25** na suíte geral final após correção, com backend indisponível; autenticação focada 4/4 e prova adicional com backend, banco e navegador reais passaram.                                                  |
| Higiene             | `git diff --check origin/backend`, links locais e varredura de 46 arquivos alterados/novos        | Diff sem erro; 49 links locais resolvidos e Prettier passou nos documentos. Nenhum marcador de chave privada, token Google/GitHub/OpenAI ou segredo atribuído encontrado; e-mails somente em domínios reservados. |

Comandos Playwright em `frontend/`:

```text
npx playwright test --grep-invert "captura telas centrais"
npx playwright test e2e/local-auth.spec.ts --workers=2
npx playwright test e2e/route-audit.spec.ts --workers=2
```

Após o ajuste de sessão em aba nova, uma execução intermediária com backend
indisponível teve 24 aprovações e uma falha de corrida no próprio teste
`route-audit`. O teste passou a aguardar a entrada na demonstração; seus dois
casos focados passaram. A suíte geral foi repetida após a correção com backend
indisponível e passou **25/25 em 1,8 minuto, exit code 0**. Os quatro testes
focados de autenticação passaram e interceptam `/api/v1/auth/**`. A suíte geral
exclui a captura visual que sobrescreve imagens rastreadas. A prova integrada
abaixo é a evidência separada de login contra PostgreSQL.

### Prova manual integrada em 26/09/2026

Com banco descartável PostgreSQL 17.11 em `127.0.0.1:55432`, Spring Boot no perfil
`local` em `127.0.0.1:8080` e Angular em `127.0.0.1:4200`, Flyway aplicou V1–V3.
A CLI interativa criou uma conta sintética com senha digitada de forma oculta; não
foram usados dados pessoais nas evidências.

- Login no navegador retornou `204`. `/api/v1/auth/me` retornou `200` com perfil
  local `gestor`; a recarga da página preservou a sessão.
- O cookie de sessão no HTTP local foi observado com `HttpOnly`, `SameSite=Lax` e
  `Secure=false`. Uma rota de supervisor foi negada para esse perfil no Angular.
- Senha errada foi rejeitada. Após logout, `/me` retornou `401`. A desativação da
  conta pela CLI revogou uma sessão ativa: `/me` retornou `401` e a rota interna
  redirecionou para `/acesso`.
- Com o backend parado, o acesso direto a `/inicio` redirecionou para `/acesso`;
  `/demonstracao` abriu e a recarga manteve o modo fictício. A captura pós-login
  foi revisada e mostrava os rótulos de dados fictícios.

**Aceite técnico local:** os cenários de login provisório acima passaram para
desenvolvimento e teste. Esse aceite não homologa identidade institucional,
AC01/AC02, AT03 ou a Fase 0; D21 continua aberta. A verificação final dos
arquivos antes dos commits não encontrou segredos nem dados pessoais nas alterações.

Nenhuma senha, cookie, e-mail pessoal ou dado real integra estas evidências. A
prova e o aceite institucionais permanecem pendentes em [D21](DECISOES.md).
