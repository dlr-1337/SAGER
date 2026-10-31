# Fase 2 — cadastros e mapa

O [roteiro](../ROADMAP_IMPLEMENTACAO.md) cobre residentes, responsáveis legais,
supervisores e quartos. As cinco fatias locais estão implementadas e
[verificadas](QA.md): supervisores; alojamentos, unidades e quartos; residentes;
responsáveis; e alocação com histórico. Os testes usam contas e dados sintéticos.
Até 30/10/2026, os cadastros funcionais não provisionavam contas de acesso; desde 31/10/2026, criar residente ou supervisor cria a conta vinculada na mesma transação. Há auditoria de suas
alterações pela V11 e vínculo explícito, feito pelo operador, entre contas e
cadastros pela V12. A sexta fatia implementa a [área de saúde](SAUDE_CONTRATO.md)
em recurso separado: habilitação e vínculo vigentes, notas privadas com partilha
explícita, histórico imutável, custódia e acesso próprio do paciente. **A Fase 2 completa
e sua homologação institucional ainda estão abertas.** O
[pacote AE/TI](PACOTE_AE_TI.md) reúne as regras locais, as decisões pendentes e
um formulário para registrar futura evidência institucional.

**Contrato atualizado em 30/09/2026:** o solicitante definiu o supervisor como
autoridade máxima na gestão, com as mesmas operações disponíveis ao gestor;
cadastro manual de residentes; nascimento obrigatório nas novas gravações;
uma assinatura de qualquer responsável cadastrado e vinculado para saída longa;
precedência das capacidades detalhadas do ZIP nos locais divergentes com maior
capacidade, complementadas pelo inventário do PDF onde o ZIP for parcial;
login próprio do SAGER; compartilhamento entre profissionais de saúde; e retenção
permanente dos registros de auditoria. Essas escolhas atualizam as regras de
projeto de 29/09/2026. O [QA](QA.md) identifica as verificações efetivamente
executadas; as respostas não são aceite formal da AE/TI.

## Primeira fatia: supervisores

- Desde 31/10/2026, só o gestor cadastra, consulta e edita supervisores; o servidor valida campos,
  mantém um ID estável e rejeita alterações com versão desatualizada.
- O cadastro fica no PostgreSQL. A demonstração pública mantém seus registros
  fictícios em memória, separada da API.
- As rotas de supervisores exigem sessão local, perfil de gestor e CSRF nas alterações.
  Fora do perfil `local`, o backend continua fechado.
- A identificação institucional, o e-mail e o nome são dados **sintéticos** para
  desenvolvimento. A migração V4 exige identificação única sem diferenciar
  maiúsculas/minúsculas; esse critério é provisório até a AE/TI aprovar o
  dicionário funcional.

O contrato local é `GET /api/v1/supervisores` para listar, `GET
/api/v1/supervisores/{id}` para consultar, `POST /api/v1/supervisores` para criar
e `PUT /api/v1/supervisores/{id}` para editar. O JSON expõe `id`, `name`,
`institutionalId`, `email` e `version`; o `PUT` exige a versão conhecida. Criação
retorna `201`; dados inválidos, ID inexistente, duplicidade e versão obsoleta
retornam respectivamente `400`, `404`, `409` e `409`. Todas as rotas exigem
perfil `gestor`; as mutações também exigem CSRF.

## Segunda fatia: alojamentos, unidades e quartos

**Estado em 29/09/2026: implementada, com aceite técnico local.** O plano aprovado
pelo solicitante foi integrado ao PostgreSQL e ao mapa Angular. O [QA](QA.md)
registra os testes e a prova pelo navegador, incluindo capacidades desconhecidas
e editadas, números locais iguais em localizações diferentes, conflito entre
duas abas sem sobrescrita, reinício com estrutura e sessão preservadas e logout.
O aceite é para desenvolvimento local; não equivale à homologação da AE/TI,
nem encerra E04 ou a Fase 2.

Esta seção registra o contrato da entrega estrutural. Ocupação e vagas livres
foram integradas depois, na quinta fatia; os valores `null` históricos abaixo
não representam o contrato atual desses dois campos.

