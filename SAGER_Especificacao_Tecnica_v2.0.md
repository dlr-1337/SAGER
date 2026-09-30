# SAGER

## Especificação Técnica e Arquitetura

**Angular + Java com Spring Boot**  
Instituto Federal Goiano — Campus Urutaí  
Documento complementar ao PRD completo v2.0

**Versão:** 2.0  
**Data de referência:** 24/09/2026  
**Finalidade:** orientar a implementação integral do SAGER com uma base tecnológica definida e operação simples.  
**Situação:** arquitetura de referência para desenvolvimento; integrações reais, infraestrutura e regras da AE ainda exigem homologação.

## Leitura e autoridade das decisões

**[U]** identifica decisão do solicitante, incluindo Angular/Java e as regras da fase atual definidas em 30/09/2026. **[T]** identifica escolha técnica feita neste documento por delegação do solicitante. **[P]** identifica parâmetro ou procedimento proposto para homologação. **[A]** identifica dependência institucional não resolvida. A seleção de um fornecedor de referência não autoriza contratação nem comprova validade jurídica de assinaturas.

A SRS v2.1 e o PRD v2.0 definem o que o produto precisa fazer. Este documento define como implementar. Os requisitos funcionais, seus 72 critérios de aceite e as pendências D01–D26 não são substituídos por decisões de biblioteca ou infraestrutura. As decisões de 30/09 prevalecem para a fase atual onde atualizam uma premissa da SRS; não representam homologação institucional. O repositório já contém implementação e testes locais, mas esta revisão documental não comprova implantação real.

## Guia de leitura

Decisões e versões: seções 1–2. Arquitetura e código: 3–5. Autenticação e dados: 6–7. Integrações e tarefas: 8–9. Relatórios e segurança: 10–11. Implantação e qualidade: 12–14. Sequência de execução e pendências: 15–16. Referências técnicas: 17.

**Base funcional:** SAGER_Corrigido(1).docx, SRS-SAGER-001 v2.1, 55 páginas na representação analisada; PRD completo v2.0; confirmação de stack do solicitante nesta conversa. O áudio OGG originalmente anexado não foi transcrito.

<!-- pagebreak -->

# 1. Decisões de arquitetura

## 1.1 Princípio de implementação

**[T]** Desenvolver um monólito modular: uma aplicação Spring Boot, organizada por funcionalidades, com um único banco PostgreSQL. O frontend Angular será compilado em arquivos estáticos e servido pelo Nginx. O mesmo domínio atenderá interface, API e rotas de autenticação.

Essa composição foi escolhida para reduzir a quantidade de serviços e manter as regras de negócio em uma aplicação que a TI e os alunos responsáveis consigam localizar, testar e implantar. Não se afirma que seja a arquitetura universalmente mais usada ou mais fácil; é a escolha para este porte e para as restrições documentadas.

## 1.2 Restrições preservadas

O produto é web responsivo, sem aplicativo móvel próprio. A SRS prescreveu autenticação institucional; **[U] a fase atual usa login próprio do SAGER por e-mail e senha**, com SUAP ou Google reservados para possível evolução. O ambiente previsto na SRS tem **2 GB de RAM, 1 CPU e 50 GB de armazenamento**, com capacidade de gerenciar até 250 residentes e 50 transações por minuto. A SRS exige até 2 segundos para operações como consultas e solicitações; a fronteira da medição precisa ser homologada. Esses números são requisitos, não resultados de benchmark. [SRS, pp. 6 e 47–49]

A estrutura inicial não inclui microserviços, Kubernetes, Kafka, RabbitMQ, Redis, GraphQL, WebFlux ou banco não relacional. Não há aplicação Node.js permanente no servidor, NgRx obrigatório ou renderização Angular no servidor. Não haverá motor próprio de assinatura eletrônica nem autenticação JWT desenvolvida do zero.

## 1.3 O que permanece fora da decisão técnica

A AE define escalas de avaliação, fórmula do ranking, critérios de reincidência, gravidades e regras de cancelamento e início de saída. A paridade operacional de gestor e supervisor e a suficiência de uma assinatura válida já foram decididas para a fase atual; a identidade do responsável e o sigilo médico ainda exigem governança. A TI valida o login próprio antes de implantação real e informa acessos e infraestrutura. A instituição autoriza tratamento de dados, serviços de terceiros e custos. A arquitetura não pode substituir essas decisões por valores arbitrários.

**Resultado esperado da preparação:** equipe consegue construir um fluxo vertical de login próprio do SAGER, autorização por perfil, cadastro, gravação no PostgreSQL e teste automatizado antes de iniciar todos os módulos em paralelo.

<!-- pagebreak -->

# 2. Stack e política de versões

## 2.1 Base tecnológica escolhida

| Área                     | Tecnologia                                                  | Diretriz de implementação                                                                           |
| ------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Frontend [U/T]           | Angular 22 + TypeScript                                     | Angular CLI, componentes standalone, tipagem estrita e carregamento por funcionalidade. [T01–T03]   |
| Componentes [T]          | Angular Material + CDK                                      | Mesma versão principal do Angular, SCSS próprio e componentes reutilizáveis. [T04]                  |
| Formulários [T]          | Angular Reactive Forms                                      | Formulários tipados; validação local complementar ao servidor. [T30]                                |
| Estado/HTTP [T]          | Signals, RxJS e HttpClient                                  | Estado simples em serviços; observables para HTTP e eventos assíncronos. [T32]                      |
| Ferramentas frontend [T] | Node.js 24 LTS + npm                                        | Somente desenvolvimento e build; dependências reproduzíveis com package-lock.json. [T02, T05]       |
| Backend [U/T]            | Java 21 LTS, Eclipse Temurin; Spring Boot 4.1               | Spring MVC, servidor servlet embutido e aplicação JAR. [T06–T07]                                    |
| Build Java [T]           | Maven 3.9.x com Maven Wrapper                               | Uma ferramenta de build, versão reproduzível e dependências geridas pelo Spring Boot.               |
| Persistência [T]         | Spring Data JPA/Hibernate                                   | Repositórios, transações e consultas; entidades não expostas diretamente pela API.                  |
| Banco [T]                | PostgreSQL 17                                               | Versão de manutenção suportada da linha 17; mesmo banco em testes de integração. [T08]              |
| Migrações [T]            | Flyway Community                                            | Migrações SQL versionadas; sem alteração automática de schema pelo Hibernate em produção. [T09]     |
| Autenticação [U/T]       | Spring Security                                             | Login próprio por e-mail/senha na fase atual; SUAP/Google podem ser integrados no futuro. [T10–T12] |
| Sessão [T]               | Spring Session JDBC                                         | Sessões no PostgreSQL; cookie protegido e CSRF na integração com Angular. [T13–T14]                 |
| Documentação de API [T]  | springdoc-openapi 3.x + Swagger UI                          | Versão compatível com Spring Boot 4; exposta somente em ambiente autorizado. [T15]                  |
| Mensagens [T]            | Meta WhatsApp Cloud API                                     | Integração HTTP oficial pelo backend, conforme obrigação da SRS.                                    |
| Assinatura [T/A]         | Clicksign API 3.0, modelo de envelopes                      | Referência técnica condicionada à aprovação institucional e acesso ao serviço. [T16–T17]            |
| Documentos [T]           | Apache PDFBox 3 + Apache POI                                | PDF e XLSX gerados em Java. [T18–T19]                                                               |
| Gráficos [T]             | Chart.js 4                                                  | Integração direta em componente Angular; alternativa textual e tabela de dados. [T20]               |
| Processamento [T]        | Agendador Spring + tarefas no PostgreSQL                    | Persistência, retentativa e recuperação sem servidor de fila separado. [T21]                        |
| Operação [T]             | Docker Engine, Compose e Nginx                              | Três serviços permanentes; volumes persistentes; HTTPS. [T22–T23]                                   |
| Testes [T]               | JUnit Jupiter, Mockito, Testcontainers, Vitest e Playwright | Backend, banco real, componentes e jornadas completas. [T03, T24–T26]                               |
| Qualidade/entrega [T]    | Git, GitHub Actions, ESLint e Prettier                      | Build/testes antes de merge; implantação de produção com aprovação. [T27]                           |
| Observabilidade [T]      | Spring Boot Actuator + logs estruturados                    | Saúde, métricas básicas, erros e correlação de operações. [T28]                                     |

## 2.2 Como congelar as versões

As famílias acima foram escolhidas com consulta às fontes oficiais em 24/09/2026. Não são um lockfile testado. No primeiro incremento, fixar versões exatas em package-lock.json, pom.xml, Maven Wrapper e imagens de contêiner. Usar releases estáveis mantidas, nunca SNAPSHOT, release candidate ou tag latest em produção.

