# plain-language Specification

## Purpose
Fazer com que residentes adolescentes e servidores sem prática com computador entendam as telas e saibam o que fazer em cada situação.

## Requirements

### Requirement: Sem texto de ambiente de teste no uso real

As telas do modo real MUST NOT mencionar ambiente de teste, dados fictícios, backend ou API.

#### Scenario: Cadastro em produção

- **WHEN** um gestor abre o cadastro de residente
- **THEN** a tela não fala em dados fictícios nem em backend

### Requirement: Sem identificadores técnicos na tela

As telas MUST NOT mostrar UUID, hash, número de versão interna, nem códigos crus de situação. Esses dados SHALL continuar na auditoria.

#### Scenario: Marcação da chamada

- **WHEN** o supervisor vê uma ausência justificada
- **THEN** a tela mostra o tipo da saída, sem identificador

### Requirement: Palavras do dia a dia

Rótulos e ajudas SHALL usar o glossário da change, com frases curtas que digam o que fazer.

#### Scenario: Pedido de saída pelo residente

- **WHEN** o residente abre o pedido de saída curta
- **THEN** os campos perguntam "Que horas você volta?" e "Por que você quer sair?"

### Requirement: Erros que dizem o que fazer

Toda mensagem de erro SHALL dizer o que aconteceu e o que fazer em seguida, sem citar código nem termo técnico.

#### Scenario: Conflito de edição

- **WHEN** duas pessoas editam o mesmo registro
- **THEN** a tela informa que outra pessoa alterou e oferece "Recarregar dados"

#### Scenario: Sem conexão

- **WHEN** o servidor não responde
- **THEN** a tela pede para verificar a internet e tentar de novo

### Requirement: Ação principal à vista

A ação principal de cada tela SHALL ficar visível sem depender de outra escolha, e o residente MUST NOT receber filtros que não fazem sentido para a própria lista.

#### Scenario: Residente nas saídas

- **WHEN** o residente abre as saídas
- **THEN** ele vê "Pedir saída curta (até 3 horas)" e "Pedir saída longa (mais de 3 horas)", sem filtro por nome ou matrícula

### Requirement: Legibilidade

Texto secundário MUST ter pelo menos 16 px, e caixas de seleção pelo menos 28 px, sem rolagem horizontal em 320 px.

#### Scenario: Ajuda de campo

- **WHEN** um formulário mostra uma dica
- **THEN** a dica tem pelo menos 16 px
