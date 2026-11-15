## Context

Motivação em proposal.md. Estado atual, conferido no código:

- **Tela de cursos.** `courses.page.ts` tem o seletor de nível e o campo "Duração (anos)", com validadores que valem para curso novo ou com nome, nível ou duração alterados. O curso antigo sem nível nem duração pode ser ativado ou desativado.
- **Novo curso no cadastro de residente.** `resident-form.component.ts` repete os dois campos e cria o curso pela API.
- **Demonstração.** As duas telas servem à demonstração e ao acesso por conta.
- **Servidor.** Aceita duração de 1 a 6 anos em qualquer nível.
- **Efeito da duração.** Ela entra no cálculo da etapa e da conclusão do residente. A rotina diária encerra a alocação de quem fica concluído.

## Goals / Non-Goals

**Goals:** o curso médio novo fica com 3 anos sem o usuário digitar.

**Non-Goals:** mudar o servidor ou os cursos salvos.

## Decisions

### D1. A tela preenche e esconde a duração do ensino médio

Ao escolher "Ensino médio", a tela grava 3 no campo e o esconde. Ao trocar para "Superior", o campo volta vazio, para a duração ser escolhida de propósito. O valor enviado à API continua em `durationYears`, sem campo novo.

*Rejeitadas:*

- deixar o campo à vista e só desabilitado, o que é mais texto na tela sem decisão a tomar (`simple-screens`);
- manter 3 ao trocar para superior, porque um curso superior ficaria com 3 anos sem ninguém escolher.

### D2. Curso médio antigo com outra duração

Na edição de um curso médio salvo com duração diferente de 3, o campo aparece com o valor salvo e nada muda sozinho.
*Rejeitada:* forçar 3 em toda edição de curso médio. Uma simples troca de nome mudaria a conclusão dos residentes, e a rotina diária poderia encerrar alocações de quem ainda estuda.

### D3. Servidor sem regra nova

O servidor continua aceitando de 1 a 6 anos para os dois níveis.
*Rejeitada:* recusar no servidor curso médio com duração diferente de 3. Travaria a edição de cursos antigos e não há decisão institucional sobre cursos médios de outra duração.

## O que a instituição e o operador ainda decidem

- A instituição confirma se há curso de ensino médio com duração diferente de 3 anos. Se houver, o gestor edita a duração desse curso.
