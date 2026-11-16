## ADDED Requirements

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

### Requirement: Acesso sem rolar

A tela de acesso SHALL caber na altura visível da janela, sem rolar, a partir de 360 por 640 px no celular e de 1024 por 600 px no computador. Em telas menores, com o teclado aberto ou com zoom, a página MUST continuar rolando, sem esconder nenhuma parte do formulário.

#### Scenario: Celular pequeno

- **GIVEN** o acesso de produção numa tela de 360 por 640 px
- **WHEN** a tela abre
- **THEN** usuário, senha, "Entrar" e os links de ajuda aparecem sem rolar

#### Scenario: Notebook com barra do navegador

- **GIVEN** o acesso de produção numa janela de 1366 por 617 px
- **WHEN** a tela abre
- **THEN** a página não rola

#### Scenario: Tela menor que o formulário

- **GIVEN** o acesso numa tela de 320 por 568 px
- **WHEN** o usuário rola até o fim
- **THEN** o botão "Entrar" e os links de ajuda ficam alcançáveis
