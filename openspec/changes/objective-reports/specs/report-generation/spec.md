## ADDED Requirements

### Requirement: Só o assunto do relatório

Cada relatório SHALL mostrar, na tela, no PDF e no Excel, só as colunas e as métricas do resumo do seu assunto, e MUST NOT trazer coluna ou métrica de outro assunto, como "Nota" nas saídas. O "Mês a mês" SHALL contar os registros e a métrica do relatório. O "Consolidado administrativo" SHALL trazer todas. Um relatório gerado antes desta regra mantém o que guardou e o código de conferência até expirar.

#### Scenario: Saídas sem nota de limpeza

- **GIVEN** um relatório de saídas curtas e longas
- **WHEN** o usuário vê o resumo do período, o PDF ou a planilha
- **THEN** não aparecem "Nota média de limpeza", "Nota", "Categoria" nem "Advertências ativas"
- **AND** aparecem "Voltaram atrasados" e a coluna "Tipo de saída"

#### Scenario: Presença

- **WHEN** o usuário gera o relatório de presença
- **THEN** as colunas são Data, Residente, Quarto e Situação
- **AND** o resumo traz o total, as faltas sem justificativa e a contagem por situação

#### Scenario: Consolidado

- **WHEN** o usuário gera o consolidado administrativo
- **THEN** ele traz todas as colunas, a contagem por tipo, a nota média de limpeza, as faltas, os atrasos e as advertências ativas

#### Scenario: Relatório gerado antes

- **GIVEN** um relatório gerado antes desta regra e ainda válido
- **WHEN** o usuário baixa o PDF
- **THEN** o arquivo sai com as colunas guardadas no relatório e com o mesmo código de conferência

#### Scenario: Demonstração

- **GIVEN** o modo demonstração
- **WHEN** o usuário gera o relatório de saídas
- **THEN** o resumo e as colunas são os mesmos do modo real, sem "Nota média de limpeza"

### Requirement: Mais recentes primeiro

Os registros de todo relatório SHALL vir da data mais recente para a mais antiga, na tela, no PDF e no Excel. No mesmo dia, SHALL seguir o nome do residente em ordem alfabética.

#### Scenario: Ordem na tela e nos arquivos

- **GIVEN** registros em 02/09, 15/09 e 30/09
- **WHEN** o usuário gera o relatório de setembro
- **THEN** a tela, o PDF e a planilha mostram primeiro 30/09, depois 15/09 e por fim 02/09

#### Scenario: Ordem na demonstração

- **GIVEN** o modo demonstração
- **WHEN** o usuário gera o consolidado de setembro
- **THEN** a tela mostra primeiro o registro mais recente

## MODIFIED Requirements

### Requirement: Arquivo legível

PDF e Excel MUST trazer título, período, filtros legíveis, rótulos em português e datas em dd/mm/aaaa, sem identificadores técnicos no corpo, e o nome do arquivo SHALL indicar tipo e período. Os registros SHALL vir numa tabela com cabeçalho de colunas e uma linha por registro; no Excel, o cabeçalho SHALL ter filtro, e datas e notas são datas e números. O código de conferência permanece no fim do arquivo.

#### Scenario: Situação traduzida

- **WHEN** o PDF de presença traz uma ausência justificada
- **THEN** o arquivo mostra "Ausência justificada"

#### Scenario: Relatório filtrado

- **WHEN** o relatório é gerado com filtros
- **THEN** o PDF e o XLSX trazem uma linha com os filtros em nomes legíveis, sem identificador interno, e o código de conferência não muda

#### Scenario: Tabela no PDF

- **WHEN** o usuário baixa o PDF de um relatório com várias páginas
- **THEN** cada página traz o cabeçalho das colunas e uma linha por registro
- **AND** o código de conferência fica depois do último registro

#### Scenario: Planilha

- **WHEN** o usuário abre a planilha
- **THEN** a aba "Resultados" traz o título, o período, os filtros, o cabeçalho com filtro e uma linha por registro
- **AND** a aba "Resumo" traz as métricas do relatório e, por último, o código de conferência
