# brand-assets Specification

## Purpose
Dar ao SAGER identidade própria na aba do navegador, na tela inicial do celular e na prévia de links, sem alterar a marca oficial do IF Goiano.

## Requirements

### Requirement: Ícone próprio

O sistema SHALL servir favicon SVG e ICO, ícone de tela inicial e manifest com o símbolo SAGER, legível em 16 px, e MUST NOT usar nem modificar a marca do IF Goiano nesses arquivos.

#### Scenario: Aba do navegador

- **WHEN** o usuário abre o sistema
- **THEN** a aba mostra o símbolo SAGER

#### Scenario: Cabeçalho

- **WHEN** o usuário vê o cabeçalho
- **THEN** a marca oficial do IF Goiano continua lá, sem alteração

### Requirement: Prévia de link

A página SHALL trazer título, descrição e imagem de prévia, com URL absoluta do domínio em que está publicada.

#### Scenario: Link compartilhado

- **WHEN** um link do sistema em produção é lido por um serviço de prévia
- **THEN** a resposta traz og:image com a origem real, sem marcador

### Requirement: Arquivos servidos corretamente

Os arquivos MUST ter o tipo correto e os cabeçalhos de segurança já vigentes, em produção e no Coolify.

#### Scenario: Manifest

- **WHEN** o navegador pede o manifest
- **THEN** a resposta é `application/manifest+json`, com CSP e HSTS
