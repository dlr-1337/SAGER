# Roteiro de implementação ponta a ponta do SAGER

**Base:** [PRD v2.0](../SAGER_PRD_v2.0_Angular_SpringBoot.md) e
[Especificação Técnica v2.0](../SAGER_Especificacao_Tecnica_v2.0.md).

**Estado:** plano de execução; não registra homologação institucional nem prazo contratado.

**Escopo:** os épicos E01–E15, os critérios funcionais AC01–AC72, os critérios técnicos
AT01–AT18 e as oito jornadas integradas do PRD.

A divisão em Fases 0–7 segue a seção 15 da especificação técnica e detalha a ordem
proposta na seção 22.3 do PRD, sem retirar funcionalidades.

## Ponto de partida e modo de entrega

O repositório tem uma aplicação Angular navegável em `frontend/`. As fatias ainda
não integradas usam serviços em memória; a demonstração usa seleção de perfil em
`sessionStorage`; a assinatura é simulada; relatórios e ranking usam dados de exemplo.
Em 26/09/2026, o solicitante substituiu a antiga prova Google OIDC por login local
provisório em `backend/`, limitado a desenvolvimento e teste. O login foi integrado
ao Angular; ainda não há `infra/`. A primeira fatia de supervisores já persiste
no PostgreSQL, assim como residentes, responsáveis, alojamentos, quartos e
alocações com histórico. Essas fatias receberam [aceite técnico local](fase-2/QA.md)
em 29/09/2026. As demais telas existentes são a base visual e funcional para
as próximas fatias.

Em 30/09/2026, o solicitante escolheu o login próprio do SAGER, com integrações
SUAP/Google adiadas; confirmou cadastro manual, nascimento obrigatório,
supervisor com autoridade de gestão, uma única autorização de qualquer responsável
cadastrado para saída longa, compartilhamento entre profissionais de saúde e
retenção permanente da auditoria. A implementação atual do login continua local;
a configuração e a validação de produção ainda precisam ser concluídas.

A arquitetura de referência é o monólito modular Spring Boot com PostgreSQL/Flyway,
sessão e autorização no servidor, Angular e API na mesma origem, arquivos privados e
integrações externas por adaptadores com tarefas persistentes. A Fase 0 confirma as versões
exatas e os serviços institucionais; as escolhas de família estão na especificação técnica.

Cada fase entrega fatias completas: contrato HTTP, regra no serviço, migração e restrições do
banco, autorização por perfil e registro, tela ligada à API, estados de erro/vazio,
auditoria pertinente, testes e documentação. O serviço demonstrativo da fatia é retirado do
fluxo operacional quando a integração correspondente estiver pronta. Dados e identidade
simulados ficam restritos a desenvolvimento e teste. E15 (experiência por perfil,
responsividade e ajuda) acompanha as fases e é fechado na Fase 7.

## Fases e critérios de saída

### Fase 0 — Preparação e decisões

**Objetivo:** tornar implementáveis as regras e integrações sem supor políticas da AE ou da TI.

1. Registrar decisões D01–D26 com responsável, valor aprovado, data, requisito afetado e
   versão do PRD. Priorizar D01/D02/D19/D21 para identidade, cadastro e quartos; agendar as
   demais antes das fases que dependem delas.
2. Confirmar versões exatas de Java, Spring Boot, PostgreSQL, Angular e bibliotecas; fixar
   estratégia de lockfiles, Maven Wrapper e ambientes com dados sintéticos.
3. Validar o login próprio escolhido em 30/09/2026; documentar identificador estável,
   provisionamento, perfis, desligamento, recuperação e política de sessão. A prova
   atual em loopback cobre desenvolvimento; o ambiente de produção requer configuração
   e testes próprios. Integrações SUAP/Google ficam para uma fase futura.
4. Validar com a instituição o nível de assinatura exigido, a identidade do responsável e o
   aceite do gateway WhatsApp não oficial (nota da Fase 4).
5. Concordar no primeiro contrato vertical de API, erros, datas, autorização e dicionário
   cadastral; atualizar o modelo de dados quando decisões alterarem vínculos ou estados.

**Saída verificável:** decisões necessárias à Fase 1 registradas, versões reproduzíveis
definidas, prova do login próprio no ambiente previsto documentada e responsáveis indicados para as
integrações externas. Ausência de credenciais ou contratação não paralisa módulos
independentes, mas mantém a homologação dessas integrações pendente.

