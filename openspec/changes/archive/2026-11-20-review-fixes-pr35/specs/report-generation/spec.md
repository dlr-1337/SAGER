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

#### Scenario: Limpeza sem avaliação

- **GIVEN** um relatório de limpeza sem nenhuma avaliação no período
- **WHEN** o usuário baixa o PDF ou a planilha
- **THEN** o resumo mostra "Nota média de limpeza: Sem avaliação", como a tela
