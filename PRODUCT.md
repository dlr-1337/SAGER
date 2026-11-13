# SAGER — contexto do produto

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Angular 22, Angular Material/CDK e SCSS no frontend. Backend em Java 21 com Spring Boot 4.1, JdbcTemplate e PostgreSQL 17, com migrações Flyway.

## Users

- Gestores da Assistência Estudantil administram residentes, responsáveis, supervisores e quartos e acompanham relatórios.
- Supervisores têm autoridade operacional máxima e podem gerir os mesmos cadastros,
  conforme decisão do solicitante em 30/09/2026, exceto supervisores: desde 31/10/2026, só o gestor os gerencia.
- Supervisores registram a chamada, acompanham saídas e retornos, analisam notificações, registram advertências e avaliam a limpeza.
- Residentes consultam informações próprias, avisos e ranking; menores de idade solicitam saídas.
- Responsáveis legais recebem o documento da saída longa pelo WhatsApp e devolvem a autorização em foto ou PDF, sem acesso ao sistema.
- Pessoas mais velhas usarão a plataforma; tarefas essenciais precisam ser claras, legíveis e fáceis de acionar.

## Product Purpose

Substituir controles residenciais em papel por processos digitais rastreáveis para o Campus Urutaí. O sistema reúne cadastros, quartos, chamada noturna, saídas, retornos, comunicação, limpeza e relatórios sem automatizar decisões disciplinares.

## Operating Context

Plataforma web responsiva de uso institucional no IF Goiano, em computador e celular. A Assistência Estudantil define as regras operacionais e a TI fornece a infraestrutura. Todas as telas usam o backend; desenvolvimento, testes e apresentações usam dados sintéticos.

## Capabilities and Constraints

- As regras de permissão e domínio estão no AGENTS.md, o comportamento esperado em `openspec/specs` e as pendências institucionais em `docs/ARQUITETURA.md`.
- Chamada e solicitações formais de saída se aplicam a residentes menores de idade. Saída curta dura no máximo três horas. Saída longa exige autorização do responsável, conferida por um servidor, antes da aprovação, que é um ato separado. Retorno curto é confirmado presencialmente pelo supervisor.
- Alertas internos não são advertências e não geram sanções automáticas. Ler um aviso é diferente de marcar ciência.
- O login próprio do SAGER, por matrícula e senha, foi escolhido em 30/09/2026; integrações SUAP/Google ficam
  adiadas. O cadastro é manual e a data de nascimento obrigatória. Para saída longa,
  uma autorização conferida de qualquer responsável cadastrado e vinculado é suficiente.
- A auditoria tem retenção permanente. O canal com responsáveis é um gateway WhatsApp
  auto-hospedado e não oficial, desligado por padrão, sem provedor externo de assinatura.
  Conversas pelo WhatsApp são só para supervisores. O aceite dessa integração, o nível de
  assinatura exigido, a retenção de mensagens, regras de limpeza/ranking e métricas de comportamento
  continuam como pendências institucionais em `docs/ARQUITETURA.md`.
- O registro da autorização comprova o recebimento de um arquivo e a conferência humana, não a autoria da assinatura.

## Brand Commitments

Preservar o nome SAGER, a referência ao IF Goiano — Campus Urutaí e o verde institucional. A marca oficial do IF Goiano deve ser usada sem alteração, conforme o manual institucional. A identidade da interface será modernizada a partir dos protótipos existentes.

## Evidence on Hand

- `AGENTS.md`: regras de permissão e domínio em vigor e fluxo de trabalho com OpenSpec.
- `openspec/specs`: comportamento esperado de cada capacidade.
- `docs/ARQUITETURA.md`: arquitetura, decisões e pendências institucionais D01–D26.
- `DESIGN.md`: direção visual aprovada e padrões de interface.
- O repositório contém o frontend, o backend, as migrações e a infraestrutura, sem dados reais.

## Product Principles

- Tornar a próxima tarefa e o estado atual evidentes.
- Ajudar a revisar decisões com consequências antes da confirmação.
- Preservar a distinção entre pendência institucional e registro real.
- Reutilizar padrões entre perfis sem expor ações ou dados indevidos.

## Accessibility & Inclusion

Meta técnica de WCAG 2.2 AA, com alvos de toque de pelo menos 44 × 44 px como regra adicional do produto, texto legível, foco visível, navegação por teclado, mensagens claras e layout responsivo. Não haverá testes prévios com usuários mais velhos disponíveis nesta etapa.
