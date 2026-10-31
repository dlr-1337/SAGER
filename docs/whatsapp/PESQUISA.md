# Relatório: gateway de WhatsApp para o SAGER

> **Conferência da imagem real (2026-10-31), depois desta pesquisa.** A imagem `devlikeapro/waha:gows-2026.10.1` rodou localmente: versão 2026.10.1, engine GOWS, tier CORE, 166 rotas e cerca de 440 MiB de RAM em ociosidade, sem sessão. Nenhum número foi vinculado e nenhuma mensagem foi enviada. Isso confere o contrato da API, não o comportamento com o WhatsApp: o teste de aceite da seção 5 continua pendente e está em [`OPERACAO.md`](OPERACAO.md). Onde este relatório diz "nada foi instalado", vale para a pesquisa original.

Pesquisa observada em 2026-10-31. Nada foi instalado nem testado. Issues são relatos, não medições. O texto sem marca vem da fonte citada. "Inferência" é leitura nossa e [INCERTO] é o que não se confirmou. Este relatório não é parecer jurídico.

## 1. Recomendação

**Gateway: [WAHA](https://github.com/devlikeapro/waha) com o motor GOWS, em imagem com versão fixa.** A escolha é inferência e depende de duas condições:
- passar no teste de aceite da seção 5;
- ter aceite formal do risco pela instituição, porque nenhuma opção não oficial deixa de violar os termos do WhatsApp (seção 3).

### Por que não a Evolution API

| Ponto | Evolution API | WAHA/GOWS |
|---|---|---|
| Manutenção | A [última estável é a v2.3.7, de 2025-12-05](https://github.com/evolution-foundation/evolution-api/releases). O [main só recebeu documentação depois disso](https://github.com/evolution-foundation/evolution-api/commits/main) e o [develop parou em 2026-07-14](https://github.com/evolution-foundation/evolution-api/commits/develop). A [issue #2682 pergunta se o projeto morreu](https://github.com/evolution-foundation/evolution-api/issues/2682). | [2026.10.1 em 28/10, com 12 releases desde 17/04](https://github.com/devlikeapro/waha/releases). |
| Segurança | A v2.3.7 usa [Baileys rc.9](https://raw.githubusercontent.com/evolution-foundation/evolution-api/main/package.json), na faixa do [CVE-2026-48063, crítico (9.3), que permite forjar mensagem recebida](https://github.com/advisories/GHSA-qvv5-jq5g-4cgg). Inferência: corrigir exige RC, com ativação de licença, ou fork. O [bypass entre instâncias só foi corrigido no develop](https://github.com/evolution-foundation/evolution-api/pull/2549). | Encontrada [uma CVE, de SSRF autenticada](https://nvd.nist.gov/vuln/detail/CVE-2026-6979). Inferência: [o código citado parece sem correção](https://github.com/devlikeapro/waha/blob/core/src/api/media.controller.ts); mitigação na seção 3. |
| Webhook | [JWT HS256, sem HMAC do corpo](https://raw.githubusercontent.com/evolution-foundation/evolution-api/main/src/api/integrations/event/webhook/webhook.controller.ts). | [HMAC SHA-512 sobre o corpo bruto](https://waha.devlike.pro/docs/how-to/events/). |
| Vinculação | [Baileys sem tratamento de `companion_reg_refresh` nos arquivos verificados](https://github.com/WhiskeySockets/Baileys/issues/2737), com [PR ainda aberto](https://github.com/WhiskeySockets/Baileys/pull/2765). [Passkey segue em aberto no Baileys](https://github.com/WhiskeySockets/Baileys/issues/2672). | [Passkey marcado como resolvido só no GOWS](https://github.com/devlikeapro/waha/issues/2138), embora a [#2227 relate sessão presa](https://github.com/devlikeapro/waha/issues/2227). `companion_reg_refresh` no GOWS: [INCERTO]. |
| Licença | [Apache 2.0 com condições: aviso visível aos administradores, e licença comercial "as determined by the producer"](https://github.com/evolution-foundation/evolution-api/blob/main/LICENSE). A 2.4.0 [responde 503 até ativar em servidor externo](https://github.com/evolution-foundation/evolution-api/releases), com [telemetria sem opção oficial de desligar](https://docs.evolutionfoundation.com.br/licensing/faq.md). | [Apache-2.0](https://github.com/devlikeapro/waha/blob/core/LICENSE), [sem verificação de licença](https://waha.devlike.pro/support-us/). |

A Evolution leva vantagem em um ponto: ela tem [rotas prontas de histórico](https://raw.githubusercontent.com/evolution-foundation/evolution-api/develop/src/api/routes/chat.router.ts). Mesmo assim, o SAGER precisaria de cópia própria.

### Pontos fracos do WAHA

- [Equipe pequena, financiada por doação](https://waha.devlike.pro/support-us/).
- [Regressões frequentes no changelog](https://waha.devlike.pro/docs/overview/changelog/).
- [Ban ou falha podem deixar a sessão morta em silêncio (#2317, aberta)](https://github.com/devlikeapro/waha/issues/2317).
- [FAQ pede no mínimo 2 CPU e 4 GB](https://waha.devlike.pro/docs/overview/faq/), embora o projeto declare 0,1 CPU e 200 MB para uma sessão GOWS.
- [O motor GOWS é baixado como binário pré-compilado](https://github.com/devlikeapro/waha/blob/core/Dockerfile), de um [repositório com 7 estrelas](https://github.com/devlikeapro/gows-plus).

### Plano B: wuzapi

- É [MIT e usa whatsmeow](https://github.com/asternic/wuzapi). O [pin do whatsmeow contém o commit de `companion_reg_refresh`](https://github.com/tulir/whatsmeow/commits/main/notification.go), que o próprio autor chama de "untested".
- Tem [mídia no próprio webhook (base64 ou S3)](https://github.com/asternic/wuzapi/blob/main/API.md) e [HMAC-SHA256](https://github.com/asternic/wuzapi), o que dispensa volume compartilhado com o backend Java.
- Tem três riscos abertos: [socket morto com `loggedIn=true` (#379)](https://github.com/asternic/wuzapi/issues/379), [sessões que não reconectam após reinício (#388)](https://github.com/asternic/wuzapi/issues/388) e [nenhuma rota de LID para telefone (#373)](https://github.com/asternic/wuzapi/issues/373).

Inferência: trocar de motor dentro do WAHA não é plano B completo, porque a [#2138 só marca passkey como resolvido no GOWS](https://github.com/devlikeapro/waha/issues/2138).

### O que o adaptador precisa isolar

Basta uma interface no backend com uma única implementação. Adaptadores de wuzapi ou Cloud API só devem ser escritos quando forem usados. O domínio do SAGER nunca deve ver:

| Item | O que varia entre provedores |
|---|---|
| Autenticação do webhook | [SHA-512 no WAHA](https://waha.devlike.pro/docs/how-to/events/), [SHA-256 na wuzapi](https://github.com/asternic/wuzapi). Na Cloud API não foi apurado [INCERTO]. |
| Obtenção de mídia | [URL com chave no WAHA](https://waha.devlike.pro/docs/how-to/receive-messages/), [base64 ou S3 na wuzapi](https://github.com/asternic/wuzapi/blob/main/API.md), [ID com URL de 5 minutos na Cloud API](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media.md). |
| Identidade | Telefone, LID e [BSUID na Cloud API, onde o telefone pode faltar](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids). |
| Estados de entrega | [ERROR até PLAYED no WAHA](https://waha.devlike.pro/docs/how-to/events/); [Read, ReadSelf e Delivered na wuzapi](https://github.com/asternic/wuzapi/blob/main/wmiau.go). |
| Saúde da sessão e QR | Existem só nos gateways. Inferência: expor como capacidade opcional. |
| Erros | 463, ban, desconexão e demais falhas, mapeados para códigos do domínio. |
| IDs de mensagem | Sempre com o provedor no namespace. |

Inferência: o domínio deve separar a "mensagem de abertura" da conversa livre desde o início. Na Cloud API, [fora da janela de 24h só vale template aprovado](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md). Envio de PDF como cabeçalho de template utility: [INCERTO].

A migração também tem limites próprios:
- O [número banido só registra após apelação com sucesso](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers).
- O [número em uso precisa ser apagado antes de registrar, salvo em Coexistence](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users.md).

## 2. Tabela comparativa

Issues e releases observadas em 2026-10-31. Nada foi testado em execução.

| Candidato | Licença | Manutenção observada | Mídia de entrada | Mídia de saída | Webhook | Remetente com LID | Infra | Limitações gratuitas |
|---|---|---|---|---|---|---|---|---|
| **[WAHA/GOWS](https://github.com/devlikeapro/waha)** | [Apache-2.0](https://github.com/devlikeapro/waha/blob/core/LICENSE) | [2026.10.1 em 28/10; 450 issues abertas](https://github.com/devlikeapro/waha) | [`media.url` com `X-Api-Key`](https://waha.devlike.pro/docs/how-to/receive-messages/); [local apaga em 180 s](https://waha.devlike.pro/docs/how-to/storages/) | [`sendFile` com PDF por URL ou base64; `sendVoice` em OGG/Opus](https://waha.devlike.pro/docs/how-to/send-messages/) | [HMAC SHA-512 opcional e retries](https://waha.devlike.pro/docs/how-to/events/) | [`/lids` nos dois sentidos; `check-exists` traz `pn`, que pode ser nulo](https://waha.devlike.pro/docs/how-to/contacts/) | [Docker, volume ou PostgreSQL](https://waha.devlike.pro/docs/how-to/storages/); [2 CPU e 4 GB](https://waha.devlike.pro/docs/overview/faq/) | [Nenhuma desde a 2026.6.1](https://waha.devlike.pro/blog/waha-2026-6/) |
| **[wuzapi](https://github.com/asternic/wuzapi)** | MIT | v1.1.0 em 2026-10-26; 76 issues | [Base64, S3 ou ambos; temporários não são fila durável](https://github.com/asternic/wuzapi/blob/main/media-memory.md) | [Documento por base64 ou URL; `/chat/send/voice` converte para OGG/Opus](https://github.com/asternic/wuzapi/blob/main/API.md) (presença na tag v1.1.0: [INCERTO]) | [HMAC-SHA256; em multipart cobre só os campos](https://github.com/asternic/wuzapi) | [Telefone para LID sim, inverso não; `SenderAlt` pode vir vazio](https://github.com/asternic/wuzapi/issues/373) | [SQLite ou PostgreSQL; RabbitMQ opcional](https://github.com/asternic/wuzapi) | Nenhuma encontrada |
| **[GOWA](https://github.com/aldinokemal/go-whatsapp-web-multidevice)** | MIT | v9.8.0 em 2026-10-30; 14 issues; 1 mantenedor concentra os commits | [Caminho de arquivo no webhook](https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/main/docs/webhook-payload.md); [sem retenção automática](https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/main/docs/media-storage.md) | [`/send/audio` com `ptt`](https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/main/docs/openapi.yaml); PDF por `/send/file` é inferência | [HMAC-SHA256 sobre o JSON](https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/main/docs/webhook-payload.md) | [`from` resolvido, mais `from_lid` e `chat_lid`](https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/main/docs/webhook-payload.md); [regressão relatada](https://github.com/aldinokemal/go-whatsapp-web-multidevice/issues/484) | SQLite ou PostgreSQL; ffmpeg | Nenhuma; [dashboard atualiza sozinho por padrão](https://github.com/aldinokemal/go-whatsapp-web-multidevice) |
| **[Evolution API](https://github.com/evolution-foundation/evolution-api)** | [Apache 2.0 com condições](https://github.com/evolution-foundation/evolution-api/blob/main/LICENSE) | [v2.3.7 de 2025-12-05; 161 issues e 93 PRs](https://github.com/evolution-foundation/evolution-api) | [Base64 ou `mediaUrl`](https://raw.githubusercontent.com/evolution-foundation/evolution-api/develop/src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts); [S3 ligado suprime eventos (#2768)](https://github.com/evolution-foundation/evolution-api/issues/2768) | [`sendMedia`](https://raw.githubusercontent.com/evolution-foundation/evolution-api/develop/src/api/dto/sendMessage.dto.ts); [`sendWhatsAppAudio`](https://raw.githubusercontent.com/evolution-foundation/evolution-api/develop/src/api/routes/sendMessage.router.ts) | [JWT HS256, sem HMAC do corpo](https://raw.githubusercontent.com/evolution-foundation/evolution-api/main/src/api/integrations/event/webhook/webhook.controller.ts) | [`remoteJidAlt`](https://github.com/evolution-foundation/evolution-api/blob/develop/src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts); [9º dígito perdido (#2687)](https://github.com/evolution-foundation/evolution-api/issues/2687) | [Node 20+, PostgreSQL ou MySQL, Redis](https://docs.evolutionfoundation.com.br/evolution-api/installation.md) | [2.4.0 exige ativação e envia telemetria; tier community é gratuito](https://docs.evolutionfoundation.com.br/licensing) |
| **[Evolution Go](https://github.com/evolution-foundation/evolution-go)** | [Apache 2.0 com condições](https://raw.githubusercontent.com/evolution-foundation/evolution-go/main/LICENSE) | [v0.7.2 de 2026-07-02](https://github.com/evolution-foundation/evolution-go/commits/main); [pin de whatsmeow de 2026-06-30](https://raw.githubusercontent.com/evolution-foundation/evolution-go/main/go.mod) | [Base64 ou `mediaUrl`](https://docs.evolutionfoundation.com.br/evolution-go/webhooks.md) | [`document` e `audio`, com conversão para Opus](https://raw.githubusercontent.com/evolution-foundation/evolution-go/main/docs/wiki/guias-api/api-messages.md) | [Sem autenticação; só `Content-Type`](https://raw.githubusercontent.com/evolution-foundation/evolution-go/main/pkg/events/webhook/webhook_producer.go) | [INCERTO] | [PostgreSQL, 512 MB](https://docs.evolutionfoundation.com.br/evolution-go/installation.md); [panic derruba o processo](https://github.com/evolution-foundation/evolution-go/issues/188) | [Licença obrigatória](https://github.com/evolution-foundation/evolution-go) |
| **[WPPConnect Server](https://github.com/wppconnect-team/wppconnect-server)** | Apache-2.0 | v2.10.73 em 2026-10-31; 41 itens abertos | Webhook com base64 | Não avaliada | HMAC não localizado, o que não prova ausência; [3 retries de 5 s](https://github.com/wppconnect-team/wppconnect-server/blob/main/.env.example) | [Reply sem LID (#2510)](https://github.com/wppconnect-team/wppconnect-server/issues/2510) | Chromium | [Sem passkey em WPP](https://github.com/devlikeapro/waha/issues/2138), o que pesa contra |
| **Cloud API oficial** (referência) | [Serviço comercial](https://whatsappbusiness.com/policy/) | Meta; [preço pode mudar a cada trimestre](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md) | [ID; URL de 5 min; até 100 MB](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media.md) | [Documento 100 MB; áudio 16 MB](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media.md) | [INCERTO] | [BSUID sempre; telefone condicional](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids) | Webhook público; [governo exige Solution Provider](https://whatsappbusiness.com/policy/) | [1.000 service grátis por número/mês; utility cobrada, cerca de US$ 0,0068](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md) |

### Descartados

- [quepasa](https://github.com/nocodeleaks/quepasa): indisponível por DMCA (HTTP 451).
- [wacli](https://github.com/openclaw/wacli/blob/main/docs/sync.md): é CLI, com webhook best-effort.
- [OpenWA](https://raw.githubusercontent.com/rmyndharis/OpenWA/main/docs/16-risk-management.md): declara bus factor 1. O [README manda tratá-lo como "not approved" em ambiente regulado](https://github.com/rmyndharis/OpenWA).
- [whatsmeow](https://github.com/tulir/whatsmeow), [Baileys](https://github.com/WhiskeySockets/Baileys) e [whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js): são bibliotecas, não gateways. Exigiriam um serviço próprio a manter.

## 3. Riscos reais

**"Não vai dar problema no futuro" não é uma promessa possível.** A exigência honesta passa a ser: quando falhar, a operação não trava.

### Violação dos termos

- O WhatsApp afirma que [vincular a conta a app não oficial, agora ou no passado, pode gerar ban temporário ou permanente](https://faq.whatsapp.com/378279804439436/?locale=en_US).
- Os [termos do Business App, vigentes desde 2026-09-23, proíbem aplicações que interajam com o serviço sem consentimento escrito](https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-App).
- Os próprios projetos avisam: a [wuzapi recomenda a API oficial para uso comercial](https://github.com/asternic/wuzapi) e o [WAHA não dá garantia contra bloqueio](https://waha.devlike.pro/docs/overview/how-to-avoid-blocking/).
- Inferência: baixo volume reduz a exposição, mas não transforma a violação em uso permitido.

### O fluxo começa no pior ponto

- O [WAHA recomenda não iniciar conversas](https://waha.devlike.pro/docs/overview/how-to-avoid-blocking/), e o SAGER escreve primeiro ao responsável.
- O [erro 463 de reach-out aparece nesse cenário](https://github.com/aldinokemal/go-whatsapp-web-multidevice/issues/777) e já foi [investigado pela comunidade do Baileys](https://github.com/WhiskeySockets/Baileys/issues/2441).
- A biblioteca pode reduzir a ocorrência, porque o [whatsmeow envia tokens de privacidade](https://github.com/tulir/whatsmeow/blob/main/send.go), mas não a elimina: [o 463 também ocorre em GOWS](https://github.com/devlikeapro/waha/issues/1992). Não há medição.

### Protocolo frágil

- O [whatsmeow](https://github.com/tulir/whatsmeow/issues/1164) e o [Baileys](https://github.com/WhiskeySockets/Baileys/issues/2370) já sofreram erro 405 em conexões inteiras.
- [Ficar sem atualizar também derruba a sessão](https://github.com/tulir/whatsmeow/issues/1040).
- Inferência: fixar a versão não significa congelar. É preciso atualizar com regularidade, passando antes pela homologação.

### Se o número for banido

- O [app pode oferecer revisão, em geral concluída em 24h; sem essa opção, o ban é final](https://faq.whatsapp.com/465883178708358/?locale=en_US).
- Terceiros não desbanem, e durante o ban não há acesso a histórico nem backups (mesma fonte).
- [Encerrada a conta, a empresa não pode criar outra sem permissão escrita](https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-App).
- A [política permite vetar a organização de uso futuro quando a conta é encerrada por violação](https://whatsappbusiness.com/policy/). Inferência: aplicar isso a um gateway de baixo volume é plausível, mas não há caso documentado. **O risco alcança a instituição, não só o número.**
- Mesmo a [restrição temporária impede o uso de aparelhos vinculados](https://faq.whatsapp.com/717472490411581/?cms_platform=web&locale=en_US). Inferência: para o gateway, isso equivale a parada.
- Inferência: a cópia do SAGER será o único histórico disponível, e os pedidos pendentes seguem pelo upload manual.

### O celular pode ficar desligado?

**Por pouco tempo, sim. Parado para sempre, não.**
- [Aparelhos vinculados funcionam sem o telefone online, mas deslogam se ele ficar sem uso por mais de 14 dias](https://faq.whatsapp.com/378279804439436/?locale=en_US). A página não define "uso" nem diz se a regra vale igualmente para cliente não oficial [INCERTO].
- Há [desconexão automática após 30 dias de inatividade do vinculado](https://faq.whatsapp.com/378279804439436/?locale=en_US).
- [Recuperar mídia expirada pede novo upload ao telefone](https://github.com/tulir/whatsmeow/blob/main/mediaretry.go).
- [Passkey exige o autenticador do dono](https://waha.devlike.pro/blog/waha-passkey/).
- Inferência: o aparelho deve ficar ligado na tomada, com internet, em local institucional, com responsável nomeado e uso real ao menos semanal.
- "WhatsApp parado" vale para a rotina da equipe, não para o aparelho.

### A via oficial também não é garantia

A [Meta admitiu suspensões indevidas em 2026, segundo o regulador malaio](https://www.thestar.com.my/news/nation/2026/10/03/meta-admits-technical-error-caused-wrong-whatsapp-account-suspensions-says-mcmc). A diferença é que nela o uso é autorizado, com [escada de sanções e apelação](https://developers.facebook.com/documentation/business-messaging/whatsapp/policy-enforcement.md).

Sobre custo:
- [Utility custa cerca de US$ 0,0068 no Brasil](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md).
- R$ 0,0350 por mensagem: [INCERTO] (só confirmado em [terceiro](https://chatmaxima.com/whatsapp-api-pricing/brazil/)).
- A Meta mantém [service gratuito além da franquia, até 2027-12-31, para organizações governamentais qualificadas](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing). Se o IF Goiano se qualifica é questão a validar.
- O [Serpro é provedor oficial para o setor público](https://www.serpro.gov.br/menu/noticias/noticias-2026/serpro-comunicacao-governo). Preço: [INCERTO].

### Mitigação concreta (inferência, salvo onde há link)

1. Usar número dedicado, que não seja o principal da instituição.
2. No cadastro, o responsável [salva o número e escreve primeiro por link `wa.me`](https://waha.devlike.pro/docs/overview/how-to-avoid-blocking/). Isso registra o aceite e o par telefone/LID, e é a [orientação oficial de contatar quem iniciou o contato](https://faq.whatsapp.com/361005896189245/?locale=en_US).
3. Enviar só mensagens um a um, disparadas por um pedido real. Nada de grupos, status ou envio em massa.
4. [Checar a existência do número antes do primeiro envio](https://waha.devlike.pro/docs/how-to/contacts/).
5. [Não reiniciar nem parear de novo em caso de timelock](https://waha.devlike.pro/docs/how-to/events/).
6. Não reservar username no número sem testar antes ([relato](https://github.com/rmyndharis/OpenWA/issues/560)).
7. Manter o upload manual sempre disponível. Se não houver confirmação de entrega no prazo, disparar alerta e usar canal alternativo.
8. Mitigar a SSRF: API só em rede interna, saída de rede restrita e [PDF em base64, porque `fetchBuffer` desliga a validação de TLS](https://github.com/devlikeapro/waha/blob/core/src/utils/fetch.ts).
9. Não usar técnicas para burlar detecção.

## 4. Implicações legais e LGPD

**Base defensável: autorização do responsável, não assinatura eletrônica.**

- **Forma:** [atos não dependem de forma, salvo exigência legal](https://www.planalto.gov.br/ccivil_03/leis/l9784.htm).
- **Reproduções:** [fazem prova se não impugnadas](https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm), e [a fé cessa quando a autenticidade é impugnada](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm).
- **Foto de papel assinado:** é imagem. O [VALIDAR informa que nela não há assinatura eletrônica](https://validar.iti.gov.br/duvidas.html).
- **PDF com assinatura colada:** continua sendo imagem (inferência). Só a assinatura criptográfica é verificável.
- **Se o Decreto 8.539 se aplicar:** o [arquivo vale como cópia simples e o original pode ser exigido](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/decreto/d8539.htm).
- **Nível de assinatura:** é o ponto em aberto mais importante.
  - O [Decreto 10.543 alcança autarquias e pessoas naturais](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/decreto/d10543.htm), e o [IF Goiano é autarquia](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11892.htm).
  - No art. 4º, I, c, envio com protocolo é simples. No II, g, envio em atendimento a procedimento administrativo é avançado, o que pesa contra a foto como único meio se a saída for tratada como procedimento. Essa leitura é inferência.
  - O II, c trata de instrumentos sinalagmáticos, e uma autorização unilateral tende a ficar fora dele (inferência).
  - A [definição cabe à instituição](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14063.htm).
  - **Se o IF Goiano exigir nível avançado, a foto pelo WhatsApp deixa de bastar como único meio.**
- **Regulamento do IF Goiano:**
  - O [art. 25, IV, exige autorização dos pais ou responsáveis e do setor para pernoite de residente menor de 18 anos](https://suap.ifgoiano.edu.br/media/documentos/arquivos/2026_-_Normas_Disciplinares_5%C2%AA_Edi%C3%A7%C3%A3o.pdf).
  - O art. 24, IV, trata só da autorização do setor. Inferência: esse texto não sustenta exigir assinatura do responsável em saída curta sem pernoite.
  - O art. 5º, §2º, fala de comunicação por aplicativo "realizada por servidor" quando os responsáveis não podem assinar ou comparecer. Inferência: isso não equivale a mensagem automática nem a assinatura.
  - O regulamento das residências não foi localizado.
- **ECA:** o [art. 83 exige autorização judicial para menor de 16 anos desacompanhado fora da comarca, salvo exceções](https://www.planalto.gov.br/ccivil_03/leis/l8069.htm). Inferência: autorizar a saída do alojamento não é autorizar viagem. A [exigência de firma varia por comarca](https://docs.tjgo.jus.br/jij_goiania/portarias/Portaria_058_2019_Autorizacao_de_Viagem.pdf).
- **LGPD, base legal:** para adolescente, [o consentimento parental do §1º fala só de crianças](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm), e o [Enunciado CD/ANPD 1/2023 admite as bases dos arts. 7º e 11, com melhor interesse avaliado no caso concreto](https://bibliotecadigital.mj.gov.br/bitstream/1/10215/2/Enunciado_ANPD_2023_1.html). O [consentimento muitas vezes não é a base apropriada no setor público](https://privacidade.unicamp.br/arquivo/uploads/guia-poder-publico-anpd-versao-final/).
- **LGPD, terceiro:** esse é o ponto fraco. Inferência: mesmo com gateway próprio, o conteúdo passa pelo WhatsApp, e não há contrato para sustentar os [arts. 26, 33 e 39](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm). Não foi encontrada manifestação da ANPD sobre esse caso.
- **Precedente:** a [CGU admite WhatsApp para comunicação correcional, com registro](https://basedeconhecimento.cgu.gov.br/server/api/core/bitstreams/b14501e2-aba9-4a92-acca-e0a0d34db03c/content). Não trata de assinatura, então serve só como analogia.
- **Print:** [a linha do STJ é penal, chegou por fonte secundária e varia caso a caso](https://www.migalhas.com.br/coluna/migalhas-criminais/445874/uso-de-prova-de-prints-de-whatsapp-a-luz-da-jurisprudencia-do-stj). Conferir o inteiro teor antes de citar.

### Redação recomendada da limitação

> O SAGER registra autorizações de responsáveis recebidas pelo WhatsApp, inclusive foto de documento assinado à mão. Esse registro comprova que um arquivo foi recebido de determinado número, em data e hora registradas pelo sistema, e que não mudou desde o recebimento. Não comprova, por si só, a autoria da assinatura, e não constitui assinatura eletrônica nos termos da Lei 14.063/2020, salvo quando o arquivo trouxer assinatura criptográfica validada, caso em que se registram o nível e o resultado da validação. A aceitação é ato humano de servidor autorizado, que confere documento, revisão e responsável. Havendo dúvida ou impugnação, a instituição pode exigir o original ou confirmar por outro meio. A autorização refere-se à saída do alojamento e não substitui autorização de viagem exigida pelo ECA ou pelo transportador. O enquadramento depende de validação institucional, e o uso de integração não oficial do WhatsApp não tem contrato com o provedor.

Evitar na documentação: "assinatura válida", "validade jurídica garantida", "prova plena" e "conforme a LGPD".

### Validar com o IF Goiano (Procuradoria, encarregado, Assuntos Estudantis, TI)

1. Nível mínimo de assinatura e sua publicação na Carta de Serviços.
2. Regulamento de residências vigente e forma aceita de autorização; se a foto basta.
3. Conduta para o ECA art. 83: comarca do aluno alojado e menores de 16 anos.
4. Base legal, finalidade, avaliação do melhor interesse e necessidade de relatório de impacto.
5. Papel da Meta, transferência internacional e aceite formal da integração não oficial no número usado.
6. Se o enquadramento é de "entidade governamental", com [Solution Provider obrigatório](https://whatsappbusiness.com/policy/) (inferência a confirmar).
7. Aviso a responsáveis e residentes, e quem da equipe pode ler as conversas.
8. Conversas e áudios podem conter dados de saúde, o que [atrai o art. 11](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) e colide com a separação de saúde do SAGER.
9. Retenção de conversas e mídias. A retenção permanente da auditoria não resolve isso.
10. Quem cadastra e confirma o número do responsável, e como agir em troca de número, guarda ou tutela.

**Impacto no projeto:** a regra atual do `AGENTS.md`, de assinatura verificada contra a revisão com PDFs íntegros, não cabe para foto. Precisa ser reescrita como conferência humana. Continua valendo que entrega de mensagem nunca aprova nada, o que o [CVE-2026-48063](https://github.com/advisories/GHSA-qvv5-jq5g-4cgg) reforça.

## 5. Requisitos técnicos para o desenho

As decisões abaixo são inferências de desenho sobre as fontes citadas.

### Autenticação do webhook

- Exigir [HMAC, que é opcional no WAHA: chave em `WHATSAPP_HOOK_HMAC_KEY`, cabeçalho `X-Webhook-Hmac`, SHA-512](https://waha.devlike.pro/docs/how-to/events/).
- Calcular sobre os bytes brutos, antes de interpretar o JSON, com comparação em tempo constante. Falha resulta em 401 e rejeita o evento.
- O `X-Webhook-Timestamp` não parece coberto pela assinatura. A proteção contra replay fica na deduplicação.
- [Não expor a API do WAHA em rede pública; TLS no proxy](https://waha.devlike.pro/docs/how-to/security/).

### Download de mídia

- Baixar logo após o evento, em tarefa com retentativa, usando [`X-Api-Key`](https://waha.devlike.pro/docs/how-to/receive-messages/).
- Montar a URL a partir da base configurada do gateway, para não enviar a chave a outro destino.
- ~~Configurar [`WHATSAPP_FILES_LIFETIME=0` com pasta persistente, ou S3/PostgreSQL](https://waha.devlike.pro/docs/how-to/storages/), e apagar a cópia do gateway depois da cópia do SAGER confirmada.~~ **Decisão posterior (D16 do desenho):** gateway na mesma VPS, com `WHATSAPP_FILES_LIFETIME=86400`, ou seja, arquivos por 24 horas, porque disco cheio derrubaria o PostgreSQL. Ver [`OPERACAO.md`](OPERACAO.md).
- [`media.url` nulo](https://waha.devlike.pro/docs/how-to/receive-messages/) entra como pendência visível, nunca como mensagem sem anexo.
- [Vídeo pode exigir a imagem `:chrome`](https://waha.devlike.pro/docs/how-to/engines/) (testar). Se não funcionar em GOWS, tratar como limitação conhecida.

### LID e telefone

- Guardar telefone canônico e LID por responsável, resolvendo no cadastro.
- Usar [`check-exists` e `/lids`](https://waha.devlike.pro/docs/how-to/contacts/). Isso também resolve o 9º dígito antes do primeiro envio ([exemplo do problema](https://github.com/evolution-foundation/evolution-api/issues/2687)).
- LID sem mapeamento vai para fila de identificação humana, nunca é anexado por nome.
- LID novo em número conhecido, ou o inverso, exige nova conferência. [Número pode mudar de dono](https://github.com/rmyndharis/OpenWA).
- `pushName` não identifica ninguém, e dígitos de LID não são telefone.

### Reconexão e QR

- Tela só para administradores, com estado da sessão, QR e motivo da queda. O QR equivale à posse da conta.
- Nada de reinício automático genérico: [em timelock, não reiniciar nem parear de novo](https://waha.devlike.pro/docs/how-to/events/).
- Prever passkey: [a assinatura só funciona na origem web.whatsapp.com e exige o dono](https://waha.devlike.pro/blog/waha-passkey/). A retomada nem sempre se resolve pelo painel do SAGER.
- O alerta não depende só do status: [#2317](https://github.com/devlikeapro/waha/issues/2317) e [#2250](https://github.com/devlikeapro/waha/issues/2250) mostram sessão parada ou evento perdido. Combinar status, tempo sem eventos e envio sem confirmação.
- ~~Proteger e fazer backup próprio das credenciais da sessão. [Backup só do banco pode perder o pareamento](https://raw.githubusercontent.com/rmyndharis/OpenWA/main/docs/16-risk-management.md).~~ **Decisão posterior (D16 do desenho):** a sessão fica fora do backup, porque copiá-la equivale a copiar a posse do número. Se a VPS cair, vincula-se de novo. Ver [`OPERACAO.md`](OPERACAO.md).
- Se usar PostgreSQL para a sessão, [o usuário precisa criar e apagar bancos](https://waha.devlike.pro/docs/how-to/storages/). Usar instância e papel separados do SAGER.

### Armazenamento

- O SAGER é a fonte de verdade, em armazenamento privado. A aba de conversa lê daí, nunca do gateway.
- A linha do tempo começa na vinculação. O [GOWS sincroniza todo o histórico por padrão](https://waha.devlike.pro/docs/engines/gows/), então é preciso limitar isso. Histórico importado fica marcado e não tem efeito em autorização.
- Para cada evidência, guardar: arquivo como recebido, SHA-256 dos bytes, número, horários, código e revisão do documento, servidor que conferiu e método.
- Classificar como foto, PDF sem assinatura criptográfica ou PDF com assinatura validada. Não criar motor de níveis de assinatura.
- O hash prova integridade só desde o recebimento. O WhatsApp pode recomprimir fotos [INCERTO].

### Deduplicação e perda

- Chave única por (provedor, sessão, ID da mensagem), com gravação idempotente antes de responder 2xx. Retries e reconciliação caem na mesma chave.
- O [whatsmeow confirma a mensagem sem esperar os handlers](https://github.com/tulir/whatsmeow/blob/main/message.go), salvo com `SynchronousAck`. Comportamento no GOWS: [INCERTO]. Portanto, um deploy do SAGER pode esgotar os retries e perder a mensagem.
- Configurar [retries exponenciais](https://waha.devlike.pro/docs/how-to/events/) e uma reconciliação periódica por API nas conversas com pedido pendente. O endpoint exato em GOWS não foi conferido [INCERTO].
- Estado de entrega nunca regride, porque [confirmações podem chegar fora de ordem](https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/main/docs/webhook-payload.md).
- 2xx não é entrega ([#2687](https://github.com/evolution-foundation/evolution-api/issues/2687)). O documento só conta como enviado após confirmação do dispositivo.
- [Ausência de "lido" não prova nada](https://faq.whatsapp.com/3307102709559968/?locale=en_US).

### Formato de áudio

- Envio: [OGG/Opus, com `convert:true` ou `/media/convert/voice`](https://waha.devlike.pro/docs/how-to/send-messages/).
- Gravação: o navegador pode gerar WebM ([Safari 18.4 grava WebM/Opus](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)). Testar com `isTypeSupported`, aceitar o formato recebido e converter no servidor.
- O microfone exige HTTPS ou localhost, [como a wuzapi documenta para o cliente dela](https://github.com/asternic/wuzapi/blob/main/API.md).
- Reprodução: há [relato contrário sobre Ogg/Opus no Safari 18.4](https://frequal.com/java/OggOpusStillNotWorkingInSafari18_4.html). Testar em iPhone real e manter sempre o original.

### Teste de aceite com número de teste (bloqueia a adoção)

- Pareamento novo, com e sem passkey.
- Envio de PDF; recebimento de foto, PDF e áudio.
- Contato salvo e não salvo, incluindo caso que chega só como LID.
- Número antigo, sem o 9º dígito.
- Primeiro envio a contato novo, medindo o tempo até a confirmação e a ocorrência de 463.
- SAGER fora por 10 minutos e gateway fora por 1 hora.
- Reinício com mensagem em trânsito.
- Celular desligado por um dia e mídia baixada com atraso.
- Áudio gravado no Chrome e no Safari, ouvido em Android e iPhone.
- RAM real.

## Limites e risco a decidir

**Não verificado:** execução real de qualquer gateway, taxa de banimento (os números que circulam vêm de fornecedores e ficaram de fora), `companion_reg_refresh` no GOWS, autenticação de webhook da Cloud API, taxa do BSP, inteiro teor dos acórdãos do STJ. Parte das fontes foi lida em resumo ou trecho de busca.

**Risco a decidir:** usar gateway não oficial expõe a instituição a veto de WhatsApp. A via compatível com órgão público é a Cloud API por Solution Provider. O gateway só deve seguir com aceite formal, número dedicado e upload manual sempre disponível.

## Fontes

Todas observadas em 2026-10-31.

**WAHA**
- https://github.com/devlikeapro/waha
- https://github.com/devlikeapro/waha/blob/core/LICENSE
- https://github.com/devlikeapro/waha/releases
- https://github.com/devlikeapro/waha/blob/core/Dockerfile
- https://github.com/devlikeapro/waha/blob/core/src/api/media.controller.ts
- https://github.com/devlikeapro/waha/blob/core/src/utils/fetch.ts
- https://github.com/devlikeapro/waha/issues/1992
- https://github.com/devlikeapro/waha/issues/2138
- https://github.com/devlikeapro/waha/issues/2227
- https://github.com/devlikeapro/waha/issues/2250
- https://github.com/devlikeapro/waha/issues/2317
- https://github.com/devlikeapro/gows-plus
- https://waha.devlike.pro/blog/waha-2026-6/
- https://waha.devlike.pro/blog/waha-passkey/
- https://waha.devlike.pro/support-us/
- https://waha.devlike.pro/docs/how-to/engines/
- https://waha.devlike.pro/docs/engines/gows/
- https://waha.devlike.pro/docs/how-to/events/
- https://waha.devlike.pro/docs/how-to/receive-messages/
- https://waha.devlike.pro/docs/how-to/send-messages/
- https://waha.devlike.pro/docs/how-to/storages/
- https://waha.devlike.pro/docs/how-to/security/
- https://waha.devlike.pro/docs/how-to/contacts/
- https://waha.devlike.pro/docs/overview/faq/
- https://waha.devlike.pro/docs/overview/how-to-avoid-blocking/
- https://waha.devlike.pro/docs/overview/changelog/
- https://nvd.nist.gov/vuln/detail/CVE-2026-6979

**Evolution API e Evolution Go**
- https://github.com/evolution-foundation/evolution-api
- https://github.com/evolution-foundation/evolution-api/blob/main/LICENSE
- https://github.com/evolution-foundation/evolution-api/releases
- https://github.com/evolution-foundation/evolution-api/commits/main
- https://github.com/evolution-foundation/evolution-api/commits/develop
- https://github.com/evolution-foundation/evolution-api/issues/2682
- https://github.com/evolution-foundation/evolution-api/issues/2687
- https://github.com/evolution-foundation/evolution-api/issues/2768
- https://github.com/evolution-foundation/evolution-api/pull/2549
- https://github.com/evolution-foundation/evolution-api/blob/develop/src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts
- https://raw.githubusercontent.com/evolution-foundation/evolution-api/main/package.json
- https://raw.githubusercontent.com/evolution-foundation/evolution-api/main/src/api/integrations/event/webhook/webhook.controller.ts
- https://raw.githubusercontent.com/evolution-foundation/evolution-api/develop/src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts
- https://raw.githubusercontent.com/evolution-foundation/evolution-api/develop/src/api/routes/chat.router.ts
- https://raw.githubusercontent.com/evolution-foundation/evolution-api/develop/src/api/routes/sendMessage.router.ts
- https://raw.githubusercontent.com/evolution-foundation/evolution-api/develop/src/api/dto/sendMessage.dto.ts
- https://docs.evolutionfoundation.com.br/licensing
- https://docs.evolutionfoundation.com.br/licensing/faq.md
- https://docs.evolutionfoundation.com.br/evolution-api/installation.md
- https://github.com/evolution-foundation/evolution-go
- https://github.com/evolution-foundation/evolution-go/commits/main
- https://github.com/evolution-foundation/evolution-go/issues/188
- https://raw.githubusercontent.com/evolution-foundation/evolution-go/main/LICENSE
- https://raw.githubusercontent.com/evolution-foundation/evolution-go/main/go.mod
- https://raw.githubusercontent.com/evolution-foundation/evolution-go/main/pkg/events/webhook/webhook_producer.go
- https://raw.githubusercontent.com/evolution-foundation/evolution-go/main/docs/wiki/guias-api/api-messages.md
- https://docs.evolutionfoundation.com.br/evolution-go/webhooks.md
- https://docs.evolutionfoundation.com.br/evolution-go/installation.md

**wuzapi, GOWA e outros gateways**
- https://github.com/asternic/wuzapi
- https://github.com/asternic/wuzapi/blob/main/API.md
- https://github.com/asternic/wuzapi/blob/main/media-memory.md
- https://github.com/asternic/wuzapi/blob/main/wmiau.go
- https://github.com/asternic/wuzapi/issues/373
- https://github.com/asternic/wuzapi/issues/379
- https://github.com/asternic/wuzapi/issues/388
- https://github.com/aldinokemal/go-whatsapp-web-multidevice
- https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/main/docs/webhook-payload.md
- https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/main/docs/media-storage.md
- https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/main/docs/openapi.yaml
- https://github.com/aldinokemal/go-whatsapp-web-multidevice/issues/484
- https://github.com/aldinokemal/go-whatsapp-web-multidevice/issues/777
- https://github.com/wppconnect-team/wppconnect-server
- https://github.com/wppconnect-team/wppconnect-server/blob/main/.env.example
- https://github.com/wppconnect-team/wppconnect-server/issues/2510
- https://github.com/rmyndharis/OpenWA
- https://github.com/rmyndharis/OpenWA/issues/560
- https://raw.githubusercontent.com/rmyndharis/OpenWA/main/docs/16-risk-management.md
- https://github.com/nocodeleaks/quepasa
- https://github.com/openclaw/wacli/blob/main/docs/sync.md

**Bibliotecas de protocolo**
- https://github.com/tulir/whatsmeow
- https://github.com/tulir/whatsmeow/commits/main/notification.go
- https://github.com/tulir/whatsmeow/blob/main/send.go
- https://github.com/tulir/whatsmeow/blob/main/message.go
- https://github.com/tulir/whatsmeow/blob/main/mediaretry.go
- https://github.com/tulir/whatsmeow/issues/1040
- https://github.com/tulir/whatsmeow/issues/1164
- https://github.com/WhiskeySockets/Baileys
- https://github.com/WhiskeySockets/Baileys/issues/2370
- https://github.com/WhiskeySockets/Baileys/issues/2441
- https://github.com/WhiskeySockets/Baileys/issues/2672
- https://github.com/WhiskeySockets/Baileys/issues/2737
- https://github.com/WhiskeySockets/Baileys/pull/2765
- https://github.com/wwebjs/whatsapp-web.js
- https://github.com/advisories/GHSA-qvv5-jq5g-4cgg

**WhatsApp e Meta**
- https://faq.whatsapp.com/378279804439436/?locale=en_US
- https://faq.whatsapp.com/465883178708358/?locale=en_US
- https://faq.whatsapp.com/717472490411581/?cms_platform=web&locale=en_US
- https://faq.whatsapp.com/361005896189245/?locale=en_US
- https://faq.whatsapp.com/3307102709559968/?locale=en_US&cms_platform=web
- https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-App
- https://whatsappbusiness.com/policy/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md
- https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media.md
- https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers
- https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids
- https://developers.facebook.com/documentation/business-messaging/whatsapp/policy-enforcement.md
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users.md
- https://www.serpro.gov.br/menu/noticias/noticias-2026/serpro-comunicacao-governo
- https://www.thestar.com.my/news/nation/2026/10/03/meta-admits-technical-error-caused-wrong-whatsapp-account-suspensions-says-mcmc
- https://chatmaxima.com/whatsapp-api-pricing/brazil/

**Legal**
- https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14063.htm
- https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/decreto/d10543.htm
- https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11892.htm
- https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/decreto/d8539.htm
- https://www.planalto.gov.br/ccivil_03/leis/l9784.htm
- https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm
- https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm
- https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- https://www.planalto.gov.br/ccivil_03/leis/l8069.htm
- https://validar.iti.gov.br/duvidas.html
- https://suap.ifgoiano.edu.br/media/documentos/arquivos/2026_-_Normas_Disciplinares_5%C2%AA_Edi%C3%A7%C3%A3o.pdf
- https://docs.tjgo.jus.br/jij_goiania/portarias/Portaria_058_2019_Autorizacao_de_Viagem.pdf
- https://bibliotecadigital.mj.gov.br/bitstream/1/10215/2/Enunciado_ANPD_2023_1.html
- https://privacidade.unicamp.br/arquivo/uploads/guia-poder-publico-anpd-versao-final/
- https://basedeconhecimento.cgu.gov.br/server/api/core/bitstreams/b14501e2-aba9-4a92-acca-e0a0d34db03c/content
- https://www.migalhas.com.br/coluna/migalhas-criminais/445874/uso-de-prova-de-prints-de-whatsapp-a-luz-da-jurisprudencia-do-stj

**Navegador**
- https://webkit.org/blog/16574/webkit-features-in-safari-18-4/
- https://frequal.com/java/OggOpusStillNotWorkingInSafari18_4.html