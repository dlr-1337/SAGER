# room-map Specification

## Purpose
Permitir que gestor e supervisor encontrem um quarto indo do geral ao específico (alojamento, casa ou bloco, quarto) e entendam a situação e as vagas de cada quarto sem ajuda.

## Requirements

### Requirement: Alojamentos no primeiro nível

No acesso por conta, ao abrir a tela Quartos, gestor e supervisor SHALL ver um cartão por alojamento, com o nome, o número de quartos e as vagas livres somadas só dos quartos que recebem alocação (fora de Manutenção e Indisponível), e escolher um cartão SHALL abrir o nível seguinte desse alojamento.

#### Scenario: Abrir a tela

- **GIVEN** 12 alojamentos cadastrados
- **WHEN** o gestor abre a tela Quartos sem busca nem filtro
- **THEN** ele vê 12 cartões de alojamento em ordem natural de nome e nenhum quarto ainda

#### Scenario: Alojamento sem quartos

- **GIVEN** um alojamento sem quartos cadastrados
- **WHEN** o supervisor escolhe o cartão dele
- **THEN** a tela informa que o alojamento não tem quartos e a trilha permite voltar

#### Scenario: Vaga de quarto em manutenção não conta

- **GIVEN** um alojamento com um quarto Disponível com 2 vagas livres e um quarto em Manutenção com 3 camas livres
- **WHEN** o gestor abre a tela Quartos
- **THEN** o cartão desse alojamento mostra 2 vagas livres

### Requirement: Casas ou blocos no segundo nível

No acesso por conta, escolher um alojamento que tenha casas ou blocos SHALL mostrar um cartão por casa ou bloco, com o número de quartos e as vagas livres contadas como no cartão do alojamento, e os quartos sem casa ou bloco desse alojamento em grade abaixo dos cartões; escolher um alojamento sem casas ou blocos SHALL mostrar direto a grade dos quartos dele.

#### Scenario: Alojamento com casas

- **GIVEN** a Vila Estudantil com as casas 1 a 10, cada uma com 3 quartos
- **WHEN** o gestor escolhe a Vila Estudantil e depois a Casa 3
- **THEN** ele vê primeiro os cartões das casas, da Casa 1 à Casa 10, e depois só os 3 quartos da Casa 3

#### Scenario: Alojamento sem casas

- **GIVEN** uma residência com 21 quartos e nenhuma casa ou bloco
- **WHEN** o supervisor escolhe essa residência
- **THEN** a grade de quartos aparece direto, sem nível de casa

#### Scenario: Quarto fora de casa

- **GIVEN** um alojamento com casas e um quarto que não pertence a nenhuma casa
- **WHEN** o gestor escolhe esse alojamento
- **THEN** o quarto aparece em grade abaixo dos cartões das casas

### Requirement: Trilha entre os níveis

No acesso por conta, a tela SHALL mostrar a trilha do nível atual, como "Quartos › Vila Estudantil › Casa 3", em que cada nível anterior volta a ele e o nível atual não é clicável.

#### Scenario: Voltar pela trilha

- **GIVEN** a grade da Casa 3 da Vila Estudantil
- **WHEN** o gestor escolhe "Vila Estudantil" na trilha
- **THEN** a tela volta aos cartões das casas da Vila Estudantil

#### Scenario: Primeiro nível

- **WHEN** o supervisor abre a tela Quartos sem alojamento escolhido
- **THEN** a trilha mostra só "Quartos", que não é clicável

### Requirement: Foco ao mudar de nível

Quando o usuário muda de nível pelos cartões ou pela trilha, o foco MUST ir para o título do nível exibido, e o carregamento da tela MUST NOT mover o foco.

#### Scenario: Escolher cartão pelo teclado

- **WHEN** um usuário de teclado escolhe um cartão de alojamento com Enter
- **THEN** o foco vai para o título do nível exibido

#### Scenario: Abrir a tela

- **WHEN** o gestor abre a tela Quartos
- **THEN** o foco fica onde o navegador o deixou ao carregar a página

### Requirement: Nível lembrado

Voltar do detalhe ou do formulário de um quarto para a tela Quartos SHALL restaurar, durante a sessão, o nível, a busca, os filtros e a página que estavam abertos.

#### Scenario: Volta do detalhe

