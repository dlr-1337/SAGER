# Roteiro de implementação ponta a ponta do SAGER

**Base:** [PRD v2.0](../SAGER_PRD_v2.0_Angular_SpringBoot.md) e
[Especificação Técnica v2.0](../SAGER_Especificacao_Tecnica_v2.0.md).

**Estado:** plano de execução; não registra homologação institucional nem prazo contratado.

**Escopo:** os épicos E01–E15, os critérios funcionais AC01–AC72, os critérios técnicos
AT01–AT18 e as oito jornadas integradas do PRD.

A divisão em Fases 0–7 segue a seção 15 da especificação técnica e detalha a ordem
proposta na seção 22.3 do PRD, sem retirar funcionalidades.

## Ponto de partida e modo de entrega

O repositório tem um protótipo Angular navegável em `frontend/`. Seus cadastros e fluxos
operacionais usam serviços em memória; a demonstração usa seleção de perfil em
`sessionStorage`; a assinatura é simulada; relatórios e ranking usam dados de exemplo.
Em 26/09/2026, o solicitante substituiu a antiga prova Google OIDC por login local
provisório em `backend/`, limitado a desenvolvimento e teste. O login foi integrado
ao Angular; ainda não há `infra/`. As telas existentes são a base visual e
funcional para as próximas fatias, sem regras de domínio persistidas.

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
3. Fazer prova de integração com o mecanismo institucional que a TI definir; documentar
   identificador estável, atributos, perfis, desligamento e política de sessão. O login
   local provisório não substitui essa prova nem determina o provedor definitivo.
4. Validar com a instituição acesso, modalidade, identidade e custos da assinatura, além dos
   requisitos da conta Meta/WhatsApp. Definir quais adaptadores terão sandbox utilizável.
5. Concordar no primeiro contrato vertical de API, erros, datas, autorização e dicionário
   cadastral; atualizar o modelo de dados quando decisões alterarem vínculos ou estados.

**Saída verificável:** decisões necessárias à Fase 1 registradas, versões reproduzíveis
definidas, prova do login institucional documentada e responsáveis indicados para as
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
O provedor institucional, a prova
com contas autorizadas e o aceite TI/AE permanecem pendentes; **a Fase 0 não está
homologada**.

### Fase 1 — Fundação técnica e primeira fatia real

**Cobertura:** E01; AC01–AC03; início de E15; AT01 e AT03–AT06. AT02 fecha na
implantação da Fase 7.

1. Criar `backend/` com Maven Wrapper, Spring MVC, validação, Spring Security, Spring
   Session JDBC, PostgreSQL, Flyway, perfis de ambiente, erros padronizados e OpenAPI.
2. Integrar o login local provisório somente em desenvolvimento/teste, com contas
   criadas por operador, perfis locais explícitos, sessão, `/api/v1/auth/me`, CSRF e
   logout. Fora do perfil local, o backend falha fechado até existir identidade
   institucional confirmada. Implementar autorização por endpoint **e** por registro
   nas fatias reais, a partir da matriz D01 aprovada.
3. Criar auditoria transacional e observabilidade básica. Definir UUID, datas, paginação,
   controle de versão e conflitos como convenções da API.
4. Integrar uma primeira fatia protegida de cadastro/consulta de residente ao Angular,
   usando `HttpClient` e banco real. Unificar o identificador do residente entre gestão e
   operações antes de expandir os módulos. A fatia cadastral depende da decisão D02 sobre
   origem e validação da matrícula; não inferir matrícula do login provisório.
5. Criar pipeline de build, testes Java/Angular e migração em PostgreSQL de teste, sem dados
   reais nem segredos no repositório.

**Saída verificável:** após reiniciar a aplicação, o cadastro da fatia continua disponível;
um perfil sem permissão e a troca de ID são bloqueados; sessão, CSRF e logout funcionam;
migrações constroem banco vazio e testes passam. O login real fecha AC01/AC02 e AT03
somente após prova com o provedor institucional.

