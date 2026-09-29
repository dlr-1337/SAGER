# QA da Fase 2

## Primeira fatia — supervisores

**Data:** 26/09/2026. **Escopo:** cadastro funcional de supervisores em ambiente
`local`, somente com dados sintéticos. Esta prova não homologa os demais cadastros
da Fase 2 nem a identidade institucional.

| Verificação              | Evidência                                                                                         | Resultado                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend                  | `.\mvnw.cmd -B -ntp clean verify` em `backend/`, Temurin 21 e PostgreSQL 17.11 via Testcontainers | 15 testes, 0 falhas; Flyway V1–V4 aplicadas.                                                                                               |
| Segurança e concorrência | Testes HTTP reais em porta aleatória                                                              | Gestor autorizado; anônimo e outros perfis negados; CSRF obrigatório; 400, 404 e 409 testados; versão obsoleta não sobrescreve o registro. |
| Conta de acesso          | SQL após POST/PUT de supervisor                                                                   | Número de contas locais não aumentou; cadastro funcional não cria credencial.                                                              |
| Angular                  | `npm run build` e `npm test -- --watch=false`                                                     | Build e 25 testes unitários passaram.                                                                                                      |
| Navegador focado         | Playwright de supervisores e auditoria de rotas, com API simulada                                 | 3 casos de supervisores e 2 de rotas passaram.                                                                                             |
| Regressão de navegador   | `npx playwright test --grep-invert "captura telas centrais"` em `frontend/`, sem backend          | 28/28 jornadas passaram; a captura visual que sobrescreve imagens rastreadas foi excluída.                                                 |
| Integração real          | PostgreSQL descartável, backend na porta 8080 e Angular na porta 4200                             | Gestor sintético criou e editou supervisor pelo navegador; POST 201, PUT 200; consulta e recarga mostraram dados persistidos.              |
| Reinício e conflito      | Backend reiniciado sobre o mesmo banco; duas abas editaram a mesma versão                         | Registro permaneceu acessível após reinício; a edição obsoleta foi recusada e a tela carregou a versão atual.                              |

O banco de prova foi publicado somente em `127.0.0.1:55433`. A conta foi criada
pela CLI com senha inserida em console oculto. A captura da tela de detalhe foi
inspecionada: mostrava “Login local”, “Dados fictícios” e “Este cadastro não cria
credenciais”. Todos os nomes, identificações e e-mails da prova usam exemplos
sintéticos; nenhuma credencial ou dado real foi versionado. Ao final, o contêiner
descartável foi parado e removido automaticamente, sem tocar em volumes existentes.

**Limites:** a unicidade da identificação funcional reproduz o protótipo, sujeita
à definição da AE/TI; o registro de supervisor não representa sua identidade
institucional nem o provisiona para login. Na entrega de 26/09, os demais cadastros
e o mapa ainda usavam serviços demonstrativos. As pendências D01, D02, D15, D19 e D22 estão no
[registro da fase](README.md).

## Segunda fatia — alojamentos, unidades, quartos e mapa

**Data:** 29/09/2026. **Resultado:** aceite técnico local para desenvolvimento.
A Fase 2 completa e a homologação institucional permanecem abertas. O mapa local
começa vazio, sem carga dos anexos privados. Todos os registros e contas da prova
são sintéticos.

### Comandos e resultados

