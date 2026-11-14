# Spec Delta

## Purpose

Guardar no alojamento se ele recebe menores ou maiores de 18 anos, para que o quarto herde essa faixa, a alocação respeite a idade do residente e a chamada noturna deixe de oferecer alojamentos de maiores sem menor alocado.

## ADDED Requirements

### Requirement: Faixa etária opcional no alojamento

O cadastro de alojamento SHALL aceitar a faixa etária "Menores de 18 anos", "Maiores de 18 anos" ou nenhuma faixa, definida por gestor ou supervisor. A API MUST recusar com 400 `invalid_input` qualquer outro valor, sem mudar o cadastro nem a versão.

#### Scenario: Cadastrar alojamento de menores

- **WHEN** o gestor cadastra um alojamento e escolhe "Menores de 18 anos"
- **THEN** o detalhe do alojamento mostra "Faixa etária: Menores de 18 anos"

#### Scenario: Retirar a faixa

- **GIVEN** um alojamento de maiores
- **WHEN** o supervisor edita o alojamento e escolhe "Sem faixa definida"
- **THEN** o alojamento fica sem faixa e o detalhe mostra "Sem faixa definida"

#### Scenario: Valor desconhecido pela API

- **WHEN** uma chamada direta à API envia a faixa "ADULTOS"
- **THEN** a resposta é 400 `invalid_input` e o alojamento continua com a faixa e a versão anteriores

### Requirement: Mudança de faixa auditada

Criar um alojamento com faixa ou mudar a faixa de um alojamento SHALL gerar evento de auditoria que liste o campo `ageGroup` entre os campos alterados. Salvar sem mudar a faixa MUST NOT listar esse campo.

#### Scenario: Troca de faixa

- **WHEN** o gestor muda a faixa de um alojamento de "Maiores de 18 anos" para "Menores de 18 anos"
- **THEN** a auditoria registra a atualização do alojamento com o campo `ageGroup`

#### Scenario: Só o nome muda

- **WHEN** o gestor muda apenas o nome do alojamento
- **THEN** o evento de auditoria lista `name` e não lista `ageGroup`

### Requirement: Quarto herda a faixa do alojamento

Cada quarto SHALL ter a faixa etária do seu alojamento, sem campo próprio, e a ficha do quarto MUST mostrar essa faixa ou "Sem faixa definida".

#### Scenario: Quarto num alojamento de menores

- **GIVEN** um quarto num alojamento de menores
- **WHEN** o supervisor abre a ficha do quarto
- **THEN** a ficha mostra "Faixa etária: Menores de 18 anos"

#### Scenario: Faixa do alojamento muda

- **GIVEN** um quarto num alojamento sem faixa
- **WHEN** o gestor define o alojamento como "Maiores de 18 anos"
- **THEN** a ficha do quarto passa a mostrar "Faixa etária: Maiores de 18 anos"

### Requirement: Faixa inicial pelo nome do alojamento

Ao atualizar o sistema, cada alojamento já cadastrado SHALL receber "Menores de 18 anos" quando o nome contiver "menores de 18", "Maiores de 18 anos" quando contiver "maiores de 18", e nenhuma faixa nos demais casos, sem mudar a versão do cadastro e com um evento de auditoria do sistema por alojamento preenchido.

#### Scenario: Residência de menores pelo nome

- **GIVEN** o alojamento "Residência 2 · Masculina · menores de 18"
- **WHEN** a atualização é aplicada
- **THEN** o alojamento fica com "Menores de 18 anos", na mesma versão
- **AND** a auditoria registra uma atualização feita pelo sistema com o campo `ageGroup`

#### Scenario: Nome sem faixa

- **GIVEN** o alojamento "Alojamento Sintético"
- **WHEN** a atualização é aplicada
- **THEN** o alojamento fica sem faixa e nenhum evento de auditoria é criado para ele

#### Scenario: Nome ambíguo

- **GIVEN** um alojamento cujo nome contém "menores de 18" e "maiores de 18"
- **WHEN** a atualização é aplicada
- **THEN** o alojamento fica sem faixa

### Requirement: Alocação respeita a faixa

Colocar ou transferir um residente para quarto de alojamento com faixa SHALL ser recusado com 409 `age_group_mismatch` quando a idade dele não corresponder à faixa. A idade conta anos completos na data civil de America/Sao_Paulo, e quem faz 18 anos no dia já é maior. A recusa MUST manter a alocação atual e não gerar auditoria.

#### Scenario: Menor num alojamento de maiores

- **GIVEN** um residente de 16 anos sem quarto
- **WHEN** o gestor tenta colocá-lo num quarto com vaga de um alojamento de maiores
- **THEN** a resposta é 409 `age_group_mismatch` e o residente continua sem quarto

#### Scenario: Transferência de adulto para alojamento de menores

- **GIVEN** um residente de 19 anos num quarto de alojamento sem faixa
- **WHEN** o supervisor tenta transferi-lo para um quarto de alojamento de menores
- **THEN** a resposta é 409 `age_group_mismatch` e a alocação de origem continua ativa

#### Scenario: Aniversário de 18 anos

- **GIVEN** um residente que completa 18 anos hoje em America/Sao_Paulo
- **WHEN** o gestor tenta colocá-lo num quarto de alojamento de menores
- **THEN** a resposta é 409 `age_group_mismatch`

#### Scenario: Alojamento sem faixa

