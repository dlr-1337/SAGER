# Design

## Context

Motivação em `proposal.md` (Why). Estado atual que molda a solução:

- A tela Quartos (`frontend/src/app/features/management/rooms.component.ts`) carrega o mapa inteiro de `GET /api/v1/quartos/mapa` (alojamentos, casas e quartos numa só resposta, 93 quartos em produção) e faz tudo no cliente: filtra, pagina de 25 em 25 e agrupa por alojamento, casa e piso. Os filtros já guardam `accommodationId` e `unitId`, lembrados por `rememberFilters`, e a troca de alojamento já limpa a casa.
- A ordem vem do SQL: `ORDER BY accommodation_id, unit_id NULLS FIRST, floor NULLS FIRST, number` (`RoomRepository.findAll`), ou seja, UUID e texto. A tela só reordena os grupos, dentro da página.
- A situação é calculada no SQL (`RoomRepository.SITUATION`): Manutenção e Indisponível gravados prevalecem; senão, Ocupado quando a ocupação atinge a capacidade; senão, Disponível, inclusive sem capacidade. A alocação recusa quarto sem capacidade com `capacity_unknown` (`AllocationService.checkAdmission`), mas só depois de testar a situação.
- A auditoria da edição compara a situação gravada nova com a situação exibida, tratando Ocupado como Disponível (`RoomService.update`). O formulário faz o mesmo ao abrir (`room-form.component.ts`, `setFields`).
- `cleaningScore` é sempre nulo no backend (`RoomRepository.map`) e o guard do frontend exige nulo; `RoomApiService.list/get/page` e `RoomService.list()` não têm chamadas fora dos testes.
- `simplify-long-lists` entrega, antes desta change e pelo mesmo executor, o `<sager-filter-panel>` (busca sempre visível, demais filtros recolhíveis em `<details>`, chips dos ativos removíveis, aberto acima de 760 px e fechado no celular) e o `<sager-pagination>` com tamanho 25, que some com uma página só e devolve o foco ao título da lista.
- O modo demonstração (RF027, cap4:133) continua, e `remove-health-module` já terá saído. Na tela Quartos, o ramo `isDemo()` monta a grade com os quartos fictícios de `ManagementDemoService` (bloco, piso e situação escolhida, sem capacidade), filtra por Bloco (`rooms.component.ts:85-93` e `:403`), esconde Ocupação e totais (`:128` e `:217`), tem os cenários carregando, erro e vazio com "Voltar ao cenário padrão" e a nota própria (`:301`). Ela também inventa nota de limpeza: `cleaningScore` em `management.models.ts:57` e `management-demo.service.ts:124-196` e `:391`, exibida no cartão (`rooms.component.ts:277` e `:369-372`) e no detalhe (`room-detail.component.ts:237-245`).
- A monografia não tem captura da tela Quartos (cap7), e o diagrama de classes de gestão e o DER de contas e gestão (cap4:369 e :461) não têm nota de limpeza no quarto.

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

Com busca, Situação, "Só com vagas" ou Piso ativos, a tela mostra a grade agrupada (alojamento, casa, piso) dos quartos que atendem dentro do nível atual; no primeiro nível, de todos os alojamentos. "Limpar filtros" limpa só busca, Situação, "Só com vagas" e Piso, nunca o nível. Os totais (capacidade, moradores, vagas livres) aparecem com a grade e somam os quartos filtrados do escopo; as vagas livres seguem a regra de D8.

*Rejeitada:* filtros só no último nível. Obrigaria a navegar até a casa para achar um quarto pelo código, que é o uso mais comum da busca.

### D4. Ordem natural uma vez, na leitura do mapa

