# Spec Delta

## Purpose

Manter a estrutura física da residência estudantil (alojamentos, unidades como casas ou blocos, e quartos), com códigos únicos, capacidade e situação de cada quarto.

## ADDED Requirements

### Requirement: Alojamentos e unidades

Gestor e supervisor SHALL cadastrar e editar alojamentos e, dentro de cada um, unidades como casas ou blocos, cada qual com código e nome. O código do alojamento MUST ser único sem diferenciar maiúsculas de minúsculas, e o código da unidade MUST ser único dentro do seu alojamento, com 409 `duplicate_code` para repetição (RF003, UC16).

#### Scenario: Código repetido com outra caixa

- **GIVEN** o alojamento de código "RES-2"
- **WHEN** o gestor cadastra outro alojamento com o código "res-2"
- **THEN** o servidor responde 409 `duplicate_code`

#### Scenario: Mesmo código de unidade em alojamentos diferentes

- **GIVEN** a unidade "CASA-1" no alojamento A
- **WHEN** o supervisor cadastra a unidade "CASA-1" no alojamento B
- **THEN** a unidade é gravada

### Requirement: Quartos na estrutura

Cada quarto SHALL pertencer a um alojamento e, se tiver unidade, a uma unidade desse mesmo alojamento. O código MUST ser único no sistema, e o número, único no mesmo alojamento, unidade e andar; as duas comparações não diferenciam maiúsculas de minúsculas, e dois quartos sem unidade ou sem andar contam como do mesmo lugar. A repetição MUST receber 409. Unidade de outro alojamento MUST ser recusada com 400 `invalid_location`, sem mover o quarto (RF003, UC16).

#### Scenario: Unidade de outro alojamento

- **GIVEN** um quarto no alojamento A
- **WHEN** o gestor tenta colocá-lo numa unidade do alojamento B
- **THEN** o servidor responde 400 `invalid_location` e o quarto continua onde estava

#### Scenario: Número repetido no mesmo andar

- **GIVEN** o quarto 101 no andar "Térreo" da Casa 1
- **WHEN** o gestor cadastra outro quarto 101 no andar "térreo" da Casa 1
- **THEN** o servidor responde 409 `duplicate_location` e nenhum quarto é criado

#### Scenario: Mesmo número em andar diferente

- **GIVEN** o quarto 101 sem andar na Casa 1
- **WHEN** o gestor cadastra outro quarto 101 no andar "Térreo" da Casa 1
- **THEN** o quarto é gravado

### Requirement: Situação escolhida do quarto

O cadastro do quarto SHALL permitir escolher as situações Manutenção e Indisponível, que prevalecem na consulta do quarto, e quarto em Manutenção ou Indisponível MUST NOT receber alocações (RN15; a recusa está em `resident-allocation`, "Quarto que recebe alocação"). As situações calculadas e o quarto sem capacidade definida seguem `room-map`.

#### Scenario: Manutenção prevalece

- **GIVEN** um quarto em Manutenção com vagas
- **WHEN** o gestor consulta o quarto
- **THEN** a situação mostrada é Manutenção

### Requirement: Capacidade não fica abaixo da ocupação

A capacidade de um quarto com moradores MUST NOT ser removida nem ficar abaixo do número de alocações ativas; a tentativa MUST receber 409 `capacity_below_occupancy`, sem mudar o quarto (RN15).

#### Scenario: Reduzir capacidade de quarto cheio

- **GIVEN** um quarto com capacidade 3 e 2 moradores
- **WHEN** o supervisor muda a capacidade para 1
- **THEN** o servidor responde 409 `capacity_below_occupancy` e a capacidade continua 3
