# Limpeza, ranking e relatórios persistidos

Fase 6 de E13–E14 e AC61–AC72, com decisões locais delegadas registradas no
[contrato](CONTRATO.md). O [QA](QA.md) distingue execução automatizada, prova real
com registros sintéticos e homologação institucional pendente.

## Avaliações e ranking

Supervisor registra quatro critérios de 0 a 10, com peso igual. O servidor
calcula média e arredondamento, captura participantes no instante avaliado e
informa regra, data civil de São Paulo e período. Registro histórico exige motivo;
correção exige versão e justificativa, preservando quarto, data e valores antigos.

A tela mostra nota nova, comparação com a revisão anterior e posição do quarto.
Primeira avaliação não inventa nota anterior. Ranking semanal, mensal e semestral
conserva empates `1, 1, 3` e distingue nota zero de ausência de avaliação.

Gestor e supervisor consultam avaliações administrativas. Residente consulta
somente avaliações da sua participação histórica; no ranking dos outros quartos,
recebe código e posição, sem nota ou nomes. Avaliação abaixo de 6 gera evidência
F5 para análise humana. Correção revisa a mesma origem sem advertência automática.

## Consultas e exportações

Catálogo administrativo: presença, saídas, limpeza, ocorrências, notificações,
advertências, termos e consolidado. Período, alojamento, casa ou bloco, quarto,
residente UUID e situação são filtros combináveis e tipados. Dados clínicos não integram o catálogo.

Criar consulta preserva filtros, linhas, resumo, séries mensais, regra e instante.
Prévia paginada e exportação usam esse mesmo conjunto, mesmo após mudanças no
domínio. PDF e XLSX contêm todas as linhas da consulta. Entradas de texto do XLSX
não geram fórmulas. Os gráficos têm tabelas como alternativa de leitura.

Consulta pertence ao autor e dura 24 horas. Exportação usa tarefa persistida,
com lease, retomada após reinício e integridade SHA-256. Um clique em "Gerar
relatório" cria a consulta e pede PDF e Excel, sem diálogo. A tela consulta a lista a
cada 3 segundos só enquanto há arquivo em preparo e mostra o download quando pronto.
Arquivo com falha volta à fila por "Tentar de novo". Período sem registros não pede
arquivo nem entra na lista. Residentes não recebem
exportações administrativas e outra conta não abre a consulta pelo UUID.

## API e operação

- `/api/v1/limpeza/politica`, `/avaliacoes`, `/avaliacoes/{id}/corrigir` e `/ranking`.
- `/api/v1/me/limpeza/avaliacoes`: consulta do residente por participação capturada.
- `/api/v1/relatorios/catalogo` e `POST /relatorios/consultas`.
- `GET /api/v1/relatorios/consultas`: consultas válidas do autor com registros e o
  estado das exportações, sem as linhas.
- `/api/v1/relatorios/consultas/{id}` e `/linhas`: resumo e prévia paginada.
- `/api/v1/relatorios/consultas/{id}/exportacoes`: tarefa PDF/XLSX.
- `/api/v1/relatorios/exportacoes/{id}` e `/arquivo`: estado e download privado.

Limites: 366 dias, 10.000 linhas, página padrão 20 e máxima 100. Excesso é recusado
sem truncamento. `sager.reports.private-root` precisa apontar para raiz privada
própria; ela não pode coincidir com `sager.documents.private-root`.

A limpeza de artefatos expirados abrange somente consultas e arquivos transitórios
de relatório. Documentos de saída, termos, histórico de domínio e auditoria
permanente são preservados. O backup consistente deve incluir o banco e os
documentos permanentes. Regras e desempenho na VPS exigem homologação posterior.
