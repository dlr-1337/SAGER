# Spec Delta

## Purpose

Publicar avisos institucionais para residentes selecionados e registrar, por versão do conteúdo, a leitura e a ciência do residente nos avisos, advertências e termos que recebe.

## ADDED Requirements

### Requirement: Ciclo do aviso institucional

Somente o supervisor SHALL redigir, publicar, revisar e retirar avisos. O rascunho MUST ter título de 3 a 200 caracteres, texto de 3 a 4.000 e ao menos um residente destinatário, e a retirada MUST trazer motivo de 10 a 2.000 caracteres, valendo só para aviso publicado (RF023, UC22).

#### Scenario: Aviso sem destinatário

- **WHEN** o supervisor tenta criar um aviso sem nenhum residente
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

### Requirement: Nova versão substitui a anterior

Revisar um aviso publicado SHALL publicar uma nova versão do conteúdo para os mesmos destinatários e marcar a versão anterior como superada, que continua visível com a leitura e a ciência já registradas (RF023, RN13, UC22).

#### Scenario: Aviso revisado

- **GIVEN** um aviso publicado com ciência do residente A
- **WHEN** o supervisor publica uma versão corrigida
- **THEN** o residente A vê a versão nova sem ciência e a anterior como superada, com a ciência dele

### Requirement: Leitura diferente de ciência

Leitura e ciência SHALL ser registradas por ações separadas do residente, cada uma com data e hora. Abrir a comunicação ou marcá-la como lida MUST NOT registrar ciência, e a ciência MUST exigir confirmação expressa (RF009, RN13, UC08).

#### Scenario: Residente marca como lido

- **WHEN** o residente abre um aviso publicado, marca como lido e sai sem confirmar a ciência
- **THEN** o aviso fica lido e sem ciência

#### Scenario: Ciência confirmada

- **WHEN** o residente confirma a ciência de um aviso publicado
- **THEN** o aviso fica com a data e a hora da ciência dele

### Requirement: Ciência por versão vigente

A ciência SHALL valer para a versão confirmada do conteúdo, e a ciência nova só SHALL ser aceita na versão vigente. Ciência numa versão superada, retirada ou anulada que ainda não a tinha MUST receber 409 `content_not_current`. Repetir a ciência de uma versão que já a tem MUST devolver a data original, sem novo registro, mesmo que essa versão tenha sido superada, retirada ou anulada depois (RN13, RF009, UC08).

#### Scenario: Ciência em versão superada

- **GIVEN** um aviso cuja primeira versão foi superada antes da ciência do residente
- **WHEN** o residente tenta dar ciência na primeira versão
- **THEN** o servidor responde 409 `content_not_current`

#### Scenario: Ciência repetida

- **GIVEN** uma advertência com ciência registrada ontem e anulada hoje
- **WHEN** o residente confirma a ciência dela de novo
- **THEN** o servidor não responde 409 e a ciência continua com a data de ontem

### Requirement: Comunicações só do destinatário

O residente SHALL ver apenas as comunicações de que é destinatário, e a comunicação de outro residente MUST receber 404 (RF009, UC08; cap. 4, tabela de permissões).

#### Scenario: Aviso de outro residente

- **GIVEN** um aviso enviado só ao residente A
- **WHEN** o residente B tenta abri-lo
- **THEN** o servidor responde 404
