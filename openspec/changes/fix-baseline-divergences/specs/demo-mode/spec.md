## MODIFIED Requirements

### Requirement: Entrada pela escolha de um perfil

Fora de produção, a página de acesso SHALL oferecer a demonstração com os perfis gestor, supervisor e residente, e a demonstração MUST começar só pela escolha expressa de um deles. Se houver sessão de conta aberta, ela MUST ser encerrada antes. A demonstração não começa se o encerramento falhar, nem se o servidor não responder quando a aba conhece a conta ou uma conta entrou neste navegador e ainda não saiu (RF027; cap. 6, Navegação e Perfis de Acesso).

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

- **GIVEN** um navegador em que nenhuma conta entrou, ou em que a última conta já saiu
- **AND** o servidor sem resposta
- **WHEN** o visitante escolhe um perfil de demonstração
- **THEN** a demonstração começa sem pedir mais nada ao servidor

#### Scenario: Sessão já encerrada no servidor

- **GIVEN** uma conta que entrou neste navegador e cuja sessão o servidor já encerrou
- **WHEN** o usuário escolhe um perfil de demonstração
- **THEN** a demonstração começa sem pedir a saída da conta
