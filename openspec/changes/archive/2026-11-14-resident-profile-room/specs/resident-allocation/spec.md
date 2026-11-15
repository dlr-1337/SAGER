## ADDED Requirements

### Requirement: Quarto atual no perfil do residente

A tela "Meu perfil" do residente SHALL mostrar o quarto da alocação ativa dele como código do alojamento, casa ou bloco quando houver e "Quarto" com o número, por exemplo "R2 · Casa 3 · Quarto 43", atualizado a cada abertura da tela. Sem alocação ativa, e para gestor e supervisor, a tela MUST NOT mostrar linha de quarto. Na demonstração, o residente fictício SHALL ver o quarto fictício dele (RF019; cap. 8, Meu perfil).

#### Scenario: Residente em quarto com casa

- **GIVEN** um residente com alocação ativa no quarto 43 da Casa 3 do alojamento de código R2
- **WHEN** ele abre "Meu perfil"
- **THEN** a tela mostra "R2 · Casa 3 · Quarto 43"

#### Scenario: Residente em quarto sem casa ou bloco

- **GIVEN** um residente com alocação ativa no quarto 43 do alojamento R2, que não pertence a casa nem a bloco
- **WHEN** ele abre "Meu perfil"
- **THEN** a tela mostra "R2 · Quarto 43"

#### Scenario: Residente sem alocação ativa

- **GIVEN** um residente cuja última alocação foi encerrada
- **WHEN** ele abre "Meu perfil"
- **THEN** a tela não mostra linha de quarto

#### Scenario: Gestor e supervisor

- **WHEN** um gestor ou um supervisor abre "Meu perfil"
- **THEN** a tela não mostra linha de quarto

#### Scenario: Transferência com a sessão aberta

- **GIVEN** um residente conectado que foi transferido do quarto 43 para o quarto 44 do alojamento R2
- **WHEN** ele abre "Meu perfil" sem sair do sistema
- **THEN** a tela mostra "R2 · Quarto 44"

#### Scenario: Residente da demonstração

- **GIVEN** a demonstração no perfil residente
- **WHEN** ele abre "Meu perfil"
- **THEN** a tela mostra o quarto fictício "Bloco A · Quarto 102"
