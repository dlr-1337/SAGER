## Context

Motivação em `proposal.md` (Why). Estado atual que molda a solução:

- `frontend/src/app/shared/pagination.component.ts` fixa 25 itens em três pontos, só aceita total, aparece mesmo com uma página só e não move o foco ao trocar de página. É usada em residentes, responsáveis, supervisores, alojamentos, saídas e no mapa de quartos.
- O padrão cursor + "Carregar mais", com contador de geração, está copiado em `cleaning-local.pages.ts`, `notices-local.pages.ts`, `notifications-local.pages.ts`, `warnings-local.pages.ts`, `own-communications-local.pages.ts` e `recurrence-local.pages.ts`. As linhas de relatório (`reports-local.pages.ts`) usam offset de 20 com "Carregar mais registros", e cursos têm navegação própria duplicada (`courses.page.ts`).
- O único filtro recolhível é o `<details class="report-filters">` de Relatórios, aprovado em `DESIGN.md`. Já existem a classe global `.filter-chips` (`styles.scss`), `rememberFilters` e `rememberValue` (`core/filter-state.ts`, estado em memória limpo na troca de usuário) e `readArrayPage` (`core/list-page.ts`).
- Os endpoints de cursor já aceitam `limit` de 1 a 100 (padrão 25, limpeza 20) e `beforeSequence`. As linhas de relatório aceitam `offset` e `limit`. Nenhuma mudança de backend é necessária.
- Em limpeza, notificações, advertências e responsáveis, a lista de residentes (e, na limpeza, o mapa de quartos) é buscada de novo a cada filtro ou página.
- Esta mudança é implementada na onda 3, depois de `remove-health-module` e `speed-up-navigation`. Não há tela de saúde a tratar. A demonstração permanece (RF027, cap4.tex:133) e nenhuma carga nova pode chamar a API com ela ativa. As telas adotadas mantêm os ramos `isDemo()`/`session.active()`: residentes e alojamentos paginam `demoFiltered` no cliente com o mesmo `sager-pagination`, e limpeza e ranking continuam trocando para `app-cleaning`/`app-ranking`. Se `speed-up-navigation` já tiver trocado os serviços pelo wrapper único de `core/api.ts`, as chamadas citadas aqui seguem o novo formato, sem mudar o plano.

## Goals / Non-Goals

**Goals:**

- Três peças pequenas e reaproveitadas: painel de filtro, paginação com ou sem total e helper de páginas por cursor. As telas passam a usá-las, e o saldo é de remoção de código.
- Nenhuma mudança de contrato de API, banco ou permissão.

**Non-Goals:**

- Contagem de registros nas listas por cursor.
- Lembrar a página atual das listas por cursor ao voltar do detalhe: hoje elas também voltam ao início.
- Recolher o painel do mapa de quartos, que fica com `simplify-room-browsing`.

## Decisions

### D1. Painel de filtro com `<details>` nativo

`<sager-filter-panel>` em `shared/filter-panel.component.ts`, com cerca de 50 linhas. Entradas: `heading` (título do painel), `key` (nome da tela para lembrar o estado) e `chips` (`{ key, label, value }[]`, com o valor já legível). Saídas: `remove(key)` e `clear()`. Conteúdo projetado: `[filterMain]` para a busca sempre visível e o slot padrão para os filtros extras, dentro de `<details>` com o resumo "Mais filtros". Os chips usam `.filter-chips` e ficam fora do `<details>`, junto com "Limpar filtros". O estado inicial é `matchMedia('(min-width: 761px)')`, e o evento `toggle` grava em `FilterState` sob `filter-panel:<key>`. `.filter-panel` em `styles.scss` repete o visual do resumo de Relatórios (`.report-filters`); `reports-local.scss` fica como está, porque Relatórios não adota o painel (D9).

