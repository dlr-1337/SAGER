## 1. Banco

- [x] 1.1 Criar `V23__whatsapp_authorization.sql` conforme D5 e D6, com CHECKs, `verified_by`, `signed_media_type`, trigger, `sager_guardian_authorization_file` e auditoria; verificar com teste de migration em Testcontainers.
- [x] 1.2 Invalidar bindings abertos do provedor antigo na migration; verificar no mesmo teste.

## 2. Gateway

- [x] 2.1 Criar `WhatsAppGateway` e `WahaWhatsAppGateway`, contra o contrato da imagem fixada, e substituir `IntegrationProperties` e `IntegrationConfiguration`; verificar com teste de contrato usando double HTTP e `IntegrationConfigurationTest`.
- [x] 2.2 Reescrever o webhook com HMAC SHA-512 em bytes brutos, filtros e idempotência; verificar por teste com assinatura válida, inválida e ausente, evento repetido, grupo e item malformado.
- [x] 2.3 Corrigir o envenenamento de `consumeInbox`; verificar por teste com evento que lança exceção.
- [x] 2.4 Implementar identidade com LID e nono dígito, e normalização em `GuardianService`; verificar com testes unitários e de integração.
- [x] 2.5 Implementar download de mídia com validação de caminho, lista de tipos e 10 MiB; verificar com caso de URL externa, que não envia a chave.
- [x] 2.6 Implementar reconciliação periódica e o estado da sessão; verificar por teste de integração com evento perdido.

## 3. Autorização

- [x] 3.1 Remover Clicksign, Meta e acesso por token (`SignatureProvider`, `ClicksignHttpProvider`, `MetaWhatsAppHttpProvider`, `SignatureAccess*`), com a exceção de CSRF correspondente; verificar com `mvnw verify`.
- [x] 3.2 Enfileirar o envio direto em `LongExitService.binding` e enviar o PDF no worker; verificar por teste de fluxo, sem tentativa com gateway desligado.
- [x] 3.3 Implementar a correlação D7 e a vinculação manual; verificar com único pedido, irmãos, citação e número desconhecido.
- [x] 3.4 Criar rotas de conferência, recusa, anexo manual e download de candidato, só para supervisor; verificar permissões, `stale_document`, versão e divergência de remetente.
- [x] 3.5 Ajustar `decide` à nova condição e `download` ao tipo real do arquivo; verificar com `signature_required` e arquivo corrompido.
- [x] 3.6 Reduzir dados no PDF e subir `TERM_VERSION`; verificar lendo o texto do PDF em teste.
- [x] 3.7 Atualizar `AuditResource`, `AuditRepository` e OpenAPI; verificar que eventos aparecem na consulta e não trazem conteúdo.

## 4. Frontend

- [x] 4.1 Apagar `features/signature/*`, as rotas e referências; verificar com `npm run build`.
- [x] 4.2 Atualizar `long-exit.models`, `long-exit-api.service` e `long-exit.utils` para o contrato novo; verificar com spec dos guards.
- [x] 4.3 Trocar o painel do detalhe por documento enviado, arquivos recebidos e confirmação, com anexo manual e alertas; verificar em `e2e/long-exits-local.spec.ts`, com axe e largura de 320 px.
- [x] 4.4 Atualizar a demonstração e os textos de portal, formulário e relatórios; verificar em `operations-demo.service.spec.ts` e `e2e/journeys.spec.ts`.

## 5. Infraestrutura

- [x] 5.1 Adicionar o serviço do gateway, fixado por digest, sob perfil `whatsapp` nos três compose, com volume próprio, segredos e dashboard e swagger desligados; verificar com `docker compose config` e subindo em local sem parear número.
- [x] 5.2 Ajustar nginx de produção e coolify: remover hosts do Clicksign da CSP, criar limite de upload para o anexo manual; verificar com os smokes.
- [x] 5.3 Isolar o gateway conforme D4 e D16, nos três compose, com `whatsapp-gateway-proxy` e três redes, sem `network_mode: service:backend`; verificar com `docker compose config` e, em containers descartáveis, que o gateway não alcança `backend:8080` e que o proxy só deixa passar o POST do webhook.
- [x] 5.4 Tornar a subida do gateway opcional e não fatal em `infra/coolify/start.sh`, com limites de D16; verificar com os testes de `infra/coolify` e parando o gateway com o SAGER no ar.

## 6. Documentação

- [x] 6.1 Atualizar `AGENTS.md`, PRD, `PRODUCT.md`, `docs/fase-0/INTEGRACOES.md`, `docs/fase-4/CONTRATO.md` e `infra/production/README.md`; verificar por busca por "Clicksign" e "assinatura válida".
- [x] 6.2 Criar `docs/whatsapp/OPERACAO.md`, com vinculação, cuidados com o número, banimento, atualização e teste de aceite; verificar por leitura.
- [x] 6.3 Conferir `OPERACAO.md` e `docs/fase-7/COOLIFY.md` com os três compose; verificar por leitura e `docker compose config --services` com o perfil ligado.

## 7. Correções pós-implementação

- [x] 7.1 Expor o nome de quem conferiu e decidiu, conforme D17, e mostrá-lo sem identificador técnico; verificar em `IntegrationFlowIntegrationTest`, `long-exit-api.service.spec.ts` e `e2e/long-exits-local.spec.ts`.
