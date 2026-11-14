# Spec Delta

## ADDED Requirements

### Requirement: Fechamento em data posterior

Ao fechar uma chamada cuja data é anterior à data civil atual de America/Sao_Paulo, segundo o relógio do servidor, a tela SHALL pedir a confirmação e a justificativa, mesmo dentro da janela de 22h00 a 23h30. A tela SHALL também avisar que a chamada é de um dia anterior (RN09; diagrama de sequência da chamada noturna, passo 9, cap4.tex:436).

#### Scenario: Chamada do dia anterior dentro da janela

- **GIVEN** uma chamada aberta de 29/09/2026 e o relógio do servidor em 30/09/2026, às 22h30
- **WHEN** o supervisor revisa o fechamento
- **THEN** a tela avisa que a chamada é de um dia anterior e pede a confirmação e a justificativa antes de fechar

#### Scenario: Chamada do dia anterior fora da janela

- **GIVEN** uma chamada aberta de 29/09/2026 e o relógio do servidor em 30/09/2026, às 8h
- **WHEN** o supervisor revisa o fechamento
- **THEN** a tela avisa que a chamada é de um dia anterior e que não é o horário da chamada, e pede a confirmação e a justificativa antes de fechar

#### Scenario: Chamada do mesmo dia dentro da janela

- **GIVEN** uma chamada aberta de 30/09/2026 e o relógio do servidor em 30/09/2026, às 22h30
- **WHEN** o supervisor revisa o fechamento
- **THEN** a tela fecha sem pedir confirmação nem justificativa

### Requirement: Justificativas da chamada de até 2.000 caracteres

As justificativas da chamada noturna no acesso por conta, ou seja, as de abertura ou fechamento fora da janela, de fechamento em data posterior e de correção, SHALL aceitar de 10 a 2.000 caracteres e informar esse limite (UC05).

#### Scenario: Abertura fora da janela com justificativa longa

- **WHEN** o supervisor abre a chamada fora da janela com uma justificativa de 2.000 caracteres
- **THEN** a tela aceita e envia a abertura

#### Scenario: Correção com justificativa curta

- **WHEN** o supervisor corrige uma marcação com uma justificativa de 9 caracteres
- **THEN** a tela informa o limite de 10 a 2.000 caracteres e não envia