A documentação consultada apresenta Angular 22 como versão ativa. A matriz publicada para Angular 22.0.x exige Node 22.22.3, 24.15.0 ou 26 nas respectivas linhas, TypeScript 6.0.x e RxJS em faixas compatíveis. **[T]** Escolher Node 24 LTS e deixar o Angular CLI selecionar TypeScript/RxJS compatíveis com a minor adotada; conferir novamente a matriz antes de congelar. Não instalar manualmente o TypeScript mais novo ignorando a compatibilidade. [T01–T02, T05]

Spring Boot 4.1 aceita Java 21. **[T]** Adotar Java 21 LTS sem recursos preview, mantendo uma base estável de linguagem. Usar o gerenciamento de dependências do Boot para Spring, Hibernate, Jackson e bibliotecas de teste; não misturar versões independentes desses componentes. Para springdoc, a linha compatível é 3.x, não a linha 2.x destinada a Boot 3. [T06–T07, T15]

A manutenção inclui atualizações de segurança e revisão periódica das linhas suportadas. Um upgrade principal deve passar pelos mesmos testes de login, permissões, migração, exportação e saídas da versão anterior. A aplicação não deve depender de suporte comercial obrigatório para permanecer em uma versão obsoleta.

<!-- pagebreak -->

# 3. Estrutura da aplicação

## 3.1 Topologia de produção

```text
Navegador no computador ou celular
  -> HTTPS -> Nginx
       /                 -> arquivos estáticos do Angular
       /api/v1/*         -> aplicação Spring Boot

Spring Boot -> PostgreSQL: domínio, sessão, auditoria e tarefas
Spring Boot -> volume privado: PDFs, assinaturas e exportações
Spring Boot -> HTTPS: WhatsApp e assinatura; identidade externa só se integrada futuramente
```

O login próprio usa `/api/v1/auth/login`, já coberto pela rota da API. Qualquer rota de provedor externo será incluída somente se SUAP ou Google forem integrados futuramente.

**[T]** Apenas Nginx publica as portas de aplicação na internet. PostgreSQL e porta interna do Spring Boot ficam na rede privada do Compose. Uma única instância de backend é suficiente como ponto de partida; o mecanismo de tarefas utiliza bloqueio/lease para evitar execução duplicada em reinícios ou sobreposição de deploy.

## 3.2 Organização do repositório

```text
sager/
  frontend/           Angular e testes de interface
  backend/            Maven, Spring Boot e migrações
  infra/              Dockerfiles, Compose e Nginx
  docs/               PRD, especificação, decisões e manuais
  .github/workflows/  verificações e entrega
```

**[T]** Um repositório para facilitar mudanças coordenadas de contrato e tela. Não usar Nx ou outro orquestrador de monorepo apenas por existir frontend e backend. Gerar cada projeto com suas ferramentas oficiais; manter scripts curtos de preparação e um README com comandos verificados.

## 3.3 Módulos do backend

| Pacote funcional         | Responsabilidade                                                  | Referência do PRD |
| ------------------------ | ----------------------------------------------------------------- | ----------------- |
| acesso                   | Conta SAGER, perfis e sessões; identidade externa futura opcional | E01               |
| residentes               | Cadastro, responsáveis, vínculos e acesso a dados médicos         | E02               |
| supervisores             | Administração de supervisores                                     | E03               |
| quartos                  | Blocos/pisos, quartos e dados do mapa                             | E04               |
| presencas                | Chamada e participações                                           | E05               |
| saidas                   | Solicitações, decisões, linha do tempo e retorno curto            | E06–E08           |
| documentos / integracoes | Arquivos, versões, assinatura e mensagens                         | E09               |
| ocorrencias              | Origem dos alertas e notificações internas                        | E10               |
| comunicacao              | Advertências manuais, avisos, leitura e ciência                   | E11               |
| compromissos             | Termos vinculados a reincidências analisadas                      | E12               |
| limpeza                  | Avaliação, cálculo homologado e ranking                           | E13               |
| relatorios               | Consultas, gráficos e exportações                                 | E14               |
| auditoria / tarefas      | Histórico técnico e processamento persistente                     | Transversal       |

Cada módulo pode ter controller, service, repository, entity e dto. Criar subpacotes quando houver conteúdo real. Não gerar interfaces para todas as classes, camadas vazias ou um módulo separado por tabela. Regras de um módulo são acessadas por seus serviços, não por alterações diretas em suas tabelas a partir de outro controller.

<!-- pagebreak -->

# 4. Implementação do frontend

## 4.1 Padrões definidos

**[T]** Angular standalone, Router com carregamento sob demanda por funcionalidade, Reactive Forms tipado e HttpClient. Signals ficam responsáveis por estado de tela e valores derivados; RxJS trata requisições e composição assíncrona. Não adotar uma loja global NgRx inicialmente. Um serviço por domínio de API é suficiente para começar. [T30, T32]

Usar Angular Material para diálogos, campos, tabelas paginadas, abas, seleção, feedback e navegação. A biblioteca é mantida pela equipe Angular e oferece ferramentas de acessibilidade; a implementação ainda exige teste de teclado, foco e rótulos. [T04]

**[T]** Um tema institucional próprio em SCSS, sem adicionar Bootstrap ou Tailwind como segunda base visual. O mapa dos quartos é uma grade CSS agrupada por bloco/piso, não um mapa geográfico; não requer Google Maps, Leaflet, canvas ou uma biblioteca de diagramas.

## 4.2 Componentes reutilizáveis prioritários

| Componente       | Contrato de comportamento                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| ModalRevisao     | Mostra resumo da ação; cancelar não grava; confirmar dispara uma única requisição; erro não fecha como sucesso. |
| LinhaTempoSaida  | Usa eventos e estados enviados pela API; assinatura aparece como não aplicável em saída curta.                  |
| FiltrosRelatorio | Combina período, residente, ocorrência e status; mostra filtros ativos e mantém exportação coerente.            |
| MapaQuartos      | Agrupa por bloco/piso; situação por cor e texto; exibe identificação, ocupação e nota existente.                |
| FeedbackLimpeza  | Mostra nota anterior, nova nota, diferença e posição retornadas pelo backend; sem previsão fictícia.            |
| EstadoVazioErro  | Distingue carregando, sem dados, sem permissão e falha técnica.                                                 |

O componente visual não decide permissão nem transição. Guards de rota servem à navegação; o backend valida cada operação e o vínculo do usuário ao registro.

## 4.3 Datas, atualização e formulários

Usar pt-BR na interface e America/Sao_Paulo como fuso operacional. Exibir o retorno curto inicial em saída +3 horas; permitir antecipação e impedir duração inválida. A API repete a validação. A resolução do conflito entre “agora” e tempo de preenchimento continua vinculada a D03; a equipe não deve adicionar tolerância oculta.

Após um POST/PUT válido, atualizar a tela com a resposta real. Para alterações externas, **[T]** usar atualização periódica apenas em telas que precisem acompanhar pendências, iniciando com intervalo configurável de 30 segundos, pausado em aba oculta. Não tratar essa frequência como requisito da SRS nem como substituta do feedback imediato da própria ação. WebSocket não integra a base inicial.

O polling não deve prolongar indefinidamente a sessão sem interação humana: o cliente deve parar ao atingir a inatividade definida, e o servidor deve aplicar a política correspondente. Ao expirar, encaminhar ao login; não persistir dados médicos, documentos ou formulários sensíveis em localStorage para facilitar a retomada.

## 4.4 Rotas funcionais propostas

**[T]** Organizar as telas em /inicio, /residentes, /supervisores, /quartos, /chamada, /saidas, /notificacoes, /avisos, /limpeza, /ranking, /relatorios e /ajuda. O histórico e os termos podem ficar dentro de /residentes/:id. A mesma área pode apresentar ações diferentes por perfil. A rota não concede permissão ausente na matriz vigente do PRD.

<!-- pagebreak -->

# 5. Backend e contrato da API

## 5.1 Padrão de implementação

**[T]** Usar Spring MVC e serviços transacionais, Spring Data JPA, Jakarta Bean Validation e DTOs explícitos. Mapear DTOs manualmente enquanto os objetos forem simples. Records Java são adequados aos DTOs imutáveis; entidades JPA permanecem classes. Não incluir Lombok ou MapStruct como dependências obrigatórias sem necessidade demonstrada.

O controller interpreta HTTP, valida a entrada e chama o serviço. O serviço aplica regras, autorização por registro e transações. O repositório consulta/persiste. Cálculos de nota e ranking devem estar em funções testáveis, com a regra da AE versionada; a fórmula não pode depender da tela.

**[T]** Construir integrações HTTP com Spring RestClient, com limites de conexão/leitura explícitos. Operações locais não devem permanecer em transação de banco durante a espera de WhatsApp ou assinatura. O trabalho externo é registrado em uma tarefa persistente na mesma transação do evento que o originou. [T21, T31; desenho específico na seção 9]

