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

A entrega será registrada nesta seção após a conclusão da CI e da atualização da
instância existente no Coolify. O estado da VPS foi conferido antes da intervenção:
V19, três contas ativas e três containers saudáveis. Migração, backup e implantação
permanecem etapas distintas desta validação local.

## Limites

Esta evidência fecha a jornada integrada de matrícula, cadastro, moradia, saída
curta, recuperação e persistência. Não representa aceite institucional nem
homologação de provedores de assinatura/mensageria, que continuam desabilitados.
O aviso conhecido de orçamento do bundle permanece. A apresentação à coordenadora
não faz parte desta entrega.
