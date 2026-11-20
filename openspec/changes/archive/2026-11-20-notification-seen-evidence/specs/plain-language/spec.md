## MODIFIED Requirements

### Requirement: Sem identificadores técnicos na tela

As telas MUST NOT mostrar UUID, hash, número de versão interna, nem códigos crus de situação. Esses dados SHALL continuar na auditoria.

#### Scenario: Marcação da chamada

- **WHEN** o supervisor vê uma ausência justificada
- **THEN** a tela mostra o tipo da saída, sem identificador

#### Scenario: Evidência da avaliação de limpeza

- **GIVEN** uma notificação de ocorrência vinda de uma avaliação de limpeza
- **WHEN** o supervisor abre o detalhe dela
- **THEN** ele vê a data da avaliação, a nota de limpeza e a nota de cada critério pelo nome, como "Piso" e "Organização"
- **AND** não vê o código interno do quarto nem a versão da regra
