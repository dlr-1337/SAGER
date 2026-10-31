## Why

Listas longas mostram um campo separado "Buscar", acima da lista, e duas caixas para um mesmo dado confundem quem tem pouca prática. O dono do produto pediu a busca dentro da própria lista: clicar no campo, digitar e escolher.

## What Changes

- `sagerSearchable` passa a abrir um painel próprio com busca e opções, ancorado no `select`, sem campo separado.
- O `select` nativo continua sendo o valor real do formulário, então os formulários existentes não mudam.
- O curso do residente troca a busca própria pela diretiva, e a opção vazia passa a "Selecione o curso".
- Listas pequenas continuam com a lista nativa.

**Rejeitado:** `MatAutocomplete` em cada campo, porque exigiria reescrever cada formulário e o projeto não tem tema Material.

**Fora do escopo:** seleção múltipla.

## Capabilities

### New Capabilities

- `searchable-select`: busca dentro de listas longas de seleção.

### Modified Capabilities

Nenhuma.

## Impact

`shared/searchable-select.directive.ts`, seu spec, estilos globais, `resident-form` e testes que usam "Buscar opções". Playwright continua usando `selectOption`, pois o `select` nativo permanece.
