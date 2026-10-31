# tab-navigation Specification

## Purpose
Manter o usuário no mesmo ponto da página ao trocar de aba, e levá-lo ao topo ao abrir outra tela.

## Requirements

### Requirement: Aba mantém a posição

Trocar de aba MUST NOT mudar a posição de rolagem da página, nem mover o foco para fora da aba acionada.

#### Scenario: Aba mais curta

- **GIVEN** a tela do residente rolada até as abas
- **WHEN** o usuário clica em Histórico, cujo conteúdo é mais curto
- **THEN** a posição da página continua a mesma

#### Scenario: Filtro de saídas

- **GIVEN** a lista de saídas rolada até as abas
- **WHEN** o usuário troca de Curtas para Longas
- **THEN** a posição continua a mesma enquanto a lista carrega

### Requirement: Nova tela começa no topo

Ao navegar para outro caminho, a página SHALL voltar ao topo. Mudanças só de parâmetros de consulta MUST NOT mover a página. Voltar e avançar do navegador MUST NOT perder a posição que o navegador restaura.

#### Scenario: Abrir detalhe

- **GIVEN** uma lista rolada
- **WHEN** o usuário abre um registro
- **THEN** o detalhe abre no topo

#### Scenario: Voltar à lista

- **GIVEN** um detalhe aberto a partir de uma lista rolada
- **WHEN** o usuário usa o botão Voltar do navegador
- **THEN** a lista reaparece na posição em que estava
