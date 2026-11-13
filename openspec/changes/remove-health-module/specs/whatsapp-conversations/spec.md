## MODIFIED Requirements

### Requirement: Acesso restrito a supervisores

Somente supervisores SHALL acessar a aba e as rotas de conversas, inclusive arquivos, e MUST NOT existir acesso herdado por gestor ou residente.

#### Scenario: Gestor tenta acessar

- **WHEN** um gestor pede a lista de conversas
- **THEN** o sistema recusa com 403

#### Scenario: Arquivo sem sessão

- **WHEN** alguém sem sessão abre o endereço de um arquivo
- **THEN** o sistema recusa o acesso

### Requirement: Aviso sobre dados sensíveis

A aba SHALL exibir aviso permanente orientando a não tratar dados de saúde pelo canal.

#### Scenario: Aba aberta

- **WHEN** o supervisor abre as conversas
- **THEN** o aviso aparece e direciona assuntos de saúde ao canal próprio
