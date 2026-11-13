# Design

## Context

Motivação e escopo: ver proposal.md. Comportamento: ver specs/accommodation-age-group/spec.md.

Estado atual, conferido no código:

- `sager_accommodation` tem só `code` e `name` (V5). O record `Accommodation(id, code, name, version)` vai inteiro para `/api/v1/alojamentos` e para `/api/v1/quartos/mapa` (`RoomService.map()` monta `RoomMap` com `accommodations.findAll()`), então o frontend já recebe o alojamento de cada quarto pelo `accommodationId`.
- `AllocationService.checkAdmission(room)` (chamado em `create` e `transfer`) só olha situação, capacidade e lotação. O residente já fica bloqueado por `AllocationRepository.lockResident` antes da checagem.
- A constraint `sager_audit_event_changed_fields_allowed` aceita para ACCOMMODATION só `code` e `name` (V13). A V29 a estende com um bloco `DO` que embrulha a expressão atual em `(atual) OR (novo)`. O enum `AuditResource.ACCOMMODATION` repete a mesma lista no Java.
- A regra de menoridade está duplicada em `OperationResidents.eligibility` e em `NightCallService.minor`. A mudança `hide-exits-for-adults`, da mesma onda, cria `FieldRules.minor(LocalDate birth, Instant at)`, que converte o instante para a data civil de America/Sao_Paulo, para unificá-la. A `track-course-conclusion` já injeta o `Clock` em `AllocationService`.
- O contexto da chamada noturna lista `NightCallRepository.accommodations()` (NightCallRepository.java:29-33), e o mesmo método valida o alojamento em `context()` e em `open()`. `NightCallService` já calcula a data civil de hoje (`today(now)`, pelo `Clock`, em `OperationResidents.ZONE`) e conta como menor quem tem `birth.plusYears(18)` depois dela. O frontend da chamada só mostra o que o contexto devolve, e o fechamento pela tela pede de novo o contexto do alojamento da chamada (`callContext`, night-call-local.component.ts:685).
- O modo demonstração (RF027) continua. `AccommodationDataService.save` guarda o alojamento em memória copiando `...input`. A ficha do quarto, a ficha do residente e a chamada noturna têm ramos próprios da demonstração (`isDemo()`/`session.active()`, `night-call.component.ts`, `operations-demo.service.ts`).
- Os guards `isAccommodation` de `room-api.service.ts` e de `accommodation-api.service.ts` conferem campo a campo. Cerca de 17 fixtures de e2e e de specs simulam `/quartos/mapa` e `/alojamentos` sem o campo novo.
- A V31 é da `track-course-conclusion`, implementada pelo mesmo executor logo antes. Ela também mexe em `AllocationService`, `AllocationRepository`, `AllocationApiIntegrationTest`, `resident-detail.component.ts` e `allocation-api.service.ts`.

## Goals / Non-Goals

**Goals:**

- Um campo opcional no alojamento, herdado pelo quarto e conferido pelo servidor ao colocar ou transferir.
- Nenhuma quebra de fixture, de cadastro antigo ou de alocação ativa.

**Non-Goals:**

- Faixa por quarto ou por casa, sexo da residência, aviso aos 18 anos e filtros novos de lista.
- Mudar a regra de abertura da chamada que exige o nascimento de todos os alocados.

## Decisions

### D1. A faixa mora no alojamento (a confirmar com a AE)

`sager_accommodation.age_group VARCHAR(8) NULL` com `CHECK (age_group IN ('MENORES','MAIORES'))`. O quarto não guarda nada: a faixa vem do alojamento, já presente no mapa.

- Alternativa rejeitada: uma coluna em `sager_room`. Seriam 93 valores a manter em vez de 12, e os dados reais de `scripts/estrutura_if.json` mostram residências inteiras de uma só faixa. Se a AE quiser exceções por quarto, a mesma coluna vai para `sager_room` numa mudança futura.

### D2. Campo opcional, sem faixa por padrão

Sem faixa, o alojamento não restringe ninguém. O JSON usa `ageGroup` com `"MENORES"`, `"MAIORES"` ou `null`. Na tela aparecem só os rótulos "Menores de 18 anos", "Maiores de 18 anos" e "Sem faixa definida" (spec `plain-language`: sem códigos crus).

