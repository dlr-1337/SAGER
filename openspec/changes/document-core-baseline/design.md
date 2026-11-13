# Design

## Context

A monografia (cap. 4: RF001 a RF027, RN01 a RN18, UC01 a UC24, tabela de permissões e diagramas; cap. 5: sessão, auditoria e rotinas; cap. 6: navegação e demonstração) é a fonte da verdade do SAGER. O AGENTS.md e o `openspec/config.yaml` dizem que `openspec/specs` é a fonte canônica do comportamento. A monografia não cita o OpenSpec. Hoje, `openspec/specs` tem 16 capabilities de detalhe e nenhuma das regras centrais. Esta change escreve essa base sem mudar código.

Cada requisito foi conferido em 13/11/2026 no backend (serviços, `SecurityConfiguration`, migrações) e no frontend (rotas, `DemoSessionService`, `DemoEntry`, página de ajuda). As changes ativas `add-accommodation-age-group`, `align-with-monograph`, `hide-exits-for-adults`, `remove-health-module`, `simplify-long-lists`, `simplify-room-browsing`, `speed-up-navigation` e `track-course-conclusion` alteram partes do mesmo comportamento.

## Goals / Non-Goals

**Goals:**
- Dar a cada regra central da monografia um requisito com cenário verificável, citando o RF, a RN, o UC ou a seção de origem.
- Deixar a base pronta para que as próximas changes usem `MODIFIED` em vez de reescrever regras.
- Registrar onde o código e a monografia divergem e o que a instituição ainda decide.

**Non-Goals:**
- Corrigir divergências no código. Cada uma vira uma change própria, se o dono decidir.
- Especificar telas, textos e navegação, que ficam nas specs de interface.
- Repetir requisitos que já estão em `openspec/specs` ou em changes ativas.

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

Todas as capabilities são novas e só têm `## ADDED Requirements`. Nenhum nome coincide com `openspec/specs` nem com as changes ativas.
- Alternativa rejeitada: `## MODIFIED Requirements` em `exit-scheduling`, `night-call-justification` ou `guardian-authorization`. Essas specs já recebem deltas de `align-with-monograph`, e dois deltas sobre o mesmo requisito conflitariam no arquivamento.

### D5. Regra do servidor aqui, comportamento da tela nas specs existentes

Quando uma spec existente trata da tela, esta change descreve a regra que o servidor aplica. Exemplos: `exit-scheduling` trata do formulário (horário do servidor, partida no passado, sobreposição avisada), e `exit-requests` trata das recusas da API (400, `overlapping_exit`). Em `guardian-records`, o requisito "Mudança no responsável exige nova autorização" detalha a RN03, que `guardian-authorization` só cita como "responsável ainda elegível".
- Alternativa rejeitada: repetir o requisito da tela na capability central. Duplicaria a regra em dois lugares.

### D6. Comportamentos das changes ativas ficam fora

