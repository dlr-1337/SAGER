# Spec Delta

## Purpose

Permitir buscar e escolher dentro da própria lista, sem um campo de busca separado, em qualquer dispositivo e pelo teclado.

## ADDED Requirements

### Requirement: Busca dentro da lista

Uma lista com mais de 8 opções SHALL abrir um painel com campo de busca e opções ao ser acionada, e MUST NOT mostrar campo de busca separado fora do painel. A busca MUST ignorar acentos e maiúsculas.

#### Scenario: Escolher curso digitando

- **WHEN** o usuário clica em Curso, digita "agro" e clica em Agropecuária
- **THEN** o painel fecha e o curso fica selecionado no formulário

#### Scenario: Sem resultado

- **WHEN** a busca não encontra nada
- **THEN** o painel informa "Nada encontrado."

#### Scenario: Lista pequena

- **WHEN** a lista tem até 8 opções
- **THEN** a lista nativa abre normalmente

### Requirement: Uso pelo teclado e leitor de tela

O painel SHALL abrir por teclado, navegar com setas, escolher com Enter, fechar com Esc devolvendo o foco ao campo, e anunciar a quantidade de resultados.

#### Scenario: Teclado

- **GIVEN** o foco na lista
- **WHEN** o usuário aperta seta para baixo, digita, escolhe com Enter
- **THEN** a opção é selecionada e o foco volta ao campo

### Requirement: Compatibilidade com formulários

A escolha MUST atualizar o formulário como uma seleção nativa, respeitando campo desativado e opções que mudem depois de abrir.

#### Scenario: Campo dependente

- **GIVEN** um quarto que depende do bloco
- **WHEN** o usuário troca o bloco
- **THEN** o painel de quarto mostra as novas opções

### Requirement: Painel visível na tela

O painel MUST caber na tela, inclusive em 320 px e dentro de diálogos, com alvos de pelo menos 44 px.

#### Scenario: Celular

- **WHEN** o usuário abre o painel em 320 px
- **THEN** não há rolagem horizontal e as opções podem ser tocadas