`RoomApiService.map()`, depois de validar o contrato, devolve os três vetores ordenados com `Intl.Collator('pt-BR', { numeric: true })`: alojamentos por nome; casas por nome do alojamento e nome; quartos por nome do alojamento, casa (sem casa primeiro, depois nome), posição do piso (sem piso primeiro, "Térreo", números, depois o resto pelo nome), número e código. Os comparadores e o `floorPosition`, hoje no fim de `rooms.component.ts`, passam para `housing.models.ts`. Os grupos da tela seguem a ordem de chegada, então a reordenação de grupos sai. Se `speed-up-navigation` já tiver posto memória em `map()`, a ordenação acontece antes de guardar o resultado. A seleção de quarto da chamada noturna, montada a partir das linhas da chamada e ordenada pelo rótulo com o mesmo tipo de comparação, continua como está.

Na demonstração, a fonte única é `ManagementDemoService.rooms`, que passa a devolver os quartos ordenados por bloco, posição do piso e número, com o mesmo comparador e o mesmo `floorPosition`. Assim a grade e a seleção de quarto dos residentes da demonstração seguem a ordem natural ("A · 202" antes de "B · 201"), e a grade mantém o Térreo antes do 1º piso, como hoje. Na seleção, cujo rótulo não mostra o piso, isso põe "B · 301" (Térreo) antes de "B · 201" (1º piso), a mesma ordem da grade.

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

Em `room-form.component.ts` (`setFields`, só no formulário do acesso por conta), ao abrir a edição, um quarto sem capacidade exibido como Indisponível fica com a situação vazia; o campo já é obrigatório. A dica do campo ganha a frase "Sem capacidade, o quarto aparece como Indisponível." Ocupado continua virando "Automática".

*Rejeitada:* pré-selecionar "Automática". Apagaria em silêncio um Indisponível escolhido.

*Rejeitada:* expor a situação gravada no JSON do quarto. Muda o contrato e todos os specs e e2e que simulam o mapa.

### D8. Filtros no painel compartilhado

A busca vai na área sempre visível do `<sager-filter-panel>`; Situação (select), "Só com vagas" (caixa de seleção, controle booleano) e Piso (select, só quando `floors()` não está vazio) vão para a parte recolhível, com chips. Saem os controles `occupancy`, `accommodationId` e `unitId` da área de filtros (os dois últimos continuam no grupo, como estado de navegação).

"Só com vagas" mostra só quartos que podem receber alocação agora: vaga livre e situação fora de Manutenção e Indisponível, porque esses quartos não recebem alocação (RN15, cap4:170). As vagas livres dos cartões de alojamento e de casa e dos totais da grade somam só esses quartos, para o número do cartão bater com o que o filtro mostra. O cartão de cada quarto continua mostrando as vagas dele ao lado da situação. Com D5, o conjunto do filtro é o mesmo da situação Disponível; o filtro fica porque o dono pediu "com vagas" em 13/11 e é um atalho de um toque.

*Rejeitada:* manter o filtro Ocupação. Suas cinco opções repetem Situação ("Lotados" é Ocupado) e "Capacidade não definida" passa a ser Indisponível.

*Rejeitada:* o significado do antigo "Com vagas" (capacidade definida e moradores abaixo dela, em qualquer situação). Ofereceria como vaga um quarto em Manutenção que recusa a alocação, contra a RN15.

*Rejeitada:* tirar "Só com vagas" e indicar a situação Disponível. Seria menos código, mas contraria o pedido do dono; fica como ponto a rever depois da implementação.

### D9. Legenda como lista de definições

A legenda vira um `<dl>` com o ponto colorido, o nome e a explicação de cada situação, com os textos do requisito "Legenda das situações". Ela aparece só junto da grade (os cartões de alojamento e de casa não mostram situação), depois da paginação e antes da nota, para que no celular o primeiro cartão ou quarto venha logo depois dos filtros. A nota do rodapé passa a dizer: "Disponível e Ocupado mudam sozinhos com os moradores. Manutenção e Indisponível são escolhidos no cadastro do quarto." A nota do detalhe do quarto no acesso por conta (`room-detail.component.ts:186-189`) troca "A situação do quarto é escolhida por você." pela mesma frase da nota do mapa e mantém "O quarto não recebe mais moradores do que a capacidade."

