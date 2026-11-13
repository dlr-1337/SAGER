# Spec Delta

## Purpose

Registrar cada escrita dos registros do sistema numa trilha de auditoria permanente, só de inclusão e sem valores pessoais, consultável pela API, e impedir que uma alteração sobrescreva a de outro usuário.

## ADDED Requirements

### Requirement: Evento na mesma transação

Cada criação, alteração ou encerramento de registro do sistema SHALL gravar um evento de auditoria na mesma transação da escrita, com recurso, identificador, ação, versão resultante, origem e horário, e com autor e perfil quando a escrita vem de uma conta conectada. Se o evento falhar, a escrita MUST ser desfeita, e uma escrita desfeita MUST NOT deixar evento (RN16, RF025).

#### Scenario: Cadastro auditado

- **WHEN** o gestor cadastra um residente
- **THEN** a auditoria tem um evento de criação do residente com o gestor como autor e versão 0

#### Scenario: Escrita recusada

- **WHEN** a transferência de um residente é recusada por falta de vaga
- **THEN** nenhum evento de auditoria é gravado para ela

### Requirement: Só nomes de campos

O evento SHALL guardar os nomes dos campos alterados, e o banco MUST recusar evento com campo fora da lista do recurso; valores, senhas, textos de justificativa e conteúdos MUST NOT entrar na auditoria (RN16, RN17).

#### Scenario: Correção de marcação na chamada

- **WHEN** o supervisor corrige uma marcação com justificativa
- **THEN** o evento lista os campos alterados, sem a marcação nova nem o texto da justificativa

### Requirement: Trilha permanente

A trilha de auditoria SHALL aceitar apenas inclusões e ter retenção permanente. O banco MUST recusar alteração, exclusão e esvaziamento de eventos, inclusive vindos de fora da aplicação (RN16; cap. 5, Auditoria).

#### Scenario: Tentativa de apagar evento

- **WHEN** um comando direto no banco tenta excluir um evento de auditoria
- **THEN** o banco recusa e o evento continua gravado

### Requirement: Escritas sem autor de conta

Escritas feitas por rotinas sem requisição de usuário, como a expiração de saídas, SHALL gerar evento com origem de rotina do sistema e sem autor ou perfil humano. Os comandos de conta do terminal SHALL gravar a origem própria do terminal, sem autor de conta, como fixa `account-audit` (RN16, RF024, UC23).

#### Scenario: Expiração auditada

- **WHEN** a rotina expira uma saída curta
- **THEN** a auditoria tem um evento da saída com origem de rotina do sistema e sem autor

### Requirement: Identificador da requisição

Cada requisição à API SHALL receber do servidor um identificador novo, devolvido no cabeçalho `X-Request-Id` e gravado nos eventos dela. Um identificador enviado pelo cliente MUST ser ignorado (RF025; cap. 5, Auditoria).

#### Scenario: Cliente tenta impor o identificador

- **WHEN** uma requisição chega com o cabeçalho `X-Request-Id` escolhido pelo cliente
- **THEN** a resposta traz outro identificador, gerado pelo servidor, e os eventos usam esse

### Requirement: Consulta pela API

Gestor e supervisor SHALL consultar a auditoria pela API, do evento mais recente para o mais antigo, filtrando por registro, autor, requisição ou recurso, em páginas de 1 a 100 eventos. O residente MUST receber 403, e a consulta MUST NOT ter tela própria (RF025; cap. 4, tabela de permissões).

#### Scenario: Eventos de um registro

- **WHEN** o supervisor consulta a auditoria filtrando por uma saída curta
- **THEN** recebe só os eventos dessa saída, do mais recente para o mais antigo

#### Scenario: Residente consulta a auditoria

- **WHEN** um residente pede a auditoria
- **THEN** o servidor responde 403

#### Scenario: Página grande demais

- **WHEN** o gestor pede 101 eventos numa página
- **THEN** o servidor responde 400

### Requirement: Controle de versão nas alterações

Cada alteração de registro SHALL informar a versão lida. Versão diferente da atual MUST receber 409 `stale_version` sem gravar, e a alteração de outro usuário MUST NOT ser sobrescrita (RN18).

#### Scenario: Duas edições do mesmo quarto

- **GIVEN** gestor e supervisor abriram o quarto 101 na versão 3
- **WHEN** o gestor salva primeiro e depois o supervisor salva com a versão 3
- **THEN** o supervisor recebe 409 `stale_version` e o quarto mantém a edição do gestor
