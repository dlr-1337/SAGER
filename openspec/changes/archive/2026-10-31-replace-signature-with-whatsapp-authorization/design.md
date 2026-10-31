## Context

A saída longa hoje depende de `SignatureProvider` (Clicksign) e `WhatsAppProvider` (Meta): o WhatsApp só é enfileirado depois que o envelope do provedor chega a `DONE`, e `decide` exige `verified_api`. A constraint `V16` trava `provider='CLICKSIGN'` e expiração de até 24 h no binding. O contrato atual está em `docs/fase-4/CONTRATO.md`.

O contrato do gateway foi conferido contra a imagem real `gows-2026.10.1` em execução local, sem parear número. Rotas: `POST /api/sessions`, `GET /api/{session}/auth/qr`, `POST /api/sendFile`, `GET /api/contacts/check-exists`, `GET /api/{session}/lids/{lid}`. O evento `message.any` traz `payload.source` (`api` ou `app`), `fromMe`, `hasMedia` e `media.url`. Sessão: `STOPPED`, `STARTING`, `SCAN_QR_CODE`, `PASSKEY_REQUIRED`, `PASSKEY_CONFIRMATION_REQUIRED`, `WORKING`, `FAILED`.

## Goals / Non-Goals

**Goals**

- Manter o fluxo real das pessoas: receber o documento, assinar como preferir e devolver pelo WhatsApp.
- Nunca aprovar por evento automático: toda autorização passa por conferência de um supervisor.
- Não travar a operação quando o WhatsApp cair ou o número for banido.
- Trocar de gateway sem tocar no domínio.

**Non-Goals**

- Assinatura eletrônica nos termos da Lei 14.063/2020.
- Provar autoria da assinatura. A evidência comprova que um arquivo veio de um número, em tal horário, e não mudou desde então.
- Adaptador da Cloud API agora. Só é escrito quando for usado.

## Decisions

### D1. Gateway WAHA com motor GOWS, fixado por digest

Licença Apache-2.0, sem paywall desde 2026.6.1, HMAC SHA-512 no webhook, release em 28/10/2026, e `/lids` nos dois sentidos.

*Rejeitadas:* Evolution API (parada, CVE crítico herdado, sem HMAC, ativação remota na 2.4.0); wuzapi (plano B, sem rota de LID para telefone); biblioteca direta (exigiria manter outro serviço).

### D2. Interface única e domínio sem detalhes do gateway

`WhatsAppGateway` expõe: `available`, `session`, `startSession`, `qr`, `resolveRecipient`, `resolveLid`, `sendDocument`, `sendText`, `sendImage`, `sendVoice`, `downloadMedia`, `recentMessages`. `WebhookEventParser` converte o evento do provedor em tipos do domínio. HMAC, URL de mídia, status de entrega, LID e códigos de falha ficam nessas duas classes.

*Rejeitada:* manter `MetaWhatsAppHttpProvider` como segunda implementação. Sem uso, envelhece. O histórico do Git o preserva.

### D3. Webhook só com metadados e mídia baixada depois

O corpo não traz bytes. Isso respeita o `client_max_body_size 1m` do nginx e evita fila durável em memória. Um worker baixa com `X-Api-Key`, de um endereço montado com a base configurada mais o caminho de `media.url`, recusando caminho fora de `/api/files/`. Isso impede enviar a chave a outro destino.

*Rejeitada:* mídia em base64 no webhook, que estoura o limite e fica sujeita a perda em reinício.

### D4. Webhook passa por um proxy interno, sem rede em comum com o backend

O dono do produto decidiu hospedar o gateway na mesma VPS. `forward-headers-strategy: framework` faz o backend confiar em `X-Forwarded-*`, então qualquer container que alcance `backend:8080` passa pelo `ProductionRequestFilter` forjando esses cabeçalhos, anula o limite de login por IP e alcança `/actuator`.

Por isso, o gateway não divide rede com o backend. O serviço `whatsapp-gateway-proxy`, um nginx com a imagem do gateway do SAGER, fica entre os dois:

