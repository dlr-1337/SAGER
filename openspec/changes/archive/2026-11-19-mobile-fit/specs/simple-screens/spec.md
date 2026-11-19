## ADDED Requirements

### Requirement: Nada vaza no celular

A partir de 320 px de largura, no acesso por conta e na demonstração, a página MUST NOT rolar na horizontal, e nenhum texto, campo, botão, caixa de marcar ou cartão SHALL passar da borda da tela ou do painel, cartão, filtro, diálogo ou item de lista em que está. Tabelas largas rolam dentro da própria caixa. Um diálogo aberto SHALL caber na altura visível, com o conteúdo rolando por dentro e os botões à vista.

#### Scenario: Filtro com datas

- **GIVEN** o supervisor no celular, numa tela de 320 px de largura
- **WHEN** ele escolhe "Escolher datas" em Relatórios ou abre os filtros da limpeza
- **THEN** "Data inicial" e "Data final" ficam dentro do card, sem rolagem horizontal

#### Scenario: Diálogo com a barra do navegador

- **GIVEN** a chamada noturna fora do horário, num celular de 360 px com 600 px de altura visível
- **WHEN** o supervisor clica em "Abrir chamada"
- **THEN** o diálogo cabe na tela, o conteúdo rola por dentro e "Cancelar" e "Abrir chamada" ficam à vista

#### Scenario: Menu no celular

- **WHEN** o usuário abre o Menu num celular de 320 px
- **THEN** a gaveta e todos os itens dela cabem na largura da tela

### Requirement: Botões de decisão no mesmo padrão

Nas decisões do supervisor da notificação de ocorrência, da avaliação de limpeza, do aviso, da advertência e do termo, os botões SHALL ficar num grupo só, com a ação principal primeiro e destacada e as outras na ordem do fluxo, todos do mesmo tamanho, alinhados numa grade e com o texto quebrando dentro do botão. No celular, cada botão SHALL ocupar a largura do painel. Links de consulta ficam fora do grupo.

#### Scenario: Notificação pendente no celular

- **GIVEN** uma notificação de ocorrência pendente, aberta num celular de 360 px
- **WHEN** o supervisor olha "Decisão do supervisor"
- **THEN** ele vê, um por linha e com a mesma largura e altura, "Criar advertência" em destaque, "Registrar visualização", "Iniciar análise" e "Arquivar com justificativa"

#### Scenario: Avaliação de limpeza

- **WHEN** o supervisor abre uma avaliação de limpeza no celular
- **THEN** "Corrigir com justificativa" ocupa a largura do painel e "Ver ranking deste período" fica abaixo, como link

#### Scenario: Computador

- **GIVEN** a notificação de ocorrência aberta no computador
- **WHEN** o supervisor olha "Decisão do supervisor"
- **THEN** os botões ficam juntos, do mesmo tamanho e alinhados, com "Criar advertência" primeiro

### Requirement: Confirmação marcada em caixa

Num diálogo, a declaração com caixa de marcar SHALL ficar numa caixa com a largura e o recuo dos avisos do mesmo diálogo, com a marca à esquerda e o texto quebrando a linha ao lado dela. A caixa marcada SHALL mudar de cor, e o texto da declaração MUST continuar o mesmo.

#### Scenario: Chamada fora do horário

- **GIVEN** o diálogo "A chamada será aberta." fora do horário, num celular de 320 px
- **WHEN** o supervisor rola até a confirmação
- **THEN** "Confirmo o registro fora do horário da chamada (22h às 23h30)." aparece numa caixa da largura do aviso amarelo, com o texto quebrado em linhas dentro dela
