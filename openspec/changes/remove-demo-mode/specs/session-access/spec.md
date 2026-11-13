# Spec Delta

## Purpose

Definir como uma pessoa entra nas telas internas do SAGER: só com conta e sessão do servidor, com o perfil da própria conta e sem registros inventados quando o servidor falha.

## ADDED Requirements

### Requirement: Telas internas só com sessão

Toda tela, exceto acesso, recuperação de senha, ajuda e página não encontrada, SHALL exigir uma sessão válida no servidor. Sem ela, o sistema SHALL levar a pessoa à tela de acesso.

#### Scenario: Início sem sessão

- **WHEN** um visitante sem sessão abre o início
- **THEN** o sistema mostra a tela de acesso

#### Scenario: Sessão encerrada no servidor

- **GIVEN** um gestor cuja sessão foi encerrada no servidor
- **WHEN** ele abre a lista de residentes
- **THEN** o sistema mostra a tela de acesso, sem dados da lista

### Requirement: Sem entrada de demonstração

A tela de acesso SHALL oferecer só o login por matrícula e senha, a recuperação de senha e a ajuda para acessar. O sistema MUST NOT oferecer entrada sem conta, perfil fictício nem troca de perfil ou de cenário.

#### Scenario: Tela de acesso

- **WHEN** um visitante abre a tela de acesso
- **THEN** a tela mostra o login, "Esqueci minha senha" e "Ajuda para acessar", sem opção de explorar com um perfil fictício

#### Scenario: Endereço antigo da demonstração

- **WHEN** alguém abre o endereço /demonstracao
- **THEN** o sistema responde como página inexistente e não abre nenhuma sessão

#### Scenario: Cabeçalho de quem entrou

- **GIVEN** um supervisor autenticado
- **WHEN** ele vê o cabeçalho no computador ou abre o menu no celular
- **THEN** não há seletor de perfil nem de cenário

### Requirement: Perfil da conta autenticada

O menu, o início, a ajuda e as permissões das telas SHALL seguir o perfil da conta autenticada, informado pelo servidor. Sem sessão, nenhuma tela SHALL mostrar opções de um perfil.

#### Scenario: Gestor autenticado

- **GIVEN** uma conta de gestor
- **WHEN** ela entra no sistema
- **THEN** o menu mostra os itens do gestor e o cabeçalho mostra o nome e o perfil da conta

#### Scenario: Ajuda sem sessão

- **WHEN** um visitante sem sessão abre a ajuda
- **THEN** a página mostra as orientações gerais e as perguntas frequentes, sem guias de chamada, saídas, relatórios ou limpeza

### Requirement: Falha sem dados substitutos

Quando o servidor recusar, falhar ou não responder, a tela SHALL mostrar a falha e MUST NOT mostrar registros que não vieram do servidor.

#### Scenario: Lista indisponível

- **GIVEN** o servidor falhando ao listar residentes
- **WHEN** o gestor abre a lista de residentes
- **THEN** a tela informa que não foi possível carregar residentes e não mostra nenhum residente

#### Scenario: Relatórios indisponíveis

- **GIVEN** o servidor falhando ao listar relatórios
- **WHEN** o gestor abre os relatórios
- **THEN** a tela informa a falha e não mostra relatórios de exemplo
