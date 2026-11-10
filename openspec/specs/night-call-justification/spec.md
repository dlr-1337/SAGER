# night-call-justification Specification

## Purpose
Fazer a chamada noturna bater com as saídas: quem está fora com saída válida já entra justificado, sem clique do supervisor.

## Requirements

### Requirement: Justificativa automática na abertura

Ao abrir a chamada, o sistema SHALL marcar como ausência justificada o residente com exatamente uma saída aprovada, com partida física registrada e sem retorno até o instante da abertura, vinculando a saída.

#### Scenario: Residente fora com saída válida

- **GIVEN** um residente com saída aprovada e partida física antes da abertura
- **WHEN** o supervisor abre a chamada
- **THEN** ele aparece como ausência justificada, com a saída indicada

#### Scenario: Aprovada sem partida registrada

- **GIVEN** uma saída aprovada sem partida física registrada
- **WHEN** o supervisor abre a chamada
- **THEN** o residente fica pendente de marcação

#### Scenario: Retorno antes da abertura

- **GIVEN** um residente cujo retorno foi registrado antes da abertura
- **WHEN** o supervisor abre a chamada
- **THEN** o residente fica pendente de marcação

#### Scenario: Mais de uma saída válida

- **GIVEN** um residente com duas saídas válidas na abertura
- **WHEN** o supervisor abre a chamada
- **THEN** o residente fica pendente e o supervisor escolhe a saída

### Requirement: Autoria e histórico

A marcação automática MUST aparecer no histórico como feita pelo sistema, na abertura feita por aquele supervisor, e MUST gerar auditoria.

#### Scenario: Histórico da marcação

- **WHEN** o supervisor abre o histórico de uma marcação automática
- **THEN** a tela mostra "Sistema" como autor

### Requirement: Correção pelo supervisor

O supervisor SHALL poder corrigir uma marcação automática, e a correção MUST seguir as regras existentes de chamada aberta e fechada.

#### Scenario: Residente presente

- **GIVEN** uma marcação automática em chamada aberta
- **WHEN** o supervisor marca presente
- **THEN** a marcação muda e o histórico guarda as duas

#### Scenario: Correção para ausente após fechar

- **GIVEN** uma marcação automática em chamada fechada
- **WHEN** o supervisor corrige para ausente com justificativa
- **THEN** a análise disciplinar é gerada como em qualquer ausência

### Requirement: Fechamento e resumo

A marcação automática MUST contar no resumo como justificada, MUST NOT gerar ocorrência disciplinar, e MUST permitir fechar a chamada quando todos estiverem marcados.

#### Scenario: Todos fora

- **GIVEN** uma chamada em que todos nasceram justificados
- **WHEN** o supervisor fecha a chamada
- **THEN** a chamada fecha sem ocorrência

#### Scenario: Retorno lançado depois da abertura

- **GIVEN** uma marcação justificada automaticamente
- **WHEN** um retorno lançado depois mostra que o residente já tinha voltado antes da abertura
- **THEN** o fechamento é recusado com `authorized_exit_outdated` e a mensagem diz qual marcação corrigir

### Requirement: Aviso de conferência

A tela SHALL avisar que residentes com saída em andamento já entram justificados, pedindo conferência, e MUST NOT mostrar identificadores técnicos da saída.

#### Scenario: Chamada aberta

- **WHEN** o supervisor abre uma chamada com marcações automáticas
- **THEN** a tela mostra o aviso e a saída como "saída curta" ou "saída longa", com link