## 5.2 Convenções de contrato

API em /api/v1, JSON com campos camelCase e nomes de domínio consistentes com o PRD. Identificadores UUID; instantes ISO 8601 com offset/UTC; datas civis no formato AAAA-MM-DD. Listagens paginadas com ordenação permitida por lista de campos e limites definidos no servidor. **[T]** Iniciar com 20 itens e máximo configurável de 100 por página; exportações não ficam limitadas à página atual.

Usar 400 para formato/validação, 401 para sessão ausente, 403 para operação não autorizada, 404 para recurso inexistente ou cuja existência não deva ser revelada, 409 para conflito de estado/versão e 429 para limitação de requisições. Padronizar erros com código de negócio, mensagem, erros por campo e identificador de correlação. Não retornar stack trace, SQL ou segredo.

**[T]** Recursos editáveis possuem campo version. A alteração informa a versão lida; JPA @Version impede sobrescrita concorrente. A API retorna conflito quando alguém já modificou o registro. Repetir a requisição sem conflito não deve criar segundo retorno, ciência ou advertência vinculada ao mesmo ato.

## 5.3 Catálogo inicial de endpoints

Os caminhos da tabela são relativos ao prefixo /api/v1; as rotas de autenticação do SAGER ficam configuradas separadamente. São contratos técnicos propostos; permissões e comportamentos são os do PRD. Não criar um PATCH genérico de status que permita contornar as transições.

| Grupo                 | Operações de referência                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| Sessão                | POST /auth/login; GET /auth/me; GET /auth/csrf; POST /auth/logout                                       |
| Residentes            | GET/POST /residentes; GET/PUT /residentes/{id}; sub-recursos /responsaveis e /historico                 |
| Supervisores          | GET/POST /supervisores; GET/PUT /supervisores/{id}                                                      |
| Quartos               | GET /quartos/mapa; GET/POST /quartos; GET/PUT /quartos/{id}                                             |
| Chamada               | GET/POST /chamadas; GET /chamadas/{id}; PUT /chamadas/{id}/participacoes; POST /chamadas/{id}/confirmar |
| Saídas                | GET/POST /saidas; GET/PUT /saidas/{id}; GET /saidas/{id}/eventos                                        |
| Decisões              | POST /saidas/{id}/aprovar; /rejeitar; /confirmar-retorno; /reenviar-mensagem                            |
| Notificações          | GET /notificacoes; POST /notificacoes/{id}/visualizar; /analisar; /arquivar; /converter                 |
| Advertência e ciência | POST /advertencias; GET /me/avisos; GET /me/advertencias; POST /me/comunicacoes/{id}/ciencia            |
| Limpeza e ranking     | POST /avaliacoes-limpeza; PUT /avaliacoes-limpeza/{id}; GET /ranking                                    |
| Relatórios            | GET /relatorios/{tipo}; POST /exportacoes; GET /exportacoes/{id}; GET /exportacoes/{id}/arquivo         |
| Documentos            | GET /documentos/{id}/arquivo; acesso conforme vínculo e permissão                                       |
| Termos                | GET/POST /residentes/{id}/termos; ações de ciência/assinatura conforme RN10 homologada                  |
| Integrações           | POST /webhooks/whatsapp; POST /webhooks/assinatura; verificação adicional exigida pelo provedor         |

Não criar endpoints de início físico de saída, cancelamento ou alteração retroativa sem resolver D05–D08. Cadastro/publicação de avisos também depende de D18. O catálogo não concede um CRUD irrestrito a informações médicas ou registros históricos.

**[T]** Documentar contratos com springdoc/Swagger; testar exemplos de sucesso e erro. Não habilitar recursos extras de MCP ou consoles administrativos da biblioteca que não fazem parte do SAGER. [T15]

<!-- pagebreak -->

# 6. Autenticação e autorização

## 6.1 Login próprio do SAGER

**[U/T]** Na fase atual, autenticar contas SAGER por e-mail e senha no backend, com hash de senha adequado, credenciais protegidas, controle de tentativas e sessão no servidor. O Angular consulta `/api/v1/auth/me`. O ambiente local existente está restrito ao loopback e serve ao desenvolvimento; a implantação real precisa de validação de segurança, operação e provisionamento.

**[A]** A TI deve validar política de senha, recuperação de acesso, provisionamento, desligamento, proteção contra abuso e condições de implantação. SUAP ou Google podem ser estudados como provedores futuros, com protocolo e atributos confirmados antes de qualquer integração; essa etapa não bloqueia o login próprio atual. Não implantar Keycloak adicional sem necessidade institucional. [T10–T12, T29]

Manter identificador estável da conta SAGER e vínculo com os perfis locais de negócio. Não conceder papel de gestor por domínio do e-mail. O cadastro funcional de um supervisor deve vincular a conta por processo autorizado e não deve criar senha previsível. Uma integração externa futura vinculará `issuer + subject` ou identificador equivalente sem alterar automaticamente o papel local.

## 6.2 Sessão e CSRF

**[T]** Usar Spring Session JDBC no PostgreSQL. O navegador recebe cookie de sessão Secure, HttpOnly e SameSite ajustado ao fluxo de login próprio; Lax é ponto de partida sujeito à validação da implantação. A API fica na mesma origem da interface, evitando CORS aberto. [T12–T13]

Manter CSRF ativo nas operações autenticadas por cookie. Configurar o token CSRF e o interceptor do Angular de forma compatível; o cookie que contém apenas o token CSRF pode ser legível pelo JavaScript, ao contrário do cookie de sessão. Renovar o token após login/logout e testar a integração de SPA segundo a documentação da versão Spring Security escolhida. [T14]

Logout é uma operação protegida que invalida a sessão no servidor. Não guardar credenciais ou tokens em localStorage/sessionStorage. Eventuais tokens de integração futura ficam no backend, protegidos e fora de logs; não criar um fluxo paralelo de emissão de JWT próprio.

**[P]** Iniciar a homologação com 30 minutos de inatividade e duração máxima de 8 horas, sujeitas à política institucional. Implementar controle de inatividade de interação para que polling não preserve sessões sem usuário. Uma conta desabilitada localmente deve perder acesso mesmo que a sessão ainda exista. Se houver provedor externo no futuro, sua propagação de desligamento precisará de acordo com a TI.

## 6.3 Permissões

**[T]** Spring Security controla o acesso ao endpoint e o serviço verifica vínculo, papel e registro. Um residente acessa seus próprios dados, solicitações e comunicações. Um responsável legal recebe acesso ao documento pertinente no serviço de assinatura, não ao painel completo do SAGER.

**[U]** O supervisor tem autoridade operacional máxima e recebe as permissões do gestor nos recursos de gestão integrados: supervisores, residentes, responsáveis, alojamentos, quartos e alocações. O gestor pode cadastrar residentes manualmente; esta decisão não amplia seu acesso aos fluxos operacionais de supervisor. Dados médicos podem ser compartilhados entre profissionais autorizados para finalidade assistencial, sob sigilo profissional; gestor ou supervisor, isoladamente, não recebe esse acesso. Testar acesso horizontal, trocando IDs de residentes e documentos, além de acesso vertical entre papéis.

## 6.4 Desenvolvimento sem credenciais reais

**[T]** Permitir autenticação simulada somente em perfil de desenvolvimento/teste, com dados sintéticos. Inicialização de produção deve falhar quando esse perfil estiver ativo ou quando faltarem configurações de segurança obrigatórias para login próprio. A página de demonstração da SRS não autoriza login com qualquer senha em produção. O login local atual em loopback não comprova prontidão para implantação real.

<!-- pagebreak -->

# 7. Modelo de dados e arquivos

## 7.1 Convenções de persistência

**Implementação atual:** as fatias cadastrais locais usam `JdbcTemplate`, SQL e
Flyway, com controle de versão explícito nas gravações. As referências a JPA,
Hibernate e `@Version` neste documento descrevem a arquitetura proposta para
evolução; não representam bibliotecas já usadas nas APIs locais nem exigem uma
troca de persistência para validar as regras entregues.

**[T]** PostgreSQL 17 com tabelas em snake_case, UUID para IDs, chaves estrangeiras, campos de auditoria e version em registros concorrentes. Instantes ficam em timestamptz/UTC; datas de nascimento e data civil da chamada são datas, não horários convertidos. Usar BigDecimal/NUMERIC para notas, com precisão e arredondamento ajustados à regra de avaliação homologada.

Migrações Flyway criam e evoluem o schema. Hibernate usa validação de estrutura em produção; não usar ddl-auto=update/create. Executar migrações e testes de integração no PostgreSQL da mesma linha da produção, sem substituir suas restrições por H2. Separar dados sintéticos de demonstração das migrações de produção. [T08–T09]

## 7.2 Entidades físicas de referência