- Do gateway para o backend (`:8080`): só `POST /api/v1/integracoes/whatsapp/webhook`, com os mesmos cabeçalhos de `sager-proxy.conf`. O resto responde 404.
- Do backend para o gateway (`:3000`): `http://whatsapp-gateway-proxy:3000`, com `client_max_body_size 16m`, porque PDF de 10 MiB em base64 passa de 13 MiB.
- `resolver 127.0.0.11` com `set $u`, para o nginx subir mesmo sem o gateway.

| Rede | Participantes | Tipo |
|---|---|---|
| `whatsapp_api` | backend, proxy | internal |
| `whatsapp_private` | gateway, proxy | internal |
| `whatsapp_egress` | só gateway | saída, sub-rede fixa |

Nenhuma linha muda em `ProductionRequestFilter`.

Em `local`, o backend escuta só em loopback (`SecurityConfiguration` recusa outro endereço), então o proxy entrega o webhook em `backend:4200`, o servidor de desenvolvimento que divide o namespace com o backend e já encaminha `/api` para ele. O gateway continua sem rede em comum com o backend.

*Rejeitadas:* origem pública com hairpin, que não resolve o acesso à API e faz o webhook depender de DNS, certificado e Traefik; exceção no filtro; rede compartilhada com o backend, inclusive `network_mode: service:backend`.

### D5. O binding continua sendo a âncora

Cada revisão continua com um binding, agora com `provider='WHATSAPP_GATEWAY'` e `stage='DONE'` desde a criação. Criado com gateway desligado, ele fica `UNAVAILABLE` e sem tarefa de envio, mas aceita anexo manual. `expires_at` passa a ser o prazo funcional do pedido. A regra de 24 h fica restrita ao provedor antigo. Colunas e linhas antigas de `CLICKSIGN` permanecem para histórico.

A CHECK de `VALID` aceita `verified_api` **ou** `provider='WHATSAPP_GATEWAY'` com `verified_by` preenchido. Gravar `verified_api=true` em conferência humana seria falso.

*Rejeitada:* tabela nova para substituir o binding, que obrigaria reescrever reenvio, expiração e auditoria.

### D6. Candidatos ficam fora de `signed_*`

`sager_document_version.signed_*` só permite gravar uma vez (trigger V16). Uma foto ilegível gravada ali travaria a revisão. Por isso, `sager_guardian_authorization_file` guarda candidatos com estado `CANDIDATE`, `ACCEPTED` ou `REFUSED`. Só o aceito é promovido a `signed_*`, com novo `signed_media_type`.

*Rejeitada:* converter a foto em PDF no aceite. Altera a evidência e cria geração de documento desnecessária.

### D7. Ordem de correlação

1. Resposta citando a mensagem do documento.
2. Único binding aberto para aquele telefone.
3. Escolha manual.

`sager_guardian` é por residente, então irmãos podem compartilhar telefone com dois bindings abertos. Nesse caso nada é vinculado automaticamente.

*Rejeitada:* vincular por nome do contato, que não identifica ninguém.

### D8. Conferência e aprovação são etapas separadas

`POST /api/v1/saidas-longas/{id}/autorizacao/arquivos/{fileId}/conferencia` grava `VALID`, `verified_by`, `signed_at` igual ao horário de recebimento e `evidence_hash`. Depois, `decide` segue quase igual: troca `verified_api` pela nova condição. Como a conferência só vale para a revisão atual, editar o pedido invalida o binding, como hoje.

*Rejeitada:* aprovar direto na conferência. Misturaria evidência com decisão e removeria o segundo olhar sobre elegibilidade.

### D9. Identidade do remetente

O telefone canônico fica como `+55...`. A comparação trata o nono dígito: `+5562912345678` equivale a `556212345678`. LID é resolvido por `/lids/{lid}`. Sem resolução, o arquivo não vira candidato automático. `pushName` nunca serve para vincular.

### D10. Conteúdo do PDF

