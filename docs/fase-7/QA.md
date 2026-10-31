# Verificação técnica de F7

Data: 30/09/2026. Dados exclusivamente sintéticos. Evidência local e CI são
registradas separadamente de homologação institucional e implantação numa VPS.

## Gates automatizados

| Verificação                                                                             | Resultado observado                                                   |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Backend `mvnw.cmd -B -ntp verify`, JDK21/PostgreSQL17.11                                | 257 testes; zero falhas, erros ou ignorados; JAR produzido em 9min06s |
| Testes focados após correção de inicialização                                           | 10 passaram: ProductionModeGuard, ProductionAuth e comandos de conta  |
| Frontend `npm test -- --watch=false`                                                    | 191 testes em 35 arquivos passaram                                    |
| Frontend `npm run build`                                                                | Passou; gateway recompilou a versão integrada com marcador production |
| Frontend `npm run test:e2e`                                                             | 97 jornadas passaram em 5,2 minutos                                   |
| Recuperação `python -B -m unittest discover -s infra/production -p test_recovery.py -v` | 9 testes passaram                                                     |

A execução inicial da suíte backend integrada encontrou testes antigos que ainda
tratavam production como perfil fechado e uma raiz de armazenamento Linux usada
num teste Windows. Esses testes foram adaptados à configuração entregue; a suíte
final completa acima passou. Um teste novo reproduziu a inicialização de beans de
banco antes da recusa de configuração inadequada. A validação passou a executar
como BeanFactoryPostProcessor estático, e os dois casos confirmam recusa antes do
bean de inicialização.

Logs privados: `f7-backend-final.log`, `f7-backend-repair-focused.log`,
`f7-production-early-red.log`, `f7-frontend-full.log`, `f7-frontend-build.log` e
`f7-e2e-final.log`, na `.git/qa-auditoria/` da cópia principal.

## Imagens e configuração real

Os Dockerfiles produziram as imagens da versão integrada, com bases fixadas por
digest. Backend não executa migrações no perfil production. Num stack vazio, o
processo migration aplicou V1–V19 em ordem; initialize-runtime configurou a role
restrita. Database/backend/gateway passaram nos healthchecks.

- Backend `sager-backend:f7-final`: `sha256:c0c56cdff6257ad3969673da1d6856dd977b209d8e9c0c53eae215bd3388fdee`.
- Gateway final `sager-gateway:f7-final`: `sha256:894a64bd8ea4df3cdb52c2a71e6ffb02b894388e4562bf4c0fd7f363752216cf`.
- Stack funcional: `sager-f7-final-20260930`, portas loopback 9085/9445;
  PostgreSQL e backend sem porta publicada.
- Hostname sintético: `sager.example.test`, CA de teste e SAN correspondentes.
- Limites de execução: database 512 MiB/0,25 CPU, backend 1.024 MiB/0,65 CPU,
  gateway 96 MiB/0,10 CPU; total 1.632 MiB/1 CPU.

A primeira tentativa de acesso detectou PortBindings declarados sem porta
efetivamente publicada: o gateway estava somente na rede internal. A configuração
ganhou uma rede ingress exclusiva do gateway; os arrays NetworkSettings.Ports
passaram a conter os bindings loopback e a conexão TCP foi confirmada. Redes de
banco e comunicação interna permaneceram privadas.

O smoke também detectou que `docker compose config` sem o perfil maintenance
omitira os serviços administrativos do manifesto. O script agora renderiza com
esse perfil e verifica a presença dos serviços antes de criar seu stack.

A prova no navegador autenticado detectou outra falha do build: o CSS crítico
do Angular emitia stylesheet `media=print` e um ativador JavaScript inline,
recusado pela CSP. Os estilos globais não carregavam; o início em 320px expandia
até 1.875 px e o botão de login usava estilo padrão. Produção agora mantém minificação
e desabilita somente inlineCritical; o stylesheet é externo normal e a CSP foi
preservada. A imagem do gateway foi recompilada, substituída e verificada novamente.

## Prova funcional HTTPS

Oito cenários passaram com a aplicação real e PostgreSQL, sem interceptações.

