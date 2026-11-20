## MODIFIED Requirements

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

#### Scenario: Cabeçalho com pendências

- **GIVEN** o supervisor na demonstração, num celular de 320 px, com pendências no menu
- **WHEN** ele olha o cabeçalho
- **THEN** "SAGER", a etiqueta "Demonstração" e o botão "Menu" com o número ficam lado a lado, sem um cobrir o outro