- Alternativa rejeitada: campo obrigatório. Os alojamentos que o nome não classifica ficariam bloqueados até alguém editá-los, e todas as fixtures quebrariam.

### D3. PUT substitui o cadastro inteiro: `ageGroup` ausente ou nulo vale "sem faixa"

O controller lê `ageGroup` como `JsonNode`, como já faz com `code` e `name`. Ausente ou `null` vira `null`. Texto `MENORES` ou `MAIORES` é aceito. Qualquer outro texto ou tipo gera 400 `invalid_input`. Os records `CreateRequest` e `UpdateRequest` também servem às unidades, que ignoram o campo.

- Alternativa rejeitada: "ausente mantém o valor atual". Protegeria uma aba antiga aberta durante o deploy, mas cria duas semânticas para o mesmo PUT. Quem limpar a faixa por engano deixa rastro na auditoria (D5) e pode corrigir na hora.

### D4. V32 preenche pelo nome, sem mudar a versão e com auditoria do sistema

`V32__accommodation_age_group.sql`, nesta ordem:

1. `ALTER TABLE` cria a coluna com a constraint nomeada `sager_accommodation_age_group_valid`.
2. Bloco `DO` igual ao da V29: lê `pg_get_expr` da constraint atual, a recria como `(atual) OR (array_position(changed_fields,NULL) IS NULL AND resource = 'ACCOMMODATION' AND changed_fields <@ ARRAY['code','name','ageGroup'])`.
3. `WITH changed AS (UPDATE sager_accommodation SET age_group = ... RETURNING id, version) INSERT INTO sager_audit_event (origin, request_id, resource, resource_id, action, resulting_version, changed_fields) SELECT 'SYSTEM_JOB', gen_random_uuid(), 'ACCOMMODATION', id, 'UPDATE', version, ARRAY['ageGroup'] FROM changed`, o mesmo padrão da V28. O `UPDATE` só toca as linhas classificadas: nome com `menores de 18` e sem `maiores de 18` vira MENORES; o contrário vira MAIORES. A busca ignora maiúsculas (`ILIKE`). Um nome com os dois textos fica sem faixa.

- Alternativa rejeitada para o preenchimento: deixar o gestor definir cada alojamento. As residências reais ficariam sem regra até alguém lembrar de editar.
- Alternativa rejeitada para a versão: incrementá-la. A V28 já firmou que um ajuste feito pela migração não deve parecer edição de cadastro para formulários abertos.
- Alternativa rejeitada para a constraint: reescrever o `CASE` inteiro da V13. Isso desfaria a V29 e o que a V30 (`remove-health-module`) mudar. O bloco `DO` preserva qualquer versão anterior.

### D5. Auditoria do cadastro

`AuditResource.ACCOMMODATION` passa a aceitar `ageGroup`. Na criação, `ageGroup` entra nos campos só quando a faixa não for nula. Na edição, entra quando mudar (`Objects.equals`). É o mesmo padrão de `code` e `name`.

- Alternativa rejeitada: auditar sempre `ageGroup` na criação. Isso registraria um campo vazio como se fosse alteração.

### D6. Conferência só ao colocar ou transferir (a confirmar com a AE)

`checkAdmission` recebe o residente. Uma leitura nova em `AllocationRepository` devolve a data de nascimento do residente (já bloqueado) e a faixa do alojamento do quarto (já bloqueado). Com faixa e sem data: 409 `birth_date_required`. Com faixa e idade diferente: 409 `age_group_mismatch`. O instante vem do `Clock` injetado (`OperationClockConfiguration`), o mesmo que a `track-course-conclusion` usa. A conferência roda antes de qualquer escrita, então a recusa não grava alocação nem auditoria. Mudar a faixa do alojamento e fazer 18 anos não disparam nada.

- Alternativa rejeitada: encerrar ou transferir automaticamente quem faz 18 anos. Ninguém pediu, e isso tiraria o morador do quarto sem decisão humana.
- Alternativa rejeitada: recusar a mudança de faixa de um alojamento com moradores incompatíveis. Isso travaria a correção de um cadastro errado e não traz ganho na alocação.