| Cenário                 | Resultado observado                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provisionamento         | Cinco contas próprias criadas por CLI production com console oculto; senha fora de argumentos; comandos terminaram com código 0                                                                   |
| TLS e limites públicos  | Node validou CA, cadeia, data e hostname; CA e hostname errados foram recusados. HTTP 308, demonstração 404, métricas 404 e marcador production                                                   |
| Sessão e autorização    | Login real, cookie Secure/HttpOnly/Lax, escrita sem CSRF recusada com 403 e cruzamentos de papel com 403                                                                                          |
| Vínculos e desligamento | CLI de vínculo, disable e unlink revogaram sessões antigas (401); conta desativada não autenticou; residente sem vínculo perdeu acesso próprio                                                    |
| Documento permanente    | Pedido F4 real gerou PDF privado; supervisor e residente baixaram bytes, tamanho/hash e cabeçalhos iguais. Provedores desabilitados; APPROVE retornou 409 signature_required sem produzir decisão |
| Limite de login         | Cinco senhas erradas retornaram 401; tentativa seguinte, 429 rate_limited com Retry-After de 900 segundos. Role runtime confirmou buckets HMAC, sem email/IP bruto                                |
| Reinício                | Mesmo container/imagem, StartedAt novo; sessão do supervisor (200) e limite de login (429) preservados. Versão, histórico F4 e PDF permaneceram iguais                                            |
| Interface               | Quatro capturas finais em 1.440/320 px, estados reais, axe na região main sem violações, zero overflow e zero erros de página/API/console                                                         |

