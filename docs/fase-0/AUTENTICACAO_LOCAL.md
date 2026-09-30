# Fase 0 — contrato do login próprio do SAGER

**Decisão atual, 30/09/2026:** o SAGER usará contas próprias com e-mail e senha.
Integrações com Google e SUAP foram adiadas. A [D21](DECISOES.md) registra essa
escolha e as condições ainda abertas para operação institucional. A
[prova Google OIDC anterior](AUTENTICACAO_GOOGLE.md) permanece apenas como
evidência histórica.

**Estado da implementação:** existe um login próprio funcional para
desenvolvimento/teste, ativado somente no perfil `local` e vinculado ao loopback.
O ambiente fora de `local` nega o acesso. Para operação real, ainda faltam
configuração segura de implantação, provisionamento e recuperação de contas,
política de sessão e desligamento, autorização completa por registro, testes no
ambiente de destino e aceite da TI/AE. A escolha do mecanismo próprio não comprova
sozinha AC01/AC02, AT03 ou a homologação da Fase 0.

## Contas e acesso implementados no ambiente local

- Um operador cria, redefine a senha, desativa ou vincula contas pela linha de comando local.
  Não há cadastro público nem endpoint de concessão de perfil.
- Cada conta tem UUID, nome, e-mail único normalizado, hash de senha, estado ativo e
  um perfil local (`gestor`, `supervisor` ou `residente`). O e-mail identifica a
  conta SAGER; seu domínio não concede perfil nem comprova matrícula ou vínculo
  acadêmico. Cadastro de residente e conta de acesso são processos separados.
- A senha da conta provisionada é digitada de forma oculta e nunca entra em
  argumentos, arquivos do Git, logs ou respostas HTTP. As senhas sintéticas das
  fixtures de teste são apenas dados de teste. A aplicação armazena apenas o hash.
  Redefinir a senha revoga as sessões existentes. A desativação impede novos
  logins e também revoga as sessões locais existentes.
- O perfil `local` exige `server.address` de loopback. Fora dele, a cadeia de
  segurança nega todas as requisições até existir configuração de produção do
  login próprio implementada e verificada. Não há exigência de provedor externo
  para esta escolha, e nenhum dado real de residente participa da prova local.

## Vínculo explícito entre conta e cadastro

A migração V12 acrescenta vínculos opcionais com os registros de residentes e
supervisores. O operador usa `--sager-account=link-resident` com `--resident-id`
ou `--sager-account=link-supervisor` com `--supervisor-id`, além do e-mail da
conta já provisionada. Ambos exigem conta ativa e UUID de registro existente.
O vínculo de residente exige perfil `residente`; o de supervisor aceita
`gestor` ou `supervisor`. Uma conta possui no máximo um vínculo, de um desses
tipos, e um registro pode ser ligado a somente uma conta.

Criar ou editar o cadastro não provisiona conta, não altera perfil e não associa
automaticamente por nome, e-mail ou matrícula. Contas existentes antes da V12
continuam com vínculo `null` e podem fazer login local. Um vínculo de residente
não libera as APIs de gestão nem implementa as futuras permissões por registro.

`--sager-account=unlink` exige `--record-id` correspondente ao vínculo atual e
admite conta desativada sem reativá-la. Alterar ou remover o vínculo revoga as
sessões existentes; repetir o mesmo vínculo preserva as sessões. O servidor
confere conta ativa, perfil e IDs vinculados a cada requisição, recusando sessões
que ainda tenham o vínculo anterior. Os comandos exigem somente o perfil
`local` e não iniciam servidor HTTP. O
[guia do backend](../../backend/README.md) contém os comandos completos.

## Contrato HTTP local

