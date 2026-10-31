## Why

Hoje os responsáveis autorizam a saída longa recebendo um documento pelo WhatsApp e devolvendo-o assinado, à mão, em foto, digitalmente ou de outro jeito. O SAGER exige outro fluxo: provedor externo de assinatura, convite por link e WhatsApp só por template oficial. Nenhum desses serviços foi contratado, então a saída longa não funciona fora de simulação. O dono do produto decidiu não usar provedor externo de assinatura e manter o fluxo que as pessoas já usam.

A pesquisa em [`docs/whatsapp/PESQUISA.md`](../../../docs/whatsapp/PESQUISA.md) escolheu como gateway o WAHA com motor GOWS, em vez da Evolution API inicialmente cogitada: a Evolution API tem manutenção parada desde dezembro de 2025, usa uma faixa de Baileys sujeita ao CVE-2026-48063 (forja de mensagem recebida) e não assina o corpo do webhook.

**Esta change substitui um requisito do PRD.** RF, AC39–AC44 e D16/D25 pediam assinatura eletrônica por link. O fluxo novo não é assinatura eletrônica: é uma autorização recebida e conferida por um servidor. Fica de pé a regra de `AGENTS.md` de que entrega de mensagem nunca aprova nada. A regra de "assinatura verificada contra a revisão e PDFs íntegros" é reescrita para conferência humana.

## What Changes

- **BREAKING:** remove o Clicksign, o provedor Meta, o convite público `/assinatura/*` e a conferência automática com provedor.
- O sistema gera o PDF da autorização e o envia ao responsável por um gateway WhatsApp auto-hospedado, desligado por padrão.
- O arquivo devolvido pelo responsável (foto, PDF ou outro documento) vira candidato vinculado ao pedido quando a correlação é segura.
- Um supervisor confere o arquivo, confirma ou recusa, e depois decide o pedido em etapa separada.
- Sem gateway, ou com ele fora do ar, o supervisor anexa o arquivo recebido por outro meio. A operação nunca depende só do WhatsApp.
- O PDF passa a ter campo de assinatura, código curto da revisão e menos dados pessoais, porque agora trafega pelo WhatsApp.
- Telas e documentos deixam de dizer "assinatura válida" e passam a dizer "autorização conferida".
- O telefone do responsável é normalizado no cadastro.

**Fora do escopo:** aba de conversas (change `add-whatsapp-conversations`), adaptador da Cloud API oficial, motor de nível de assinatura e validação criptográfica de PDF.

## Capabilities

### New Capabilities

- `whatsapp-gateway`: conexão com o gateway, autenticidade dos eventos, identidade do remetente, resiliência e estado da sessão.
- `guardian-authorization`: envio do documento, recebimento e correlação do arquivo, conferência humana e aprovação da saída longa.

### Modified Capabilities

Nenhuma. Não há specs principais anteriores no OpenSpec; o comportamento substituído está no PRD e em `docs/fase-4/CONTRATO.md`.

## Impact

- **Backend:** `integrations/*`, `operations/longexits/*`, `management/guardians`, `SecurityConfiguration`, `AuditResource`, OpenAPI, migration `V23`.
- **Frontend:** `features/signature/*` removido; detalhe, formulário e API de saída longa; rotas; textos de portal e relatórios; demonstração.
- **Infraestrutura:** três arquivos compose, `nginx.conf.template` de produção e coolify, smoke e backup.
- **Documentos:** `AGENTS.md`, PRD, `PRODUCT.md`, `docs/fase-0/INTEGRACOES.md`, `docs/fase-4/CONTRATO.md`, `infra/production/README.md`, e o novo `docs/whatsapp/OPERACAO.md`.
- **Dependência externa nova:** imagem `devlikeapro/waha:gows-2026.10.1`, fixada por digest.
