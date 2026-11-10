# Contrato local de saídas longas e autorizações

**Decisões delegadas em 30/09/2026.** Este documento registra escolhas locais
de implementação para F4/E09–E10. Não representa homologação institucional nem
atesta a validade da autorização. A verificação técnica será registrada no QA.

> **Nota de substituição (2026-10-31).** Os adaptadores Clicksign e Meta, o convite
> por link e a conferência automática com provedor foram retirados por decisão do dono
> do produto. As seções de autorização, gateway, fila e rotas abaixo descrevem o fluxo
> vigente; o texto de 30/09/2026 fica no histórico do Git. O desenho está em
> `openspec/changes/replace-signature-with-whatsapp-authorization` e a operação em
> [`docs/whatsapp/OPERACAO.md`](../whatsapp/OPERACAO.md).

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
- Uma autorização conferida de qualquer responsável elegível basta. Cada binding
  tem um único responsável; confirmar um invalida os demais pendentes.
- Supervisor pode rejeitar antes da autorização, com justificativa de pelo menos
  dez caracteres. Conferir a autorização não aprova a saída automaticamente.
- Aprovação exige revisão atual, autorização conferida por supervisor, responsável
  ainda elegível e arquivos original e recebido armazenados e íntegros.
- Edição pendente antes da partida cria nova revisão documental e invalida
  autorizações e tarefas anteriores, preservando o histórico.
- Alteração de identidade ou relação do responsável invalida o envio pendente.
  Reenvio cria nova revisão quando nome/relação mudaram ou o documento anterior
  já tem arquivo aceito; alteração apenas de telefone pode reutilizar o original.
  Aprovações realizadas preservam seu snapshot histórico.
- Cancelamento e expiração seguem F3. Em andamento não expira automaticamente.
  Retorno físico também é confirmado pelo supervisor: escolha local que encerra
  ocupação física e permite verificar atrasos, sem confundi-lo com a autorização.
- Janelas e partida física consultam todas as modalidades sob lock do residente,
  impedindo sobreposição e duas saídas físicas simultâneas.

Linha concorrencial `version` e revisão imutável `documentVersionId` são distintas.
Estados de solicitação, autorização e mensagem permanecem separados. Entrega,
leitura ou recebimento pelo WhatsApp e presença de arquivo não liberam aprovação.
Gateway desligado apresenta indisponibilidade e aceita anexo manual, que passa pela
mesma conferência.

## Documento e armazenamento

PDF gerado offline com snapshot mínimo: nome do residente, nome do responsável,
período, motivo, termo local versionado (`SAGER-SAIDA-LONGA-v2`), campo de assinatura,
data, código curto, revisão e paginação. Não traz nascimento, matrícula nem quarto,
porque trafega pelo WhatsApp e fica no armazenamento do gateway.
Usar PDFBox 3.0.8 e Source Sans 3 estática incorporada, com licença distribuída.
Quebrar texto por largura e paginar; não depender das fontes do computador.

Arquivos ficam fora de `public`, em volume privado com raiz real validada.
Chaves UUID internas compõem o caminho; nomes do cliente não compõem caminhos.
Gravação limitada, hash SHA-256, temporário na mesma raiz, fechamento e movimento
atômico antecedem confirmação `STORED`. Falha de movimento, ausência ou corrupção
bloqueiam aprovação. Preservar o arquivo aceito como recebido, com hash e tipo próprios.
Download exige autorização, `no-store`, `nosniff` e nome seguro. DTO não expõe
caminho físico, segredo ou URL de mídia do gateway.

Banco e volume privado precisam de backup e recuperação conjuntos em F7.
O hash comprova integridade desde o recebimento, não a autoria do conteúdo.

## Autorização e conferência

O arquivo aceito é imagem (JPEG, PNG, WEBP, HEIC) ou PDF, até 10 MiB, com tipo detectado
pelos bytes. Arquivos candidatos ficam fora de `signed_*`, que só aceita uma gravação;
só o aceito é promovido, em `signed_media_type` e `signed_*`.

Vinculação automática, nesta ordem: resposta citando o documento; único binding aberto
para o telefone. Com dois bindings abertos para o mesmo telefone, como irmãos, o arquivo
fica sem vínculo até o supervisor escolher. Número desconhecido e LID sem resolução não
vinculam. `pushName` nunca identifica ninguém. Áudio nunca vira candidato.

Só supervisor confere, recusa, anexa manualmente ou vincula. A conferência exige declarar
que responsável, documento e revisão foram conferidos, e grava `VALID`, `verified_by`,
`signed_at` igual ao recebimento e `evidence_hash`. Arquivo de outra revisão ou de binding
substituído responde `stale_document`. Remetente divergente exige justificativa. A recusa
exige justificativa, mantém o arquivo e deixa o pedido aguardando.

Depois, `decisao` volta a conferir revisão, binding com `verified_by`, responsável e
integridade dos dois arquivos: `signature_required`, `guardian_not_eligible` e
`document_unavailable` bloqueiam. Anexo ou vínculo em pedido sem binding aberto cria
binding `UNAVAILABLE`, sem tarefa, e nunca envia mensagem. Pedidos anteriores a V23 têm
os bindings abertos invalidados e seguem por anexo manual ou reenvio.

### Limitação declarada

