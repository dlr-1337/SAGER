# Spec Delta

## Purpose

Transformar ausências, retornos atrasados e limpezas abaixo de 6,00 em ocorrências e notificações internas para análise do supervisor, e registrar advertências e termos de compromisso só por decisão humana.

## ADDED Requirements

### Requirement: Ocorrências automáticas

O sistema SHALL criar uma ocorrência e uma notificação interna pendente, uma única vez por origem e residente, quando uma chamada fechada tiver o residente como ausente sem saída autorizada, quando um retorno for confirmado com atraso e, para cada participante, quando a nota de limpeza ficar abaixo de 6,00 (RF004, RN11, UC10).

#### Scenario: Limpeza abaixo de 6,00

- **GIVEN** um quarto com dois participantes
- **WHEN** o supervisor registra uma avaliação com nota 5,75
- **THEN** cada participante recebe uma ocorrência de limpeza e uma notificação pendente

#### Scenario: Nota exatamente 6,00

- **WHEN** o supervisor registra uma avaliação com nota 6,00
- **THEN** nenhuma ocorrência é criada

#### Scenario: Chamada ainda aberta

- **GIVEN** um residente marcado como ausente numa chamada aberta
- **WHEN** ninguém fecha a chamada
- **THEN** nenhuma ocorrência de ausência é criada

### Requirement: Nenhuma advertência automática

Ocorrências e notificações MUST NOT registrar advertência, termo ou penalidade por conta própria; toda advertência SHALL nascer de uma ação do supervisor (RN11; cap. 4, Escopo do Sistema e Perfis de Acesso e Atores; cap. 5, Rotinas Agendadas).

#### Scenario: Notificação sem decisão

- **GIVEN** uma notificação pendente de retorno atrasado
- **WHEN** passam vários dias sem ação do supervisor
- **THEN** o residente continua sem advertência

### Requirement: Origem corrigida exige revisão

Quando a origem de uma ocorrência for corrigida, o sistema SHALL guardar uma nova revisão da ocorrência, marcá-la como inválida se deixou de se enquadrar e marcar a notificação como exigindo revisão. A conversão de notificação que exige revisão ou com ocorrência inválida MUST receber 409 `evidence_review_required` (RN11, UC04).

#### Scenario: Ausência corrigida para presença

- **GIVEN** uma notificação de ausência ainda não convertida
- **WHEN** o supervisor corrige a marcação da chamada para presente
- **THEN** a ocorrência fica inválida, com a revisão anterior guardada, e a notificação passa a exigir revisão

#### Scenario: Conversão antes da revisão

- **GIVEN** uma notificação que exige revisão
- **WHEN** o supervisor tenta convertê-la em advertência
- **THEN** o servidor responde 409 `evidence_review_required`

### Requirement: Análise da notificação

Somente o supervisor SHALL visualizar, analisar, arquivar ou converter uma notificação. O arquivamento MUST trazer um motivo da lista e uma justificativa de 10 a 2.000 caracteres, e arquivamento e conversão são decisões finais: uma segunda decisão MUST receber 409 `invalid_state` (RF005, UC04).

#### Scenario: Arquivamento justificado

- **WHEN** o supervisor arquiva uma notificação com o motivo "não procede" e justificativa
- **THEN** a notificação fica arquivada com o motivo, a justificativa e o autor no histórico

#### Scenario: Conversão de notificação arquivada

- **GIVEN** uma notificação arquivada
- **WHEN** o supervisor tenta convertê-la em advertência
- **THEN** o servidor responde 409 `invalid_state`

#### Scenario: Gestor tenta abrir notificações

- **WHEN** um gestor pede a lista de notificações internas
- **THEN** o servidor responde 403

### Requirement: Advertência registrada e anulada pelo supervisor

O supervisor SHALL registrar advertência convertendo uma notificação ou manualmente, com categoria, gravidade leve, moderada ou grave, descrição, justificativa e data que não seja futura, e no máximo uma advertência vigente por origem. A anulação MUST trazer motivo de 10 a 2.000 caracteres e preservar a advertência como anulada (RF021, UC03).

#### Scenario: Advertência manual

- **WHEN** o supervisor registra uma advertência manual moderada com justificativa
- **THEN** a advertência fica vigente e o residente passa a vê-la nas suas comunicações

#### Scenario: Data futura

- **WHEN** o supervisor registra uma advertência com data de amanhã
- **THEN** o servidor responde 400 e nenhuma advertência é criada

#### Scenario: Anulação

- **WHEN** o supervisor anula uma advertência vigente com motivo
- **THEN** ela continua no histórico, como anulada, com o motivo

### Requirement: Possível reincidência

O sistema SHALL apontar possível reincidência quando o residente tiver duas advertências vigentes da mesma categoria, de origens distintas, registradas nos últimos 90 dias, sem contar as da categoria Outra, as anuladas e as de origem inválida (RN12, UC21).

#### Scenario: Uma só origem

- **GIVEN** uma única advertência vigente de ausência, registrada nesta semana
- **WHEN** o supervisor consulta a reincidência do residente
- **THEN** a categoria ausência não aparece como possível reincidência

#### Scenario: Advertência antiga

- **GIVEN** uma advertência de limpeza registrada há 100 dias e outra registrada ontem
- **WHEN** o supervisor consulta a reincidência
- **THEN** a categoria limpeza não aparece como possível reincidência

### Requirement: Termo de compromisso

O supervisor SHALL emitir termo de compromisso só com confirmação expressa da análise humana, decisão de 10 a 2.000 caracteres e ao menos duas advertências que formem possível reincidência. O termo SHALL gerar um PDF imutável, que declara que a ciência não é assinatura eletrônica (RF022, RN12, UC21).

#### Scenario: Emissão sem confirmação

- **WHEN** o supervisor tenta emitir um termo sem confirmar a análise humana
- **THEN** o servidor responde 400 e nenhum termo é emitido

#### Scenario: Termo emitido

- **WHEN** o supervisor emite um termo com base válida e confirmação
- **THEN** o PDF fica guardado sem alteração e o termo é enviado ao residente

### Requirement: Base do termo

Advertência da base do termo que seja da categoria Outra, anulada, de origem inválida ou registrada há mais de 90 dias MUST receber 409 `recurrence_not_eligible`, e uma base com menos de duas origens distintas da mesma categoria MUST receber 400 `invalid_input`, sem emitir termo (RN12, UC21).

#### Scenario: Base com advertência anulada

- **GIVEN** duas advertências de atraso, uma delas anulada
- **WHEN** o supervisor tenta emitir um termo com elas
- **THEN** o servidor responde 409 `recurrence_not_eligible`

#### Scenario: Base com categorias diferentes

- **GIVEN** uma advertência vigente de ausência e outra de atraso no retorno, as duas registradas nesta semana
- **WHEN** o supervisor tenta emitir um termo com elas
- **THEN** o servidor responde 400 `invalid_input` e nenhum termo é emitido

### Requirement: Residente vê só a própria disciplina

O residente SHALL ler apenas as próprias advertências e termos e baixar o PDF dos próprios termos, e MUST NOT ver ocorrências, notificações, a reincidência ou dados de outro residente (RF009; cap. 4, tabela de permissões).

#### Scenario: PDF do termo de outro residente

- **WHEN** um residente tenta baixar o PDF do termo de outro residente
- **THEN** o servidor responde 404

#### Scenario: Residente tenta ver ocorrências

- **WHEN** um residente pede a lista de ocorrências
- **THEN** o servidor responde 403
