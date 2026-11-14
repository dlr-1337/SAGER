## Why

Em 14/11/2026 o dono pediu que o sistema seja extremamente simples e didático para servidores com pouca prática com computador e para quem tem TDAH: pouco texto, passo a passo, um caminho claro por tela e nenhum par de botões fazendo a mesma coisa. Hoje várias telas vão na direção contrária:

- "Mais filtros" abre sozinho no computador e lembra o estado por tela (`list-browsing` "Busca à vista e filtros extras recolhíveis" e "Estado do painel lembrado por tela"), então a primeira coisa que o servidor vê é uma parede de campos.
- Cursos abre com o formulário de cadastro em cima da lista (`features/management/courses.page.ts`).
- A avaliação de limpeza mostra local, data retroativa, quatro critérios e observação de uma vez (`cleaning-form-local.page.ts`).
- O detalhe da saída longa mostra ao mesmo tempo dados, histórico, documento enviado, arquivos recebidos, arquivos sem vínculo, autorização e até nove botões (`long-exit-detail.component.ts`); o da saída curta repete "Atualizar dados" ao lado das ações.
- As etiquetas de situação de saídas, chamada e comunicações aparecem todas na mesma cor cinza, e o mesmo estado tem nomes diferentes no filtro e na lista: advertência "Ativa" no filtro e "Valendo" na lista; comunicação "Publicado" no filtro e "Valendo" na lista.
- No link de ação com ícone, o sublinhado do hover passa por baixo do ícone (`action-links` "Link de ação com ícone sem sublinhado em repouso").
- A chamada noturna tem um filtro "Marcação" que a reunião decidiu tirar.

A mudança segue a regra do AGENTS.md "Keep important actions clearly labeled and preserve the approved responsive design; use Impeccable for UI changes", o usuário descrito em PRODUCT.md ("tarefas essenciais precisam ser claras, legíveis e fáceis de acionar") e `plain-language` ("Palavras do dia a dia", "Ação principal à vista"). Nenhuma regra de domínio muda: notas de limpeza, chamada, conferência da autorização e decisão continuam como estão. Os nomes de botões e diálogos que a monografia cita continuam: "Conferir autorização recebida", "Confirmar conferência", "Recusar arquivo" e "Baixar arquivo" (cap. 7, Fig. 6.3, capturada na tela por conta da saída longa) e "Registrar volta" (cap. 8, tabela de correspondência).

## What Changes

- **Filtros recolhidos:** "Mais filtros" começa fechado ao abrir qualquer tela, em qualquer largura, e só abre com o clique. Sai a memória do painel por tela. A busca principal e os filtros ativos continuam à vista.
- **Formulário só quando pedido:** nenhuma tela de lista abre com formulário de cadastro. Cursos passa a mostrar a lista e "Cadastrar curso"; Editar também abre o formulário, e Salvar ou Cancelar o fecham. Advertências mantém a lista com "Nova advertência", que já leva ao formulário.
- **Avaliação de limpeza em três passos:** "Qual quarto?", "Notas" e "Conferir e salvar", um por vez, com Voltar e Continuar; a avaliação de outro dia fica recolhida no passo 1. A correção começa em "Notas".
- **Saídas em passos:** resumo do pedido e só o passo do momento: "Autorização do responsável" (só na longa), "Decisão", "Saída" (só na agendada aprovada, com "Registrar saída" quando a hora pedida chega) e "Volta" (só "Registrar volta"). Aprovar o pedido para sair agora já registra a saída (`auto-departure-on-approval`) e leva direto à "Volta". Na longa, cada arquivo recebido tem "Baixar arquivo", "Confirmar conferência" e "Recusar arquivo", "Anexar arquivo" fica à vista no passo da autorização e "Rejeitar" continua à vista antes da conferência (`guardian-authorization` "Rejeição antes da conferência"). Histórico, documento enviado, arquivos já decididos, arquivos sem vínculo e "Cancelar pedido" ficam em "Mais detalhes".
- **Situação com cor e legenda:** toda etiqueta de situação de saídas, chamada, notificações, advertências, avisos e comunicações do residente ganha o tom do seu significado, com o texto mantido, e cada tela ganha a legenda recolhida "O que significa cada cor?". O mesmo estado passa a ter o mesmo nome no filtro e na lista. "Rejeitar" e "Recusar arquivo" ficam em vermelho.
- **Links com ícone:** em repouso, sem sublinhado; no hover, só o texto é sublinhado, nunca o ícone.
- **Pouco texto:** no máximo uma frase curta de orientação abaixo do título de cada tela; explicações longas vão para a Ajuda ou para um "Saiba mais" recolhido; cada confirmação diz em uma frase o que vai acontecer.
- **Chamada noturna:** sai o filtro "Marcação"; ficam a busca por nome ou matrícula, casa ou bloco e quarto.
- **BREAKING** (só interface): some o filtro "Marcação" da chamada; "Aprovar saída longa" e "Rejeitar pedido" passam a "Aprovar saída" e "Rejeitar"; o filtro de advertências troca "Ativa" por "Valendo" e o de comunicações do residente troca "Publicado" por "Valendo".

