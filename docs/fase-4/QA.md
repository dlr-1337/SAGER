# QA da Fase 4 — saídas longas e integrações

**Data:** 30/09/2026. **Resultado:** verificação técnica local com contas e
registros sintéticos. O [contrato](CONTRATO.md) descreve o comportamento e os
limites. O aceite operacional de Clicksign, WhatsApp e do termo depende de
homologação posterior.

## Verificações automatizadas

| Verificação                      | Execução e resultado                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend completo                 | `.\mvnw.cmd -B -ntp verify`, JDK 21 e PostgreSQL 17.11: 217 testes passaram, sem falhas, erros ou skips; JAR produzido antes das duas correções finais de borda                                                           |
| Backend após as correções finais | `.\mvnw.cmd -B -ntp '-Dtest=IntegrationFlowIntegrationTest,LongExitApiIntegrationTest,ApiFoundationIntegrationTest,IntegrationConfigurationTest' package`: 36 testes passaram, sem falhas, erros ou skips; JAR atualizado |
| Inventário final                 | 218 testes no backend; a execução completa dessa revisão final ainda aguarda o CI                                                                                                                                         |
| Angular                          | `npm test -- --watch=false`: 157 testes passaram; `npm run build` passou                                                                                                                                                  |
| Navegador de regressão           | Seleção completa de 76 casos passou com Playwright; essas jornadas usam API interceptada para verificar a interface                                                                                                       |
| Provedores                       | Sete casos de contrato HTTP e quatro de configuração: API v3, IDs e metadados vinculados, autenticação SMS, eventos e fechamento, prazo exclusivo e configuração que falha fechada                                        |
| Arquivos e PDF                   | 14 casos de armazenamento privado e três de geração de PDF; UUIDs, hash, limite, imutabilidade, troca da raiz, acentos, paginação e limites de texto                                                                      |
| Perfis e concorrência            | Propriedade do residente, supervisor, gestor recusado, CSRF, versão, revisão documental, sobreposição entre saídas curtas e longas e lock comum do residente                                                              |
| Auditoria e expiração            | Alteração e auditoria na mesma transação; falha na auditoria reverte o lote de expiração; correlação única e autoria de sistema sem requisição HTTP                                                                       |

O lote final de 36 casos contém 14 jornadas de integração, 12 casos da API de
saídas longas, seis da fundação HTTP e quatro de configuração. Ele cobriu a
correção de saída longa agendada exatamente no instante do servidor, que agora
retorna validação `400`, e a recuperação quando o cadastro do responsável muda
após a assinatura. O reenvio nesse caso gera nova revisão e exige nova assinatura
antes da aprovação humana.

As jornadas de integração usam PostgreSQL real e provedores HTTP controlados em
loopback, disponíveis somente nos testes. Elas verificam provisionamento por
etapas, convite, capability somente de leitura, HMAC, deduplicação, consulta
autoritativa da API v3, armazenamento dos bytes assinados, aprovação do supervisor
e confirmação física de partida e retorno tardio. Incluem reenvio após dez
minutos, limite de três em 24 horas, troca de responsável, invalidação de revisão,
assinatura dentro do prazo verificada depois do prazo do convite, hash divergente,
cadastro revogado e arquivo ausente.

A recuperação verifica cinco tentativas para falhas seguras, esperas progressivas
e orçamento esgotado. Um POST com resultado incerto ou lease vencido durante
envio irrepetível passa a `UNCERTAIN`, sem duplicação automática. Os eventos Meta
conferem WABA, telefone de origem, destinatário, ID da mensagem, instante e ordem
dos estados. Entrega ou leitura da mensagem não confirma assinatura.

Esses testes não usam credenciais externas nem certificam assinatura real,
telefone real, template aprovado, widget em produção ou entrega no WhatsApp.

## Prova integrada com a aplicação real

Frontend de produção em `127.0.0.1:4344`, JAR final em `127.0.0.1:8082` e
PostgreSQL 17.11 descartável em `127.0.0.1:5547`. O banco aplicou as migrações
V1–V16. Os provedores Clicksign e WhatsApp permaneceram desativados.

Quatro contas sintéticas foram provisionadas pela CLI com senha em entrada
oculta: supervisor, residente, outro residente e gestor. Os dois residentes
receberam vínculos explícitos pelo UUID. A API real criou alojamento, quarto,
dois menores com matrículas manuais e datas de nascimento, alocações ativas e
um responsável ativo com telefone brasileiro sintético. O navegador não
interceptou requisições.

O fluxo exercitado foi: entrada local → saída longa própria de cinco horas →
edição → nova revisão de PDF → análise pelo supervisor → rejeição motivada.
O navegador estava em `Pacific/Auckland`; os campos e documentos usaram o
horário de São Paulo informado pelo servidor.

