# Proposal

## Why

As residências do IF Goiano são inteiras de menores ou inteiras de maiores de 18 anos, mas o SAGER só guarda isso no texto do nome do alojamento ("Residência 2 · Masculina · menores de 18"). Hoje nada impede colocar um menor numa residência de maiores, a escolha de quarto na ficha do residente lista todos os 93 quartos e a chamada noturna oferece alojamentos só de adultos, que aparecem com zero residentes.

Regras afetadas:

- RF003 e RF019 (cap4.tex:109, :125) e AGENTS.md, "Current Domain Decisions": gestor e supervisor mantêm a estrutura física e as alocações, com as mesmas permissões de leitura e escrita, inclusive movimentações. RN15 (cap4.tex:170) limita a alocação; a faixa etária passa a ser mais um limite.
- RF006, RN02, RN09 e UC05 (cap4.tex:112, :157, :164, :325-329): a chamada noturna é dos menores com alocação ativa, congelados na abertura. Por isso um alojamento de maiores que ainda tenha menor alocado continua na chamada.
- cap4.tex:218: idade e datas civis são calculadas em America/Sao_Paulo com o relógio do servidor.
- cap4.tex:141 e :220: as regras de negócio são políticas locais que aguardam o aceite da AE. Esta mudança acrescenta uma regra local de alocação (a RN20 a acrescentar ao cap. 4) que ainda precisa da confirmação da AE.
- RN16 (cap4.tex:171): toda escrita gera auditoria, com retenção permanente.

## What Changes

- O alojamento ganha a faixa etária opcional: "Menores de 18 anos", "Maiores de 18 anos" ou sem faixa. Gestor e supervisor a definem no cadastro do alojamento.
- O quarto herda a faixa do seu alojamento e a ficha do quarto a mostra. O quarto não tem campo próprio.
- A migração V32 cria a coluna, permite o campo `ageGroup` na auditoria de ACCOMMODATION e preenche os alojamentos atuais pelo texto do nome ("menores de 18" ou "maiores de 18").
- Colocar ou transferir um residente para um quarto de outra faixa passa a ser recusado com 409 `age_group_mismatch`. Sem data de nascimento, num alojamento com faixa, a recusa é 409 `birth_date_required`.
- Quem faz 18 anos num quarto de menores continua lá. Mudar a faixa de um alojamento também não move ninguém.
- Na ficha do residente, a escolha de quarto lista só quartos da faixa dele e quartos de alojamentos sem faixa.
- O seletor da chamada noturna lista os alojamentos de menores, os sem faixa e os de maiores que ainda tenham menor alocado (RF006, RN02). Um alojamento que virou "Maiores" com um menor dentro continua na chamada, que abre com esse menor e fecha.
- Modo demonstração (RF027): continua, e o código dele não muda. O formulário e o detalhe do alojamento são os mesmos na demonstração, então o campo aparece nela, e a faixa já fica em memória (`AccommodationDataService.save` copia `...input`). As fichas do quarto e do residente e a chamada noturna da demonstração não mostram a faixa, e a ficha do residente da demonstração não tem escolha de quarto.

**Fora do escopo:**

- Sexo da residência (masculina ou feminina): não existe no residente e ninguém pediu agora.
- Faixa por quarto ou por casa: os dados reais são homogêneos por residência.
- Aviso ou encerramento automático quando o morador completa 18 anos.
- Filtro por faixa etária nas listas de residentes e no mapa de quartos. A navegação do mapa fica com `simplify-room-browsing`.
- A exigência de data de nascimento de todos os alocados ao abrir a chamada noturna continua como está.
- Módulo de saúde, que sai na mudança `remove-health-module`.

## Capabilities

### New Capabilities

- `accommodation-age-group`: faixa etária do alojamento, que o quarto herda, e seus efeitos na alocação, na escolha de quarto do residente e no seletor da chamada noturna. O nome segue o lugar onde a regra mora: o alojamento, mesmo termo da API `/alojamentos` e das telas.

### Modified Capabilities

Nenhuma. As specs `room-filters` e `block-filters` tratam da cascata alojamento, bloco e quarto nos filtros operacionais e não mudam.

## Impact

- Banco: `V32__accommodation_age_group.sql`, a próxima depois da V31 de `track-course-conclusion`.
- Backend: o cadastro de alojamento (`Accommodation`, `AccommodationRepository`, `AccommodationService`, `AccommodationController`), `AuditResource`, `OpenApiConfiguration`, a admissão em `AllocationService` e `AllocationRepository`, a regra de menoridade em `FieldRules`, e as opções em `NightCallRepository`, com a data civil de hoje passada por `context()` e `open()` de `NightCallService`.
- API: `ageGroup` (`MENORES`, `MAIORES` ou `null`) no corpo e na resposta de `/api/v1/alojamentos` e em `/api/v1/quartos/mapa`. Novos códigos 409 em `/api/v1/alocacoes`. `/api/v1/chamadas/contexto` deixa de listar alojamentos de maiores sem menor alocado.
- Frontend: `housing.models.ts`, os guards de `room-api.service.ts` e `accommodation-api.service.ts`, o formulário e o detalhe do alojamento, o detalhe do quarto, a ficha do residente e as mensagens de `allocation-api.service.ts`. Na demonstração, só um teste novo em `accommodation-data.service.spec.ts`.
- Arquivos compartilhados com outras mudanças da mesma onda: `AllocationService`, `AllocationRepository`, `AllocationApiIntegrationTest`, `resident-detail.component.ts`, `room-detail.component.ts`, `rooms-local.component.spec.ts` e `allocation-api.service.ts` com `track-course-conclusion`; `FieldRules` e `FieldRulesTest` com `hide-exits-for-adults`, que define `FieldRules.minor(LocalDate, Instant)`; `room-detail.component.ts` também com `simplify-room-browsing`.
- AGENTS.md ganha a regra de faixa etária em "Current Domain Decisions".
