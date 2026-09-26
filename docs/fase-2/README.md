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

## Decisões para as demais fatias

A [D01](../fase-0/DECISOES.md) define a matriz de permissões; a [D02](../fase-0/DECISOES.md)
define origem, validação e ciclo da matrícula; a [D15](../fase-0/DECISOES.md) define
cardinalidade e prioridade dos responsáveis; a [D19](../fase-0/DECISOES.md) define
capacidade, ocupação e transições dos quartos; e a [D22](../fase-0/DECISOES.md) define
acesso e retenção de dados sensíveis. Elas ainda não têm aprovação registrada. O
solicitante informou que enviará as definições da AE/TI.

Até lá, não se deve inferir matrícula do login local, conceder acesso médico,
escolher signatário automaticamente, calcular ocupação a partir de capacidade não
definida ou mostrar nota de limpeza inventada. A conclusão e homologação da Fase 2
dependem dessas regras, da integração das demais telas e de testes com persistência,
permissões e concorrência.

Também continuam abertas entregas da Fase 1: erros padronizados para toda a API,
OpenAPI, auditoria, observabilidade, pipeline de CI e a primeira fatia persistida
de residente. Esta entrega de supervisores não fecha a Fase 1 nem a Fase 2.
