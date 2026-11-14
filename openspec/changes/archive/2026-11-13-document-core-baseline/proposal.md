# Proposal

## Why

O AGENTS.md diz que `openspec/specs` é a fonte do comportamento ("openspec/specs is the source of behavior"; "Behavior rules live in openspec/specs/<capability>"), e o `openspec/config.yaml` repete que AGENTS.md e `openspec/specs` são as fontes canônicas de permissões, regras de domínio e comportamento. Mas as 16 capabilities de `openspec/specs` cobrem só detalhes: links de ação, filtros, marca, campos do formulário de saída, conversas e gateway do WhatsApp, política de senha e relatórios. As regras centrais descritas na monografia (cap. 4: RF001 a RF027, RN01 a RN18 e UC01 a UC24) não têm spec: perfis e acesso, cadastros, alocação, chamada noturna, ciclo das saídas, limpeza e ranking, disciplina, comunicações, auditoria, demonstração e ajuda. Sem essa base, uma mudança futura não tem requisito para citar, e o CI (`validate --all --strict`) só confere os detalhes.

## What Changes

- Cria 13 capabilities novas, só com `## ADDED Requirements`, que descrevem o comportamento central que já existe no código e na monografia. São 84 requisitos.
- Cada requisito cita entre parênteses o RF, a RN, o UC ou a seção da monografia de onde vem. Todos foram conferidos no código do backend e do frontend em 13/11/2026. Quando código e monografia divergem, o texto segue a monografia, e a divergência fica em design.md, "Divergências e lacunas".
- Os códigos de erro da API (`active_conflict`, `overlapping_exit`, `stale_version` etc.) aparecem nos cenários como contrato observável, porque os testes de integração e as telas dependem deles.
- Nada do que as changes arquivadas em 13/11/2026 alteraram entra aqui: paginação de 25 itens, níveis do mapa de quartos, menu sem saídas para adultos, concluinte, faixa etária e remoção da saúde. Os requisitos foram escritos para continuar verdadeiros depois delas.

Já coberto por outras specs, e por isso só citado aqui:
- `supervisor-accounts` (RF013, UC14): cadastro de supervisores e conta criada no mesmo ato.
- `password-policy`: regra de senha; e o delta de `align-with-monograph`, que corrigiu a ajuda de senha.
- `registration-validation` (e o delta de `track-course-conclusion`): formatos de nome, matrícula, e-mail, nascimento, telefone, curso obrigatório e capacidade de 1 a 20.
- `guardian-authorization`, `whatsapp-gateway` e `whatsapp-conversations` (RF015, RF016, RN04, UC18, UC24): documento, envio, conferência humana, anexo manual e decisão separada da conferência.
- `guardian-authorization`, "Conteúdo mínimo do documento" (RN17, na parte das mensagens externas): o PDF sem nascimento, matrícula nem quarto. O texto da mensagem ao responsável não tem spec (design.md, "Divergências e lacunas").
- `exit-scheduling` (RF007): comportamento do formulário de saída na tela (sugestão de retorno, limites visíveis, horário do servidor, partida no passado, sobreposição avisada).
- `night-call-justification` (RN10): ausência justificada automática na abertura, correção e fechamento.
- `report-generation` (RF011, UC11): geração e exportação de relatórios.
- Specs das changes arquivadas em 13/11/2026: `exit-eligibility` (RN02, maioridade nas saídas), `accommodation-age-group` (faixa etária), `course-progress` (concluinte), `room-map`, `room-filters` e `block-filters` (tela de quartos), `list-browsing` (paginação), `page-loading` (sessão e CSRF no frontend), `account-audit` (auditoria das contas), `demo-fidelity` (textos da demonstração) e `resident-record` (ficha do residente).

Fora do escopo:
- Qualquer mudança de código, migração, teste ou tela. Esta change só documenta.
- Layout, textos de tela e navegação, que ficam nas specs de interface já existentes.
- Comportamentos que só existem no código ou no AGENTS.md e que a monografia não descreve, como o limite de pedidos de recuperação de senha, o passo de 0,1 nos critérios de limpeza, a avaliação de limpeza retroativa, a partida e o retorno com horário retroativo, o cálculo de Disponível e Ocupado (V28) e a recuperação administrativa da senha da equipe. Ficam registrados em design.md.
- WhatsApp, documento da saída longa e relatórios, que já têm spec.
- Homologação institucional das regras locais (janela da chamada, limiar de 6,00, reincidência em 90 dias, regras de cancelamento e de partida). A spec registra o comportamento atual; o aceite é da instituição.

## Capabilities

### New Capabilities

- `access-control`: três perfis, login por matrícula, sessão no servidor, CSRF, limite de tentativas, autorização no servidor, permissões por perfil e recuperação de senha (RF001, RF020, UC01, UC02; RNF de segurança; cap. 4, tabela de permissões).
- `resident-registry`: cadastro de residentes, conta criada no mesmo ato, nome com iniciais maiúsculas e catálogo de cursos (RF002, RF018, UC15, UC20).
- `guardian-records`: responsáveis do residente e quando um responsável pode ser indicado numa saída longa (RF017, RN03, RN04, UC13).
- `housing-records`: alojamentos, unidades, quartos, situação e capacidade (RF003, RN15, UC16).
- `resident-allocation`: alocação, transferência, encerramento e histórico (RF019, RN15, UC19).
- `night-call`: abertura, lista congelada, marcação, fechamento e correção da chamada (RF006, RN02, RN09, RN10, UC05).
- `exit-requests`: ciclo das saídas curtas e longas, da solicitação ao retorno e à expiração (RF007, RF008, RF014, RF024, RN01, RN02, RN05 a RN08, UC06, UC07, UC17, UC23).
- `cleaning-evaluation`: avaliação de limpeza, ranking por período e indicadores mensais (RF010, RF011, RF012, RN14, UC09, UC12).
- `discipline`: ocorrências, notificações internas, advertências, reincidência e termo de compromisso (RF004, RF005, RF009, RF021, RF022, RN11, RN12, UC03, UC04, UC10, UC21).
- `institutional-notices`: avisos institucionais e leitura e ciência por versão (RF009, RF023, RN13, UC08, UC22).
- `audit-trail`: auditoria na mesma transação, só com nomes de campos, permanente, consultável pela API, e controle otimista de versão (RF025, RN16, RN17, RN18).
- `demo-mode`: demonstração com três perfis e dados fictícios, indisponível em produção (RF027; RNF Degradação).
- `help-center`: ajuda sem login com perguntas frequentes e guias por perfil (RF026; RNF Ajuda).

### Modified Capabilities

Nenhuma.

## Impact

- Só documentação: 13 pastas novas em `openspec/changes/document-core-baseline/specs/`. Nenhum arquivo de código, migração, teste ou configuração muda.
- Depois do arquivamento, `openspec/specs` passa de 25 para 38 capabilities, e `validate --all --strict` passa a conferir também a base central.
