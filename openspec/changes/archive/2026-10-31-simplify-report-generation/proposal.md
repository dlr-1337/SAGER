## Why

O dono do produto não achou como gerar um relatório. Em nenhum modo existe a ação "gerar". Na demonstração há só "Simular exportação". No modo real, o mesmo de produção, são 6 cliques, 2 diálogos de confirmação, rolagem de 5 telas até "Preparar PDF", atualização manual e palavras como "recorte preservado". Recarregar perde o estado, e não há lista de relatórios gerados.

Também descumpre AC67 (filtros visíveis) e AC69 (PDF e Excel visíveis), e a documentação diz que a tela acompanha o estado, mas ela não acompanha.

## What Changes

- Uma tela só em `/relatorios`: escolher o tipo em cartões, escolher o período, clicar em "Gerar relatório".
- Um clique prepara PDF e Excel. Sem diálogos, pois é só leitura. A auditoria continua.
- Andamento automático na própria tela, e botões grandes de baixar quando ficar pronto.
- Lista de relatórios gerados, com validade de 24 horas, inclusive após recarregar.
- Falha com "Tentar de novo"; zero registros orienta a mudar o período, sem criar arquivo.
- Filtros opcionais recolhidos, e a falha deles não bloqueia a tela.
- PDF e Excel legíveis: rótulos em português, datas `dd/mm/aaaa`, sem UUID, nome de arquivo claro.
- Demonstração com o mesmo fluxo, sem baixar arquivo.

**Fora do escopo:** mudar quem acessa, validade, limites de 366 dias e 10 mil linhas, barra de porcentagem, WebSocket.

## Capabilities

### New Capabilities

- `report-generation`: gerar, acompanhar e baixar relatórios de forma simples.

### Modified Capabilities

Nenhuma.

## Impact

- **Backend:** `GET /api/v1/relatorios/consultas`, nova tentativa após falha em `ReportService`, `ReportExportWorker`, OpenAPI.
- **Frontend:** `reports-local.pages.ts`, `reports-local-api.service.ts`, `reports.pages.ts`, novo serviço demo, estilos, testes.
- `docs/fase-6/README.md`, `docs/fase-6/CONTRATO.md`.
- **Efeito:** cada geração produz dois arquivos, o que dobra o trabalho do worker perto de 10 mil linhas.
