## Why

A equipe quer falar com os responsáveis sem usar o celular: ler mensagens, ouvir áudios, ver fotos e responder dentro do SAGER, deixando o WhatsApp só como canal. Como o gateway já recebe e envia mensagens, falta a aba de conversa.

Essa aba precisa existir em separado da autorização: a conversa livre não tem pedido associado, e o risco de privacidade é outro, porque pode trazer dado de saúde ou conteúdo sobre adolescentes.

Depende da change `replace-signature-with-whatsapp-authorization`.

## What Changes

- Nova aba **Conversas**, só para supervisor, com lista de conversas e histórico de cada uma.
- Texto, imagem, documento e áudio recebidos ficam disponíveis no sistema.
- O supervisor envia texto, imagem, documento e áudio gravado no navegador.
- Iniciar conversa é possível só com responsável cadastrado, o que reduz mensagem fria e risco de banimento.
- Um arquivo da conversa pode ser vinculado manualmente a uma saída longa aberta.
- Atualização por consulta periódica, pausada com a aba oculta ou sem interação.
- A tela de conexão fica em `/conversas/conexao`.
- Aviso permanente: não usar o canal para dado de saúde.

**Fora do escopo:** contagem de não lidas no menu, grupos, reações, edição de mensagens, SSE, conversas na demonstração (a tela indica que exige modo local), retenção automática (depende de decisão institucional) e acesso do gestor.

## Capabilities

### New Capabilities

- `whatsapp-conversations`: consulta, envio e controle de acesso às conversas de WhatsApp dentro do sistema.

### Modified Capabilities

Nenhuma.

## Impact

- **Backend:** novo pacote `conversations`, `SecurityConfiguration`, `AuditResource`, OpenAPI, migration `V24` só com o que faltar além de `V23`.
- **Frontend:** `conversations-api.service.ts`, `conversations.models.ts`, `conversations-local.pages.ts`, rotas e menu.
- **Infraestrutura:** `Permissions-Policy microphone=(self)`, CSP com `media-src 'self' blob:` e limite de upload para o envio.
- **Regra:** `AGENTS.md` ganha a regra de acesso às conversas.