- Alojamentos têm código e nome. Casas/blocos são unidades internas opcionais,
  vinculadas ao alojamento; quarto também pode ter piso, sem obrigá-lo.
- Quarto tem código globalmente único e número local como texto, preservando
  `01`. O número pode repetir em locais distintos, mas não na mesma combinação
  de alojamento, unidade opcional e piso opcional. Duplicidades desconsideram
  espaços nas extremidades e diferenças de maiúsculas/minúsculas; a ausência
  da unidade ou piso é tratada como a mesma localização ausente.
- Capacidade é editável, inteira positiva ou `null`. A interface mostra
  **“Capacidade não definida”** quando ausente e identifica somatórios com
  capacidades ausentes como parciais.
- Disponível, Ocupado, Manutenção e Indisponível são situações manuais. Na
  entrega estrutural, a API mantinha `occupancy`, `vacancies` e `cleaningScore`
  como `null`; a interface mostrava **“Ocupação ainda não integrada”** e
  **“Sem avaliação”**. A quinta fatia passou a contar vínculos ativos e a
  calcular vagas livres com capacidade conhecida. A nota de limpeza continua
  `null`, e a situação manual continua independente da ocupação.
- O mapa local começa vazio, agrupado por alojamento, unidade opcional e piso
  conhecido. A demonstração permanece independente do backend, com dados
  fictícios em memória. Falha da API local não carrega registros demonstrativos.
- Gestor e supervisor locais consultam, cadastram e editam a estrutura.
  Sessão, CSRF nas alterações e bloqueio fora de `local` são mantidos.
  A edição exige `version`; conflito deve ser apresentado sem sucesso falso.
  Exclusão permanece fora do escopo; alocação e transferência foram integradas
  na quinta fatia.

### Contrato local de estrutura

| Recurso               | Rotas                                                                                              | Campos expostos                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Alojamento            | `GET/POST /api/v1/alojamentos`; `GET/PUT /api/v1/alojamentos/{id}`                                 | `id`, `code`, `name`, `version`                                                                                                             |
| Unidade de alojamento | `GET/POST /api/v1/alojamentos/{id}/unidades`; `GET/PUT /api/v1/alojamentos/{id}/unidades/{unitId}` | `id`, `accommodationId`, `code`, `name`, `version`                                                                                          |
| Quarto                | `GET/POST /api/v1/quartos`; `GET/PUT /api/v1/quartos/{id}`                                         | `id`, `code`, `number`, `accommodationId`, `unitId`, `floor`, `capacity`, `situation`, `occupancy`, `vacancies`, `cleaningScore`, `version` |
| Mapa                  | `GET /api/v1/quartos/mapa`                                                                         | Coleções de alojamentos, unidades e quartos, inclusive estruturas sem quartos                                                               |

`unitId`, `floor` e `capacity` podem ser `null`; na entrega estrutural,
ocupação, vagas livres e nota eram sempre `null`. No contrato atual, ocupação
é a contagem dos vínculos ativos, vagas livres dependem de capacidade conhecida
e somente a nota continua sem integração. O servidor rejeita unidade de outro alojamento,
dados inválidos, duplicidade, ID inexistente e edição com versão obsoleta.
A edição exige a versão do recurso consultado; uma falha não produz confirmação
de gravação. As migrações V1–V4 são preservadas como histórico; V5 cria alojamentos
e unidades, e V6 cria quartos, com JDBC, UUID, versão e timestamps. A versão
inicial é `0` e aumenta após cada edição confirmada. Os campos textuais exigem
strings JSON; números e booleanos não são convertidos silenciosamente em texto.
O mapa é lido em uma transação com snapshot consistente.

Criação retorna `201`; leitura e edição retornam `200`. Erros de domínio expõem
`code`, `message` e `requestId`: `400/invalid_input` para dados inválidos,
`400/invalid_location` para vínculo recusado, `404/not_found` para ID inexistente,
`409/duplicate_code` para código repetido, `409/duplicate_location` para número
de quarto repetido na mesma localização e `409/stale_version` para versão
obsoleta. Sessão inválida retorna `401`; perfil sem permissão ou CSRF ausente
retorna `403`. Esses erros são apresentados sem carregar dados de demonstração
no fluxo local.

