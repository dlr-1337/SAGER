---
version: 1
slug: "frontend-src-app-features-portal-portal-pages"
primary_target: "frontend/src/app/features/portal/portal.pages.ts"
related_targets: ["frontend/src/app/features/management/residents.component.ts","frontend/src/app/features/operations/exits.component.ts"]
---

# Início e linguagem visual do SAGER

Modo: Operate. Público: gestor, supervisor e residente, incluindo pessoas mais velhas. A tela inicial precisa apontar a próxima ação, preservar estados operacionais e evitar números sem origem. O foco da primeira composição é o painel do supervisor; o mesmo sistema se estende aos demais perfis.

## Direction contract

**THESIS:** Um quadro de trabalho institucional apresenta pendências como linhas claras e acionáveis. Evita o painel padrão de indicadores gigantes e cartões repetidos.

**OWN-WORLD:** Verde profundo para navegação e ações principais, superfícies brancas, cinzas esverdeados discretos, tipografia Open Sans legível e ícones Material Symbols de traço consistente com texto adjacente. A marca oficial do IF Goiano aparece íntegra e separada do nome SAGER.

**STORY:** Ao abrir o SAGER, o supervisor identifica a chamada noturna e as pendências de saídas, retornos e notificações, entende o estado de cada uma e abre a tarefa diretamente.

**FIRST VIEWPORT:** Barra superior verde de identidade e sessão, navegação lateral estreita, título e contexto do dia, faixa de ação da chamada e lista ampla de três pendências com uma ação por linha; coluna de agenda e ajuda à direita. Selo de demonstração sempre visível.

**FORM:** Quadro de tarefas, primeira direção fundamentada; conceito escolhido a partir da composição B. Semente Impeccable `0ebe3857`. A estrutura vence a alternativa sorteada porque atende melhor à legibilidade e à clareza operacional fixadas pelo usuário.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
