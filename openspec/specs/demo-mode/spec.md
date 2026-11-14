# demo-mode Specification

## Purpose
Permitir que um visitante explore o sistema com os três perfis e dados fictícios, sem conta e sem acesso à API, mantendo a demonstração separada do uso real e indisponível em produção.

## Requirements

### Requirement: Entrada pela escolha de um perfil

Fora de produção, a página de acesso SHALL oferecer a demonstração com os perfis gestor, supervisor e residente, e ela MUST começar só pela escolha expressa de um deles. Uma sessão de conta aberta MUST ser encerrada antes. A demonstração não começa se o encerramento falhar, nem se o servidor não responder enquanto a conta puder estar aberta: conhecida na aba, ou que entrou neste navegador, não saiu e teve resposta aceita nos últimos 30 minutos (RF027; cap. 6, Navegação e Perfis de Acesso).

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

#### Scenario: Conta aberta em outra aba e servidor com erro

- **GIVEN** um gestor que entrou com a conta neste navegador e não saiu
- **AND** o servidor responde com erro à consulta da sessão
- **WHEN** ele abre a demonstração numa aba nova e escolhe um perfil
- **THEN** a demonstração não começa, a página pede para tentar de novo e a saída da conta não é pedida

#### Scenario: Servidor sem resposta e nenhuma conta neste navegador

- **GIVEN** um navegador em que nenhuma conta entrou, em que a última conta já saiu ou em que nenhuma resposta do servidor foi aceita nos últimos 30 minutos
- **AND** o servidor sem resposta
- **WHEN** o visitante escolhe um perfil de demonstração
- **THEN** a demonstração começa sem pedir mais nada ao servidor

#### Scenario: Login aceito e consulta da conta sem resposta

- **GIVEN** um login que o servidor aceitou, seguido de uma consulta da conta sem resposta
- **WHEN** o usuário escolhe um perfil de demonstração com o servidor ainda sem resposta
- **THEN** a demonstração não começa e a página pede para tentar de novo

#### Scenario: Sessão já encerrada no servidor

- **GIVEN** uma conta que entrou neste navegador e cuja sessão o servidor já encerrou
- **WHEN** o usuário escolhe um perfil de demonstração
- **THEN** a demonstração começa sem pedir a saída da conta

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
