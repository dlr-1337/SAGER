# SAGER — contexto do produto

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Angular 22, Angular Material/CDK e SCSS no frontend. O backend futuro será Java com Spring Boot, conforme a especificação técnica v2.0.

## Users

- Gestores da Assistência Estudantil administram residentes, responsáveis, supervisores e quartos e acompanham relatórios.
- Supervisores têm autoridade operacional máxima e podem gerir os mesmos cadastros,
  conforme decisão do solicitante em 30/09/2026. O perfil geral não concede acesso médico.
- Supervisores registram a chamada, acompanham saídas e retornos, analisam notificações, registram advertências e avaliam a limpeza.
- Residentes consultam informações próprias, avisos e ranking; menores de idade solicitam saídas.
- Responsáveis legais revisam e assinam autorizações de saídas longas por um acesso individual, sem painel institucional.
- Pessoas mais velhas usarão a plataforma; tarefas essenciais precisam ser claras, legíveis e fáceis de acionar.

## Product Purpose

Substituir controles residenciais em papel por processos digitais rastreáveis para o Campus Urutaí. O sistema reúne cadastros, quartos, chamada noturna, saídas, retornos, comunicação, limpeza e relatórios sem automatizar decisões disciplinares.

## Operating Context

Plataforma web responsiva de uso institucional no IF Goiano, em computador e celular. A Assistência Estudantil define as regras operacionais e a TI fornece autenticação e infraestrutura. A primeira etapa de desenvolvimento é um protótipo navegável de todas as telas, com dados sintéticos e sem integrações reais.

## Capabilities and Constraints

- As funcionalidades e critérios de aceite estão no PRD v2.0; a arquitetura de referência está na Especificação Técnica v2.0.
- Chamada e solicitações formais de saída se aplicam a residentes menores de idade. Saída curta dura no máximo três horas. Saída longa exige assinatura válida do responsável antes de aprovação. Retorno curto é confirmado presencialmente pelo supervisor.
- Alertas internos não são advertências e não geram sanções automáticas. Ler um aviso é diferente de marcar ciência.
- O login próprio do SAGER foi escolhido em 30/09/2026; integrações SUAP/Google ficam
  adiadas. O cadastro é manual e a data de nascimento obrigatória. Para saída longa,
  uma assinatura válida de qualquer responsável cadastrado e vinculado é suficiente.
- Dados de saúde podem ser compartilhados entre profissionais de saúde, respeitado
  o sigilo profissional; a auditoria terá retenção permanente. WhatsApp, modalidade
  e evidências de assinatura, regras de limpeza/ranking e métricas de comportamento
  continuam com decisões abertas no PRD. As regras futuras ainda exigem implementação.
- O protótipo pode simular ações, mas não deve apresentar autenticação, assinatura, exportação ou dados operacionais como reais.

## Brand Commitments

Preservar o nome SAGER, a referência ao IF Goiano — Campus Urutaí e o verde institucional. A marca oficial do IF Goiano deve ser usada sem alteração, conforme o manual institucional. A identidade da interface será modernizada a partir dos protótipos existentes.

## Evidence on Hand

- `SAGER_PRD_v2.0_Angular_SpringBoot.md`: 15 épicos, 72 critérios de aceite e pendências D01–D26.
- `SAGER_Especificacao_Tecnica_v2.0.md`: arquitetura Angular/Material e contratos técnicos.
- `SAGER_Corrigido.docx`: SRS original e protótipos demonstrativos. Os números e alguns fluxos dos protótipos não são autoridade sobre o PRD.
- Não há código de aplicação nem dados reais no repositório.

## Product Principles

- Tornar a próxima tarefa e o estado atual evidentes.
- Ajudar a revisar decisões com consequências antes da confirmação.
- Preservar a distinção entre dado demonstrativo, pendência institucional e registro real.
- Reutilizar padrões entre perfis sem expor ações ou dados indevidos.

## Accessibility & Inclusion

Meta técnica de WCAG 2.2 AA, com alvos de toque de pelo menos 44 × 44 px como regra adicional do produto, texto legível, foco visível, navegação por teclado, mensagens claras e layout responsivo. Não haverá testes prévios com usuários mais velhos disponíveis nesta etapa.
