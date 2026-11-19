## ADDED Requirements

### Requirement: Conversas na altura e na largura da tela

No computador, a tela de Conversas SHALL ocupar a largura da área de trabalho e a altura visível abaixo do cabeçalho, com o nome do contato e o texto das mensagens em pelo menos 18 px. Com 600 px de altura ou mais, a janela MUST NOT rolar nem mover o menu lateral: só a lista e as mensagens rolam por dentro. No celular, a conversa aberta SHALL caber na altura visível, e a lista segue a rolagem da página.

#### Scenario: Sem conversas no computador

- **GIVEN** o supervisor em Conversas, sem nenhuma conversa, numa janela de 1280 por 720 px
- **WHEN** ele rola a página para baixo
- **THEN** a página e o menu lateral ficam parados

#### Scenario: Fim da lista

- **GIVEN** uma lista com mais conversas do que cabem na tela
- **WHEN** o supervisor rola a lista até o fim e continua rolando
- **THEN** só a lista se move, e a página fica parada

#### Scenario: Monitor grande

- **GIVEN** uma janela de 1920 por 1080 px
- **WHEN** o supervisor abre uma conversa
- **THEN** a lista e a conversa ocupam a largura da área de trabalho, e o texto das mensagens tem pelo menos 18 px

#### Scenario: Conversa no celular

- **GIVEN** uma tela de 390 por 844 px
- **WHEN** o supervisor abre uma conversa
- **THEN** o campo de mensagem fica à vista e a página não rola

### Requirement: Lista de conversas recolhível

No computador, com uma conversa aberta, o botão "Recolher conversas" SHALL esconder a lista, e a conversa SHALL ocupar a largura toda; o mesmo botão, então "Mostrar conversas", traz a lista de volta. O botão MUST informar a leitores de tela se a lista está aberta. Sem conversa aberta, a lista MUST ficar à vista. O mesmo navegador SHALL lembrar a escolha quando puder guardá-la.

#### Scenario: Recolher

- **GIVEN** uma conversa aberta no computador
- **WHEN** o supervisor clica em "Recolher conversas"
- **THEN** a lista some e a conversa ocupa a largura toda
- **AND** o botão passa a "Mostrar conversas", marcado como recolhido

#### Scenario: Mostrar de novo

- **GIVEN** a lista recolhida
- **WHEN** o supervisor clica em "Mostrar conversas"
- **THEN** a lista volta ao lado da conversa

#### Scenario: Sem conversa aberta

- **GIVEN** a lista recolhida
- **WHEN** o supervisor volta a Conversas sem nenhuma conversa aberta
- **THEN** a lista aparece

#### Scenario: Escolha lembrada

- **GIVEN** a lista recolhida
- **WHEN** o supervisor recarrega a conversa no mesmo navegador
- **THEN** a lista continua recolhida

#### Scenario: Celular

- **WHEN** o supervisor abre uma conversa no celular
- **THEN** não há botão de recolher, e a lista e a conversa continuam alternando