Paginação de 25 itens, níveis do mapa de quartos, menu sem saídas para adultos, maioridade nas saídas, concluinte, faixa etária e remoção da saúde não aparecem. Os requisitos foram escritos para continuar verdadeiros depois delas. Por exemplo, "Lista congelada na abertura" fala de menores alocados, sem citar faixa etária, e "Saída exige alocação ativa" não trata da maioridade, que é de `exit-eligibility`. O arquivamento desta change vem depois do arquivamento das changes ativas.
- Alternativa rejeitada: descrever o estado intermediário de hoje. Seria contradito pelo arquivamento das changes ativas.

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
1. **RN16, "toda escrita gera evento"**: a recuperação de senha do residente e os comandos de conta do terminal gravam sem evento. Quem corrige é `align-with-monograph` (`account-audit`). Sessões, contadores de tentativa e chaves de idempotência também ficam fora da auditoria. Por isso, `audit-trail` fala de "registros do sistema" e não de qualquer gravação técnica.
2. **Ajuda para visitante sem sessão**: sem conta e sem demonstração, o perfil assumido pela interface é supervisor, e a ajuda mostra os guias do supervisor (chamada, saídas, comunicações e relatórios). A monografia diz só "guias por perfil" e não trata do visitante. `help-center` não especifica os guias do visitante.
3. **Pergunta frequente da senha**: no acesso por conta, ela manda todos ao suporte, contra o RF020 e o UC02 para o residente. Quem corrige é o delta `password-policy` de `align-with-monograph`. `help-center` não fixa esse texto.
4. **Recuperação de senha da equipe**: a monografia (RF020) só trata do residente, e o operador do cap. 4 só provisiona as contas iniciais de gestor. A recuperação administrativa de gestor e supervisor pelo operador vem só do AGENTS.md ("staff recovery is administrative") e por isso fica fora da base. Texto proposto para a monografia, no fim do RF020 ou em Restrições e Premissas: "A senha de gestor e de supervisor é redefinida pelo operador técnico, por linha de comando, depois de conferir a identidade da pessoa, e a redefinição encerra as sessões abertas da conta." Com esse texto aprovado, uma change própria acrescenta o requisito a `access-control`.
5. **Reincidência**: a monografia (RN12) exclui as advertências da categoria Outra, as anuladas e as de origem inválida, e a spec segue essa lista (D3). O código também exclui as que têm revisão de origem pendente, na consulta da reincidência e na base do termo, que as recusa com 409 `recurrence_not_eligible` (`DisciplineService.eligibleWarnings`). Se a instituição mantiver a exclusão, o texto proposto para a RN12 é "(excluídas as da categoria Outra, as anuladas, as de origem inválida e as com revisão de origem pendente)", e uma change própria ajusta `discipline` com `MODIFIED`.
6. **Só no código, fora da spec**: limite de pedidos de recuperação (5 por matrícula e 20 por endereço IP, em todos os perfis), passo de 0,1 nos critérios de limpeza, avaliação de limpeza retroativa com motivo, partida e retorno de saída com horário retroativo (justificativa de 10 a 2.000 caracteres e horário nunca futuro, em `ShortExitService` e na saída longa), chaves de idempotência nas gravações e limites de 1.800 caracteres na descrição e na justificativa da advertência. A monografia não os descreve e eles não contradizem nenhuma regra. O mesmo vale para a situação do quarto da V28: Disponível e Ocupado calculados pela capacidade e pelas alocações ativas, e Ocupado recusado com 400 como situação escolhida. A monografia para na V27, e a RN15 só diz que quartos em manutenção ou indisponíveis não recebem alocações; o texto novo da RN15 está proposto no plano de reconciliação com a monografia (§5.3), e a tela, com o quarto sem capacidade como Indisponível, fica em `room-map` (`simplify-room-browsing`). `housing-records` só fixa as situações escolhidas.
7. **Detalhes do código incluídos porque a monografia é omissa e compatível**: justificativa de 10 a 2.000 caracteres no cancelamento de saída, motivo na correção da limpeza, na anulação de advertência e termo e na retirada de aviso, limites do título e do texto do aviso, página de 1 a 100 eventos na auditoria, período de até 366 dias dos indicadores, contagem dos 90 dias da reincidência pelo instante de registro da advertência, e não pela data informada nela, e os códigos de erro.
8. **Pedido da tarefa e monografia**: a tarefa sugeria "avaliação semanal de limpeza". A monografia e o código têm uma avaliação por quarto e data, e o ranking por semana, mês ou semestre. A spec segue a monografia.
9. **Correção da chamada**: a justificativa só é exigida na correção depois do fechamento. Antes do fechamento, a marcação muda livremente e fica no histórico, como no UC05.
10. **Telefone do responsável**: a monografia (cap. 4, Diagramas de Classes) diz que o telefone é opcional no cadastro e só é exigido para indicar o responsável numa saída longa. O código (`GuardianService.checkedPhone`) e `registration-validation` o exigem no responsável novo ou alterado, e o cadastro antigo sem telefone continua válido. `guardian-records` segue `registration-validation`, porque esta change não altera specs existentes (D4). A instituição decide; se valer a monografia, uma change própria ajusta `registration-validation` e o código.
11. **Nome da conta depois da edição do residente**: a conta recebe o nome do residente na criação e no ajuste da V22, mas `ResidentService.update` só sincroniza a matrícula. Depois de editar o nome do residente, `/auth/me` continua devolvendo o nome antigo. `resident-registry` fixa o nome igual só na criação; sincronizar `display_name` na edição fica para uma change própria.
12. **Mensagens externas (RN17)**: `guardian-authorization` fixa o conteúdo mínimo do PDF, mas nenhuma spec trata do texto da mensagem enviada ao responsável. Hoje esse texto traz só a revisão e o código do documento (`IntegrationWorker.caption`), sem nascimento, matrícula nem quarto. Fixar isso fica para uma change sobre `whatsapp-gateway`.

Lacunas de teste: a conferência de cada cenário com os testes é feita no apply (tasks.md). O cenário sem teste fica listado aqui, sem mudar código. Já encontradas na revisão:
- `access-control`, "Sessão guardada no servidor": a expiração em 30 minutos só aparece na configuração (`application.yml`, `SAGER_SESSION_TIMEOUT`); nenhum teste a comprova.
- `access-control`, "Recuperação de senha do residente", cenário "Conta de supervisor": `ResidentApiIntegrationTest` tenta só a matrícula de um gestor, nunca a de um supervisor.
- Não é lacuna: `cleaning-evaluation`, "Média com duas casas". O arredondamento para duas casas, com a metade para cima, é provado em `CleaningReportsIntegrationTest.exactDecimalsFirstDeltaDedupAndSameDayConcurrency` (0,125 vira 0,13), com outros números.

## Risks / Trade-offs

- [Spec congela uma regra local ainda não homologada] → O requisito descreve o comportamento atual e a lista abaixo diz o que a instituição decide. Uma mudança de regra entra como `MODIFIED` numa change própria.
- [Changes ativas mudam o comportamento depois desta spec] → Os requisitos evitam os pontos que elas alteram (D6), e o arquivamento desta change fica por último.
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
