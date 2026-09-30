# QA da Fase 2

## Sexta fatia — saúde e acesso próprio do paciente

**Data:** 30/09/2026. **Resultado:** verificação técnica local, com contas e
registros sintéticos. O [contrato](SAUDE_CONTRATO.md) registra as escolhas
delegadas, as categorias, permissões, retenção e limites assistenciais.

| Verificação | Execução e resultado |
| --- | --- |
| Backend completo | `.\mvnw.cmd -B -ntp verify`, JDK 21 e PostgreSQL 17.11: 132 testes, zero falhas/erros/skips; JAR produzido |
| Backend focado | 50 casos de saúde, V13, auditoria, autenticação e OpenAPI passaram antes da regressão completa |
| Angular final | `npm test -- --watch=false`: 128 testes passaram; `npm run build` passou |
| Navegador | 58/58 jornadas da regressão; 4/4 jornadas de saúde repetidas após os ajustes finais, com teclado, Axe e 320 px |
| Renovação | Teste da interface reproduziu destinatário oculto; correção compara habilitação e episódio assistencial; nova partilha/custódia exige nova autorização |
| Permissões | Categorias, autoria, vínculo, conta vigente, IDOR, contagens, histórico, exportação própria, CSRF, revogação e renovação sem restaurar partilhas antigas verificados em HTTP/PostgreSQL |
| Imutabilidade e auditoria | Revisões não são reescritas; correções concorrentes têm um vencedor; falha de auditoria impede a entrega de conteúdo/exportação; eventos protegidos são excluídos antes da paginação global |
| Privacidade das datas | Atualização de nota psicológica invisível não altera as datas do cabeçalho exibido ao profissional sem acesso |
| Revisão visual | Desktop e 320 px inspecionados; nenhuma rolagem horizontal; apenas um item do menu selecionado; episódios antigos exibem acesso indisponível na consulta |
| Impeccable | Detector aplicado pelo responsável da interface retornou `[]`; capturas finais inspecionadas em duas rodadas |

### Prova integrada e reinício

Sem interceptação da API: Angular na porta 4341, backend empacotado na porta
8080 e PostgreSQL descartável publicado somente em `127.0.0.1:5544`.
Quatro contas sintéticas foram criadas pela CLI com entrada oculta de senha:
administração, Medicina, Enfermagem e paciente. O vínculo da conta do paciente
foi feito explicitamente pela CLI.

O navegador criou uma nota privada e uma correção. O destinatário não recebeu
a nota antes da partilha. Depois da partilha, consultou conteúdo e histórico
sem receber ações de autoria. Encerrar seu vínculo bloqueou o conteúdo na sessão
existente; renovar o vínculo não restaurou a partilha anterior. Uma nova seleção
explícita do autor permitiu a nova partilha. Revogar a habilitação bloqueou o
acesso na requisição seguinte e redirecionou a navegação para acesso negado.

Administração permaneceu sem acesso ao conteúdo e seu GET global de auditoria
não revelou eventos clínicos. O paciente leu suas versões e baixou JSON com
UUID de exportação, referência da requisição e ambas as revisões. O texto não foi
armazenado em `localStorage` ou `sessionStorage`.

Após reiniciar o mesmo JAR sobre o mesmo banco, as três sessões mantidas apenas
na memória do navegador permaneceram válidas. Conteúdo, versões, propriedade do
paciente e revogação assistencial permaneceram iguais. Ao final, servidores e
contêiner descartável foram parados e as portas liberadas; recursos existentes
de outros projetos foram preservados.

### Capturas

- [Cadastro antes](../../.impeccable/reviews/pr-saude-before-residente-desktop.png)
  e [depois](../../.impeccable/reviews/pr-saude-after-residente-desktop.png): o
  mesmo registro sintético, frontend `main` anterior e frontend desta entrega.
- [Administração de acessos](../../.impeccable/reviews/pr-saude-acessos-desktop.png).
- [Nota e histórico](../../.impeccable/reviews/pr-saude-nota-desktop.png).
- [Paciente em 320 px](../../.impeccable/reviews/pr-saude-paciente-mobile.png).

