# Spec Delta

## Purpose

Definir as seções da ficha do residente que gestor e supervisor consultam, sem seções vazias nem promessas de entregas futuras, conforme RF002 e a tabela de permissões da monografia.

## ADDED Requirements

### Requirement: Ficha sem seção de termos

A ficha do residente SHALL oferecer só as seções Dados, Responsáveis e Histórico, tanto no acesso por conta quanto na demonstração, e MUST NOT mostrar uma seção de termos de compromisso nem aviso de integração pendente. Os termos continuam no fluxo de reincidência do supervisor e nas comunicações do próprio residente.

#### Scenario: Gestor abre a ficha no acesso por conta

- **GIVEN** um gestor autenticado
- **WHEN** ele abre a ficha de um residente
- **THEN** as seções são Dados, Responsáveis e Histórico
- **AND** não aparece a seção Termos nem o texto "Ainda não integrado"

#### Scenario: Ficha na demonstração

- **GIVEN** a demonstração com o perfil gestor
- **WHEN** o usuário abre a ficha de um residente fictício
- **THEN** as seções são Dados, Responsáveis e Histórico, sem a seção Termos
