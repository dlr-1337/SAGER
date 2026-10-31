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

A tela SHALL atualizar sozinha enquanto houver arquivo em preparo, anunciar o resultado a leitores de tela, e MUST parar de consultar quando nada estiver em preparo ou ao sair da tela.

#### Scenario: Arquivo pronto

- **GIVEN** um relatório em preparo
- **WHEN** o arquivo fica pronto
- **THEN** os botões "Baixar PDF" e "Baixar planilha Excel" aparecem sem nova ação

#### Scenario: Demora

- **WHEN** o preparo passa de 2 minutos
- **THEN** a tela avisa que está demorando e que o relatório continua na lista

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

PDF e Excel MUST trazer título, período, rótulos em português e datas em dd/mm/aaaa, sem identificadores técnicos no corpo, e o nome do arquivo SHALL indicar tipo e período. O hash de integridade permanece no fim do arquivo.

#### Scenario: Situação traduzida

- **WHEN** o PDF de presença traz uma ausência justificada
- **THEN** o arquivo mostra "Ausência justificada"

#### Scenario: Relatório filtrado

- **WHEN** o relatório é gerado com filtros
- **THEN** o PDF e o XLSX trazem uma linha com os filtros em nomes legíveis, sem identificador interno, e o código de conferência não muda

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
