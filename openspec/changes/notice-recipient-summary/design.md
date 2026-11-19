## Context

Motivação em proposal.md. Estado atual, conferido no código:

- `NoticeFormLocalPage` (`notices-local.pages.ts`) sabe a opção escolhida em "Quem recebe?" e, em `review()`, monta "Quem vai receber" com `criterion()` e a quantidade ("Um alojamento: Alojamento Norte · 2 residentes"), seguidos de uma linha por residente com nome e matrícula.
- `NoticeDetailLocalPage` monta, em `summary()`, as linhas dos diálogos "Revisar publicação", "Publicar correção" e "Retirar com justificativa". "Quem vai receber" tem uma linha por residente, sem a opção nem a quantidade.
- O aviso (`sager_notice`, `Notice` em `CommunicationModels`) guarda só a lista em `sager_notice_draft_recipient`. A opção escolhida não é gravada (decisão D1 da change `2026-11-14-notice-audience-options`), e `ResidentRecord` não diz o quarto de cada residente.
- `POST /api/v1/avisos` recusa campo desconhecido (`fields`), e a auditoria aceita, para `NOTICE`, só os nomes de campo listados em `AuditResource` e na restrição `sager_audit_event_changed_fields_allowed`.
- A página do aviso salvo lista os nomes em "Quem recebe", com `residentLabel()`.
- `CommunicationReviewDialogComponent` é o mesmo diálogo para todas as comunicações. Ele mostra cada linha como texto e não muda nesta change.
- A demonstração não tem as telas de aviso do supervisor: elas mostram "Esta tela não faz parte da demonstração". `NoticesDemoService` serve só as comunicações do residente.

## Goals / Non-Goals

**Goals:**
- diálogos de aviso curtos, com o grupo e a quantidade, sem rolagem por causa dos nomes;
- "Revisar publicação" com o mesmo grupo da confirmação do rascunho, como pediu o dono;
- os nomes num só lugar: a página do aviso salvo.

**Non-Goals:**
- recalcular a lista ou o grupo depois do rascunho;
- conferir no servidor se cada destinatário pertence ao grupo;
- mudar a página do aviso salvo ou a lista "Ver quem vai receber" do formulário.

## Decisions

### D1. O grupo é a opção escolhida, com o lugar pelo nome

"Quem vai receber" passa a ter uma só linha: o grupo, " · " e a quantidade. O grupo de cada opção:

| Opção | Grupo |
| --- | --- |
| Todos os moradores | "Todos os moradores" |
| Um alojamento | o nome do alojamento, como "Alojamento Norte" |
| Um quarto | "Quarto", o código, a unidade quando houver e o alojamento: "Quarto S-201, Alojamento Sul" |
| Só maiores de 18 / Só menores de 18 | o nome da opção |
| Escolher pessoas | "Escolhidos um a um" |

A quantidade conta quem ficou marcado, depois das desmarcações, como hoje.

*Rejeitada:* manter "Um alojamento: Alojamento Norte". O dono pediu o nome do alojamento com a quantidade, e "Um alojamento:" não diz nada que o nome já não diga.

*Rejeitada:* no quarto, só o código. O código pode repetir entre alojamentos (decisão D5 de `notice-audience-options`), então o nome do alojamento vai junto. Vírgulas separam os lugares, e " · " fica só antes da quantidade.

*Rejeitada:* mostrar os nomes quando forem poucos, como em "Escolher pessoas". Teria duas regras para o mesmo diálogo, e o dono pediu só o grupo e a quantidade.

### D2. O servidor monta e grava o grupo com o rascunho

`POST /api/v1/avisos` aceita o campo opcional `audience`, com a opção (`kind`: `TODOS`, `ALOJAMENTO`, `QUARTO`, `MAIORES`, `MENORES` ou `ESCOLHER`) e só o lugar que ela pede: `accommodationId` em `ALOJAMENTO` e `roomId` em `QUARTO`. O servidor monta o texto da tabela de D1 com os nomes cadastrados e o grava em `sager_notice.audience_label` (V39, nulo e até 500 caracteres). O aviso devolve o texto em `audienceLabel`. Campo a mais, opção desconhecida ou lugar inexistente recebem 400. A auditoria da criação registra o nome do campo `audience`, nunca o texto.

A tela mostra o mesmo texto antes de salvar, montado pela mesma regra, e, depois de salvo, usa `audienceLabel` em "Revisar publicação", "Publicar correção" e "Retirar com justificativa".

*Rejeitada:* aceitar o texto do grupo vindo da tela. Qualquer cliente gravaria um grupo que não corresponde à opção, e o pedido do dono foi o servidor montar o texto.

*Rejeitada:* gravar só a opção e os IDs e montar o texto na leitura. Um alojamento renomeado mudaria o grupo de um aviso já salvo, contra a lista fixa no rascunho.

*Rejeitada:* deduzir o grupo pelos quartos de hoje (por exemplo, todos os destinatários no mesmo alojamento). Pede uma consulta por alojamento ou quarto e erra quando alguém mudou de quarto depois do rascunho.

*Rejeitada:* levar a opção do formulário para a página do aviso só na navegação. Funcionaria logo depois de salvar; voltando outro dia, o mesmo diálogo mostraria outro texto.

### D3. Sem conferir se cada destinatário é do grupo

O servidor não confere se cada destinatário está no alojamento, no quarto ou na faixa de idade do grupo. O grupo diz qual opção montou a lista; a lista continua a que o supervisor revisou, com as desmarcações.

*Rejeitada:* recusar o rascunho quando alguém da lista saiu do grupo. Quem muda de quarto entre a escolha e o "Salvar rascunho" travaria a gravação com um erro que o supervisor não entende, e as desmarcações já fazem a lista ser parte do grupo.

### D4. Aviso antigo mostra "Lista salva no rascunho"

Aviso salvo antes de V39, ou criado pela API sem `audience`, fica com `audienceLabel` nulo. Os diálogos mostram "Lista salva no rascunho · N residentes". A migração não deduz o grupo dos avisos antigos.

*Rejeitada:* preencher os avisos antigos pela lista e pelos quartos de hoje. Seria um palpite, pelo motivo de D2.

### D5. A lista com os nomes fica só na página do aviso salvo

Os diálogos não mostram nomes nem matrículas. O formulário continua com "Ver quem vai receber", recolhido, para desmarcar alguém. A página do aviso salvo continua listando todos em "Quem recebe".

*Rejeitada:* um "Ver nomes" recolhido dentro do diálogo. Voltaria a crescer o diálogo, e a página atrás dele já tem a lista.

## Risks / Trade-offs

- Ao salvar o rascunho, o supervisor não confere os nomes no diálogo. → A quantidade continua lá, e "Ver quem vai receber" fica no formulário, logo acima do botão.
- Depois de desmarcar alguém, o grupo continua "Todos os moradores" com uma quantidade menor. → Já era assim na confirmação do rascunho (D8 de `notice-audience-options`); a quantidade mostra a diferença.
- O texto da tela antes de salvar e o do servidor seguem a mesma regra em dois lugares. → Os testes de unidade e de integração conferem os mesmos exemplos.

## O que o dono ou a instituição ainda decide

- Nada muda para a AE: a regra de quem recebe é a mesma. Continua pendente a validação da segmentação (D18 de `docs/ARQUITETURA.md`).
- Se os avisos antigos, que mostram "Lista salva no rascunho", precisam de outro texto.
