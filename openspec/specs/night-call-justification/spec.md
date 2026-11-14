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
