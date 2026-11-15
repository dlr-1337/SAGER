## Why

Na reunião de 14/11/2026, o dono e o coautor decidiram que o curso de ensino médio dura 3 anos, sem o usuário precisar informar. Hoje a tela de cursos e o "Novo curso" do cadastro de residente pedem a duração para os dois níveis (requisito "Nível e duração do curso" de `registration-validation`), e quem cadastra pode errar a duração de um curso médio. A duração define a etapa, a saída prevista e a conclusão do residente (`course-progress`), por isso um erro ali fecha a alocação de quem ainda estuda.

Afeta a regra do `AGENTS.md` de que curso novo exige nível e duração de 1 a 6 anos, que continua valendo: a tela só preenche os 3 anos no ensino médio.

## What Changes

- Na tela de cursos e no "Novo curso" do cadastro de residente, inclusive na demonstração, escolher "Ensino médio" preenche a duração com 3 anos e esconde o campo.
- Trocar para "Superior" mostra o campo vazio, para o usuário informar de 1 a 6 anos.
- O curso de ensino médio já salvo com outra duração abre a edição com o campo à vista e a duração salva, sem trocar o valor sozinho.
- O guia de uso (`docs/MANUAL.md`) diz que o ensino médio tem 3 anos.

**Fora do escopo:**

- Recusa no servidor de curso médio com outra duração. O servidor continua aceitando de 1 a 6 anos, para não travar cursos antigos.
- Mudança nos cursos já salvos.
- A monografia, que o dono ajusta à parte.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `registration-validation`: requisito novo "Duração do ensino médio".

## Impact

- Frontend: `features/management/courses.page.ts`, `resident-form.component.ts` e seus specs. E2E `enrollment-catalog-recovery.spec.ts` e `residents-local.spec.ts`, que hoje digitam a duração depois de escolher ensino médio.
- Backend, API e banco: sem mudança.
- Documentação: `docs/MANUAL.md`, item de cursos do gestor.
