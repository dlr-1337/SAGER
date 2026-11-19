## Context

Motivação em proposal.md. Estado atual, conferido no código:

- **Catálogo.** `ReportCatalog` dá a todo relatório a mesma lista `COLUMNS` (identificador, data, tipo, situação, UUID do residente, residente, quarto, nota, categoria, origem). A tela e os arquivos escondem só as colunas do tipo UUID.
- **Resumo.** `ReportCatalog.summary` calcula para todo relatório o total, a contagem por tipo e por situação, a nota média de limpeza, as faltas sem justificativa, os retornos com atraso e as advertências ativas. `monthly` repete o mesmo resumo por mês. A tela mostra tudo, e o "Mês a mês" usa o componente dos indicadores individuais, com faltas, atrasos e advertências.
- **Ordem.** A consulta faz `ORDER BY date,type,id,resident_id`, do mais antigo para o mais recente. A tela pagina as linhas na ordem gravada.
- **Relatório guardado.** `sager_report_snapshot` guarda filtros, colunas, linhas, resumo, mês a mês e `catalog_version`, e um gatilho impede alterá-los. O código de conferência (`content_hash`) é o SHA-256 da forma canônica de `catalogVersion`, `catalogCode`, `filters`, `columns`, `rows`, `summary` e `monthly`. A ordem dos objetos não conta, mas a ordem das listas conta. Antes de exportar, `ReportExportJobs.claim` recalcula o código com o que está gravado e falha a exportação se ele não bater.
- **PDF.** `ReportExportWorker` escreve duas linhas de texto por registro ("Data: … · Tipo: … · Situação: …" e "Residente: … · Quarto: …") pelo `PdfTextRenderer` do pacote `documents`, em A4 em pé. O mesmo renderizador gera a autorização de saída longa e o termo de compromisso.
- **Excel.** A aba "Resultados" tem título, período e filtros nas linhas 1 a 3, cabeçalho na linha 4 e um registro por linha, com datas e notas como valores. A aba "Consulta" tem relatório, período, geração, total, filtros e o código de conferência.
- **Demonstração.** `reports-demo-api.service.ts` usa a mesma lista de colunas para todo relatório, ordena do mais antigo para o mais recente e calcula o mesmo resumo para todos.

## Goals / Non-Goals

**Goals:**

- Cada relatório com as colunas e as métricas do seu assunto, na tela, no PDF, no Excel e na demonstração.
- Registros do mais recente para o mais antigo.
- PDF e Excel em tabela, com cabeçalho de colunas e uma linha por registro.
- Nenhum relatório já gerado perde a validade do código de conferência.

**Non-Goals:**

- Separar saídas curtas e longas em seções.
- Definir o significado de cada coluna.
- Mudar filtros, situações, limites, validade ou permissões.

## Decisions

### D1. Colunas de cada relatório no catálogo do servidor

O catálogo passa a dar a cada relatório a própria lista de colunas, sem as colunas UUID, que nunca aparecem. O relatório novo guarda essa lista, como hoje. A tela, o PDF e o Excel mostram as colunas guardadas no relatório.

| Relatório | Colunas |
|---|---|
| Presença na chamada | Data, Residente, Quarto, Situação |
| Saídas | Data, Residente, Quarto, Tipo de saída, Situação |
| Limpeza dos quartos | Data, Quarto, Residente, Nota, Situação |
| Ocorrências | Data, Residente, Quarto, Categoria, Origem, Situação |
| Notificações de ocorrência | Data, Residente, Quarto, Categoria, Origem, Situação |
| Advertências | Data, Residente, Quarto, Categoria, Origem, Situação |
| Termos de compromisso | Data, Residente, Quarto, Situação |
| Consolidado administrativo | Data, Tipo, Residente, Quarto, Nota, Categoria, Origem, Situação |

Critérios:

- sai a coluna que é sempre vazia no relatório (nota nas saídas, categoria na presença) ou sempre igual (tipo e origem na presença, origem "Reincidência" nos termos, categoria "Limpeza" na limpeza);
- "Tipo" só faz sentido quando o relatório mistura assuntos, no consolidado;
- nas saídas, a origem vira "Tipo de saída", porque o valor é "Saída curta" ou "Saída longa";
- a ordem é quando, quem, onde, o quê e, por último, a situação; na limpeza, o quarto vem antes do residente, porque a avaliação é do quarto.

As linhas guardam os mesmos campos de hoje. Só a lista de colunas muda. O contrato das linhas e a leitura dos relatórios antigos ficam iguais.

*Rejeitada:* manter as oito colunas e esconder, na hora de mostrar, as que vierem vazias. A coluna apareceria ou sumiria conforme o período, por exemplo "Quarto" de um residente sem alocação, e cada tela e cada arquivo repetiria o filtro.

### D2. Métricas do resumo calculadas por relatório

O servidor calcula para cada relatório o total e a contagem por situação, mais só as métricas do assunto:

| Relatório | Métricas além do total e da contagem por situação |
|---|---|
| Presença na chamada | Faltas sem justificativa |
| Saídas | Voltaram atrasados |
| Limpeza dos quartos | Nota média de limpeza |
| Advertências | Advertências ativas |
| Ocorrências, notificações e termos | nenhuma |
| Consolidado administrativo | contagem por tipo, nota média, faltas, atrasos e advertências ativas |

O mês a mês guarda as mesmas chaves por mês. A tela, o PDF e o Excel mostram as métricas que o resumo traz, com os rótulos atuais.

