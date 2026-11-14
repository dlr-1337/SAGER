# access-control Specification

## Purpose
Definir como as pessoas entram no SAGER com usuário e senha (o residente usa a matrícula), como a sessão é mantida no servidor e o que cada um dos três perfis (gestor, supervisor e residente) pode fazer, com a autorização sempre aplicada pelo servidor.

## Requirements

### Requirement: Três perfis de conta

Cada conta SHALL ter um único perfil entre gestor, supervisor e residente, e no máximo um vínculo, com um residente ou com um supervisor, nunca com os dois. O sistema MUST recusar a criação de conta com qualquer outro perfil (RF001; cap. 4, Perfis de Acesso e diagrama de classes de acesso e gestão).

#### Scenario: Conta de cada perfil

- **GIVEN** uma conta de gestor, uma de supervisor e uma de residente
- **WHEN** cada uma entra e consulta a própria conta
- **THEN** a resposta traz um único perfil, o da conta

#### Scenario: Perfil fora dos três

- **WHEN** o operador tenta criar uma conta com o perfil "admin"
- **THEN** a criação é recusada e nenhuma conta é gravada

### Requirement: Login por matrícula e senha

O login SHALL usar a matrícula e a senha da conta do SAGER e, quando aceito, MUST trocar o identificador da sessão e levar a pessoa ao início do seu perfil. Conta inexistente, conta inativa e senha incorreta MUST receber 401 com a mesma mensagem genérica, sem dizer qual dado falhou, e a matrícula não encontrada MUST passar por comparação com um resumo fictício, para o tempo de resposta não revelar se ela existe (RF001, UC01; diagrama de sequência do login; cap. 5, Autenticação e Sessão).

#### Scenario: Login aceito

- **GIVEN** um supervisor com conta ativa
- **WHEN** ele informa a matrícula e a senha corretas
- **THEN** o servidor responde 204 com o cookie de sessão
- **AND** a interface abre o início do perfil supervisor

#### Scenario: Senha incorreta

- **WHEN** alguém informa uma matrícula existente com a senha errada
- **THEN** o servidor responde 401 com "Matrícula ou senha inválidos."

#### Scenario: Conta desativada

- **GIVEN** uma conta desativada pelo operador
- **WHEN** a pessoa informa a matrícula e a senha que tinha
- **THEN** o servidor responde 401 com a mesma mensagem da senha incorreta

### Requirement: Senha nunca exposta

A senha SHALL ser guardada apenas como resumo criptográfico e MUST NOT aparecer, nem como resumo, em nenhuma resposta da API (RNF de segurança).

#### Scenario: Consulta da própria conta

- **WHEN** um residente conectado consulta a própria conta
- **THEN** a resposta traz nome, matrícula, perfil e vínculo, sem senha nem resumo da senha

### Requirement: Sessão guardada no servidor

A sessão SHALL ficar guardada no servidor e ser identificada por um cookie inacessível a scripts, com `SameSite=Lax` e, fora do ambiente local, `Secure`, e MUST expirar depois de 30 minutos sem uso. Ao sair, a sessão MUST ser invalidada, e as consultas seguintes com o mesmo cookie MUST receber 401 (RF001; RNF de segurança; cap. 5, Autenticação e Sessão).

#### Scenario: Sair do sistema

- **GIVEN** um gestor conectado
- **WHEN** ele sai do sistema
- **THEN** a consulta seguinte da própria conta recebe 401

#### Scenario: Reinício do servidor

- **GIVEN** um supervisor conectado
- **WHEN** a aplicação é reiniciada sem troca do banco
- **THEN** a sessão dele continua válida

### Requirement: Conta conferida a cada requisição

O servidor SHALL conferir, a cada requisição, se a conta continua ativa, com a mesma matrícula, o mesmo perfil e o mesmo vínculo. Se a conta for desativada, tiver a senha redefinida ou mudar de vínculo, a sessão MUST ser encerrada e a requisição MUST receber 401 (cap. 5, sessão; diagrama de sequência do login, passo 8).

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

- **WHEN** alguém envia matrícula e senha corretas sem o token CSRF
- **THEN** o servidor responde 403 e não abre sessão

#### Scenario: Token no corpo

- **WHEN** uma gravação envia o token CSRF só no corpo da requisição
- **THEN** o servidor responde 403 `csrf_invalid`

### Requirement: Limite de tentativas de login em produção

No perfil de produção, o servidor SHALL recusar com 429, informando o intervalo de espera, o login depois de 5 tentativas malsucedidas por matrícula ou de 1.000 tentativas por endereço IP numa janela de 15 minutos. Um login aceito MUST zerar o contador daquela matrícula (RNF de segurança; diagrama de sequência do login, passo 3; cap. 5, Autenticação e Sessão).

#### Scenario: Sexta tentativa

- **GIVEN** 5 tentativas malsucedidas de login com a mesma matrícula nos últimos 15 minutos
- **WHEN** chega a sexta tentativa
- **THEN** o servidor responde 429 sem conferir a senha e informa o intervalo de espera

#### Scenario: Janela vencida

- **GIVEN** uma matrícula bloqueada pelo limite
- **WHEN** passam 15 minutos desde o início da janela
- **THEN** uma nova tentativa volta a ser avaliada

### Requirement: Autorização aplicada pelo servidor

O servidor SHALL aplicar a permissão de cada perfil a cada rota e MUST negar qualquer rota não prevista, inclusive a exclusão de registros. Requisição sem sessão MUST receber 401, e requisição de perfil sem permissão MUST receber 403 (cap. 4, Perfis de Acesso; RNF de segurança).

#### Scenario: Sem sessão

