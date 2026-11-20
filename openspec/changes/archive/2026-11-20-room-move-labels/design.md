## Context

O formulário de quarto do detalhe do residente tem um campo de seleção com busca, o botão principal e "Tirar do quarto". O nome do campo vem do rótulo, e a busca usa esse nome ("Buscar em …").

## Goals / Non-Goals

**Goals:**
- Cada controle diz o que faz, sem repetir "mudar".

**Non-Goals:**
- Mudar o fluxo da alocação.

## Decisions

1. **O campo pede a escolha, e o botão confirma.** O campo se chama "Selecione o novo quarto" ou "Selecione um quarto", e o botão, "Confirmar mudança" ou "Colocar no quarto". São as palavras sugeridas na reunião.
   - Alternativa rejeitada: só "Mudar" no botão. Cristiane aceitou essa opção ("ou eh mudar até que vai"), mas preferiu "Confirmar mudança", que diz o efeito.
2. **A primeira opção passa a "Escolha na lista".** Com o campo chamado "Selecione…", repetir a mesma frase na primeira opção é redundante.
   - Alternativa rejeitada: opção vazia. Os leitores de tela anunciariam uma opção sem nome.

## Risks / Trade-offs

- Os testes e o manual que citam os nomes antigos precisam mudar junto.

## Pendências institucionais

Nenhuma.
