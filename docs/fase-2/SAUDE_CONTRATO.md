# Contrato local da área de saúde

**Escolha técnica de 30/09/2026:** o solicitante delegou as decisões necessárias
para concluir o produto. Este contrato define o desenvolvimento local; não
registra verificação de conselho profissional, autorização institucional ou
conformidade de prontuário sem papel. Concretiza a separação de dados sensíveis
do E02/UC015. Não acrescenta agenda, prescrição, triagem ou emergência.

## Acesso e dados

O novo perfil operacional `saude` não tem CRUD de gestão. Habilitação assistencial
é independente do perfil: `MEDICINA`, `ENFERMAGEM` ou `PSICOLOGIA`, verificada
explicitamente por gestor/supervisor. A conta ativa precisa de habilitação
vigente e vínculo assistencial explícito com o residente. Papel de gestão,
alojamento, e-mail, `supervisorId` e autoria não criam essa autorização.

Habilitação e vínculo usam episódios com novos UUIDs na renovação. Uma
revogação bloqueia também o autor; partilhas antigas não voltam a vigorar
quando uma conta é reabilitada. Conferir o banco em cada requisição e usar
locks em ordem estável em leituras/escritas e revogações.

| Categoria imutável | Autoria e destinatários profissionais |
| --- | --- |
| `GENERAL` | Medicina ou Enfermagem |
| `PSYCHOLOGICAL` | Psicologia |
| `SHARED_SUMMARY` | As três profissões |

Uma nota começa privada ao autor. Partilha exige destinatários explicitamente
selecionados, habilitação vigente, vínculo com o mesmo residente e profissão
compatível. Abrange a nota, seu histórico e futuras correções; revogar encerra
o acesso correspondente. A habilitação de gestão não permite ler notas.
A chave da partilha identifica habilitação e episódio assistencial; uma nova
partilha explícita pode atender a um vínculo renovado sem reativar a antiga.
O autor vê a disponibilidade do episódio na consulta atual e a data da partilha;
as permissões continuam sendo conferidas no servidor em cada requisição.

O paciente usa o caminho separado `/minha-saude`, derivado do `resident_id`
da própria conta; pode ler notas/histórico e baixar cópia JSON própria.
O vínculo de responsável legal não abre acesso médico automaticamente.

Registro profissional: número de 1–100 caracteres e região com duas letras
maiúsculas. A habilitação exige referência de verificação em 10–500 caracteres.

Notas e revisões são imutáveis no SQL, com triggers para UPDATE/DELETE/TRUNCATE
e sem cascatas. Texto simples de 1–4000 caracteres após trim; sem HTML,
anexos, testes ou protocolos psicológicos. A tela orienta a não inserir dados
de terceiros. Justificativas têm 10–500 caracteres; as administrativas não
contêm conteúdo clínico. Somente o autor vigente da mesma profissão corrige,
acrescentando revisão e justificativa com versão esperada; conflito é 409.

Custódia explícita transfere acesso ao conjunto residente + autor desligado;
exige destinatário compatível e vínculo vigente. É autorizada por gestor/supervisor
somente quando o autor perdeu conta, habilitação ou vínculo. O custodiante
acrescenta nova nota com autoria própria e `relatedNoteId`; não reescreve o autor.

## API e respostas

Prefixo `/api/v1`, UTC, UUID, erros comuns e `Cache-Control: no-store`.
Listas: `{items,nextCursor,totalCount}`, limite padrão 20, máximo 100.
Contagem aplica os mesmos predicados de autorização e filtros, antes do cursor.
Sem acesso à nota existente: 404; sem capacidade assistencial: 403.

| Endpoint | Entrada / resultado |
| --- | --- |
| `GET /saude/me` | `{professionalGrant,canAdministerAccess,canAccessOwnRecord}` |
| `GET /saude/contas?q&limit&afterId` | Administração; contas ativas `{id,name,email,profile}`; UUID crescente |
| `GET /saude/habilitacoes?accountId&limit&beforeSequence` | Administração; episódios em sequência decrescente |
| `POST /saude/habilitacoes` | `{accountId,profession,registrationNumber,registrationRegion,verificationReason}` |
| `POST /saude/habilitacoes/{id}/revogacao` | `{version,reason}` |
| `GET /saude/vinculos?residentId&limit&beforeSequence` | Administração; episódios |
| `POST /saude/vinculos` | `{residentId,professionalGrantId,reason}` |
| `POST /saude/vinculos/{id}/encerramento` | `{version,reason}` |
| `GET /saude/custodias?residentId&limit&beforeSequence` | Administração; episódios |
| `POST /saude/custodias` | `{residentId,sourceAuthorAccountId,recipientGrantId,reason}` |
| `POST /saude/custodias/{id}/encerramento` | `{version,reason}` |
| `GET /saude/residentes?q&limit&afterId` | Somente residentes assistidos; cabeçalho mínimo e UUID crescente |
| `GET /saude/residentes/{id}` | `{id,name,enrollment,birthDate,lastRecordedAt,reviewAfter}`; data de nascimento nullable |
| `GET /saude/residentes/{id}/profissionais?category` | `{items:[{accountId,grantId,careAssignmentId,name,profession}]}` compatíveis |
| `GET /saude/residentes/{id}/notas?category&limit&beforeSequence` | Resumos sem corpo |
| `POST /saude/residentes/{id}/notas` | `{category,body,relatedNoteId?}` |
| `GET /saude/notas/{id}` | Nota atual com corpo e capacidades; auditar READ |
| `GET /saude/notas/{id}/historico?limit&beforeVersion` | Revisões com conteúdo; auditar READ |
| `POST /saude/notas/{id}/correcoes` | `{version,body,reason}` |
| `POST /saude/notas/{id}/partilhas` | `{version,recipientGrantIds}`; destinatários novos, sem duplicar |
| `POST /saude/notas/{id}/partilhas/{shareId}/revogacao` | `{version}` da partilha |
| `GET /minha-saude/notas?category&limit&beforeSequence` | Resumos próprios |
| `GET /minha-saude/notas/{id}` e `/historico` | Conteúdo próprio, sem aceitar residentId no cliente |
| `POST /saude/residentes/{id}/exportacoes` | JSON das notas e revisões atualmente acessíveis; auditar EXPORT |
| `POST /minha-saude/exportacoes` | JSON próprio; auditar EXPORT |