- Rejeitado: `MatExpansionPanel` e `MatPaginator`. Aumentam o pacote inicial e trazem outro visual, enquanto o `<details>` já tem o visual aprovado em `DESIGN.md`.
- Rejeitado: contador "(N ativos)" no resumo. O componente não sabe quais chips estão na área recolhida, e os chips já mostram o que está ativo.
- Rejeitado: entrada para começar sempre fechado. Só Relatórios precisaria dela, e Relatórios fica fora do painel (D9).
- Rejeitado: mover as regras de `reports-local.scss` para `styles.scss` e fazer Relatórios usá-las. Mexeria numa tela que fica fora do escopo para economizar poucas linhas de CSS.

### D2. Telas sem filtros extras não usam o painel

Supervisores, alojamentos e "Minhas avaliações de limpeza" têm só a busca, ou só as datas. Eles mantêm o campo atual e adotam apenas a paginação. Assim o componente não precisa detectar se o slot de extras está vazio.

- Rejeitado: entrada `extras` no painel ou detecção de conteúdo projetado. É código a mais para esconder um `<details>` vazio.

### D3. Paginação única com dois modos

`sager-pagination` ganha `size = input(25)`, `hasNext = input<boolean | null>(null)` e `anchor = input<string>()`. Com `hasNext` diferente de `null`, mostra "Página N" e habilita Próxima por `hasNext`. Sem ele, mostra "início–fim de total". O componente não aparece quando `page === 0` e não há próxima página (`!hasNext`, ou `total <= size`). Depois de emitir `pageChange`, ele foca e rola até `#anchor`. Cada tela dá ao título da lista um `id` e `tabindex="-1"`, e esse título continua na tela durante o carregamento: só a área abaixo dele troca de estado. O foco acontece só por clique em Anterior ou Próxima. Troca de aba ou de parâmetro de consulta não move a página (capability `tab-navigation`).

- Rejeitado: achar o título pelo `<section>` mais próximo. Exige zero ligação, mas quebra em telas cujo primeiro título não é o da lista (ranking, relatórios).
- Rejeitado: componente separado para cursor. Duplicaria botões, estilos e testes.

### D4. Helper `cursorPages` com páginas visitadas em memória

Em `core/list-page.ts`, `cursorPages<T>(fetch: (cursor?: number) => Promise<{ items: T[]; nextCursor: number | null }>, message: (error: unknown) => string)` devolve os sinais `items`, `page`, `hasNext`, `loading` e `error`, mais `reload()` (volta à página 1 e esquece as visitadas) e `go(n)`. As páginas visitadas ficam em memória até o próximo `reload()`, então Anterior mostra exatamente o que já foi visto. Um contador de geração descarta a resposta de um pedido antigo. O helper substitui `load`/`more`/`apply` nas seis telas por cursor.

- Rejeitado: guardar só a pilha de cursores e consultar de novo ao voltar. Um registro novo empurraria itens da página 1 que não estão na página 2 guardada, e o usuário os perderia de vista.
- Rejeitado: serviço global de paginação. Não há estado a compartilhar entre telas.

### D5. Linhas de relatório, ranking e cursos usam o modo com total

As linhas de relatório já trazem o total: a página `n` pede `offset = n * 25` e `limit = 25`, e o validador de `reports-local-api.service.ts` passa a exigir 25. Na demonstração, `reports-demo-api.service.ts` devolve páginas do mesmo tamanho (`offset + 25`, `limit: 25`), para que a página `n` não pule registros. O ranking já traz todos os quartos, e cursos já têm a lista inteira. Os dois paginam no cliente com `[total]="lista.length"`. No ranking, as linhas `own` do residente são repetidas num bloco "Seu quarto neste período", acima da lista.

- Rejeitado: paginar o ranking no servidor. Mudaria o contrato de uma lista de 93 itens que já chega numa resposta só.
- Rejeitado: filtrar o ranking por alojamento. A posição deixaria de ser a geral; fica para a AE decidir (Open Questions).

