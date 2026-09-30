# Contrato local de chamadas e saídas curtas

**Decisões técnicas de 30/09/2026.** O solicitante delegou as escolhas necessárias
à implementação. Este contrato registra regras de desenvolvimento e teste; não
registra homologação da AE/TI. Cobre F3/E05–E08 e D03–D09 do
[roteiro](../ROADMAP_IMPLEMENTACAO.md).

## Identidade, idade e relógio

Somente supervisor opera chamada, decide saídas e confirma movimentos físicos.
Gestor não recebe essas permissões pela paridade dos cadastros de gestão.
Residente solicita e consulta somente seus próprios registros, a partir do vínculo
da conta conferido no servidor. Não se aceita `residentId` informado na solicitação.

Instantes são armazenados em UTC. Data civil, aniversário e janela da chamada
usam `America/Sao_Paulo`. Menor é quem ainda não completou 18 anos na data civil
de referência. É necessária alocação ativa; não se inventa um campo de estudante
ativo ausente do cadastro. Nascimento legado ausente impede a operação com motivo
explícito, sem presumir maioridade. O relógio do servidor governa validações.

## Chamada

- Uma chamada por alojamento e data; novas chamadas somente para o dia corrente.
- Janela inclusiva de 22:00 a 23:30. Fora dela, abertura e fechamento exigem aviso,
  confirmação explícita e justificativa de 10–2000 caracteres.
- O conjunto de menores alocados é congelado ao abrir, com identificação e quarto.
  Alterações de alocação posteriores não reescrevem a chamada existente.
- A marcação é `PRESENTE`, `AUSENTE` ou `AUSENCIA_JUSTIFICADA`.
- Todos precisam de marcação antes do fechamento. A versão da chamada impede
  gravações concorrentes e alterações comuns depois de fechada.
- Correção posterior exige justificativa e preserva marca original, autor e hora.
- Ausência justificada exige saída autorizada antes da abertura, partida física
  registrada e intervalo válido no instante da chamada. Solicitação pendente,
  aprovação sem partida e prazo de retorno vencido não justificam ausência.
- A referência de autorização inclui UUID e modalidade; o contrato admite a
  integração posterior de saídas longas.

## Saída curta

O período solicitado é positivo e de até três horas, inclusive. `NOW` captura
a partida solicitada no instante da submissão; o cliente não envia essa hora.
`SCHEDULED` exige partida igual ou posterior ao relógio do servidor. O retorno
previsto é posterior à partida. Solicitações pendentes, aprovadas e em andamento
do mesmo residente não podem ter janelas sobrepostas; a validação ocorre sob lock.

| Ação | Regra local |
| --- | --- |
| Editar | Residente próprio, somente pendente e antes da expiração funcional |
| Aprovar/rejeitar | Supervisor; rejeição exige motivo de pelo menos dez caracteres |
| Cancelar | Residente próprio pendente; supervisor pendente ou aprovada, antes da partida física |
| Registrar partida | Supervisor, somente aprovada; não anterior à partida solicitada |
| Confirmar retorno | Supervisor, após partida física; nunca o próprio residente |
| Registro retroativo | Instante não futuro e justificativa de 10–2000 caracteres |
| Atraso | Retorno real após o previsto exige observação de 10–2000 caracteres |

Uma chegada depois de três horas continua registrável. O limite de três horas
classifica o período pedido; não impede registrar o retorno real.

Estados: `AGUARDANDO_ANALISE`, `APROVADA`, `EM_ANDAMENTO`,
`RETORNO_CONFIRMADO`, `RETORNO_CONFIRMADO_COM_ATRASO`, `REJEITADA`,
`CANCELADA` e `EXPIRADA`. Histórico preserva transições, atores, instantes
solicitados/físicos e justificativas. O cancelamento do diálogo não grava.

## Expiração e auditoria

- Pendente `NOW`: expira no retorno previsto.
- Pendente `SCHEDULED`: expira na partida solicitada.
- Aprovada sem partida: expira no retorno previsto.
- Em andamento: nunca expira nem confirma retorno automaticamente.

O serviço verifica o prazo em cada comando, mesmo se o job ainda não executou.
O job local processa lotes com correlação própria e grava transição e auditoria
na mesma transação. `SYSTEM_JOB` tem ator humano nulo; `LOCAL_API` exige conta e
perfil. Uma requisição HTTP não pode fabricar a origem de job. Não há punição
automática ou envio externo por ausência, expiração ou atraso nesta fase.

## Interface e verificação

As rotas existentes `/chamada` e `/saidas` usam a API local quando autenticadas.
A demonstração permanece isolada em memória. Falha de API não apresenta alunos
ou saídas demonstrativas; saídas longas ficam explicitamente indisponíveis até F4.

Testar aniversário/fuso/janela, conjunto congelado, nascimento ausente, permissões
por registro, CSRF, versões, limites de duração, expiração exata, concorrência,
retorno atrasado, ausência justificada e rollback de auditoria em PostgreSQL.
No navegador: recarga, cancelamento sem gravação, erros, vazio, foco/teclado,
320 px, acessibilidade e separação da demonstração. O QA final registrará as
execuções efetivas e a prova após reinício, disponíveis no [QA](QA.md).
