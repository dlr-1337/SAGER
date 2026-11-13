# Spec Delta

## Purpose

Manter os responsáveis legais vinculados a cada residente e definir quando um responsável pode ser indicado numa saída longa.

## ADDED Requirements

### Requirement: Responsáveis do residente

Gestor e supervisor SHALL cadastrar e editar responsáveis vinculados a um residente, com nome, vínculo, telefone e situação ativa ou inativa, aceitando vários responsáveis por residente. O telefone é obrigatório no responsável novo ou alterado, como fixa `registration-validation`, e o cadastro antigo sem telefone continua válido. O responsável MUST deixar de valer ao ser inativado, sem ser apagado (RF017, UC13).

#### Scenario: Dois responsáveis

- **GIVEN** um residente com a mãe cadastrada como responsável
- **WHEN** o supervisor cadastra também o pai
- **THEN** os dois aparecem como responsáveis do residente

#### Scenario: Responsável inativado

- **WHEN** o gestor marca um responsável como inativo
- **THEN** o responsável continua no cadastro, como inativo

#### Scenario: Residente inexistente

- **WHEN** alguém tenta cadastrar um responsável para um residente que não existe
- **THEN** o servidor recusa e nada é gravado

### Requirement: Responsável apto para a saída longa

Somente um responsável ativo, vinculado ao próprio residente e com telefone válido no formato +55 SHALL poder ser indicado numa saída longa. Indicar outro responsável MUST receber 409 `guardian_not_eligible`, sem criar nem alterar o pedido (RN03).

#### Scenario: Responsável inativo

- **GIVEN** um residente cujo único responsável está inativo
- **WHEN** ele pede uma saída longa indicando esse responsável
- **THEN** o servidor responde 409 `guardian_not_eligible` e nenhum pedido é criado

#### Scenario: Responsável sem telefone

- **GIVEN** um responsável ativo sem telefone cadastrado
- **WHEN** o residente o indica numa saída longa
- **THEN** o servidor responde 409 `guardian_not_eligible`

#### Scenario: Responsável de outro residente

- **WHEN** um residente indica o responsável de outro residente
- **THEN** o servidor responde 409 `guardian_not_eligible`

### Requirement: Mudança no responsável exige nova autorização

Qualquer alteração do cadastro do responsável (nova versão) depois do envio do documento MUST impedir a conferência e a aprovação da saída longa com 409 `guardian_not_eligible`, até que uma nova autorização seja enviada e conferida (RN03, RN04; cap. 4, diagrama entidade-relacionamento da autorização).

#### Scenario: Responsável alterado antes da conferência

- **GIVEN** uma saída longa com o documento enviado ao responsável e o arquivo devolvido
- **WHEN** o gestor corrige o nome do responsável e o supervisor tenta conferir a autorização
- **THEN** o servidor responde 409 `guardian_not_eligible` e a autorização continua sem conferência

#### Scenario: Telefone corrigido depois da conferência

- **GIVEN** uma saída longa com autorização conferida
- **WHEN** o gestor corrige o telefone do responsável e o supervisor tenta aprovar a saída
- **THEN** o servidor responde 409 `guardian_not_eligible` e a saída continua aguardando análise
