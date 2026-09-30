# Saídas longas, documentos e integrações

Implementação técnica de E06/E07 na modalidade longa e E09, com regras locais
delegadas registradas no [contrato](CONTRATO.md). O [QA](QA.md) distingue testes
com doubles, prova local persistida e homologação externa pendente.

## Jornada autenticada

Residente com vínculo explícito, menor na data civil de São Paulo e alocação
ativa solicita uma saída maior que três horas. Seleciona um responsável ativo e
vinculado, com telefone elegível. O servidor calcula instantes em `NOW`; partida
agendada precisa ser estritamente futura. Edição cria revisão documental e revoga
convites anteriores. A lista reúne modalidades, com filtro e links próprios.

Supervisor consulta, rejeita com motivo ou aprova após verificar a revisão atual,
responsável elegível, assinatura conferida e PDFs íntegros. Confirma partida e
retorno físico, inclusive registro histórico justificado. Gestor não opera saídas.
Uma assinatura elegível basta; não se exige assinatura de todos os responsáveis.

Estados da solicitação, assinatura e WhatsApp são apresentados separadamente.
Provedor desativado apresenta indisponibilidade e não autoriza aprovação. Callback
do widget e entrega/leitura de mensagem não comprovam assinatura.

## API

`/api/v1/saidas-longas` oferece criação, lista, elegibilidade e consulta por UUID.
Edição exige `version`; ações explícitas usam `/decisao`, `/cancelamento`,
`/partida`, `/retorno`, `/reenvio` e `/reconciliacao`. Downloads original/assinado
usam UUID da saída e da revisão em `/documentos/{documentVersionId}/...`.
Os esquemas e erros estão no OpenAPI local autenticado.

O residente consulta somente sua identidade derivada da sessão; outro UUID não
abre o registro ou PDF. Auditoria e versões são preservadas. Sobreposição temporal
e partida simultânea consultam saídas curtas e longas sob lock do residente.

## Arquivos e convite

PDFBox gera PDF paginado com Source Sans 3 incorporada e snapshot da revisão.
Armazenamento privado usa chaves UUID, escrita imutável, limite e SHA-256. Arquivo
ausente/corrompido bloqueia o fluxo; download autorizado usa `no-store` e `nosniff`.
A raiz `sager.documents.private-root` deve ficar em volume persistente privado,
incluído no mesmo ponto de recuperação do PostgreSQL.

Convite usa `/assinatura/acesso#token=<capacidade-opaca>`. A tela remove o fragmento,
mantém a capacidade apenas em memória e faz leitura com Bearer, sem cookie e sem
Referer. Token não entra em URL HTTP, storage, DTO ou log. Expira em até 24 horas,
limitado pelo prazo funcional. Alteração, cancelamento e reenvio revogam convites.
A rota antiga de assinatura simulada pertence somente à demonstração explícita.

## Configuração externa

Ambos os adaptadores ficam desabilitados por padrão. Configuração explícita usa
o prefixo `sager.integrations`:

- Clicksign: `clicksign.enabled`, `api-base`, `access-token`, `webhook-secret` e
  `download-hosts`. Somente origens oficiais v3 são aceitas.
- Meta: `whatsapp.enabled`, `graph-version`, `phone-number-id`, `access-token`,
  `app-secret`, `verify-token`, `waba-id` e `template-name`.
- Convite: `public-origin` HTTPS, com domínio autorizado e template de botão URL
  aprovado que preserve o fragmento opaco do convite.

Use segredos fora do Git e não os coloque em argumentos ou logs. Propriedades
necessárias ausentes recusam a ativação; não se presume versão Graph ou aprovação
de template. Webhooks `/api/v1/webhooks/clicksign` e `/whatsapp` autenticam HMAC
sobre bytes originais antes de persistir inbox mínimo e deduplicado.

Outbox guarda etapas, lease e retentativas limitadas; timeout de operação externa
sem garantia segura produz estado incerto para revisão. Reconciliação ocorre por
webhook, recuperação de tarefa ou ação humana. Não há polling regular de assinatura.

Homologação Clicksign/Meta com credenciais autorizadas, custos, domínio de callback,
template e documento institucional permanece externa. Testes sintéticos e parsing
de PDF não comprovam validade jurídica de uma assinatura real.
