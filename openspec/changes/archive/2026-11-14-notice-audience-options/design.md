## Context

Motivação em proposal.md. Estado atual, conferido no código:

- `NoticeFormLocalPage` (`notices-local.pages.ts`) carrega todo o cadastro com `ResidentApiService.list()` e mostra uma busca com uma caixa por residente; o contador diz "N residentes escolhidos". A revisão (`CommunicationReviewDialogComponent`) lista os nomes em "Quem vai receber".
- `POST /api/v1/avisos` recebe `residentIds`; `DisciplineInput.ids` recusa lista vazia, acima de 100 ou repetida, e `CommunicationService.createNotice` recusa residente inexistente. O mesmo `ids` vale para `warningIds` do termo de compromisso. A OpenAPI declara `maxItems(100)` nos dois.
- Os destinatários ficam em `sager_notice_draft_recipient` na criação e são copiados na publicação e nas revisões; nada recalcula a lista.
- `GET /api/v1/residentes` já aceita `allocated`, `accommodationId` e `roomId` (alocação ativa) e, sem `limit`/`offset`, devolve a lista inteira. Cada residente traz `minor`, calculado pelo servidor na data civil de America/Sao_Paulo e falso quando não há data de nascimento.
- `RoomApiService.map()` devolve alojamentos e quartos, e `roomsIn`/`roomOptionLabel` já montam o seletor de quarto na avaliação de limpeza.
- `docs/ARQUITETURA.md` D18 lista "segmentação" como pendência institucional dos avisos.

## Goals / Non-Goals

**Goals:**

- Mandar um aviso a todos, a um alojamento, a um quarto ou a uma faixa de idade em poucos cliques.
- Ver quantos vão receber antes de salvar e poder tirar alguém.
- "Todos os moradores" funcionar com os 230 residentes de produção.

**Non-Goals:**

- Critérios combinados, critério gravado ou lista recalculada na publicação.
- Mudar leitura, ciência, versões ou a tela do aviso salvo.

## Decisions

### D1. O critério é só um atalho de seleção; o servidor continua recebendo `residentIds`

O navegador busca os residentes do critério com os filtros que `GET /api/v1/residentes` já tem e envia os IDs, como hoje. Não há campo novo na API nem no banco. Isso responde em parte à pendência "segmentação" de D18: é um jeito de marcar residentes, não um público definido pela instituição, e a AE ainda valida se essas opções bastam.
*Rejeitada:* enviar o critério (`audience: {tipo, id}`) e resolver no servidor. Pede contrato novo, decide no código uma segmentação que a AE não aprovou e não deixa desmarcar alguém sem outro campo de exceções.

### D2. Como cada opção é resolvida

"Todos os moradores": `allocated=true`. "Um alojamento": `accommodationId`. "Um quarto": `roomId`. "Só maiores de 18" e "Só menores de 18": `allocated=true`, mantendo quem tem `birthDate` e `minor` falso ou verdadeiro. "Escolher pessoas": a lista inteira, como hoje.
*Rejeitada:* calcular a idade no navegador. O relógio e o fuso do aparelho podem divergir da data civil de America/Sao_Paulo que o servidor já usa em `minor`.
*Rejeitada:* incluir quem está sem quarto em "Todos" e nas opções por idade. Quem saiu ou concluiu o curso receberia aviso de uma moradia onde não está.

### D3. Lista fixa no rascunho

Os IDs resolvidos vão no `POST` e ficam no rascunho; quem entrar no alojamento depois não recebe, como já acontece entre rascunho, publicação e revisão.
*Rejeitada:* recalcular a lista na publicação. O supervisor publicaria para pessoas que não revisou.

### D4. Tela: uma pergunta, um caminho

Um grupo de opções "Quem recebe?" com as seis escolhas, nenhuma marcada de início; o seletor aparece só na opção que precisa dele. Abaixo, "1 residente vai receber" ou "N residentes vão receber" e um `<details>` "Ver quem vai receber" fechado, com uma caixa marcada por pessoa. Em "Escolher pessoas" ficam a busca e as caixas de hoje, sem o `<details>`. Trocar de opção refaz a lista e descarta as desmarcações. Lista vazia mostra "Ninguém recebe com essa opção." e não deixa salvar.
*Rejeitada:* começar com "Todos os moradores" marcado. Um clique distraído mandaria o aviso a todos.
*Rejeitada:* uma caixa de seleção (dropdown) para as opções. Esconde as escolhas, e cada uma precisa ficar visível para quem tem pouca prática.
*Rejeitada:* guardar as desmarcações ao trocar de opção. A lista nova misturaria duas escolhas sem que a tela mostre.

### D5. "Um quarto": alojamento primeiro, depois o quarto

Dois seletores pesquisáveis (`sagerSearchable`): alojamento e, dele, os quartos (`roomsIn`, rótulo `roomOptionLabel`), como na avaliação de limpeza.
*Rejeitada:* um seletor com todos os quartos. Lista longa, e o número do quarto pode repetir entre alojamentos.

### D6. Resposta atrasada não vale

Cada troca de opção ou de alojamento/quarto cancela a busca anterior (`AbortSignal` de `ResidentApiService.page`); só a última preenche a lista. Falha na busca mostra a mensagem de erro e deixa a lista vazia.
*Rejeitada:* travar as opções enquanto busca. Prende quem clicou na opção errada.

### D7. Teto de 2.000 só em `residentIds`

`DisciplineInput.ids` passa a receber o máximo; `residentIds` usa 2.000 e `warningIds` continua com 100, e a OpenAPI acompanha cada um. As checagens por destinatário continuam uma consulta por residente.
*Rejeitada:* subir o teto comum para 2.000. Ampliaria sem motivo o termo de compromisso.
*Rejeitada:* reescrever a checagem e a gravação em lote. Com 230 residentes o custo é pequeno; vale rever se a casa passar de alguns milhares.

### D8. A revisão mostra a opção e a quantidade antes dos nomes

A linha "Quem vai receber" passa a começar por "Todos os moradores · 230 residentes" (ou "Alojamento X", "Quarto Y", "Escolhidos um a um"), seguida dos nomes.
*Rejeitada:* só os nomes. Com centenas de nomes, a quantidade e o critério somem.

## Risks / Trade-offs

- Residente com quarto ativo e sem data de nascimento (dado legado, Flyway V10) fica fora das duas opções por idade. → A tela conta só quem entra; "Escolher pessoas" continua cobrindo esse caso.
- A lista inteira de destinatários aparece nos nomes da revisão e na tela do aviso salvo, que ficam longas com centenas de pessoas. → A revisão já abre em diálogo com rolagem; a tela do aviso salvo fica como está (fora do escopo).
- Um `POST` com 2.000 IDs tem cerca de 80 KB, abaixo do limite de 1 MB do proxy para a API.

## O que o dono ou a instituição ainda decide

- A AE valida se as opções (todos, alojamento, quarto, maiores e menores) atendem a "segmentação" pendente em D18, e se faltam outras, como curso ou etapa.
- Se quem não tem data de nascimento deve receber avisos por idade; hoje fica fora, e a correção é completar o cadastro.
- Se 2.000 destinatários por aviso é o teto adequado para a operação.