A lista detalha a modelagem proposta; não inventa campos obrigatórios de cadastro ou critérios disciplinares ausentes na SRS.

| Conjunto     | Tabelas/objetos                                                      | Integridade principal                                                                                                                                                        |
| ------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acesso       | usuario, usuario_perfil, credencial_local; identidade_externa futura | E-mail único, hash de senha, usuário ativo e perfis atribuídos explicitamente.                                                                                               |
| Equipe       | supervisor                                                           | Vínculo ao usuário e às ações registradas.                                                                                                                                   |
| Residentes   | residente, dado_medico_residente                                     | Matrícula/vínculo, nascimento obrigatório em novos cadastros e edições, curso opcional na API local; legado sem nascimento legível. Dados médicos separados e profissionais. |
| Responsáveis | responsavel_legal, residente_responsavel                             | Vínculo ativo, telefone e autorização; seleção do destinatário conforme D15.                                                                                                 |
| Residência   | bloco, piso, quarto, vinculacao_quarto                               | Identificação e situação; capacidade/movimentação conforme D19, com paridade operacional gestor/supervisor.                                                                  |
| Chamada      | chamada_noturna, participacao_chamada                                | Unicidade por chamada/residente, data de referência e registro tardio.                                                                                                       |
| Saídas       | solicitacao_saida, evento_saida                                      | Tipo CURTA/LONGA, período, motivo, estado atual e histórico de decisões.                                                                                                     |
| Retorno      | retorno_curto                                                        | Um retorno por solicitação, supervisor, horário real e observação do atraso.                                                                                                 |
| Documentos   | documento, documento_versao                                          | Arquivo privado, tamanho, hash, tipo, versão do termo e vínculo ao objeto.                                                                                                   |
| Assinatura   | processo_assinatura, evidencia_assinatura                            | Provedor/envelope/documento, versão local e responsável correto.                                                                                                             |
| Mensagens    | envio_whatsapp, tentativa_envio                                      | Destinatário pré-cadastrado, identificação externa e tentativas auditáveis.                                                                                                  |
| Ocorrências  | ocorrencia, ocorrencia_residente                                     | Origem e residentes impactados; sem sanção automática.                                                                                                                       |
| Notificações | notificacao_analise, evento_notificacao                              | Origem, regra aplicada, estados e decisões humanas.                                                                                                                          |
| Advertências | advertencia                                                          | Justificativa, gravidade, supervisor e vínculo à análise quando houver.                                                                                                      |
| Comunicação  | aviso, destinatario_aviso, leitura_comunicacao, ciencia_comunicacao  | Destinatário controlado; ciência única por pessoa/item.                                                                                                                      |
| Compromissos | termo_compromisso, termo_ocorrencia, evidencia_termo                 | Residente, ocorrências, documento e procedimento homologado da AE.                                                                                                           |
| Limpeza      | avaliacao_limpeza, item_avaliacao                                    | Quarto, valores, versão da regra e histórico de alteração.                                                                                                                   |
| Regras       | configuracao_regra, versao_regra                                     | Parâmetros aprovados e vigência; sem valores disciplinares fictícios.                                                                                                        |
| Operação     | tarefa_integracao, evento_recebido, exportacao                       | Persistência, desduplicação, prazo técnico de processamento e resultado.                                                                                                     |
| Auditoria    | evento_auditoria                                                     | Autor, origem, objeto, ação, horário e correlação.                                                                                                                           |
| Sessões      | Tabelas Spring Session JDBC                                          | Schema da versão da biblioteca gerido por migração e acesso restrito.                                                                                                        |

Não persistir um ranking independente editável. A classificação deve ser derivada das avaliações e da regra homologada, por consulta ou cálculo no servidor. Um resultado materializado só será adicionado depois de medir necessidade; nunca terá fonte de dados divergente das avaliações.

## 7.3 Restrições e índices

**[T]** Garantir no banco retorno previsto posterior à saída; para CURTA, intervalo máximo de três horas. Usar unicidade em retorno por saída, ciência por pessoa/item e identificação de evento externo por provedor/chave. A conversão de notificação deve impedir duas advertências para o mesmo ato de conversão. O cadastro manual não valida idade restrita a 16–17 anos. Novos residentes e atualizações exigem data de nascimento; registros legados com `NULL` continuam consultáveis até edição.

Indexar filtros reais: residente/data de saída, status/data prevista, quarto/data de avaliação, notificação/status/data e tarefa/status/próxima execução. Verificar planos de consultas lentas e paginação. Não criar índices em todo campo indiscriminadamente, nem usar cascata de exclusão que apague o histórico de um residente.

A regra de chamada única por dia/bloco e os limites de alocação em quarto dependem de D09/D19. A estrutura permite representar esses conceitos, mas não presume que já estejam aprovados.

**[U] Fonte de capacidades em 30/09/2026:** quando ZIP/planilha detalhada e PDF divergem, a capacidade detalhada do ZIP prevalece: Residência 4, 66 em lugar de 64; Laticínio, 10 em lugar de 8. O PDF complementa inventário ausente no ZIP parcial. Não inferir os quartos ausentes da Residência 3 nem a distribuição de Zootecnia 3; não aumentar R4-21 de quatro para cinco pela ocupação registrada. Os 300 lugares do PDF são capacidade total. Os anexos não fornecem cadastro apto para importar estudantes reais. D19 e homologação pela AE seguem pendentes.

## 7.4 Arquivos e armazenamento

**[T]** Armazenar PDFs e arquivos assinados em volume privado persistente, separado do volume do banco e fora da raiz pública do Nginx. O banco guarda metadados e referências, não arquivos base64 em cada registro. Downloads passam pelo backend, com vínculo/permissão, nome seguro e Cache-Control adequado a conteúdo privado.

Cada versão de documento tem chave opaca, tamanho, hash SHA-256 e estado de armazenamento. Gravar em arquivo temporário, validar, mover para destino final e confirmar metadados; falhas intermediárias devem poder ser reconciliadas. Uma assinatura só libera aprovação quando o arquivo assinado e suas evidências estiverem confirmados como armazenados.

Manter versões imutáveis. O PDF assinado pode ter hash diferente do PDF original; a correspondência deve usar IDs do provedor, versão e evidências, não exigir igualdade dos dois hashes. Não recomprimir ou reescrever o arquivo assinado após recebimento.

**[P]** Limite inicial de 10 MiB para documentos recebidos, configurável após validar amostras reais. Validar tipo efetivo, tamanho e nome; não confiar apenas na extensão. A inclusão de upload de termo pronto depende do procedimento RN10. Volume local é a escolha inicial; uma interface ArquivoStorage permite migração posterior para armazenamento institucional sem refazer o domínio.

<!-- pagebreak -->

# 8. Saída longa, WhatsApp e assinatura

## 8.1 Fornecedores e fronteiras

**[T]** Meta WhatsApp Cloud API para envio oficial e Clicksign API 3.0 como integração de assinatura de referência, por adaptadores separados. A Clicksign dispõe de envelopes e webhooks; os contratos devem usar a versão 3.0 escolhida, sem copiar endpoints legados de versões anteriores. [T16–T17]

**[A]** Antes de ativar a integração, a instituição deve aprovar provedor, método de autenticação do responsável, modalidade de assinatura, modelos, expiração e custos. A SRS também diz não depender de licenças comerciais externas: essa restrição precisa ser conciliada com os serviços obrigatórios. O núcleo não exigirá uma biblioteca paga, mas isso não torna WhatsApp e assinatura gratuitos. Se a instituição já tiver outro serviço aprovado, substituir apenas o adaptador de assinatura.

**[T]** Manter o envio do WhatsApp sob responsabilidade do SAGER. Não ativar notificações automáticas adicionais do provedor de assinatura sem necessidade, para evitar duplicidade de mensagens e destinatários divergentes.

## 8.2 Fluxo de processamento

Ao confirmar a saída longa, o backend valida residente, responsável e período; grava solicitação, versão de dados e tarefa de preparação na mesma transação. A resposta informa que a solicitação foi registrada e que a integração está pendente. Não informa que a mensagem foi entregue sem confirmação.

A tarefa gera o PDF, registra o documento, prepara envelope/documento/signatário e requisitos de autenticação no provedor e obtém o acesso individual de assinatura. O backend registra os identificadores externos para retomar um passo interrompido, sem criar novo envelope a cada tentativa.

O adaptador de WhatsApp envia o modelo aprovado ao número pré-cadastrado. A mensagem usa o mínimo de dados necessário; conteúdo médico não é enviado. Registro de envio, entrega ou leitura não permite aprovar a saída. Esses requisitos vêm da SRS, RN03–RNF-WA05, pp. 50 e 54–55.

