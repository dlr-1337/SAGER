# list-browsing Specification

## Purpose
Permitir que gestor, supervisor e residente filtrem e percorram listas longas no computador e no celular, com a busca à vista, os filtros ativos sempre visíveis e páginas de tamanho fixo, sem que o filtro ocupe a primeira tela. As telas próprias do modo demonstração (RF027) ficam como estão.

## Requirements

### Requirement: Busca à vista e filtros extras recolhíveis

No acesso por conta, cada lista com filtros SHALL ter um único painel de filtro, com a busca principal sempre visível e os demais filtros numa área recolhível "Mais filtros", aberta em telas com mais de 760 px e fechada no celular. Uma tela sem filtros além da busca mantém só a busca, sem área recolhível.

#### Scenario: Celular

- **GIVEN** uma tela de 390 px de largura
- **WHEN** o supervisor abre as avaliações de limpeza
- **THEN** as datas aparecem, alojamento, casa ou bloco, quarto e residente ficam recolhidos em "Mais filtros", e a primeira avaliação aparece sem rolar a página

#### Scenario: Computador

- **GIVEN** uma tela de 1280 px de largura
- **WHEN** o gestor abre a lista de residentes pela primeira vez na sessão
- **THEN** a área "Mais filtros" aparece aberta, com curso, alojamento, casa ou bloco, quarto e "Tem quarto?"

#### Scenario: Um único painel nas notificações

- **WHEN** o supervisor abre as notificações
- **THEN** há um só painel de filtro, com a busca visível e residente, situação, datas e categoria em "Mais filtros"

### Requirement: Estado do painel lembrado por tela

O painel SHALL lembrar, para cada tela, se o usuário deixou "Mais filtros" aberto ou fechado durante a sessão, sem afetar o painel das outras telas.

#### Scenario: Voltar do detalhe

- **GIVEN** o supervisor fechou "Mais filtros" nas saídas, numa tela de computador
- **WHEN** ele abre um pedido e volta à lista
- **THEN** "Mais filtros" continua fechado

#### Scenario: Outra tela

- **GIVEN** "Mais filtros" fechado nas saídas, numa tela de computador
- **WHEN** o supervisor abre as notificações pela primeira vez na sessão
- **THEN** "Mais filtros" das notificações aparece aberto

### Requirement: Filtros ativos sempre visíveis e removíveis

No acesso por conta, cada filtro ativo SHALL aparecer fora da área recolhível, com o nome do filtro e o valor legível, nunca um identificador interno, e MUST poder ser removido sozinho; "Limpar filtros" SHALL remover todos de uma vez.

#### Scenario: Área fechada com filtro ativo

- **GIVEN** o filtro Quarto escolhido e "Mais filtros" fechado
- **WHEN** o usuário olha o painel
- **THEN** ele vê "Quarto: 101-A" e um botão para remover esse filtro

#### Scenario: Remover um filtro

- **GIVEN** os filtros Situação e Alojamento ativos
- **WHEN** o usuário remove Situação
- **THEN** a lista é refeita só com o filtro de alojamento, a partir da primeira página

### Requirement: Filtro aplicado sozinho

Nas listas paginadas com painel de filtro, mudar a busca ou um filtro SHALL atualizar a lista sozinho, depois de uma breve pausa na digitação e a partir da primeira página, sem botão de busca.

#### Scenario: Avaliações de limpeza

- **WHEN** o supervisor escolhe um alojamento nas avaliações de limpeza
- **THEN** a lista mostra só as avaliações desse alojamento, e a tela não tem o botão "Buscar avaliações"

#### Scenario: Saídas

- **WHEN** o supervisor escolhe a situação "Aprovada" nas saídas
- **THEN** a lista mostra só as saídas aprovadas, e a tela não tem o botão "Buscar"

### Requirement: Painel estável durante o carregamento

O painel de filtro MUST continuar na tela, com o foco e o valor digitado, enquanto a lista carrega ou mostra erro; só a área da lista troca de estado.

#### Scenario: Digitar enquanto carrega

- **GIVEN** o foco no campo de busca das notificações
- **WHEN** a lista recarrega por causa do texto digitado
- **THEN** o campo continua focado, com o texto, e a digitação segue sem interrupção

### Requirement: Páginas de 25 que substituem a lista

Listas longas, exceto a da chamada noturna, SHALL mostrar 25 itens por página, com Anterior e Próxima, e trocar de página MUST substituir os itens mostrados em vez de acrescentá-los ao fim. Só a lista de conversas, que se atualiza sozinha, mantém "Carregar mais".