O mesmo contrato de erro se aplica às demais fatias integradas e à segurança:
`401/unauthorized` para sessão ausente ou inválida, `401/invalid_credentials`
no login recusado, `403/forbidden` para perfil sem permissão e
`403/csrf_invalid` para CSRF ausente ou inválido. O servidor gera o UUID de
correlação e o retorna também em `X-Request-Id`, sem expor SQL, stack trace ou
valores dos campos enviados. O
[contrato da fundação](../fase-1/FUNDACAO.md) descreve a padronização, o OpenAPI
autenticado e a observabilidade locais.

## Terceira fatia: cadastro local de residentes

**Estado: implementada, com aceite técnico local.** Esta seção descreve a
entrega cadastral; quarto atual e histórico de alocações foram acrescentados
na quinta fatia.

O cadastro é manual pelo gestor, conforme decisão de 30/09/2026; o supervisor
também pode consultar, cadastrar e editar. A integração com SUAP está adiada
porque não há autorização. A matrícula identifica o registro do estudante, mas
não é obtida do login. Comprovação dos campos, responsável pela conferência e
ciclo do cadastro continuam por detalhar na [D02](../fase-0/DECISOES.md).
Desde 31/10/2026, o cadastro cria a conta de login vinculada, com a senha informada, na mesma transação.

O contrato oferece `GET/POST /api/v1/residentes` e
`GET/PUT /api/v1/residentes/{id}`. Cada resposta inclui `id` (UUID), `name`,
`enrollment`, `birthDate`, `course` e `version`. O banco mantém também as
datas de criação e alteração. Nome, matrícula e nascimento são obrigatórios em
criação e edição. A matrícula é
única sem diferenciar maiúsculas/minúsculas depois de retirar espaços das pontas;
não há regra provisória para quantidade de dígitos ou composição. Curso pode
ser `null`; nascimento deve ser uma data válida e não futura.
O `PUT` exige a versão conhecida. Entrada inválida retorna `400`, matrícula
duplicada ou versão obsoleta retornam `409`, e ID ausente retorna `404`.
Sessão local e CSRF protegem as alterações; fora do perfil `local`, a API
permanece fechada.

Lista, formulário e detalhe no acesso local consultam a API e não recorrem
a dados da demonstração quando ela falha. Campos opcionais ausentes aparecem
como “Não informado”. Idade e situação não são inferidas. Na entrega cadastral,
quarto e histórico de alocações ainda não estavam integrados; agora são obtidos
dos vínculos persistidos da quinta fatia. Histórico de chamadas e saídas e termos
continuam sem integração. O vínculo de responsáveis é tratado na quarta
fatia abaixo. A demonstração pública continua
com seus próprios registros fictícios em memória. A migração V7 preserva V1–V6
e não cria vínculos com quartos, responsáveis ou dados de saúde. Na regra anterior,
nascimento era opcional. A atualização preserva os registros legados sem data,
sem inventar valores; novas gravações, inclusive a edição desses registros,
exigem nascimento. A migração V10 acrescenta `CHECK (birth_date IS NOT NULL)
NOT VALID`, que conserva linhas legadas e verifica novas inserções e atualizações.
Nascimento legado ausente não comprova maioridade para fluxos futuros.

## Quarta fatia: cadastro local de responsáveis

**Estado: implementada, com aceite técnico local.**

Gestor e supervisor locais cadastram e editam nome, vínculo declarado, telefone e
estado ativo de responsáveis associados a residentes persistidos. Cada registro
tem UUID e versão próprios; um residente pode ter vários responsáveis, sem um
limite ou uma ordem presumidos. A migração V8 cria os registros e a chave
estrangeira para residentes sem alterar V1–V7. O estado ativo é cadastral: não
comprova guarda, autorização para saída ou validade de assinatura.

