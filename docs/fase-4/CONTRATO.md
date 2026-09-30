# Contrato local de saídas longas e autorizações

**Decisões delegadas em 30/09/2026.** Este documento registra escolhas locais
de implementação para F4/E09–E10. Não representa homologação institucional ou
validade jurídica de assinatura. A verificação técnica será registrada no QA.

## Solicitação e decisão humana

- Residente autenticado solicita somente para seu vínculo vigente, sendo menor
  na data civil de São Paulo e com alocação ativa. Duração pedida maior que três
  horas; até três horas pertence ao fluxo curto.
- `NOW` usa o instante de submissão no servidor. `SCHEDULED` exige instante
  estritamente posterior ao servidor. Retorno previsto posterior à partida.
- Somente supervisor decide e confirma movimentos físicos. Gestor não herda
  operação de saída pela paridade dos cadastros de gestão.
- A solicitação seleciona UUID de responsável cadastrado, ativo e vinculado,
  com telefone válido. Não aceita nome ou telefone livre como autorização.
- Uma assinatura válida de qualquer responsável elegível basta. Cada binding
  tem um único signatário; confirmar um invalida/cancela os demais pendentes.
- Supervisor pode rejeitar antes da assinatura, com justificativa de pelo menos
  dez caracteres. Assinatura não aprova a saída automaticamente.
- Aprovação exige revisão atual, evidência confirmada por API autenticada,
  responsável ainda elegível e arquivos original e assinado armazenados e íntegros.
- Edição pendente antes da partida cria nova revisão documental e invalida
  tokens, assinaturas e tarefas anteriores, preservando o histórico.
- Alteração de identidade ou relação do responsável invalida o convite pendente.
  Reenvio cria nova revisão quando nome/relação mudaram ou o documento anterior
  já tem PDF assinado; alteração apenas de telefone pode reutilizar o original
  ainda não assinado. Aprovações realizadas preservam seu snapshot histórico.
- Cancelamento e expiração seguem F3. Em andamento não expira automaticamente.
  Retorno físico também é confirmado pelo supervisor: escolha local que encerra
  ocupação física e permite verificar atrasos, sem confundi-lo com a assinatura.
- Janelas e partida física consultam todas as modalidades sob lock do residente,
  impedindo sobreposição e duas saídas físicas simultâneas.

Linha concorrencial `version` e revisão imutável `documentVersionId` são distintas.
Estados de solicitação, assinatura e mensagem permanecem separados. Entrega,
leitura de WhatsApp, callback do widget ou presença de PDF não liberam aprovação.
Provedores desativados apresentam indisponibilidade e nunca criam assinatura válida.

## Documento e armazenamento

PDF gerado offline com snapshot mínimo: residente, matrícula, alocação, período,
motivo, observações, termo local versionado, identificador, revisão e paginação.
Usar PDFBox 3.0.8 e Source Sans 3 estática incorporada, com licença distribuída.
Quebrar texto por largura e paginar; não depender das fontes do computador.

Arquivos ficam fora de `public`, em volume privado com raiz real validada.
Chaves UUID internas compõem o caminho; nomes do cliente não compõem caminhos.
Gravação limitada, hash SHA-256, temporário na mesma raiz, fechamento e movimento
atômico antecedem confirmação `STORED`. Falha de movimento, ausência ou corrupção
bloqueiam aprovação. Preservar o PDF assinado como recebido, com hash próprio.
Download exige autorização, `no-store`, `nosniff` e nome seguro. DTO não expõe
caminho físico, segredo ou URL temporária do provedor.

Banco e volume privado precisam de backup e recuperação conjuntos em F7.
Ler um PDF com PDFBox não comprova integralmente sua assinatura jurídica.

## Clicksign v3

Adaptador usa API JSON:API em origem oficial explicitamente configurada:
`app.clicksign.com/api/v3` ou `sandbox.clicksign.com/api/v3`.
Header canônico `Authorization: <access_token>` e
`Content-Type: application/vnd.api+json`.

Sequência persistida por etapas: envelope → PDF → signatário → requisito
`agree/role=sign` → requisito `provide_evidence/auth=sms` → envelope `running`.
Um binding contém um único signatário para não exigir todos os responsáveis.
Prazo do envelope acompanha o token: 24 horas, limitado pelo prazo funcional.
Binding cancelado/expirado exige novo envelope em reenvio.

Cancelamento externo: documento em execução usa
`PATCH /envelopes/{envelope_id}/documents/{document_id}` com `status=canceled`.
Envelope ainda em rascunho pode usar `DELETE /envelopes/{envelope_id}`.
Não enviar `canceled` ao PATCH do envelope, cujo status aceita `draft/running`.
Revogação local do convite antecede a tarefa de cancelamento externo.

O widget v3 Embedded 2.1.0 recebe `signer.id` depois de `running`. Callback
JavaScript só informa a interface; não grava evidência válida. Não usar chaves
v1 ou inventar URL de assinatura a partir de UUID.

Webhook verifica `Content-Hmac: sha256=<hex>` com HMAC-SHA256 sobre bytes brutos,
segredo exclusivo do webhook e comparação constante. Só depois interpreta JSON
e persiste inbox durável. Evento `sign` inicia reconciliação; `document_closed`
indica disponibilidade do arquivo. GET autenticado confere documento, signatário,
requisitos, evento, revisão e responsável. PDF assinado armazenado e íntegro
antecede estado válido. Parser incompleto/inconsistente falha fechado, sem fallback v1.

Reconciliação é provocada por webhook, recuperação de tarefa interrompida ou ação
explícita. Não executar polling periódico de documentos: a documentação proíbe
consulta regular sem autorização.

