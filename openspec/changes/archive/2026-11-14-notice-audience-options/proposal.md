## Why

Hoje, para mandar um aviso a todos os moradores ou a um alojamento, o supervisor procura e marca cada residente, um por um, numa lista de todo o cadastro. Com 230 residentes em produção isso é lento e fácil de errar, e o servidor recusa mais de 100 destinatários, então "todos" nem é possível. O dono pediu (14/11/2026) uma escolha simples de quem recebe, dentro da diretriz de telas com pouco texto e um caminho claro. Afeta o requisito "Ciclo do aviso institucional" de `institutional-notices` (RF023, UC22) e a decisão D18 de `docs/ARQUITETURA.md`.

## What Changes

- O formulário do aviso pergunta "Quem recebe?" com seis opções: "Todos os moradores" (residentes com quarto ativo), "Um alojamento", "Um quarto", "Só maiores de 18", "Só menores de 18" e "Escolher pessoas" (a busca e as caixas de hoje).
- Nas opções por idade, entra só quem tem quarto ativo e data de nascimento; a idade segue a data civil de America/Sao_Paulo, calculada pelo servidor.
- Abaixo das opções, "N residentes vão receber"; a lista fica recolhida em "Ver quem vai receber", onde dá para desmarcar alguém.
- A lista é resolvida ao salvar o rascunho e fica fixa, como hoje. A revisão antes de salvar mostra a opção e a quantidade antes dos nomes.
- O limite de destinatários por aviso sobe de 100 para 2.000. O servidor continua recusando lista vazia, repetida ou com residente inexistente. O limite de advertências do termo de compromisso continua 100.

**Fora do escopo:** combinar critérios (por exemplo, alojamento e menores); gravar o critério no banco ou recalcular a lista na publicação; mudar leitura, ciência e versões; remover "Estou ciente" dos avisos (falado na reunião, fica para outra change); mudar a lista de destinatários na tela do aviso salvo; filtros por curso ou etapa; avisos na demonstração (RF027), que continua sem essa tela para o supervisor.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `institutional-notices`: "Ciclo do aviso institucional" passa a aceitar de 1 a 2.000 destinatários, sem repetição; novo requisito "Destinatários por critério".

## Impact

- Backend: `DisciplineInput` (teto da lista de IDs por campo), `CommunicationService.createNotice`, `CommunicationOpenApiConfiguration`; testes `DisciplineApiIntegrationTest` e `ApiFoundationIntegrationTest`. Sem migração.
- Frontend: `notices-local.pages.ts` (`NoticeFormLocalPage`), que passa a usar os filtros já existentes de `GET /api/v1/residentes` (`allocated`, `accommodationId`, `roomId`) e `RoomApiService.map()`; novo `notices-local.pages.spec.ts`; e2e `communications-local.spec.ts`.
- Documentação: `docs/MANUAL.md` (Supervisor, item Avisos) e `docs/ARQUITETURA.md` (D18). `AGENTS.md` não muda: a regra de quem gerencia avisos é a mesma.
