## MODIFIED Requirements

### Requirement: Filtros opcionais recolhidos

Os filtros de alojamento, casa ou bloco, quarto, residente e situação SHALL ficar numa área recolhível de filtros opcionais, aberta em telas com mais de 760 px e recolhida no celular, com os ativos sempre visíveis e removíveis, e a falha ao carregá-los MUST NOT impedir a geração.

#### Scenario: Lista de residentes indisponível

- **WHEN** a lista de residentes falha ao carregar
- **THEN** a geração continua disponível e os filtros mostram o aviso

#### Scenario: Celular

- **GIVEN** uma tela de 390 px de largura
- **WHEN** o gestor abre a tela de relatórios
- **THEN** os filtros opcionais aparecem recolhidos, e o tipo, o período e "Gerar relatório" continuam disponíveis sem abri-los

#### Scenario: Filtro ativo com a área recolhida

- **GIVEN** um residente escolhido e a área de filtros recolhida
- **WHEN** o gestor olha o formulário
- **THEN** ele vê o filtro do residente ativo e pode removê-lo sem abrir a área
