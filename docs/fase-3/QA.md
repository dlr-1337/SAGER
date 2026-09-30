# QA da Fase 3 — chamada e saída curta

**Data:** 30/09/2026. **Resultado:** verificação técnica local com contas e
registros sintéticos. O [contrato](README.md) registra as regras delegadas;
não representa homologação institucional.

| Verificação | Execução e resultado |
| --- | --- |
| Backend completo | `.\mvnw.cmd -B -ntp verify`, JDK 21 e PostgreSQL 17.11: 163 testes, zero falhas, erros ou skips; JAR produzido |
| Backend focado | 23 casos HTTP de operações, 4 de migração e 9 de auditoria passaram; aniversário, fuso, versão, CSRF, concorrência, prazo, movimentos físicos e rollback verificados |
| Angular | `npm test -- --watch=false`: 146 testes passaram; `npm run build` passou |
| Navegador | Regressão de 66 casos: 64 passaram; duas falhas foram tratadas no recorte final de autenticação e auditoria de rotas, que passou 8/8 com um worker |
| Falhas tratadas | Asserção de título atualizada para o início local; timeout de auditoria de rotas reexecutado após encerrar a concorrência com o provisionamento da prova real |
| OpenAPI | Contratos distintos para chamada, marcação, correção, decisão, cancelamento e movimentos físicos; versões inteiras, limites de texto, horários e erros conferidos por teste HTTP |
| Perfis | Supervisor opera; gestor não herda operações; residente consulta e solicita pelo próprio UUID vinculado, sem confirmar partida ou retorno |
| Interface | Teclado, cancelamento sem gravação, conflito, indisponibilidade, Axe e 320 px cobertos nas jornadas; falha da API não entrega dados demonstrativos |
| Impeccable | Detector das páginas de operações e do início local retornou `[]`; cinco capturas inspecionadas em uma rodada |

O navegador completo ainda não havia sido repetido localmente após as duas
correções. O CI obrigatório executa a seleção completa na revisão final.
Jornadas com API interceptada verificam a interface; a prova abaixo usa a API real.

O primeiro CI passou backend, unitários e build, mas marcou 65/66 jornadas:
o teste offline de responsáveis navegava antes de terminar a entrada explícita
na demonstração. Essa entrada revalida a sessão de forma assíncrona. O teste
agora espera a chegada a `/inicio` antes de iniciar a próxima navegação;
nenhum timeout, retry ou comportamento de autorização foi relaxado.
O caso dirigido de responsáveis passou após a correção (`playwright test
e2e/guardians-local.spec.ts:186 --workers=1`, porta local 4380).

## Prova integrada e reinício

Frontend de produção em `127.0.0.1:4342`, JAR em `127.0.0.1:8080` e PostgreSQL
descartável em `127.0.0.1:5545`. Duas contas sintéticas foram provisionadas pela
CLI com senha em entrada oculta: supervisor e residente. O vínculo da conta do
residente foi criado explicitamente. A API cadastrou um alojamento, um quarto e
dois menores alocados. O navegador não interceptou a API.

Em navegador configurado em `Pacific/Auckland`, o residente solicitou uma saída
`NOW` de duas horas, editou-a e recarregou o registro. A tela apresentou as datas
de São Paulo e não ofereceu confirmação física ao residente. O supervisor cancelou
o diálogo de análise sem alteração, aprovou e registrou a partida.

O supervisor abriu a chamada fora da janela mediante justificativa e confirmação.
O conjunto congelado continha dois menores. A ausência do residente com partida
registrada foi justificada pela autorização; o outro foi marcado ausente. Depois
do fechamento, a correção motivada registrou o segundo como presente e manteve
as duas versões. O retorno presencial ocorreu dentro do prazo; o histórico da
saída preservou criação, edição, aprovação, partida e retorno. A prova real não
simula atraso: retorno tardio está coberto por HTTP/PostgreSQL e pela interface.

Depois de reiniciar o mesmo JAR sobre o mesmo banco, as sessões mantidas somente
na memória do navegador permaneceram válidas. A chamada preservou dois residentes,
um presente e uma ausência justificada; versões, correção, propriedade e histórico
da saída permaneceram iguais. A auditoria registrou metadados das transições sem
incluir o motivo ou a observação no conteúdo global.

Ao final, os três servidores e o contêiner descartável foram parados; as quatro
portas ficaram livres. Recursos de outros projetos foram preservados.

## Capturas

- [Chamada antes](../../.impeccable/reviews/pr-operacoes-before-chamada-desktop.png):
  protótipo explícito na revisão anterior de `main`, com dados demonstrativos.
- [Chamada persistida e correção](../../.impeccable/reviews/pr-operacoes-chamada-desktop.png).
- [Saída e movimentos físicos](../../.impeccable/reviews/pr-operacoes-saida-desktop.png).
- [Residente em 320 px](../../.impeccable/reviews/pr-operacoes-residente-mobile.png).
- [Início local](../../.impeccable/reviews/pr-operacoes-inicio-desktop.png).

**Limites:** perfil local em loopback; nenhuma mensagem externa ou punição
automática nesta entrega. A modalidade longa é a próxima fatia. A auditoria
permanente em produção também depende da separação de papéis e proteção operacional.
