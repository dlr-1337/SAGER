## Context

O SAGER não tem hoje SSE, polling, upload ou gravação de áudio. O nginx de produção bloqueia microfone, limita o corpo a 1 MiB e dá precedência à regex de estáticos sobre `/api/`. O pacote de integrações exige `binding_id` em tarefas, então a conversa livre não cabe nele.

## Goals / Non-Goals

**Goals**

- Operar as conversas sem abrir o WhatsApp no celular.
- Garantir que o histórico fique no SAGER, mesmo com banimento do número.

**Non-Goals**

- Substituir o aplicativo em todas as funções.
- Mensagens em massa, grupos ou automação.

## Decisions

### D1. Modelo próprio com fila de trabalho

`sager_whatsapp_conversation` tem chave única por provedor, sessão e chat, com telefone e LID resolvidos. `sager_whatsapp_message` tem chave única por provedor, sessão e id. `sager_whatsapp_job` guarda envio e download, com lease, como `ReportExportJobs`. As três tabelas já existem desde `V23`, e o download já roda no worker de integração. Esta change reaproveita ambos e acrescenta o envio.

*Rejeitada:* ler do gateway ao abrir a tela. O histórico sumiria com a sessão, e o gateway recomprime e apaga arquivos.

### D2. Só supervisor

Segue `AGENTS.md`: operações não são herdadas pelo gestor, e o QR equivale à posse da conta. Liberar ao gestor é uma linha em rota e permissão, se a instituição decidir.

### D3. Consulta periódica

5 s na conversa aberta e 15 s na lista. `setTimeout` recursivo, reagendado só depois da resposta, pausado com `document.hidden`, interrompido em 401 e após 30 minutos sem interação, com botão para retomar. Essa pausa impede que a consulta mantenha viva a sessão de uma estação compartilhada.

*Rejeitada:* SSE, que exige mudar `proxy_read_timeout` e buffering do proxy para um volume de mensagens baixo.

### D4. Envio assíncrono com idempotência

A mensagem é gravada como `QUEUED`, com `Idempotency-Key`, e o worker envia. Falha ambígua vira `UNCERTAIN`, sem reenvio cego. O estado de entrega só avança: confirmações podem chegar fora de ordem. Confirmação para uma mensagem com envio em andamento responde 503, e o gateway tenta de novo.

### D5. Mensagens enviadas pelo celular aparecem

`message.any` com `fromMe` e `source=app` é gravada como enviada pelo aparelho. Com `source=api`, é ignorada, pois a mensagem já foi gravada no envio.

### D6. Áudio

O navegador grava em WebM ou MP4, conforme `MediaRecorder.isTypeSupported`. O backend envia por `sendVoice` com `convert:true`, porque a imagem do gateway tem ffmpeg. O original fica guardado. A reprodução em Safari precisa de teste em iPhone real.

### D7. Mídia pela API

`GET /api/v1/conversas/mensagens/{id}/midia`, sem extensão no caminho, por causa da regex de estáticos do nginx. Tipo por lista permitida, `nosniff`, e `attachment` para o que não for imagem nem áudio. Texto só por interpolação.

### D8. Auditoria só com metadados

Envio, vinculação e início de conversa são auditados, sem conteúdo.

### D9. Lease sem coluna nova

Um envio em `RUNNING` pode ter chegado ao gateway. Lease vencida vira `UNCERTAIN` sem nova chamada, e só falha comprovadamente anterior à entrega (conexão recusada, 429) volta para `PENDING`. Falha de POST sem resposta segue para `UNCERTAIN`. A confirmação recebe 503 só enquanto há envio em `RUNNING` com lease válida e o id ainda é desconhecido.

*Rejeitada:* coluna `in_flight`, como em `sager_integration_task`. Aqui marcar a lease e iniciar o POST são o mesmo passo, e a coluna repetiria a informação de `state`.

### D10. Tipos aceitos pelos bytes

Conversa aceita PDF, JPEG, PNG, WEBP, HEIC (só recebimento), Ogg, MP3, WebM e MP4 de áudio. WebM e MP4 também podem ser vídeo, então só nesses o tipo declarado separa áudio de vídeo. Documento é só PDF. Só imagem e PDF viram arquivo candidato de autorização: áudio nunca.

