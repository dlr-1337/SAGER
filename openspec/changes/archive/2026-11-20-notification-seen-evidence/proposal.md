## Why

O resumo da reunião de 20/11/2026 pede para "corrigir as notificações de ocorrência". Na transcrição, Guilherme aponta duas coisas.

- **01:38:** "quando a notificação for vista, sumir". Hoje o contador de "Notificações de ocorrência" continua contando a notificação depois de "Registrar visualização" e de "Iniciar análise". Ele só cai quando a notificação é convertida em advertência ou arquivada. No print da reunião, o menu mostrava 17.
- **01:40:** "tá aparecendo até o ID do bicho … Policy version". O detalhe da notificação vinda da avaliação de limpeza mostra o código interno do quarto (`roomId`), a versão da regra (`policyVersion`) e os critérios como "Detalhes registrados na origem". Isso contraria `plain-language`, "Sem identificadores técnicos na tela".

## What Changes

- **O contador de "Notificações de ocorrência" passa a contar:**
  - as notificações pendentes, ainda não vistas;
  - a notificação convertida cuja origem foi corrigida e espera conferência, como hoje.
- **O contador deixa de contar** as notificações "Visualizada" e "Em análise". Elas continuam na lista e no filtro.
- **O detalhe da notificação não mostra mais:**
  - campos internos da origem, cujo nome termina em `Id` ou `Ids`;
  - a versão da regra.
- **Na limpeza, o detalhe passa a mostrar:**
  - "Data da avaliação";
  - "Nota de limpeza";
  - uma linha para cada critério, com o nome usado na avaliação ("Piso", "Superfícies", "Lixo", "Organização") e a nota.

Requisitos afetados:
- `pending-badges`: "Contador no menu do supervisor".
- `plain-language`: "Sem identificadores técnicos na tela".

Fora do escopo:
- **Mudar as situações da notificação ou a ação "Registrar visualização".** Abrir o detalhe continua sem marcar a notificação como vista.
- **O contador do residente.** Ele conta o que espera a ciência dele, e a reunião não pediu mudança.
- **A regra que manda a notificação da limpeza a todos os moradores do quarto.** Otávio a defendeu na reunião (01:40), e a mudança não foi decidida.
- **O registro da evidência no servidor e na auditoria.** Os campos internos continuam guardados lá.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `pending-badges`: a notificação vista sai do contador.
- `plain-language`: o detalhe da notificação não mostra campos internos da origem.

## Impact

- **Backend:**
  - `pending/PendingService.java`: contagem das notificações;
  - teste `PendingApiIntegrationTest`.
- **Frontend:**
  - `features/communications/communications-local.utils.ts` (`evidenceRows`);
  - o spec `communications-local.utils.spec.ts`;
  - o contador da demonstração (`pending-badges-demo`), se ele contar as visualizadas.
- **API e banco:** sem mudança de formato nem migração.
