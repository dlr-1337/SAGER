## ADDED Requirements

### Requirement: Situação do arquivo recebido na conversa

Na conversa, cada imagem ou PDF recebido e guardado SHALL mostrar sua situação: livre, com o botão "Vincular a uma saída longa"; ou ligado a uma saída longa, com "Na saída longa de", o nome do residente, "aguardando conferência" ou "conferido" e o link "Abrir saída", sem o botão. Arquivo recusado na saída MUST voltar a aparecer livre, e a tela MUST NOT mostrar identificadores técnicos.

#### Scenario: Dois PDFs ligados sozinhos

- **GIVEN** uma única saída longa aberta para o telefone do responsável
- **WHEN** o responsável manda dois PDFs
- **THEN** a conversa mostra os dois com "Na saída longa de" e o nome do residente, "aguardando conferência" e o link "Abrir saída" para aquele pedido
- **AND** nenhum dos dois mostra "Vincular a uma saída longa"

#### Scenario: Arquivo conferido

- **GIVEN** um arquivo da conversa conferido na saída longa
- **WHEN** o supervisor abre a conversa
- **THEN** o arquivo mostra "conferido" e o link "Abrir saída", sem o botão de vincular

#### Scenario: Arquivo recusado volta a ficar livre

- **GIVEN** um PDF da conversa ligado a uma saída longa
- **WHEN** o supervisor recusa o arquivo na saída, com justificativa
- **THEN** a conversa volta a mostrar "Vincular a uma saída longa" naquele PDF

#### Scenario: Dois pedidos abertos

- **GIVEN** dois pedidos abertos para o mesmo telefone
- **WHEN** chegam dois PDFs sem citar nenhum documento
- **THEN** os dois aparecem livres, cada um com o botão "Vincular a uma saída longa"

#### Scenario: Arquivo que falhou ao baixar

- **WHEN** o download de um arquivo recebido falha
- **THEN** o balão mostra a nota de falha, sem o botão de vincular e sem situação de saída
