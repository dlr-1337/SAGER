# Design

## Context

Motivação em `proposal.md` (Why). Estado atual que molda a solução:

- A tela Quartos (`frontend/src/app/features/management/rooms.component.ts`) carrega o mapa inteiro de `GET /api/v1/quartos/mapa` (alojamentos, casas e quartos numa só resposta, 93 quartos em produção) e faz tudo no cliente: filtra, pagina de 25 em 25 e agrupa por alojamento, casa e piso. Os filtros já guardam `accommodationId` e `unitId`, lembrados por `rememberFilters`, e a troca de alojamento já limpa a casa.
- A ordem vem do SQL: `ORDER BY accommodation_id, unit_id NULLS FIRST, floor NULLS FIRST, number` (`RoomRepository.findAll`), ou seja, UUID e texto. A tela só reordena os grupos, dentro da página.
- A situação é calculada no SQL (`RoomRepository.SITUATION`): Manutenção e Indisponível gravados prevalecem; senão, Ocupado quando a ocupação atinge a capacidade; senão, Disponível, inclusive sem capacidade. A alocação recusa quarto sem capacidade com `capacity_unknown` (`AllocationService.checkAdmission`), mas só depois de testar a situação.
- A auditoria da edição compara a situação gravada nova com a situação exibida, tratando Ocupado como Disponível (`RoomService.update`). O formulário faz o mesmo ao abrir (`room-form.component.ts`, `setFields`).
- `cleaningScore` é sempre nulo no backend (`RoomRepository.map`) e o guard do frontend exige nulo; `RoomApiService.list/get/page` e `RoomService.list()` não têm chamadas fora dos testes.
- `simplify-long-lists` entrega, antes desta change e pelo mesmo executor, o `<sager-filter-panel>` (busca sempre visível, demais filtros recolhíveis em `<details>`, chips dos ativos removíveis, aberto acima de 760 px e fechado no celular) e o `<sager-pagination>` com tamanho 25, que some com uma página só e devolve o foco ao título da lista.
- `remove-demo-mode` e `remove-health-module` já terão saído: a tela não tem mais ramos de demonstração.

## Goals / Non-Goals

**Goals:**

- Navegação do geral ao específico com o mapa que já é carregado, sem endpoint, rota ou migração nova.
- Uma única ordenação para todas as telas que usam o mapa.
- Situação do quarto sem contradição entre legenda, mapa, alocação, formulário e auditoria.

**Non-Goals:**

- Cache do mapa, wrapper de `fetch` e busca só dos moradores no detalhe (são de `speed-up-navigation`).
- Mudar a ordem que o servidor usa na chamada noturna ou na busca paginada `GET /api/v1/quartos`.
- Tornar a capacidade obrigatória.

## Decisions

### D1. Níveis no próprio componente, guiados pelos filtros que já existem

O nível sai dos controles `accommodationId` e `unitId`: sem alojamento, cartões de alojamento; com alojamento que tem casas e sem casa escolhida, cartões de casa; nos demais casos, a grade. A trilha é um `<nav>` com lista ordenada; "Quartos" limpa os dois controles, o alojamento limpa só a casa, e o item atual leva `aria-current="location"`. Os cartões são botões com classe própria (por exemplo `mg-place-tile`) que reaproveitam o visual de `.mg-room-grid` e `.mg-room-tile`, para que os testes que contam `.mg-room-tile` continuem contando só quartos. O título de cada nível tem `tabindex="-1"` e recebe o foco quando o usuário muda de nível, não no carregamento nem na restauração. Depois de carregar o mapa, um `accommodationId` ou `unitId` lembrado que não existe mais volta a vazio. Como os controles já são lembrados, voltar do detalhe restaura o nível sem código novo.

*Rejeitada:* rotas `/quartos/:alojamento/:casa`. Dariam link direto e "voltar" do navegador por nível, mas pedem rotas, guards e carregamento novos para um ganho que ninguém pediu.

*Rejeitada:* endpoint por nível ou paginação no servidor. Os 93 quartos cabem numa resposta, que a tela já busca.

### D2. Quartos sem casa num alojamento com casas

Aparecem em grade abaixo dos cartões das casas, com o título "Quartos fora de casa ou bloco".

*Rejeitada:* um cartão "Sem casa" com valor especial no controle `unitId`. Precisaria de um valor sentinela no filtro, na trilha e na memória dos filtros.

### D3. Busca e filtro ativos mostram a grade no escopo do nível

Com busca, Situação, "Só com vagas" ou Piso ativos, a tela mostra a grade agrupada (alojamento, casa, piso) dos quartos que atendem dentro do nível atual; no primeiro nível, de todos os alojamentos. "Limpar filtros" limpa só busca, Situação, "Só com vagas" e Piso, nunca o nível. Os totais (capacidade, moradores, vagas livres) aparecem com a grade e somam os quartos filtrados do escopo.