**Estado em 26/09/2026:** os [registros da Fase 0](fase-0/README.md) documentam versões,
integrações e D01–D26. O JDK 21 foi instalado; a falha de reinício do Docker Desktop
4.91.0, o reinício e a partida fria bem-sucedidos após a atualização 4.92.0 estão
registrados no QA.
A antiga prova Google passou em testes sintéticos, mas
foi [descontinuada](fase-0/AUTENTICACAO_GOOGLE.md). O
[login local provisório](fase-0/AUTENTICACAO_LOCAL.md) foi integrado ao backend e
ao Angular, com [aceite técnico local](fase-0/QA.md) para desenvolvimento e teste.
Essa evidência é histórica. A escolha de login próprio foi confirmada em 30/09/2026;
configuração de produção, prova com contas autorizadas e aceite TI/AE permanecem
pendentes; **a Fase 0 não está homologada**.

### Fase 1 — Fundação técnica e primeira fatia real

**Cobertura:** E01; AC01–AC03; início de E15; AT01 e AT03–AT06. AT02 fecha na
implantação da Fase 7.

1. Criar `backend/` com Maven Wrapper, Spring MVC, validação, Spring Security, Spring
   Session JDBC, PostgreSQL, Flyway, perfis de ambiente, erros padronizados e OpenAPI.
2. Integrar o login local provisório somente em desenvolvimento/teste, com contas
   criadas por operador, perfis locais explícitos, sessão, `/api/v1/auth/me`, CSRF e
   logout. Fora do perfil local, o backend falha fechado até concluir a configuração
   e a validação do login próprio em produção. Implementar autorização por endpoint **e** por registro
   nas fatias reais, a partir da matriz D01 aprovada.
3. Criar auditoria transacional e observabilidade básica. Definir UUID, datas, paginação,
   controle de versão e conflitos como convenções da API.
4. Integrar uma primeira fatia protegida de cadastro/consulta de residente ao Angular,
   usando um serviço de API e banco real. Unificar o identificador do residente entre gestão e
   operações antes de expandir os módulos. A D02 autoriza digitação local provisória:
   nome, matrícula, nascimento e curso (desde 31/10/2026) obrigatórios, UUID interno estável
   e matrícula única após retirar espaços nas pontas. Não inferir matrícula do login;
   origem e validação institucionais continuam pendentes.
5. Criar pipeline de build, testes Java/Angular e migração em PostgreSQL de teste, sem dados
   reais nem segredos no repositório.

**Saída verificável:** após reiniciar a aplicação, o cadastro da fatia continua disponível;
um perfil sem permissão e a troca de ID são bloqueados; sessão, CSRF e logout funcionam;
migrações constroem banco vazio e testes passam. O login real fecha AC01/AC02 e AT03
somente após prova do login próprio no ambiente de produção previsto.

**Decisões de entrada:** D01, D02 e D21; D22 para acesso e tratamento inicial de dados
sensíveis.

**Estado em 30/09/2026:** backend, sessão local, migrações e fatias cadastrais
persistidas estão implementados. O [CI](CI.md) verifica backend em PostgreSQL,
Angular e jornadas Chromium no GitHub Actions; os resultados estão no
[QA](fase-2/QA.md). A [fundação da API](fase-1/FUNDACAO.md) implementa erros
padronizados, OpenAPI protegido, auditoria transacional permanente e
observabilidade básica. Vínculos explícitos entre contas e cadastros têm
revogação de sessão e persistência comprovada após reinício. A configuração
de autenticação para produção e a homologação da Fase 1 permanecem pendentes.

### Fase 2 — Residentes, responsáveis, supervisores e quartos

**Cobertura:** E02–E04; AC04–AC08 e AC11–AC15. AC09/AC10 fecham com a saída longa.

1. Persistir residentes, matrícula, condição etária, responsáveis ativos e vínculos;
   proteger informações médicas em recurso e permissão separados.
2. Integrar cadastro e edição de supervisores ao gestor autenticado (só ele, desde 31/10/2026);
   as contas locais usadas em desenvolvimento não substituem o provisionamento
   e a validação de contas no ambiente de produção.
3. Persistir alojamentos, unidades internas opcionais (casas/blocos) e quartos com piso
   opcional. Distinguir código globalmente único de número local textual único na mesma
   localização; manter capacidade editável, positiva ou ausente, e situação manual.
   Integrar o mapa por alojamento/unidade/piso, com legenda e atualização após gravação.
   Integrar vínculos de ocupação com as regras provisórias da quinta fatia.
