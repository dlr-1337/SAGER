# Proposal

## Why

A tela Quartos mostra até 93 quartos numa lista plana de 25 por página, na ordem dos identificadores internos e do número como texto (o quarto 10 vem antes do 2, a "Casa 10" antes da "Casa 2"). Seis filtros sempre abertos ocupam a primeira tela do celular, a legenda só dá nomes, a nota do rodapé diz que a situação é escolhida pelo usuário (falso desde a V28), um quarto sem capacidade aparece "Disponível" embora não receba ninguém e todo quarto exibe "Sem avaliação". O PRD pede o contrário em E04/RF003 e no critério AC11: "mapa principal agrupado por alojamento, unidade opcional e piso conhecido, com legenda visível".

## What Changes

- A tela Quartos passa a ser navegada em níveis: cartões de alojamento, depois cartões de casa ou bloco (quando o alojamento tiver), depois a grade de quartos, com a trilha "Quartos › Vila Estudantil › Casa 3". Os campos Alojamento e Casa ou bloco saem dos filtros. Nenhum endpoint novo: tudo vem do mapa que a tela já carrega.
- Ordem natural (nome e número, "2" antes de "10") aplicada uma vez na leitura do mapa, valendo para o mapa e para toda seleção de alojamento, casa ou bloco e quarto nas outras telas.
- Legenda com as quatro situações explicadas (o que significam e se mudam sozinhas ou são escolhidas) e nota do rodapé corrigida.
- **BREAKING (API):** quarto sem capacidade passa a sair como "Indisponível" em `GET /api/v1/quartos`, `GET /api/v1/quartos/{id}` e `GET /api/v1/quartos/mapa`, inclusive no filtro de situação. A alocação nesse quarto continua recusada com o pedido para definir a capacidade. O formulário de quarto sem capacidade pede a situação de novo, e a auditoria só marca a situação como alterada quando a escolha gravada mudar.
- Filtros no painel compartilhado de `simplify-long-lists`: busca sempre visível; Situação e "Só com vagas" recolhíveis; Piso só aparece se algum quarto tiver piso; o filtro Ocupação sai.
- Paginação de 25 logo depois da grade, antes da nota.
- **BREAKING (API):** o campo `cleaningScore`, sempre nulo, sai do quarto. Saem também a linha "Sem avaliação" do mapa e a "Última nota de limpeza" do detalhe, e o código sem uso (`RoomService.list()` sem filtros e os métodos `list`, `get` e `page` do serviço de quartos do frontend).

## Capabilities

### New Capabilities

- `room-map`: como gestor e supervisor percorrem os quartos (níveis, trilha, busca e filtros, legenda, situação derivada, paginação).

### Modified Capabilities

- `room-filters`: "Quarto dependente do alojamento e do bloco" passa a cobrir também a limpeza da casa ou bloco quando o alojamento muda (absorvendo a regra duplicada de `block-filters`), e entra "Ordem natural dos locais".
- `block-filters`: sai "Cascata de seleção", que repetia a regra de `room-filters`.

## Impact

- PRD: E04/RF003/UC16 e AC11 (mapa agrupado com legenda visível). A tabela de telas do PRD cita "nota" no mapa; a linha sai porque nunca mostrou nota real.
- AGENTS.md: gestor e supervisor continuam com as mesmas permissões de leitura e escrita nos quartos; nenhuma regra de permissão muda.
- Frontend: `rooms.component.ts`, `room-api.service.ts`, `housing.models.ts`, `room-form.component.ts`, `room-detail.component.ts`, `management.scss`, os specs e e2e que simulam o mapa e `DESIGN.md`.
- Backend: `RoomRepository`, `RoomService`, `RoomRecord`, `AllocationService` e os testes de integração de quartos e alocações. Sem migração.
- Dependência: implementar depois de `simplify-long-lists`, que cria o painel de filtros e a paginação compartilhados. `remove-demo-mode` e `remove-health-module` já terão saído; nada aqui trata da demonstração nem da saúde.

### Fora do escopo

- Endpoint novo, paginação no servidor para o mapa ou cache do mapa (o cache é de `speed-up-navigation`).
- Nota de limpeza real no mapa ou no detalhe do quarto.
- Faixa etária no cartão do alojamento (é de `add-accommodation-age-group`) e ordem natural na lista da chamada noturna, que vem do servidor.
- Tirar a tela `/alojamentos`, que continua para cadastrar e editar alojamentos e casas.
- Tornar a capacidade obrigatória ou mudar as regras de admissão do quarto.
