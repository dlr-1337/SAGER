# Design

## Context

A monografia (cap. 4: RF001 a RF027, RN01 a RN18, UC01 a UC24, tabela de permissões e diagramas; cap. 5: sessão, auditoria e rotinas; cap. 6: navegação e demonstração) é a fonte da verdade do SAGER. O AGENTS.md e o `openspec/config.yaml` dizem que `openspec/specs` é a fonte canônica do comportamento. A monografia não cita o OpenSpec. Hoje, `openspec/specs` tem 25 capabilities de detalhe e nenhuma das regras centrais. Esta change escreve essa base sem mudar código.

Cada requisito foi conferido em 13/11/2026 no backend (serviços, `SecurityConfiguration`, migrações) e no frontend (rotas, `DemoSessionService`, `DemoEntry`, página de ajuda). As changes `add-accommodation-age-group`, `align-with-monograph`, `hide-exits-for-adults`, `remove-health-module`, `simplify-long-lists`, `simplify-room-browsing`, `speed-up-navigation` e `track-course-conclusion` alteram partes do mesmo comportamento e foram arquivadas em 13/11/2026, antes desta.

## Goals / Non-Goals

**Goals:**
- Dar a cada regra central da monografia um requisito com cenário verificável, citando o RF, a RN, o UC ou a seção de origem.
- Deixar a base pronta para que as próximas changes usem `MODIFIED` em vez de reescrever regras.
- Registrar onde o código e a monografia divergem e o que a instituição ainda decide.

**Non-Goals:**
- Corrigir divergências no código. Cada uma vira uma change própria, se o dono decidir.
- Especificar telas, textos e navegação, que ficam nas specs de interface.
- Repetir requisitos que já estão em `openspec/specs`.

## Decisions

### D1. Uma capability por área do domínio

São 13 capabilities, uma por área do cap. 4 (acesso, cadastros, estrutura, alocação, chamada, saídas, limpeza, disciplina, comunicações, auditoria, demonstração e ajuda).
- Alternativa rejeitada: uma só spec `core` com 84 requisitos. Ficaria difícil de ler, e qualquer change futura tocaria o mesmo arquivo, gerando conflitos de arquivamento.

### D2. Saídas curtas e longas na mesma capability

`exit-requests` cobre as duas modalidades, porque RN01 e RN05 a RN08 valem para ambas e a sobreposição considera as duas juntas. O que só existe na saída longa (documento, envio, conferência e anexo manual) já está em `guardian-authorization`.
- Alternativa rejeitada: `short-exits` e `long-exits` separadas. Repetiriam os mesmos requisitos de decisão, partida, retorno, prazo e expiração.

### D3. Monografia primeiro, conferida no código

O texto de cada requisito vem da monografia, e o código serve para confirmar o comportamento e os detalhes observáveis, como códigos de erro e limites de texto. Quando o código diverge, vale a monografia, e a divergência vai para "Divergências e lacunas".
- Alternativa rejeitada: descrever só o código. Transformaria em regra comportamentos que a monografia contradiz.
- Alternativa rejeitada: copiar só a monografia. Geraria requisitos sem verificação e sem os detalhes que os testes já comprovam.

### D4. Só requisitos adicionados, em capabilities novas

Todas as capabilities são novas e só têm `## ADDED Requirements`. Nenhum nome coincide com `openspec/specs`.
- Alternativa rejeitada: `## MODIFIED Requirements` em `exit-scheduling`, `night-call-justification` ou `guardian-authorization`. Essas specs recebiam deltas de `align-with-monograph`, e dois deltas sobre o mesmo requisito conflitariam no arquivamento.

### D5. Regra do servidor aqui, comportamento da tela nas specs existentes

