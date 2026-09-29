# Fase 0 — login local provisório

**Decisão de 26/09/2026:** usar e-mail e senha própria do SAGER somente para
desenvolvimento e teste. O mecanismo institucional da [D21](DECISOES.md) permanece
indefinido. Este contrato permite avaliar a integração Angular–Spring Boot e a sessão;
não identifica servidor ou estudante institucional e não homologa AC01/AC02, AT03 nem
a Fase 0. A [prova Google OIDC anterior](AUTENTICACAO_GOOGLE.md) é histórica.

## Contas e acesso

- Um operador cria, redefine a senha ou desativa contas pela linha de comando local.
  Não há cadastro público nem endpoint de concessão de perfil.
- Cada conta tem UUID, nome, e-mail único normalizado, hash de senha, estado ativo e
  um perfil de teste (`gestor`, `supervisor` ou `residente`). O e-mail é identificador
  de login local, não atestado de vínculo institucional; seu domínio não concede acesso.
- A senha da conta provisionada é digitada de forma oculta e nunca entra em
  argumentos, arquivos do Git, logs ou respostas HTTP. As senhas sintéticas das
  fixtures de teste são apenas dados de teste. A aplicação armazena apenas o hash.
  Desativar a conta deve
  impedir novos logins e o uso de sessões existentes.
- O perfil local só pode estar ativo no ambiente `local`, com o servidor vinculado a
  `127.0.0.1`. Fora desse ambiente, o acesso falha fechado até ser definido e
  implementado o provedor institucional. Dados de residentes reais não entram na prova.

## Contrato HTTP

| Operação                   | Requisição                                                                         | Resultado                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/auth/csrf`    | Anônima ou autenticada                                                             | `200` com `headerName`, `parameterName` e `token`.                                                               |
| `POST /api/v1/auth/login`  | `application/x-www-form-urlencoded` com `email` e `password`, mais cabeçalho CSRF. | `204` e sessão no sucesso; `401` genérico para credenciais inválidas ou conta desativada; `403` sem CSRF válido. |
| `GET /api/v1/auth/me`      | Sessão válida.                                                                     | `200` com o perfil local atualizado; `401` sem sessão ou após desativação.                                       |
| `POST /api/v1/auth/logout` | Sessão e cabeçalho CSRF.                                                           | `204`, invalida a sessão; requisição sem CSRF é negada.                                                          |

Exemplo sintético de `/api/v1/auth/me`:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "nome": "Pessoa de Teste",
  "email": "pessoa@exemplo.invalid",
  "fotoUrl": null,
  "perfis": ["residente"]
}
```

A sessão fica no PostgreSQL com Spring Session JDBC, dura 30 minutos de inatividade
por padrão e usa cookie `HttpOnly` e `SameSite=Lax`. `Secure=false` vale somente
para HTTP no loopback local. O Angular obtém um novo token CSRF conforme necessário,
consulta `/me` após o login e ao recarregar, e não guarda senha ou cookie em
`localStorage`/`sessionStorage`. A autorização de recursos e registros de domínio
ainda pertence às próximas fatias da Fase 1.

## Demonstração e critérios de aceite técnico

`/acesso` apresenta o login local; `/demonstracao` continua pública e entra
explicitamente no modo fictício, com seleção de perfil própria. As telas de domínio
ainda usam registros de exemplo. A escolha de perfil da demonstração não concede
acesso à API. Nas rotas internas, a interface exige sessão local válida ou entrada
explícita na demonstração; o backend é a fonte do perfil de uma sessão autenticada.

O aceite técnico exige: migração aplicada em banco vazio e existente; criação, troca
de senha e desativação de conta sintética; login válido e inválido; CSRF; `/me` antes
e depois do logout; revogação após desativação; recarga da interface; modo de
demonstração sem backend; build e testes automatizados. Registrar comandos e
resultados em [QA.md](QA.md), sem senha, cookie, e-mail real ou dados pessoais.

**Resultado em 26/09/2026:** a suíte automatizada e a prova manual integrada com
PostgreSQL, backend e navegador reais passaram. O [QA](QA.md) registra os cenários,
as limitações e o aceite técnico restrito a desenvolvimento/teste.

Para fechar D21 e homologar a Fase 0, a TI/AE ainda precisarão escolher e aprovar o
mecanismo institucional, confirmar atributos e provisionamento, definir sessão e
desligamento, executar as jornadas reais e registrar aceite nominal com data e
referência. O login provisório não substitui essas etapas.
