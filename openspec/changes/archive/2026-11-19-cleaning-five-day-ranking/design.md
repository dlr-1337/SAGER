## Context

Motivação em proposal.md. Estado atual, conferido no código:

- **Períodos.** `CleaningService.period` aceita `WEEK`, `MONTH` e `SEMESTER`. `GET /api/v1/limpeza/ranking` usa `MONTH` quando `period` falta, e a tela abre no mês.
- **Média.** `rankRows` faz `ROUND(AVG(score),2)` das avaliações do quarto no intervalo. A unicidade `(room_id, assessment_date)` de V18 garante uma avaliação por quarto e data civil, então essa média já é a média das notas diárias, e dia sem avaliação não entra.
- **Devolutiva.** Cada avaliação traz `feedback` com a média e a posição do quarto na semana da data da avaliação (`rankingReference` = `WEEK`). A lista guarda o ranking de cada semana num mapa, para não recalcular o mesmo ranking por item.
- **Linha do ranking.** `RankRow` traz `assessmentCount`, e a tela escreve "1 avaliação" ou "N avaliações". Para o residente, as linhas dos outros quartos vêm sem `roomId`, `mean` e `assessmentCount`.
- **Tela do residente.** `RankingLocalPage` mostra "Seu quarto neste período" no topo e repete a mesma linha na lista paginada, com "Sua participação registrada neste período" nas duas. Cada outro quarto diz "Nota privada do quarto".
- **Demonstração.** `RankingComponent` tem botões Semanal, Mensal e Semestral, com posições fixas e sem nota.

## Goals / Non-Goals

**Goals:**

- O ranking abre nos últimos 5 dias e muda de um dia para o outro conforme as notas novas entram e as antigas saem.
- A linha do ranking mostra só a posição e a nota.
- O residente vê o próprio quarto uma vez só.

**Non-Goals:**

- Mudar a avaliação, a correção ou os indicadores mensais.
- Mudar quem vê as notas.
- Guardar o ranking de cada dia.

## Decisions

### D1. Janela de 5 dias civis terminada na data de referência

`LAST_5_DAYS` vai da data de referência menos 4 dias até a data de referência, em datas civis de America/Sao_Paulo, como os outros períodos. Sem data, vale hoje no relógio do servidor.

*Rejeitadas:*

- as 5 avaliações mais recentes de cada quarto, que compararia quartos avaliados em épocas diferentes;
- as últimas 120 horas a partir do instante da consulta, que cortaria um dia pela metade, enquanto a avaliação é por data civil.

### D2. Média só dos dias com avaliação

A média é a das notas diárias dos dias da janela que têm avaliação, com duas casas, como hoje. Como cada quarto tem uma avaliação por data, a consulta continua `AVG(score)` e não precisa de migração.

*Rejeitadas:*

- contar o dia sem avaliação como zero, contra RN14 e o requisito "Ranking por período";
- pesar mais o dia mais recente, regra que ninguém pediu e que o residente não conseguiria conferir.

### D3. Os últimos 5 dias viram o padrão, sem tirar os outros períodos

A API usa `LAST_5_DAYS` quando `period` falta, e a tela abre nele. Semana, mês e semestre continuam no seletor e na API, porque RF012 os cita.

*Rejeitada:* trocar os três períodos pelo de 5 dias. A tela contradiria a monografia.

### D4. Devolutiva pelos últimos 5 dias terminados na data da avaliação

A média e a posição da devolutiva passam a ser as do ranking `LAST_5_DAYS` com referência na data da avaliação. O mapa da lista passa a guardar o ranking por início da janela.

*Rejeitadas:*

- manter a semana, que deixaria a devolutiva diferente do ranking que a tela abre por padrão;
- usar a janela terminada hoje, que mudaria a devolutiva de uma avaliação antiga todo dia e, depois de 5 dias, nem incluiria a nota dela.

### D5. A quantidade de avaliações sai da API e da tela

`assessmentCount` sai de `RankRow`. A linha mostra o quarto, a posição e a nota, ou "Sem posição" e "Sem nota".

*Rejeitada:* esconder a quantidade só na tela. A API continuaria entregando um dado que nenhuma tela usa, e a conferência de privacidade do residente teria um campo a mais para vigiar.

### D6. O próprio quarto aparece uma vez, no topo

Para o residente, "Seu quarto neste período" (ou "Seus quartos neste período", quando ele mudou de quarto na janela) fica acima da lista, com a posição e a nota. A lista abaixo, "Outros quartos", traz só os demais, 25 por página. A frase "Sua participação registrada neste período" sai, porque o título da seção já diz isso. A frase "Nota privada do quarto" também sai de cada linha, e o "Saiba mais" continua explicando que, dos outros quartos, o residente vê só a posição. O gestor e o supervisor não mudam: lista única, sem seção no topo.

*Rejeitadas:*

- deixar o próprio quarto só na lista, destacado: com o quarto na página 2 ou além, o residente não o veria ao abrir a tela, o que motivou a seção no topo;
- manter a seção e marcar a linha na lista como "seu quarto": continuaria repetindo a mesma informação.

A lista dos outros quartos pula a posição do quarto do residente (por exemplo 1º, 2º, 4º). O título "Outros quartos" explica o salto.

### D7. Demonstração com a mesma regra

O ranking demonstrativo ganha "Últimos 5 dias" como primeira opção e padrão, mantém Semanal, Mensal e Semestral, e mostra a nota ilustrativa com duas casas ao lado da posição. Para o residente, só a nota do próprio quarto aparece, como no acesso por conta. A explicação "Como o ranking é calculado" cita a média dos últimos 5 dias.

*Rejeitada:* deixar a demonstração como está. Ela mostraria um padrão diferente do sistema real, contra `demo-fidelity`.

## Riscos

- **Página aberta com a versão anterior.** Ela espera `assessmentCount` e recusa a resposta nova com "Registros indisponíveis" até ser recarregada. Mitigação: publicar a API e a tela juntas, fora do horário de uso, como nas outras versões.
- **Janela curta.** Com poucas avaliações por semana, muitos quartos podem ficar sem posição nos últimos 5 dias. Semana, mês e semestre continuam no seletor para isso.

## O que a instituição e o operador ainda decidem

- **Instituição (Assistência Estudantil):**
  - aceitar os últimos 5 dias como período padrão do ranking (D10 em `docs/ARQUITETURA.md`);
  - dizer se 5 dias é a janela certa ou se a frequência das avaliações pede outra.
- **Operador:** publicar a API e a tela na mesma versão.
- **Dono:** acrescentar o período "Últimos 5 dias" à monografia (RF012, regra do ranking e figura da tela de ranking).