4. Trocar os serviços demonstrativos de gestão por serviços de API; garantir que operações
   posteriores usem os mesmos IDs e vínculos. Testar validações, unicidade, concorrência e
   acesso a registros de outros residentes.

**Saída verificável:** cadastros e mapa refletem o PostgreSQL após reinício; permissões e
vínculos são aplicados no servidor; dados médicos ficam fechados até a matriz ser aprovada;
as telas não apresentam ocupação ou nota inventada.

**Decisões de entrada:** D01, D02, D15 e D19; D22 para retenção e acesso aos dados.

**Estado em 29/09/2026:** a [primeira fatia de supervisores](fase-2/README.md) persiste
o cadastro funcional no PostgreSQL, com API inicialmente restrita ao gestor local e telas integradas;
o [QA](fase-2/QA.md) registra testes e prova após reinício. A fatia de alojamentos,
unidades e quartos foi implementada, com mapa local inicialmente vazio,
leitura por gestor/supervisor e gravação por gestor. O [aceite técnico local](fase-2/QA.md)
registra cadastro e edição pelo navegador em PostgreSQL 17.11, conflito sem sobrescrita
entre duas abas e preservação da estrutura, capacidade e sessão após reinício.
A terceira fatia persiste o cadastro básico de residentes por digitação provisória
do gestor local, com leitura para gestor e supervisor. Nome e matrícula são
obrigatórios, nascimento e curso opcionais; a fonte institucional da matrícula
continua pendente na D02. A demonstração conserva dados fictícios isolados.
A quarta fatia persiste responsáveis vinculados aos residentes, permitindo
vários registros por estudante, com nome, vínculo declarado, telefone opcional
e estado ativo. Gestor local grava; gestor e supervisor consultam. O vínculo
aparece no detalhe do residente; autorização, prioridade, comprovação legal e
destinatário de saída longa continuam pendentes na D15.
A quinta fatia integra alocação, transferência e encerramento locais, com um
quarto ativo por residente, histórico persistido, limite pela capacidade
definida e bloqueio de novas entradas em Manutenção ou Indisponível. Ocupação
passa a ser calculada por vínculos ativos; vagas livres continuam desconhecidas
onde a capacidade não foi definida, e somatórios incompletos são parciais.
A situação do quarto permanece manual e a nota de limpeza sem avaliação.
Os anexos recebidos servem como referência privada, com divergências de estrutura
e capacidade registradas na [D19](fase-0/DECISOES.md), sem carga de estudantes reais.
As demais operações continuam demonstrativas. Reservas, exceções de lotação,
correção de histórico, D01/D02/D15/D19/D22 e a homologação institucional
permaneciam pendentes nessa data. O aceite técnico de cada fatia não encerra a Fase 2.
O [pacote de decisões e aceite AE/TI](fase-2/PACOTE_AE_TI.md) reúne as regras
locais implementadas, as divergências conhecidas e os campos de aprovação que
dependem de evidência institucional.

**Atualização em 30/09/2026:** gestor e supervisor consultam, cadastram e editam
todos os cadastros de gestão existentes, incluindo supervisores, e movimentam
alocações. O supervisor mantém sua autoridade operacional sem receber acesso
médico pelo perfil geral. Nome, matrícula e nascimento são obrigatórios nas novas
gravações e edições de residentes; registros legados sem nascimento continuam
legíveis e exigem preenchimento ao editar. A matrícula é digitada manualmente;
integração SUAP foi adiada. A planilha do ZIP prevalece nas capacidades divergentes
de R4 e Laticínio; o PDF complementa o inventário ausente, sem inferir quartos ou
distribuições. Uma autorização conferida de qualquer responsável cadastrado e vinculado
será suficiente na saída longa da Fase 4. Dados médicos terão compartilhamento entre
profissionais de saúde, respeitado o sigilo profissional. Auditoria terá retenção
permanente na fundação já implementada. A área de saúde agora usa habilitações
profissionais e vínculos assistenciais explícitos, notas privadas com partilha
selecionada, revisões imutáveis, custódia e acesso próprio do paciente, conforme
o [contrato local](fase-2/SAUDE_CONTRATO.md). Revogar bloqueia o acesso assistencial
mesmo em sessões existentes;
a renovação não recupera partilhas antigas. Essas escolhas técnicas foram
delegadas pelo solicitante e não registram homologação institucional.
Exceções de lotação, correção de histórico,
comprovação de vínculos, detalhes do recurso médico e implantação continuam abertos;
as perguntas já respondidas deixam de bloquear o projeto.

