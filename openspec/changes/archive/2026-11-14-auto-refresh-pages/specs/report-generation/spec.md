## MODIFIED Requirements

### Requirement: Andamento automático

A tela SHALL atualizar a lista sozinha a cada poucos segundos enquanto houver arquivo em preparo e a cada 15 segundos quando não houver, e anunciar o resultado a leitores de tela. Ela MUST parar de consultar ao sair da tela e seguir a pausa com a aba oculta e depois de 30 minutos sem interação, como as demais telas que se atualizam sozinhas.

#### Scenario: Arquivo pronto

- **GIVEN** um relatório em preparo
- **WHEN** o arquivo fica pronto
- **THEN** os botões "Baixar PDF" e "Baixar planilha Excel" aparecem sem nova ação

#### Scenario: Demora

- **WHEN** o preparo passa de 2 minutos
- **THEN** a tela avisa que está demorando e que o relatório continua na lista

#### Scenario: Nada em preparo

- **GIVEN** nenhum relatório em preparo e a aba visível
- **WHEN** passam 15 segundos
- **THEN** a lista de relatórios gerados é consultada de novo
