# Operação do WhatsApp no SAGER

Guia para quem opera o número e o servidor. As regras de negócio estão nas specs de [autorização do responsável](../../openspec/specs/guardian-authorization/spec.md) e do [gateway de WhatsApp](../../openspec/specs/whatsapp-gateway/spec.md), e os motivos da escolha na [decisão sobre o WhatsApp](../ARQUITETURA.md#7-whatsapp-auto-hospedado-e-desligado-por-padrão).

**Antes de tudo:**

- O SAGER usa o WAHA, um gateway **não oficial**. Isso viola os termos do WhatsApp e pode levar a banimento do número e a veto da organização. Nenhum cuidado elimina esse risco.
- Nada foi testado com número real. Só use em produção depois do [teste de aceite](#teste-de-aceite-obrigatório) e do aceite formal da instituição.
- Se o WhatsApp parar, a operação continua: o supervisor anexa o arquivo manualmente no pedido.

## O que o sistema faz e o que não faz

- Envia o PDF da saída longa ao responsável, recebe o arquivo devolvido e guarda uma cópia no SAGER.
- Nenhuma mensagem autoriza nada. Um supervisor confere o arquivo e, em outro passo, decide o pedido.
- Em **Conversas**, o supervisor troca mensagens com responsáveis, sem pegar o celular. Só supervisores acessam. O PDF enviado pelo pedido aparece na conversa daquele responsável, sem novo envio.
- Não faz envio em massa, grupos nem automação.

### Redação recomendada da limitação

Use este texto em comunicados e no termo institucional:

> O SAGER registra autorizações de responsáveis recebidas pelo WhatsApp, inclusive foto de documento assinado à mão. Esse registro comprova que um arquivo foi recebido de determinado número, em data e hora registradas pelo sistema, e que não mudou desde o recebimento. Não comprova, por si só, a autoria da assinatura, e não constitui assinatura eletrônica nos termos da Lei 14.063/2020, salvo quando o arquivo trouxer assinatura criptográfica validada, caso em que se registram o nível e o resultado da validação. A aceitação é ato humano de servidor autorizado, que confere documento, revisão e responsável. Havendo dúvida ou impugnação, a instituição pode exigir o original ou confirmar por outro meio. A autorização refere-se à saída do alojamento e não substitui autorização de viagem exigida pelo ECA ou pelo transportador. O enquadramento depende de validação institucional, e o uso de integração não oficial do WhatsApp não tem contrato com o provedor.

Hoje o SAGER não valida assinatura criptográfica. Enquanto isso não existir, o trecho "salvo quando..." não se aplica a nenhum arquivo.

## 1. Preparar o número e o aparelho

1. Use um **número dedicado**, que não seja o principal da instituição.
2. Use um celular próprio, ligado na tomada, com internet, em local institucional, e com **uma pessoa responsável nomeada**.
3. Use o aparelho de verdade pelo menos uma vez por semana. Aparelhos vinculados são desconectados se o celular ficar sem uso por mais de 14 dias, e há desconexão automática após 30 dias de inatividade do vinculado.
4. Guarde em local seguro os dados da conta do número e o acesso à chave de acesso (passkey), se existir.

## 2. Preparar o servidor

O gateway fica na mesma VPS do SAGER e não pode derrubá-lo.

**Requisitos:** no mínimo **2 vCPU e 4 GB de RAM, mais swap**. Os 2 GB avaliados antes não comportam os limites somados, de 2.432 MiB. Em ociosidade e sem sessão, a imagem usou cerca de 440 MiB de RAM; com os limites de memória, 294 MiB. Com número vinculado, ainda não há medição.

**Isolamento:** o gateway não divide rede com o backend. O serviço `whatsapp-gateway-proxy` fica entre os dois e, do gateway para o backend, deixa passar só o POST do webhook.

**Segredos:** crie dois valores aleatórios e distintos, fora do repositório, nos arquivos `waha_api_key` e `waha_webhook_hmac` de `SAGER_SECRETS_DIR`. Em produção e no Coolify, os dois precisam existir mesmo com o WhatsApp desligado, porque o backend os monta e o Docker criaria um diretório no lugar de arquivo ausente. Localmente, `./sager up` gera os valores em `.env.local`. O gateway nunca recebe segredos do banco, volumes do SAGER nem o socket do Docker.

**Regra no host (obrigatória):** a saída do gateway alcança portas publicadas do host, como o painel do Coolify. Bloqueie a sub-rede de `whatsapp_egress`, fixa em `10.250.77.0/24` nos três arquivos compose, para redes privadas e para o IP público da VPS, em `DOCKER-USER`. Troque `IP_PUBLICO` pelo valor real:

```sh
iptables -I DOCKER-USER -s 10.250.77.0/24 -d 10.0.0.0/8 -j DROP
iptables -I DOCKER-USER -s 10.250.77.0/24 -d 172.16.0.0/12 -j DROP
iptables -I DOCKER-USER -s 10.250.77.0/24 -d 192.168.0.0/16 -j DROP
iptables -I DOCKER-USER -s 10.250.77.0/24 -d 169.254.0.0/16 -j DROP
iptables -I DOCKER-USER -s 10.250.77.0/24 -d IP_PUBLICO -j DROP
```

Essas regras não sobrevivem a um reinício sozinhas: use o mecanismo de persistência da VPS. Depois de ligar e de cada reinício, confira que o gateway não alcança o painel do Coolify nem o IP público da VPS.

**Configuração do gateway.** Já está nos três arquivos compose, com a imagem fixada por digest; não precisa ser preenchida. Sem o item de eventos, as mensagens enviadas pelo celular não chegam ao SAGER:

| Variável | Valor |
|---|---|
| `WHATSAPP_DEFAULT_ENGINE` | `GOWS` |
| `WHATSAPP_HOOK_URL` | `http://whatsapp-gateway-proxy:8080/api/v1/integracoes/whatsapp/webhook` |
| `WHATSAPP_HOOK_EVENTS` | `message.any,message.ack,session.status` |
| `WHATSAPP_HOOK_HMAC_KEY`, `WAHA_API_KEY` | lidos dos segredos do item anterior |
| `WHATSAPP_HOOK_RETRIES_POLICY`, `_DELAY_SECONDS`, `_ATTEMPTS` | `constant`, `60`, `15`: 15 minutos, acima dos **10 minutos** da janela de backup e deploy |
| `WHATSAPP_FILES_FOLDER`, `WHATSAPP_FILES_LIFETIME` | `/app/.media`, `86400` (arquivos do gateway por 24 horas) |
| `WAHA_DASHBOARD_ENABLED`, `WHATSAPP_SWAGGER_ENABLED` | `false` |

**Configuração do backend:** só `SAGER_INTEGRATIONS_WHATSAPP_ENABLED=true`, no arquivo de ambiente. O endereço `http://whatsapp-gateway-proxy:3000` e os dois segredos vêm do compose. Faltando algum valor, ou com chave igual ao segredo, o backend se recusa a subir.

## 3. Ligar o perfil

Com o SAGER já saudável e `SAGER_INTEGRATIONS_WHATSAPP_ENABLED=true` no arquivo de ambiente, em produção:

```sh
docker compose --env-file /caminho/privado/sager.env -f infra/production/compose.yml \
  --profile whatsapp up -d
```

No Coolify, `infra/coolify/start.sh` já sobe o gateway quando a variável está ligada, e o build do [runbook](../../infra/coolify/README.md) baixa a imagem, porque o `up` usa `--pull never`. Localmente, acrescente também `COMPOSE_PROFILES=whatsapp` em `.env.local` e rode `./sager up`.

O gateway é opcional: se ele não subir, o SAGER continua no ar, mostrando o WhatsApp como indisponível.

## 4. Vincular pelo QR

1. Entre como supervisor e abra **Conversas > Conexão do WhatsApp**.
2. Inicie a sessão. Quando aparecer **Aguardando leitura do QR Code**, leia o código com o celular do número, em **Aparelhos conectados**.
3. Aguarde **Conectado**.

O QR equivale à posse da conta: não o fotografe nem o compartilhe. A leitura fica registrada na auditoria.

### Passkey

Se aparecer **Chave de acesso necessária** ou **Confirmação da chave de acesso**, o dono do número precisa concluir o pedido no celular. Isso não se resolve pelo SAGER. A tela atualiza sozinha.

## 5. Quando cair

Observe a **Conexão do WhatsApp**, incluindo o horário do último evento. Sessão aparentemente conectada, mas sem eventos há muito tempo, ou envio sem confirmação, também é sinal de queda.

| O que aparece | O que fazer |
|---|---|
| **Desligado** | A integração não foi ligada neste ambiente. Quem opera o servidor verifica a configuração. |
| **Parado** ou **Com falha** | Inicie de novo. Se voltar o QR, leia outra vez. |
| **Aguardando leitura do QR Code** depois de ter funcionado | A vinculação caiu. Veja se o celular está ligado e com internet, e leia o QR de novo. |
| Gateway inalcançável | Veja se o container está no ar e os logs, sem expor segredos. |
| Pedido avisa falta de confirmação em 15 minutos | Fale com o responsável por outro canal e anexe o arquivo manualmente. |

**Nunca insista em parear ou reiniciar se o WhatsApp informar bloqueio temporário.** Espere o prazo acabar. Repetir pode agravar a situação.

Mensagens perdidas: a cada 2 minutos, o SAGER busca as mensagens recebidas que faltaram, nos telefones com autorização pendente e em até 20 conversas com atividade nas últimas 24 horas. Conversa parada há mais tempo não é consultada, e o que foi enviado pelo celular durante a queda não volta: confira no celular.

## 6. Se o número for banido

1. **Não tente burlar nem vincular outro número em seguida.** Encerrada a conta, os termos dizem que a empresa não pode criar outra sem permissão escrita, e a política permite vetar a organização.
2. Avise a Assistência Estudantil e a TI. Quem decide o próximo passo é a instituição.
3. Registre data, hora e a mensagem exibida no aplicativo.
4. Se o aplicativo oferecer revisão, peça por ali, em geral com resposta em até 24 horas. Sem essa opção, o banimento é final. Terceiros não desbanem.
5. Continue a operação com **anexo manual**: o documento pode ser entregue em mãos ou por outro canal autorizado. O histórico já recebido continua no SAGER, e no celular fica inacessível durante o banimento.
6. Desligue o perfil `whatsapp` até haver decisão.

A saída de longo prazo é a Cloud API por provedor oficial, que exige contratação e novo adaptador, e tem limites próprios para número banido (ver a [decisão sobre o WhatsApp](../ARQUITETURA.md#7-whatsapp-auto-hospedado-e-desligado-por-padrão)).

## 7. Cuidados para reduzir o risco

Reduzem a exposição, mas não tornam o uso permitido nem garantem nada.

- Peça ao responsável, no cadastro, para salvar o número e **escrever primeiro**. O SAGER escreve primeiro no fluxo de saída, que é o pior ponto.
- Envie só mensagens individuais, ligadas a um pedido real. Nada de grupos, status, lista de transmissão ou envio em massa.
- Não reserve nome de usuário no número sem testar antes.
- Não use técnicas para burlar detecção.
- Oriente a equipe a não tratar assuntos de saúde pelo canal.

## 8. Atualizar a imagem

Ficar parado também derruba a sessão: fixar a versão não significa congelar. Sugestão: reveja as versões **pelo menos uma vez por mês**.

1. Leia o changelog e as issues abertas da nova versão.
2. Em ambiente separado, com o número de teste, suba a nova imagem e repita ao menos: vinculação, envio de PDF, recebimento de foto e PDF, webhook com HMAC e início de sessão depois de reinício.
3. Se passar, troque a imagem e o digest no compose. Se falhar, mantenha a versão anterior.
4. Depois de atualizar, confira **Conectado** e faça um envio real de teste.

A imagem hoje homologada só quanto ao contrato da API é `devlikeapro/waha:gows-2026.10.1`, com digest `sha256:1f7faeb0227ad5edb5711f7058bfce807ea65e5f92234af0778e4db140f6eb46`.

## 9. Backup

- **O que entra:** banco e documentos do SAGER, pelo backup normal de [`infra/production/README.md`](../../infra/production/README.md). Mensagens ficam no banco, e os arquivos, no volume de documentos.
- **O que fica de fora:** o volume `waha_sessions`. Copiar a sessão equivale a copiar a posse do número. Se a VPS cair, vincula-se de novo.
- O backup pausa o backend. As retentativas do webhook cobrem essa janela, e a reconciliação cobre o resto, nos limites da [seção 5](#5-quando-cair).

## 10. Monitorar o disco

Disco cheio derruba o PostgreSQL. Alerte em **80%** de uso.

```sh
df -h
docker system df -v
```

Olhe em especial o volume de documentos e o do gateway. Cada arquivo tem limite de 10 MiB, mas **não há cota global** nem apagamento automático de mensagens e arquivos no SAGER até a instituição definir a retenção.

## Teste de aceite obrigatório

Só com **número de teste** e dados sintéticos. Bloqueia o uso em produção. Registre data, versão da imagem, resultado e quem executou.

- [ ] Vinculação nova, com e sem passkey.
- [ ] Envio de PDF; recebimento de foto, PDF e áudio.
- [ ] Contato salvo e não salvo, incluindo caso que chega só como LID.
- [ ] Número antigo, sem o nono dígito.
- [ ] Primeiro envio a contato novo, medindo o tempo até a confirmação e a ocorrência do erro 463.
- [ ] SAGER fora por 10 minutos e gateway fora por 1 hora.
- [ ] Reinício com mensagem em trânsito.
- [ ] Celular desligado por um dia e mídia baixada com atraso.
- [ ] Áudio gravado no Chrome e no Safari, ouvido em Android e iPhone.
- [ ] RAM real, com número vinculado.

Inclua também o que os testes do repositório não cobrem: conversão de áudio pelo gateway dentro do limite de 20 segundos, reenvio do webhook pelo gateway depois de resposta 503, e reprodução de áudio no Safari.

## Decisões institucionais pendentes

A instituição decide (Procuradoria, encarregado de dados, Assistência Estudantil e TI). O código não resolve nenhuma delas:

1. Nível mínimo de assinatura para este ato. **Se for avançado, a foto deixa de bastar como único meio.**
2. Aceite formal do uso de integração não oficial e do risco de veto ao número e à organização.
3. Regulamento de residências vigente e forma aceita de autorização; se a foto basta.
4. Base legal, finalidade, melhor interesse e relatório de impacto para dados de adolescentes.
5. Papel da Meta e transferência internacional de dados.
6. Conduta para o ECA art. 83, que esta autorização não substitui.
7. Se o enquadramento é de entidade governamental, com provedor oficial obrigatório.
8. Prazo de retenção de mensagens e arquivos.
9. Aviso a responsáveis e residentes, e quem da equipe pode ler as conversas, além do supervisor.
10. Conduta quando chega dado de saúde pela conversa.
11. Quem cadastra e confirma o número do responsável, e como agir em troca de número, guarda ou tutela.
