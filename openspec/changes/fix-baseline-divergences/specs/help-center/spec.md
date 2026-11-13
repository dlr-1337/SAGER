## MODIFIED Requirements

### Requirement: Guias do perfil em uso

Com sessão de conta ou na demonstração, a ajuda SHALL mostrar guias só das tarefas que o perfil em uso pode fazer, levando à tela de cada tarefa (RF026; cap. 4, tabela de permissões).

#### Scenario: Gestor na ajuda

- **GIVEN** um gestor com sessão de conta
- **WHEN** ele abre a ajuda
- **THEN** vê o guia de relatórios e não vê os guias da chamada e das saídas

#### Scenario: Residente na demonstração

- **GIVEN** a demonstração com o perfil residente
- **WHEN** o visitante abre a ajuda
- **THEN** vê os guias de saídas, comunicações e limpeza e não vê o de relatórios

#### Scenario: Supervisor na demonstração abre Comunicações

- **GIVEN** a demonstração com o perfil supervisor
- **WHEN** o visitante abre o guia Comunicações na ajuda
- **THEN** chega à tela de avisos do supervisor, e não ao acesso negado

#### Scenario: Nenhum guia leva ao acesso negado

- **GIVEN** a demonstração com qualquer um dos três perfis
- **WHEN** o visitante abre cada guia da ajuda
- **THEN** nenhum deles leva ao acesso negado
