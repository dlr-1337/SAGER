# Proposal

## Why

A tela Quartos mostra até 93 quartos numa lista plana de 25 por página, na ordem dos identificadores internos e do número como texto (o quarto 10 vem antes do 2, a "Casa 10" antes da "Casa 2"). Seis filtros sempre abertos ocupam a primeira tela do celular, a legenda só dá nomes, a nota do rodapé e a do detalhe do quarto dizem que a situação é escolhida pelo usuário (falso desde a V28), um quarto sem capacidade aparece "Disponível" embora não receba ninguém e todo quarto exibe "Sem avaliação". A monografia pede o mapa de ocupação dos quartos (RF003, cap4:109; UC16, cap4:264) e diz que quarto em manutenção ou indisponível não recebe alocação (RN15, cap4:170). Na avaliação de usabilidade, um residente não compreendeu bem a parte dos quartos (cap8:41 e :54).

## What Changes

- A tela Quartos passa a ser navegada em níveis: cartões de alojamento, depois cartões de casa ou bloco (quando o alojamento tiver), depois a grade de quartos, com a trilha "Quartos › Vila Estudantil › Casa 3". Os campos Alojamento e Casa ou bloco saem dos filtros. Nenhum endpoint novo: tudo vem do mapa que a tela já carrega.
- Ordem natural (nome e número, "2" antes de "10") aplicada uma vez na leitura do mapa, valendo para o mapa e para toda seleção de alojamento, casa ou bloco e quarto nas outras telas.
- Legenda com as quatro situações explicadas (o que significam e se mudam sozinhas ou são escolhidas) e notas do rodapé e do detalhe do quarto corrigidas.
- **BREAKING (API):** quarto sem capacidade passa a sair como "Indisponível" em `GET /api/v1/quartos`, `GET /api/v1/quartos/{id}` e `GET /api/v1/quartos/mapa`, inclusive no filtro de situação. A alocação nesse quarto continua recusada com o pedido para definir a capacidade. O formulário de quarto sem capacidade pede a situação de novo, e a auditoria só marca a situação como alterada quando a escolha gravada mudar.
- Filtros no painel compartilhado de `simplify-long-lists`: busca sempre visível; Situação e "Só com vagas" recolhíveis; Piso só aparece se algum quarto tiver piso; o filtro Ocupação sai. "Só com vagas" e as vagas livres dos cartões e dos totais contam só quartos que recebem alocação, fora de Manutenção e Indisponível (RN15).
- Paginação de 25 logo depois da grade, antes da nota.
- **BREAKING (API):** o campo `cleaningScore`, sempre nulo, sai do quarto. Saem também a linha "Sem avaliação" do mapa e a "Última nota de limpeza" do detalhe, e o código sem uso (`RoomService.list()` sem filtros e os métodos `list`, `get` e `page` do serviço de quartos do frontend).
- Modo demonstração (RF027, cap4:133): continua, com a grade agrupada por bloco e piso que já tem, sem níveis, capacidade, totais nem "Só com vagas". O filtro Bloco vai para a parte recolhível do painel, os quartos fictícios seguem a mesma ordem natural e a nota de limpeza inventada sai, porque o diagrama de classes de gestão e o DER de contas e gestão (cap4:369 e :461) não têm nota no quarto.

## Capabilities

### New Capabilities

- `room-map`: como gestor e supervisor percorrem os quartos (níveis, trilha, busca e filtros, legenda, situação derivada, paginação) e como a tela fica na demonstração.

### Modified Capabilities

- `room-filters`: "Quarto dependente do alojamento e do bloco" passa a cobrir também a limpeza da casa ou bloco quando o alojamento muda (absorvendo a regra duplicada de `block-filters`), e entra "Ordem natural dos locais", também na demonstração.
- `block-filters`: sai "Cascata de seleção", que repetia a regra de `room-filters`.

## Impact

- Monografia: RF003 e UC16 (mapa de ocupação), RN15 (quarto em manutenção ou indisponível não recebe alocação) e RF027 (demonstração). A legenda explicada e o quarto sem capacidade como Indisponível ainda não estão no texto da RN15; ver as pendências de `design.md`.
- AGENTS.md: gestor e supervisor continuam com as mesmas permissões de leitura e escrita nos quartos; nenhuma regra de permissão muda.
- Frontend: `rooms.component.ts`, `room-api.service.ts`, `housing.models.ts`, `room-form.component.ts`, `room-detail.component.ts`, `management.scss`, os specs e e2e que simulam o mapa. Na demonstração: `management.models.ts`, `management-demo.service.ts`, `reports-demo-api.service.ts` e os testes `management-demo-pagination.spec.ts`, `residents-demo-rooms.spec.ts`, `e2e/management-pagination-demo.spec.ts`, `e2e/route-audit.spec.ts` e `e2e/target-audit.spec.ts`.
- Documentos: `DESIGN.md` (tarefa 4.7) e `docs/ARQUITETURA.md` (linha D19).
- Backend: `RoomRepository`, `RoomService`, `RoomRecord`, `AllocationService` e os testes de integração de quartos e alocações. Sem migração.
- Dependência: implementar depois de `simplify-long-lists`, que cria o painel de filtros e a paginação compartilhados, e de `remove-health-module`. O modo demonstração (RF027) continua: a tela mantém os ramos `isDemo()` (design D13 e D14).

### Fora do escopo

- Endpoint novo, paginação no servidor para o mapa ou cache do mapa (o cache é de `speed-up-navigation`).
- Nota de limpeza real no mapa ou no detalhe do quarto.
- Faixa etária no cartão do alojamento: nenhuma change a planeja; `add-accommodation-age-group` mostra a faixa só no detalhe do quarto.
- Ordem natural na lista da chamada noturna, que vem do servidor.
- Tirar a tela `/alojamentos`, que continua para cadastrar e editar alojamentos e casas.
- Tornar a capacidade obrigatória ou mudar as regras de admissão do quarto.
- Níveis, capacidade e "Só com vagas" na demonstração, cujos quartos fictícios não têm alojamento com casas nem capacidade.