Quando uma spec existente trata da tela, esta change descreve a regra que o servidor aplica. Exemplos: `exit-scheduling` trata do formulário (horário do servidor, partida no passado, sobreposição avisada), e `exit-requests` trata das recusas da API (400, `overlapping_exit`). Em `guardian-records`, o requisito "Mudança no responsável exige nova autorização" detalha a RN03, que `guardian-authorization` só cita como "responsável ainda elegível".
- Alternativa rejeitada: repetir o requisito da tela na capability central. Duplicaria a regra em dois lugares.

### D6. Comportamentos das changes arquivadas em 13/11/2026 ficam fora

Paginação de 25 itens, níveis do mapa de quartos, menu sem saídas para adultos, concluinte, faixa etária e remoção da saúde não aparecem. Os requisitos foram escritos para continuar verdadeiros depois delas. Por exemplo, "Lista congelada na abertura" fala de menores alocados, sem citar faixa etária, e "Saída exige residente elegível" só remete a `exit-eligibility` para a regra da maioridade, acrescentando o que ela não diz: o servidor confere a elegibilidade também na edição, na aprovação e na partida.
- Alternativa rejeitada: descrever o estado anterior a elas. Ficaria errado depois do arquivamento delas.

### D7. RN16, RN17 e RN18 juntas em `audit-trail`

A auditoria e o controle otimista de versão ficam na mesma capability, como na tabela de regras do cap. 4. O controle de versão é um único requisito, e o código `stale_version` é o mesmo em todos os recursos.
- Alternativa rejeitada: uma capability `concurrency` com um único requisito. Ficaria pequena demais e separada da regra irmã.

### D8. Códigos de erro nos cenários

Os cenários citam o status HTTP e o código (`call_exists`, `deadline_passed`, `recurrence_not_eligible` etc.), porque as telas e os testes de integração dependem deles.
- Alternativa rejeitada: escrever só "o sistema recusa". Seria vago demais para verificar e não protegeria o contrato da API.

### D9. Indicadores mensais em `cleaning-evaluation`

O cap. 4 descreve o módulo como "Limpeza e ranking: avaliação dos quartos por critérios, cálculo da nota, ranking por período e indicadores", e a consulta fica em `/api/v1/limpeza/indicadores`.
- Alternativa rejeitada: pôr em `report-generation`. Essa spec trata do fluxo de geração e download de arquivos, não do conteúdo dos indicadores.

### D10. Ajuda e cadastro de residentes como capabilities próprias

`help-center` (RF026, RNF Ajuda) e `resident-registry` (RF002, RF018) entram porque são requisitos funcionais da monografia. `registration-validation` só trata dos formatos dos campos.
- Alternativa rejeitada: deixar a ajuda fora por ser só texto. A monografia a lista como requisito funcional e como requisito não funcional.

## Divergências e lacunas

