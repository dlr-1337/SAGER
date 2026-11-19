## Context

Motivação em proposal.md.

**O shell hoje** (`app.html`, `app.ts`, `app.scss`):
- cabeçalho e menu fixos desde o PR #34;
- o menu é montado por perfil em `navItems`;
- no celular, o botão "Menu" abre a gaveta com os mesmos itens.

**Atualização das telas:** `core/auto-refresh.ts` consulta a cada 15 s com a aba visível. Ela pausa depois de 30 minutos sem interação e marca a consulta com `X-Sager-Auto-Refresh: 1`, para o servidor não renovar a sessão.

**Dados que já existem:**
- saídas curtas e longas, com situação e horários;
- notificações de ocorrência, com situação e `requires_review`;
- chamada noturna, com situação `ABERTA` ou encerrada;
- conversas do WhatsApp, com uma marca de leitura (`read_at`) e mensagens com direção;
- comunicações do residente (`sager_communication`), com destinatário e `acknowledged_at`.

## Goals / Non-Goals

**Goals:**
- mostrar no menu, no "Menu" do celular e nas abas quantos itens esperam o supervisor ou o residente;
- usar só dados que o perfil já vê, com as mesmas regras de acesso;
- não manter a sessão viva nem consultar numa aba oculta ou numa estação esquecida.

**Non-Goals:**
- marcar algo como lido;
- avisos fora da tela (push, e-mail, som);
- criar marcas de leitura novas no banco.

## Decisions

### D1. Uma consulta com um número por item

`GET /api/v1/me/pendencias` devolve um objeto só com os campos do perfil:
- supervisor: `shortExits`, `longExits`, `notifications`, `nightCalls` e `conversations`;
- residente: `notices`, `warnings` e `terms`.

A consulta faz um único `SELECT` de leitura, com resposta `Cache-Control: no-store`. O gestor recebe 403, e quem não tem sessão, 401. Os outros métodos caem no `denyAll` (403).

*Rejeitadas:*
- contar no navegador com as listas que já existem. Seriam 5 consultas paginadas a cada ciclo, e a página não traz o total;
- uma consulta por item. Seriam 5 consultas por ciclo para o supervisor;
- 200 com objeto vazio para o gestor. A API ficaria aberta para um perfil sem uso, contra "API fechada fora dos ambientes conhecidos".

### D2. Saídas: o que o supervisor ainda pode decidir ou registrar

Uma saída curta ou longa conta em dois casos:
- aguarda análise e ainda está no prazo. O pedido agendado vale até a hora de saída pedida; o pedido para sair agora vale até o retorno previsto. Esses são os mesmos limites em que o servidor aceita a decisão;
- foi aprovada, a hora de saída pedida chegou, a saída não foi registrada e o retorno previsto não passou. Aí o supervisor precisa registrar a saída.

A saída longa à espera da autorização do responsável conta, porque a conferência é do supervisor.

*Rejeitadas:*
- contar tudo que está "aguardando análise". Um pedido vencido fica nessa situação até a rotina de expiração rodar, e o contador mostraria algo que ninguém pode decidir;
- contar saídas em andamento. Nada espera o supervisor até a volta, e o atraso já abre uma ocorrência e uma notificação, que entram em "Notificações de ocorrência".

### D3. Notificações: decisão ou conferência de origem corrigida

Contam as notificações:
- `PENDENTE`, `VISUALIZADA` e `EM_ANALISE`;
- `CONVERTIDA` com `requires_review` cuja ocorrência continua válida. Ali, "Confirmar registro atual" tira a marca.

*Rejeitadas:*
- só `PENDENTE`. Abrir a notificação não é decidir;
- `CONVERTIDA` com `requires_review` em qualquer caso. Com a ocorrência anulada, não há ação que tire a marca, e o contador ficaria preso.

### D4. Chamada noturna: a chamada aberta

Conta a chamada com situação `ABERTA`. O pedido falou em "chamadas noturnas para aprovar". O modelo não tem aprovação de chamada: o que espera o supervisor é marcar todos e encerrar.

*Rejeitadas:*
- contar os residentes ainda sem marca. O número chegaria a dezenas e não diz que só há uma tarefa;
- contar a chamada ainda não aberta na noite. Isso depende de um horário de chamada que a instituição não definiu.

### D5. Conversas: com mensagem recebida depois da última leitura

Conta a conversa que tem mensagem recebida (`IN`) depois de `read_at`, ou sem leitura nenhuma. A mensagem enviada pelo supervisor não conta. Abrir a conversa grava a leitura, como hoje.

*Rejeitadas:*
- contar mensagens. O item do menu é "Conversas", e o número cresceria a cada mensagem da mesma conversa;
- leitura por supervisor. Precisaria de tabela nova; hoje a marca é única e compartilhada.

### D6. Residente: comunicações vigentes sem ciência

Contam os avisos, advertências e termos `PUBLICADO` destinados ao residente sem `acknowledged_at`. Os números saem separados por tipo, para as abas de "Minhas comunicações". Abrir o item não conta como ciência, como a tela já diz, e o contador só cai com a ciência.

