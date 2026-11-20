## Why

Na reunião de 20/11/2026 (00:33), Cristiane estranhou a palavra "mudar" repetida na troca de quarto, no campo "Mudar para" e no botão "Mudar de quarto". Nas palavras dela: "Eu não colocaria mudar e mudar nos dois." O que foi combinado: o campo pede para selecionar o quarto, e o botão confirma a mudança.

## What Changes

No detalhe do residente, em "Quarto atual":

- **Residente que já tem quarto:**
  - o campo passa a se chamar "Selecione o novo quarto";
  - o botão passa a "Confirmar mudança";
  - a mensagem de espera passa a "Salvando…".
- **Residente sem quarto:**
  - o campo passa a "Selecione um quarto";
  - o botão continua "Colocar no quarto".
- **Primeira opção da lista:** passa de "Selecione um quarto" a "Escolha na lista", para não repetir o nome do campo.
- **`docs/MANUAL.md`:** o passo "Alocação" do gestor e do supervisor passa a usar os nomes novos.

Fora do escopo:
- Regras de alocação, transferência e encerramento (`resident-allocation`).
- "Tirar do quarto" e a confirmação dele.
- A tela de Quartos. Na reunião, Cristiane aceitou trocar de quarto pelo residente: "Então eu sempre vou entrar pelo residente".

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `resident-allocation`: novo requisito "Nomes da troca de quarto".

## Impact

- Frontend: `features/management/resident-detail.component.ts`.
- Testes:
  - `features/management/residents-local.component.spec.ts`;
  - `e2e/allocations-local.spec.ts`.
- Documentação: `docs/MANUAL.md`.
- API, banco e demonstração: sem mudança.