**Limites:** os testes não representam verificação de conselho profissional,
hipótese legal de tratamento, homologação institucional ou prontuário sem papel.
O perfil continua `local` em loopback. Não há anexos, prescrição ou exclusão
automática. Administrador/superusuário do PostgreSQL pode alterar estruturas ou
desabilitar triggers; a produção exige separação de papéis e proteção operacional.
A sessão válida não restaura permissões assistenciais revogadas.

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

### Correções após revisão do PR #3 — 29/09/2026

- Matrículas recebidas diretamente pela API com espaços Unicode nas pontas,
  incluindo U+00A0 e U+2003, agora são normalizadas antes
  de criar ou editar. O mesmo tratamento vale para nome e curso opcional.
  O teste reproduziu primeiro a falha, depois confirmou o valor gravado e
  `409 duplicate_enrollment` em POST e PUT para a mesma matrícula sem diferenciar
  maiúsculas de minúsculas. O curso composto só de espaços é salvo como `null`.
- No detalhe de responsável com sessão local, o residente demonstrativo é
  exibido como texto e identificado como vínculo ainda não integrado; ele não
  abre mais um identificador fictício na API local. O link continua disponível
  na demonstração. A jornada de navegador reproduziu a falha antes da correção
  e passou depois.
- Verificação final: `backend/` com JDK 21 e `./mvnw.cmd -B -ntp verify`
  (**46/46** testes e JAR); `frontend/` com `npm test -- --watch=false`
  (**78/78** testes), `npm run build` (aprovado) e
  `$env:SAGER_E2E_PORT='4323'; npx playwright test --grep-invert 'captura telas centrais' --workers=1`
  (**44/44** jornadas). A captura global foi excluída por sobrescrever imagens
  de referência rastreadas. Depois do ajuste visual da nota, o build foi
  repetido e a inspeção temporária passou em desktop e celular: sem rolagem
  horizontal a 390 px, nome distinto da nota explicativa. Impeccable
  `detect --json` retornou `[]`. Os arquivos temporários dessa inspeção foram
  removidos.

Essas correções preservaram o aceite técnico local. Naquela revisão, a integração
de responsáveis e a homologação institucional da Fase 2 ainda estavam pendentes.

## Quarta fatia — responsáveis vinculados a residentes

**Data:** 29/09/2026. **Escopo:** cadastro persistido e consulta de responsáveis
no perfil `local`, com dados sintéticos. O resultado é **aceite técnico para
desenvolvimento**; não comprova guarda, autorização para saída longa ou assinatura.

| Verificação           | Comando ou cenário                                                                                   | Resultado                                                                                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migração              | `GuardianMigrationIntegrationTest` em PostgreSQL 17.11/Testcontainers                                | V8 aplicada em banco vazio e sobre V1–V7; registros de residentes preservados, chave estrangeira e campos obrigatórios conferidos.                                                                                                                                                  |
| API e segurança       | `GuardianApiIntegrationTest` com HTTP real, sessão e PostgreSQL                                      | Múltiplos responsáveis por residente, vínculo válido, campos opcionais, edição, versão obsoleta, entrada inválida, leitura por gestor/supervisor, escrita só por gestor, anônimo, CSRF, conta desativada e bloqueio fora de `local`.                                                |
| Backend completo      | `backend/`: `./mvnw.cmd -B -ntp verify` com JDK 21                                                   | **53/53 testes**, sem falhas; JAR gerado.                                                                                                                                                                                                                                           |
| Angular               | `frontend/`: `npm test -- --watch=false` e `npm run build`                                           | **83/83 testes** em 18 arquivos; build de produção aprovado. O teste antigo da aba de responsáveis foi atualizado para a consulta real, inclusive erro e nova tentativa sem dados da demonstração.                                                                                  |
| Jornadas no navegador | `$env:SAGER_E2E_PORT='4331'; npx playwright test --grep-invert 'captura telas centrais' --workers=1` | **49/49 passaram**. Cobrem cadastro, edição, recarga, conflito em duas abas, perfis, falha da API, demonstração offline, validação de campos aparados, teclado, layout celular e acessibilidade. A captura global foi excluída porque sobrescreve imagens de referência rastreadas. |
| Revisão visual        | Impeccable `detect --json`, Axe e capturas desktop/celular                                           | Detector retornou `[]`; formulário a 320 px sem transbordamento nem violações Axe sérias/críticas. Na prova real, não houve erro JavaScript ou transbordamento a 375 px.                                                                                                            |