Itens retirados, superados ou anulados, rascunhos e itens de outros residentes não entram. A consulta filtra pelo residente ligado à conta, e a conta sem vínculo recebe 403 `resident_link_required`.

*Rejeitadas:*
- contar os não lidos (`read_at`). O que a regra pede ao residente é a ciência;
- contar decisões de saída do residente. Não existe marca de "visto" para a decisão, e criá-la pede migração e uma regra nova (pergunta abaixo).

### D7. O que fica sem contador

O pedido citou "avaliação de limpeza para fazer" e "alguma advertência" para o supervisor. Ficam sem contador:
- **Limpeza.** O modelo não tem período nem prazo de avaliação por quarto. "Quarto sem nota" nunca zeraria, ou dependeria de um período que a instituição não definiu.
- **Advertências e avisos do supervisor.** Depois de emitida, a advertência não espera o supervisor. O que espera é a notificação de ocorrência, que já conta. A ciência do residente é pendência do residente.
- **Ranking, cadastros e relatórios.** Não têm tarefa à espera.
- **Gestor.** Nada da rotina dele espera uma ação com prazo.

*Rejeitada:* contar advertências sem ciência do residente no menu do supervisor. Não há ação do supervisor, e o número ficaria alto por semanas.

### D8. Número com texto para o leitor de tela; "Menu" com descrição

O contador é o componente `sager-pending-badge`:
- mostra o número num selo âmbar com borda ("amarelo espera alguém", DESIGN.md);
- acima de 99, mostra "99+";
- tem um texto oculto "N pendentes" com o número exato, que entra no nome do link ou da aba;
- com zero, não desenha nada.

No botão "Menu", o selo mostra a soma, e `aria-describedby` aponta para "N pendentes no menu". O nome continua "Menu".

*Rejeitadas:*
- ponto sem número. O dono pediu o número, e o ponto dependeria só de cor e forma;
- mudar o nome do botão para "Menu, 6 pendentes". Quebraria o comando de voz "clicar Menu" e os testes que procuram o botão pelo nome;
- anunciar a mudança com `aria-live`. Interromperia o leitor de tela a cada 30 segundos.

### D9. Atualização própria a cada 30 s

O serviço `PendingBadgesService` (raiz) consulta:
- ao entrar;
- a cada troca de tela;
- logo depois de uma gravação bem-sucedida, avisada por `core/api.ts`;
- a cada 30 s com a aba visível;
- ao voltar à aba.

A consulta sempre leva `X-Sager-Auto-Refresh: 1` e por isso não renova a sessão. Depois de 30 minutos sem clique ou tecla, ela para até a próxima troca de tela. Uma falha mantém os números anteriores; um 401 leva à página de acesso pelo tratamento central de `api()`. Os números ficam presos ao id da conta, para outra conta na mesma aba não ver os anteriores. A resposta é conferida campo a campo para o perfil; resposta fora do formato é ignorada.

*Rejeitadas:*
- usar `autoRefresh()`. Ela vive no ciclo de um componente e espera quando há formulário alterado ou diálogo aberto; o contador pararia enquanto o supervisor preenche um formulário longo;
- envio pelo servidor (SSE ou WebSocket). Pede mudança no proxy e mantém conexão aberta;
- 15 s, como as telas. Dobra as consultas por uma informação de apoio.

### D10. Demonstração com os dados em memória

O módulo `features/portal/pending-badges-demo.ts` calcula os números a partir dos sinais de `OperationsDemoService` e `NoticesDemoService`, com as regras de D2, D3, D4 e D6. Ele é carregado por `import()` só quando a demonstração está ativa. Fora do cenário "Padrão", não há números. Um relógio do serviço, avançado a cada 30 s, faz a saída aprovada passar a contar quando a hora chega.

*Rejeitadas:*
- números fixos. Ficariam errados depois que o visitante aprovasse uma saída ou desse ciência;
- importar os serviços da demonstração no shell. O pacote inicial cresceria com código que a produção não usa.

### D11. Sem migração

As tabelas já têm o que é preciso. As contagens usam os índices de situação das saídas e as chaves das conversas e dos destinatários. O volume de uma residência é de centenas de registros.

*Rejeitada:* tabela de contadores mantida a cada gravação. Duplicaria a regra em vários serviços e poderia ficar fora de sincronia.

## Risks / Trade-offs

- **Contagem atrasada:** depois de uma ação de outra pessoa, o número pode levar até 30 s para mudar. As próprias gravações atualizam na hora.
- **Leitura compartilhada das conversas:** um supervisor que abre a conversa a tira do contador de todos.
- **Consulta a cada 30 s por aba visível:** é um `SELECT` de contagem, leve no volume da residência.

## O que a instituição e o operador ainda decidem

1. Se a avaliação de limpeza tem período (por exemplo, semanal por quarto). Só com o período ela pode entrar no contador.
2. Se a advertência em conferência (`requires_review` depois de corrigida a origem) deve contar para o supervisor, e quem tira a marca.
3. Se o residente deve ver contador para a decisão do seu pedido de saída. Isso pede uma marca de "visto" nova.
4. Se a leitura das conversas deve ser por supervisor, e não compartilhada.
5. Se a chamada ainda não aberta deve contar a partir de um horário definido.