- **GIVEN** o supervisor abriu um quarto a partir da grade da Casa 3, filtrada por Disponível
- **WHEN** ele volta para a tela Quartos
- **THEN** a tela mostra de novo a grade da Casa 3, com a mesma trilha e o filtro Disponível

### Requirement: Busca e filtros em qualquer nível

No acesso por conta, com busca ou filtro ativo, a tela SHALL mostrar em grade os quartos que atendem dentro do nível atual (todos os alojamentos no primeiro nível), agrupados por alojamento, casa ou bloco e piso, e limpar os filtros MUST manter o nível.

#### Scenario: Buscar código no primeiro nível

- **WHEN** o gestor digita o código de um quarto sem ter escolhido alojamento
- **THEN** a grade mostra esse quarto com o nome do alojamento e da casa, sem exigir navegar até ele

#### Scenario: Limpar filtros dentro de uma casa

- **GIVEN** a grade da Casa 3 filtrada por Manutenção
- **WHEN** o supervisor limpa os filtros
- **THEN** a tela mostra todos os quartos da Casa 3 e a trilha continua em "Casa 3"

### Requirement: Filtros do mapa

No acesso por conta, a busca por número, código, alojamento ou casa SHALL ficar sempre visível; Situação e "Só com vagas" SHALL ficar no painel recolhível, com os ativos sempre visíveis e removíveis; "Só com vagas" SHALL mostrar só quartos com vaga livre fora de Manutenção e Indisponível; Piso SHALL aparecer só quando algum quarto tiver piso; e a tela MUST NOT oferecer filtro de ocupação, de alojamento nem de casa ou bloco.

#### Scenario: Celular

- **WHEN** o gestor abre a tela Quartos num celular de 390 px
- **THEN** só a busca aparece aberta e o primeiro cartão de alojamento fica visível sem rolar

#### Scenario: Só com vagas

- **GIVEN** na grade um quarto Disponível com 2 vagas livres, um quarto lotado e um quarto em Manutenção com 3 camas livres
- **WHEN** o supervisor marca "Só com vagas"
- **THEN** só o quarto Disponível aparece e o filtro ativo fica visível e removível mesmo com o painel fechado

#### Scenario: Nenhum quarto com piso

- **GIVEN** nenhum quarto com piso cadastrado
- **WHEN** o gestor abre o painel de filtros
- **THEN** o campo Piso não aparece

### Requirement: Legenda das situações

No acesso por conta, a legenda SHALL explicar as quatro situações: Disponível tem vaga e recebe residentes, e muda sozinha; Ocupado tem todas as vagas preenchidas, e muda sozinha; Manutenção está em reparo e não recebe novos residentes, e é escolhida pelo gestor ou supervisor; Indisponível está fora de uso e não recebe novos residentes, e é escolhida pelo gestor ou supervisor ou vem da falta de capacidade. Nenhum texto do mapa nem do detalhe do quarto MUST dizer que toda situação é escolhida.

#### Scenario: Ler a legenda

- **WHEN** o gestor lê a legenda do mapa
- **THEN** cada situação aparece com o nome, a cor e a explicação do que significa e de quem a define

#### Scenario: Nota do rodapé

- **WHEN** o supervisor lê a nota abaixo da grade
- **THEN** ela diz que Disponível e Ocupado mudam sozinhos com os moradores e que Manutenção e Indisponível são escolhidos no cadastro do quarto

#### Scenario: Nota do detalhe

- **WHEN** o supervisor abre o detalhe de um quarto
- **THEN** a nota diz que Disponível e Ocupado mudam sozinhos e que Manutenção e Indisponível são escolhidos no cadastro, sem dizer que a situação é escolhida por ele

### Requirement: Quarto sem capacidade aparece indisponível

No acesso por conta, um quarto sem capacidade definida e sem Manutenção ou Indisponível escolhidos SHALL aparecer como Indisponível no mapa, no detalhe e no filtro de situação, e SHALL passar a Disponível ou Ocupado sozinho quando a capacidade for definida com a situação automática.

#### Scenario: Quarto cadastrado sem capacidade

- **GIVEN** um quarto cadastrado com a situação automática e sem capacidade
- **WHEN** o gestor abre o mapa e tenta colocar um residente nesse quarto
- **THEN** o quarto aparece como Indisponível e a recusa pede para definir a capacidade do quarto

#### Scenario: Capacidade definida depois