O contrato oferece `GET/POST /api/v1/responsaveis` e
`GET/PUT /api/v1/responsaveis/{id}`. O JSON expõe `id`, `residentId`, `name`,
`relationship`, `phone`, `active` e `version`. Desde 31/10/2026, telefone é
obrigatório em novo cadastro e em valor alterado; registro antigo pode ter `null` e continua passando na edição. A edição exige a versão consultada.
Entrada inválida retorna `400/invalid_input`, residente ausente no vínculo
retorna `422/invalid_reference`, responsável ausente retorna `404/not_found` e
versão obsoleta retorna `409/stale_version`. Gestor e supervisor locais podem
consultar e gravar. Sessão, CSRF e bloqueio fora de `local` permanecem.

Lista, formulário, detalhe e vínculo no detalhe do residente consultam a API
no acesso local. A demonstração mantém seus próprios registros fictícios em
memória; uma falha da API local não os apresenta como dados persistidos.
Em 30/09/2026, o solicitante definiu que uma assinatura válida de qualquer
responsável cadastrado e vinculado ao residente é suficiente para saída longa,
sem exigir ambos. Comprovação do vínculo e da identidade, seleção do destinatário,
tratamento de divergências e serviço/modalidade de assinatura continuam por
detalhar na [D15](../fase-0/DECISOES.md) e na D16. Nenhum envio ou
decisão de saída longa é ativado por esta fatia.

**Decisão de 31/10/2026, que substitui a definição acima:** a aprovação de saída longa
exige autorização conferida por servidor, de qualquer responsável vinculado, na revisão
atual do documento. Não há provedor de assinatura, e o SAGER não promete a validade da
autorização.

## Quinta fatia: alocação local e histórico de quartos

**Estado: implementada, com aceite técnico local.** O [QA](QA.md) registra
alocação, transferência, encerramento, limites de capacidade, permissões,
concorrência e persistência após reinício com PostgreSQL e dados sintéticos.

A migração V9 guarda cada vínculo entre residente e quarto, com início,
encerramento, motivo do encerramento (`TRANSFER` ou `END`) e versão. O banco
impede mais de um vínculo ativo para o mesmo residente. Alocar, transferir e
encerrar preservam as linhas históricas; não há exclusão nesta fatia.

`GET /api/v1/alocacoes?residentId={id}` consulta o histórico do residente;
`GET /api/v1/alocacoes?roomId={id}&active=true` consulta ocupantes atuais,
`active=false` consulta vínculos encerrados e a ausência do filtro traz ambos.
`GET /api/v1/alocacoes/{id}` consulta um vínculo específico.
`POST /api/v1/alocacoes` cria um vínculo com `residentId` e `roomId`;
`POST /api/v1/alocacoes/{id}/transferir` recebe `roomId` de destino e
`version`; `POST /api/v1/alocacoes/{id}/encerrar` recebe `version`. A
transferência encerra o vínculo anterior e cria o novo na mesma transação.
Gestor e supervisor locais consultam e movimentam residentes.
Sessão, CSRF, versão e bloqueio fora de `local` continuam obrigatórios.
Entrada inválida, referência ausente, conflito de versão, lotação e situação
indisponível têm respostas distintas; a edição de quarto retorna conflito se
a nova capacidade não comportar os vínculos ativos.

Esta é uma **regra técnica provisória de desenvolvimento**, autorizada em
29/09/2026: cada residente ocupa no máximo um quarto ativo. Uma nova entrada
exige capacidade definida e vaga, e é recusada em Manutenção ou Indisponível.
Uma edição não pode reduzir a capacidade abaixo da ocupação ativa nem apagá-la
enquanto houver ocupantes. A situação Disponível/Ocupado continua manual,
independente da contagem. Ocupação é o número de vínculos ativos, inclusive
zero; vagas livres são `capacidade - ocupação` somente quando a capacidade é
conhecida. Nota de limpeza permanece sem avaliação. O acesso local mostra
quarto atual, histórico e ocupantes; a demonstração conserva os dados próprios
em memória e não substitui uma resposta com falha da API.