### Prova integrada sem API simulada

Um PostgreSQL 17.11 descartável foi publicado apenas em `127.0.0.1:15436` e
recebeu V1–V8. O JAR Spring Boot local rodou em `127.0.0.1:8080`, e o Angular
em `127.0.0.1:4330` com proxy de `/api`. Uma conta gestora sintética foi criada
pela CLI local. Pelo Chromium, a conta entrou, cadastrou um residente e dois
responsáveis sintéticos e editou o telefone de um deles. O detalhe do residente
mostrou ambos os vínculos antes e depois da recarga. Após reiniciar somente o
backend, a sessão e os dois vínculos continuaram acessíveis; a API retornou as
versões `1` e `0`, respectivamente, ligadas ao mesmo residente. Não houve API
simulada nessa prova. Os processos e o contêiner descartáveis foram encerrados;
os demais contêineres permaneceram intactos.

A tela [anterior da demonstração](../../.impeccable/reviews/responsaveis-desktop.png)
mostrava vínculos fictícios e uma autorização demonstrativa. As capturas do
cadastro local [desktop](../../.impeccable/reviews/pr-guardians-after-desktop.png)
e [celular](../../.impeccable/reviews/pr-guardians-after-mobile.png) mostram
somente dados sintéticos e indicam que a assinatura depende de definição
institucional. O estado `active` é apenas cadastral; telefone informado não é
validado como número de WhatsApp.

A revisão de código encontrou um erro na validação visual de nome e vínculo:
espaços nas pontas podiam fazer um valor curto parecer válido. O formulário
passou a medir o valor aparado antes de enviar; a jornada reproduz o caso e
confirma que não ocorre gravação indevida.

**Limites:** prioridade, identidade e comprovação legal, autorização, telefone
válido para envio e assinatura dependem da D15/D16 e de aceite da AE/TI.
Naquela fatia, alocação, permissões institucionais, dados de saúde e
homologação da Fase 2 permaneciam pendentes. Nenhum dado pessoal real ou
credencial foi incluído no Git.

## Quinta fatia — alocação local, transferência e encerramento

**Data:** 29/09/2026. **Escopo:** vínculo persistido de residente com quarto,
histórico e contagem de ocupação no perfil `local`. O resultado é **aceite
técnico para desenvolvimento** conforme a regra provisória autorizada pelo
solicitante; não é aprovação institucional da AE/TI.