### D7. Uma só regra de menoridade

`AllocationService` usa `FieldRules.minor(birth, clock.instant())`, a assinatura definida por `hide-exits-for-adults`: verdadeiro só com data presente, não futura e menos de 18 anos completos na data civil de America/Sao_Paulo. Se aquela mudança ainda não tiver criado o helper quando esta for implementada, ele é criado aqui com essa assinatura exata e um teste em `FieldRulesTest`. Quem chegar depois reaproveita o helper e não cria outro.

- Alternativa rejeitada: uma terceira cópia da regra em `AllocationService`.

### D8. A escolha de quarto esconde as opções incompatíveis

Em `resident-detail.component.ts`, um `computed` filtra os quartos oferecidos no `select`. O sinal `allocationMap` continua inteiro, porque `roomName()` precisa dele para nomear o quarto atual, mesmo quando esse quarto é de outra faixa. A menoridade vem do servidor: o residente lido pela API traz `minor` (somente leitura), calculado em `ResidentRepository.map` com `FieldRules.minor` na data civil de America/Sao_Paulo pelo relógio do servidor (cap4.tex:218), a mesma conta da admissão. Assim um aparelho com a data errada, ou um aniversário em 29/02, não esconde quartos que o servidor aceitaria. Sem `minor` na resposta, a lista trata o residente como sem data. Sem data de nascimento, a lista traz só quartos de alojamentos sem faixa, e uma nota pede a data quando algum alojamento tiver faixa.

- Alternativa rejeitada: calcular a idade no navegador com `civilToday()`. Com o aparelho atrasado, a lista esconderia os quartos de maiores sem nenhuma recusa que explicasse.
- Alternativa rejeitada: desabilitar as opções incompatíveis, como já se faz com os quartos lotados. A lista continuaria com até 93 opções, muitas inúteis. O dono pediu para listar só as compatíveis.

### D9. Mensagens de recusa

`allocationErrorMessage` ganha dois casos. `age_group_mismatch`: "Este quarto é de outra faixa etária. Escolha um quarto da faixa do residente." `birth_date_required`: "Informe a data de nascimento do residente antes de colocá-lo neste quarto." O 409 já faz a ficha recarregar as alocações.

- Alternativa rejeitada: usar a mensagem genérica de erro. Ela não diz o que fazer (spec `plain-language`).

### D10. A chamada noturna filtra na própria consulta de opções, sem perder menor alocado

`NightCallRepository.accommodations(LocalDate today)` mantém o alojamento quando `age_group IS DISTINCT FROM 'MAIORES' OR EXISTS (SELECT 1 FROM sager_room q JOIN sager_room_allocation a ON a.room_id = q.id AND a.ended_at IS NULL JOIN sager_resident r ON r.id = a.resident_id WHERE q.accommodation_id = sager_accommodation.id AND r.birth_date > ?)`. O parâmetro é `today.minusYears(18)`, em que `today` é a data civil que `context()` e `open()` já calculam pelo `Clock` em America/Sao_Paulo (cap4.tex:218). Como o mesmo método valida o alojamento em `context()` e `open()`, a API responde 422 `invalid_reference` só para um alojamento de maiores sem menor alocado. O frontend não muda, porque já mostra só o que o contexto devolve. A lista de chamadas antigas (`GET /api/v1/chamadas`) não usa esse método e continua igual.

O `EXISTS` é obrigatório: só o `age_group` tiraria da chamada um menor que continua num alojamento que virou "Maiores" (D6 não move ninguém), contra RF006, RN02 e UC05 (cap4.tex:112, :157, :325-329), e `callContext` deixaria de fechar a chamada aberta nesse alojamento.

- Alternativa rejeitada: filtrar só pelo `age_group`. Perderia o menor alocado, como acima.
- Alternativa rejeitada: filtrar só na tela. A API continuaria abrindo chamadas vazias em alojamentos de adultos.
- Alternativa rejeitada: validar contra todos os alojamentos e filtrar só a lista. Daria mais código para cobrir um caso raro (ver Riscos).

### D11. Demonstração: acompanha só no cadastro do alojamento