**Fora do escopo:**
- Regras de domínio: nota de limpeza (quatro critérios de 0 a 10 e média, `cleaning-evaluation`), marcação e fechamento da chamada (`night-call`), conferência e decisão separadas (`guardian-authorization` "Decisão separada da conferência", que não muda).
- Simplificar os critérios de limpeza para cinco níveis e remover advertências ou termos: decisões da reunião que ficam para outra change.
- Backend, API, banco e permissões: nada muda.
- A partida registrada na aprovação do pedido para sair agora e a regra de "Registrar saída" só a partir da hora pedida na agendada, que ficam com a change `auto-departure-on-approval`; a atualização automática das telas e a saída de "Atualizar dados", que ficam com a change `auto-refresh-pages`. Esta change é aplicada depois das duas, porque mexe nos mesmos detalhes de saída (design D11 e D12).
- As telas só da demonstração (`operations/exits.component.ts`, `exit-detail.component.ts`, `night-call.component.ts`, `notifications.component.ts`, `cleaning.component.ts`, `ranking.component.ts`, `communications/notices.page.ts` e o início da demonstração em `portal/portal.pages.ts`), que ficam iguais para preservar as figuras e as capturas da monografia. As telas compartilhadas com a demonstração (residentes, responsáveis, supervisores, alojamentos, quartos, relatórios) acompanham a mudança; na de relatórios (Fig. 6.5) só a frase do cabeçalho pode mudar.
- A legenda do mapa de quartos, que já existe e segue `room-map`.
- O formulário de filtros de Relatórios (`report-generation` "Filtros opcionais recolhidos"), que já abre fechado.
- O texto do "Aviso de conferência" da chamada (`night-call-justification`), que continua valendo e só fica mais curto.

## Capabilities

### New Capabilities

- `simple-screens`: como as telas do acesso por conta ficam simples e didáticas: formulário só quando pedido, uma frase de orientação por tela, confirmação em uma frase, situação com cor e legenda, mesmo nome no filtro e na lista, rejeição em vermelho, avaliação de limpeza em passos, detalhe da saída longa e da curta com só o próximo passo e filtros da chamada noturna.

### Modified Capabilities

- `list-browsing`: "Busca à vista e filtros extras recolhíveis" passa a abrir "Mais filtros" sempre fechado; "Estado do painel lembrado por tela" é removido.
- `action-links`: "Link de ação com ícone sem sublinhado em repouso" passa a sublinhar só o texto no hover, nunca o ícone.

## Impact

- **Frontend compartilhado:** `shared/filter-panel.component.ts` (sem `FilterState` para o painel), novo `shared/status-legend.component.ts` com o mapa de tons, `.btn-danger`, estilo de passos e regra dos links com ícone em `frontend/src/styles.scss` e `shared/_back-link.scss`.
- **Operações:** `exits-local.component.ts`, `exit-detail-local.component.ts`, `long-exit-detail.component.ts`, `night-call-local.component.ts`, `operations-local.utils.ts`.
- **Comunicações e disciplina:** `communication-filters.component.ts`, `communications-local.utils.ts`, `notifications-local.pages.ts`, `warnings-local.pages.ts`, `notices-local.pages.ts`, `own-communications-local.pages.ts`, `recurrence-local.pages.ts`.
- **Gestão e limpeza:** `courses.page.ts`, `cleaning-form-local.page.ts`, `cleaning-local.pages.ts`, `residents.component.ts`, `rooms.component.ts`, `accommodations.component.ts`, `guardians.pages.ts`, `supervisors.component.ts`, `reports-local.pages.ts` (só textos).
- **Portal e Ajuda:** `portal/portal.pages.ts` (`HelpPage`) e `portal/local-home.page.ts` (textos curtos do início do acesso por conta).
- **Testes:** Vitest das peças compartilhadas e das telas tocadas; e2e `action-links`, `communications-local`, `notices-mobile`, `operations-local`, `long-exits-local`, `cleaning-reports-local`, `management-pagination-local`, `enrollment-catalog-recovery`, `residents-local`, `guardians-local`, `supervisors-local`, `accommodations-local`, com as verificações axe que já existem.
- **Documentação:** `DESIGN.md` (padrão de lista, formulário, passos e cores), `docs/MANUAL.md`, `AGENTS.md` (uma linha em Coding Style), `docs/ARQUITETURA.md` (contagem de capacidades) e a página Ajuda.
- **Backend, API e banco:** sem mudança. **Dependências:** nenhuma nova.