### Fase 3 — Chamada, saída curta, decisão e retorno

**Cobertura:** E05, E06/E07 na modalidade curta e E08; AC16–AC20, AC22–AC24,
AC27–AC29, AC31–AC32 e AC33–AC38. AC21 fecha na Fase 5.

1. Implementar chamada dos residentes menores, completude, registro às 22h30, confirmação
   tardia e ausência justificada apenas por autorização válida.
2. Persistir solicitação curta com horário inicial, retorno inicial em +3 horas e validação
   do limite na tela, no serviço e no banco, inclusive após edição.
3. Implementar decisão do supervisor com modal de revisão, rejeição justificada, linha do
   tempo, comunicação do resultado ao residente e detecção de saída vencida, segundo as
   transições homologadas.
4. Registrar retorno curto após verificação presencial, com horário real, observação
   obrigatória no atraso e um único retorno mesmo sob requisições concorrentes.
5. Persistir eventos de ausência e atraso como origem rastreável para notificações futuras;
   só gerar alerta quando os critérios da AE estiverem configurados.

**Saída verificável:** jornada chamada → saída curta → aprovação → retorno executada entre
perfis reais; cancelamento do modal não grava; período inválido, auto confirmação de retorno
e decisões concorrentes são recusados; atraso e histórico permanecem corretos após reinício.

**Decisões de entrada:** D03–D09. D13 condiciona a geração de alertas, que fecha na Fase 5.

**Estado em 30/09/2026:** chamada e saída curta persistidas, com decisão,
partida/retorno físicos, expiração transacional, correções imutáveis e auditoria.
As rotas autenticadas usam a API; o início local apresenta ações disponíveis,
sem os indicadores sintéticos da demonstração. O [contrato](fase-3/README.md)
registra as regras delegadas de janela, idade, alocação, duração e expiração.
O [QA](fase-3/QA.md) registra os testes e a prova integrada com reinício.
Alertas disciplinares fecham na Fase 5; esta entrega não registra aceite da AE/TI.

### Fase 4 — Saída longa, WhatsApp, documento e autorização

**Cobertura:** E06/E07 na modalidade longa e E09; AC09–AC10, AC25–AC26, AC30 e
AC39–AC44; AT09–AT12.

**Nota de substituição (2026-10-31):** Clicksign, Meta e o convite por link foram
retirados por decisão do dono do produto. Os itens abaixo já descrevem o fluxo novo, e a
operação está em [docs/whatsapp/OPERACAO.md](whatsapp/OPERACAO.md).

1. Validar responsável cadastrado, vinculado e autorizado e telefone pré-cadastrado;
   uma autorização conferida de qualquer um deles é suficiente, sem exigir a
   de ambos os pais. Criar solicitação e tarefa de
   integração na mesma transação. Versionar os dados usados para gerar o documento.
2. Gerar e guardar PDF em volume privado, com metadados, hash e versões imutáveis. Servir
   downloads somente pelo backend, após autorização por vínculo.
3. Implementar o gateway de WhatsApp atrás de uma interface única, envio mínimo de dados,
   estado das mensagens, reenvio, retentativas com lease e recuperação após reinício.
4. Autenticar webhooks e deduplicar eventos. Guardar o arquivo recebido com hash, como
   candidato, e exigir conferência de um supervisor antes de liberar a aprovação.
5. Retirar a rota pública de assinatura, oferecer anexo manual e exibir separadamente
   estado da solicitação, da mensagem e da autorização.

**Saída verificável:** jornada longa com o teste de aceite em número de teste, inclusive falha
e reenvio; webhook inválido ou antigo não altera a saída; queda do processo preserva a
tarefa; falha de armazenamento e ausência de conferência bloqueiam aprovação. A integração
real só fecha após aceite institucional e número dedicado.

**Decisões de entrada:** D07, D15–D17 e D25; aceite formal da integração não oficial e
requisitos de segurança antes de ativar o fluxo real.

**Estado em 31/10/2026:** saídas longas com revisão e PDF privado, envio pelo gateway,
webhook autenticado, conferência humana, anexo manual e conversas para supervisor, com
interface ligada à API. O [contrato local](fase-4/CONTRATO.md) registra o fluxo. Nada foi
testado com número real, e o [registro técnico](fase-4/QA.md) de 30/09 é anterior a essa troca.
O gateway fica desligado por padrão.

