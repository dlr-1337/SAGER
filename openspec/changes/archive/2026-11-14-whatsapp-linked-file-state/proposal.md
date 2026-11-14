## Why

Bug relatado pelo dono: quando o responsável manda mais de um PDF pelo WhatsApp, o botão "Vincular a uma saída longa" não aparece, e a conversa não diz por quê. A causa está no vínculo automático de `guardian-authorization` ("Vinculação do arquivo ao pedido"): com um único pedido aberto para o telefone, cada imagem ou PDF recebido já vira arquivo aguardando conferência daquela saída. A conversa só mostra o botão para arquivo livre e, para arquivo já ligado, não mostra nada. Vincular de novo daria 409 `already_linked`.

O pedido do dono de 14/11/2026 é que o sistema seja simples e didático para servidores com pouca prática e para quem tem TDAH: pouco texto, um caminho claro por tela, sem vários botões fazendo a mesma coisa. Um arquivo sem botão e sem explicação contraria isso.

Afeta `whatsapp-conversations` (requisitos "Histórico da conversa" e "Vínculo manual com saída longa") e a regra do `AGENTS.md` de que mensagem da conversa nunca autoriza saída, que continua igual.

## What Changes

- Na conversa, cada imagem ou PDF recebido mostra uma de três situações:
  - livre: o botão "Vincular a uma saída longa", como hoje;
  - ligado a uma saída longa: o texto "Na saída longa de <nome do residente> · aguardando conferência" (ou "· conferido") e o link "Abrir saída" para o pedido, sem o botão;
  - falha ao baixar: a nota de falha atual, sem botão e sem situação.
- Arquivo recusado na saída volta a aparecer livre, com o botão.
- A API de mensagens da conversa passa a informar, para arquivo ligado, a saída, o nome do residente e a situação do arquivo. A tela não mostra identificadores.
- Depois do vínculo manual, o aviso de sucesso continua, mas perde o próprio link "Abrir saída", que passa a existir só no balão do arquivo; o foco vai para esse link.

**Fora do escopo:** mudar o vínculo automático (`guardian-authorization`, "Vinculação do arquivo ao pedido"); deixar o supervisor desfazer o vínculo pela conversa (a saída já tem "Recusar arquivo"); liberar arquivo ligado a saída encerrada; mudar conferência, recusa ou aprovação.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `whatsapp-conversations`: requisito novo "Situação do arquivo recebido na conversa".

## Impact

- Backend: `conversations/ConversationRepository.java` (consulta das mensagens e o registro da mensagem); teste `ConversationApiIntegrationTest`. Sem migração: o vínculo já está em `sager_guardian_authorization_file`.
- Frontend: `conversations.models.ts`, `conversations-api.service.ts` (validação da resposta), balão e aviso de sucesso em `conversations-local.pages.ts`; specs `conversations-api.service.spec.ts` e `conversation-thread.component.spec.ts`; e2e `conversations-local.spec.ts`.
- Documentação: `docs/MANUAL.md` (item Conversas do supervisor) e uma pergunta na página Ajuda. `AGENTS.md` e `docs/ARQUITETURA.md` não mudam: a regra do vínculo é a mesma.