*Rejeitada:* filtros só no último nível. Obrigaria a navegar até a casa para achar um quarto pelo código, que é o uso mais comum da busca.

### D4. Ordem natural uma vez, na leitura do mapa

`RoomApiService.map()`, depois de validar o contrato, devolve os três vetores ordenados com `Intl.Collator('pt-BR', { numeric: true })`: alojamentos por nome; casas por nome do alojamento e nome; quartos por nome do alojamento, casa (sem casa primeiro, depois nome), posição do piso (sem piso primeiro, "Térreo", números, depois o resto pelo nome), número e código. Os comparadores e o `floorPosition`, hoje no fim de `rooms.component.ts`, passam para `housing.models.ts`. Os grupos da tela seguem a ordem de chegada, então a reordenação de grupos sai. Se `speed-up-navigation` já tiver posto memória em `map()`, a ordenação acontece antes de guardar o resultado. A seleção de quarto da chamada noturna, montada a partir das linhas da chamada e ordenada pelo rótulo com o mesmo tipo de comparação, continua como está.

*Rejeitada:* `COLLATE` ICU numérico no SQL. Exige migração, muda vários `ORDER BY` e não resolve a ordem pelo nome do alojamento, que não está em `sager_room`.

*Rejeitada:* ordenar em cada tela. O mapa alimenta dez telas (quartos, detalhe e formulário do quarto, residentes, ficha do residente, lista e formulário de limpeza, saídas, chamada e relatórios).

### D5. Quarto sem capacidade aparece Indisponível

Uma linha no `CASE` de `RoomRepository.SITUATION`, logo depois de Manutenção e Indisponível gravados: `WHEN capacity IS NULL THEN 'Indisponível'`. Vale para o mapa, para `GET /api/v1/quartos/{id}`, para a busca e para o filtro de situação, que usam a mesma expressão. Em `AllocationService.checkAdmission`, o teste de capacidade nula passa para antes do teste de situação, para a recusa continuar pedindo que se defina a capacidade (`capacity_unknown`) em vez de dizer só que o quarto está indisponível.

*Rejeitada:* legenda dizendo "Disponível, se tiver capacidade". Mantém na tela um Disponível que não recebe ninguém.

*Rejeitada:* capacidade obrigatória. Pede migração e quebra a edição de quartos antigos; o formulário hoje aceita deixar em branco.

### D6. Auditoria compara a situação gravada

`RoomService.update` lê a situação gravada da linha já travada (uma consulta nova em `RoomRepository`, por exemplo `storedSituation(id)`) e compara com a escolha nova. O mapeamento "Ocupado vira Disponível" sai, porque deixa de ser preciso.

*Rejeitada:* estender o mapeamento para "Indisponível sem capacidade vira Disponível". Erra quando o Indisponível foi escolhido de fato.

### D7. Formulário pede a situação do quarto sem capacidade

Em `room-form.component.ts`, ao abrir a edição, um quarto sem capacidade exibido como Indisponível fica com a situação vazia; o campo já é obrigatório. A dica do campo ganha a frase "Sem capacidade, o quarto aparece como Indisponível." Ocupado continua virando "Automática".

*Rejeitada:* pré-selecionar "Automática". Apagaria em silêncio um Indisponível escolhido.

*Rejeitada:* expor a situação gravada no JSON do quarto. Muda o contrato e todos os specs e e2e que simulam o mapa.

### D8. Filtros no painel compartilhado

A busca vai na área sempre visível do `<sager-filter-panel>`; Situação (select), "Só com vagas" (caixa de seleção, controle booleano) e Piso (select, só quando `floors()` não está vazio) vão para a parte recolhível, com chips. Saem os controles `occupancy`, `accommodationId` e `unitId` da área de filtros (os dois últimos continuam no grupo, como estado de navegação). "Só com vagas" mantém o significado do antigo "Com vagas": quarto com capacidade definida e moradores abaixo dela, em qualquer situação.

*Rejeitada:* manter o filtro Ocupação. Suas cinco opções repetem Situação ("Lotados" é Ocupado) e "Capacidade não definida" passa a ser Indisponível.

*Rejeitada:* "Só com vagas" igual a Disponível. Repetiria exatamente o filtro Situação.

### D9. Legenda como lista de definições

A legenda vira um `<dl>` com o ponto colorido, o nome e a explicação de cada situação, com os textos do requisito "Legenda das situações". Ela aparece só junto da grade (os cartões de alojamento e de casa não mostram situação), depois da paginação e antes da nota, para que no celular o primeiro cartão ou quarto venha logo depois dos filtros. A nota do rodapé passa a dizer: "Disponível e Ocupado mudam sozinhos com os moradores. Manutenção e Indisponível são escolhidos no cadastro do quarto."