### Fase 5 — Ocorrências, notificações, avisos e termos

**Cobertura:** E10–E12 e AC21, AC45–AC60.

1. Registrar ocorrências com origem em chamada, retorno e, quando disponível, limpeza;
   aplicar apenas critérios e gravidades versionados e homologados.
2. Implementar estados de notificação, visualização, análise, arquivamento justificado e
   conversão **manual** em advertência, preservando a origem e impedindo duplicatas.
3. Registrar advertência manual e avisos direcionados; separar leitura de ciência explícita
   e mostrar ao residente apenas seus próprios itens.
4. Implementar o Termo de Compromisso vinculado a reincidência confirmada, ocorrências,
   supervisor, documento e evidência de ciência/assinatura conforme procedimento da AE.

**Saída verificável:** ocorrência → análise humana → advertência → ciência e reincidência →
termo passam por API, banco e interface; nenhum limiar isolado aplica sanção ou termo
automaticamente; leitura não equivale a ciência.

**Decisões de entrada:** D12–D14 e D18; D13 governa também o alerta derivado da chamada.

**Estado em 30/09/2026:** evidências canônicas de chamada e retorno curto/longo,
análise humana, advertências, avisos versionados e termos privados persistidos.
Leitura e ciência são distintas e vinculadas à versão. Correção preserva decisões
históricas e exige revisão humana. O [contrato](fase-5/CONTRATO.md), a
[jornada](fase-5/README.md) e o [QA](fase-5/QA.md) registram regras delegadas,
230 testes de backend, 172 de frontend, 87 jornadas e prova real com reinício.
Limpeza entra na Fase 6; homologação do procedimento e assinatura real permanecem
externas.

### Fase 6 — Limpeza, ranking, painéis e relatórios

**Cobertura:** E13–E14; AC61–AC72; ampliação de E15; AT13–AT14.

1. Persistir avaliações e critérios da AE com versão da regra. Calcular nota, diferença e
   posição no servidor; atualizar o feedback da tela com o resultado gravado.
2. Derivar ranking semanal, mensal e semestral dos registros reais, mantendo detalhes de
   outros quartos privados e sem uma classificação independente editável.
3. Integrar painéis por perfil, histórico individual e gráficos aos dados autorizados,
   com alternativa textual, período coerente e estado explícito quando não houver dados.
4. Implementar relatórios com filtros combinados e exportações PDF/XLSX que preservem os
   mesmos filtros, permissões e dados da prévia. Medir consultas e processar exportações
   grandes sem bloquear a interface.

**Saída verificável:** avaliação → ranking → relatório e exportação usam o mesmo conjunto
persistido; primeira avaliação não inventa variação; dados privados não aparecem em gráficos
ou arquivos de outro perfil; ausência de dados não produz números fictícios.

**Decisões de entrada:** D10, D11 e D20; D13 para alertas de nota baixa.

**Estado em 30/09/2026:** avaliações, participantes históricos, correções,
ranking com empates e privacidade por perfil, indicadores com alternativa textual
e consultas privadas com PDF/XLSX persistidos. Prévia e exportação usam o mesmo
snapshot e as tarefas retomam por lease. O [contrato](fase-6/CONTRATO.md), a
[jornada](fase-6/README.md) e o [QA](fase-6/QA.md) registram as regras delegadas,
245 testes de backend, 189 de frontend, 97 jornadas e prova real com reinício.
Não há pontuação moral de comportamento ou sanção automática. Homologação da AE
e medição na infraestrutura operacional continuam externas.

### Fase 7 — Operação assistida e liberação do produto completo

**Cobertura:** E15 e aceite final de E01–E14, AC01–AC72 e AT01–AT18.

1. Concluir ajuda contextual, manuais por perfil, tutoriais/FAQ, treinamento e revisão de
   teclado, foco, mensagens e telas pequenas. Validar as metas de aprendizado da SRS
   (2 horas para supervisores e 30 minutos para residentes) e a taxa de erro de uso abaixo
   de 5% com tarefas e método acordados pela AE/TI.
2. Entregar Nginx/HTTPS, aplicação e PostgreSQL em Compose, com banco e porta interna
   privados, arquivos persistentes, segredos externos, logs seguros e métricas operacionais.
3. Ensaiar migração de versão, backup e restauração **do banco e dos arquivos**, com registro
   do ponto recuperado e tempo gasto. Documentar contingência e responsabilidades da TI.