| Verificação               | Comando ou evidência                                                                                                                     | Resultado                                                                                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend final             | `.\mvnw.cmd -B -ntp verify` em `backend/`, Temurin 21.0.12.1 e Testcontainers/PostgreSQL 17.11                                           | 38/38 testes, zero falhas, erros ou testes ignorados; JAR executável empacotado.                                                                                                                                         |
| Migrações                 | `AccommodationMigrationIntegrationTest` e `RoomMigrationIntegrationTest`                                                                 | V1–V6 em banco vazio; V4→V5, V4→V6 e V5→V6 preservaram supervisores, alojamentos, unidades e versões existentes. V1–V4 permaneceram intactas.                                                                            |
| Integridade e validação   | Testes HTTP e SQL em PostgreSQL real                                                                                                     | Código global duplicado, número duplicado na mesma localização e unidade de outro alojamento recusados; `01` preservado; repetição em locais diferentes permitida; capacidade nula aceita e valores inválidos recusados. |
| Concorrência e erros      | POST/PUT com versão e tipos inválidos                                                                                                    | `400 invalid_input`, `400 invalid_location`, `404 not_found`, `409 duplicate_code`, `409 duplicate_location` e `409 stale_version` distintos; nenhuma alteração ou incremento de versão em gravações recusadas.          |
| Segurança                 | `AccommodationApiIntegrationTest`, `RoomApiIntegrationTest` e testes de autenticação                                                     | Gestor consulta e escreve; supervisor só consulta; residente e anônimo negados; CSRF ausente negado; conta desativada perde acesso; rotas fechadas fora de `local`.                                                      |
| Angular                   | `npm test -- --watch=false` e `npm run build` em `frontend/`                                                                             | 63/63 testes em 14 arquivos; build de produção aprovado, sem ultrapassar os budgets.                                                                                                                                     |
| Regressão no navegador    | `$env:SAGER_E2E_PORT='4300'; npx playwright test --grep-invert 'captura telas centrais'`                                                 | 37/37 jornadas passaram. A captura que sobrescreve imagens rastreadas foi excluída.                                                                                                                                      |
| Ajuste responsivo final   | `npx playwright test e2e/rooms-local.spec.ts e2e/accommodations-local.spec.ts --grep 'acessíveis\|acessível\|no limite'`, com porta 4300 | 3/3 verificações passaram após o ajuste de quebra de nomes; códigos/pisos com 64 caracteres e nomes com 200 não produziram rolagem horizontal em 320/390 px. Build repetido e aprovado.                                  |
| Inspeção e acessibilidade | Impeccable `detect --json` nas seis telas; Axe WCAG A/AA nas jornadas e oito contextos da prova real                                     | Detector sem apontamentos; oito contextos reais sem violações Axe e sem overflow. Capturas de desktop/celular inspecionadas, com uma rodada de ajuste e confirmação.                                                     |
| Git e privacidade         | Prettier, `git diff --check`, links locais e `git check-ignore`                                                                          | Documentos e arquivos alterados formatados; anexos e cache excluídos do rastreamento e preservados; credenciais aleatórias da prova ausentes dos arquivos versionados.                                                   |

### Prova integrada com banco real

PostgreSQL 17.11 foi iniciado em contêiner descartável publicado apenas em
`127.0.0.1:15434`. A porta inicialmente escolhida, 55434, estava reservada pelo
Windows; foi usada outra porta sem alterar as reservas do sistema. O backend
executou com perfil `local` em `127.0.0.1:8080`. O Angular desta branch foi servido
em `127.0.0.1:4300`, com proxy para `/api`; o servidor de outra worktree na porta
4200 permaneceu separado da prova.

Uma conta de gestor sintética foi criada pela CLI existente, com confirmação de
senha em console com entrada oculta. O banco começou em V4 com o JAR anterior e
foi atualizado para V6 pelo novo backend. Playwright conduziu a jornada no Angular
real, sem interceptar ou simular a API:

1. Login local confirmado, com cookie de sessão `HttpOnly`, e mapa inicial vazio.
2. Criação de alojamento `QA-A` e unidade `CASA-QA` pelo navegador; respostas `201`
   e versões iniciais `0`.
3. Criação de dois quartos com número `01`: um na unidade e outro diretamente no
   alojamento, sem piso informado. Códigos globais distintos; capacidades `null`
   e `4`. Ocupação, vagas livres e avaliação permaneceram `null`.
4. Mapa exibiu capacidade parcial de 4 vagas e permitiu filtrar pela unidade.
   A situação manual “Ocupado” não produziu moradores nem vagas livres.
