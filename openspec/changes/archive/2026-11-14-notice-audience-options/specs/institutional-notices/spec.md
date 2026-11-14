## MODIFIED Requirements

### Requirement: Ciclo do aviso institucional

Somente o supervisor SHALL redigir, publicar, revisar e retirar avisos. O rascunho MUST ter título de 3 a 200 caracteres, texto de 3 a 4.000 e de 1 a 2.000 residentes destinatários cadastrados, sem repetição, e a retirada MUST trazer motivo de 10 a 2.000 caracteres, valendo só para aviso publicado (RF023, UC22).

#### Scenario: Aviso sem destinatário

- **WHEN** o supervisor tenta criar um aviso sem nenhum residente
- **THEN** o servidor responde 400 e nenhum aviso é criado

#### Scenario: Aviso para mais de 100 residentes

- **WHEN** o supervisor cria um aviso para 101 residentes cadastrados
- **THEN** o rascunho é criado com os 101 destinatários

#### Scenario: Aviso acima do limite

- **WHEN** o supervisor tenta criar um aviso para 2.001 residentes
- **THEN** o servidor responde 400 e nenhum aviso é criado

#### Scenario: Rascunho não chega ao residente

- **GIVEN** um aviso em rascunho para o residente A
- **WHEN** o residente A consulta os próprios avisos
- **THEN** o rascunho não aparece

#### Scenario: Retirada

- **WHEN** o supervisor retira um aviso publicado com motivo
- **THEN** o aviso aparece ao residente como retirado, com o motivo

#### Scenario: Gestor tenta publicar

- **WHEN** um gestor tenta criar um aviso
- **THEN** o servidor responde 403

## ADDED Requirements

### Requirement: Destinatários por critério

Ao preparar um aviso, o supervisor SHALL escolher quem recebe por uma opção: todos os residentes com quarto ativo, os de um alojamento, os de um quarto, só os de 18 anos ou mais, só os menores de 18 ou pessoas escolhidas uma a uma. Nas opções por idade, a idade MUST seguir a data civil de America/Sao_Paulo, e quem não tem data de nascimento MUST NOT entrar. A tela SHALL mostrar quantos vão receber e deixar desmarcar alguém, e a lista salva no rascunho MUST NOT mudar depois.

#### Scenario: Todos os moradores

- **GIVEN** os residentes A e B com quarto ativo e o residente C sem quarto
- **WHEN** o supervisor escolhe "Todos os moradores" e salva o rascunho
- **THEN** o rascunho tem A e B como destinatários, e não C

#### Scenario: Um alojamento

- **GIVEN** o residente A com quarto no alojamento 1 e o residente B com quarto no alojamento 2
- **WHEN** o supervisor escolhe "Um alojamento" e o alojamento 1
- **THEN** a tela mostra "1 residente vai receber" e a lista tem só A

#### Scenario: Só maiores sem data de nascimento

- **GIVEN** o residente A, com quarto ativo e 18 anos completos hoje em America/Sao_Paulo, e o residente B, com quarto ativo e sem data de nascimento
- **WHEN** o supervisor escolhe "Só maiores de 18"
- **THEN** a lista tem A e não tem B

#### Scenario: Desmarcar alguém

- **GIVEN** o supervisor escolheu "Um quarto" e a lista tem A e B
- **WHEN** ele abre "Ver quem vai receber", desmarca B e salva o rascunho
- **THEN** o rascunho tem só A como destinatário

#### Scenario: Lista fixa depois do rascunho

- **GIVEN** um rascunho salvo com "Um alojamento" para o alojamento 1
- **WHEN** o residente C passa a ter quarto no alojamento 1 e o aviso é publicado
- **THEN** C não recebe o aviso