*Rejeitada:* explicação em dica ao passar o mouse. Não aparece no celular nem para quem usa teclado.

### D10. Paginação logo depois da grade

O `<sager-pagination>` sai do fim do `<main>` e entra na seção da grade, logo depois do último grupo e antes da nota, ancorado no título do nível. A paginação continua no cliente sobre os quartos filtrados do escopo; a correção da página restaurada que deixou de existir continua em `load()`.

*Rejeitada:* paginação no servidor com `GET /api/v1/quartos`. Para 93 quartos não compensa, e os filtros já são feitos no cliente.

### D11. Remoção do código morto em duas pontas, frontend primeiro

No mesmo grupo de tarefas, o frontend para de exigir `cleaningScore` (tipo, guard e fixtures) antes de o backend tirar o campo do `RoomRecord`; assim nenhuma combinação intermediária rejeita o mapa. Saem também `RoomApiService.list/get/page`, o import de `readArrayPage`, `RoomService.list()` sem filtros, a linha "Sem avaliação" do mapa e o bloco "Última nota de limpeza" do detalhe.

*Rejeitada:* preencher `cleaningScore` com a última nota real. Exige juntar com as avaliações de limpeza, fica fora do pedido, e o ranking já mostra as notas.

### D12. Duplicação entre `room-filters` e `block-filters`

`room-filters` "Quarto dependente do alojamento e do bloco" absorve a única parte própria de `block-filters` "Cascata de seleção" (trocar o alojamento limpa a casa ou bloco), e "Cascata de seleção" sai com Reason e Migration. A ordem natural entra em `room-filters`, que já trata de todas as seleções de local.

*Rejeitada:* juntar as duas capacidades. O schema proíbe mover ou renomear capacidade.

## Risks / Trade-offs

- [Os e2e e specs que esperam quartos logo ao abrir `/quartos` quebram] → os testes listados no grupo 4 de `tasks.md` passam a escolher o alojamento ou a usar a busca.
- [A nova ordem muda as opções das seleções em residentes, limpeza, saídas, relatórios e na ficha do residente, e algum teste pode conferir a ordem antiga] → o grupo 3 roda as suítes inteiras de unidade e e2e.
- [Mudanças paralelas mexem nos mesmos arquivos: `add-accommodation-age-group` (`housing.models.ts`, guard de alojamento em `room-api.service.ts`), `track-course-conclusion` (`room-detail.component.ts`) e `speed-up-navigation` (`room-api.service.ts`)] → implementar sobre a versão já integrada dessas changes; a ordenação fica depois da validação e antes de qualquer memória.
- [Cliente da API que lia `cleaningScore` ou contava com "Disponível" para quarto sem capacidade] → o único cliente versionado é o frontend. O script não versionado `scripts/popular_estrutura_if.py` lê a situação do mapa, mas cadastra todos os quartos com capacidade.
- [Quarto sem capacidade em produção passa a aparecer Indisponível] → é o comportamento pedido; o operador confere a contagem antes de publicar (Migration Plan).
- ["Só com vagas" inclui quarto em Manutenção ou Indisponível com cama livre] → a legenda explica que essas situações não recebem residentes; para achar onde alocar agora, o filtro Situação "Disponível". A regra fica a confirmar com a AE.
- [Os e2e simulam o mapa e continuam devolvendo "Disponível" para quarto sem capacidade] → o cálculo da situação é coberto pelos testes de integração do backend; os e2e só conferem a tela.
- [Filtros lembrados com chaves antigas (`occupancy`)] → a memória de filtros é por sessão, em memória, e `patchValue` ignora chaves que não existem mais.
- [Foco que pula sozinho atrapalha leitor de tela] → o foco só se move quando o próprio usuário muda de nível.

## Migration Plan

1. Sem migração de banco: a mudança de situação é só de leitura (`CASE`).
2. Antes de publicar, o operador roda `SELECT count(*) FROM sager_room WHERE capacity IS NULL` no banco de produção. Se houver quartos, eles passam a aparecer Indisponível até alguém definir a capacidade.
3. Publicar backend e frontend juntos, como de costume; o frontend do grupo 1 aceita o quarto com e sem `cleaningScore`.
4. Reversão: voltar o commit. Nenhum dado gravado muda.

## Pendências da instituição e do operador

- A confirmar com a AE: o significado de cada situação e quem escolhe Manutenção e Indisponível (hoje gestor e supervisor, pelas mesmas permissões de cadastro do AGENTS.md).
- A confirmar com a AE: quarto sem capacidade definida tratado como Indisponível.
- A confirmar com a AE: "Só com vagas" e as vagas livres dos cartões contarem cama livre de quarto em Manutenção ou Indisponível.
- Operador e AE: conferir e homologar as capacidades dos quartos em produção, pendentes desde 30/09/2026, e o operador roda a contagem do Migration Plan antes de publicar.