A evidência comprova que um arquivo veio de um número, em tal horário, e não mudou desde
então. Não comprova autoria nem constitui assinatura eletrônica nos termos da Lei
14.063/2020. O nível mínimo exigido é decisão institucional pendente. A redação completa
está em [`docs/whatsapp/OPERACAO.md`](../whatsapp/OPERACAO.md#redação-recomendada-da-limitação).

## Gateway WhatsApp

WAHA com motor GOWS, imagem `devlikeapro/waha:gows-2026.10.1` fixada por digest, atrás de
`WhatsAppGateway`. Desligado por padrão. Propriedades sob `sager.integrations.whatsapp`:
`enabled`, `base-url`, `api-key`, `webhook-secret` e `session`. Ligado sem endereço, chave ou
segredo, ou com chave igual ao segredo, recusa a inicialização.

`POST /api/v1/integracoes/whatsapp/webhook` é a única rota pública. Verifica `X-Webhook-Hmac`
com HMAC SHA-512 sobre os bytes brutos, em tempo constante, e responde 401 sem gravar nada
se falhar. Corpo limitado a 1 MiB, só com metadados. Grava em inbox com chave única antes de
responder; repetição responde sucesso sem duplicar. Evento que falha recebe `failure_code` e
não trava os seguintes. Eventos de grupo, status e canal, e mensagens anteriores à vinculação,
são ignorados. O evento nunca aprova nem confere nada.

Download de mídia: só o caminho `/api/files/`, sobre a base configurada. Endereço fora disso
não é chamado e a chave não sai para outro host. Falha, tipo não aceito ou arquivo acima de
10 MiB ficam visíveis, nunca descartados em silêncio.

Telefone canônico `+55...`, normalizado em `GuardianService`; a comparação trata o nono
dígito. LID é resolvido por `/lids/{lid}`. Reconciliação a cada 2 minutos, para telefones com
autorização pendente e até 20 conversas por rodada com atividade nas últimas 24 horas, grava
apenas o que falta.

Desenvolvimento não envia mensagens reais. Testes usam double HTTP nos formatos conferidos
na imagem, sem número vinculado.

## Conversas

Regra de acesso: só supervisor, em `SecurityConfiguration` e de novo no serviço. O envio
exige `Idempotency-Key`: mesma chave e mesmo conteúdo devolvem a mensagem existente; outro
conteúdo responde 409. Falha ambígua vira `UNCERTAIN`, sem novo POST. `message.any` com
`source=app` é gravado como enviado pelo aparelho, e com `source=api` é ignorado. O estado de
entrega só avança. Auditoria registra envio, início de conversa, vínculo, início de sessão e
leitura do QR, sem conteúdo. O PDF enviado pelo fluxo de saída entra no histórico da conversa
do responsável como mensagem de origem `AUTHORIZATION`, sem novo envio, e falha nesse registro
não segura a saída. `POST /api/v1/conversas` só responde 422 `number_not_found` quando o gateway
confirma que o número não existe; as demais falhas respondem 503.

## Fila e reenvio

- Até três reenvios manuais por saída em janela móvel de 24 horas, intervalo
  mínimo de dez minutos desde o último binding, motivo e versão, validados sob lock.
  Reenvio exige o gateway ligado.
- Tarefa durável: cinco tentativas totais; esperas de 1, 5, 15 e 15 minutos. Lease de 120 s,
  reserva curta `SKIP LOCKED`; HTTP fora da transação.
- Envio disparado pelo residente, ao criar ou editar, respeita 10 minutos de intervalo e três envios
  em 24 horas: fica agendado para o próximo horário, e só a revisão mais recente sai.
- Reenvio é recusado com `authorization_pending` enquanto houver arquivo candidato na revisão atual.
- Timeout de POST com aceitação possível vira `UNCERTAIN`, sem reenvio cego.
  Resultado permanente falha; temporário seguro permite retentativa limitada.
- "Enviado" só conta com confirmação do dispositivo. Sem ela em 15 minutos, o detalhe
  avisa e orienta o uso de outro canal.
- Mudança funcional, tarefa e auditoria são atômicas; inbox é deduplicada por
  provedor/ambiente/evento. Nenhuma chamada do navegador grava `VALID` sem a conferência
  do supervisor.

## Rotas

`/api/v1/saidas-longas`: lista própria ou supervisor, elegibilidade, criação, consulta,
edição, decisão, cancelamento, partida, retorno, reenvio e documentos.
`/{id}/autorizacao/arquivos`, `/{fileId}`, `/{fileId}/conferencia` e `/{fileId}/recusa`,
`/{id}/autorizacao/vinculos` e `/{id}/autorizacao/nao-vinculados`: só supervisor.
`/api/v1/conversas/**`: só supervisor, inclusive mídia, `/sessao` e `/sessao/qr`.
`/api/v1/integracoes/whatsapp/webhook`: HMAC, com exceção de CSRF exclusiva desse POST.
Escritas institucionais continuam com CSRF. Fora do perfil autorizado, a API continua fechada.

## Fontes primárias

Do gateway: [`docs/whatsapp/PESQUISA.md`](../whatsapp/PESQUISA.md). Do documento:
[PDFBox 3](https://pdfbox.apache.org/3.0/getting-started.html),
[fontes/layout](https://pdfbox.apache.org/3.0/faq.html),
[Source Sans](https://github.com/adobe-fonts/source-sans) e
[movimento atômico](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/file/Files.html).