O cliente HTTPS usou `rejectUnauthorized=true` e CA explícita. Chromium usou
perfil isolado, resolução local do hostname, `ignoreHTTPSErrors=false` e exceção
restrita ao SPKI do certificado sintético; nenhum trust store global foi alterado.
Essa exceção permite testar a interface e não comprova confiança nativa da CA
pelo navegador. A semântica está no [código oficial Chromium](https://chromium.googlesource.com/chromium/src/+/8402d3c5bc13e018fa75eba650ed881755e0223b%5E%21/).

O smoke completo também passou depois da recompilação do gateway. Ele confirmou
HTTPS/cookies/CSRF/cabeçalhos, ausência de portas públicas do banco, runtime sem
privilégios administrativos/CREATE nem UPDATE/DELETE/TRUNCATE na auditoria, e
SELECT/INSERT permitidos. O guard do index recusou o artefato antigo (stylesheet
print + script inline) e aceitou o final (stylesheet ativo e zero script inline).
Seu stack descartável foi removido com conferência de zero containers/volumes/redes.

### Documento para recuperação

- Saída: `adf6a94d-6c71-4667-b9f9-b20ea3f9ec4c`.
- Revisão documental: `08944af9-55a4-4c0a-aa52-0780757c1dd1`.
- PDF original: 19.773 bytes, uma página, fonte embutida e conteúdo sintético conferidos.
- SHA256: `01fdf478dd750f472b28f05a9e99e17d4fc73c2bf253752a8e9c6541bb033ca1`.

### Capturas finais

- [Acesso desktop](../../.impeccable/reviews/pr-producao-acesso-desktop.png).
- [Acesso em 320 px](../../.impeccable/reviews/pr-producao-acesso-mobile.png).
- [Ajuda desktop](../../.impeccable/reviews/pr-producao-ajuda-desktop.png).
- [Início do residente em 320 px](../../.impeccable/reviews/pr-producao-inicio-mobile.png).

A raiz inspecionou um lote inicial e um lote final após a correção de CSS; não
houve rodadas visuais adicionais. A ajuda e o acesso mostram fluxo de conta real,
recuperação pelo operador e orientação por perfil.

## Carga e recuperação

### Carga local sob limites

A fixture PERF foi criada por APIs reais: 250 residentes menores, 250 alocações
ativas em 25 quartos de capacidade 10, 25 avaliações com nota 8, chamada de 250
participantes e consulta PRESENCA de 250 linhas. O stack também tinha a fixture
funcional F7: total de 251 alocações ativas. Para relatórios, a página medida
contém 100 linhas, o máximo do endpoint, de um snapshot validado com 250.

Em 30/09/2026 às 19:50:32 de São Paulo, foram agendadas 50 marcações PUT em 60 segundos
e 300 GET em seis cenários. Todas as 50 gravações terminaram dentro da janela;
350/350 respostas foram HTTP 200, zero drops/falhas e nenhuma resposta excedeu 2 s.
A API confirmou incremento de 50 versões e 50 presentes na chamada. A latência é
observada pelo cliente HTTPS, incluindo fila de socket/transferência, sem render
do navegador. Não houve outros helpers de API nem build/testes locais durante
o minuto; os outros cenários já estavam encerrados.

| Cenário (50 amostras cada)       | p50(ms) | p95(ms)  | Máximo(ms) |
| -------------------------------- | ------- | -------- | ---------- |
| Lista de residentes              | 103,54  | 229,22   | 526,15     |
| Mapa de quartos                  | 107,43  | 229,22   | 521,28     |
| Detalhe de residente             | 19,80   | 229,02   | 530,29     |
| Ranking de limpeza               | 101,82  | 228,89   | 527,17     |
| Relatório: 100/250 linhas        | 114,90  | 235,31   | 538,77     |
| PUT marcação de chamada          | 718,27  | 1.385,42 | 1.540,40   |
| GET chamada de 250 participantes | 720,59  | 1.424,57 | 1.548,92   |

Leituras agregadas: p50 = 112,37 ms, p95 = 821,51 ms, máximo = 1.548,92 ms.
Foram observados os limites do Compose (1 CPU/1.632 MiB), backend healthy e zero
OOM/reinícios. A série de amostras de CPU/RAM e os resultados brutos estão no
relatório privado `performance/performance-measure-results.json`.

Este ensaio passou no cenário medido. Foi um minuto sintético no Docker Desktop,
com sessão reutilizada e até 12 leituras concorrentes; não comprova desempenho
na VPS de 2 GB/1 CPU/50 GB, capacidade de picos maiores, renderização ou disponibilidade
mensal. Não foi usada cota de disco de 50 GB nesta medição.

### Recuperação da versão completa

O backup final usou a versão integrada e os dados dos ensaios funcional e de carga.
O pacote age tem 387.295 bytes e SHA256
`a23011b3144152658878a7344baaeb9b68b2a79abb0543ecf6c8e7217fcb55f6`.
A etapa com backend parado, incluindo a coleta adicional dos fingerprints para
esta prova, durou 90,58 segundos; a origem voltou a healthy.

A chamada de restauração em `sager-f7-final-recovery-20260930`, inicialmente vazio
e isolado, durou 11,50 segundos. As comparações externas abaixo ocorreram depois,
fora desse tempo:

- 54 tabelas: hashes e contagens exatos em 52; nas duas tabelas de sessão,
  descarte esperado de 24 sessões e 27 atributos para zero.
- Histórico V1–V19 e todas as 16 sequências iguais à origem.
- 862 eventos de auditoria, último número 862, com hash e contagem iguais.
- PDF legítimo, vínculo documental, tamanho e SHA256 iguais aos registrados acima.
- Nova tentativa no banco já ocupado recusada sem alterar seus dados.
- Backend e gateway do destino permaneceram parados; nenhuma sessão foi reutilizada.

A recusa de volume documental ocupado foi verificada na prova baseline e nos nove
testes do mesmo `recovery.py`. O destino final foi removido com conferência de
containers e volumes; a origem permaneceu saudável após a prova. Os resultados
brutos estão em `final-recovery/final-recovery-state.json`, na área privada de QA.
Não houve jornada HTTP no destino recuperado. O runbook exige inicializar a role
runtime e conferir os fluxos antes de direcionar tráfego operacional.

Após arquivar a evidência, os dois stacks de origem usados nesta sessão foram
removidos. A conferência por label Compose encontrou zero containers, volumes ou
redes de cada projeto exclusivo; o pacote criptografado e os relatórios foram
preservados fora dos arquivos versionados.

## CI da entrega

O workflow entrega três gates: Backend · PostgreSQL, Frontend · Chromium e
Infrastructure · HTTPS. O terceiro compila as imagens e executa o smoke descartável
do commit de integração. O [PR de F7](https://github.com/dlr-1337/SAGER/pull/14)
registra o resultado da execução final antes da
mesclagem; nenhuma aprovação anterior substitui a conferência do commit final.

## Limites do aceite

Não foram executados treinamento com usuários reais, piloto mensal de disponibilidade,
MTBF/MTTR, carga na VPS definitiva ou aceite AE/TI. O gateway de WhatsApp não foi
testado com número real. As medições acima são anteriores a ele; com o gateway ligado, a
mesma VPS precisa de 2 vCPU e 4 GB mais swap ([operação](../whatsapp/OPERACAO.md)). O [roteiro](HOMOLOGACAO.md) registra o
método e os responsáveis para essas verificações externas. Nenhuma rotina agendada
foi criada nesta entrega.
