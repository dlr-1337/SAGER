## Context

Motivação em proposal.md. Estado atual, conferido no código desta branch:

- O vínculo automático (`guardian-authorization`, "Vinculação do arquivo ao pedido") liga cada imagem ou PDF recebido de um telefone com um único pedido aberto à saída, como arquivo `CANDIDATE` em `sager_guardian_authorization_file`. Os estados do arquivo são `CANDIDATE`, `ACCEPTED` e `REFUSED`, e o índice parcial `sager_authorization_file_message_unique` garante no máximo um arquivo não recusado por mensagem.
- A consulta das mensagens (`ConversationRepository`, constante `MESSAGE`, linhas 41-45) só calcula `unlinked` (não existe arquivo não recusado), e `linkable` (linhas 297-300) é verdadeiro para mensagem recebida, guardada, que não é áudio e está livre.
- O balão (`conversations-local.pages.ts`, linhas 765-775) mostra o botão "Vincular a uma saída longa" só com `linkable`. Para arquivo ligado, não mostra nada. Vincular de novo responde 409 `already_linked` (`LongExitService`, linha 860).
- Depois do vínculo manual, a tela mostra o aviso "Arquivo vinculado à saída de <nome>..." com o link "Abrir saída" (linhas 782-790) e recarrega as mensagens. O painel de vínculo some e o foco fica sem destino.
- A nota de falha de download (linha 691) já cobre o arquivo que não foi guardado.

## Goals / Non-Goals

**Goals:**

- O supervisor entende, olhando o balão, se o arquivo está livre ou em qual saída ele já está.
- Um único caminho por arquivo: ou o botão de vincular, ou o link para a saída.

**Non-Goals:**

- Mudar o vínculo automático, a conferência, a recusa ou a aprovação.
- Desfazer o vínculo pela conversa.
- Liberar arquivo ligado a saída encerrada.

## Decisions

### D1. Um campo novo na mensagem, `linkedExit`

A mensagem da API ganha `linkedExit`: `null` para arquivo livre, ou `{ id, residentName, fileState }`, com `fileState` igual a `CANDIDATE` ou `ACCEPTED`. `linkable` continua como está e fica falso quando há `linkedExit`.
*Rejeitada:* trocar `linkable` por um campo único de situação (`FREE`, `LINKED`, `FAILED`). Quebraria o contrato atual, e a falha já vem em `mediaState`.
*Rejeitada:* a tela consultar as saídas abertas para descobrir o vínculo. Seriam chamadas a mais e não acharia saída já encerrada.

### D2. Uma só leitura, com junção

A consulta das mensagens junta o arquivo não recusado da mensagem (no máximo um, pelo índice parcial), a saída e o nome do residente, na mesma leitura da página de mensagens.
*Rejeitada:* uma consulta por mensagem. Multiplica as idas ao banco a cada atualização automática da conversa.

### D3. Texto curto e um link no lugar do botão

Arquivo ligado mostra "Na saída longa de <nome> · aguardando conferência" (`CANDIDATE`) ou "Na saída longa de <nome> · conferido" (`ACCEPTED`) e o link "Abrir saída" para `/saidas/longas/<id>`. O identificador só aparece no endereço do link.
*Rejeitada:* manter o botão e mostrar o erro `already_linked` ao clicar. O supervisor clicaria em algo que sempre falha.
*Rejeitada:* mostrar o código curto ou a revisão do documento. É mais texto, e o detalhe da saída já mostra.

### D4. A situação é a do arquivo, não a do pedido

O balão diz o que o arquivo é (aguardando conferência ou conferido). Revisão do documento e situação do pedido ficam na saída, a um clique de "Abrir saída".
*Rejeitada:* um texto próprio para arquivo de revisão anterior ou de saída encerrada. É raro e acrescentaria frases que a tela da saída já explica.

### D5. Recusado volta a ser livre

Arquivo `REFUSED` não conta como vínculo, o mesmo critério do índice parcial e do vínculo manual. O balão volta a mostrar o botão.
*Rejeitada:* mostrar "recusado" no balão. O arquivo pode ser ligado de novo, e o histórico da recusa fica na saída.

### D6. Um só link para a saída depois do vínculo manual

O aviso de sucesso continua (é o anúncio para leitores de tela), mas sem o próprio "Abrir saída". Ao recarregar as mensagens, o foco vai para o "Abrir saída" do balão do arquivo vinculado.
*Rejeitada:* manter os dois links. Seriam dois controles fazendo a mesma coisa na mesma tela, o que o dono pediu para evitar.
*Rejeitada:* tirar o aviso. Some o anúncio de que o vínculo deu certo e de que a autorização continua pendente.

## Risks / Trade-offs

- Um arquivo ligado a uma saída que foi editada (revisão nova) ou encerrada sem conferência continua dizendo "aguardando conferência". → "Abrir saída" leva aos detalhes, que mostram a revisão e o estado do pedido. Arquivo de revisão anterior aparece em "Outros arquivos recebidos", sem conferir nem recusar, e a Ajuda não promete essas ações.
- Clientes da API que validem a mensagem de forma estrita passam a receber um campo a mais. → Só a interface do SAGER consome essa rota, e ela é atualizada na mesma change.

## O que o dono ou a instituição ainda decide

- Se um arquivo ligado a saída encerrada (rejeitada, cancelada ou concluída) sem conferência deve ficar livre para outra saída. Hoje continua ligado e a conversa mostra "aguardando conferência".
- Nada muda para o operador: sem migração nem configuração nova.