Reservas, exceções para dados históricos divergentes, correção de vínculos,
capacidades oficiais e transições automáticas continuam pendentes da
[D19](../fase-0/DECISOES.md) e da AE. O aceite técnico desta fatia não
homologa a Fase 2.

## Auditoria local dos cadastros — V11

Criações e edições de supervisores, residentes, responsáveis, alojamentos,
unidades e quartos, além das criações e encerramentos de alocações, geram
eventos na mesma transação da alteração. Se o registro de auditoria falhar, a
gravação do cadastro é revertida. Uma transferência gera dois eventos, `END`
para o vínculo anterior e `CREATE` para o novo, com o mesmo `requestId`.
Requisições recusadas por validação, conflito, permissão ou CSRF não geram
eventos de alteração. Não há preenchimento retroativo para cadastros anteriores
à V11.

Cada evento expõe `sequence`, `id`, `occurredAt`, `actorId`, `actorProfile`,
`origin`, `requestId`, `resource`, `resourceId`, `action`, `resultingVersion` e
`changedFields`. A autoria usa o UUID da conta, e a origem é `LOCAL_API`.
`changedFields` contém apenas nomes de campos autorizados; valores anteriores
ou novos, cópias do cadastro, nomes, e-mails, telefones, senhas e tokens não são
armazenados no evento. Os UUIDs ainda são metadados de acesso restrito.

`GET /api/v1/auditoria` exige sessão local de gestor ou supervisor. A consulta
aceita filtros opcionais `resourceId`, `actorId`, `requestId` e `resource`, além
de `limit` de `1` a `100` (padrão `50`). A resposta contém `items` em ordem
decrescente de `sequence` e `nextCursor`; para continuar, envie o cursor como
`beforeSequence`. Não há rotas de edição ou exclusão de eventos.

A migração V11 bloqueia `UPDATE`, `DELETE` e `TRUNCATE` por triggers e revoga
essas permissões de `PUBLIC`. Eventos não têm chaves estrangeiras para contas
ou cadastros, evitando remoção em cascata. A retenção permanente foi decidida
para esses registros; ela não se estende automaticamente aos demais dados.
A configuração local padrão ainda não separa as roles de migrações e aplicação.
Owner ou superusuário podem alterar essas proteções; separação de roles,
backup e controles operacionais de retenção ainda precisam ser implementados
e verificados no ambiente de produção.

## Vínculo entre conta local e cadastro — V12

O operador pode associar uma conta ativa já provisionada a um residente existente
(`link-resident`, perfil `residente`) ou supervisor existente
(`link-supervisor`, perfil `gestor` ou `supervisor`). Cada conta possui no máximo
um vínculo, de um desses tipos, e cada registro pode ser associado a somente
uma conta. O vínculo usa o UUID do registro: não é inferido de nome, e-mail ou
matrícula, não cria credenciais e não altera o perfil da conta.

O comando `unlink` exige o UUID do vínculo atual e pode liberar o registro de
uma conta desativada sem reativá-la. Alterar ou remover o vínculo revoga as
sessões existentes; uma sessão com IDs antigos é recusada. Repetir o mesmo
vínculo não revoga sessões. Contas anteriores à migração continuam sem vínculo
e podem fazer login local. O
[guia do backend](../../backend/README.md) apresenta os comandos completos;
não existem rotas HTTP de provisionamento ou de vínculo de contas.

`GET /api/v1/auth/me` retorna o `id` da conta e os UUIDs opcionais
`residenteId` e `supervisorId`, além de `nome`, `email`, `fotoUrl` e `perfis`.
Um cadastro sem conta e uma conta sem vínculo continuam sendo situações válidas
no desenvolvimento local. A associação não implementa as futuras operações
por registro nem concede ao residente acesso às APIs de gestão.

## Referências recebidas e divergências abertas

