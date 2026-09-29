# Fase 2 — cadastros e mapa

O [roteiro](../ROADMAP_IMPLEMENTACAO.md) cobre residentes, responsáveis legais,
supervisores e quartos. A primeira fatia técnica, o cadastro funcional de
supervisores, foi implementada e [verificada](QA.md) com contas e dados sintéticos.
Ela não depende de definir matrícula, responsável signatário ou capacidade de quarto.
O cadastro funcional não provisiona uma conta de acesso. **A Fase 2 completa ainda
está aberta.**

## Primeira fatia: supervisores

- Gestor local cadastra, consulta e edita um supervisor; o servidor valida campos,
  mantém um ID estável e rejeita alterações com versão desatualizada.
- O cadastro fica no PostgreSQL. A demonstração pública mantém seus registros
  fictícios em memória, separada da API.
- As rotas de gestão exigem sessão local, perfil de gestor e CSRF nas alterações.
  Fora do perfil `local`, o backend continua fechado.
- A identificação institucional, o e-mail e o nome são dados **sintéticos** para
  desenvolvimento. A migração V4 exige identificação única sem diferenciar
  maiúsculas/minúsculas; esse critério é provisório até a AE/TI aprovar o
  dicionário funcional.

O contrato local é `GET /api/v1/supervisores` para listar, `GET
/api/v1/supervisores/{id}` para consultar, `POST /api/v1/supervisores` para criar
e `PUT /api/v1/supervisores/{id}` para editar. O JSON expõe `id`, `name`,
`institutionalId`, `email` e `version`; o `PUT` exige a versão conhecida. Criação
retorna `201`; dados inválidos, ID inexistente, duplicidade e versão obsoleta
retornam respectivamente `400`, `404`, `409` e `409`. Todas as rotas exigem
perfil `gestor`; as mutações também exigem CSRF.

## Segunda fatia: alojamentos, unidades e quartos

**Estado em 29/09/2026: implementada, com aceite técnico local.** O plano aprovado
pelo solicitante foi integrado ao PostgreSQL e ao mapa Angular. O [QA](QA.md)
registra os testes e a prova pelo navegador, incluindo capacidades desconhecidas
e editadas, números locais iguais em localizações diferentes, conflito entre
duas abas sem sobrescrita, reinício com estrutura e sessão preservadas e logout.
O aceite é para desenvolvimento local; não equivale à homologação da AE/TI,
nem encerra E04 ou a Fase 2.

- Alojamentos têm código e nome. Casas/blocos são unidades internas opcionais,
  vinculadas ao alojamento; quarto também pode ter piso, sem obrigá-lo.
- Quarto tem código globalmente único e número local como texto, preservando
  `01`. O número pode repetir em locais distintos, mas não na mesma combinação
  de alojamento, unidade opcional e piso opcional. Duplicidades desconsideram
  espaços nas extremidades e diferenças de maiúsculas/minúsculas; a ausência
  da unidade ou piso é tratada como a mesma localização ausente.
- Capacidade é editável, inteira positiva ou `null`. A interface mostra
  **“Capacidade não definida”** quando ausente e identifica somatórios com
  capacidades ausentes como parciais.
- Disponível, Ocupado, Manutenção e Indisponível são situações manuais. A API
  mantém `occupancy`, `vacancies` e `cleaningScore` como `null`. A interface
  mostra **“Ocupação ainda não integrada”** e **“Sem avaliação”**, sem calcular
  vagas livres ou relacionar situação manual a ocupação.
- O mapa local começa vazio, agrupado por alojamento, unidade opcional e piso
  conhecido. A demonstração permanece independente do backend, com dados
  fictícios em memória. Falha da API local não carrega registros demonstrativos.
- Gestor e supervisor locais consultam a estrutura; somente gestor cadastra e
  edita. Sessão, CSRF nas alterações e bloqueio fora de `local` são mantidos.
  A edição exige `version`; conflito deve ser apresentado sem sucesso falso.
  Exclusão, alocação e transferência não integram esta fatia.

### Contrato local de estrutura

| Recurso               | Rotas                                                                                              | Campos expostos                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Alojamento            | `GET/POST /api/v1/alojamentos`; `GET/PUT /api/v1/alojamentos/{id}`                                 | `id`, `code`, `name`, `version`                                                                                                             |
| Unidade de alojamento | `GET/POST /api/v1/alojamentos/{id}/unidades`; `GET/PUT /api/v1/alojamentos/{id}/unidades/{unitId}` | `id`, `accommodationId`, `code`, `name`, `version`                                                                                          |
| Quarto                | `GET/POST /api/v1/quartos`; `GET/PUT /api/v1/quartos/{id}`                                         | `id`, `code`, `number`, `accommodationId`, `unitId`, `floor`, `capacity`, `situation`, `occupancy`, `vacancies`, `cleaningScore`, `version` |
| Mapa                  | `GET /api/v1/quartos/mapa`                                                                         | Coleções de alojamentos, unidades e quartos, inclusive estruturas sem quartos                                                               |

