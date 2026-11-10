## Context

A lista completa de telas, linhas e textos está na auditoria reproduzida em `audit.md`, nesta pasta. Ela é a fonte das tarefas.

## Goals / Non-Goals

**Goals**

- Um adolescente ou um idoso entende o que fazer sem ajuda.

**Non-Goals**

- Mudar regra, permissão ou fluxo. Fluxos que mudam estão em outras changes.

## Decisions

### D1. Glossário

| Antes | Depois |
|---|---|
| alocação | quarto ("Tirar do quarto", "No quarto desde") |
| recorte, consulta (relatório) | dados do relatório |
| revisão atual | documento atual |
| evidência | documento, registro |
| registro(s), linhas | registros, ou a palavra do domínio |
| identificação institucional | matrícula |
| confirmada pelo servidor | confirmada |
| sessão (em conflito) | outra pessoa |

*Rejeitada:* trocar "matrícula", "responsável" ou "residente", que são termos que as pessoas já usam.

### D2. Erros

Toda mensagem diz o que aconteceu e o que fazer. 409: "Outra pessoa alterou este registro. Clique em Recarregar, confira e tente de novo." Genérico: "Não deu certo. Verifique a internet e tente de novo."

### D3. Modo real e demonstração

Texto de ambiente de teste é apagado, sem novo condicional: a demonstração tem seu próprio selo.

### D4. Legibilidade

`--text-meta: 1rem`, `small` em formulários com 1rem, caixa de seleção com 28 px. Conferir o layout em 320 px depois, porque colunas estreitas crescem.

### D5. Onde o texto final difere da auditoria

- "Assinar" virou "autorizar" ("Quem vai autorizar?"): depois da troca do Clicksign pelo WhatsApp, o responsável não assina no sistema. A autorização continua sendo "autorização conferida", nunca "assinatura válida".
- A dica de telefone do item 25 não foi aplicada: `validate-registration-fields` tornou o telefone obrigatório.
- "Termo de reincidência" virou "Termo de compromisso", o nome do PRD e dos relatórios.
- O glossário ganhou "Resíduos" → "Lixo", "Vigente" → "Valendo" e "(s)" → singular ou plural certo.
- Fonte: todo `font-size` abaixo de 1rem nas folhas de estilo subiu para 1rem, não só `--text-meta` e `small`, porque a regra do spec vale para todo texto secundário.
- Telas exclusivas da demonstração mantêm o próprio texto.

## Risks / Trade-offs

- **Testes dependem de textos** → atualizar no mesmo grupo, e rodar a suíte inteira no fim.
- **Colisão com outras changes** → aplicar depois de `simplify-report-generation`, `create-supervisor-accounts`, `validate-registration-fields` e WhatsApp.