*Rejeitada:* explicação em dica ao passar o mouse. Não aparece no celular nem para quem usa teclado.

### D10. Paginação logo depois da grade

O `<sager-pagination>` sai do fim do `<main>` e entra na seção da grade, logo depois do último grupo e antes da nota, ancorado no título do nível. A paginação continua no cliente sobre os quartos filtrados do escopo; a correção da página restaurada que deixou de existir continua em `load()`.

*Rejeitada:* paginação no servidor com `GET /api/v1/quartos`. Para 93 quartos não compensa, e os filtros já são feitos no cliente.

### D11. Remoção do código morto em duas pontas, frontend primeiro

No mesmo grupo de tarefas, o frontend para de exigir `cleaningScore` (tipo, guard e fixtures) antes de o backend tirar o campo do `RoomRecord`; assim nenhuma combinação intermediária rejeita o mapa. Saem também `RoomApiService.list/get/page`, o import de `readArrayPage`, `RoomService.list()` sem filtros, a linha "Sem avaliação" do mapa e o bloco "Última nota de limpeza" do detalhe. A nota inventada da demonstração sai no mesmo grupo (D14).

*Rejeitada:* preencher `cleaningScore` com a última nota real. Exige juntar com as avaliações de limpeza, fica fora do pedido, e o ranking já mostra as notas.

### D12. Duplicação entre `room-filters` e `block-filters`

`room-filters` "Quarto dependente do alojamento e do bloco" absorve a única parte própria de `block-filters` "Cascata de seleção" (trocar o alojamento limpa a casa ou bloco), e "Cascata de seleção" sai com Reason e Migration. A ordem natural entra em `room-filters`, que já trata de todas as seleções de local.

*Rejeitada:* juntar as duas capacidades. O schema proíbe mover ou renomear capacidade.

### D13. Demonstração mantém a grade agrupada

Em `rooms.component.ts`, os níveis, a trilha, o foco ao mudar de nível e a limpeza dos identificadores lembrados valem só com `!isDemo()`. Na demonstração, a grade agrupada por bloco e piso entra direto, como hoje; a busca fica na área sempre visível do `<sager-filter-panel>`, e Bloco (`:85-93`, filtro em `:403`), Piso e Situação vão para a parte recolhível, com chips. Capacidade, totais e "Só com vagas" ficam ocultos pela mesma checagem `!isDemo()` que já esconde a Ocupação (`:128` e `:217`), e a legenda mostra só os nomes e as cores das quatro situações, porque as explicações falam de capacidade e de mudança automática, que a demonstração não tem. Continuam os estados de `scenario()`, o botão "Voltar ao cenário padrão" e a nota de `:301`, que é verdadeira na demonstração. O `<sager-pagination>` vai para dentro da seção da grade nos dois modos (D10). `groups()` continua sendo a página agrupada da grade e os controles `search`, `block`, `floor` e `situation` mantêm os nomes, porque `management-demo-pagination.spec.ts:41` e `e2e/management-pagination-demo.spec.ts:70-71` e `:113-116` os usam. O ramo de demonstração de `room-form.component.ts` (`:86-157`, situação em `:125-131`) não muda, salvo a frase da nota de limpeza (D14). Nenhum caminho da demonstração chama a API.

*Rejeitada:* passar a demonstração pelos níveis, tirando o controle `block`. Os quartos fictícios só têm bloco, então haveria um nível de cartões a mais sem ganho, e seria preciso reescrever os testes de demonstração que filtram por bloco. A monografia não mostra a tela Quartos (cap7), e nada pede essa mudança.

### D14. Demonstração sem nota de limpeza inventada