| Verificação        | Comando ou cenário                                                                                                                | Resultado                                                                                                                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migração           | `AllocationMigrationIntegrationTest` em PostgreSQL 17.11/Testcontainers                                                           | V9 aplicada em banco vazio e sobre V1–V8, preservando residentes, quartos e responsáveis. Índice impede dois vínculos ativos do mesmo residente; restrição exige motivo válido quando o vínculo termina. **2/2** testes passaram após corrigir o caso de motivo `NULL`. |
| API e segurança    | `AllocationApiIntegrationTest` e `RoomApiIntegrationTest` em PostgreSQL                                                           | Criação, transferência e encerramento; contagem e vagas no mapa; capacidade definida, lotação, manutenção, versão obsoleta, permissões de gestor/supervisor, anônimo, CSRF, conta desativada e concorrência por uma vaga.                                               |
| Backend completo   | `backend/`: `./mvnw.cmd -B -ntp verify` com JDK 21                                                                                | **60/60 testes** e JAR aprovados. A correção posterior da restrição V9 recebeu execução focada da migração, **2/2**.                                                                                                                                                    |
| Angular            | `frontend/`: `npm test -- --watch=false` e `npm run build`                                                                        | **96/96 testes** e build de produção aprovados.                                                                                                                                                                                                                         |
| Jornadas focadas   | `npx playwright test e2e/allocations-local.spec.ts --workers=1` e demais testes focados de quartos/residentes                     | **14/14** passaram, incluindo alocar, transferir, encerrar, recarga, conflito em duas abas, supervisor sem escrita, demonstração separada, Axe e celular.                                                                                                               |
| Navegador completo | `frontend/`: `$env:SAGER_E2E_PORT='4332'; npx playwright test --grep-invert 'captura telas centrais' --workers=1 --reporter=line` | **52/52** jornadas passaram na repetição isolada. A captura global foi excluída porque sobrescreve imagens de referência rastreadas.                                                                                                                                    |
| Revisão visual     | Impeccable `detect --json`, capturas e viewport 390 × 844                                                                         | Detector retornou `[]`; mapa e histórico sem transbordamento horizontal na prova integrada, sem falhas de acessibilidade nas jornadas focadas.                                                                                                                          |

### Prova integrada sem API simulada

Um PostgreSQL descartável foi publicado só em `127.0.0.1:15437`, o backend em
`127.0.0.1:8080` e o Angular em `127.0.0.1:4333`. Uma conta gestora,
um estudante, um alojamento e dois quartos sintéticos foram criados para a
prova. Pelo Chromium, o gestor entrou e alocou o estudante no quarto P1:
ocupação e vagas foram `1/0` em P1 e `0/1` em P2. A transferência para P2
produziu `0/1` em P1 e `1/0` em P2, com motivo `TRANSFER` no histórico.
O encerramento produziu `0/1` nos dois quartos e motivo `END`. API e mapa
concordaram a cada etapa. Depois de reiniciar o backend, a mesma sessão abriu
o residente, os dois vínculos históricos e o mapa com as contagens preservadas.

O contêiner, o volume e os processos descartáveis foram encerrados. As
capturas [desktop após transferência](../../.impeccable/reviews/pr-alocacoes-after-desktop.png)
e [celular após encerramento](../../.impeccable/reviews/pr-alocacoes-after-mobile.png)
mostram somente dados sintéticos. A revisão automática bloqueou a exclusão do
script e dos arquivos temporários da prova na pasta Temp local; eles não estão
no Git.

A revisão de código encontrou uma brecha no `CHECK` da V9: PostgreSQL aceita
o resultado lógico desconhecido de `NULL IN (...)`. A restrição agora exige
`end_reason IS NOT NULL` ao encerrar; um teste cobre a falha. A tela de edição
também passou a explicar o conflito quando a nova capacidade fica abaixo da
ocupação ativa.

Na primeira execução da suíte completa, um seletor antigo encontrava o nome
da responsável tanto no título quanto no detalhe. A jornada agora espera a
rota da lista e seleciona o título. Duas falhas de geração de trace ocorreram
porque execuções Playwright paralelas compartilhavam `test-results`; a suíte
foi repetida sem concorrência e passou integralmente.

**Limites:** a situação Disponível/Ocupado continua manual. Capacidade ausente
bloqueia novas entradas e deixa vagas livres desconhecidas. Reservas, exceções
de lotação, correção de histórico, capacidades oficiais e permissões
institucionais dependem da D19/D01 e da AE/TI. Esta entrega não homologa a
Fase 2.

### Revisão final do PR #5 — 29/09/2026

O rótulo da alocação agora inclui código global e piso, permitindo distinguir
quartos de mesmo número em pisos diferentes na seleção, no vínculo atual e no
histórico. O teste reproduziu primeiro o rótulo ambíguo e passou após a correção.
A verificação final executou `./mvnw.cmd -B -ntp verify` (**60/60**, após iniciar
o Docker que estava parado), `npm test -- --watch=false` (**97/97**) e
`npm run build` (aprovado). Impeccable `detect --json` retornou `[]`.

