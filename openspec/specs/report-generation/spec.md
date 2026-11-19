# report-generation Specification

## Purpose
Permitir que gestor e supervisor sem prática gerem e baixem um relatório em uma única tela, sem passos técnicos, mantendo as regras de acesso e de integridade.

## Requirements

### Requirement: Gerar em um clique

A tela SHALL oferecer os tipos de relatório em cartões com descrição simples, período pré-preenchido pela data do servidor, e um único botão "Gerar relatório", sem diálogo de confirmação.

#### Scenario: Geração simples

- **GIVEN** a tela aberta com o tipo Presença e o período deste mês
- **WHEN** o usuário clica em "Gerar relatório"
- **THEN** o relatório aparece na lista com o andamento visível

#### Scenario: Clique duplo

- **WHEN** o usuário clica duas vezes em "Gerar relatório"
- **THEN** só um relatório é criado

### Requirement: Andamento automático

A tela SHALL atualizar a lista sozinha a cada poucos segundos enquanto houver arquivo em preparo e a cada 15 segundos quando não houver, e anunciar o resultado a leitores de tela. Ela MUST parar de consultar ao sair da tela e seguir a pausa com a aba oculta e depois de 30 minutos sem interação, como as demais telas que se atualizam sozinhas.

#### Scenario: Arquivo pronto

- **GIVEN** um relatório em preparo
- **WHEN** o arquivo fica pronto
- **THEN** os botões "Baixar PDF" e "Baixar planilha Excel" aparecem sem nova ação

#### Scenario: Demora

- **WHEN** o preparo passa de 2 minutos
- **THEN** a tela avisa que está demorando e que o relatório continua na lista

#### Scenario: Nada em preparo

- **GIVEN** nenhum relatório em preparo e a aba visível
- **WHEN** passam 15 segundos
- **THEN** a lista de relatórios gerados é consultada de novo

### Requirement: Lista de relatórios gerados

A tela SHALL listar os relatórios do próprio usuário ainda válidos, sem incluir as linhas na resposta da lista, e MUST NOT mostrar relatórios de outro usuário.

#### Scenario: Recarregar a página

- **GIVEN** um relatório gerado há pouco
- **WHEN** o usuário recarrega a página
- **THEN** o relatório continua na lista com os botões de baixar

#### Scenario: Outro usuário

- **WHEN** outro usuário abre a tela
- **THEN** o relatório não aparece para ele

### Requirement: Situações sem saída técnica

A tela SHALL orientar o usuário em toda situação: sem registros, sugere mudar o período sem criar arquivo; falha, oferece "Tentar de novo"; acima do limite, pede período menor.

#### Scenario: Sem registros

- **WHEN** o período não tem registros
- **THEN** a tela informa e nenhum arquivo é preparado

#### Scenario: Falha

- **GIVEN** um arquivo com falha
- **WHEN** o usuário clica em "Tentar de novo"
- **THEN** um novo preparo começa

### Requirement: Filtros opcionais recolhidos

Os filtros de alojamento, casa ou bloco, quarto, residente e situação SHALL ficar recolhidos como opcionais, com os ativos visíveis e removíveis, e a falha ao carregá-los MUST NOT impedir a geração.

#### Scenario: Lista de residentes indisponível

- **WHEN** a lista de residentes falha ao carregar
- **THEN** a geração continua disponível e os filtros mostram o aviso

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

### Requirement: Mesmas regras de acesso

Somente gestor e supervisor SHALL gerar relatórios, com validade de 24 horas, auditoria, e os limites vigentes de período e de linhas.

#### Scenario: Residente

- **WHEN** um residente abre a tela
- **THEN** o acesso é negado

### Requirement: Demonstração com o mesmo fluxo

A demonstração SHALL usar o mesmo fluxo com dados sintéticos e MUST NOT baixar arquivo real, e o modo real MUST NOT usar dados de demonstração após erro.

#### Scenario: Baixar na demonstração

- **WHEN** o usuário da demonstração clica em baixar
- **THEN** a tela informa que nenhum arquivo é baixado na demonstração

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