- **GIVEN** o mesmo quarto sem moradores
- **WHEN** o gestor define a capacidade 4 mantendo a situação automática
- **THEN** o quarto passa a aparecer como Disponível

#### Scenario: Manutenção sem capacidade

- **GIVEN** um quarto sem capacidade com Manutenção escolhida
- **WHEN** o supervisor abre o mapa
- **THEN** o quarto aparece como Manutenção

### Requirement: Situação pedida na edição de quarto sem capacidade

No acesso por conta, ao editar um quarto sem capacidade que aparece como Indisponível, o formulário MUST deixar a situação sem escolha e exigir que o usuário escolha uma antes de salvar, sem presumir a automática nem Indisponível.

#### Scenario: Editar quarto sem capacidade

- **GIVEN** um quarto sem capacidade que aparece como Indisponível
- **WHEN** o gestor abre a edição, define a capacidade e tenta salvar sem escolher a situação
- **THEN** o formulário pede a situação e não grava nada até ela ser escolhida

### Requirement: Auditoria da situação escolhida

A auditoria da edição de quarto SHALL marcar a situação como alterada só quando a escolha gravada (automática, Manutenção ou Indisponível) mudar, nunca porque o quarto aparecia como Ocupado ou como Indisponível por falta de capacidade.

#### Scenario: Definir capacidade mantendo a automática

- **GIVEN** um quarto sem capacidade, com a situação automática gravada
- **WHEN** o gestor define a capacidade e mantém a situação automática
- **THEN** a auditoria da edição registra só a capacidade como alterada

#### Scenario: Escolher Manutenção

- **GIVEN** um quarto com a situação automática que aparece como Ocupado
- **WHEN** o supervisor escolhe Manutenção
- **THEN** a auditoria da edição registra a situação como alterada

### Requirement: Paginação logo depois da grade

A grade SHALL mostrar até 25 quartos por página, com a paginação logo depois da grade e antes da nota do rodapé, e uma página que deixar de existir depois de uma edição MUST voltar à última página com quartos.

#### Scenario: Alojamento com 30 quartos

- **WHEN** o gestor abre um alojamento sem casas com 30 quartos
- **THEN** a grade mostra os 25 primeiros em ordem natural e "Próxima" aparece logo abaixo do último quarto

#### Scenario: Página que deixou de existir

- **GIVEN** a página 2 de uma busca com 26 quartos
- **WHEN** a edição de um quarto reduz o resultado para 25 e o gestor volta ao mapa
- **THEN** a tela mostra a página 1 com os 25 quartos, sem estado de vazio

### Requirement: Sem nota de limpeza inventada

O mapa e o detalhe do quarto, também na demonstração, MUST NOT mostrar linha de nota de limpeza, porque o cadastro do quarto não traz a nota das avaliações.

#### Scenario: Abrir um quarto

- **WHEN** o supervisor vê o cartão de um quarto no mapa e abre o detalhe dele
- **THEN** nenhum dos dois mostra "Sem avaliação" nem "Última nota de limpeza"

#### Scenario: Quarto da demonstração

- **GIVEN** o modo demonstração com o perfil supervisor
- **WHEN** ele vê o quarto 102 na grade e abre o detalhe dele
- **THEN** nenhum dos dois mostra "Limpeza:", nota nem "Última nota de limpeza"

### Requirement: Quartos na demonstração

No modo demonstração, a tela Quartos SHALL abrir direto na grade agrupada por bloco e piso, sem níveis nem trilha e sem chamar a API, com a busca sempre visível e Bloco, Piso e Situação no painel recolhível; MUST NOT mostrar capacidade, totais nem "Só com vagas"; e a legenda SHALL mostrar só o nome e a cor das quatro situações.

#### Scenario: Abrir a tela na demonstração

- **GIVEN** o modo demonstração com o perfil gestor
- **WHEN** ele abre a tela Quartos
- **THEN** vê a grade dos quartos dos blocos A e B, sem cartão de alojamento nem trilha, e a legenda com os quatro nomes, sem explicações

#### Scenario: Filtrar por bloco na demonstração

- **GIVEN** o modo demonstração com o perfil supervisor
- **WHEN** ele escolhe o bloco A no painel de filtros
- **THEN** só os quartos do bloco A aparecem e o filtro ativo fica visível e removível