Código × monografia, conferidos em 13/11/2026:
1. **RN16, "toda escrita gera evento"**: a recuperação de senha do residente e os comandos de conta do terminal gravavam sem evento. `align-with-monograph`, já arquivada, corrigiu isso: o servidor grava eventos `LOCAL_ACCOUNT`, que a V33 passou a aceitar, e a spec `account-audit` fixa os dois eventos. Sessões, contadores de tentativa e chaves de idempotência também ficam fora da auditoria. Por isso, `audit-trail` fala de "registros do sistema" e não de qualquer gravação técnica.
2. **Ajuda para visitante sem sessão**: sem conta e sem demonstração, o perfil assumido pela interface é supervisor, e a ajuda mostra os guias do supervisor (chamada, saídas, comunicações e relatórios). A monografia diz só "guias por perfil" e não trata do visitante. `help-center` não especifica os guias do visitante.
3. **Pergunta frequente da senha**: no acesso por conta, ela mandava todos ao suporte, contra o RF020 e o UC02 para o residente. O delta `password-policy` de `align-with-monograph`, já arquivada, corrigiu isso, e a spec `password-policy` ("Ajuda indica a recuperação de senha de cada perfil") fixa o texto. `help-center` não repete esse texto.
4. **Recuperação de senha da equipe**: a monografia (RF020) só trata do residente, e o operador do cap. 4 só provisiona as contas iniciais de gestor. A recuperação administrativa de gestor e supervisor pelo operador vem só do AGENTS.md ("staff recovery is administrative") e por isso fica fora da base. Texto proposto para a monografia, no fim do RF020 ou em Restrições e Premissas: "A senha de gestor e de supervisor é redefinida pelo operador técnico, por linha de comando, depois de conferir a identidade da pessoa, e a redefinição encerra as sessões abertas da conta." Com esse texto aprovado, uma change própria acrescenta o requisito a `access-control`.
5. **Reincidência**: a monografia (RN12) exclui as advertências da categoria Outra, as anuladas e as de origem inválida, e a spec segue essa lista (D3). O código também exclui as que têm revisão de origem pendente, na consulta da reincidência e na base do termo, que as recusa com 409 `recurrence_not_eligible` (`DisciplineService.eligibleWarnings`). Se a instituição mantiver a exclusão, o texto proposto para a RN12 é "(excluídas as da categoria Outra, as anuladas, as de origem inválida e as com revisão de origem pendente)", e uma change própria ajusta `discipline` com `MODIFIED`.
6. **Só no código, fora da spec**: limite de pedidos de recuperação (5 por matrícula e 20 por endereço IP, em todos os perfis), passo de 0,1 nos critérios de limpeza, avaliação de limpeza retroativa com motivo, partida e retorno de saída com horário retroativo (justificativa de 10 a 2.000 caracteres e horário nunca futuro, em `ShortExitService` e na saída longa), chaves de idempotência nas gravações e limites de 1.800 caracteres na descrição e na justificativa da advertência. A monografia não os descreve e eles não contradizem nenhuma regra. O mesmo vale para a situação do quarto da V28: Disponível e Ocupado calculados pela capacidade e pelas alocações ativas, e Ocupado recusado com 400 como situação escolhida. A monografia para na V27, e a RN15 só diz que quartos em manutenção ou indisponíveis não recebem alocações; o texto novo da RN15 está proposto no plano de reconciliação com a monografia (§5.3), e a tela, com o quarto sem capacidade como Indisponível, fica em `room-map` (`simplify-room-browsing`). `housing-records` só fixa as situações escolhidas.
7. **Detalhes do código incluídos porque a monografia é omissa e compatível**: justificativa de 10 a 2.000 caracteres no cancelamento de saída, motivo na correção da limpeza, na anulação de advertência e termo e na retirada de aviso, limites do título e do texto do aviso, página de 1 a 100 eventos na auditoria, período de até 366 dias dos indicadores, contagem dos 90 dias da reincidência pelo instante de registro da advertência, e não pela data informada nela, e os códigos de erro.
8. **Pedido da tarefa e monografia**: a tarefa sugeria "avaliação semanal de limpeza". A monografia e o código têm uma avaliação por quarto e data, e o ranking por semana, mês ou semestre. A spec segue a monografia.
9. **Correção da chamada**: a justificativa só é exigida na correção depois do fechamento. Antes do fechamento, a marcação muda livremente e fica no histórico, como no UC05.
10. **Telefone do responsável**: a monografia (cap. 4, Diagramas de Classes) diz que o telefone é opcional no cadastro e só é exigido para indicar o responsável numa saída longa. O código (`GuardianService.checkedPhone`) e `registration-validation` o exigem no responsável novo ou alterado, e o cadastro antigo sem telefone continua válido. `guardian-records` segue `registration-validation`, porque esta change não altera specs existentes (D4). A instituição decide; se valer a monografia, uma change própria ajusta `registration-validation` e o código.
11. **Nome da conta depois da edição do residente**: a conta recebe o nome do residente na criação e no ajuste da V22, mas `ResidentService.update` só sincroniza a matrícula. Depois de editar o nome do residente, `/auth/me` continua devolvendo o nome antigo. `resident-registry` fixa o nome igual só na criação; sincronizar `display_name` na edição fica para uma change própria.
12. **Mensagens externas (RN17)**: `guardian-authorization` fixa o conteúdo mínimo do PDF, mas nenhuma spec trata do texto da mensagem enviada ao responsável. Hoje esse texto traz só a revisão e o código do documento (`IntegrationWorker.caption`), sem nascimento, matrícula nem quarto. Fixar isso fica para uma change sobre `whatsapp-gateway`.