### D6. Filtro aplicado sozinho e painel fora do estado de carregamento

Limpeza e saídas passam a aplicar o filtro em `valueChanges` com espera de 250 ms, como residentes e comunicações já fazem. Os botões "Buscar avaliações" e "Buscar" saem. Na limpeza, o painel sai do `@if (!loading() && !error())`. O ranking mantém "Ver período": a escolha do período não é um painel de filtro de lista e continua um envio explícito. Relatórios também mantêm a aplicação no clique de "Gerar relatório".

- Rejeitado: aplicar o período do ranking sozinho. Exigiria tirar o formulário do estado de carregamento e mexer em três passos do e2e, sem pedido do dono.

### D7. `CommunicationFiltersComponent` refeito sobre o painel

Busca visível; datas, situação, categoria, gravidade, "Marcou Estou ciente?" e residente nos extras. Os modos `warnings` e `notifications` ganham o campo residente, e `notifications` ganha a situação com os rótulos de notificação. O próprio componente busca a lista de residentes uma vez, só nesses dois modos; ele continua renderizado só dentro dos blocos `!session.active()` das páginas, então não chama a API na demonstração. As páginas de notificações e advertências apagam o segundo painel e o `ResidentApiService`. O componente sempre emite `changed` uma vez no início, com o filtro lembrado ou vazio, e só então a página carrega. Isso acaba com a carga dupla. Em Advertências, o link "Revisar possível reincidência deste residente" fica acima da lista quando há residente filtrado.

- Rejeitado: a página passar os residentes ao componente por entrada. Manteria o mesmo carregamento repetido em duas páginas.

### D8. Opções carregadas uma vez por tela

Limpeza (mapa e residentes), responsáveis (residentes) e o filtro de comunicações (residentes) buscam as opções no construtor, separadas de `load()`, como `residents.component.ts` já faz. A carga única só roda no acesso por conta, com `!session.active()` (`!isDemo()` em responsáveis), como o `load()` já faz (`cleaning-local.pages.ts:264`, `guardians.pages.ts:276`); na demonstração, as opções continuam vindo dos serviços de demonstração, sem requisição (RF027). O cache curto de `speed-up-navigation` continua valendo entre telas.

- Rejeitado: cache global novo nesta mudança. Já pertence a `speed-up-navigation`.

### D9. Fora da adoção

A lista de conversas do WhatsApp mantém "Carregar mais conversas": ela atualiza sozinha (capability `whatsapp-conversations`), e páginas fixas brigariam com a atualização. O mapa de quartos só ganha o comportamento novo de `sager-pagination` (some com uma página). O painel e o `anchor` dele chegam com `simplify-room-browsing`.

O formulário de Relatórios mantém o `<details class="report-filters">` fechado, com o rótulo "Filtrar por alojamento, bloco, quarto ou residente (opcional)" e o bloco de filtros ativos atuais, como na Figura 070 (cap7.tex:88-101); só as linhas da consulta adotam a paginação (D5). Os ramos da demonstração em Relatórios (o aviso de que nenhum arquivo é baixado e o link `/relatorios/individual/ana`) ficam iguais.

As telas só da demonstração (`operations/ranking.component.ts`, `exits.component.ts`, `notifications.component.ts`, `night-call.component.ts` e `cleaning.component.ts`, e `communications/notices.page.ts`) ficam iguais. Elas aparecem nas capturas da monografia (Figura 031, cap7.tex:38-52; cap7.tex:20) e no ranking do residente da demonstração (cap8.tex:136), e são listas pequenas de dados fictícios.

- Rejeitado: adotar o painel em Relatórios, como na versão anterior desta mudança. Abriria os filtros no computador e contradiria a Figura 070.
- Rejeitado: adotar o painel e a paginação nas telas só da demonstração. Mudaria as capturas da monografia sem ganho para o uso real.

## Risks / Trade-offs

