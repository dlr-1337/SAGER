# Validação integrada e entrega — 17/10/2026

## Navegador, API e PostgreSQL reais

Foi criado o projeto Docker descartável `sager-release-live-20261017`, usando o
Compose local deste checkout, porta de loopback 4310 e volumes exclusivos. O banco
de teste começou vazio e recebeu todas as migrações até V21. As contas operacionais
foram provisionadas pelo CLI existente, em PTY privado e sem eco de senha.

Chromium/Playwright acessou o Angular e a API reais, sem interceptar requisições.
A jornada foi executada com dados sintéticos. O Browser plugin com skill própria
não está disponível nesta sessão; a automação usou o Playwright instalado no projeto.
O Chrome pessoal e o painel Coolify são operados separadamente pelo controle CUA.

| Cenário              | Resultado observado                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login por matrícula  | Gestor, supervisor e residente reconhecidos por `/auth/me`.                                                                                                |
| Curso                | Criado pela interface e consultado na API real.                                                                                                            |
| Cadastro assistido   | Residente, conta vinculada, curso e e-mail institucional persistidos; a senha escolhida autenticou.                                                        |
| Responsável          | Cadastro pela interface com um único POST; detalhe permaneceu após recarregar.                                                                             |
| Moradia              | Alojamento, quarto e alocação preparados por APIs reais.                                                                                                   |
| Separação dos perfis | Gestor recebeu 403 em saídas; residente recebeu 403 na listagem global de residentes.                                                                      |
| Saída curta          | Solicitada pelo residente; supervisor aprovou e registrou partida e retorno pela interface. API confirmou `RETORNO_CONFIRMADO` e o histórico.              |
| Recuperação          | API recusou o responsável incorreto e aceitou os dados cadastrados; revogou a sessão anterior e não abriu sessão automaticamente. A nova senha autenticou. |
| Desktop/celular      | Capturas em 1440×1000 e 390×844; sem rolagem horizontal no celular ou exceções de aplicação.                                                               |

As capturas, credenciais sintéticas e diagnósticos ficam em diretório privado fora
do repositório. A primeira tentativa do roteiro usava uma expectativa de URL sem
`?saved=1`; a expectativa foi corrigida e a jornada completa passou em um novo banco
descartável, sem alteração no produto para contornar a verificação.

## Persistência após recriação

Os containers de frontend, backend e PostgreSQL desse projeto foram parados e
recriados mantendo seus volumes. Antes e depois foram comparados schema, digest das
contas/hashes/vínculos, residentes, responsáveis, cursos, saídas, alocações e auditoria.
Todas as comparações coincidiram. O navegador confirmou depois a sessão JDBC do
gestor, os cadastros, a senha recuperada do residente e o histórico da saída.

O projeto local existente na porta 4200 manteve os mesmos containers, dados e volumes.
Nenhuma credencial de conta existente foi redefinida neste ensaio.

## Publicação e implantação

