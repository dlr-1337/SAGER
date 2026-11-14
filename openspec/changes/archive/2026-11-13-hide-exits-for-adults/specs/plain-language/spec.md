## MODIFIED Requirements

### Requirement: Ação principal à vista

A ação principal de cada tela SHALL ficar visível sem depender de outra escolha, e o residente MUST NOT receber filtros que não fazem sentido para a própria lista.

#### Scenario: Residente nas saídas

- **WHEN** o residente menor de idade, ou sem data de nascimento, abre as saídas
- **THEN** ele vê "Pedir saída curta (até 3 horas)" e "Pedir saída longa (mais de 3 horas)", sem filtro por nome ou matrícula

#### Scenario: Residente maior de idade nas saídas

- **WHEN** o residente maior de idade abre as saídas
- **THEN** ele vê a lista das próprias saídas, sem filtro por nome ou matrícula e sem os botões de pedido
