## MODIFIED Requirements

### Requirement: Sessão encerrada tratada em um só lugar

Quando uma chamada à API responder 401 enquanto há um usuário conhecido, o sistema SHALL esquecer o usuário, descartar as listas e o token guardados em memória e levar à página de acesso. Um 401 sem usuário conhecido, como a senha errada no login, MUST NOT redirecionar.

#### Scenario: Sessão expirada durante o uso

- **GIVEN** um gestor com a lista de residentes aberta
- **WHEN** a sessão expira no servidor e ele muda de página na lista
- **THEN** o sistema abre a página de acesso
- **AND** o menu do usuário anterior deixa de aparecer

#### Scenario: Senha errada

- **WHEN** alguém envia usuário e senha incorretos
- **THEN** continua na página de acesso com a mensagem de credenciais inválidas
