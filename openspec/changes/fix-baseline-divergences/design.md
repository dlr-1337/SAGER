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
- Alternativa rejeitada: gravar um evento `LOCAL_ACCOUNT` com o campo do nome. O banco só aceita, para esse recurso, os campos listados na V33, e a regra de `account-audit` é não duplicar o evento de um cadastro que já é auditado. Exigiria migração para auditar a mesma mudança duas vezes.
- Alternativa rejeitada: encerrar a sessão do residente, como na troca de matrícula. O nome não é credencial, e `resident-registry` ("Matrícula alterada acompanha o login") diz que editar outros campos não encerra a sessão.

### D2. 429 da recuperação com `ApiErrors` e o mesmo código do login

O controlador monta a resposta com `ApiErrors.response` (código `rate_limited`, a mesma mensagem do login, identificador da requisição, `X-Request-Id` e `no-store`) e acrescenta `Retry-After: 900`. A tela de recuperação já mostra a própria mensagem para qualquer 429 e não muda.
- Alternativa rejeitada: lançar uma exceção e tratá-la no `ApiExceptionHandler`. Seria um tipo novo e um tratador novo para um único caso, e o tratador ainda teria de acrescentar o `Retry-After`.
- Alternativa rejeitada: um código próprio, como `recovery_rate_limited`. É a mesma situação do login, e nenhum cliente precisa distinguir as duas.

### D3. "Sem conta conhecida" contra "conta pode estar aberta"

A página não vê o cookie, então decide pelo que sabe:
- conta conhecida nesta aba (o principal em memória), ou
- a chave `sager.account` no `localStorage`, gravada quando o login termina e apagada quando a saída dá certo ou quando `/auth/me` responde 401. Ela não guarda dado pessoal, só a presença.

Ao escolher um perfil, a página consulta `/auth/me`:
- conta devolvida: pede a saída; se a saída falhar, não começa e pede para tentar de novo (já era assim);
- 401: apaga a chave e começa, sem pedir a saída;
- falha de rede, erro do servidor ou resposta ilegível: se a conta pode estar aberta, não começa e pede para tentar de novo; se não, começa sem pedir mais nada.

Assim, os e2e que abrem a demonstração com a API abortada e sem cookie de conta continuam passando sem mudança. Em `local-auth.spec.ts:33`, o contexto é novo e nenhuma conta entrou. Em `residents-local.spec.ts:440-444`, as outras abas simulam a sessão respondendo `/auth/me`, sem passar pelo login, e a aba da demonstração é nova, sem principal em memória. Pelo mesmo motivo, a demonstração continua entrando com `npm start` sem o backend.
- Alternativa rejeitada: recusar a demonstração em qualquer falha que não seja 401. Quebraria a demonstração sem backend (RF027, "sem acesso à API") e os dois e2e acima, que modelam justamente o visitante sem conta.
- Alternativa rejeitada: usar a chave `sager.session`. Ela é gravada na entrada e na saída, então não diz se a conta saiu, e mudar o que ela guarda mexeria no aviso entre abas (`app.config.ts`).
- Alternativa rejeitada: gravar a chave também em cada `/auth/me` aceito, não só no login. Cobriria, numa aba nova, uma sessão aberta antes desta versão. Mas a página trataria como conta aberta qualquer sessão restaurada, inclusive a simulada nos e2e da mesma janela, e a demonstração sem servidor passaria a recusar. A sessão do servidor expira depois de 30 minutos sem uso (cap. 4, RNF de segurança), então a janela das sessões antigas é curta, e na mesma aba o principal em memória já as cobre.

### D4. Link de Comunicações pelo perfil, nos dois modos

O guia leva o residente a `/avisos` e o supervisor a `/comunicacoes/avisos`, com ou sem demonstração. Um teste unitário percorre os guias da ajuda dos três perfis na demonstração e confere cada link contra os perfis da rota em `app.routes.ts`; um e2e abre cada guia e confere que nenhum cai no acesso negado. Os outros links já estavam certos: gestor só tem Relatórios; supervisor tem Chamada, Saídas e Relatórios; residente tem Saídas, Avisos e Ranking.
- Alternativa rejeitada: esconder o guia Comunicações na demonstração do supervisor, já que o menu dessa demonstração não tem avisos e a tela diz que não faz parte da demonstração. A ajuda passaria a mostrar guias diferentes para o mesmo perfil conforme o modo, e o guia certo leva a uma tela que explica isso e volta ao início, em vez do acesso negado.

## Risks / Trade-offs

- [Sessão aberta antes desta versão, numa aba nova, com o servidor fora do ar] → a demonstração ainda entra sem sair da conta. A sessão expira em 30 minutos sem uso, e o próximo login grava a chave.
- [Chave `sager.account` esquecida, por exemplo quando a sessão expira e o servidor cai antes de a página ver o 401] → a demonstração pede para tentar de novo até o servidor voltar. É o lado seguro: não começa com uma conta talvez aberta.
- [Armazenamento bloqueado] → vale só o principal em memória desta aba, como antes.
- [Guia de Comunicações do supervisor na demonstração] → leva a uma tela que diz não fazer parte da demonstração. Melhor que o acesso negado, mas não mostra avisos fictícios.

## Migration Plan

Sem migração. O deploy é o de sempre; voltar atrás é reverter os commits. A chave `sager.account` só aparece depois do próximo login.

## O que a instituição ou o operador ainda decidem

- Nada novo para a instituição: os quatro itens seguem a monografia e as specs.
- O dono do projeto decide se a demonstração do supervisor deve ganhar avisos fictícios e o item no menu, ou se o guia deve sumir nessa demonstração.
- O dono decide se o nome da conta do supervisor também deve acompanhar a edição do cadastro (fora do escopo).