O webhook de assinatura é autenticado e registrado. A tarefa consulta o estado pela API autenticada do provedor, confirma o signatário e a versão corretos, obtém documento assinado/evidências e confirma seu armazenamento. Somente então registra “Assinada” e “Aguardando aprovação”. A aprovação continua sendo ação do supervisor no modal.

## 8.3 Validação do retorno externo

**[T]** Validar a autenticidade do webhook sobre o corpo original, antes de interpretar o JSON. A documentação de assinatura descreve HMAC; os detalhes de cabeçalho e configuração devem ser os da versão/conta adotada e verificados no teste de integração, pois páginas legadas usam formatos diferentes. Não aceitar somente um parâmetro status=assinado enviado por um cliente. [T16–T17]

Verificar também: ambiente correto, provedor correto, envelope/documento esperado, versão vigente e se o signatário é um responsável ativo, autorizado e vinculado ao residente. **[U] Uma assinatura válida desse conjunto basta**; não exigir assinatura simultânea de todos os responsáveis. A prova de identidade, vínculo, autorização e telefone segue D15 e os requisitos da integração. Persistir o evento para processamento idempotente. Após persistência durável, responder o recebimento conforme contrato do provedor; falha ao gravar não deve ser reconhecida como sucesso.

A consulta autenticada à API confirma o estado; não substitui a verificação do webhook. Payload desconhecido, ambiente trocado ou evento de documento não vinculado deve ser rejeitado ou isolado para análise, nunca aplicado a uma solicitação por aproximação de nome/telefone.

## 8.4 Edição, falhas e contingência

Ao editar conteúdo relevante de saída longa pendente, criar nova versão e desativar a associação de assinatura antiga. Solicitar cancelamento/invalidação do processo anterior ao provedor quando suportado e manter o histórico. Mesmo que o provedor demore, o servidor bloqueia qualquer callback da versão anterior para fins da solicitação alterada.

Falha no envio mantém o status funcional correspondente. Falha de download/armazenamento deixa assinatura em processamento/erro técnico e aprovação bloqueada. Não mapear todo problema de assinatura para “Falha no envio”: estado de solicitação, estado de assinatura e estado de mensagem são dimensões distintas.

Expirar um link não equivale, por si só, a cancelar automaticamente a solicitação de saída. Recusa de assinatura também não pode ser convertida em rejeição do supervisor sem regra homologada. O painel permite providência, contato alternativo autorizado e reenvio conforme SRS, sem dispensar a assinatura obrigatória.

**Limite desta revisão:** a documentação pública de Meta Cloud API não pôde ser aberta com sucesso na consulta. A obrigação da integração e os comportamentos descritos acima estão fundamentados na SRS; a versão Graph API, payload do template e verificação dos webhooks Meta devem ser conferidos na documentação acessível à conta antes da implementação. Não foram inventados endpoints versionados ou preços da Meta.

<!-- pagebreak -->

# 9. Tarefas, retentativas e concorrência

## 9.1 Fila persistente no PostgreSQL

**[T]** Usar uma tabela tarefa_integracao, processada pelo agendador Spring dentro da aplicação. O agendador apenas dispara a rotina; a tabela é que permite recuperar tarefas após reinício. Não depender de @Async, eventos em memória ou thread local como único registro de trabalho pendente. Spring fornece execução/agendamento; a durabilidade descrita aqui é uma implementação do SAGER, não uma garantia automática do framework. [T21]

Cada tarefa registra ID, tipo, objeto/versão, chave de idempotência, estado, tentativas, próxima execução, lease de processamento, último erro resumido e referências de resultado. Estados técnicos: PENDENTE, PROCESSANDO, CONCLUIDA e FALHA_FINAL; próxima execução representa a espera de retentativa. Esses estados não substituem os rótulos de negócio da solicitação.

O processo seleciona tarefas elegíveis em transação curta, com bloqueio de linha e lease, confirma a reserva e executa a chamada externa fora da transação. Depois grava o resultado. Lease vencido permite recuperação após queda. Para lotes e eventual segundo processo, usar seleção com bloqueio que ignore linhas já tomadas; não manter transação aberta durante HTTP.

## 9.2 Padrão outbox e idempotência

**[T]** Gravar alteração de negócio, evento de auditoria e intenção de processamento na mesma transação PostgreSQL. Isso evita uma solicitação existir sem o trabalho de integração correspondente. O receptor também persiste evento externo com chave de desduplicação antes de causar efeitos.

Não prometer “envio externo exatamente uma vez”. Se a conexão cair após o fornecedor aceitar a mensagem, pode haver resultado ambíguo. Quando existir idempotência ou consulta no fornecedor, reutilizar chave/identificador. Caso não exista forma confiável de reconciliar, sinalizar estado incerto para análise antes de reenviar indiscriminadamente. Os efeitos locais, como retorno, ciência e liberação por assinatura, precisam permanecer idempotentes.

## 9.3 Parâmetros técnicos iniciais

**[T]** Ponto de partida ajustável: uma tarefa externa por vez; varredura a cada 5 segundos; conexão HTTP até 5 segundos e leitura até 20 segundos; lease inicial de 120 segundos com renovação para etapas que excedam esse tempo. Testar o consumo na VPS antes de ampliar concorrência.

**[P]** Para falhas transitórias inequívocas, iniciar com três retentativas após a tentativa inicial, aproximadamente em 30 segundos, 2 minutos e 10 minutos, com variação aleatória e respeito ao Retry-After quando houver. Erro de credencial, telefone inválido e configuração ausente não devem ser repetidos indefinidamente. Envios de resultado incerto seguem reconciliação, não essa retentativa cega.

A quantidade de reenvios manuais de mensagem ao responsável, a expiração de link e o horário limite de envio são políticas operacionais que ainda dependem da AE/TI. Defaults de rede não constituem permissão para contatar repetidamente a família.

## 9.4 Concorrência nas ações do usuário

Confirmações usam transação, verificação de estado e @Version. A unicidade de retorno por saída e ciência por pessoa/item protege contra clique repetido. Uma advertência gerada por conversão deve consumir a notificação numa única decisão, impedindo conversões paralelas.

A aprovação longa deve bloquear/revalidar a solicitação e a versão de documento na mesma unidade de decisão. Um botão habilitado na tela antiga não permite aprovar versão nova ainda sem assinatura. O modal é um requisito de interface; no servidor, as regras e o controle de versão continuam obrigatórios independentemente dele.

<!-- pagebreak -->

# 10. Relatórios, PDFs e planilhas

## 10.1 PDF e XLSX

**[T]** Apache PDFBox 3 para PDFs de autorização, termos quando houver modelo homologado e relatórios. Usar um módulo pequeno de layout para cabeçalhos, texto, tabelas e paginação, com testes de texto e revisão visual. PDFBox permite gerar/manipular PDF em Java e tem licença Apache 2.0. A escolha evita adicionar navegador headless ao servidor de 2 GB; exige implementar o layout dos modelos. [T18]

Apache POI gera XLSX. Para exportações maiores, usar escrita em fluxo e controlar arquivos temporários; liberar recursos ao concluir ou falhar. Células vindas de texto do usuário devem ser gravadas como texto, não convertidas em fórmulas. A exportação contém todos os resultados filtrados autorizados, não somente a página visível. [T19]

Modelos devem identificar tipo de documento, período/filtros e data da geração. Documentos assinados são armazenados exatamente como recebidos, sem regeneração local. Gerar um PDF ou desenhar uma assinatura não satisfaz a exigência de assinatura eletrônica do responsável.

## 10.2 Consultas e processamento

**[T]** Uma definição de filtros no backend atende prévia, agregações e exportações. Aplicar a mesma autorização por papel/registro em todas as saídas. Relatórios com dados médicos exigem permissão específica. Downloads de exportações também verificam permissão vigente; possuir o ID do arquivo não basta.

Gravação de uma solicitação de exportação pode retornar um identificador e ser processada em tarefa persistente. O frontend mostra preparação, sucesso ou falha e mantém os botões PDF/Excel visíveis. Esse estado assíncrono não altera os requisitos de conteúdo nem comprova automaticamente o limite de 2 segundos para relatório completo.

**[T]** Para consistência, registrar filtros e instante de referência da exportação. Caso dados mudem enquanto o arquivo é gerado, documentar no arquivo a referência utilizada e aplicar leitura coerente. A definição da coluna e das agregações continua submetida ao catálogo homologado de relatórios.

## 10.3 Gráficos

**[T]** Chart.js em um componente Angular controlado, com criação/destruição da instância e dados fornecidos pela API. Incluir título acessível, resumo textual e tabela com os mesmos dados; o canvas, isoladamente, não oferece conteúdo acessível a leitores de tela. [T20]

Não calcular no navegador uma “nota de comportamento” que a AE não definiu. A API só retorna métricas reais e homologadas. Sem dados, exibir estado vazio. O relatório PDF pode apresentar tabelas/agregações equivalentes; a inclusão dos mesmos gráficos no arquivo deve seguir o modelo de relatório homologado, sem presumir que a captura da tela seja o documento final.

