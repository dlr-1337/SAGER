## Why

O dono e o coautor pediram que "Meu perfil" mostre ao residente o quarto em que ele está alocado, por exemplo "R2 · Quarto 43". Hoje a tela traz só nome, matrícula e perfil, e o residente não tem onde ver o próprio quarto, porque recebe 403 em quartos e alocações (requisito "Cadastros com gestor e supervisor" de `access-control`). O pedido de 14/11/2026 também vale aqui: pouco texto e uma informação clara por linha, para servidores e residentes com pouca prática e para quem tem TDAH.

Afeta a capacidade `resident-allocation` (requisito novo) e a regra do `AGENTS.md` de que o residente só lê o que é seu, que continua valendo: o quarto mostrado é o da própria alocação ativa.

## What Changes

- A consulta da própria conta (`GET /api/v1/auth/me`) passa a trazer o quarto da alocação ativa do residente vinculado: código do alojamento, nome da casa ou bloco (vazio quando o quarto não tem) e número do quarto. Para gestor, supervisor, conta sem vínculo e residente sem alocação ativa, o campo vem nulo.
- "Meu perfil" do residente mostra uma linha com o quarto, abaixo da matrícula: "R2 · Casa 3 · Quarto 43", ou "R2 · Quarto 43" sem casa ou bloco. Sem alocação ativa, nenhuma linha de quarto.
- Ao abrir "Meu perfil", a tela consulta a conta de novo, para mostrar o quarto atual depois de uma transferência feita com a sessão aberta.
- Na demonstração, o perfil residente mostra o quarto que os dados fictícios já dão à residente da demonstração: "Bloco A · Quarto 102".
- O guia de uso (`docs/MANUAL.md`, Residente, item 1) passa a dizer que o perfil mostra o quarto.

**Fora do escopo:** acesso do residente a `/api/v1/quartos`, `/api/v1/alocacoes` e alojamentos, que continua 403; colegas de quarto, andar, capacidade e histórico de alocações no perfil; telas de gestor e supervisor; o texto da página Ajuda, que não descreve o conteúdo do perfil e fica igual; a monografia, que não é editada aqui.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `resident-allocation`: requisito novo "Quarto atual no perfil do residente".

## Impact

- Backend: `AuthController` (resposta de `/auth/me` com o quarto) e `LocalAccountRepository` (consulta da alocação ativa); teste `LocalAccountLinksIntegrationTest`.
- Frontend: `core/local-auth.service.ts` e seu spec, `features/portal/portal.pages.ts` (`ProfilePage`) e `portal.pages.spec.ts`, e2e `local-auth.spec.ts`.
- API: campo novo `quarto` na resposta de `/auth/me`, aditivo; o resto da resposta não muda.
- Documentação: `docs/MANUAL.md` (Residente, item 1) e `docs/ARQUITETURA.md` (autorização: o residente recebe o próprio quarto pela consulta da conta). `AGENTS.md` não muda, porque a regra de acesso do residente não muda.
- Monografia: cap8.tex:142 diz só que "Meu perfil" apresenta os dados do residente; o quarto é acréscimo a citar no texto (ver design.md).
