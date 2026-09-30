# Contrato local de ocorrências e comunicações

**Decisões delegadas em 30/09/2026.** Regras locais para F5/D12–D14/D18;
não representam homologação da AE. A delegação permite escolher políticas de
desenvolvimento onde PRD e TECH antes aguardavam valores institucionais.

## Evidência e análise humana

Somente supervisor opera disciplina e publica comunicações. Residente consulta
e registra leitura/ciência dos próprios itens, por vínculo vigente da conta.
Gestor consulta relatórios apropriados, sem herdar operações disciplinares.
GET não muda estado, leitura, ciência ou visualização.

- Ausência sem justificativa em chamada fechada gera ocorrência interna.
  Chamada aberta/incompleta e ausência justificada não geram ocorrência.
- Retorno físico confirmado após o previsto gera ocorrência: tolerância local
  zero, instantes precisos do servidor. Igualdade e mero prazo vencido não geram.
- Limpeza F6 aceita ocorrência de avaliação menor que 6,00 por morador capturado
  na avaliação, sem presumir culpa coletiva nem usar ocupantes atuais.
- Nenhuma ocorrência gera advertência automaticamente. O supervisor analisa
  evidência, contexto e justificativa antes de converter ou arquivar.
- Regra aplicada é imutável/versionada, com código, parâmetros e vigência.

Chave canônica `(sourceType, sourceId, residentId)` conserva uma ocorrência.
Revisões da origem criam snapshots históricos; não criam outra ocorrência.
Notificação única por `(occurrenceId, policyCode)` não inclui versão da regra.
Reprocessar, reenviar requisição ou atualizar política não duplica alerta.

## Notificações e origem corrigida

Estados: `PENDENTE → VISUALIZADA → EM_ANALISE → ARQUIVADA / CONVERTIDA`.
Ações são explícitas. Arquivamento exige código `ORIGEM_RETIFICADA`,
`SEM_EVIDENCIA`, `NAO_PROCEDE` ou `OUTRO`, mais motivo de dez caracteres.
Não excluir nem reabrir silenciosamente decisão terminal.

Correção invalida/revisa a origem e marca `requiresReview`. Conversão com
revisão antiga é bloqueada. Supervisor confirma nova evidência ou arquiva.
Advertência emitida permanece histórica e sinalizada; não se anula sozinha.
Origem invalidada ou análise pendente exclui a advertência de reincidência.

Conversão usa lock e versão da notificação, unicidade da advertência vinculada
e mesma transação de decisão/auditoria. Duas conversões não criam dois documentos;
converter versus arquivar produz uma única decisão terminal.

## Advertência e reincidência

Advertência manual ou por conversão exige categoria, gravidade humana `LEVE`,
`MODERADA` ou `GRAVE`, descrição, justificativa e data civil não futura em
`America/Sao_Paulo`. Categorias v1: `AUSENCIA`, `ATRASO_RETORNO`, `LIMPEZA`,
`OUTRA`. Publicação torna o conteúdo imutável. Anulação humana e motivada preserva
texto, autoria, histórico e ciência anterior.

Possível reincidência: duas advertências vigentes da mesma categoria, de origens
distintas, nos últimos 90 dias. Excluir anuladas, origem inválida e revisão
pendente. `OUTRA` não gera sinal automático por agrupar fatos diferentes.
O sinal é candidato: supervisor seleciona a base, explica sua relação e confirma.

Termo é emitido somente depois da confirmação humana. Guarda residente, ator,
advertências/ocorrências motivadoras, critério/modelo v1, decisão, PDF imutável,
hash SHA-256 e tamanho. Repetir mesma base/modelo não emite outro termo.
PDF e evidência não são reescritos. Anulação é decisão histórica motivada.
Ciência autenticada é ciência local, nunca assinatura eletrônica fictícia.
Assinatura de responsável de saída longa não assina automaticamente esse termo.

## Avisos, leitura e ciência

Supervisor cria rascunho e publica para UUIDs selecionados; destinatários ficam
congelados. Revisão cria nova versão publicada e nova ciência, preservando as
anteriores. Retirada motivada preserva histórico. Comunicação exclusivamente
interna; nenhuma ação envia implicitamente email ou WhatsApp a terceiros.

Leitura e ciência são ações diferentes. Ciência exige botão e confirmação,
conta/residente vigentes, instante do servidor e versão exata do conteúdo.
Repetição/concorrência retorna a primeira evidência sem alterar sua hora.
Outra versão exige outra evidência. GET não equivale a leitura nem ciência.

Criação, emissão, publicação e conversão têm idempotência persistida. Chave
reutilizada com payload diferente devolve 409. Texto/justificativa ficam no
domínio autorizado; auditoria permanente guarda apenas metadados.

## API prevista

Supervisor: `/ocorrencias`, `/notificacoes`, ações `visualizar`, `analisar`,
`arquivar`, `converter`, `/advertencias` e `anular`, `/avisos` e `publicar`,
`revisar`, `retirar`; `/residentes/{id}/reincidencias`, `/residentes/{id}/termos`,
`/termos/{id}/documento` e `anular`. Tudo sob `/api/v1`, escritas com CSRF.

Residente: `/me/avisos`, `/me/advertencias`, `/me/termos`,
`/me/comunicacoes/{id}`, ações `leitura` e `ciencia`, documento próprio.
Propriedade vem da conta no servidor; ID alheio retorna 404 sem revelar existência.
Relatórios administrativos não entregam análise interna ao residente.

## Verificação necessária

PostgreSQL/HTTP: deduplicação, correção de origem e histórico, transações,
concorrência de decisão, propriedade UUID, CSRF e permissões; datas e critérios
de reincidência; idempotência de emissão/publicação; leitura distinta de ciência,
horário preservado e revisão com nova ciência; integridade/download do PDF.
Navegador: decisão revisável, erro/vazio/conflito, nova ciência por versão,
teclado/foco, 320 px e API sem fallback demonstrativo. Prova real e reinício
serão registrados após implementação; este contrato não afirma testes executados.