| Operação                   | Requisição                                                                         | Resultado                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/auth/csrf`    | Anônima ou autenticada                                                             | `200` com `headerName`, `parameterName` e `token`.                                                               |
| `POST /api/v1/auth/login`  | `application/x-www-form-urlencoded` com `email` e `password`, mais cabeçalho CSRF. | `204` e sessão no sucesso; `401` genérico para credenciais inválidas ou conta desativada; `403` sem CSRF válido. |
| `GET /api/v1/auth/me`      | Sessão válida.                                                                     | `200` com a conta, perfil e IDs vinculados; `401` sem sessão válida, após revogação ou com vínculo antigo.       |
| `POST /api/v1/auth/logout` | Cabeçalho CSRF.                                                                    | `204`, invalida a sessão se existir; requisição sem CSRF válido é negada.                                        |

Exemplo sintético de `/api/v1/auth/me`:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "nome": "Pessoa de Teste",
  "email": "pessoa@exemplo.invalid",
  "fotoUrl": null,
  "perfis": ["residente"],
  "residenteId": "00000000-0000-4000-8000-000000000002",
  "supervisorId": null
}
```

`id` identifica a conta; `residenteId` e `supervisorId` identificam cadastros e
podem ser `null`. Esses IDs não são matrícula e não comprovam vínculo acadêmico.

Os erros de domínio e de segurança usam JSON com `code`, `message` e `requestId`:
`401/unauthorized` para sessão inválida, `401/invalid_credentials` para login
recusado, `403/forbidden` para perfil sem permissão e `403/csrf_invalid` para
CSRF ausente ou inválido. O UUID da requisição é gerado pelo servidor, aparece
também em `X-Request-Id` e permite correlacionar os logs sem expor credenciais
ou valores pessoais. Não há redirecionamento para uma página HTML de login
nessas falhas da API. O [contrato da fundação](../fase-1/FUNDACAO.md) descreve
o OpenAPI e a observabilidade locais.

A sessão local fica no PostgreSQL com Spring Session JDBC, dura 30 minutos de inatividade
por padrão e usa cookie `HttpOnly` e `SameSite=Lax`. `Secure=false` vale somente
para HTTP no loopback local. O Angular obtém um novo token CSRF conforme necessário,
consulta `/me` após o login e ao recarregar, e não guarda senha ou cookie em
`localStorage`/`sessionStorage`. A API local protege por perfil os recursos de
gestão já integrados; gestor e supervisor possuem as mesmas operações nesses
recursos. As regras futuras por vínculo e registro ainda precisam ser
implementadas nas fatias correspondentes.

## Demonstração, prova técnica e saída para operação real

`/acesso` apresenta o login local; `/demonstracao` continua pública e entra
explicitamente no modo fictício, com seleção de perfil própria. A escolha de
perfil da demonstração não concede acesso à API. Uma falha da API local não
substitui registros persistidos por dados fictícios. As operações fora das fatias
integradas continuam demonstrativas.

O [QA da Fase 0](QA.md) registra a prova técnica de 26/09/2026 com PostgreSQL,
backend e navegador reais: provisionamento sintético, login, CSRF, `/me`, logout,
desativação, recarga da interface e demonstração isolada. Essa prova é histórica
e restrita ao ambiente local; as mudanças posteriores de permissões e cadastro
têm sua própria validação.

Para liberar o mecanismo escolhido fora de `local`, a equipe deve implementar
configuração de implantação com HTTPS e cookie seguro, provisionamento e
recuperação de acesso autorizados, política de senha e sessão, revogação de
contas, permissões por recurso e registro e procedimento operacional. A auditoria
de metadados das alterações cadastrais já existe no perfil local, conforme o
[contrato da Fase 2](../fase-2/README.md), mas ainda exige separação de roles do
banco e controles de backup e retenção para produção.
Depois, deve testar login válido e inválido, CSRF, expiração, logout,
desligamento e acesso indevido no ambiente de destino e registrar aceite da
TI/AE com data e responsável. Google e SUAP podem ser avaliados futuramente,
sem bloquear a conclusão desse mecanismo próprio.