Código errado, contra a spec (que fica como está):

13. **429 da recuperação de senha sem corpo**: `access-control`, "Erros sem detalhes internos", diz que toda resposta de erro da API traz código, mensagem e identificador da requisição. Quando a recuperação passa do limite, o servidor devolve 429 só com `Retry-After`, sem corpo (`ResidentRecoveryController.java:18`). O 429 do login cumpre a regra, com `rate_limited` (`LoginRateLimitFilter.java:30`). A correção vem numa change própria.
14. **Demonstração com o servidor sem resposta**: `demo-mode`, cenário "Falha ao sair da conta", diz que, com sessão de conta aberta e o servidor sem resposta, a demonstração não começa e a página pede para tentar de novo. O código só sai da conta quando `/api/v1/auth/me` responde (`demo-entry.service.ts:43-51`). Se a consulta falha, ela devolve vazio (`local-auth.service.ts:69-82`), a saída da conta é pulada e a demonstração começa com o cookie da conta ainda aberto no servidor. A correção vem numa change própria.
15. **Guia Comunicações na demonstração do supervisor**: `help-center`, "Guias do perfil em uso", diz que a ajuda leva à tela de cada tarefa que o perfil em uso pode fazer. Na demonstração do supervisor, o guia Comunicações aponta para `/avisos` (`portal.pages.ts:1084-1099`), rota só do residente (`app.routes.ts:131-133`), e o supervisor cai no acesso negado. A tela dele é `/comunicacoes/avisos`. A correção vem numa change própria.
16. **Cancelamento por quem já não é menor de idade**: `exit-requests`, "Edição e cancelamento", segue a monografia (cap. 4, perfis e tabela de permissões), que só deixa o residente menor de idade cancelar as próprias saídas. O servidor aceita o cancelamento do residente que fez 18 anos, porque o cancelamento não confere a elegibilidade (`ShortExitService.cancel`, `LongExitService.cancel`); só a tela, por `exit-eligibility`, esconde o botão. A correção vem numa change própria.

Lacunas de teste, conferidas cenário a cenário em 13/11/2026 (tasks.md, grupos 1 a 5). A change tem 162 cenários: 102 com teste completo, 45 com teste parcial e 15 sem teste. Nenhum teste foi criado; cada linha diz o que falta.

**`access-control`**
- "Sessão guardada no servidor", sem cenário próprio: a expiração em 30 minutos só aparece na configuração (`application.yml`, `SAGER_SESSION_TIMEOUT`); nenhum teste a comprova.
- "Login por matrícula e senha", "Senha incorreta" (parcial): os testes conferem o 401 e `invalid_credentials`, mas não a mensagem "Matrícula ou senha inválidos.".
- "Login por matrícula e senha", "Conta desativada" (parcial): o 401 é provado, mas nenhum teste compara a mensagem com a da senha incorreta.
- "Autorização aplicada pelo servidor", "Exclusão pela API" (parcial): o DELETE só é testado em quartos; falta em `/api/v1/residentes/{id}`.
- "Operações só do supervisor", "Gestor tenta abrir a chamada" (parcial): o gestor só faz GET em `/chamadas/contexto`; falta a abertura e a contagem de chamadas.
- "Operações só do supervisor", "Gestor tenta ver notificações" (parcial): falta GET `/api/v1/notificacoes` com o gestor.
- "Residente só nos próprios dados", "Saída de outro residente" (parcial): GET e PUT são testados; falta o cancelamento pelo residente B.
- "Recuperação de senha do residente", "Responsável errado" (parcial): falta conferir a mesma mensagem das outras recusas e reler a senha antiga.
- "Recuperação de senha do residente", "Conta de supervisor" (sem teste): `ResidentApiIntegrationTest` tenta só a matrícula de um gestor, nunca a de um supervisor.