5. Duas abas abriram o mesmo quarto na versão `0`. A primeira salvou capacidade
   `6`, recebendo versão `1`; a segunda tentou `8` e recebeu `409 stale_version`,
   preservando seu formulário. A recarga explícita mostrou a capacidade `6`.
6. O mapa mostrou capacidade cadastrada total `10`, sem calcular vagas livres.
   Após reiniciar o processo do backend sobre o mesmo banco, a sessão, o
   alojamento, a unidade e os quartos continuaram disponíveis. SQL confirmou
   capacidade `6`/versão `1` e `4`/versão `0` nos respectivos quartos.
7. Logout real retornou ao acesso e a consulta a `/api/v1/auth/me` recebeu `401`.

Scripts, credenciais, cookies e capturas dessa execução ficaram fora do Git. O JAR
de prova foi copiado para uma pasta temporária para evitar bloqueio do arquivo em
`backend/target` durante o empacotamento no Windows. Ao terminar, os processos e o
contêiner próprios da prova foram encerrados e suas credenciais/cookies removidos.
Nenhum banco ou volume anterior foi apagado.

### Correções encontradas no QA

- O frontend rejeitava a versão inicial `0`; o contrato foi corrigido e os testes
  passaram a iniciar em zero e conferir a primeira edição `0→1`.
- Jackson convertia números/booleanos em texto nos campos de cadastro. Os dois
  controllers agora rejeitam tipos não textuais com `400`, sem alterar a
  configuração dos demais módulos; POST/PUT e ausência de gravação foram testados.
- Os metadados do agrupamento disputavam espaço no celular. A quebra foi ajustada
  somente nas telas de alojamentos/quartos e verificada também com valores longos.

**Limites:** este aceite cobre estrutura e mapa locais. Residentes, matrícula,
responsáveis legais, alocação, transferências, ocupação, avaliação de limpeza e
dados de saúde continuam nas próximas fatias. As divergências de capacidade dos
anexos permanecem na [D19](../fase-0/DECISOES.md); nenhuma fonte foi escolhida por
inferência. O login provisório não homologa D21 nem substitui aprovação da AE/TI.

### Correções após revisão — 29/09/2026

- Detalhe e edição de quarto agora obtêm o quarto e sua localização do mesmo
  snapshot de `/api/v1/quartos/mapa`. Um quarto ausente nesse snapshot produz
  `404`, sem apresentar uma unidade errada ou aceitar edição em local inválido.
  O teste usa respostas divergentes para a consulta individual e o mapa e
  confirma que a tela usa somente o snapshot coerente, inclusive após conflito
  de versão.
- Os formulários de alojamento e quarto conferem se a tela ainda está ativa
  após a resposta do salvamento. Ao cancelar durante uma requisição pendente,
  a resposta tardia não redireciona para o detalhe. O caso foi reproduzido antes
  da correção e coberto por testes de componente e por jornada no navegador.
- Após as correções: `npm test -- --watch=false` passou com **66/66** testes em
  15 arquivos; `npm run build` passou; e
  `$env:SAGER_E2E_PORT='4302'; npx playwright test --grep-invert 'captura telas centrais'`
  passou com **39/39** jornadas. A captura visual foi excluída porque sobrescreve
  imagens rastreadas. O backend não foi alterado nesta revisão; sua verificação
  anterior de 38/38 testes permanece registrada acima.

## Terceira fatia — cadastro local de residentes

**Data:** 29/09/2026. **Escopo:** cadastro provisório por digitação no perfil
`local`, com conta de gestor e estudante sintéticos. O resultado é **aceite
técnico para desenvolvimento**, sem homologação da origem institucional da
matrícula ou das permissões da AE/TI.

