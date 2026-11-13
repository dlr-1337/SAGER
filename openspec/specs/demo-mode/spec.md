# demo-mode Specification

## Purpose
Permitir que um visitante explore o sistema com os três perfis e dados fictícios, sem conta e sem acesso à API, mantendo a demonstração separada do uso real e indisponível em produção.

## Requirements

### Requirement: Entrada pela escolha de um perfil

Fora de produção, a página de acesso SHALL oferecer a demonstração com os perfis gestor, supervisor e residente, e a demonstração MUST começar só pela escolha expressa de um deles. Se houver sessão de conta aberta, ela MUST ser encerrada antes, e a demonstração não começa se o encerramento falhar (RF027; cap. 6, Navegação e Perfis de Acesso).

#### Scenario: Visitante escolhe o perfil residente

- **WHEN** o visitante escolhe Residente na página de acesso
- **THEN** o sistema abre o início do residente com dados fictícios

#### Scenario: Conta aberta na mesma aba

- **GIVEN** um supervisor com sessão de conta aberta
- **WHEN** ele escolhe um perfil de demonstração
- **THEN** a sessão da conta é encerrada antes de a demonstração começar

#### Scenario: Falha ao sair da conta

- **GIVEN** uma sessão de conta aberta e o servidor sem resposta
- **WHEN** o usuário escolhe um perfil de demonstração
- **THEN** a demonstração não começa e a página pede para tentar de novo

### Requirement: Dados fictícios em memória

Na demonstração, todas as consultas e gravações SHALL usar só dados fictícios guardados na memória do navegador, e MUST NOT chamar a API nem ler ou gravar registros reais (RF027; AGENTS.md, Security & Demo Data).

#### Scenario: Gravação na demonstração

- **GIVEN** a demonstração com o perfil gestor
- **WHEN** o visitante cadastra um residente
- **THEN** o residente aparece na lista da demonstração e nenhuma requisição é enviada à API

### Requirement: Indisponível em produção

Em produção, o servidor web MUST responder 404 ao endereço `/demonstracao`, a página de acesso MUST NOT oferecer a demonstração e a interface MUST desfazer uma demonstração ativada antes e mandar quem tentar entrar para a página de acesso (RF027; cap. 6, Navegação e Perfis de Acesso).

#### Scenario: Endereço da demonstração em produção

- **WHEN** alguém abre `/demonstracao` no endereço de produção
- **THEN** o servidor responde 404

#### Scenario: Demonstração guardada de antes

- **GIVEN** um navegador que guardou uma demonstração ativa
- **WHEN** ele abre o sistema publicado em produção
- **THEN** a demonstração fica desativada e a página de acesso não oferece os perfis fictícios

### Requirement: Falha da API não vira demonstração

Com acesso por conta, uma falha ou indisponibilidade da API SHALL ser mostrada como erro com orientação, e o sistema MUST NOT exibir dados fictícios no lugar dos dados reais (RF027; cap. 4, requisito não funcional Degradação).

#### Scenario: API fora do ar

- **GIVEN** um gestor com sessão de conta
- **WHEN** a lista de residentes falha por indisponibilidade da API
- **THEN** a página mostra o erro e nenhum residente fictício
