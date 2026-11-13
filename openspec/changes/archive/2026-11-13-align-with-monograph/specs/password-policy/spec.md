# Spec Delta

## ADDED Requirements

### Requirement: Ajuda indica a recuperação de senha de cada perfil

No acesso por conta, a pergunta frequente sobre senha SHALL orientar o residente a usar "Esqueci minha senha", com link para a recuperação, informando matrícula, nome completo, data de nascimento e, se houver, o nome do responsável. A mesma pergunta SHALL orientar gestor e supervisor a procurar o suporte da instituição (RF020, UC02). A pergunta da demonstração não muda.

#### Scenario: Residente consulta a ajuda

- **WHEN** um visitante sem sessão abre a ajuda e a pergunta sobre senha
- **THEN** a resposta orienta o residente a clicar em "Esqueci minha senha" e oferece o link para a recuperação
- **AND** não manda o residente ao suporte

#### Scenario: Gestor ou supervisor consulta a ajuda

- **WHEN** um gestor lê a mesma pergunta
- **THEN** a resposta diz que gestor e supervisor procuram o suporte da instituição, que confere a identidade e troca a senha

#### Scenario: Ajuda na demonstração

- **GIVEN** a demonstração ativa
- **WHEN** o usuário abre a ajuda
- **THEN** as perguntas frequentes da demonstração continuam as mesmas de hoje