**`resident-registry`**
- "Cadastro de residentes", "Supervisor edita" (parcial): falta o supervisor mudar só o nascimento de um residente do gestor e a auditoria listar só `birthDate`.

**`guardian-records`**
- "Responsável apto para a saída longa", "Responsável sem telefone" (parcial): o teste usa telefone estrangeiro; falta responsável ativo sem telefone.
- "Responsável apto para a saída longa", "Responsável de outro residente" (sem teste): nenhum pedido usa o responsável de outro residente.
- "Mudança no responsável exige nova autorização", "Telefone corrigido depois da conferência" (parcial): o telefone muda por SQL, e o teste confere só o 409, sem `guardian_not_eligible`.

**`resident-allocation`**
- "Transferência entre quartos", "Destino sem vaga" (parcial): `room_full` só é testado na alocação inicial; falta a transferência para quarto lotado.
- "Histórico de alocações", "Residente transferido duas vezes" (parcial): os testes fazem uma só transferência; falta o histórico com três alocações.

**`night-call`**
- "Horário excepcional confirmado", "Abertura às 21h" (parcial): `outside_window` só é testado às 00h00; falta abrir antes das 22h e contar as chamadas.
- "Horário excepcional confirmado", "Abertura confirmada fora da janela" (parcial): falta ler a justificativa gravada, testar o limite de 10 caracteres e abrir às 21h.
- "Lista congelada na abertura", "Transferência depois da abertura" (parcial): falta transferir um residente já listado e reler a chamada.
- "Fechamento só com todos marcados", "Ausência justificada que deixou de valer" (parcial): `authorized_exit_outdated` só é provado com a ausência justificada automática; falta a marcada pelo supervisor.
- "Correção depois do fechamento", "Presente que estava ausente" (parcial): falta a correção de presente para ausente conferir a ocorrência e a notificação pendente.

**`exit-requests`**
- "Pedido feito pelo próprio residente", "Supervisor tenta pedir" (sem teste): só a tela é testada; falta o pedido do supervisor na API, esperando 403.
- "Saída exige residente elegível", "Aprovação depois dos 18 anos" (sem teste): nenhum teste edita, aprova ou registra a partida depois dos 18 anos.
- "Sem sobreposição de saídas", "Saída longa sobre saída curta aprovada" (parcial): só o sentido inverso e um provedor simulado são testados.
- "Decisão do supervisor", "Aprovação de saída curta" (parcial): falta o residente ler a saída aprovada.
- "Partida física", "Outra saída em andamento" (parcial): o teste simula a saída longa em andamento; falta uma saída longa real.
- "Retorno físico confirmado pelo supervisor", "Retorno no horário" (parcial): nenhum teste confere a situação retorno confirmado.
- "Retorno físico confirmado pelo supervisor", "Residente tenta confirmar o retorno" (sem teste): falta o retorno pedido pelo residente na API, esperando 403.
- "Histórico da saída", "Residente acompanha o pedido" (parcial): falta o residente abrir a própria saída rejeitada e ver o motivo e o histórico.