Resumos de nota: `id`, `sequence`, `residentId`, `category`, `authorAccountId`,
`authorName`, `authorProfession`, `authorRegistrationNumber`,
`authorRegistrationRegion`, `createdAt`, `updatedAt`, `version`,
`relatedNoteId`, `canCorrect`, `canShare`, `custodyAccess`.
Detalhe acrescenta `body` e `shares` (`id`, `recipientGrantId`,
`recipientCareAssignmentId`, `recipientName`,
`profession`, `createdAt`, `endedAt`, `version`). Contas e nomes profissionais
ficam no DTO autorizado; nunca na auditoria. Revisão: `id`, `noteId`,
`version`, `body`, `reason`, `recordedAt`, `recordedBy`. O motivo da revisão
inicial é `null`; correções exigem a justificativa.

Habilitação: `id`, `sequence`, `accountId`, `accountName`, `profession`,
`registrationNumber`, `registrationRegion`, `verifiedBy`, `verifiedAt`,
`verificationReason`, `startedAt`, `endedAt`, `version`.
Vínculo: `id`, `sequence`, `residentId`, `residentName`, `professionalGrantId`,
`accountId`, `accountName`, `profession`, `startedAt`, `endedAt`, `createdBy`,
`reason`, `version`.
Custódia: `id`, `sequence`, `residentId`, `sourceAuthorAccountId`,
`recipientGrantId`, `recipientAccountName`, `createdBy`, `createdAt`, `reason`,
`endedAt`, `version`.

## Auditoria e retenção

V13 acrescenta recursos administrativos `HEALTH_GRANT`, `CARE_ASSIGNMENT`,
`HEALTH_CUSTODY` e recursos protegidos `HEALTH_NOTE`, `HEALTH_SHARE`,
`HEALTH_EXPORT`, com ações READ/EXPORT para acesso ao conteúdo.
Eventos não guardam corpo, nome, matrícula, diagnóstico ou motivos clínicos.
Leitura exige transação com auditoria; falha de registro impede a entrega.
O GET global de auditoria exclui eventos protegidos no SQL antes da paginação;
um filtro explícito por recurso protegido responde 403.

Exportação: `{exportId,generatedAt,requestId,resident,notes}`; inclui UUIDs e
versões exatas, sem arquivo público. Nome de download baseado no exportId.
Para profissionais, `lastRecordedAt` e `reviewAfter` consideram somente as
notas atualmente acessíveis. O paciente vê as datas do próprio conjunto inteiro.
Essa apresentação evita revelar a existência ou atualização de notas privadas.
A guarda interna considera o último registro do prontuário inteiro; as datas
parciais mostradas ao profissional não autorizam eliminação de documentos.
`reviewAfter` indica uma referência de revisão 20 anos depois do último registro.
Não há exclusão automática, nem promessa de eliminação da guarda eletrônica.

O mínimo de 20 anos conta do último registro do prontuário inteiro, conforme
[Lei 13.787](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13787.htm).
Guarda eletrônica médica tem regras próprias na
[CFM 1.821/2007](https://sistemas.cfm.org.br/normas/arquivos/resolucoes/BR/2007/1821_2007.pdf).
Restringir materiais de avaliação psicológica e registros multiprofissionais
ao necessário segue a [CFP 1/2009](https://site.cfp.org.br/wp-content/uploads/2009/04/resolucao2009_01.pdf)
e a [alteração 5/2010](https://site.cfp.org.br/wp-content/uploads/2010/03/resolucao2010_005.pdf).
Conta e senha locais não substituem os requisitos de documentação sem papel
da [COFEN 754/2024](https://www.cofen.gov.br/resolucao-cofen-no-754-de-16-de-maio-de-2024/).
Partilha e ACL não estabelecem, sozinhas, hipótese legal de tratamento da
[LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).

## Interface e verificação

Rotas locais `/saude`, `/saude/acessos`, `/saude/residentes/:id`,
`/saude/notas/:id` e `/minha-saude`. Nenhuma falha local usa dados da demonstração.
Administração mostra metadados; área assistencial mostra somente pacientes
vinculados. O cadastro geral não ganha campos de conteúdo clínico.

Testes: matriz de categorias/perfis, vínculos, IDOR, contagens/listas/histórico/
exportação, revogação com sessão existente, renovação sem recuperar partilha,
concorrência de correções, custódia restrita, paciente próprio, CSRF,
imutabilidade SQL e atomicidade da auditoria de leitura/exportação. Validar
teclado, foco, estados de erro/vazio e 320 px no navegador.
