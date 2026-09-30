# QA de comunicações e disciplina — F5

Executado em 30/09/2026, com dados sintéticos. As políticas seguem o contrato
local da fase; esta verificação não representa homologação institucional.

## Gates automatizados

| Execução                                                                      | Resultado                                           | Evidência                                                 |
| ----------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| Backend integrado F4/F5, JDK 21 e PostgreSQL 17.11: `mvnw.cmd -B -ntp verify` | 230 testes, zero falhas/erros/ignorados; JAR gerado | Log privado `f5-backend-full.log`, finalizado às 18:03:53 |
| Frontend: `npm test -- --watch=false`                                         | 31 arquivos, 172 testes aprovados                   | `f5-frontend-full.log`                                    |
| Frontend: `npm run build`                                                     | Bundle de produção compilado                        | `f5-frontend-build.log`                                   |
| Frontend: `npm run test:e2e`                                                  | 87 jornadas aprovadas                               | `f5-e2e-full.log`                                         |

As jornadas com interceptação de API verificam a interface. A prova abaixo
acessou o frontend compilado, o JAR e um PostgreSQL real, sem interceptações.
O gate integrado inclui retorno longo tardio → evidência canônica F5, sem
emissão automática de advertência.

No primeiro CI, backend passou e três testes de teclado falharam: enviavam
Escape antes de abrir os diálogos que conferem dados pela API. Os testes foram
corrigidos para aguardar a abertura e verificar fechamento e retorno de foco.
Os três casos dirigidos passaram localmente; o CI da revisão corrigida verifica
novamente a seleção completa de 86 jornadas sem a captura central.

## Prova na aplicação real

Ambiente descartável: PostgreSQL 17.11 em `127.0.0.1:5548`, JAR na porta 8084
e frontend/proxy na porta 4346. Quatro contas foram criadas pelo CLI administrativo
com senha via console oculto, sem argumento de senha: supervisor, gestor e dois
residentes. Os vínculos com residentes foram feitos explicitamente por UUID.
A criação de moradores pela API de gestão não provisionou credenciais.

| Fluxo                                                           | Resultado observado                                                                                                                                                                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chamada fora da janela com justificativa; ausência e fechamento | A notificação surgiu somente após o fechamento. Nenhuma advertência automática.                                                                                                                                |
| GET, visualização, análise e cancelamentos                      | GET não alterou eventos; visualização foi explícita. Cancelar revisão/arquivamento/conversão não emitiu decisão. Análise foi ação separada.                                                                    |
| Conversão humana pela interface                                 | Uma advertência vigente; repetir o payload com a mesma chave retornou o mesmo UUID, sem duplicar.                                                                                                              |
| Permissões e propriedade                                        | Residente recebeu 403 para notificação interna; outro residente recebeu 404 para comunicação/PDF próprios alheios; gestor recebeu 403 no recurso operacional de advertências.                                  |
| Leitura e ciência                                               | GET manteve ambas ausentes. Leitura não registrou ciência. Ciência exigiu confirmação na interface e a versão exata; repetição preservou o instante e versão incorreta recebeu 409.                            |
| Reincidência e termo                                            | Segunda advertência manual, mesma categoria e origem distinta. Candidatura foi revista; tentativa sem confirmação humana permaneceu bloqueada. Termo emitido pela interface com situação real `EMITIDO`.       |
| PDF privado                                                     | Downloads do supervisor, residente e interface tiveram hash/tamanho iguais; PDF alheio foi recusado e resposta usou `no-store`.                                                                                |
| Aviso e revisão                                                 | Rascunho não apareceu para residente. Publicação e nova versão mantiveram destinatário UUID congelado. Versão anterior ficou `SUPERADO` com leitura/ciência preservadas; nova versão teve evidências próprias. |
| Origem corrigida                                                | Mesma ocorrência, duas revisões, origem invalidada e `requiresReview`. Advertência permaneceu `VIGENTE`, termo `EMITIDO`; ciência histórica e PDF original foram preservados.                                  |
| Reinício real do JAR                                            | Sessões existentes continuaram válidas. Chamada, ocorrência, notificação, duas advertências, termo, aviso, duas versões publicadas, ciência e auditoria coincidiram com o estado anterior.                     |

O helper de QA foi retomado no mesmo estado depois de corrigir esperas de
diálogo e seletores ambíguos. Esses ajustes não alteraram código do produto.
Os seis cenários funcionais e a prova de reinício terminaram aprovados.

JAR anterior/posterior: SHA256
`CCDB9CF5BC95E74219844D2BA10A8F1000706675E02DAEA94621FAE3C13419B3`.
O processo anterior foi identificado por PID e linha de comando antes da parada;
o reinício usou o mesmo JAR e o mesmo banco, com novo PID.

Os cinco PDFs — supervisor, residente, interface, origem corrigida e pós-reinício —
foram lidos por um parser independente. Cada um tem uma página, texto do termo e
do residente sintético, fonte incorporada e 19.309 bytes. SHA256 comum:
`d69d25603c3b2ec2f34a6e1e9a1171c9aa3d7cbe6bf0adf180ce2371804db465`.

## Interface e acessibilidade

Capturas em duas rodadas, com navegador no fuso `Pacific/Auckland` e datas civis
derivadas do servidor. As cinco páginas tiveram zero rolagem horizontal e zero
violações axe no conteúdo `main` (`wcag2a`, `wcag2aa`, `wcag21aa`). Cancelamento
por Escape e retorno de foco foram verificados.

- Desktop 1440 px: `pr-comunicacoes-notificacao-desktop.png`,
  `pr-comunicacoes-advertencia-desktop.png`, `pr-comunicacoes-termo-desktop.png`.
- Mobile 320 px: `pr-comunicacoes-aviso-mobile.png`,
  `pr-comunicacoes-termo-mobile.png`.

Capturas ficam em `.impeccable/reviews/`. Logs, scripts, estado sintético,
sessões de QA e PDFs ficam somente na pasta privada `.git/qa-auditoria/f5-*`.
Sessões, credenciais e PDFs de prova não integram o Git.

A raiz inspecionou as cinco imagens em um lote, sem encontrar defeito visual.
O detector Impeccable dos arquivos de navegação e início local retornou `[]`;
os arquivos de comunicações foram verificados pelo responsável pela interface.

- [Notificação em desktop](../../.impeccable/reviews/pr-comunicacoes-notificacao-desktop.png).
- [Advertência em desktop](../../.impeccable/reviews/pr-comunicacoes-advertencia-desktop.png).
- [Termo em desktop](../../.impeccable/reviews/pr-comunicacoes-termo-desktop.png).
- [Aviso em 320 px](../../.impeccable/reviews/pr-comunicacoes-aviso-mobile.png).
- [Termo em 320 px](../../.impeccable/reviews/pr-comunicacoes-termo-mobile.png).

## Limites

A prova real utilizou chamadas e uma segunda origem manual; retorno curto/longo,
concorrência, rollback de auditoria e limites são cobertos pelos testes de
integração. Não foi feita chamada a provedor real de assinatura ou mensageria,
nem foram utilizados dados clínicos ou pessoais reais. Ciência registrada no
SAGER não foi apresentada como assinatura digital externa.