Sai `cleaningScore` do tipo `Room` (`management.models.ts:57`), dos quartos fictícios e de `saveRoom` (`management-demo.service.ts:124-196` e `:391`) e do quarto montado em `reports-demo-api.service.ts:180`. Saem também, em `rooms.component.ts`, `cleaningLabel` (`:29`, `:369-372`, `:381` e `:488`) e a linha "Limpeza:" (`:277-278`); em `room-detail.component.ts`, o bloco "Última nota de limpeza" da demonstração (`:237-245`); e, em `room-form.component.ts:141-142`, o trecho "e a nota de limpeza", ficando "A ocupação é mostrada no mapa e não é alterada neste formulário."

*Rejeitada:* manter a nota fictícia só na demonstração. O diagrama de classes de gestão e o DER de contas e gestão (cap4:369 e :461) não têm nota no quarto, e a demonstração mostraria à banca um dado que o sistema não tem.

## Risks / Trade-offs

- [Os e2e e specs que esperam quartos logo ao abrir `/quartos` quebram] → os testes listados no grupo 4 de `tasks.md` passam a escolher o alojamento ou a usar a busca.
- [A nova ordem muda as opções das seleções em residentes, limpeza, saídas, relatórios e na ficha do residente, e algum teste pode conferir a ordem antiga] → o grupo 3 roda as suítes inteiras de unidade e e2e.
- [Mudanças paralelas mexem nos mesmos arquivos: `add-accommodation-age-group` (`housing.models.ts`, guard de alojamento em `room-api.service.ts`), `track-course-conclusion` (`room-detail.component.ts`) e `speed-up-navigation` (`room-api.service.ts`)] → implementar sobre a versão já integrada dessas changes; a ordenação fica depois da validação e antes de qualquer memória.
- [Cliente da API que lia `cleaningScore` ou contava com "Disponível" para quarto sem capacidade] → o único cliente versionado é o frontend. O script não versionado `scripts/popular_estrutura_if.py` lê a situação do mapa, mas cadastra todos os quartos com capacidade.
- [Quarto sem capacidade em produção passa a aparecer Indisponível] → é o comportamento pedido; o operador confere a contagem antes de publicar (Migration Plan).
- ["Só com vagas" mostra o mesmo conjunto da situação Disponível] → é o efeito da RN15 com D5; o filtro fica como atalho pedido pelo dono, e tirá-lo depois apaga um controle sem mudar regra (D8).
- [As vagas livres do cartão de alojamento deixam de ser a soma das vagas mostradas nos cartões dos quartos quando há quarto em Manutenção ou Indisponível com cama livre] → o cartão do quarto mostra a situação ao lado das vagas, e a legenda diz que essas situações não recebem residentes.
- [Testes de demonstração dependem de nomes do componente: `groups()`, os controles `block`, `floor` e `situation` e a classe `.mg-room-tile`] → D13 mantém esses nomes; a tarefa 4.8 e a 5.1 rodam `management-demo-pagination.spec.ts`, `residents-demo-rooms.spec.ts`, `e2e/management-pagination-demo.spec.ts`, `e2e/route-audit.spec.ts` e `e2e/target-audit.spec.ts`.
- [A ordem dos quartos fictícios muda a ordem das opções da demonstração] → os nomes sintéticos dos testes de paginação da demonstração ("Sintético Aa", "Sintético aaa"…) já estão em ordem alfabética, então a ordem esperada não muda; as tarefas 3.4 e 4.8 conferem.
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
- Os dois itens acima entram na linha D19 das pendências de `docs/ARQUITETURA.md` (tarefa 2.1).
- Autor da monografia, depois de aplicada esta change: completar a RN15 (cap4:170) com as situações calculadas (Disponível e Ocupado), as escolhidas (Manutenção e Indisponível) e o quarto sem capacidade como Indisponível, e registrar no cap. 8 (tabela de correspondência da avaliação) a tela Quartos em níveis como resposta à dificuldade de R2 (cap8:41 e :54).
- Operador e AE: conferir e homologar as capacidades dos quartos em produção, pendentes desde 30/09/2026, e o operador roda a contagem do Migration Plan antes de publicar.