**Decisões de entrada:** D01, D02 e D21; D22 para acesso e tratamento inicial de dados
sensíveis.

### Fase 2 — Residentes, responsáveis, supervisores e quartos

**Cobertura:** E02–E04; AC04–AC08 e AC11–AC15. AC09/AC10 fecham com a saída longa.

1. Persistir residentes, matrícula, condição etária, responsáveis ativos e vínculos;
   proteger informações médicas em recurso e permissão separados.
2. Integrar cadastro e edição de supervisores ao gestor autenticado; as contas locais
   usadas em desenvolvimento não substituem o futuro provisionamento institucional.
3. Persistir blocos, pisos, quartos e vínculos de ocupação; implementar o mapa com situação,
   nota existente, legenda e atualização após gravação.
4. Trocar os serviços demonstrativos de gestão por serviços de API; garantir que operações
   posteriores usem os mesmos IDs e vínculos. Testar validações, unicidade, concorrência e
   acesso a registros de outros residentes.

**Saída verificável:** cadastros e mapa refletem o PostgreSQL após reinício; permissões e
vínculos são aplicados no servidor; dados médicos ficam fechados até a matriz ser aprovada;
as telas não apresentam ocupação ou nota inventada.

**Decisões de entrada:** D01, D02, D15 e D19; D22 para retenção e acesso aos dados.

**Estado em 26/09/2026:** a [primeira fatia de supervisores](fase-2/README.md) persiste
o cadastro funcional no PostgreSQL, com API restrita ao gestor local e telas integradas;
o [QA](fase-2/QA.md) registra testes e prova após reinício. Residentes,
responsáveis e quartos continuam demonstrativos. A saída da Fase 2 depende das
decisões da AE/TI indicadas acima e da implementação das demais fatias.

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

### Fase 4 — Saída longa, WhatsApp, documento e assinatura

**Cobertura:** E06/E07 na modalidade longa e E09; AC09–AC10, AC25–AC26, AC30 e
AC39–AC44; AT09–AT12.

1. Validar responsável autorizado e telefone pré-cadastrado; criar solicitação e tarefa de
   integração na mesma transação. Versionar os dados usados para gerar o documento.
2. Gerar e guardar PDF em volume privado, com metadados, hash e versões imutáveis. Servir
   downloads somente pelo backend, após autorização por vínculo.
3. Implementar adaptadores de assinatura e do provedor de WhatsApp escolhido após D16/D25,
   envio mínimo de dados, estado das
   mensagens, reenvio, retentativas com lease e recuperação após reinício.
4. Autenticar webhooks, deduplicar eventos e conferir pela API do provedor signatário,
   documento e versão. Armazenar arquivo assinado e evidências antes de liberar a aprovação.
5. Substituir a rota de assinatura demonstrativa por acesso seguro do provedor aprovado e
   exibir separadamente estado da solicitação, da mensagem e da assinatura.

**Saída verificável:** jornada longa em sandbox/homologação real, inclusive falha e reenvio;
webhook inválido ou antigo não altera a saída; queda do processo preserva a tarefa; falha
de armazenamento e ausência de assinatura bloqueiam aprovação. A integração real só fecha
após autorização institucional e credenciais operacionais.

**Decisões de entrada:** D07, D15–D17 e D25; confirmar termos do provedor e requisitos
de segurança antes de ativar o fluxo real.

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
   retenção/descarte de dados, acesso a dados médicos, resposta a incidentes e escopo da
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
simulado permite desenvolvimento e testes, mas não satisfaz critérios de autenticação,
assinatura ou comunicação reais. O [PRD, seção 23](../SAGER_PRD_v2.0_Angular_SpringBoot.md)
é a fonte para o texto completo de cada D01–D26; a
[especificação técnica, seções 13–16](../SAGER_Especificacao_Tecnica_v2.0.md) define os
critérios AT, a sequência de referência e os entregáveis da equipe.
