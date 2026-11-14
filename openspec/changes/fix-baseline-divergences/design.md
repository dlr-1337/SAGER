# Design

## Context

Ver proposal.md, "Why". Os quatro itens são independentes e cada um mexe num ponto pequeno:

- A conta vinculada ao residente já recebe a matrícula nova na mesma transação da edição (`LocalAccountProvisioningService.synchronizeResidentEnrollment`). Dentro de uma requisição, essa troca não grava evento de conta, porque a edição do residente já é auditada (`recordOperator`, e `account-audit`, cenário "Conta criada no cadastro assistido"). `GET /api/v1/auth/me` lê `display_name` do banco a cada chamada.
- O 429 do login sai por `ApiErrors.write` com `rate_limited`. O da recuperação sai do controlador, sem corpo.
- O cookie de sessão é HttpOnly: a página não sabe se ele existe. Hoje ela só sabe o que `/auth/me` responde, e `LocalAuthService.refresh` transforma qualquer falha em "sem sessão". A chave `sager.session` do `localStorage` guarda só a hora da última entrada ou saída e serve para avisar as outras abas.
- A ajuda escolhe o link de Comunicações pelo perfil e pelo modo. Na demonstração, o supervisor recebia `/avisos`, rota só do residente.

## Goals / Non-Goals

**Goals:**
- Corrigir os itens 11, 13, 14 e 15 com o menor código possível, cada um com teste.
- Manter a demonstração entrando com a API fora do ar quando nenhuma conta foi aberta neste navegador.

**Non-Goals:**
- Migração de banco, rota nova ou mudança de contrato além do corpo do 429.
- Sincronizar o nome da conta do supervisor (fora do escopo, proposal.md).
- Dar à demonstração do supervisor uma tela de avisos.

## Decisions

### D1. Nome da conta junto da edição, auditado como campo do residente

Quando a edição muda o nome do residente, o mesmo serviço que já leva a matrícula para a conta grava o nome formatado em `display_name`, na mesma transação e sem encerrar sessões. A conta só muda quando o nome do residente muda; uma edição de outro campo não mexe nela. O evento continua sendo o da edição do residente, com `name` entre os campos alterados. Se a edição for recusada depois disso, por exemplo com 409 `duplicate_enrollment`, a transação desfaz também o nome da conta.
- Alternativa rejeitada: gravar também um evento `LOCAL_ACCOUNT` com o campo do nome. A regra de `account-audit` é não gravar um segundo evento para uma gravação que a edição do residente já audita.
- Alternativa rejeitada: encerrar a sessão do residente, como na troca de matrícula. O nome não é credencial, e `resident-registry` ("Matrícula alterada acompanha o login") diz que editar outros campos não encerra a sessão.

### D2. 429 da recuperação com `ApiErrors` e o mesmo código do login

O controlador monta a resposta com `ApiErrors.response` (código `rate_limited`, a mesma mensagem do login, identificador da requisição, `X-Request-Id` e `no-store`) e acrescenta `Retry-After: 900`. A tela de recuperação já mostra a própria mensagem para qualquer 429 e não muda.
- Alternativa rejeitada: lançar uma exceção e tratá-la no `ApiExceptionHandler`. Seria um tipo novo e um tratador novo para um único caso, e o tratador ainda teria de acrescentar o `Retry-After`.
- Alternativa rejeitada: um código próprio, como `recovery_rate_limited`. É a mesma situação do login, e nenhum cliente precisa distinguir as duas.

### D3. "Sem conta conhecida" contra "conta pode estar aberta"

A página não vê o cookie, então decide pelo que sabe:
- conta conhecida nesta aba (o principal em memória), ou
- a chave `sager.account` no `localStorage`, com a hora da última resposta aceita. Ela é gravada assim que o servidor aceita o login, antes da consulta de `/auth/me`, porque o cookie já está aberto mesmo que essa consulta falhe. Enquanto existe, cada resposta aceita da API renova a hora (`core/api.ts`), como cada requisição adia o fim da sessão no servidor. É apagada quando a saída dá certo, quando `/auth/me` responde 401 ou quando passa de 30 minutos sem renovação, o tempo da sessão do servidor sem uso (`SAGER_SESSION_TIMEOUT`, padrão 30m). Ela não guarda dado pessoal, só a hora.

Ao escolher um perfil, a página consulta `/auth/me`:
- conta devolvida: pede a saída; se a saída falhar, não começa e pede para tentar de novo (já era assim);
- 401: apaga a chave e começa, sem pedir a saída;
- falha de rede, erro do servidor ou resposta ilegível: se a conta pode estar aberta, não começa e pede para tentar de novo; se não, começa sem pedir mais nada.