<!-- pagebreak -->

# 11. Segurança, auditoria e proteção operacional

## 11.1 Controles de aplicação

**[T]** Validar entradas no servidor, permitir apenas campos conhecidos no DTO e impedir alterações de perfil, autor ou estado por atribuição automática do JSON à entidade. Não usar concatenação de entrada em SQL. Restringir URLs de download de provedores a hosts permitidos e impedir que entradas do usuário acionem requisições arbitrárias do servidor.

Usar HTTPS, cabeçalhos de segurança, política de conteúdo compatível com Angular e restrição de enquadramento da aplicação. Não renderizar HTML livre de avisos/observações sem sanitização. Limitar requisições em autenticação, reenvio e endpoints externos sem impor limites que bloqueiem o fluxo legítimo da chamada.

Webhooks são exceções específicas à proteção CSRF, porque usam autenticação do provedor; não desabilitar CSRF globalmente. Dados sensíveis, tokens, cookies, credenciais e links individuais de assinatura não aparecem nos logs. Não disponibilizar arquivos privados por URL estática do Nginx.

## 11.2 Auditoria de negócio

**[T]** Registrar autor, origem, horário do servidor, ação, entidade/ID, versão e identificador de correlação. Para decisões de saída e alterações relevantes, registrar a auditoria na mesma transação que altera o domínio. Evitar copiar dados médicos completos para o log de alterações; guardar identificação do ato e somente o conteúdo necessário ao controle autorizado.

A trilha de auditoria é permanente por decisão do solicitante em 30/09/2026; a implementação dessa retenção ainda está pendente. Não deve ser editável pela interface nem por operações comuns do usuário de aplicação. Restringir UPDATE/DELETE no armazenamento de auditoria quando a modelagem permitir. Isso dificulta alterações indevidas, mas não torna o histórico inviolável contra um administrador de banco/servidor. A permanência da trilha não estende indefinidamente a retenção do conteúdo médico completo, documentos ou backups. Backup, permissões e governança seguem necessários.

Aviso lido, ciência explícita, assinatura e decisão de aprovação são eventos distintos. O uso do botão “Marcar como Ciente” não supre a assinatura da saída longa.

## 11.3 Segredos e dados armazenados

**[T]** Segredos em arquivos de configuração protegidos ou mecanismo institucional de segredos, montados apenas no serviço que precisa deles. Não versionar .env real, tokens ou dumps. Configurações públicas da interface não podem conter chaves privadas. Separar credenciais e dados dos ambientes.

Proteger o disco/volume que contém banco e documentos conforme a infraestrutura institucional e criptografar backups externos. Se o host existente não oferecer proteção em repouso, a TI deve definir o mecanismo antes do uso com dados médicos; não tratar uma senha do PostgreSQL como criptografia dos arquivos em disco.

A instituição define finalidade, retenção, descarte, responsáveis e modalidade de assinatura. A lista de bibliotecas e controles acima não comprova conformidade jurídica. Permanecem aplicáveis as exigências de proteção de dados da SRS, pp. 29, 47–49 e 50–55.

<!-- pagebreak -->

# 12. Implantação, recursos e recuperação

## 12.1 Ambiente de referência

**[T]** VPS Linux institucional com Docker Engine e Docker Compose. Manter a distribuição suportada já utilizada pela TI; para servidor novo, Ubuntu Server LTS homologado pela equipe é a referência. Não trocar o sistema operacional de um servidor existente como condição oculta do projeto.

Serviços permanentes: Nginx com o build Angular, aplicação Spring Boot e PostgreSQL. Volumes persistentes para dados do PostgreSQL e documentos, separados. Banco sem porta pública, backend acessível apenas por Nginx/rede administrativa. Certificado HTTPS emitido/renovado pelo processo institucional ou cliente ACME autorizado. Compose organiza os serviços, redes e volumes; não fornece alta disponibilidade automaticamente. [T22–T23]

O pipeline produz os artefatos fora da VPS. Não executar Angular CLI, Maven compilando o projeto, Testcontainers ou Playwright na máquina de produção de 2 GB. Fazer deploy de imagens identificadas por versão/commit e limitar logs/arquivos temporários.

## 12.2 Orçamento inicial de recursos

Os valores seguintes são **[T] pontos iniciais de configuração**, não dimensionamento comprovado nem garantia de capacidade.

| Item                      | Referência inicial                   | Validação necessária                                                           |
| ------------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| Heap Java                 | Xms 128 MiB e Xmx 512 MiB            | Medir memória total do processo, que também inclui memória fora do heap.       |
| Contêiner da aplicação    | Orçamento aproximado de até 850 MiB  | Medir pico com PDF, autenticação, JPA e tarefas.                               |
| PostgreSQL                | Orçamento inicial próximo de 400 MiB | Medir cache, conexões e consultas; não confundir limite com memória constante. |
| Pool JDBC                 | Iniciar com máximo de 5 conexões     | Medir espera; não manter conexão ocupada por chamadas externas.                |
| Processamento externo/PDF | Uma tarefa pesada por vez            | Verificar que chamada e decisões continuam responsivas.                        |
| Nginx, SO e Docker        | Reservar memória restante            | Medir pressão do host e evitar depender de swap para atender a meta.           |
| Disco                     | 50 GB previstos pela SRS             | Monitorar crescimento de arquivos, banco, logs, temporários e backups locais.  |

Realizar testes com carga representativa aprovada, incluindo o pico da chamada, filtros, exportação e tarefas externas. Medir tempo máximo, percentis, erros, CPU, memória e disco. O máximo de 2 segundos da SRS não pode ser substituído por p95 sem aprovação. A capacidade de 250 residentes também não determina 250 usuários simultâneos.

**[P]** Caso a carga medida não caiba, apresentar os resultados e solicitar revisão de recursos, como 4 GB de RAM/2 CPUs, sem declarar esse upgrade como requisito original nem reduzir silenciosamente funcionalidades.

## 12.3 Backup e recuperação

**[T]** O backup deve conter PostgreSQL, documentos privados e metadados necessários para relacionar as versões, além de configuração recuperável e procedimento de acesso aos segredos. Usar dump consistente do PostgreSQL e cópia de arquivos imutáveis, com verificação por manifesto/hash. Uma cópia apenas do banco não recupera os PDFs; volume Docker não substitui backup.

**[P]** Para o piloto, propor backup diário, retenção de 30 dias e cópia criptografada em destino institucional fora da VPS, sujeitos a aprovação de D22. Isso admite perda de até um dia entre cópias; a AE/TI deve aceitar esse objetivo ou exigir frequência/estratégia superior. Não apresentar o MTTR de 4 horas como se também definisse a perda aceitável de dados.

Para obter uma cópia coerente inicial, colocar a aplicação em manutenção e pausar o processador, gerar dump e manifesto, copiar os arquivos referenciados e verificar integridade antes de retomar. Uma estratégia posterior sem pausa deve provar que preserva a mesma coerência. Não realizar limpeza de versões durante a janela de cópia.

Testar restauração em ambiente isolado antes da produção e periodicamente: restaurar banco, arquivos e configurações; verificar login, registros, documentos e ligações de assinatura; registrar duração e ponto recuperado. Manter integrações de saída desativadas durante o ensaio, para não reenviar mensagens antigas. Ao recuperar produção, reconciliar tarefas e estado dos provedores antes de retomar envios.

## 12.4 Deploy e retorno de versão

**[T]** Antes do deploy, validar backup recuperável e migrações. Aplicar mudanças compatíveis com a versão anterior quando possível, subir a imagem identificada e executar smoke tests. O rollback de imagem só é válido se o schema continuar compatível. Reverter banco com restauração implica perda dos registros posteriores ao backup e exige decisão operacional; não automatizar essa ação como um simples botão de rollback.

Usar Actuator com endpoints restritos e estado de saúde sem detalhes sensíveis externamente. Monitorar erros, uso de disco, fila parada, falha de integração e validade do certificado. Aproveitar o monitoramento existente da TI; não instalar uma suíte pesada de observabilidade na VPS apenas para a primeira versão. [T28]

<!-- pagebreak -->

# 13. Testes e critérios técnicos de aceite

## 13.1 Estratégia

**[T]** Backend com JUnit Jupiter e Mockito para regras isoladas; integração Spring Boot/Testcontainers com PostgreSQL para transações, consultas, migrações e concorrência. Usar as versões geridas pelo Boot, sem fixar JUnit 5 quando a linha escolhida gerencia outra versão. [T24–T25]

Frontend com Vitest e utilitários de teste do Angular; a configuração atual do Angular CLI usa Vitest. Playwright executa jornadas completas de login, modais, abas, filtros e saídas, em navegador real. Acessibilidade exige verificações de foco/teclado e leitura, não apenas teste de renderização. [T03, T26]