Na suíte completa de navegador, 51/52 passaram e uma navegação foi cancelada
por recarga do Vite durante uma edição concorrente de fonte. A execução
posterior, com os arquivos estáveis, de `e2e/allocations-local.spec.ts` e
`e2e/supervisors-local.spec.ts:31` passou **4/4**. O CI deve executar as
jornadas sem edições concorrentes e sem recarga automática do servidor.

## CI e pacote de decisões AE/TI — 29/09/2026

O PR #5 foi revisado e mesclado em `main` no commit
`7ece205ea306b14b2b37e1c2c5008315ef7ff0eb`. O
[PR #6](https://github.com/dlr-1337/SAGER/pull/6) implementa o
[workflow CI](../../.github/workflows/ci.yml) e o
[pacote de revisão AE/TI](PACOTE_AE_TI.md). As regras provisórias continuam
separadas das decisões institucionais, sem aprovação nominal ou data de
homologação inventadas.

### Primeira execução e correções

A [execução 36657106828](https://github.com/dlr-1337/SAGER/actions/runs/36657106828),
do commit `55eac5910fca6eab73c531454263f07449d6951c`, comprovou no Ubuntu 24.04:

- Backend `./mvnw -B -ntp verify`: **60/60**, sem falhas, erros ou testes
  ignorados, com PostgreSQL 17.11/Testcontainers e JAR gerado.
- Angular `npm test -- --watch=false`: **97/97**; build de produção aprovado.
- Playwright: **51/52**. A jornada de chamada leu `groups.count()` antes
  da renderização do componente e encontrou zero grupos. O teste agora aguarda
  a primeira marcação ficar visível antes de contar os residentes; não foram
  adicionadas retentativas, sleeps ou aumento de timeout. A execução local
  focada em `e2e/journeys.spec.ts:53`, com `--repeat-each=3`, passou **3/3**
  após a correção.
- Os dois uploads de relatórios falharam por **cota de armazenamento de
  artefatos da conta GitHub**. A API listou zero artefatos neste repositório.
  A publicação passou a ser auxiliar, com aviso no resumo se falhar; testes,
  build e jornadas continuam obrigatórios. Enquanto a cota estiver esgotada,
  os resultados são consultados nos logs das etapas.
- A tentativa de exigir os dois checks na proteção de `main` recebeu `403`,
  com exigência de upgrade de plano ou mudança para repositório público.
  O repositório permanece privado e a proteção não foi aplicada. Os checks
  continuam executando; o critério para mesclar esta entrega é conferir
  manualmente ambos aprovados no commit final.

O workflow e a configuração passaram em actionlint 1.7.12, Prettier,
`git diff --check` e revisão independente. A listagem do navegador confirmou
52 jornadas, excluindo somente a captura que sobrescreve referências visuais
rastreadas. A documentação do pacote teve 36 links locais conferidos; a
conferência conjunta dos documentos alterados validou **87 links locais**, sem
destinos ausentes.

### Execução após as correções

A [execução 36657756253](https://github.com/dlr-1337/SAGER/actions/runs/36657756253),
no commit `5bd414ed3d65518fa7ce86397b4720f102ac7f5e`, concluiu com os dois jobs
**aprovados**. Os logs confirmaram **60/60** testes backend, **97/97** Angular,
build de produção e **52/52** jornadas Chromium. Não houve testes ignorados no
backend nem retentativas do navegador. A etapa de resumo executou após os
uploads recusados pela cota, comprovando o aviso sem esconder falha de teste.
O commit posterior de documentação será verificado novamente pelos checks do PR.

**Limites:** o CI usa somente dados sintéticos. Jornadas com API interceptada
validam a interface; os testes de backend usam PostgreSQL real. A prova
integrada de navegador, banco e API está registrada na quinta fatia acima.
O CI não homologa D01/D02/D15/D19/D21/D22 nem conclui as Fases 0–2.

## Revisão das regras informadas em 30/09/2026

O solicitante confirmou autoridade de gestão do supervisor, cadastro manual,
nascimento obrigatório e login próprio, além das regras futuras de assinatura,
compartilhamento de saúde e retenção permanente da auditoria. Essas respostas
foram registradas como decisões do projeto, sem criar aprovação institucional.
O PRD, a especificação e o pacote AE/TI foram alinhados às respostas; a planilha
do ZIP prevalece nas capacidades divergentes de R4 e Laticínio. Não houve carga
dos registros pessoais dos anexos.

**Mudanças implementadas:** gestor e supervisor podem consultar, cadastrar e editar
todos os recursos atuais de gestão, incluindo supervisores, e movimentar alocações.
Perfis de residente e anônimo continuam bloqueados; CSRF, sessão desativada e
controle de versão permanecem exigidos. Nome, matrícula e nascimento são
obrigatórios em novas gravações e edições de residentes. A migração V10 usa
`CHECK (birth_date IS NOT NULL) NOT VALID`: registros antigos sem nascimento
continuam legíveis, mas precisam da data para serem editados; nenhum nascimento
foi inventado.

| Verificação                       | Comando ou evidência                                                                                            | Resultado observado                                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend e migrações               | `mvnw.cmd -B -ntp verify`, JDK 21 e PostgreSQL Testcontainers                                                   | 62 testes, nenhuma falha, erro ou teste ignorado; `BUILD SUCCESS`.                                                                              |
| Angular                           | `npm test -- --watch=false`                                                                                     | 98 testes passaram.                                                                                                                             |
| Produção Angular                  | `npm run build`, repetido depois da correção do aviso                                                           | Compilação e templates aprovados.                                                                                                               |
| Navegador, regressão completa     | `SAGER_E2E_PORT=4336`, `npx playwright test --grep-invert 'captura telas centrais' --workers=1 --reporter=line` | Primeira execução: 51/52; o aviso de nascimento ausente aparecia também em residente com data preenchida.                                       |
| Correção e jornadas de residentes | `SAGER_E2E_PORT=4337`, `npx playwright test e2e/residents-local.spec.ts --workers=1 --reporter=line`            | 5/5 passaram após condicionar o aviso à ausência da data. Inclui cadastro, edição legada por supervisor, conflitos e acessibilidade em celular. |
| Revisão visual e Impeccable       | Capturas agrupadas em 1440 px e 320 px; `impeccable detect --json`                                              | Formulário obrigatório, erro associado ao campo e ações de gestão visíveis ao supervisor; nenhuma rolagem horizontal; detector `[]`.            |
| Revisão de código                 | Inspeção independente das permissões, validação e migração                                                      | Nenhuma regressão encontrada nas alterações; a inspeção não substitui os testes.                                                                |

A revisão independente dos documentos corrigiu uma ampliação indevida do acesso
operacional do gestor no rascunho do PRD. A versão final concede ao supervisor
as permissões dos recursos de gestão integrados e mantém as permissões anteriores
dos fluxos de chamada, limpeza e decisões de saída. Prettier e `git diff --check`
passaram; 96 links locais nos 13 documentos alterados foram conferidos sem quebra.

Capturas sintéticas do resultado: [formulário desktop](../../.impeccable/reviews/pr-regras-residente-desktop.png),
[formulário 320 px](../../.impeccable/reviews/pr-regras-residente-mobile.png) e
[gestão por supervisor](../../.impeccable/reviews/pr-regras-supervisor-desktop.png).
A [captura histórica da navegação do supervisor](../../.impeccable/reviews/inicio-supervisor-desktop.png)
permite comparar a inclusão de Responsáveis, Supervisores e Quartos.

As jornadas de navegador interceptam as APIs e verificam a interface; os testes
Java verificam PostgreSQL e autorização reais em bancos descartáveis. Não foi
repetida uma prova manual integrada com servidor persistente nesta revisão.
O login próprio continua disponível somente no perfil local e em loopback;
assinatura operacional, recurso médico compartilhado e auditoria permanente
ainda exigem implementação nas respectivas fases. A retenção permanente se aplica
à auditoria, sem estender a regra a todos os dados médicos ou backups.

O CI executará novamente a suíte completa no commit publicado. As limitações de
cota de artefatos e proteção de branch do plano GitHub estão registradas em
[CI](../CI.md); os testes e builds continuam obrigatórios na execução.

## Fundação da API, auditoria e vínculo de contas — 30/09/2026

**Escopo:** [fundação técnica](../fase-1/FUNDACAO.md), migrações V11/V12,
auditoria das 15 gravações atuais de gestão e perfil local vinculado.
As regras de saúde e operações ainda não fazem parte desta entrega.

| Verificação                   | Comando ou evidência                                                        | Resultado observado                                                                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend consolidado final     | `mvnw.cmd -B -ntp verify`, JDK 21 e PostgreSQL 17.11/Testcontainers         | 108/108 testes, nenhuma falha, erro ou teste ignorado; BUILD SUCCESS e JAR executável aprovado.                                                                                    |
| Regressões finais de contrato | `-Dtest=SupervisorApiIntegrationTest,ApiFoundationIntegrationTest verify`   | 16/16 passaram depois de corrigir tipos JSON de supervisor e documentar respostas 422; as falhas foram reproduzidas antes das correções.                                           |
| CLI fora do perfil local      | Testes de subprocesso reais e execução do JAR sobre banco descartável       | Recusa com código 2 e mensagem curta, sem pilha nem mutação; ajuda local retorna 0. A falha anterior retornava 1 e pilha; teste RED antes da correção.                             |
| Angular                       | `npm test -- --watch=false`                                                 | 101/101 testes passaram.                                                                                                                                                           |
| Build Angular                 | `npm run build`                                                             | Produção e templates aprovados; bundle inicial de 487 kB.                                                                                                                          |
| Navegador completo            | `SAGER_E2E_PORT=4340`, Playwright, um worker, sem a captura histórica       | 54/54 jornadas passaram, incluindo vínculos e revogação; APIs interceptadas nas jornadas locais.                                                                                   |
| Impeccable e imagens          | Detector, capturas agrupadas em 1440 px e 320 px                            | Detector `[]`; perfil inspecionado em ambas as larguras; sem rolagem horizontal. A captura móvel foi repetida com a navegação já estabilizada.                                     |
| Prova integrada real          | Angular 4341, API 8080 e PostgreSQL descartável somente em `127.0.0.1:5544` | Criação e edição de residente, criação de supervisor, correlação e privacidade dos dois eventos conferidas; vínculos explícitos, revogação e acesso de residente recusado com 403. |
| Reinício real                 | Mesmos contextos de navegador mantidos em memória enquanto a API reiniciava | Sessões autenticadas, cadastro, vínculos e os mesmos eventos/correlações permaneceram válidos; nenhuma nova autenticação necessária.                                               |

A prova não usou interceptação de API. Contas, registros e senha eram sintéticos;
nenhuma sessão ou senha foi salva como arquivo. O contêiner descartável foi
removido e as portas 8080/4341 foram liberadas ao final. Os eventos não contêm
os nomes, a matrícula, a data de nascimento ou o curso usados no cadastro.
As imagens estão na [fundação](../fase-1/FUNDACAO.md).

Revisões independentes conferiram auditoria, transações, autorização e vínculos.
As falhas concretas encontradas foram corrigidas e retestadas. A proteção
SQL da auditoria foi provada contra operações comuns; um administrador com
permissões de alterar o esquema permanece fora desse limite local.

O CI verificará a suíte consolidada no commit publicado. Configuração de
produção, habilitação assistencial e integrações externas permanecem nas fases
seguintes; a prova técnica não registra aprovação institucional.
