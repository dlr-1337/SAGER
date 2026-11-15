## ADDED Requirements

### Requirement: Duração do ensino médio

Ao escolher ensino médio no cadastro de curso, pela tela de cursos ou pelo "Novo curso" do cadastro de residente, inclusive na demonstração, a tela SHALL preencher a duração com 3 anos e esconder o campo. Ao trocar para superior, o campo SHALL aparecer vazio para o usuário informar de 1 a 6 anos. O curso de ensino médio já salvo com outra duração SHALL abrir a edição com o campo à vista e a duração salva.

#### Scenario: Curso novo de ensino médio

- **WHEN** o usuário cadastra um curso e escolhe "Ensino médio"
- **THEN** o campo de duração não aparece
- **AND** o curso é salvo com duração de 3 anos

#### Scenario: Troca para superior

- **GIVEN** um curso novo com "Ensino médio" escolhido
- **WHEN** o usuário troca o nível para "Superior"
- **THEN** o campo de duração aparece vazio e pede a duração

#### Scenario: Curso médio antigo com 4 anos

- **GIVEN** um curso de ensino médio salvo com duração de 4 anos
- **WHEN** o usuário abre a edição dele
- **THEN** o campo de duração aparece com 4 anos