Integrações externas começam com adaptadores simulados e passam por sandbox/ambiente de homologação real. Simulação não comprova identidade do signatário nem assinatura operacional. O login próprio também exige validação separada antes de implantação. Testar falhas, repetição, ordem invertida de webhooks e reinício no meio de cada etapa.

## 13.2 Critérios AT01–AT18

Estes critérios complementam AC01–AC72 do PRD; não renumeram nem substituem o aceite funcional.

| ID   | Evidência exigida                                                                                                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AT01 | Checkout limpo executa instalação/build com lockfile e wrappers; versões e comandos registrados no README.                                                                   |
| AT02 | Interface e API usam a mesma origem em produção; banco e porta interna não estão públicos; HTTPS verificado.                                                                 |
| AT03 | Login próprio por e-mail/senha validado para o ambiente de implantação; mock de autenticação impede inicialização em produção. SUAP/Google não são condição de aceite atual. |
| AT04 | APIs bloqueiam troca de ID para acessar outro residente, documento, comunicação ou dado médico sem permissão.                                                                |
| AT05 | Cookies, CSRF, renovação de token, logout e expiração funcionam; polling não mantém sessão indefinidamente.                                                                  |
| AT06 | Migrações constroem banco vazio e atualizam base anterior; produção não usa ddl-auto=update/create.                                                                          |
| AT07 | Regra de duração curta é validada no servidor e banco, além da interface; valores inválidos não persistem.                                                                   |
| AT08 | Ações concorrentes produzem conflito controlado, um único retorno e uma única ciência por item/pessoa.                                                                       |
| AT09 | Reinício após gravar uma solicitação preserva e retoma a tarefa de integração pendente.                                                                                      |
| AT10 | Webhook inválido não causa efeito; evento duplicado não duplica transições, documentos ou evidências.                                                                        |
| AT11 | Callback de versão anterior não libera saída editada; falha de armazenamento impede aprovação.                                                                               |
| AT12 | Resultado incerto de envio externo é reconciliado ou sinalizado; não há promessa falsa de envio exatamente uma vez.                                                          |
| AT13 | PDF/XLSX mantêm filtros e permissões; documentos privados não são obtidos por URL estática ou ID de terceiro.                                                                |
| AT14 | Gráficos refletem dados reais e oferecem alternativa textual; modais restauram foco e funcionam por teclado.                                                                 |
| AT15 | Logs, repositório e artefatos não contêm senhas, tokens, cookies, links privados ou dados médicos desnecessários.                                                            |
| AT16 | Carga homologada é medida na VPS prevista, preservando o máximo de resposta da SRS ou registrando não atendimento.                                                           |
| AT17 | Restauração isolada recupera banco e arquivos coerentes; relatório informa duração, ponto recuperado e pendências.                                                           |
| AT18 | Homologação integra as oito jornadas da seção 22 do PRD, manuais e regras institucionais bloqueantes resolvidas.                                                             |

## 13.3 Falhas que impedem a liberação

Impedem a liberação: aprovação longa sem assinatura/documento correto; exposição de dados de terceiros; sanção automática; perda ou duplicidade de retorno; autenticação de demonstração ativa; segredo exposto; migração sem teste; ausência de backup recuperável. Falhas em requisitos não funcionais devem ser registradas com evidência e submetidas à instituição, não ocultadas pela escolha de um percentil diferente.

<!-- pagebreak -->

# 14. Desenvolvimento e integração contínua

## 14.1 Ambiente da equipe

**[T]** Cada desenvolvedor utiliza JDK 21, Node 24 LTS, Git e Docker para o PostgreSQL local. Maven Wrapper fica no repositório. Angular CLI é uma dependência do projeto, evitando depender de uma versão global diferente. A equipe pode usar a IDE de sua preferência, desde que execute os mesmos comandos e testes.

Documentar preparação, variáveis obrigatórias e perfis local/teste/homologação/produção. Manter um arquivo de exemplo sem segredos e dados sintéticos suficientes para os três perfis. O perfil com mocks deve indicar claramente que a assinatura/identidade não é real.

**[T]** Java com convenções consistentes, nomes de domínio e documentação onde existe regra ou comportamento não óbvio. TypeScript estrito, ESLint e Prettier. Não usar comentários para repetir a linha de código. Manter DTOs, contratos e erros consistentes entre as equipes.

## 14.2 Pipeline

**[T]** GitHub Actions executa, em pull requests: instalação reproduzível, lint/formatação, testes Angular, testes Java, migrações contra PostgreSQL de teste e build. Antes de uma versão candidata, executar Playwright, testes de integração externa de homologação e verificar dependências/segredos. O fluxo de produção exige aprovação de quem a TI designar. [T27]

A seleção de GitHub Actions não transfere propriedade do código para conta pessoal nem torna o repositório público. A instituição define a organização proprietária, os acessos e onde os runners executam. Caso exista GitLab/CI institucional obrigatório, portar os mesmos comandos de build/teste, sem alterar a stack da aplicação.

Artefatos de build devem identificar commit, versões e dependências. Jobs que compilam e testam usam dados sintéticos; não enviar dump real de residentes ao runner. Credenciais de deploy só são disponibilizadas à etapa autorizada, nunca aos testes de código não confiável.

## 14.3 Definição de concluído por funcionalidade

**[T]** Uma funcionalidade precisa de tela, API, autorização no servidor, migração quando houver, testes de regra, tratamento de erro, auditoria pertinente e atualização do manual. O aceite deve apontar seu RF/UC/RN e AC correspondente. Não marcar um módulo como concluído apenas porque sua tela está navegável com mocks.

Para alterações de schema, incluir migração, teste de atualização e análise de rollback. Para mudanças de integração, incluir evento duplicado, falha transitória, resultado incerto e recuperação após reinício. Para alteração de relatório, comparar prévia, API e arquivo exportado.

<!-- pagebreak -->

# 15. Sequência de implementação

A sequência abaixo cobre o produto completo. Não fixa prazo nem reduz requisitos a um MVP menor. O número de etapas não pressupõe quantidade de sprints ou tamanho da equipe.

| Etapa                   | Trabalho principal                                                                                                                           | Critério de saída                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 0. Preparação           | Congelar stack; validar login próprio para implantação; validar API de assinatura e Meta; resolver pendências que bloqueiam o próximo módulo | Login SAGER de prova; contrato de versões; dependências e regras com responsáveis. |
| 1. Fundação             | Angular/Material, Spring Boot, banco/Flyway, sessões, perfis, auditoria, pipeline                                                            | Fluxo vertical de cadastro protegido com banco real e testes.                      |
| 2. Residência           | Residentes, responsáveis, supervisores, quartos e mapa                                                                                       | Cadastros homologados, vínculos/permissões e mapa coerente.                        |
| 3. Operação curta       | Chamada, solicitação curta, decisão, linha do tempo e retorno                                                                                | Limite de 3 horas, modais, atraso e concorrência validados.                        |
| 4. Saída longa          | Documento, adaptadores, tarefa persistente, WhatsApp, assinatura e recuperação                                                               | Jornada externa real e falhas homologadas, sem aprovação indevida.                 |
| 5. Acompanhamento       | Notificações, advertência manual, avisos, ciência e termos                                                                                   | Revisão humana preservada e procedimento RN10 aprovado.                            |
| 6. Limpeza e relatórios | Avaliação, ranking, feedback, filtros, gráficos e exportações                                                                                | Fórmulas aprovadas; consistência entre dados, tela e arquivos.                     |
| 7. Operação assistida   | Ajuda, testes de carga, backup/restore, segurança, treinamento e piloto                                                                      | AC01–AC72 e AT01–AT18 verificados; pendências bloqueantes encerradas.              |

**[T]** Desenvolver primeiro um fluxo pequeno de ponta a ponta e reutilizar o padrão. Evitar construir todas as telas com dados fictícios para só depois iniciar o backend. Contratos e exemplos de erro devem ser acordados quando cada funcionalidade começa.

**[A]** Integração com SUAP/Google não é bloqueio da fase atual. O login próprio requer validação antes de implantação real. Ausência de contratação da assinatura não impede desenvolver cadastros e regras independentes, mas impede declarar homologada a integração real ou liberar o fluxo de saída longa em produção.

<!-- pagebreak -->

# 16. Registro de decisões e pendências

## 16.1 Decisões técnicas consolidadas