O documento sai com: nome do residente, período, motivo, nome do responsável, campo de assinatura, data, código curto e revisão. Saem data de nascimento, matrícula e quarto. `TERM_VERSION` sobe. Isso preserva o espírito do RNF-WA05 e do AC44, agora que o documento completo trafega pelo WhatsApp.

*Rejeitada:* manter o link seguro exigido pelo PRD. O dono do produto decidiu enviar o documento pelo WhatsApp.

### D11. Reenvio, falha e entrega

A tarefa `WHATSAPP` reaproveita lease, tentativas e `UNCERTAIN`. POST ambíguo não reenvia sozinho. "Enviado" só conta com confirmação do dispositivo. Sem ela em 15 minutos, a tela avisa para usar outro canal.

### D12. Correção do envenenamento da inbox

`consumeInbox` hoje repete para sempre uma linha que lança exceção e impede o worker de seguir. Evento de fora não pode travar o processamento: a linha passa a receber `failure_code` e sai da fila.

### D13. Tabelas de mensagem já em V23

O arquivo candidato referencia a mensagem que o trouxe, e a idempotência e a reconciliação dependem da chave única de mensagem. Por isso, V23 já cria `sager_whatsapp_session`, `sager_whatsapp_conversation`, `sager_whatsapp_message` e `sager_whatsapp_job`, no formato da D1 de `add-whatsapp-conversations`. Aquela change passa a acrescentar só o que faltar em `V24`, e dispensa essa migration se nada faltar. Rotas e telas de conversa continuam naquela change, e `/api/v1/conversas/**` ainda não existe.

*Rejeitada:* tabela provisória de recebimento só para esta change, que exigiria migrar dados e duplicaria a chave de idempotência.

### D14. Identificador curto da mensagem

O gateway escreve o mesmo id como `true_<chat>_<ID>`, `false_<chat>_<ID>` ou só `<ID>`, e o chat pode vir como telefone ou LID. A chave gravada em `sager_whatsapp_attempt` e `sager_whatsapp_message` é sempre o último segmento, de modo que webhook, reconciliação, confirmação e citação convergem no mesmo registro. A conversão fica em `WebhookEventParser`.

### D15. Anexo sem envio

Anexar ou vincular um arquivo a um pedido sem binding aberto, como os anteriores a V23, cria um binding `UNAVAILABLE` sem tarefa. Esse ato nunca envia mensagem ao responsável; o reenvio é a ação explícita para isso.

### D16. Gateway na mesma VPS não pode derrubar o SAGER