| Verificação               | Comando ou cenário                                                                                   | Resultado                                                                                                                                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Banco vazio e atualização | `ResidentMigrationIntegrationTest` com PostgreSQL 17.11/Testcontainers                               | Flyway V1–V7 aplicado em banco vazio e V7 sobre V1–V6; tabela e índice de matrícula sem diferenciar maiúsculas/minúsculas conferidos.                                                                                             |
| API e segurança           | `ResidentApiIntegrationTest` com conta local e PostgreSQL real                                       | Criação, edição, matrícula obrigatória/duplicada, opcionais nulos, nascimento inválido/futuro, versão obsoleta, leitura por gestor/supervisor, escrita só por gestor, anônimo, CSRF, conta desativada e bloqueio fora de `local`. |
| Backend completo          | `backend/`: `./mvnw.cmd -B -ntp verify` com JDK 21                                                   | **45/45 testes**, 0 falhas, 0 erros; JAR empacotado.                                                                                                                                                                              |
| Angular                   | `frontend/`: `npm test -- --watch=false` e `npm run build`                                           | **78/78 testes** em 17 arquivos e build de produção aprovados.                                                                                                                                                                    |
| Jornadas focadas          | `npx playwright test e2e/residents-local.spec.ts`                                                    | **4/4**: cadastro, consulta, edição, recarga, conflito em duas abas, erro sem dados demonstrativos, supervisor, demonstração offline e layout celular.                                                                            |
| Regressão no navegador    | `$env:SAGER_E2E_PORT='4319'; npx playwright test --grep-invert 'captura telas centrais' --workers=1` | **43/43 passaram.** A primeira execução paralela ao preparo do banco teve 41/43 e dois timeouts em auditorias globais; elas passaram isoladas (2/2) e na repetição completa serial, sem alteração de código.                      |
| Inspeção visual           | Impeccable `detect --json`, Axe e capturas desktop/celular da prova real                             | Detector retornou `[]`; Axe sem violações sérias/críticas nas telas reais; detalhe móvel a 375 px sem rolagem horizontal.                                                                                                         |

### Prova integrada sem API simulada

PostgreSQL 17.11 descartável foi publicado apenas em `127.0.0.1:15435`. O
backend local rodou em `127.0.0.1:8080`, e o Angular em `127.0.0.1:4316` com
proxy de `/api`. A CLI criou uma conta de gestor sintética, com senha inserida
no console oculto. Pelo navegador, o gestor entrou, encontrou a lista vazia,
cadastrou “Estudante Sintético QA” com matrícula `SAGER-QA-2026-001` e sem
nascimento ou curso, e recebeu um UUID e versão `0`. O detalhe mostrou os
campos ausentes como “Não informado” e não apresentou quarto ou situação
inventados. O cookie de sessão tinha `HttpOnly`.

Duas abas abriram a edição. A primeira acrescentou “Curso Sintético QA” e
recebeu versão `1`; a segunda tentou gravar sobre versão `0`, apresentou
conflito e carregou explicitamente a versão atual. Após reiniciar o processo
do backend mantendo o mesmo banco, a sessão e o cadastro continuaram
acessíveis no navegador. A consulta HTTP confirmou matrícula, curso, nascimento
`null` e versão `1`; SQL confirmou V7 e o mesmo registro. A captura
[anterior na demonstração](../../.impeccable/reviews/pr-residentes-before-demo-desktop.png)
mostra a tela em `main`; as capturas [desktop](../../.impeccable/reviews/pr-residentes-after-desktop.png) e
[celular](../../.impeccable/reviews/pr-residentes-after-mobile.png) mostram
somente dados sintéticos.

Ao concluir a prova, os processos de backend e Angular usados nela foram
encerrados, o contêiner descartável foi removido e os arquivos temporários
com senha e sessão foram apagados. Nenhum volume ou contêiner preexistente foi
alterado.

**Limites:** importação, integração institucional, formato definitivo da
matrícula, responsáveis legais, alocação, acesso médico e operações ficam
pendentes na D01/D02/D15/D19/D22. Nascimento ausente não estabelece
maioridade. Este aceite não homologa a Fase 2.
