## MODIFIED Requirements

### Requirement: Cabeçalho e menu sempre à vista

Nas telas internas, o cabeçalho com a marca, "Sair" e "Menu" SHALL ficar no topo da janela enquanto a página rola. No computador, o menu lateral SHALL ficar ao lado do conteúdo com a altura da janela; quando a lista não couber, só ela rola, e o botão de sair fica à vista ao pé. A página MUST continuar rolando pela janela, e um item focado MUST NOT ficar escondido sob o cabeçalho.

#### Scenario: Lista longa no computador

- **GIVEN** o supervisor numa tela com mais dados que a janela
- **WHEN** ele rola até o fim da página
- **THEN** o cabeçalho, o menu lateral e o botão de sair continuam à vista

#### Scenario: Celular

- **GIVEN** o supervisor no celular, numa tela rolada até o fim
- **WHEN** ele olha o topo da tela
- **THEN** "Menu" está à vista e abre a gaveta com o botão de sair

#### Scenario: Foco pelo teclado

- **GIVEN** uma tela rolada até o fim
- **WHEN** o foco vai para um item do topo do conteúdo
- **THEN** o item aparece abaixo do cabeçalho

#### Scenario: Menu com contadores numa janela baixa

- **GIVEN** o supervisor com contadores no menu, numa janela de 1000 por 560 px
- **WHEN** a lista do menu lateral não cabe na altura
- **THEN** a lista rola, e cada nome fica dentro do próprio item, sem cobrir o item vizinho