`unitId`, `floor` e `capacity` podem ser `null`; ocupação, vagas livres e nota
são sempre `null` nesta fatia. O servidor rejeita unidade de outro alojamento,
dados inválidos, duplicidade, ID inexistente e edição com versão obsoleta.
A edição exige a versão do recurso consultado; uma falha não produz confirmação
de gravação. As migrações V1–V4 são preservadas como histórico; V5 cria alojamentos
e unidades, e V6 cria quartos, com JDBC, UUID, versão e timestamps. A versão
inicial é `0` e aumenta após cada edição confirmada. Os campos textuais exigem
strings JSON; números e booleanos não são convertidos silenciosamente em texto.
O mapa é lido em uma transação com snapshot consistente.

Criação retorna `201`; leitura e edição retornam `200`. Erros de domínio expõem
`code` e `message`: `400/invalid_input` para dados inválidos,
`400/invalid_location` para vínculo recusado, `404/not_found` para ID inexistente,
`409/duplicate_code` para código repetido, `409/duplicate_location` para número
de quarto repetido na mesma localização e `409/stale_version` para versão
obsoleta. Sessão inválida retorna `401`; perfil sem permissão ou CSRF ausente
retorna `403`. Esses erros são apresentados sem carregar dados de demonstração
no fluxo local.

### Referências recebidas e divergências abertas

Em 29/09/2026 foram recebidos o PDF
`Controle de Vagas das Residências Estudantis 2026.xlsx - Vagas Residências Est. 2026.pdf`
e o ZIP `RESIDÊNCIAS ESTUDANTIS 2026_1.xlsx.zip`. Apesar do nome, o ZIP contém
sete abas em HTML, sem XLSX. São referências privadas de estrutura e ocupação
parcial, não dados de carga do sistema. O solicitante confirmou que as **300
vagas do PDF são capacidade total**, não vagas livres.

| Referência   | PDF                           | ZIP                                            |
| ------------ | ----------------------------- | ---------------------------------------------- |
| Residência 4 | 64 lugares                    | Capacidades somam 66                           |
| Laticínio    | 8 lugares                     | Capacidades somam 10                           |
| Residência 3 | 12 quartos                    | 5 quartos listados                             |
| R4-21        | —                             | 5 ocupantes listados; capacidade indicada de 4 |
| Zootecnia 3  | 3 quartos × 2, mas total de 8 | —                                              |

As divergências ficam para revisão da AE, sem alterar uma fonte ou escolher
capacidades por inferência. Os arquivos não trazem matrícula, nascimento,
responsáveis legais ou telefones e não resolvem cadastro de residentes,
destinatários de assinatura ou acesso a dados de saúde. Os testes usam somente
dados sintéticos; nomes e dados pessoais dos anexos não entram no Git.

## Decisões para as demais fatias

A [D01](../fase-0/DECISOES.md) define a matriz de permissões; a [D02](../fase-0/DECISOES.md)
define origem, validação e ciclo da matrícula; a [D15](../fase-0/DECISOES.md) define
cardinalidade e prioridade dos responsáveis; a [D19](../fase-0/DECISOES.md) define
capacidade, ocupação e transições dos quartos; e a [D22](../fase-0/DECISOES.md) define
acesso e retenção de dados sensíveis. Elas ainda não têm aprovação registrada.
Em 26/09/2026, o solicitante esclareceu que todos os servidores da GAE, inclusive
profissionais de saúde, devem acessar dados não sensíveis; que responsáveis legais
podem ser detentores da guarda, ambos os pais ou apenas um deles; e que dados
sensíveis devem ficar restritos a profissionais de saúde, com sigilo próprio de
cada profissão. São orientações preliminares, ainda sem matriz de permissões
aprovada. A matrícula é usada no SUAP, mas sua origem e validação no SAGER
continuam indefinidas. Os anexos de alojamentos recebidos em 29/09/2026 permitem
desenvolver a estrutura acima, mas não definem regras de alocação, vínculos de
responsáveis ou acesso sensível. Esses pontos seguem abertos no
[registro de decisões](../fase-0/DECISOES.md).

Até lá, não se deve inferir matrícula do login local, conceder acesso médico,
escolher signatário automaticamente, calcular ocupação a partir de capacidade não
definida ou mostrar nota de limpeza inventada. A conclusão e homologação da Fase 2
dependem dessas regras, da integração das demais telas e de testes com persistência,
permissões e concorrência.

Também continuam abertas entregas da Fase 1: erros padronizados para toda a API,
OpenAPI, auditoria, observabilidade, pipeline de CI e a primeira fatia persistida
de residente. Esta entrega de supervisores não fecha a Fase 1 nem a Fase 2.