Assim, os e2e que abrem a demonstração com a API abortada e sem cookie de conta continuam passando sem mudança. Em `local-auth.spec.ts:33`, o contexto é novo e nenhuma conta entrou. Em `residents-local.spec.ts:440-444`, as outras abas simulam a sessão respondendo `/auth/me`, sem passar pelo login, e a aba da demonstração é nova, sem principal em memória. Pelo mesmo motivo, a demonstração continua entrando com `npm start` sem o backend.
- Alternativa rejeitada: recusar a demonstração em qualquer falha que não seja 401. Quebraria a demonstração sem backend (RF027, "sem acesso à API") e os dois e2e acima, que modelam justamente o visitante sem conta.
- Alternativa rejeitada: usar a chave `sager.session`. Ela é gravada na entrada e na saída, então não diz se a conta saiu, e mudar o que ela guarda mexeria no aviso entre abas (`app.config.ts`).
- Alternativa rejeitada: chave sem prazo, apagada só pela saída ou por um 401. Quem fecha a aba sem sair, ou deixa a sessão expirar, ficaria sem a demonstração com o servidor fora do ar até limpar os dados do site, contra RF027 ("sem acesso à API").
- Alternativa rejeitada: criar a chave também em cada `/auth/me` aceito, não só no login (renovar uma chave que já existe não cria nenhuma). Cobriria, numa aba nova, uma sessão aberta antes desta versão. Mas a página trataria como conta aberta qualquer sessão restaurada, inclusive a simulada nos e2e da mesma janela, e a demonstração sem servidor passaria a recusar. A sessão do servidor expira depois de 30 minutos sem uso (cap. 4, RNF de segurança), então a janela das sessões antigas é curta, e na mesma aba o principal em memória já as cobre.

### D4. Guia de Comunicações só onde a tarefa existe

O guia leva o residente a `/avisos`, nos dois modos, e o supervisor com conta a `/comunicacoes/avisos`. Na demonstração do supervisor o guia não aparece: o menu dessa demonstração não tem avisos e `/comunicacoes/avisos` diz que a tela não faz parte da demonstração. Um teste unitário percorre os guias da ajuda dos três perfis na demonstração e confere cada link contra os perfis da rota em `app.routes.ts`; um e2e abre cada guia e confere que nenhum cai no acesso negado nem numa tela fora da demonstração. Os outros links já estavam certos: gestor só tem Relatórios; supervisor tem Chamada, Saídas e Relatórios; residente tem Saídas, Avisos e Ranking.
- Alternativa rejeitada: manter o guia na demonstração do supervisor, levando a `/comunicacoes/avisos`. O guia promete "Veja e confirme seus avisos" e chega a uma tela que só diz não fazer parte da demonstração, contra "guias só das tarefas que o perfil em uso pode fazer".

## Risks / Trade-offs

- [Sessão aberta antes desta versão, numa aba nova, com o servidor fora do ar] → a demonstração ainda entra sem sair da conta. A sessão expira em 30 minutos sem uso, e o próximo login grava a chave.
- [Chave `sager.account` de uma sessão que já expirou ou de uma aba fechada sem sair] → com o servidor fora do ar, a demonstração pede para tentar de novo por até 30 minutos depois da última resposta aceita; depois, a chave vence e a demonstração entra.
- [Operador com `SAGER_SESSION_TIMEOUT` acima de 30 minutos] → a chave vence antes da sessão, e com o servidor fora do ar uma aba nova pode abrir a demonstração com o cookie ainda válido. O padrão é 30 minutos; os 30 minutos da página estão em `SESSION_IDLE_MS` (`core/api.ts`).
- [Armazenamento bloqueado] → vale só o principal em memória desta aba, como antes.
- [Ajuda do supervisor diferente conforme o modo] → na demonstração, o supervisor não vê o guia Comunicações, que aparece com a conta. O menu da demonstração já não tem avisos.

## Migration Plan

Sem migração. O deploy é o de sempre; voltar atrás é reverter os commits. A chave `sager.account` só aparece depois do próximo login.

## O que a instituição ou o operador ainda decidem

- Nada novo para a instituição: os quatro itens seguem a monografia e as specs.
- O dono do projeto decide se a demonstração do supervisor deve ganhar avisos fictícios, o item no menu e, com eles, o guia Comunicações.
- O dono decide se o nome da conta do supervisor também deve acompanhar a edição do cadastro (fora do escopo).
