## 1. Contador

- [x] 1.1 Contar em "Notificações de ocorrência" só as pendentes e as convertidas que aguardam a conferência de origem corrigida, no servidor e no contador da demonstração. Verificação: `PendingApiIntegrationTest`, com uma notificação visualizada fora da contagem, e o spec do contador da demonstração.

## 2. Evidência

- [x] 2.1 Em `evidenceRows`, esconder as chaves terminadas em `Id` ou `Ids` e `policyVersion`. Dar nome a `assessmentDate`, e mostrar cada critério com o nome da avaliação de limpeza. Verificação: `communications-local.utils.spec.ts`.
- [x] 2.2 Formatar com prettier e validar a change. Verificação: `openspec validate notification-seen-evidence --strict`.