*Rejeitada:* aceitar DOCX e XLSX, que são ZIP e exigiriam confiar no tipo declarado pelo remetente.

### D11. Contato por LID e por telefone

O gateway pode entregar o mesmo contato como telefone e como LID. A reconciliação resolve o LID e funde a conversa no chat de telefone, guardando o LID nela, de modo que respostas seguintes caem no mesmo histórico.

*Rejeitada:* manter duas conversas com o mesmo nome, porque a resposta do responsável ficaria separada da pergunta.

### D12. Leitura compartilhada

A marca de leitura é por conversa, não por supervisor. Cada supervisor individual exigiria outra tabela sem pedido da instituição.

### D13. PDF da saída no histórico

Depois de enviar, o worker grava o PDF na conversa do responsável como mensagem de saída, com origem `AUTHORIZATION` (`V26`), sem nova chamada ao gateway. A chave única por id torna a gravação idempotente. Cada mensagem guarda a própria cópia do arquivo, pois `media_file_id` é único e o reenvio reaproveita o PDF. Falha na gravação fica em log e não segura a saída. Envio `UNCERTAIN` não entra, porque não se sabe se chegou.

*Rejeitadas:* remover a unicidade de `media_file_id`, que abriria mão de uma garantia do esquema só por este caso; gravar na mesma transação do envio, em que uma falha de histórico prenderia a saída; reutilizar a origem `SUPERVISOR`, que atribuiria o envio a uma pessoa.

### D14. Reconciliação de conversas ativas

A cada rodada, além dos telefones com autorização pendente, o worker consulta até 20 conversas com atividade nas últimas 24 horas, em ordem aleatória, sem repetir chat. Só mensagens recebidas voltam (`filter.fromMe=false`), e a chave única grava apenas o que falta.

*Rejeitadas:* ordenar por atividade recente, que deixaria as mais antigas sem consulta quando houvesse mais de 20; coluna `last_reconciled`, que exigiria escrita a cada rodada por um ganho pequeno.

### D15. Falha do gateway ao iniciar conversa

Só a resposta que confirma a falta do número (`recipient_not_found`) vira 422 `number_not_found`. As demais falhas viram 503, `session_not_ready` ou `gateway_unreachable`. Resposta 401 ou 403 do gateway agora é `provider_unauthorized`, para chave errada não parecer sessão parada.

*Rejeitada:* tratar toda falha permanente como número inexistente, que fazia o supervisor corrigir um cadastro certo.

### D16. Estilos só nas rotas de conversa

Os estilos de conversa saem do `styles.scss` global e ficam em cada componente carregado sob demanda, com `ViewEncapsulation.None`, porque eles dividem classes `conv-*`. O limite de orçamento não muda.

*Rejeitadas:* aumentar o limite, que só esconderia o aviso; folha global carregada sob demanda, que exigiria código próprio para algo que o Angular já faz.

## Risks / Trade-offs

- **Dado de saúde em conversa livre** → aviso permanente e orientação de usar o canal próprio. Nada impede tecnicamente o responsável de enviar: a instituição precisa decidir a conduta.
- **Sem retenção definida** → conversas ficam até decisão institucional; está na lista de pendências.
- **Lacunas do histórico** → conversa sem atividade há mais de 24 horas não é consultada, o que foi enviado pelo celular durante uma queda não volta, e um envio de PDF `UNCERTAIN` não aparece na conversa. Com mais de 20 conversas ativas, a recuperação pode levar várias rodadas.
- **Volume de disco** → limite de 10 MiB por arquivo, sem cota global; o `OPERACAO.md` orienta a monitorar.
- **Áudio no Safari** → testar em iPhone real, com o arquivo original sempre disponível para baixar.

## Migration Plan

As tabelas de conversa, mensagem e fila já vêm de `V23`, criada em `replace-signature-with-whatsapp-authorization` porque o arquivo candidato referencia a mensagem. `V24` acrescenta só o que faltar, como colunas de saída e recursos de auditoria, e deixa de existir se nada faltar. `V26` amplia a CHECK de origem com `AUTHORIZATION`. Sem mudança de dados existentes. Reverter é seguro: remover as rotas deixa as tabelas sem uso.

## Open Questions

1. Quem da equipe pode ler as conversas, além do supervisor?
2. Prazo de retenção de mensagens e arquivos.
3. Conduta quando chega dado de saúde pela conversa.