4. Medir na VPS prevista de 2 GB/1 CPU/50 GB os cenários acordados para 250 residentes,
   50 transações/minuto e limite de resposta de 2 segundos; registrar resultado real e
   corrigir falhas antes da liberação.
5. Instrumentar disponibilidade, falha crítica e reparo para acompanhar no piloto as metas
   de 99% mensal, MTBF de 500 horas e MTTR de até 4 horas. Formalizar finalidade,
   retenção/descarte dos demais dados, acesso a dados médicos, resposta a incidentes e escopo da
   contingência com AE/TI.
6. Executar os oito fluxos de homologação do PRD com AE/TI, incluindo autenticação e
   integrações reais, falhas, concorrência, permissões e restauração. Fechar os 72 critérios
   funcionais, os 18 técnicos e as decisões institucionais que bloqueiam uso real.

**Saída verificável:** evidências de homologação, relatório de carga, teste de restauração,
manual e configuração de produção aprovados; nenhuma autenticação demonstrativa, sanção
automática, aprovação longa sem evidências ou acesso indevido a dados privados.

**Decisões de entrada:** D22–D24 e D26, além de toda decisão anterior ainda pendente para
operação real. Falha de requisito não funcional é registrada com o cenário medido, sem
substituir a meta do PRD por outra métrica.

**Estado técnico em 30/09/2026:** F7 entrega Compose com Nginx/HTTPS, conta própria
e sessão persistida, migrações por role separada, segredos externos, execução
restrita e recuperação coordenada com criptografia. Ajuda, [manual por perfil](fase-7/MANUAL.md)
e [roteiro de homologação](fase-7/HOMOLOGACAO.md) estão disponíveis. O
[QA final](fase-7/QA.md) registra 257 testes de backend, 191 de frontend, jornadas
de navegador e resultados reais de carga/recuperação. A liberação institucional,
as integrações externas e a medição na VPS definitiva permanecem externas ao
aceite técnico local. Não há afirmação de treinamento ou piloto realizados.

## Regra comum para marcar uma entrega como concluída

- Identificar RF/UC/RN, épico e AC afetados; manter exemplos de sucesso e erro no contrato
  OpenAPI quando houver API.
- Incluir migração e teste em PostgreSQL para dados novos; testar atualização de base
  anterior quando o schema mudar.
- Verificar papel, vínculo e ID de outro usuário no servidor; registrar auditoria e conflito
  de versão quando a operação exigir.
- Integrar a tela à resposta real da API, cobrir carregamento, vazio, erro e atualização
  após gravação; retirar o dado demonstrativo do fluxo concluído.
- Executar testes de regra e integração relevantes, jornada Playwright quando houver fluxo
  entre perfis, e atualizar manual e roteiro de homologação.
- Para integração externa, testar evento duplicado, falha transitória, resultado incerto,
  versão antiga e recuperação após reinício. Para relatório, comparar prévia e arquivo.

## Decisões e dependências de homologação

| Antes de encerrar | Decisões do PRD                                                                     | Responsável principal |
| ----------------- | ----------------------------------------------------------------------------------- | --------------------- |
| Fases 0–1         | D01, D02, D21, D22 (matriz, cadastro, login e proteção de dados)                    | AE/TI                 |
| Fase 2            | D15, D19 (responsáveis e ocupação/unicidade de quartos)                             | AE/TI                 |
| Fase 3            | D03–D09 (modalidades, relógio, partida, expiração, cancelamento, chamada e retorno) | AE                    |
| Fase 4            | D07, D15–D17, D25 (assinatura, destinatário, reenvio e custos/licenças)             | AE/TI/instituição     |
| Fase 5            | D12–D14, D18 (notificações, reincidência, termo e avisos)                           | AE                    |
| Fase 6            | D10, D11, D20 (fórmulas, indicadores e exportação)                                  | AE/TI                 |
| Fase 7            | D22–D24, D26 (retenção, contingência, carga e modelo atualizado)                    | AE/TI                 |

As decisões podem ser trabalhadas em paralelo com módulos independentes. Um adaptador
simulado permite desenvolvimento e testes, mas não satisfaz critérios de autenticação operacional,
assinatura ou comunicação reais. O [PRD, seção 23](../SAGER_PRD_v2.0_Angular_SpringBoot.md)
é a fonte para o texto completo de cada D01–D26; a
[especificação técnica, seções 13–16](../SAGER_Especificacao_Tecnica_v2.0.md) define os
critérios AT, a sequência de referência e os entregáveis da equipe.
