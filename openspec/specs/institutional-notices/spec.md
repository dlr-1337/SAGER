# institutional-notices Specification

## Purpose
Publicar avisos institucionais para residentes selecionados e registrar, por versão do conteúdo, a leitura e a ciência do residente nos avisos, advertências e termos que recebe.

## Requirements

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

### Requirement: Destinatários por critério

Ao preparar um aviso, o supervisor SHALL escolher quem recebe: todos com quarto ativo, um alojamento, um quarto, só os de 18 anos ou mais, só os menores de 18 ou pessoas uma a uma. A idade MUST seguir a data civil de America/Sao_Paulo, sem quem não tem data de nascimento. A tela SHALL mostrar quantos vão receber e deixar desmarcar alguém, e a lista salva no rascunho MUST NOT mudar depois. Os diálogos do aviso SHALL mostrar só o grupo e a quantidade; os nomes ficam na página do aviso salvo.

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

#### Scenario: Confirmação do rascunho com o grupo

- **GIVEN** os residentes A e B com quarto no Alojamento Norte
- **WHEN** o supervisor escolhe "Um alojamento" e o Alojamento Norte e clica em "Salvar rascunho"
- **THEN** "Quem vai receber" mostra "Alojamento Norte · 2 residentes"
- **AND** o diálogo não mostra o nome nem a matrícula de A ou de B

#### Scenario: Revisar publicação com o grupo

- **GIVEN** um rascunho salvo com "Todos os moradores" para 24 residentes
- **WHEN** o supervisor clica em "Revisar publicação"
- **THEN** "Quem vai receber" mostra "Todos os moradores · 24 residentes", sem nomes
- **AND** a página do aviso continua listando os 24 nomes em "Quem recebe"

#### Scenario: Correção e retirada com o grupo

- **GIVEN** um aviso publicado com o grupo "Alojamento Norte" para 12 residentes
- **WHEN** o supervisor abre "Publicar correção" ou "Retirar com justificativa"
- **THEN** "Quem vai receber" mostra "Alojamento Norte · 12 residentes", sem nomes

### Requirement: Grupo gravado no rascunho

Ao salvar o rascunho, o servidor SHALL montar e gravar o nome do grupo a partir da opção escolhida e do alojamento ou quarto cadastrado, e MUST NOT aceitar o texto do grupo enviado pela tela. O grupo SHALL ficar fixo como a lista. Aviso sem opção informada, inclusive os salvos antes desta regra, SHALL mostrar "Lista salva no rascunho" no lugar do grupo.

#### Scenario: Quarto com unidade

- **GIVEN** o quarto Q-02, da Casa 1 do Alojamento Norte
- **WHEN** o supervisor salva um rascunho com "Um quarto" e esse quarto
- **THEN** o aviso guarda o grupo "Quarto Q-02, Casa 1, Alojamento Norte"

#### Scenario: Texto do grupo enviado pela tela

- **WHEN** o supervisor tenta salvar um rascunho com a opção "Todos os moradores" e um texto de grupo próprio
- **THEN** o servidor responde 400 e nenhum aviso é criado

#### Scenario: Alojamento inexistente

- **WHEN** o supervisor tenta salvar um rascunho com "Um alojamento" e um alojamento que não existe
- **THEN** o servidor responde 400 e nenhum aviso é criado

#### Scenario: Grupo fixo depois do rascunho

- **GIVEN** um rascunho salvo com o grupo "Alojamento Norte"
- **WHEN** o alojamento passa a se chamar "Bloco Norte"
- **THEN** o aviso continua com o grupo "Alojamento Norte"

#### Scenario: Aviso salvo antes do grupo

- **GIVEN** um rascunho com 24 destinatários salvo sem grupo
- **WHEN** o supervisor clica em "Revisar publicação"
- **THEN** "Quem vai receber" mostra "Lista salva no rascunho · 24 residentes"
