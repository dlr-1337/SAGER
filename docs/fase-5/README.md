# Comunicações e disciplina persistidas

Fase 5 de E10–E12, com as regras locais delegadas no [contrato](CONTRATO.md).
O [QA](QA.md) registra testes e prova integrada com PostgreSQL, contas sintéticas,
PDF privado e reinício. Não representa homologação institucional.

## Jornada e permissões

Supervisor consulta a origem, registra visualização e inicia análise. Pode
arquivar com motivo ou converter manualmente em advertência. Fechar chamada com
ausência injustificada ou confirmar retorno tardio gera evidência e notificação;
essas ações não emitem advertência. Limpeza se integra na Fase 6.

Advertência publicada preserva conteúdo, autoria e origem. Anulação é uma nova
decisão humana motivada. Duas advertências elegíveis da mesma categoria e de
origens distintas em 90 dias permitem revisar possível reincidência. A emissão
de termo exige confirmação humana e gera PDF privado imutável.

Avisos têm rascunho, destinatários por UUID e versões publicadas. O residente
consulta seus próprios avisos, advertências e termos. GET, leitura explícita e
ciência são operações distintas; ciência exige confirmação da versão exibida.
Ciência local não equivale a assinatura eletrônica ou aceitação da decisão.

Gestor não opera disciplina. Correção da origem preserva o histórico e sinaliza
revisão humana, sem anular automaticamente advertências, termos ou ciência.

## API e interface

- `/api/v1/ocorrencias` e `/notificacoes`: evidência, revisões e ações de análise.
- `/api/v1/advertencias`: emissão, consulta e anulação motivada.
- `/api/v1/residentes/{id}/reincidencias` e `/termos`: base atual e emissão humana.
- `/api/v1/termos/{id}` e `/documento`: conteúdo e PDF autorizado.
- `/api/v1/avisos`: rascunhos, publicação e revisão.
- `/api/v1/me/comunicacoes`: consulta própria, leitura, ciência e PDF.

Na interface, supervisor usa Notificações, Advertências e Avisos institucionais.
Residente usa Minhas comunicações, com filtros por tipo e detalhes de cada versão.
As ações usam versão otimista; emissão e publicação usam chave idempotente.
Repetir uma requisição concluída não duplica o documento ou a decisão.

Conteúdo disciplinar não integra a auditoria global: ela registra somente
metadados permitidos. PDFs permanentes usam a mesma raiz privada da Fase 4 e
devem acompanhar o backup consistente do banco. Provedores reais e procedimento
institucional de assinatura do termo permanecem pendentes de homologação.