- **Restrições, testadas na imagem real:** `user: 10001:10001`, `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, `mem_limit` e `memswap_limit` de 768m, `cpus` 0.5, `cpu_shares` 256, `oom_score_adj` 500, `pids_limit` 256, tmpfs em `/tmp`, `NODE_OPTIONS=--max-old-space-size=384`, healthcheck em `/ping`. Com esses limites, subiu com 294 MiB, sem número vinculado.
- **Segredos:** a imagem não aceita `_FILE`, então um `entrypoint` exporta os valores de `/run/secrets` e chama `/usr/bin/tini -- /entrypoint.sh`. O gateway nunca recebe segredos do banco, volumes do SAGER nem o socket do Docker.
- **Subida:** sem `depends_on` entre SAGER e gateway. Em `infra/coolify/start.sh`, a subida vem depois do SAGER saudável e não é fatal. A imagem precisa ser baixada no build, pois o `up` usa `--pull never`. Com `traefik.enable=false`, `infra/coolify/test_start.py:84` precisa ser atualizado.
- **Disco:** `WHATSAPP_FILES_LIFETIME=86400` substitui o `0` sugerido em `PESQUISA.md:208`, pois disco cheio derruba o PostgreSQL. Alertar em 80%.
- **Backup:** `waha_sessions` fica fora, porque copiar a sessão equivale a copiar a posse do número. Se a VPS cair, vincula de novo. Isso substitui `PESQUISA.md:226`.
- **Retentativas do webhook:** devem cobrir pelo menos 10 minutos, a janela de backup e deploy. A reconciliação cobre o resto, nos limites da D14 de `add-whatsapp-conversations`.
- **Segredos ausentes:** o backend monta `waha_api_key` e `waha_webhook_hmac` mesmo desligado, e o Docker cria um diretório no lugar de arquivo ausente. Por isso, os dois arquivos existem antes da implantação, e `start.sh` confere isso antes de parar o SAGER quando o gateway está ligado.
- **Banco:** nenhuma chamada ao gateway dentro de transação, porque o pool tem 8 conexões.
- **Capacidade:** mínimo de 2 vCPU e 4 GB mais swap. Os 2 GB de `docs/fase-7/QA.md:142` não comportam os limites somados, de 2432 MiB.
- **Host:** a saída do gateway alcança portas publicadas do host, como o painel do Coolify. `OPERACAO.md` documenta a regra `DOCKER-USER`, que bloqueia `whatsapp_egress` para redes privadas e para o IP público da VPS.

### D17. Nome de quem conferiu e decidiu

A API entrega `verifiedByName` no vínculo e `decidedByName` no arquivo, lidos da conta local, e a tela mostra o nome. O identificador técnico nunca aparece: sem nome, a tela diz "Supervisor". Só supervisores recebem o nome; o residente recebe nulo, porque ele não precisa saber qual servidor decidiu.

*Rejeitada:* a tela buscar o nome pelo identificador, que exigiria uma chamada a mais por pessoa em cada pedido aberto.

## Risks / Trade-offs

- **Banimento e violação de termos** → número dedicado, só mensagens individuais disparadas por pedido real, responsável orientado a escrever primeiro, e anexo manual sempre disponível. Não há garantia: "não dar problema no futuro" não é uma promessa possível.
- **Fragilidade do protocolo** → digest fixo e homologação antes de atualizar, com roteiro em `OPERACAO.md`. Ficar parado também derruba a sessão, então é preciso atualizar com regularidade.
- **Celular "parado"** → o aparelho precisa ficar ligado e ser usado de verdade: vinculados deslogam se ele ficar sem uso por mais de 14 dias.
- **Evidência mais fraca que assinatura eletrônica** → redação honesta na tela e nos documentos, e original exigível em caso de dúvida.
- **Dados de menores na Meta** → PDF com menos dados, e decisão institucional pendente.
- **CVE-2026-6979, SSRF autenticada no WAHA** → API só em rede interna, chave própria, envio em base64, dashboard e swagger desligados.
- **Mídia até 10 MiB** → limite de `PrivateFileStore` e do backup. Arquivo maior fica visível como recusado, nunca é descartado em silêncio.

## Migration Plan

1. `V23` amplia CHECKs de provider e environment, condiciona a regra de 24 h e a CHECK de `VALID`, adiciona `verified_by`, `signed_media_type` (com trigger atualizado), `sager_guardian_authorization_file` e as tabelas de sessão, conversa, mensagem e fila (D13), e amplia a auditoria.
2. Bindings abertos de `CLICKSIGN` são invalidados pela migration. Eles nunca passaram de simulação, e o pedido segue por anexo manual ou reenvio.
3. Backend e frontend sobem juntos: `isLongExit` é estrito e quebra a lista se só um lado mudar.
4. Rodar `infra/production/initialize-runtime.sh` depois da migration.
5. **Reverter:** restaurar o código anterior não basta, pois as linhas novas violam a CHECK antiga. Fazer backup antes.

## Open Questions

Decisões da instituição, detalhadas em `docs/whatsapp/PESQUISA.md`, seção 4:

1. Nível mínimo de assinatura exigido para este ato. **Se for avançado, a foto deixa de bastar como único meio.**
2. Aceite formal do uso de integração não oficial e do risco de veto ao número e à organização.
3. Base legal, finalidade e relatório de impacto para dados de adolescentes.
4. Prazo de retenção de arquivos e mensagens.
5. Conduta para o ECA art. 83, que esta autorização não substitui.
