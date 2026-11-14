## MODIFIED Requirements

### Requirement: Páginas de 25 que substituem a lista

Listas longas, exceto a da chamada noturna, SHALL mostrar 25 itens por página, com Anterior e Próxima, e trocar de página MUST substituir os itens mostrados em vez de acrescentá-los ao fim. Só a lista de conversas mantém "Carregar mais".

#### Scenario: Próxima página de avisos

- **GIVEN** mais de 25 avisos
- **WHEN** o supervisor clica em Próxima
- **THEN** a tela mostra só os avisos da página 2, e a página não fica mais longa
