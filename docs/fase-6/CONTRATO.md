# Contrato local de limpeza, indicadores e relatórios

**Decisões delegadas em 30/09/2026.** Regras de desenvolvimento para F6,
D10–D11/D20 e integração com D13. Não representam homologação institucional.
Os cálculos são feitos no servidor e usam dados persistidos, sem indicadores
demonstrativos no acesso autenticado.

## Avaliação e participantes

Supervisor cadastra e corrige avaliações. Gestor e supervisor consultam os
resultados administrativos. Residente consulta apenas avaliações em que aparece
como participante e o ranking interno limitado descrito abaixo.

Regra imutável v1: `PISO`, `SUPERFICIES`, `RESIDUOS` e `ORGANIZACAO`, de 0 a 10,
em passos de 0,1, com peso igual de 25%. Nota é a média em `BigDecimal`, duas
casas decimais, `HALF_UP`. Uma avaliação por quarto e data civil de São Paulo.

`NOW` usa instante do servidor. Registro histórico usa `RETROACTIVE`, instante
explícito não futuro e justificativa de 10–2000 caracteres. Data civil deriva do
instante de avaliação, não do fuso do navegador. Quarto, instante e data não mudam
em correção; critérios e observação mudam mediante versão e justificativa.

A primeira gravação captura os UUIDs das alocações e residentes vigentes no
instante avaliado, dentro de uma leitura consistente. Transferências posteriores
não atribuem uma avaliação antiga aos novos moradores. Quarto vazio pode ser
avaliado e não gera ocorrência individual. A captura não presume culpa coletiva.
Correções preservam valores anteriores, regra, autoria, instante e motivo.

Feedback apresenta nota anterior da mesma avaliação na correção, nota nova,
diferença, média do período, posição e referência do ranking. Na primeira
avaliação, a comparação anterior é ausente; não se inventa zero ou penalidade.

## Ranking e indicadores

Períodos: semana de segunda a domingo, mês civil e semestre janeiro–junho ou
julho–dezembro. A média do período usa as avaliações do período com duas casas,
`HALF_UP`; empate recebe posições `1, 1, 3`, com código de quarto apenas para
ordenação de apresentação. Sem avaliação: nota e posição ausentes.

Ranking exige autenticação. O residente vê somente código do quarto e posição
dos outros quartos; nota/detalhes próprios exigem participação no período.
Não há nomes de moradores de outros quartos nem ranking público anônimo.

Avaliação abaixo de 6,00 gera evidência interna para cada residente da captura,
via `OccurrenceEvidenceSink` e chave canônica `CLEANING_ASSESSMENT`. Igual a 6,00
não gera. Correção revisa/invalida a evidência e exige análise F5; não emite ou
anula advertência automaticamente.

D11 apresenta séries mensais distintas: ausências sem justificativa em chamadas
fechadas, retornos físicos confirmados com atraso e advertências vigentes. Corrigir
origem altera a contagem corrente com histórico preservado. Não há nota moral
de comportamento ou substituição de dados ausentes por exemplos.

## Consulta e exportação

Somente gestor e supervisor consultam e exportam relatórios administrativos.
Catálogo: presença, saídas, limpeza, ocorrências, notificações, advertências,
termos e consolidado. Filtros tipados combinam período, alojamento, quarto,
residente UUID e situação pertinente. Não há consulta clínica, token de convite,
credencial ou análise interna desnecessária nos relatórios.

Criar consulta congela filtros, linhas, agregações, versão do catálogo, ator e
`asOf` na mesma leitura consistente. Prévia paginada e exportação usam o mesmo
snapshot, mesmo depois de uma alteração no domínio. Exporta todas as linhas do
snapshot, não apenas a página exibida. Página padrão 20, máximo 100; período de
até 366 dias e até 10.000 linhas. Excesso é recusado explicitamente, sem truncar.

Snapshot é privado do autor e expira em 24h. Exportação é tarefa persistida e
idempotente por snapshot/formato, com estados `PENDING`, `PROCESSING`, `READY`,
`FAILED`, `EXPIRED`; lease permite retomar após reinício. PDF real com fonte
incorporada; XLSX real com células de texto para entradas começadas por `=`, `+`,
`-` ou `@`, sem fórmulas executáveis. Arquivo e metadados têm hash e tamanho.
Download confere a conta/permissão atual, autor, prazo e integridade, com `no-store`.

Expiração remove apenas artefatos transitórios da consulta/exportação. Domínio,
documentos de autorização/termos e auditoria permanente não são eliminados por
essa rotina. Arquivos transitórios ficam em raiz privada própria para preservar
essa separação operacional.

## API e verificação prevista

`/api/v1/limpeza/politica`, `/limpeza/avaliacoes`, correção explícita,
`/limpeza/ranking`, `/me/limpeza/avaliacoes`; relatórios em `/relatorios/catalogo`,
`POST /relatorios/consultas`, `GET /relatorios/consultas` (consultas válidas do
autor com ao menos um registro, sem linhas, até 100), consulta de páginas/resumo,
criação de exportação (recoloca na fila só a que falhou, com auditoria) e download.
PDF e XLSX escondem colunas UUID e traduzem rótulos só na renderização. O filtro
opcional `unitId` é omitido do JSON quando nulo: assim o hash de consultas já
guardadas continua igual. A demonstração não baixa arquivo. Residente não recebe autorização de exportação administrativa.

Testar limites/decimais/arredondamento/empates, histórico, alocação capturada,
quarto vazio, propriedade UUID, correção de evidência F5, filtros combinados,
snapshot após alteração, exportação integral, texto sem fórmula, lease/reinício,
prazo/integridade/revogação e exclusão clínica. Interface: feedback, erro/vazio,
teclado/foco, 320 px, gráficos com alternativa textual e nenhuma exportação
simulada no acesso local. O QA registrará somente execuções efetivamente concluídas.