- [Rótulos removidos quebram e2e: "Buscar avaliações" (`cleaning-reports-local.spec.ts` 626 e 651), "Buscar" (`operations-local.spec.ts` 451), "Carregar mais avisos" (`communications-local.spec.ts` 894) e "Carregar mais registros" (`cleaning-reports-local.spec.ts` 915). Os cliques que abrem "Filtrar por alojamento" (`cleaning-reports-local.spec.ts` 788, 887 e 989; `reports-mobile-dialog.spec.ts` 54) não mudam, porque Relatórios mantém o formulário.] → Cada grupo de tarefas atualiza os testes da tela que muda.
- [Paginação oculta com uma página quebra asserções "1–25 de 25" em `management-pagination-local.spec.ts`, `operations-local.spec.ts`, `long-exits-local.spec.ts`, `rooms-local.spec.ts`, `management-pagination.spec.ts`, `rooms-local.component.spec.ts` e, na demonstração, `management-demo-pagination.spec.ts` (167 e 194) e `e2e/management-pagination-demo.spec.ts` (100); "Página 1" em `courses.page.spec.ts` e `e2e/enrollment-catalog-recovery.spec.ts` (216), que também troca "Página 2" (207) pelo total.] → Atualizadas no grupo 1 (ou no grupo da tela), com asserção de paginação ausente.
- [E2e no celular que preenchem filtros precisam abrir "Mais filtros" antes.] → No computador (viewport padrão de 1280 px do Playwright) a área abre sozinha, então os e2e de desktop não mudam.
- [Arquivos mexidos em paralelo na onda 3: `residents.component.ts` e `courses.page.ts` (`track-course-conclusion`), `night-call-local.component.ts` (`add-accommodation-age-group`), área de saídas (`hide-exits-for-adults`).] → Mudanças em trechos diferentes (lista e filtro contra formulário, marcação e seletor). Quem integrar por último refaz o rebase e roda os testes focados da tela.
- [Opções carregadas uma vez ficam desatualizadas se outro usuário cadastrar um residente com a tela aberta.] → Aceito. Recarregar a página resolve.
- [Páginas visitadas em memória não mostram mudanças feitas por outro usuário enquanto se navega entre elas.] → Aceito. Mudar o filtro ou reabrir a tela consulta de novo.
- [Primeira avaliação visível sem rolar a 390 × 844 depende da altura real dos campos.] → Medida no e2e novo pelo `boundingBox` do primeiro item. Se falhar, a data final também vai para "Mais filtros".

## Migration Plan

Só frontend; publicação normal. Para voltar atrás basta reverter o commit, porque não há dados nem contrato novos.

## O que a instituição ou o operador ainda precisa decidir

- **A confirmar com a AE:** se recolher os filtros extras no celular, mantendo a busca e os filtros ativos à vista, atende ao RNF de usabilidade e acessibilidade (cap4.tex:201) e à resposta ao achado "Filtros mantidos ocultavam registros" (cap8.tex:134). Esta é uma leitura técnica, não um aceite.
- **A confirmar com a AE:** se o ranking deve ter filtro por alojamento e, nesse caso, se a posição continua geral ou passa a ser dentro do alojamento.
- **A confirmar com a AE:** teste com usuários representativos (pessoas mais velhas) do painel recolhido e da paginação, como `DESIGN.md` já pede para a validação institucional e como a monografia deixa para a etapa seguinte (cap4.tex:201).
- **Autores da monografia:** depois de aplicada, registrar o padrão de lista em cap6.tex:77 (busca à vista, "Mais filtros", etiquetas removíveis, páginas de 25 e foco no título) e, em cap8.tex:136, que o ranking do residente repete acima da lista a linha do próprio quarto no período.
- **Operador:** nada a configurar.

## Open Questions

- Nenhuma que mude especificação ou tarefas. O tamanho de 25 e a ausência de total nas listas por cursor foram decididos pelo dono em 13/11/2026.