| ID   | Decisão                                           | Motivo no contexto do SAGER                                                                                     |
| ---- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| DT01 | Angular + Java/Spring Boot                        | Determinação do solicitante.                                                                                    |
| DT02 | Angular Material, Reactive Forms e estado simples | Reutilizar componentes do ecossistema; evitar segunda biblioteca visual/estado global obrigatório.              |
| DT03 | Monólito modular Spring MVC                       | Uma aplicação para desenvolver, testar e implantar.                                                             |
| DT04 | PostgreSQL, JPA e Flyway                          | Modelo relacional e migrações versionadas para os vínculos da SRS.                                              |
| DT05 | Sessão JDBC e login próprio do SAGER              | Reutilizar o banco; autenticar por e-mail/senha na fase atual, sem criar servidor de tokens ou Redis adicional. |
| DT06 | Tarefas persistentes no PostgreSQL                | Retomar integrações após queda mantendo poucos serviços.                                                        |
| DT07 | PDFBox, POI e Chart.js                            | Geração Java de arquivos e gráficos no navegador, sem serviço PDF externo obrigatório.                          |
| DT08 | Documentos privados em volume local               | Implantação inicial simples; metadados/versionamento e backup coerente.                                         |
| DT09 | Docker Compose + Nginx                            | Três serviços permanentes e frontend estático.                                                                  |
| DT10 | Adaptador Clicksign de referência                 | Contrato de assinatura definido tecnicamente, ativação condicionada à instituição.                              |
| DT11 | Testes por camada e jornadas E2E                  | Verificar regras sensíveis e regressões nas integrações.                                                        |
| DT12 | Auditoria/transações/controle de versão           | Preservar decisões e impedir efeitos duplicados ou sobre estado desatualizado.                                  |

Estas decisões deixam de ser “stack a escolher”. Se forem alteradas, registrar motivo, impacto, dependências afetadas e testes de regressão. Uma troca de versão de manutenção não exige reescrever o PRD; uma mudança que afete regra, segurança ou operação exige revisar o documento correspondente.

## 16.2 Dependências que não podem ser presumidas

| Dependência                                                   | Encaminhamento                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Segurança e ciclo do login próprio                            | TI; D01/D21 do PRD. Validar provisionamento, recuperação, proteção contra abuso e implantação; SUAP/Google apenas em etapa futura.          |
| Assinatura, prova de identidade, fornecedor e custos          | Instituição/AE/TI; D16/D25. Validar acesso à API e evidências antes de produção.                                                            |
| Cadastro, janelas, início de saída, cancelamento e correções  | AE; D02–D09, D15 e D19. Nascimento obrigatório em novo/edição e curso opcional na API local; não restringir cadastro a 16–17 anos.          |
| Fórmulas de limpeza, comportamento, alertas e reincidência    | AE; D10–D14. Não preencher com números de exemplo.                                                                                          |
| Avisos, exportações e acesso a dados médicos                  | AE/TI; D01, D18 e D20. Acesso médico restrito a profissionais autorizados, mesmo com paridade operacional gestor/supervisor.                |
| Retenção, descarte, destino de backup e recuperação aceitável | Instituição/TI; D22/D23. Trilha de auditoria permanente decidida, implementação pendente; demais dados e backups exigem políticas próprias. |
| Carga e fronteira do limite de 2 segundos                     | TI/AE; D24. Medir na infraestrutura prevista, sem promessa antecipada.                                                                      |
| Diagramas de domínio antigos                                  | Atualizar após resolver as políticas que afetam cardinalidades/transições; D26.                                                             |

## 16.3 Entregáveis da equipe de implementação

**[T]** Código-fonte frontend/backend, migrações, testes, arquivos de implantação, lockfiles, contrato OpenAPI, lista de dependências/licenças, documentação de configuração, manual por perfil, roteiro de homologação, relatório de carga, procedimento de backup/restore e registro de decisões. A lista define o que deve ser produzido durante o desenvolvimento; não declara que esses itens já foram implementados nesta entrega documental.

<!-- pagebreak -->

# 17. Referências e limites da pesquisa

As páginas abaixo foram consultadas para verificar suporte, compatibilidade e recursos das tecnologias. São referências técnicas externas; as escolhas de arquitetura são decisões deste documento. A consulta é de 24/09/2026. Documentação online pode mudar: o projeto deve registrar as versões exatas e a documentação correspondente quando gerar seu primeiro build reproduzível.

**Fontes de produto:** SAGER_Corrigido(1).docx, SRS-SAGER-001 v2.1, especialmente requisitos funcionais (p. 7), UC revisados (pp. 10–31 e 52–55), interface (pp. 35–46), restrições (pp. 47–49) e regras RN01–RN10 (pp. 50–51); PRD completo v2.0; definição de Angular e Java/Spring Boot pelo solicitante nesta conversa.

| ID  | Documento oficial consultado                     | Endereço                                                                                        |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| T01 | Angular — Versioning and releases                | https://angular.dev/reference/releases                                                          |
| T02 | Angular — Version compatibility                  | https://angular.dev/reference/versions                                                          |
| T03 | Angular — Unit testing                           | https://angular.dev/guide/testing                                                               |
| T04 | Angular — Accessibility / Angular Material       | https://angular.dev/best-practices/a11y                                                         |
| T05 | Node.js — Releases                               | https://nodejs.org/en/about/previous-releases                                                   |
| T06 | Spring Boot — System Requirements                | https://docs.spring.io/spring-boot/system-requirements.html                                     |
| T07 | Eclipse Adoptium — Temurin Support               | https://adoptium.net/support/                                                                   |
| T08 | PostgreSQL — Versioning Policy                   | https://www.postgresql.org/support/versioning/                                                  |
| T09 | Spring Boot — Database Initialization            | https://docs.spring.io/spring-boot/how-to/data-initialization.html                              |
| T10 | Spring Security — OAuth2 Login                   | https://docs.spring.io/spring-security/reference/servlet/oauth2/login/core.html                 |
| T11 | Spring Security — LDAP Authentication            | https://docs.spring.io/spring-security/reference/servlet/authentication/passwords/ldap.html     |
| T12 | Spring Security — Session Management             | https://docs.spring.io/spring-security/reference/servlet/authentication/session-management.html |
| T13 | Spring Session — Boot JDBC                       | https://docs.spring.io/spring-session/reference/guides/boot-jdbc.html                           |
| T14 | Spring Security — CSRF                           | https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html                     |
| T15 | springdoc-openapi — integração e compatibilidade | https://springdoc.org/                                                                          |
| T16 | Clicksign — documentação da API                  | https://developers.clicksign.com/                                                               |
| T17 | Clicksign — API 3.0 Envelope                     | https://developers.clicksign.com/reference/comece-agora                                         |
| T18 | Apache PDFBox — Java PDF Library                 | https://pdfbox.apache.org/                                                                      |
| T19 | Apache POI — Spreadsheet guide                   | https://poi.apache.org/components/spreadsheet/how-to.html                                       |
| T20 | Chart.js — Accessibility                         | https://www.chartjs.org/docs/latest/general/accessibility.html                                  |
| T21 | Spring Framework — Task Execution and Scheduling | https://docs.spring.io/spring-framework/reference/integration/scheduling.html                   |
| T22 | Docker — Compose                                 | https://docs.docker.com/compose/                                                                |
| T23 | Nginx — Beginner's Guide                         | https://nginx.org/en/docs/beginners_guide.html                                                  |
| T24 | Spring Boot — Testing                            | https://docs.spring.io/spring-boot/reference/testing/                                           |
| T25 | Spring Boot — Testcontainers                     | https://docs.spring.io/spring-boot/reference/testing/testcontainers.html                        |
| T26 | Playwright — Installation                        | https://playwright.dev/docs/intro                                                               |
| T27 | GitHub Actions — Understanding GitHub Actions    | https://docs.github.com/en/actions/get-started/understand-github-actions                        |
| T28 | Spring Boot — Actuator Endpoints                 | https://docs.spring.io/spring-boot/reference/actuator/endpoints.html                            |
| T29 | Spring Security — SAML 2.0 Login                 | https://docs.spring.io/spring-security/reference/servlet/saml2/login/overview.html              |
| T30 | Angular — Reactive Forms                         | https://angular.dev/guide/forms/reactive-forms                                                  |
| T31 | Spring Framework — REST Clients                  | https://docs.spring.io/spring-framework/reference/integration/rest-clients.html                 |
| T32 | Angular — Signals                                | https://angular.dev/guide/signals                                                               |

**WhatsApp:** integração exigida pela SRS e mantida nesta arquitetura. A abertura da documentação pública da Meta falhou nesta revisão; não foram verificadas versão Graph API, tarifas ou payloads específicos. Esses pontos devem ser conferidos na conta/documentação oficial durante a etapa 0.

**Assinatura e licenciamento:** a referência Clicksign não comprova a adequação do método ao processo da AE nem resolve a restrição de custos/licenças da SRS. A aprovação institucional é condição de ativação. As bibliotecas e imagens efetivamente fixadas precisam de inventário de licenças, incluindo dependências transitivas e ferramentas de desenvolvimento.
