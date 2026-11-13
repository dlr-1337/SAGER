# Spec Delta

## Purpose

Colocar residentes em quartos, transferi-los e encerrar a alocação, guardando o histórico e respeitando a capacidade e a situação de cada quarto.

## ADDED Requirements

### Requirement: Um quarto ativo por residente

Cada residente SHALL ter no máximo uma alocação ativa. Colocar num quarto quem já tem alocação ativa MUST receber 409 `active_conflict`, inclusive quando dois pedidos chegam ao mesmo tempo (RN15, RF019).

#### Scenario: Residente já alocado

- **GIVEN** um residente com alocação ativa no quarto 101
- **WHEN** o gestor tenta colocá-lo também no quarto 102
- **THEN** o servidor responde 409 `active_conflict` e a alocação no 101 continua a única ativa

### Requirement: Quarto que recebe alocação

Colocar ou transferir um residente para quarto em Manutenção, Indisponível, sem capacidade definida ou sem vaga MUST ser recusado com 409, sem criar alocação. Pedidos simultâneos MUST NOT ultrapassar a capacidade do quarto (RN15, RF019).

#### Scenario: Quarto em manutenção

- **GIVEN** um quarto em Manutenção com vagas
- **WHEN** o supervisor tenta colocar um residente nele
- **THEN** o servidor responde 409 `room_unavailable` e nenhuma alocação é criada

#### Scenario: Quarto cheio

- **GIVEN** um quarto com capacidade 2 e dois moradores
- **WHEN** o gestor tenta colocar um terceiro residente
- **THEN** o servidor responde 409 `room_full`

#### Scenario: Última vaga disputada

- **GIVEN** um quarto com uma vaga livre
- **WHEN** gestor e supervisor colocam residentes diferentes nele ao mesmo tempo
- **THEN** só uma das alocações é criada e a outra recebe 409

### Requirement: Transferência entre quartos

A transferência SHALL encerrar a alocação atual com o motivo transferência e criar a nova no quarto de destino, na mesma transação e com auditoria das duas mudanças. Transferir para o mesmo quarto MUST ser recusado, e qualquer recusa MUST manter a alocação de origem ativa (RF019, UC19).

#### Scenario: Transferência aceita

- **GIVEN** um residente no quarto 101 e uma vaga no quarto 205
- **WHEN** o supervisor o transfere para o 205
- **THEN** a alocação no 101 fica encerrada por transferência e a do 205 fica ativa

#### Scenario: Destino sem vaga

- **GIVEN** um residente no quarto 101 e o quarto 205 cheio
- **WHEN** o gestor tenta transferi-lo para o 205
- **THEN** o servidor responde 409 e a alocação no 101 continua ativa

### Requirement: Encerramento da alocação

Gestor e supervisor SHALL encerrar uma alocação ativa, que libera a vaga e passa ao histórico com a data e o motivo do encerramento (RF019, UC19).

#### Scenario: Residente deixa a residência

- **GIVEN** um residente alocado no quarto 101
- **WHEN** o gestor encerra a alocação
- **THEN** o residente fica sem quarto e o quarto 101 ganha uma vaga

### Requirement: Histórico de alocações

O histórico do residente SHALL listar todas as suas alocações, ativas e encerradas, com quarto, data de entrada, data de saída e motivo do encerramento, e nenhuma alocação MUST ser apagada (RF019; cap. 4, diagrama entidade-relacionamento de contas e gestão).

#### Scenario: Residente transferido duas vezes

- **GIVEN** um residente que passou pelos quartos 101 e 205 e está no 310
- **WHEN** o supervisor consulta o histórico dele
- **THEN** aparecem as três alocações, as duas primeiras encerradas por transferência
