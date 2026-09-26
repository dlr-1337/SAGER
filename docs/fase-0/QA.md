# QA da preparação do backend — Fase 0

**Executado em:** 2026-09-25 · **Escopo:** documentação e ambiente da branch `backend`.
Os resultados abaixo verificam a preparação da Fase 0. Eles não demonstram autenticação
institucional, API Spring Boot ou integrações externas em produção.

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
- Não existe `backend/` nesta fase para compilar ou testar Spring Boot/PostgreSQL. A prova
  Google OIDC real continua pendente de cliente OAuth e política Workspace autorizados
  pela TI. **A Fase 0 não está homologada.** Matrícula, conta WhatsApp e assinatura real
  permanecem abertas para as decisões indicadas no [registro](DECISOES.md).
