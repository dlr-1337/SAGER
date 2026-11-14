## Context

Motivação em proposal.md. Estado atual, conferido no código:

- `GET /api/v1/auth/me` (`AuthController`) devolve `id`, `nome`, `email`, `fotoUrl`, `perfis`, `residenteId`, `supervisorId`, `matricula` e `maiorDeIdade`. A maioridade já é lida do cadastro do residente a cada consulta (`LocalAccountRepository.residentBirthDate`).
- A interface consulta a conta ao iniciar e guarda o resultado em `LocalAuthService.principal`; `validPrincipal` confere cada campo. `ProfilePage` (`features/portal/portal.pages.ts`) mostra nome, matrícula, perfil e vínculo e não consulta a conta de novo.
- O residente recebe 403 em alojamentos, quartos e alocações (`access-control`, "Cadastros com gestor e supervisor").
- Banco: `sager_room_allocation` (ativa quando `ended_at` é nulo; no máximo uma ativa por residente, com índice único parcial), `sager_room` (`number`, `accommodation_id`, `unit_id` opcional), `sager_accommodation` (`code`) e `sager_accommodation_unit` (`name`, como "Casa 3" ou "Bloco A").
- Demonstração: a residente fictícia é Ana Luísa Ribeiro (`OperationsDemoService.residentId`), que em `management-demo.service.ts` (`r-ana`) está no quarto `q-102`, número 102 do bloco A. O modelo da demonstração não tem código de alojamento.
- Monografia: cap8.tex:142 diz só que "Meu perfil" apresenta os dados do residente.

## Goals / Non-Goals

**Goals:**

- O residente vê o próprio quarto atual em "Meu perfil", numa linha curta.
- O quarto mostrado acompanha transferências e encerramentos sem o residente precisar sair e entrar.
- O residente continua sem acesso aos recursos de quartos e alocações.

**Non-Goals:**

- Mostrar colegas de quarto, andar, capacidade ou histórico.
- Mudar permissões, telas de gestor e supervisor ou a página Ajuda.

## Decisions

### D1. Quarto na consulta da própria conta

O servidor lê a alocação ativa do residente vinculado à sessão e devolve o quarto em `/auth/me`. Nenhum parâmetro do pedido escolhe o residente.
*Rejeitada:* liberar `GET /api/v1/alocacoes` ou `/api/v1/quartos` ao residente, filtrado pelo próprio registro. Amplia o acesso que `access-control` fecha e exige autorização por registro em dois recursos para um único dado.
*Rejeitada:* rota nova `/api/v1/me/quarto`. Mais uma rota e uma regra de permissão para um dado que cabe na consulta que a tela já faz.

### D2. O servidor manda as partes; a tela monta o texto

O campo é `quarto: { alojamento: "R2", casa: "Casa 3" | null, numero: "43" }`, ou `null`. Uma única função da interface monta "R2 · Casa 3 · Quarto 43" e serve também à demonstração.
*Rejeitada:* o servidor mandar o texto pronto. A demonstração repetiria a montagem em outro lugar, e mudar a frase pediria mudar o servidor.

### D3. Formato "R2 · Casa 3 · Quarto 43", sem rótulo antes

Alojamento pelo código, casa ou bloco pelo nome da unidade, quarto pelo número (não pelo código interno do quarto). Sem casa ou bloco, a parte some: "R2 · Quarto 43". A linha fica abaixo da matrícula, no mesmo painel.
*Rejeitada:* "Quarto: R2 · Quarto 43". Repete a palavra; o pedido do dono já traz "Quarto" na frase.
*Rejeitada:* nome do alojamento no lugar do código. É mais longo, e o pedido usa o código.

### D4. Consultar a conta de novo ao abrir "Meu perfil"

Fora da demonstração, a tela consulta `/auth/me` ao abrir. Se a rede falhar, mantém o que já mostrava; um 401 segue o tratamento único de sessão encerrada (`page-loading`, "Sessão encerrada tratada em um só lugar").
*Rejeitada:* consultar a conta a cada navegação. Uma consulta a mais em toda tela para um dado que só aparece no perfil.
*Rejeitada:* não consultar de novo. O residente transferido com a sessão aberta veria o quarto antigo até sair e entrar.

### D5. Demonstração com o quarto que os dados fictícios já têm

O residente da demonstração vê o quarto de `r-ana` em `management-demo.service.ts`, montado pela mesma função de D2 sem a parte do alojamento: "Bloco A · Quarto 102". Gestor e supervisor da demonstração não têm linha de quarto. Nada chama a API.
*Rejeitada:* texto fixo no modelo da tela. Descolaria dos dados fictícios se eles mudarem.
*Rejeitada:* inventar um código de alojamento na demonstração. Muda o modelo da demonstração só para esta linha.

### D6. Monografia

O texto atual (cap8.tex:142) diz que "Meu perfil" apresenta os dados do residente, o que não contradiz a mudança, mas não cita o quarto. A change não edita a monografia; o quarto no perfil é acréscimo a citar no texto.
*Rejeitada:* não mostrar o quarto até a monografia mudar. O pedido é do dono e do coautor, e o texto atual comporta o acréscimo.

## Risks / Trade-offs

- `/auth/me` faz mais uma consulta para contas de residente, e com `auto-refresh-pages` o início do residente chama `/auth/me` a cada 15 s. → Uma linha por residente, pelo índice único parcial da alocação ativa; gestor e supervisor não consultam. "Meu perfil" não se atualiza sozinho (`auto-refresh-pages` deixa o perfil de fora) e consulta a conta só ao abrir.
- O residente passa a receber um dado de alocação sem ler o recurso. → Só o próprio quarto, pelo vínculo da sessão; `access-control` não muda e os testes de 403 em quartos e alocações continuam.
- Uma resposta com `quarto` de tipo errado faria `validPrincipal` recusar a conta. → O campo ausente ou nulo é aceito, como `maiorDeIdade`, para respostas antigas e mocks.

## O que o dono ou a instituição ainda decide

- Acrescentar o quarto ao texto de "Meu perfil" na monografia (cap. 8, linha 142).
- Se o alojamento deve aparecer pelo código (R2), como pedido, ou pelo nome.
- Se o residente deve ver mais dados do quarto, como colegas ou andar; fica fora desta change.
