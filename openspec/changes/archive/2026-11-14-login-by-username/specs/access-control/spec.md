## RENAMED Requirements

- FROM: `### Requirement: Login por matrícula e senha`
- TO: `### Requirement: Login por usuário e senha`

## MODIFIED Requirements

### Requirement: Login por usuário e senha

O login SHALL usar o usuário e a senha da conta do SAGER e, quando aceito, MUST trocar o identificador da sessão e levar a pessoa ao início do seu perfil. Conta inexistente, conta inativa e senha incorreta MUST receber 401 com a mesma mensagem genérica, sem dizer qual dado falhou, e o usuário não encontrado MUST passar por comparação com um resumo fictício, para o tempo de resposta não revelar se ele existe (RF001, UC01; diagrama de sequência do login; cap. 5, Autenticação e Sessão).

#### Scenario: Login aceito

- **GIVEN** um supervisor com conta ativa
- **WHEN** ele informa o usuário e a senha corretos
- **THEN** o servidor responde 204 com o cookie de sessão
- **AND** a interface abre o início do perfil supervisor

#### Scenario: Residente entra com a matrícula

- **GIVEN** um residente com conta ativa
- **WHEN** ele informa a matrícula como usuário e a senha correta
- **THEN** o servidor responde 204 com o cookie de sessão

#### Scenario: Campo do login

- **WHEN** alguém abre a página de acesso
- **THEN** o campo do identificador se chama "Usuário"
- **AND** um texto ligado ao campo diz "Residente: use sua matrícula."

#### Scenario: Senha incorreta

- **WHEN** alguém informa um usuário existente com a senha errada
- **THEN** o servidor responde 401 com "Usuário ou senha inválidos."

#### Scenario: Conta desativada

- **GIVEN** uma conta desativada pelo operador
- **WHEN** a pessoa informa o usuário e a senha que tinha
- **THEN** o servidor responde 401 com a mesma mensagem da senha incorreta

### Requirement: Conta conferida a cada requisição

O servidor SHALL conferir, a cada requisição, se a conta continua ativa, com o mesmo usuário, o mesmo perfil e o mesmo vínculo. Se a conta for desativada, tiver a senha redefinida ou mudar de vínculo, a sessão MUST ser encerrada e a requisição MUST receber 401 (cap. 5, sessão; diagrama de sequência do login, passo 8).

#### Scenario: Senha redefinida durante o uso

- **GIVEN** um residente conectado
- **WHEN** a senha da conta dele é redefinida
- **THEN** a requisição seguinte recebe 401 e ele precisa entrar com a senha nova

#### Scenario: Vínculo alterado

- **GIVEN** uma conta de residente conectada
- **WHEN** o operador desfaz o vínculo da conta com o cadastro do residente
- **THEN** a requisição seguinte recebe 401

### Requirement: Proteção contra CSRF nas gravações

Toda gravação feita pela interface, inclusive o login e a saída, SHALL exigir o token CSRF da sessão num cabeçalho da requisição. Sem token válido, o servidor MUST recusar com 403 `csrf_invalid`, e o token MUST NOT ser lido do corpo da requisição (RNF de segurança; diagrama de sequência do login, passos 1 e 2).

#### Scenario: Login sem token

- **WHEN** alguém envia usuário e senha corretos sem o token CSRF
- **THEN** o servidor responde 403 e não abre sessão

#### Scenario: Token no corpo

- **WHEN** uma gravação envia o token CSRF só no corpo da requisição
- **THEN** o servidor responde 403 `csrf_invalid`

### Requirement: Limite de tentativas de login em produção

No perfil de produção, o servidor SHALL recusar com 429, informando o intervalo de espera, o login depois de 5 tentativas malsucedidas por usuário ou de 1.000 tentativas por endereço IP numa janela de 15 minutos. Um login aceito MUST zerar o contador daquele usuário (RNF de segurança; diagrama de sequência do login, passo 3; cap. 5, Autenticação e Sessão).

#### Scenario: Sexta tentativa

- **GIVEN** 5 tentativas malsucedidas de login com o mesmo usuário nos últimos 15 minutos
- **WHEN** chega a sexta tentativa
- **THEN** o servidor responde 429 sem conferir a senha e informa o intervalo de espera

#### Scenario: Janela vencida

- **GIVEN** um usuário bloqueado pelo limite
- **WHEN** passam 15 minutos desde o início da janela
- **THEN** uma nova tentativa volta a ser avaliada
