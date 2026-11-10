## 1. Backend

- [x] 1.1 Conferir o que falta nas tabelas de conversa, mensagem e fila criadas em `V23` e criar `V24__whatsapp_conversations.sql` só com isso, ampliando a auditoria; verificar com teste de migration, ou registrar que `V24` não foi necessária.
- [x] 1.2 Gravar no webhook as mensagens recebidas e as enviadas pelo aparelho, com estado de entrega só avançando; verificar com evento fora de ordem e `source=api`.
- [x] 1.3 Criar worker de envio e download, com lease; verificar lease vencida e `UNCERTAIN` sem reenvio.
- [x] 1.4 Criar rotas de lista, histórico por cursor, leitura e mídia; verificar 403 por perfil, filtro de tipo, `nosniff` e paginação.
- [x] 1.5 Criar rotas de envio com `Idempotency-Key` e multipart, e de início de conversa com verificação do número; verificar clique duplo, gateway desligado e número inexistente.
- [x] 1.6 Criar rota de vínculo manual com saída aberta; verificar saída fechada e perfil sem permissão.
- [x] 1.7 Criar rotas de sessão e QR para a tela de conexão; verificar 403 e auditoria.
- [x] 1.8 Atualizar `SecurityConfiguration`, auditoria e OpenAPI; verificar com `mvnw verify`.

## 2. Frontend

- [x] 2.1 Criar serviço e modelos com guards estritos e multipart com CSRF; verificar com spec.
- [x] 2.2 Criar lista e conversa em duas colunas, e rotas separadas até 800 px; verificar com axe e 320 px em `e2e/conversations-local.spec.ts`.
- [x] 2.3 Implementar consulta periódica com pausa; verificar com timers falsos, inclusive parada ao destruir o componente.
- [x] 2.4 Implementar envio com estados, rascunho protegido e anexos; verificar na jornada.
- [x] 2.5 Implementar gravação de áudio, com permissão negada e parada das tracks; verificar com microfone falso no Playwright.
- [x] 2.6 Criar a tela de conexão com QR e estados da sessão; verificar com estados simulados.
- [x] 2.7 Adicionar item de menu e rotas para supervisor, com estado de demonstração; verificar em `app.spec.ts`.

## 3. Infraestrutura

- [x] 3.1 Liberar microfone, `media-src` e limite de upload nos dois nginx; verificar nos smokes, adicionando a checagem de `Permissions-Policy`.

## 4. Documentação

- [x] 4.1 Registrar a regra de acesso em `AGENTS.md` e a operação da aba em `docs/whatsapp/OPERACAO.md`; verificar por leitura.

## 5. Correções pós-implementação

- [x] 5.1 Responder 422 só para número confirmado como inexistente, conforme D15; verificar em `ConversationApiIntegrationTest`.
- [x] 5.2 Gravar o PDF da saída na conversa, conforme D13, com `V26`; verificar em `IntegrationFlowIntegrationTest`, sem envio duplicado e com falha de gravação.
- [x] 5.3 Reconciliar conversas ativas, conforme D14; verificar em `IntegrationFlowIntegrationTest`, com o limite por rodada.
- [x] 5.4 Mover os estilos para os componentes, conforme D16; verificar com `npm run build` e comparação de estilos calculados em 1366, 800 e 320 px.