O [PR #18](https://github.com/dlr-1337/SAGER/pull/18) foi integrado em `main` pelo
commit `eaed1362c9b5decac482eae844ddee79e0e96b5b`. A
[CI do PR](https://github.com/dlr-1337/SAGER/actions/runs/39040306757) aprovou os três
jobs: 275 testes backend, 353 frontend, build, 138 jornadas Chromium em uma execução,
39 testes de infraestrutura e os dois smokes HTTPS com containers descartáveis.
A [CI de `main`](https://github.com/dlr-1337/SAGER/actions/runs/39041036232)
também concluiu os três jobs com sucesso antes da implantação.

Antes da atualização, a VPS estava na V19, com três contas ativas e três containers
saudáveis. Foram preservadas as imagens anteriores e criados dois backups age com
permissão 600: banco/documentos e relatórios. As cópias privadas locais conferiram
com os SHA256 da VPS. A identidade privada de descriptografia permaneceu somente
no computador do operador, fora do Git e da VPS.

A restauração local real retornou `isolated_restore_verified`: schema V19,
auditoria na sequência 3, nenhum documento, sessões expurgadas e aplicação parada.
O arquivo de relatórios também foi descriptografado e sua estrutura tar conferida.
Na cópia restaurada, V20/V21 e a inicialização dos privilégios foram executadas;
o mapeamento da conta de gestor foi ensaiado pelo CLI. As três contas preservaram
UUID, perfil, estado, fingerprint do hash de senha e vínculos. As matrículas dos
vínculos existentes foram migradas e o gestor recebeu a matrícula de teste prevista.

Os projetos locais de ensaio e restauração foram encerrados e seus volumes
exclusivos removidos. O stack local existente e as cópias privadas de recuperação
foram mantidos.

### VPS atualizada e reinicialização verificada

O Coolify implantou o SHA `eaed1362c9b5decac482eae844ddee79e0e96b5b`
em dois deployments manuais, ambos com sucesso (horários UTC):

| Deployment                 | Início   | Serviços saudáveis | Objetivo                                                            |
| -------------------------- | -------- | ------------------ | ------------------------------------------------------------------- |
| `m6whejwd7s6qj9xj0cc7dkvn` | 14:39:18 | 14:44:39           | Aplicar V20/V21 e atribuir matrícula ao gestor existente.           |
| `ip2ekgsrlqkuicz60ysqdstp` | 14:47:28 | 14:49:14           | Recriar os containers com o comando padrão e conferir persistência. |

O comando temporário de migração foi substituído por
`bash infra/coolify/start.sh` no painel antes do segundo deploy. A migração
repetida validou as 21 versões e não encontrou alterações pendentes. O Docker
confirmou banco, backend e gateway saudáveis, sem portas publicadas, somente
gateway na rede `coolify` e os três volumes originais reutilizados. A role runtime
pode inserir cursos e continua sem permissão para alterar ou excluir auditoria.

As três contas mantiveram UUID, perfil, estado, fingerprint do hash e vínculos
após os dois deployments. As matrículas de acesso são:

- Gestor: `TESTE-GESTOR`.
- Supervisor: `SAGER-QA-SUPERVISOR-001`.
- Residente: `SAGER-QA-RESIDENT-001`.

Imagens observadas após a segunda implantação:

| Serviço    | ID Docker                                                                 |
| ---------- | ------------------------------------------------------------------------- |
| PostgreSQL | `sha256:639ab7ceb90e13123085b741fb31ef493fba25463002f6da665352e7b534b652` |
| Backend    | `sha256:575ed83519e6ae4920e048ebb6a7b8115285f272869736ab8cf43a13918276a9` |
| Gateway    | `sha256:19e782ce1389ef7c797a3c2d7bf90398b872256dca3ba2709937aa0a463b951d` |

A verificação externa em `https://sager.otavio.win`, com TLS estrito, confirmou
`/acesso` 200, marcador de produção, CSP e HSTS; CSRF 200, `/auth/me` 401 sem
sessão, `/.env` e `/actuator/health` 404 e `/api/v1/demo` 401. Foi usado User-Agent
compatível com navegador, sem mudar a configuração do Cloudflare. O Chrome
também exibiu o formulário novo por matrícula.

### Acessos existentes conferidos após a troca solicitada

Após a migração, o operador solicitou a redefinição das três senhas de teste.
Ele concluiu pessoalmente a entrada e confirmação no CLI administrativo, usando
os UUIDs existentes. As credenciais não foram incluídas neste registro ou no Git.
As comparações de preservação dos hashes acima correspondem ao momento anterior
a essa redefinição autorizada.

A verificação por HTTPS autenticou as três matrículas com a senha escolhida
(204) e conferiu `/auth/me`, os mesmos UUIDs, perfis e vínculos de antes da
atualização. As sessões usam cookies Secure/HttpOnly. Foram confirmados:

- Gestor consulta residentes, responsáveis e cursos, recebe 403 em saídas e
  não consegue gravar um curso sem CSRF.
- Supervisor consulta residentes e saídas curtas.
- Residente recebe 403 na lista global de residentes e consulta suas saídas.

Foi criado pela API real, com CSRF, somente o curso sintético
`QA Release VPS 20261017`; a interface e uma recarga confirmaram sua persistência.
A checagem de cadastros preservou os totais anteriores: um residente e nenhum
responsável. O Chrome foi deixado na tela inicial, autenticado como gestor,
com a sessão mantida após recarregar a página.
Ao encerrar os resets, uma nova inspeção confirmou somente os três serviços
permanentes, todos saudáveis, sem containers administrativos ainda em execução.

## Limites

Esta evidência fecha a jornada integrada de matrícula, cadastro, moradia, saída
curta, recuperação e persistência. Não representa aceite institucional nem
homologação de provedores de assinatura/mensageria, que continuam desabilitados.
O aviso conhecido de orçamento do bundle permanece. A apresentação à coordenadora
não faz parte desta entrega.
