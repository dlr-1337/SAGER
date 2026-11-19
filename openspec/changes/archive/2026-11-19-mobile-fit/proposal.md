## Why

Na reunião de 19/11/2026, o dono contou que o supervisor usa o SAGER no celular, inclusive na chamada noturna, e apontou quatro problemas:

1. Na chamada noturna fora do horário, a caixa de confirmação do diálogo ("Agora não é o horário da chamada. Marque a confirmação e escreva o motivo") sai da tela e não segue o padrão das caixas acima dela.
2. Os botões de decisão do supervisor ficam desorganizados, no celular e no computador. Na notificação de ocorrência, "Registrar visualização" fica sozinho em cima, "Iniciar análise" e "Arquivar com justificativa" ocupam a largura toda e "Criar advertência", a ação principal, fica embaixo com outra largura. O mesmo vale para a avaliação de limpeza.
3. Campos e caixas saem do container no celular, como "Data inicial" e "Data final" dos filtros.
4. Falta uma revisão do celular inteiro: menu, cartões, formulários e diálogos.

A regra do `AGENTS.md` pede o desenho responsivo aprovado (`DESIGN.md`: "filtros em linha que quebram no celular; tabelas dentro de caixa com rolagem própria") e telas simples (`openspec/specs/simple-screens`). Os requisitos "Rejeitar e recusar em vermelho", "Cabeçalho e menu sempre à vista" e "Acesso sem rolar" continuam como estão.

## What Changes

- **Varredura permanente no celular** (`frontend/e2e/mobile-fit.spec.ts`):
  - entra na demonstração com gestor, supervisor e residente e visita as rotas do menu de cada um, com detalhes e formulários, em 360×740 e 320×568, com as áreas recolhidas abertas e a gaveta do menu;
  - em cada tela, confere que a página não rola na horizontal, que nenhum elemento visível passa da borda direita da tela, de cartões, painéis, diálogos, filtros, campos e itens de lista, e que um diálogo aberto cabe na altura da tela;
  - abre os diálogos principais (aprovar e rejeitar saída, arquivar notificação, salvar aviso, chamada fora do horário) e os filtros de data;
  - as telas da conta, que a demonstração não mostra, entram nos e2e com API interceptada: chamada e saídas (`operations-local`), comunicações (`communications-local`), limpeza e relatórios (`cleaning-reports-local`).
- **Botões de decisão num só padrão** nas telas do supervisor: notificação de ocorrência (conta e demonstração), avaliação de limpeza, aviso, advertência e termo:
  - um grupo só, com a ação principal primeiro e destacada, e as outras na ordem do fluxo;
  - botões do mesmo tamanho numa grade, com o texto quebrando dentro do botão;
  - no celular, um por linha, na largura do painel;
  - os links de consulta ("Ver ranking deste período", "Ver advertências do residente") saem do grupo e ficam abaixo dele.
- **Caixa de confirmação nos diálogos**: a declaração com caixa de marcar fica numa caixa com a largura e o recuo dos avisos do diálogo, e o texto quebra a linha ao lado da marca. Vale para a chamada noturna, as saídas e os diálogos de comunicação.
- **Diálogos no celular**: cabem na altura visível, com a barra do navegador; o conteúdo rola por dentro e os botões ficam à vista. No celular, os botões dividem a largura por igual quando cabem lado a lado e ficam um por linha quando não cabem.
- **Campos de data e hora**: não passam do card, inclusive no Safari do iPhone.
- `docs/MANUAL.md`: uma frase sobre o celular.

**Fora do escopo:**
- mudar textos, regras, permissões ou a ordem dos passos;
- o par "Aprovar" e "Rejeitar" das saídas, que já fica lado a lado numa grade ("Rejeitar e recusar em vermelho");
- as telas próprias da demonstração (seleção de perfil) e a marca do IF Goiano;
- teste no WebKit (Safari): o navegador não está instalado nesta máquina;
- backend, API e banco.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `simple-screens`: novos requisitos "Nada vaza no celular", "Botões de decisão no mesmo padrão" e "Confirmação marcada em caixa".

## Impact

- **Frontend:**
  - `src/styles.scss`: grupo `.decision-actions`, caixa `.confirm-check`, diálogos na altura visível e botões do diálogo no celular, campos de data e hora;
  - `features/communications/notifications-local.pages.ts`, `notices-local.pages.ts`, `warnings-local.pages.ts`, `recurrence-local.pages.ts` e `communications-local.shared.ts`;
  - `features/operations/notification-detail.component.ts` e `review-dialog.component.ts` (demonstração) e `review-dialog-local.component.ts`;
  - `features/cleaning/cleaning-local.pages.ts`;
  - e2e: `mobile-fit.ts` e `mobile-fit.spec.ts` (novos), `operations-local.spec.ts`, `communications-local.spec.ts` e `cleaning-reports-local.spec.ts`.
- **Demonstração (`demo-fidelity`):** a notificação de ocorrência da demonstração segue o mesmo padrão de botões.
- **Backend, API e banco:** sem mudança. Sem migração.
