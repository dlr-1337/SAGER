## Context

Motivação em proposal.md. Estado atual, conferido no código:

- `NoticeFormLocalPage` (`notices-local.pages.ts`) sabe a opção escolhida em "Quem recebe?" e, em `review()`, monta "Quem vai receber" com `criterion()` e a quantidade ("Um alojamento: Alojamento Norte · 2 residentes"), seguidos de uma linha por residente com nome e matrícula.
- `NoticeDetailLocalPage` monta, em `summary()`, as linhas dos diálogos "Revisar publicação", "Publicar correção" e "Retirar com justificativa". "Quem vai receber" tem uma linha por residente, sem a opção nem a quantidade.
- O aviso que a API devolve (`Notice` em `CommunicationModels`) traz só `residentIds`. A opção escolhida não é gravada (decisão D1 da change `2026-11-14-notice-audience-options`), e `ResidentRecord` não diz o quarto de cada residente.
- A página do aviso salvo lista os nomes em "Quem recebe", com `residentLabel()`.
- `CommunicationReviewDialogComponent` é o mesmo diálogo para todas as comunicações. Ele mostra cada linha como texto e não muda nesta change.
- A demonstração não tem as telas de aviso do supervisor: elas mostram "Esta tela não faz parte da demonstração". `NoticesDemoService` serve só as comunicações do residente.

## Goals / Non-Goals

**Goals:**
- diálogos de aviso curtos, com o grupo e a quantidade, sem rolagem por causa dos nomes;
- os nomes num só lugar: a página do aviso salvo.

**Non-Goals:**
- gravar a opção escolhida ou mudar a API;
- mudar a página do aviso salvo ou a lista "Ver quem vai receber" do formulário.

## Decisions

### D1. No rascunho, o grupo é a opção escolhida, com o lugar pelo nome

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

### D2. No aviso salvo, o grupo é "Lista salva no rascunho"

Em "Revisar publicação", "Publicar correção" e "Retirar com justificativa", "Quem vai receber" mostra "Lista salva no rascunho · N residentes". A API não diz qual opção montou a lista, e a lista é a que ficou fixa no rascunho. Os nomes estão na própria página, atrás do diálogo, em "Quem recebe".

*Rejeitada:* gravar a opção no rascunho e mostrá-la aqui ("Todos os moradores · 24 residentes"). Pede campo novo na API e migração, que ficaram fora desta change.

*Rejeitada:* deduzir o grupo pelos quartos de hoje (por exemplo, todos os destinatários no mesmo alojamento). Pede uma consulta por alojamento ou quarto. E erra quando alguém mudou de quarto depois do rascunho: o diálogo diria um grupo que não foi o escolhido.

*Rejeitada:* levar a opção do formulário para a página do aviso na navegação. Só funcionaria logo depois de salvar: voltando outro dia, o mesmo diálogo mostraria outro texto.

### D3. A lista com os nomes fica só na página do aviso salvo

Os diálogos não mostram nomes nem matrículas. O formulário continua com "Ver quem vai receber", recolhido, para desmarcar alguém. A página do aviso salvo continua listando todos em "Quem recebe".

*Rejeitada:* um "Ver nomes" recolhido dentro do diálogo. Voltaria a crescer o diálogo, e a página atrás dele já tem a lista.

## Risks / Trade-offs

- Ao salvar o rascunho, o supervisor não confere os nomes no diálogo. → A quantidade continua lá, e "Ver quem vai receber" fica no formulário, logo acima do botão.
- "Lista salva no rascunho" não lembra a opção escolhida. → A quantidade e a lista da página bastam para conferir; gravar a opção fica como pergunta ao dono.

## O que o dono ou a instituição ainda decide

- Se quer ver a opção original, como "Todos os moradores", também em "Revisar publicação". Isso pede gravar a opção com o rascunho, com mudança na API e migração.
- Nada muda para a AE: a regra de quem recebe é a mesma. Continua pendente a validação da segmentação (D18 de `docs/ARQUITETURA.md`).