- **WHEN** alguém sem sessão consulta a lista de residentes
- **THEN** o servidor responde 401

#### Scenario: Exclusão pela API

- **WHEN** um gestor conectado pede a exclusão de um residente
- **THEN** o servidor nega o pedido e o residente continua cadastrado

### Requirement: Cadastros com gestor e supervisor

Gestor e supervisor SHALL ter as mesmas permissões de leitura e escrita sobre residentes, responsáveis legais, cursos, alojamentos, unidades, quartos e alocações. O residente MUST receber 403 nesses recursos (RF002, RF003, RF017, RF018, RF019; cap. 4, tabela de permissões).

#### Scenario: Supervisor cadastra quarto

- **WHEN** um supervisor cadastra um quarto
- **THEN** o quarto é gravado como se fosse cadastrado pelo gestor

#### Scenario: Residente consulta cadastros

- **WHEN** um residente consulta a lista de residentes pela API
- **THEN** o servidor responde 403

### Requirement: Operações só do supervisor

Somente o supervisor SHALL operar a chamada noturna, decidir saídas, registrar partida e retorno, tratar ocorrências, notificações, advertências e termos, publicar avisos e registrar avaliações de limpeza. O gestor MUST receber 403 nessas operações (cap. 4, Perfis de Acesso e tabela de permissões).

#### Scenario: Gestor tenta abrir a chamada

- **WHEN** um gestor tenta abrir a chamada noturna de um alojamento
- **THEN** o servidor responde 403 e nenhuma chamada é criada

#### Scenario: Gestor tenta ver notificações

- **WHEN** um gestor consulta as notificações internas
- **THEN** o servidor responde 403

### Requirement: Residente só nos próprios dados

O residente SHALL acessar somente as próprias saídas, comunicações e avaliações de limpeza, além do ranking. Um registro de outro residente MUST ser tratado como inexistente, com 404, sem revelar o conteúdo (cap. 4, Perfis de Acesso; RNF de segurança, autorização por registro).

#### Scenario: Saída de outro residente

- **GIVEN** uma saída curta pedida pelo residente A
- **WHEN** o residente B consulta, altera ou cancela essa saída pelo endereço dela
- **THEN** o servidor responde 404 e nada muda

### Requirement: Contas de gestor só pelo terminal

A conta de gestor SHALL ser criada apenas pelo operador técnico, por linha de comando, fora da interface, e esse comando MUST recusar criar conta de supervisor ou de residente. Não há cadastro público de contas: as contas de residente e de supervisor nascem no cadastro do respectivo registro (cap. 4, Perfis de Acesso e Restrições e Premissas).

#### Scenario: Operador cria gestor

- **WHEN** o operador cria uma conta de gestor pelo terminal
- **THEN** a conta é criada com a senha digitada e confirmada no terminal, nunca passada como argumento do comando

#### Scenario: Operador tenta criar residente

- **WHEN** o operador tenta criar uma conta de residente pelo terminal
- **THEN** o comando é recusado e nenhuma conta muda

### Requirement: Recuperação de senha do residente

O residente SHALL redefinir a própria senha informando matrícula, nome completo, data de nascimento e, se tiver responsável ativo, o nome de um deles. Dado que não confere, conta inexistente e conta de outro perfil MUST receber a mesma recusa, sem revelar o motivo, e a troca aceita MUST encerrar as sessões abertas da conta (RF020, UC02).

#### Scenario: Dados conferem

- **GIVEN** um residente com responsável ativo e uma sessão aberta em outro aparelho
- **WHEN** ele informa matrícula, nome sem acentos, data de nascimento, nome do responsável e a senha nova
- **THEN** a senha é trocada e a sessão do outro aparelho recebe 401

#### Scenario: Responsável errado

- **GIVEN** um residente com responsável ativo
- **WHEN** alguém informa os dados dele com outro nome de responsável
- **THEN** a recuperação é recusada com a mensagem genérica e a senha não muda

#### Scenario: Conta de supervisor

- **WHEN** alguém tenta recuperar pela tela a senha de uma conta de supervisor
- **THEN** recebe a mesma recusa genérica e a senha não muda

### Requirement: API fechada fora dos ambientes conhecidos

Quando a aplicação iniciar sem o perfil de execução local nem o de produção, toda rota da API, inclusive o login e o token CSRF, MUST ser negada. O perfil local MUST aceitar conexões só do próprio computador (AGENTS.md, Security & Demo Data; cap. 5, Implantação e Operação).

#### Scenario: Perfil desconhecido

- **GIVEN** a aplicação iniciada com um perfil de execução desconhecido
- **WHEN** alguém pede o token CSRF ou tenta entrar
- **THEN** o servidor responde 401 ou 403

#### Scenario: Perfil local exposto na rede

- **WHEN** o perfil local é iniciado escutando um endereço que não é do próprio computador
- **THEN** a aplicação se recusa a iniciar

### Requirement: Erros sem detalhes internos

Toda resposta de erro da API SHALL trazer um código, uma mensagem e o identificador da requisição, e MUST NOT conter rastro de pilha, trecho de SQL ou segredo (RNF de segurança).

#### Scenario: Entrada inválida

- **WHEN** uma gravação envia um campo inválido
- **THEN** a resposta traz `invalid_input`, uma mensagem simples e o identificador da requisição, sem detalhe interno

#### Scenario: Recuperação de senha acima do limite

- **WHEN** os pedidos de recuperação de senha de uma matrícula passam do limite
- **THEN** o servidor responde 429 com `rate_limited`, uma mensagem simples e o identificador da requisição, informa o intervalo de espera e marca a resposta para não ser guardada, sem citar a matrícula nem o nome informados
