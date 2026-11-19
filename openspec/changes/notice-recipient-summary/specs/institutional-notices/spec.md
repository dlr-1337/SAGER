## MODIFIED Requirements

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

#### Scenario: Revisar publicação sem nomes

- **GIVEN** um rascunho salvo com 24 destinatários
- **WHEN** o supervisor clica em "Revisar publicação"
- **THEN** "Quem vai receber" mostra "Lista salva no rascunho · 24 residentes", sem nomes
- **AND** a página do aviso continua listando os 24 nomes em "Quem recebe"

#### Scenario: Correção e retirada sem nomes

- **GIVEN** um aviso publicado para 24 residentes
- **WHEN** o supervisor abre "Publicar correção" ou "Retirar com justificativa"
- **THEN** "Quem vai receber" mostra "Lista salva no rascunho · 24 residentes", sem nomes
