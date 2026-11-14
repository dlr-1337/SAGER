## MODIFIED Requirements

### Requirement: Erros sem detalhes internos

Toda resposta de erro da API SHALL trazer um código, uma mensagem e o identificador da requisição, e MUST NOT conter rastro de pilha, trecho de SQL ou segredo (RNF de segurança).

#### Scenario: Entrada inválida

- **WHEN** uma gravação envia um campo inválido
- **THEN** a resposta traz `invalid_input`, uma mensagem simples e o identificador da requisição, sem detalhe interno

#### Scenario: Recuperação de senha acima do limite

- **WHEN** os pedidos de recuperação de senha de uma matrícula passam do limite
- **THEN** o servidor responde 429 com `rate_limited`, uma mensagem simples e o identificador da requisição, informa o intervalo de espera e marca a resposta para não ser guardada, sem citar a matrícula nem o nome informados
