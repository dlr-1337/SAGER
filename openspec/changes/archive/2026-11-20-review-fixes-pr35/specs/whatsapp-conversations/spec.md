## MODIFIED Requirements

### Requirement: Conversas na altura e na largura da tela

No computador, a tela de Conversas SHALL ocupar a largura da área de trabalho e a altura visível abaixo do cabeçalho, com o nome do contato e o texto das mensagens em pelo menos 18 px; a lista e as mensagens rolam por dentro. Com 600 px de altura ou mais, a página MUST NOT rolar além do rodapé, logo abaixo da tela, e o menu lateral MUST NOT se mover. No celular, a conversa aberta SHALL caber na altura visível, e a lista segue a rolagem da página.

#### Scenario: Sem conversas no computador

- **GIVEN** o supervisor em Conversas, sem nenhuma conversa, numa janela de 1280 por 720 px
- **WHEN** ele rola a página para baixo até o fim
- **THEN** a página desce só até mostrar o rodapé, sem espaço vazio depois dele
- **AND** o menu lateral fica parado

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
- **THEN** o campo de mensagem fica à vista sem rolar, e a página só rola até o rodapé


#### Scenario: Conversa não lida fora da vista

- **GIVEN** uma lista com mais conversas do que cabem na tela, e uma conversa não lida no fim dela, fora da vista
- **WHEN** o supervisor rola a página para baixo até o fim
- **THEN** a página desce só até mostrar o rodapé, sem espaço vazio depois dele