| Ação real                        | Resultado observado                                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solicitação `NOW` pelo residente | Pedido pendente, versão `0`, PDF original da revisão `1`; assinatura e mensagem `UNAVAILABLE`                                                                          |
| Edição pela tela                 | Versão `1`, revisão `2` e UUID documental novo; histórico preservou criação e edição                                                                                   |
| Download pela tela e pela API    | PDF válido de uma página, acentos e conteúdo revisado preservados; bytes do download coincidiram com o SHA-256 registrado no PostgreSQL                                |
| Revisão anterior                 | PDF original da revisão `1` manteve exatamente seu hash após a edição                                                                                                  |
| Aprovação sem assinatura         | Botão desabilitado; chamada direta recusada com `409/signature_required`; nenhuma mudança na versão                                                                    |
| Rejeição pelo supervisor         | Justificativa obrigatória, versão `2`, estado `REJEITADA`; criação, edição e rejeição preservadas no histórico e na auditoria                                          |
| Outro residente                  | Lista própria vazia; solicitação e PDF de outro residente retornaram `404`                                                                                             |
| Gestor                           | Listagem, detalhe, PDF e decisão de saída longa retornaram `403`; a tela não ofereceu solicitação                                                                      |
| Anônimo                          | PDF institucional e endpoints do convite sem capability válida retornaram `401`                                                                                        |
| Interface                        | Tela não vazia, identidade e navegação conferidas, sem overlay ou erro de execução; Axe sem violações no conteúdo principal e sem overflow horizontal em 320 e 1440 px |

A extração com `pypdf` confirmou matrícula, responsável, vínculo, motivo revisado
e versão do termo. A página renderizada com Poppler foi inspecionada: títulos,
acentos, margens, rodapé e conteúdo ficaram legíveis, sem corte ou sobreposição.
O armazenamento permaneceu fora da árvore pública do frontend.

## Reinício e encerramento

O processo Java da prova foi identificado pelo PID e pelo comando completo,
encerrado e reiniciado com o mesmo JAR, banco e diretório privado de documentos.
Sem novo login, as duas sessões existentes permaneceram válidas. A solicitação
preservou estado `REJEITADA`, versão `2`, revisão documental `2`, os três eventos
do histórico e os metadados de auditoria. O PDF original retornou exatamente o
mesmo SHA-256 e a tela própria carregou novamente em 320 px.

Ao terminar, somente o Java e o proxy identificados como pertencentes à prova
foram parados. O contêiner PostgreSQL descartável foi removido por `--rm`, e as
portas `5547`, `8082` e `4344` ficaram livres. Não foram encerrados serviços de
outros projetos.

## Capturas

### Primeira rodada — API real

Capturas da prova com PostgreSQL real, anteriores ao ajuste visual:

- [Residente e revisão 2 em 320 px](../../.impeccable/reviews/pr-autorizacoes-residente-mobile.png).
- [Análise do supervisor em 1440 px](../../.impeccable/reviews/pr-autorizacoes-supervisor-desktop.png).
- [PDF original da revisão 2](../../.impeccable/reviews/pr-autorizacoes-pdf-original.png).

A inspeção da captura desktop identificou a última letra de “indisponível”
quebrada em outra linha nas duas colunas estreitas do cartão de assinatura.
A correção `a19d952` acrescentou quatro linhas em `operations.scss`: os pares de
rótulo e valor de `.op-exit-side .op-definition div` passaram a uma coluna,
com espaço de 4 px. A prova integrada acima permanece válida para o comportamento
anterior a esse ajuste exclusivamente visual.

### Segunda rodada — confirmação do CSS

O Angular foi servido em `127.0.0.1:4224`, compilando a revisão corrigida. A
confirmação reutilizou as fixtures de `long-exits-local.spec.ts` com API
interceptada e estados de assinatura e mensagem `UNAVAILABLE`, equivalentes aos
observados na prova real. As capturas originais foram preservadas.

- [Estado indisponível em 1440 px](../../.impeccable/reviews/pr-autorizacoes-status-desktop.png).
- [Estado indisponível em 320 px](../../.impeccable/reviews/pr-autorizacoes-status-mobile.png).

Nos dois tamanhos, rótulos e valores ficaram legíveis em uma coluna. A medição
dos trechos de texto confirmou que nenhuma palavra se dividiu entre linhas;
o estilo calculado confirmou coluna única e espaço de 4 px. Não houve overflow
horizontal, erro de execução ou violação Axe no conteúdo principal. A inspeção
das duas imagens confirmou o ajuste. O detector Impeccable, limitado ao arquivo
CSS alterado, retornou `[]`. O servidor exclusivo dessa confirmação foi encerrado
após verificar seu PID e comando, e a porta `4224` ficou livre.

Scripts, sessões, PDFs sintéticos e logs da prova ficaram no diretório privado
de QA excluído do Git. Não foram incluídos credenciais, tokens ou registros reais.

**Limites:** a prova real cobre o ambiente local com provedores desativados.
O ciclo assinado e os movimentos físicos foram verificados pelos testes com
PostgreSQL e provedores HTTP controlados. A integração externa e o termo exigem
homologação; a entrega não habilita produção nem autoriza envio real de mensagens.