**`cleaning-evaluation`**
- "Avaliação por quatro critérios", "Critério acima de 10" (parcial): o servidor só testa um valor fora do passo (5,01); falta a nota 11.
- "Participantes da avaliação", "Residente transferido depois da avaliação" (parcial): o teste tem um só participante e transfere antes de avaliar.
- "Correção preserva a avaliação anterior", "Nota corrigida" (parcial): falta conferir o motivo e a nota anterior no histórico.
- "Correção preserva a avaliação anterior", "Correção sem motivo" (sem teste): todas as correções testadas mandam motivo.
- "Ranking por período", "Quarto não avaliado" (parcial): a consulta testada é do supervisor; falta a do gestor.
- "Quem vê as notas", "Ranking visto pelo residente" (parcial): falta conferir média e posição do próprio quarto e a posição dos outros.
- "Indicadores mensais", "Indicadores de um residente" (parcial): falta o filtro por residente e um período de vários meses com zeros.
- "Indicadores mensais", "Residente tenta consultar indicadores" (sem teste): o residente nunca chama `/api/v1/limpeza/indicadores`.

**`discipline`**
- "Ocorrências automáticas", "Limpeza abaixo de 6,00" (parcial): o teste tem um participante e nota 5,00; faltam dois participantes, nota 5,75 e a notificação pendente de cada um.
- "Nenhuma advertência automática", "Notificação sem decisão" (parcial): falta avançar o relógio vários dias com a notificação pendente.
- "Análise da notificação", "Arquivamento justificado" (parcial): falta ler no histórico o motivo, a justificativa e o autor.
- "Análise da notificação", "Conversão de notificação arquivada" (parcial): só há a corrida com a mesma versão; falta arquivar e converter com a versão atual, esperando `invalid_state`.
- "Análise da notificação", "Gestor tenta abrir notificações" (parcial): falta GET `/api/v1/notificacoes` com o gestor.
- "Advertência registrada e anulada pelo supervisor", "Anulação" (parcial): falta reler a advertência e conferir a situação anulada e o motivo.
- "Possível reincidência", "Advertência antiga" (parcial): o teste tira da janela duas advertências de ausência juntas; falta uma de limpeza de 100 dias com outra de ontem.
- "Base do termo", "Base com advertência anulada" (sem teste): nenhum teste recebe `recurrence_not_eligible`.
- "Base do termo", "Base com categorias diferentes" (sem teste): nenhum teste emite termo com advertências de categorias diferentes.
- "Residente vê só a própria disciplina", "Residente tenta ver ocorrências" (sem teste): falta GET `/api/v1/ocorrencias` com o residente.

**`institutional-notices`**
- "Ciclo do aviso institucional", "Aviso sem destinatário" (sem teste): todos os avisos testados têm destinatário.
- "Ciclo do aviso institucional", "Retirada" (parcial): falta o residente ver o aviso retirado e o motivo.
- "Ciclo do aviso institucional", "Gestor tenta publicar" (sem teste): falta POST `/api/v1/avisos` com o gestor.
- "Nova versão substitui a anterior", "Aviso revisado" (parcial): falta conferir a primeira versão como superada.
- "Leitura diferente de ciência", "Residente marca como lido" (parcial): falta conferir a data da leitura preenchida.
- "Ciência por versão vigente", "Ciência em versão superada" (parcial): `content_not_current` só é provado na versão retirada; falta a versão superada sem ciência.
- "Ciência por versão vigente", "Ciência repetida" (parcial): só há duas ciências simultâneas num aviso; falta repetir, outro dia, a ciência de uma advertência anulada.

**`audit-trail`**
- "Evento na mesma transação", "Escrita recusada" (parcial): falta a transferência recusada com `room_full` e a contagem de eventos.
- "Só nomes de campos", "Correção de marcação na chamada" (parcial): nenhum teste lê o evento da correção.
- "Consulta pela API", "Residente consulta a auditoria" (sem teste): falta GET `/api/v1/auditoria` com o residente.

**`demo-mode`**
- "Entrada pela escolha de um perfil", "Falha ao sair da conta" (sem teste): nenhum teste faz a saída da conta falhar; o código também não cumpre o cenário (item 14).
- "Indisponível em produção", "Demonstração guardada de antes" (parcial): a desativação é provada; falta a página de acesso em produção sem os perfis fictícios.