Telefone local/Meta usa E.164. Inicialmente aceitar somente Brasil (`+55` seguido
de dez/onze dígitos nacionais); Clicksign recebe DDD e número sem DDI. País
incompatível recebe erro explícito. Autenticação SMS é da Clicksign; Meta envia
o convite. Não prometer desativação total de notificações da Clicksign: requisição
e lembrete aceitam `none`, evento final documenta email/WhatsApp.

## Meta WhatsApp Cloud

POST Graph usa versão explícita, `phoneNumberId`, Bearer token e template aprovado
`sager_autorizacao_saida_v1`, idioma `pt_BR`, botão URL com somente sufixo opaco.
Sem versão Graph presumida e sem criar template aprovado fictício.
Resposta `wamid` significa aceitação. Webhook distingue envio, entrega, leitura e falha.

GET de validação exige `hub.mode=subscribe`, verify token correto e devolve
challenge em texto. POST verifica `X-Hub-Signature-256` com App Secret, distinto
do verify token. Conferir WABA, número, mensagem, destinatário e instante.
Evento antigo não sobrescreve tentativa mais recente. Não inventar consulta GET
de mensagem ou garantia de envio exatamente uma vez.

Desenvolvimento não envia mensagens reais. Habilitação dos adaptadores exige
configuração completa e explícita. Homologação real, credenciais, template aprovado
e domínio de callback são requisitos externos; testes usam doubles HTTP apenas
em configuração de teste, ligados a loopback/porta aleatória.

## Tokens, outbox e reenvio

- Token individual: 32 bytes aleatórios, Base64 URL sem padding, somente SHA-256
  persistido. Token bruto fica em memória durante envio; não logar URL completa.
- Convite aponta para `/assinatura/acesso#token=<opaco>`: fragmento não é enviado
  ao servidor HTTP. A página extrai o token em memória, remove o fragmento do
  histórico e faz requisições com capability Bearer no header e `credentials: omit`.
  Exibe somente revisão/responsável daquele vínculo, sem sessão institucional,
  sem armazenamento no navegador e com `Referrer-Policy: no-referrer`.
- Prazo de 24 horas limitado pela expiração funcional. Revogação/revisão bloqueia
  consulta seguinte. Assinatura realizada no prazo pode ser reconciliada depois
  se instante, revisão e elegibilidade forem confirmados.
- Até três reenvios manuais por saída em janela móvel de 24 horas, intervalo
  mínimo de dez minutos, motivo e versão, validados sob lock.
- Outbox durável: cinco tentativas totais; esperas 1, 5, 15 e 15 minutos.
  Conexão 5 s, leitura 20 s, lease 120 s, reserva curta `SKIP LOCKED`;
  HTTP fora da transação. Idempotência local e progresso persistido por etapa.
- Timeout de POST com aceitação possível vira `UNCERTAIN`, sem reenvio cego.
  Resultado permanente falha; temporário seguro permite retentativa limitada.
- Hash não recupera token: recuperação anterior a envio confirmado gira token
  e revoga o anterior. Resultado ambíguo exige providência humana explícita.
- Mudança funcional, tarefa e auditoria são atômicas; inbox é deduplicada por
  provedor/ambiente/evento. Nenhuma chamada do navegador fabrica `VALID`.

## Rotas previstas

`/api/v1/saidas-longas`: lista própria ou supervisor, elegibilidade, criação,
consulta, edição, decisão, cancelamento, partida, retorno, reenvio e documentos.
`/api/v1/assinaturas/acesso` e `/documento`: capability individual limitada.
`/api/v1/webhooks/clicksign` e `/whatsapp`: validação de provedor, com exceção
de CSRF exclusiva desses POSTs. Escritas institucionais continuam com CSRF.
Fora do perfil autorizado, a API continua fechada.

## Fontes primárias consultadas em 30/09/2026

- Clicksign: [informações gerais](https://developers.clicksign.com/docs/informacoes-gerais),
  [documentos](https://developers.clicksign.com/reference/api-upload-documentos),
  [signatário](https://developers.clicksign.com/reference/api-criar-signatario),
  [qualificação](https://developers.clicksign.com/reference/criar-requisito-qualificacao),
  [SMS](https://developers.clicksign.com/reference/criar-requisito-de-autenticacao),
  [envelope](https://developers.clicksign.com/reference/api-editar-envelope),
  [eventos](https://developers.clicksign.com/reference/eventos-de-um-documento).
- Clicksign: [widget v3](https://developers.clicksign.com/docs/implementando-o-widget-embedded),
  [cancelar documento](https://developers.clicksign.com/reference/editar-documento),
  [HMAC](https://developers.clicksign.com/docs/seguranca-de-webhooks),
  [documento fechado](https://developers.clicksign.com/docs/evento-document-closed),
  [política de webhooks](https://developers.clicksign.com/docs/introducao-a-webhooks),
  [telefone/notificações](https://developers.clicksign.com/reference/signatario-campos-e-regras-de-negocio).
- Meta: [coleção oficial de template](https://www.postman.com/meta/whatsapp-business-platform/request/lwtlz1k/send-message-template-interactive),
  [estados](https://www.postman.com/meta/whatsapp-business-platform/folder/fuaee8l/statuses-object),
  [botão URL](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/types/component_object/),
  [webhook](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/).
  O SDK arquivado é fonte do formato, não dependência recomendada; páginas atuais
  Developers responderam 429 durante a pesquisa.
- Apache: [PDFBox 3](https://pdfbox.apache.org/3.0/getting-started.html) e
  [fontes/layout](https://pdfbox.apache.org/3.0/faq.html);
  Adobe: [Source Sans](https://github.com/adobe-fonts/source-sans);
  Java: [movimento atômico](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/file/Files.html).