O "Mês a mês" da tela mostra, por mês, "Registros" e a métrica de contagem do relatório. A limpeza mostra só "Registros", porque a nota média não cabe na mesma barra das contagens. O consolidado continua com faltas, atrasos e advertências, como hoje. O componente dos indicadores passa a receber as séries de quem o usa, e o painel individual continua com as três de hoje.

*Rejeitada:* calcular tudo e esconder na tela. O PDF, o Excel e a demonstração precisariam do mesmo filtro, e o relatório de saídas continuaria guardando uma nota média vazia.

### D3. Ordem gravada na consulta

A consulta passa a `ORDER BY date DESC, resident_name, type, id, resident_id`. Os nomes vazios ficam por último. As linhas são gravadas nessa ordem, e a tela, o PDF e o Excel seguem a ordem gravada.

*Rejeitada:* reordenar na leitura. A página da tela teria de ordenar até 10.000 linhas a cada pedido, e o arquivo de um relatório antigo sairia numa ordem diferente da que o código de conferência cobre.

### D4. Catálogo versão 2 e relatórios antigos intactos

O catálogo e os relatórios novos passam a `catalogVersion` 2, e o código de conferência continua calculado do mesmo jeito. O registro `Column` e os filtros não mudam de forma. Se um campo novo entrasse em `Column`, a leitura de um relatório antigo traria esse campo vazio, e o código recalculado não bateria.

Um relatório da versão 1 continua com as oito colunas, o resumo completo e a ordem crescente que guardou. Ele sai do ar em até 24 horas. A exportação recalcula o código com o que está gravado, então ele continua válido.

*Rejeitada:* uma migração V36 que reescrevesse os relatórios guardados. O gatilho de imutabilidade impede a alteração, e o código de conferência deixaria de corresponder ao que foi consultado.

### D5. PDF do relatório em tabela

O `PdfTextRenderer` ganha:

- um bloco de tabela na seção: cabeçalho e linhas de texto, com o cabeçalho repetido em cada página nova;
- a opção de página deitada.

Os documentos que já usam o renderizador continuam iguais.

A largura das colunas segue o conteúdo:

- a coluna que cabe na sua parte recebe a largura natural (data, quarto, nota);
- as demais dividem o resto e quebram o texto em linhas;
- a sobra, quando há, é dividida na proporção do conteúdo.

As linhas alternam um fundo claro, e um filete separa os registros.

O relatório sai em A4 deitado. O PDF tem:

- "Resumo": filtros, data de geração, total, métricas do relatório e contagem por situação, e, no consolidado, contagem por tipo;
- "Registros": a tabela;
- "Conferência": o código de conferência, no fim.

*Rejeitadas:*

- outra biblioteca de PDF, ou HTML convertido em PDF: traria uma dependência nova e outras fontes;
- A4 em pé: as oito colunas do consolidado quebrariam quase toda linha em duas ou três, e um relatório de 10.000 linhas se aproximaria do limite de 1.000 páginas do renderizador.

### D6. Excel com filtro no cabeçalho

A aba "Resultados" mantém título, período e filtros nas linhas 1 a 3 e o cabeçalho na linha 4. O cabeçalho ganha:

- fundo e borda;
- painel congelado;
- filtro automático do Excel sobre o cabeçalho e as linhas, para filtrar e ordenar.

A largura de cada coluna segue o conteúdo, de 10 a 60 caracteres. Datas continuam como datas e notas como números.

A aba "Consulta" passa a "Resumo", com as linhas:

1. relatório;
2. período;
3. data de geração;
4. total de registros;
5. filtros;
6. métricas do relatório;
7. contagem por situação e, no consolidado, por tipo;
8. código de conferência, na última linha.

*Rejeitadas:*

- uma tabela do Excel (objeto "Formatar como tabela"): a tabela gerada pela biblioteca pode abrir com aviso de reparo em algumas versões do Excel, e isso não pode ser conferido aqui; o filtro automático já permite filtrar e ordenar;
- o cabeçalho na linha 1, sem título: a aba de dados perderia título, período e filtros, contra "Arquivo legível".

### D7. Demonstração com as mesmas colunas, métricas e ordem

`reports-demo-api.service.ts` usa as mesmas colunas por relatório, calcula o resumo com as mesmas métricas e ordena do mais recente para o mais antigo, com o mesmo desempate. As colunas e as métricas ficam em constantes do frontend iguais às do catálogo do servidor (spec `demo-fidelity`).

*Rejeitada:* buscar o catálogo no servidor na demonstração. A demonstração nunca chama a API (RF027).

## Risks / Trade-offs

- **Relatórios antigos.** Por até 24 horas depois da implantação, um relatório gerado antes continua com as oito colunas e a ordem crescente. → Gerar de novo resolve. O manual já orienta gerar outro para ver mudanças.
- **Duas listas iguais.** As colunas e as métricas existem no servidor e nas constantes da demonstração. → O e2e da demonstração confere o resumo e as colunas das saídas.
- **Tabela larga.** Nome de residente muito longo quebra em várias linhas na célula. → A linha cresce, o cabeçalho continua, e o PDF não corta texto.

## O que a instituição ainda decide

- **Significado de cada coluna.** O grupo vai perguntar à servidora da AE, por exemplo:
  - qual data a coluna "Data" mostra em cada relatório (saída pedida, chamada, avaliação, fato, notificação, advertência ou emissão do termo);
  - o que "Origem" e "Categoria" devem dizer;
  - se as situações têm o nome usado na AE.
- **Conjunto de colunas e métricas.** Se as colunas e as métricas de cada relatório bastam para a AE, inclusive por perfil (D20 em `docs/ARQUITETURA.md`).
- **Saídas curtas e longas.** Se viram seções separadas no relatório de saídas: o dono ainda não decidiu.