Em 29/09/2026 foram recebidos o PDF
`Controle de Vagas das Residências Estudantis 2026.xlsx - Vagas Residências Est. 2026.pdf`
e o ZIP `RESIDÊNCIAS ESTUDANTIS 2026_1.xlsx.zip`. Apesar do nome, o ZIP contém
sete abas em HTML, sem XLSX. São referências privadas de estrutura e ocupação
parcial, não dados de carga do sistema. O solicitante confirmou que as **300
vagas do PDF são capacidade total**, não vagas livres.

| Referência   | PDF                           | ZIP                                            |
| ------------ | ----------------------------- | ---------------------------------------------- |
| Residência 4 | 64 lugares                    | Capacidades somam 66                           |
| Laticínio    | 8 lugares                     | Capacidades somam 10                           |
| Residência 3 | 12 quartos                    | 5 quartos listados                             |
| R4-21        | —                             | 5 ocupantes listados; capacidade indicada de 4 |
| Zootecnia 3  | 3 quartos × 2, mas total de 8 | —                                              |

Em 30/09/2026, o solicitante reiterou a orientação de usar o documento com maior
capacidade dos quartos. O ZIP/planilha detalhada traz as maiores capacidades
nos locais divergentes: Residência 4, 66; Laticínio, 10. As capacidades detalhadas
do ZIP prevalecem nesses casos como referência de projeto; o PDF complementa
o inventário ausente no ZIP parcial. Essa escolha não distribui os 300 lugares
por quarto, não inventa os quartos faltantes de Residência 3 nem a distribuição
de Zootecnia 3 e não aumenta a capacidade de R4-21 pelo número de ocupantes.
As cinco diferenças permanecem registradas para conferência e homologação da AE,
sem importar ocupantes reais.

Os arquivos não trazem matrícula, nascimento,
responsáveis legais ou telefones e não resolvem cadastro de residentes,
destinatários de assinatura ou acesso a dados de saúde. Os testes usam somente
dados sintéticos; nomes e dados pessoais dos anexos não entram no Git.

## Decisões para homologação

As respostas de 30/09/2026 definem as escolhas de projeto de
[D01, D02, D15, D19, D21 e D22](../fase-0/DECISOES.md). Restam detalhes concretos:
provisionamento e revisão de perfis; conferência dos campos cadastrais e ciclo
do vínculo; comprovação dos responsáveis e escolha do destinatário; revisão das
divergências do inventário (D19); operação institucional do login próprio;
categorias e limites do compartilhamento entre profissionais de saúde; e
retenção/descarte dos dados que não sejam registros de auditoria e política
de backup. O [pacote AE/TI](PACOTE_AE_TI.md) registra as respostas e as lacunas.
Não há manifestação formal nem homologação institucional registrada.

O acesso a dados sensíveis continua restrito a profissionais de saúde, conforme
orientação de 26/09/2026, com compartilhamento permitido entre esses profissionais
por decisão de 30/09/2026. A autoridade de gestão do supervisor não cria acesso
médico. Uma assinatura pode ser suficiente sem dispensar comprovação do vínculo,
identidade e validade da assinatura. Os anexos privados não validam esses pontos.
A ocupação atual é contada pelos vínculos ativos; vagas livres dependem de
capacidade conhecida e nota de limpeza continua sem integração.

A fundação local agora inclui erros padronizados, OpenAPI autenticado, auditoria
de metadados e observabilidade com correlação, conforme o
[contrato da Fase 1](../fase-1/FUNDACAO.md). `GET /api/v1/openapi`,
`GET /actuator/health` e `GET /actuator/metrics` exigem sessão local de gestor
ou supervisor; o contrato documenta cookie `SESSION` e CSRF nas mutações.
Saúde não publica detalhes e outros endpoints de Actuator não são expostos.
Os logs estruturados da aplicação não incluem payloads, credenciais ou valores
pessoais dos cadastros. O [pipeline de CI](../CI.md) está implementado; seu
estado de execução e as evidências estão no registro de QA. Essas entregas
recebem apenas aceite técnico local. A homologação da Fase 2 e a implantação
em produção ainda exigem as definições institucionais aplicáveis, autorização
por registro e controles operacionais de segurança e retenção.