O formulário e o detalhe do alojamento são os mesmos na demonstração, então o campo "Faixa etária" aparece nela e a faixa fica em memória, sem mudar `AccommodationDataService`. Os ramos da demonstração na ficha do quarto, na ficha do residente e na chamada noturna ficam como estão: os dados fictícios não têm faixa e a ficha do residente da demonstração não tem escolha de quarto. Nenhum ramo `isDemo()`/`session.active()` é removido nem alterado.

- Alternativa rejeitada: levar a faixa aos dados fictícios de quartos, residentes e chamada. Muda a demonstração descrita na monografia (cap7) sem ganho para a banca.

## Risks / Trade-offs

- [Um alojamento que virou "Maiores" e já não tem menor alocado sai do seletor (D10). Suas chamadas fechadas deixam de aparecer na tela para correção, e uma chamada ainda aberta cujo último menor saiu ou fez 18 anos depois da abertura não fecha pela tela.] → Mitigação: o supervisor volta a faixa, corrige ou fecha a chamada e muda a faixa de novo. Fica registrado em "Para o operador".
- [O filtro de D10 usa `birth_date > today - 18 anos`; quem nasceu em 29/02 conta como menor um dia a mais (28/02 de ano não bissexto) do que em `NightCallService.minor`.] → Mitigação: o efeito é só manter o alojamento no seletor nesse dia; a lista da chamada continua decidida por `minor`.
- [Uma aba antiga do formulário de alojamento, aberta durante o deploy, salva sem `ageGroup` e limpa a faixa (D3).] → Mitigação: a auditoria registra `ageGroup` e o gestor corrige pela tela.
- [O preenchimento depende do texto do nome, que só vem do script não versionado `scripts/popular_estrutura_if.py`.] → Mitigação: alojamentos que o nome não classifica ficam sem faixa, ou seja, sem restrição, e o operador confere a lista depois do deploy.
- [Um quarto de menores pode ficar com morador adulto (D6).] → Mitigação: é o comportamento decidido. A chamada noturna conta só menores pela data de nascimento, então não muda.
- [Conflito de arquivos com outras mudanças da onda 3.] → Mitigação: com `track-course-conclusion` (mesmo executor, implementada antes), a checagem `resident_concluded` e a de faixa ficam lado a lado em `checkAdmission`. Com `hide-exits-for-adults`, ver D7. Com `simplify-room-browsing`, a edição em `room-detail.component.ts` é uma linha `<dt>`/`<dd>`. Se aquela mudança criar cartões de alojamento no mapa, eles podem mostrar a faixa com o mesmo rótulo.
- [O cliente e o servidor poderiam divergir sobre a idade.] → Mitigação: a tela usa o `minor` calculado pelo servidor (D8), e a admissão confere de novo (D9).

## Migration Plan

0. Mesclar antes, ou junto, a V30 da `remove-health-module` (branch `impl/saude-desempenho`). Com `outOfOrder` desligado, um banco persistente que receba a V31/V32 antes da V30 recusa a V30 depois e a aplicação não sobe. Não renumerar nem ligar `outOfOrder`.
1. Deploy normal. A V32 roda depois da V31, adiciona a coluna, estende a constraint de auditoria e preenche pelo nome.
2. Rollback: a coluna é nula e o código anterior a ignora. Voltar a imagem anterior não exige desfazer a V32. Nunca editar a V32 depois de aplicada.

## Para a instituição (a confirmar com a AE)

- A faixa etária fica no alojamento inteiro (D1), e não em cada quarto.
- Residente sem data de nascimento não entra em alojamento com faixa (D6).
- Quem faz 18 anos num quarto de menores continua lá até alguém transferi-lo (D6).
- Se o sexo da residência (masculina ou feminina) também deve restringir a alocação. Hoje o residente não tem esse dado.
- Se a abertura da chamada noturna deve exigir a data de nascimento só dos residentes de alojamentos de menores.

## Para o operador

- Depois do deploy, conferir em `/alojamentos` a faixa de cada residência. Os nomes sem "menores de 18" ou "maiores de 18" ficam sem faixa.
- Para corrigir ou fechar a chamada de um alojamento de maiores sem menor alocado, voltar a faixa, fazer a operação e definir "Maiores" de novo.