- **GIVEN** um residente de 16 anos e um quarto com vaga num alojamento sem faixa
- **WHEN** o gestor coloca o residente no quarto
- **THEN** a alocação é criada

### Requirement: Nascimento exigido em alojamento com faixa

Colocar ou transferir um residente sem data de nascimento para quarto de alojamento com faixa SHALL ser recusado com 409 `birth_date_required`. Em alojamento sem faixa, a falta da data MUST NOT impedir a alocação.

#### Scenario: Cadastro antigo sem nascimento

- **GIVEN** um residente antigo sem data de nascimento
- **WHEN** o gestor tenta colocá-lo num quarto de alojamento de menores
- **THEN** a resposta é 409 `birth_date_required` e nenhuma alocação é criada

#### Scenario: Sem nascimento e sem faixa

- **GIVEN** um residente antigo sem data de nascimento
- **WHEN** o gestor o coloca num quarto com vaga de alojamento sem faixa
- **THEN** a alocação é criada

### Requirement: Alocações ativas não mudam sozinhas

Alocações ativas MUST NOT ser encerradas nem transferidas quando o morador completa 18 anos ou quando a faixa do alojamento muda. A faixa só é conferida ao colocar ou transferir.

#### Scenario: Morador faz 18 anos

- **GIVEN** um residente num quarto de alojamento de menores
- **WHEN** ele completa 18 anos
- **THEN** a alocação continua ativa no mesmo quarto

#### Scenario: Alojamento muda de faixa com moradores

- **GIVEN** um alojamento sem faixa com moradores de 19 anos
- **WHEN** o gestor define o alojamento como "Menores de 18 anos"
- **THEN** o cadastro é salvo e as alocações dos moradores continuam ativas

### Requirement: Escolha de quarto na ficha do residente

Na ficha do residente, a escolha de quarto SHALL listar só quartos de alojamentos sem faixa e da faixa do residente, com a idade calculada pelo servidor na data civil de America/Sao_Paulo, e não pelo relógio do aparelho. Sem data de nascimento, a lista MUST trazer só quartos de alojamentos sem faixa e a tela MUST pedir a data para liberar os demais.

#### Scenario: Residente menor

- **GIVEN** um residente de 15 anos e alojamentos de menores, de maiores e sem faixa
- **WHEN** o gestor abre a escolha de quarto na ficha dele
- **THEN** a lista mostra os quartos dos alojamentos de menores e sem faixa, e nenhum quarto do alojamento de maiores

#### Scenario: Residente sem data de nascimento

- **GIVEN** um residente antigo sem data de nascimento e um alojamento de menores
- **WHEN** o supervisor abre a escolha de quarto na ficha dele
- **THEN** a lista mostra só quartos de alojamentos sem faixa
- **AND** a tela diz para informar a data de nascimento para ver os quartos com faixa etária

#### Scenario: Quarto atual de outra faixa

- **GIVEN** um morador que fez 18 anos num quarto de alojamento de menores
- **WHEN** o gestor abre a ficha dele
- **THEN** o quarto atual continua identificado na ficha, e a escolha de quarto oferece só quartos de alojamentos de maiores ou sem faixa

### Requirement: Recusa por faixa explicada na tela

Quando o servidor recusar uma alocação por faixa ou por falta de nascimento, a ficha do residente SHALL dizer o motivo e o que fazer, sem mostrar o código do erro, e MUST NOT mostrar sucesso.

#### Scenario: Faixa mudou depois de abrir a tela

- **GIVEN** a ficha de um residente menor aberta com um quarto de alojamento sem faixa escolhido
- **WHEN** outra pessoa define aquele alojamento como "Maiores de 18 anos" e o gestor confirma a escolha
- **THEN** a tela informa que o quarto é de outra faixa etária e pede para escolher um quarto da faixa do residente

#### Scenario: Falta a data de nascimento

- **WHEN** o servidor recusa a alocação com `birth_date_required`
- **THEN** a tela pede para informar a data de nascimento do residente antes de colocá-lo no quarto

### Requirement: Chamada noturna em alojamentos de menores

A chamada noturna SHALL oferecer os alojamentos de menores, os sem faixa e os de maiores que ainda tenham residente menor de 18 anos com alocação ativa, com a idade calculada na data civil de America/Sao_Paulo pelo relógio do servidor. Consultar ou abrir pela API a chamada de um alojamento de maiores sem menor alocado MUST ser recusado com 422 `invalid_reference`.

#### Scenario: Seletor de alojamento

- **GIVEN** os alojamentos "Residência 2" de menores, "Vila Estudantil" de maiores sem menor alocado e "Alojamento Sintético" sem faixa
- **WHEN** o supervisor abre a chamada noturna
- **THEN** o seletor oferece "Residência 2" e "Alojamento Sintético", e não oferece "Vila Estudantil"

#### Scenario: Abertura direta pela API

- **GIVEN** um alojamento de maiores sem menor alocado
- **WHEN** uma chamada direta à API tenta abrir a chamada noturna desse alojamento
- **THEN** a resposta é 422 `invalid_reference` e nenhuma chamada é criada

#### Scenario: Alojamento vira "Maiores" com um menor alocado

- **GIVEN** um residente de 16 anos alocado num alojamento sem faixa
- **WHEN** o gestor define o alojamento como "Maiores de 18 anos" e o supervisor abre a chamada noturna
- **THEN** o seletor continua oferecendo o alojamento
- **AND** a chamada abre com o residente de 16 anos e fecha depois que ele é marcado