**`help-center`**
- "Ajuda sem login", "Visitante sem conta" (parcial): falta abrir a ajuda pelo link da página de acesso, sem login, e conferir as três perguntas exigidas.
- "Guias do perfil em uso", "Gestor na ajuda" (sem teste): os testes cobrem só residente e supervisor.
- "Guias do perfil em uso", "Residente na demonstração" (parcial): falta conferir os guias de comunicações e de limpeza e a falta do guia de relatórios.

Não é lacuna:
- `cleaning-evaluation`, "Média com duas casas". O arredondamento para duas casas, com a metade para cima, é provado em `CleaningReportsIntegrationTest.exactDecimalsFirstDeltaDedupAndSameDayConcurrency` (0,125 vira 0,13), com outros números.
- `access-control`, "Contas de gestor só pelo terminal", "Operador cria gestor". `infra/coolify/smoke.py` (`create_account`, linhas 374-428) roda o JAR real com `--sager-account=create --profile=gestor`, sem senha na linha de comando, digita a senha nos dois prompts e confere que ela não é ecoada; depois entra com ela (linhas 600-603).
- `discipline`, "Possível reincidência", "Uma só origem". `DisciplineApiIntegrationTest.recurrenceRequiresHumanConfirmationAndImmutableOwnPdfNeverClaimsSignature` (linha 177) registra uma advertência de ausência e confere que ela não forma reincidência. O cenário antigo, com duas advertências vigentes da mesma chamada, partia de um estado que o banco não deixa existir (uma ocorrência por origem e uma advertência vigente por ocorrência), e "Base com uma só origem" virou "Base com categorias diferentes" pelo mesmo motivo.

## Risks / Trade-offs

- [Spec congela uma regra local ainda não homologada] → O requisito descreve o comportamento atual e a lista abaixo diz o que a instituição decide. Uma mudança de regra entra como `MODIFIED` numa change própria.
- [Changes arquivadas em 13/11/2026 tocam o mesmo comportamento] → Os requisitos evitam os pontos que elas alteram (D6), e as specs delas já estão em `openspec/specs`.
- [Requisito sem teste correspondente] → As tarefas exigem apontar o teste de cada cenário ou registrar a lacuna. Esta change não cria testes.
- [Duplicação parcial com specs de tela] → D5 separa servidor e tela. Quem editar uma regra precisa conferir as duas specs citadas no proposal.

## Migration Plan

Não há migração de dados nem implantação. O arquivamento cria 13 pastas em `openspec/specs`. O rollback é não arquivar, ou reverter o commit do arquivamento.

## Open Questions

O que a instituição ou o operador ainda decide (a evidência técnica não substitui o aceite institucional):
- Homologar as regras locais: janela da chamada de 22h00 a 23h30, nota como média dos quatro critérios com limiar de 6,00 (Assistência Estudantil), reincidência em 90 dias, contados pelo registro da advertência, gravidades das advertências (leve, moderada e grave), início da saída (partida não antes da partida pedida nem da aprovação), supervisor cancelando saída aprovada, escalas de limpeza (não especificadas aqui) e limites de texto das justificativas (cap. 5, Situação Atual e Próximos Passos).
- Decidir se as advertências com revisão pendente saem da reincidência, como no código, ou contam, como na RN12 (item 5).
- Decidir se o telefone do responsável é opcional no cadastro, como na monografia, ou obrigatório no responsável novo ou alterado, como no código (item 10).
- Definir o que a ajuda mostra a um visitante sem sessão (item 2).
- Definir o procedimento de conferência de identidade na recuperação administrativa da equipe pelo operador (item 4).
- Validar o modelo de contas próprias do SAGER (matrícula e senha), com as integrações com SUAP e Google adiadas.
- Definir a retenção dos dados fora da auditoria (cadastros, saídas, arquivos e conversas) e o aviso de privacidade. A auditoria tem retenção permanente.
- Aceitar formalmente a base: estas specs descrevem o sistema como está; o aceite é da instituição.
