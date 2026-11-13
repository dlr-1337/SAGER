# help-center Specification

## Purpose
Oferecer uma página de ajuda acessível sem login, com perguntas frequentes sobre as regras centrais e guias das tarefas do perfil em uso.

## Requirements

### Requirement: Ajuda sem login

A página de ajuda SHALL abrir sem login e ter link na página de acesso. As perguntas frequentes SHALL explicar ao menos que o supervisor confirma o retorno, que a saída longa só é aprovada depois da autorização conferida e que notificação não vira advertência sozinha (RF026; cap. 4, requisito não funcional Ajuda).

#### Scenario: Visitante sem conta

- **GIVEN** um visitante sem sessão
- **WHEN** ele abre a ajuda pelo link da página de acesso
- **THEN** a ajuda aparece com as perguntas frequentes, sem pedir login

### Requirement: Guias do perfil em uso

Com sessão de conta ou na demonstração, a ajuda SHALL mostrar guias só das tarefas que o perfil em uso pode fazer, levando à tela de cada tarefa (RF026; cap. 4, tabela de permissões).

#### Scenario: Gestor na ajuda

- **GIVEN** um gestor com sessão de conta
- **WHEN** ele abre a ajuda
- **THEN** vê o guia de relatórios e não vê os guias da chamada e das saídas

#### Scenario: Residente na demonstração

- **GIVEN** a demonstração com o perfil residente
- **WHEN** o visitante abre a ajuda
- **THEN** vê os guias de saídas, comunicações e limpeza e não vê o de relatórios