#### Scenario: Próxima página de avisos

- **GIVEN** mais de 25 avisos
- **WHEN** o supervisor clica em Próxima
- **THEN** a tela mostra só os avisos da página 2, e a página não fica mais longa

### Requirement: Indicação da página

Quando o total é conhecido, a paginação SHALL mostrar "início–fim de total". Quando não é, SHALL mostrar "Página N" e oferecer Próxima só se houver mais registros.

#### Scenario: Lista com total

- **GIVEN** 60 residentes encontrados
- **WHEN** o gestor vai para a página 2
- **THEN** a paginação mostra "26–50 de 60"

#### Scenario: Lista sem total

- **GIVEN** a segunda página das advertências é a última
- **WHEN** o supervisor vai para a página 2
- **THEN** a paginação mostra "Página 2", Anterior habilitado e Próxima desabilitado

### Requirement: Voltar à página anterior

Nas listas sem total, Anterior SHALL mostrar exatamente os registros já vistos na página anterior com o mesmo filtro, e voltar a avançar MUST NOT pular nem repetir registros.

#### Scenario: Ida e volta

- **GIVEN** o supervisor está na página 2 das notificações
- **WHEN** ele clica em Anterior
- **THEN** a tela mostra as mesmas 25 notificações da página 1

### Requirement: Paginação oculta com uma página

A paginação MUST NOT aparecer quando todos os registros cabem numa página.

#### Scenario: Poucos supervisores

- **GIVEN** 3 supervisores cadastrados
- **WHEN** o gestor abre a lista de supervisores
- **THEN** a tela mostra os 3 sem Anterior, Próxima nem contagem de páginas

### Requirement: Foco no título da lista

Trocar de página SHALL levar o foco e a rolagem ao título da lista, para que o usuário comece a nova página pelo primeiro item.

#### Scenario: Próxima no celular

- **GIVEN** o gestor rolou até o fim da lista de responsáveis num celular
- **WHEN** ele clica em Próxima
- **THEN** o foco vai ao título "Responsáveis cadastrados" e o primeiro item da página 2 fica à vista

### Requirement: Resposta antiga descartada

Uma página ou um filtro pedido antes MUST NOT substituir a lista do filtro e da página atuais, mesmo que a resposta chegue depois.

#### Scenario: Resposta atrasada

- **GIVEN** o supervisor pediu a página 2 dos avisos e, antes da resposta, digitou uma busca
- **WHEN** a resposta da página 2 chega depois da resposta da busca
- **THEN** a tela continua mostrando o resultado da busca, sem mensagem de erro

### Requirement: Ranking paginado com o próprio quarto no topo

No acesso por conta, o ranking SHALL mostrar 25 quartos por página e, para o residente, repetir acima da lista as linhas dos quartos em que ele participou no período, em qualquer página.

#### Scenario: Residente na página 1

- **GIVEN** o quarto do residente está na 60ª posição de 93
- **WHEN** o residente abre o ranking
- **THEN** a linha do quarto dele aparece no topo, com a nota, e a lista abaixo mostra as posições de 1 a 25

#### Scenario: Gestor

- **WHEN** o gestor abre o ranking
- **THEN** não há linha fixa no topo, e a paginação mostra "1–25 de 93"

### Requirement: Chamada noturna inteira

A lista da chamada noturna MUST NOT ser paginada; no acesso por conta, só os filtros além da busca ficam recolhíveis, e o resumo e o fechamento continuam considerando todos os registros da chamada.

#### Scenario: Chamada com 51 residentes

- **WHEN** o supervisor abre uma chamada com 51 residentes, sem filtro
- **THEN** os 51 aparecem na mesma tela, sem paginação

### Requirement: Opções de filtro buscadas uma vez

Ao abrir a tela, as opções de filtro e a primeira página SHALL ser buscadas uma única vez cada, e mudar filtro ou página MUST NOT buscar as opções de novo.

#### Scenario: Mudar o filtro duas vezes

- **GIVEN** as notificações abertas
- **WHEN** o supervisor muda a categoria e depois a situação
- **THEN** a lista de residentes foi pedida ao servidor uma única vez desde a abertura

#### Scenario: Filtro lembrado

- **GIVEN** um filtro de categoria lembrado nas advertências
- **WHEN** o supervisor volta à tela
- **THEN** a primeira página com esse filtro é pedida uma única vez
