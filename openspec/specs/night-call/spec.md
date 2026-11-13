# night-call Specification

## Purpose
Registrar a presença noturna dos residentes menores de idade de cada alojamento, da abertura ao fechamento da chamada, com correções justificadas e histórico de cada marcação.

## Requirements

### Requirement: Uma chamada por alojamento e data

O supervisor SHALL abrir no máximo uma chamada por alojamento e data civil de America/Sao_Paulo, pelo relógio do servidor. Uma segunda abertura MUST receber 409 `call_exists`, inclusive quando duas aberturas chegam ao mesmo tempo (RF006, RN09, UC05).

#### Scenario: Segunda abertura no mesmo dia

- **GIVEN** uma chamada já aberta hoje para a Residência 2
- **WHEN** outro supervisor tenta abrir a chamada da Residência 2
- **THEN** o servidor responde 409 `call_exists`

### Requirement: Horário excepcional confirmado

Abrir ou fechar a chamada fora da janela de 22h00 a 23h30 em America/Sao_Paulo, ou fechar em data posterior à da chamada, SHALL exigir confirmação expressa e justificativa de 10 a 2.000 caracteres. Sem a confirmação, o servidor MUST recusar com 409 `outside_window` (RN09, UC05).

#### Scenario: Abertura às 21h

- **WHEN** o supervisor tenta abrir a chamada às 21h sem confirmar o horário excepcional
- **THEN** o servidor responde 409 `outside_window` e nenhuma chamada é criada

#### Scenario: Abertura confirmada fora da janela

- **WHEN** o supervisor abre a chamada às 21h confirmando o horário e com justificativa de 10 caracteres
- **THEN** a chamada é aberta e guarda a justificativa

### Requirement: Nascimento de todos os alocados

A abertura MUST ser recusada com 409 `birth_date_required`, sem gravar nada, se algum residente alocado no alojamento não tiver data de nascimento (RN02; UC05, pré-condições).

#### Scenario: Cadastro antigo sem nascimento

- **GIVEN** um residente alocado na Residência 2 sem data de nascimento
- **WHEN** o supervisor tenta abrir a chamada da Residência 2
- **THEN** o servidor responde 409 `birth_date_required` e nenhuma chamada é criada

### Requirement: Lista congelada na abertura

Na abertura, a chamada SHALL incluir cada residente com alocação ativa no alojamento que seja menor de 18 anos na data civil de America/Sao_Paulo, copiando nome, matrícula e quarto. Alocações, transferências e aniversários posteriores à abertura MUST NOT alterar a lista (RN02, RN09, UC05).

#### Scenario: Menores e maiores no mesmo alojamento

- **GIVEN** um alojamento com um residente de 16 anos e outro de 19
- **WHEN** o supervisor abre a chamada
- **THEN** a lista traz só o residente de 16 anos

#### Scenario: Aniversário de 18 anos

- **GIVEN** um residente que completa 18 anos hoje em America/Sao_Paulo
- **WHEN** o supervisor abre a chamada do alojamento dele
- **THEN** ele não entra na lista

#### Scenario: Transferência depois da abertura

- **GIVEN** uma chamada aberta com um residente do quarto 101
- **WHEN** esse residente é transferido para outro alojamento
- **THEN** ele continua na chamada com o quarto 101

### Requirement: Marcação enquanto a chamada está aberta

Com a chamada aberta, o supervisor SHALL marcar cada residente como presente, ausente ou ausência justificada, e cada marcação MUST ficar no histórico com autor e horário. A ausência justificada MUST indicar uma saída aprovada com partida física válida no momento da abertura, ou receber 409 `authorized_exit_required` (RN10, UC05).

#### Scenario: Ausência justificada sem saída válida

- **GIVEN** um residente sem saída aprovada com partida física na abertura
- **WHEN** o supervisor o marca como ausência justificada
- **THEN** o servidor responde 409 `authorized_exit_required` e a marcação não muda

#### Scenario: Troca de marcação antes de fechar

- **GIVEN** um residente marcado como ausente numa chamada aberta
- **WHEN** o supervisor o marca como presente
- **THEN** a marcação passa a presente e o histórico guarda as duas

### Requirement: Fechamento só com todos marcados

O fechamento da chamada SHALL exigir todos os residentes da lista marcados e MUST receber 409 `incomplete_call` enquanto faltar alguém. O fechamento também MUST revalidar cada ausência justificada, automática ou marcada pelo supervisor, contra as saídas válidas na abertura, recusando com 409 `authorized_exit_outdated` (RN09, RN10, UC05; cap. 4, diagrama de sequência da chamada, passo 10).

#### Scenario: Falta um residente

- **GIVEN** uma chamada aberta com um residente sem marcação
- **WHEN** o supervisor tenta fechar a chamada
- **THEN** o servidor responde 409 `incomplete_call` e a chamada continua aberta

#### Scenario: Ausência justificada que deixou de valer

- **GIVEN** uma chamada aberta com um residente marcado pelo supervisor como ausência justificada
- **WHEN** o retorno da saída dele é registrado com horário anterior à abertura e o supervisor tenta fechar a chamada
- **THEN** o servidor responde 409 `authorized_exit_outdated` e a chamada continua aberta

### Requirement: Correção depois do fechamento

Depois do fechamento, mudar uma marcação SHALL exigir uma correção com justificativa de 10 a 2.000 caracteres, que MUST preservar a marcação anterior no histórico, MUST criar ou revisar, quando cabível, a ocorrência correspondente, criando a notificação interna ou marcando-a para revisão. Marcação comum em chamada fechada MUST receber 409 `invalid_state` (RF006, RN09; UC05, fluxo alternativo; cap. 4, diagrama de sequência da chamada, passos 13 a 16).

#### Scenario: Ausente que estava presente

- **GIVEN** uma chamada fechada com um residente marcado como ausente
- **WHEN** o supervisor corrige a marcação para presente com justificativa
- **THEN** o histórico mostra as duas marcações, a ocorrência de ausência deixa de valer e a notificação ligada a ela fica marcada para revisão

#### Scenario: Presente que estava ausente

- **GIVEN** uma chamada fechada com um residente marcado como presente
- **WHEN** o supervisor corrige a marcação para ausente com justificativa
- **THEN** o sistema cria uma ocorrência de ausência e uma notificação interna pendente para o residente

#### Scenario: Marcação comum depois de fechar

- **GIVEN** uma chamada fechada
- **WHEN** o supervisor tenta mudar uma marcação sem usar a correção
- **THEN** o servidor responde 409 `invalid_state`
