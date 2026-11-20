## Context

A notificação de ocorrência passa por estas situações: Pendente, Visualizada, Em análise, e depois Convertida ou Arquivada. "Registrar visualização" é um ato explícito do supervisor, auditado. O contador do menu (`pending-badges`) soma Pendente, Visualizada e Em análise.

A evidência mostrada no detalhe é uma cópia do registro de origem no momento da notificação. A da limpeza guarda o quarto pelo identificador interno, a versão da regra e os critérios como objeto. A tela mostra as chaves que não conhece com o próprio nome técnico.

## Goals / Non-Goals

**Goals:**
- O número do menu cai quando o supervisor registra que viu a notificação.
- O detalhe só mostra dados que o supervisor entende.

**Non-Goals:**
- Marcar como vista ao abrir o detalhe.
- Mudar a evidência guardada.

## Decisions

1. **O contador conta só o que ninguém viu ainda, mais a conferência de origem corrigida.** A conferência continua contando porque é um fato novo que pede atenção, mesmo numa notificação já tratada.
   - Alternativa rejeitada: marcar como vista ao abrir o detalhe. Mudaria um registro auditado só por abrir uma tela, e o supervisor perderia o controle sobre "Registrar visualização".
2. **Os campos técnicos saem na tela, e a evidência guardada não muda.** Na tela saem as chaves terminadas em `Id` ou `Ids` e `policyVersion`. Os critérios aparecem com os nomes da avaliação de limpeza.
   - Alternativa rejeitada: trocar a evidência guardada no servidor. Mudaria registros já auditados e a comparação feita quando a origem é corrigida.

## Risks / Trade-offs

- O supervisor que visualiza uma notificação e não decide deixa de ver o número no menu. A notificação continua na lista, com a situação "Visualizada".

## Pendências institucionais

- **Abrir o detalhe já marcar a notificação como vista**, se a Assistência Estudantil preferir.
- **Notificação da limpeza para todos os moradores do quarto**, discutida na reunião sem decisão.
