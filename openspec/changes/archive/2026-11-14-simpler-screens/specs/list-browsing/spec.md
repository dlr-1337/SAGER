## MODIFIED Requirements

### Requirement: Busca à vista e filtros extras recolhíveis

No acesso por conta, cada lista com filtros SHALL ter um único painel de filtro, com a busca principal sempre visível e os demais filtros numa área recolhível "Mais filtros", que MUST começar fechada toda vez que a tela abre, em qualquer largura, e só abrir com o clique do usuário. Uma tela sem filtros além da busca mantém só a busca, sem área recolhível.

#### Scenario: Celular

- **GIVEN** uma tela de 390 px de largura
- **WHEN** o supervisor abre as avaliações de limpeza
- **THEN** as datas aparecem, alojamento, casa ou bloco, quarto e residente ficam recolhidos em "Mais filtros", e a primeira avaliação aparece sem rolar a página

#### Scenario: Computador

- **GIVEN** uma tela de 1280 px de largura
- **WHEN** o gestor abre a lista de residentes
- **THEN** a busca aparece e "Mais filtros" está fechado; depois do clique, aparecem curso, alojamento, casa ou bloco, quarto e "Tem quarto?"

#### Scenario: Um único painel nas notificações

- **WHEN** o supervisor abre as notificações
- **THEN** há um só painel de filtro, com a busca visível e residente, situação, datas e categoria em "Mais filtros", fechado

#### Scenario: Voltar do detalhe

- **GIVEN** o supervisor abriu "Mais filtros" nas saídas e escolheu a situação "Aprovada"
- **WHEN** ele abre um pedido e volta à lista
- **THEN** "Mais filtros" aparece fechado, e o filtro "Situação: Aprovada" continua à vista e aplicado

## REMOVED Requirements

### Requirement: Estado do painel lembrado por tela

**Reason**: Pedido do dono de 14/11/2026: as telas devem começar simples para servidores com pouca prática e para quem tem TDAH. Um painel que reabre sozinho porque foi aberto antes mostra uma parede de campos sem que a pessoa tenha pedido, e o comportamento muda de tela para tela.

**Migration**: "Mais filtros" começa sempre fechado, conforme "Busca à vista e filtros extras recolhíveis". Os valores dos filtros continuam lembrados e aparecem fora da área recolhida ("Filtros ativos sempre visíveis e removíveis"); só o estado aberto ou fechado do painel deixa de ser lembrado. Nenhum dado é perdido.
