## Context

Motivação em `proposal.md` (Why). Estado atual que molda a solução:

- `shared/filter-panel.component.ts` abre "Mais filtros" por `matchMedia('(min-width: 761px)')` e grava o estado em `FilterState` sob `filter-panel:<key>`. Os valores dos filtros são lembrados à parte, por `rememberFilters`/`rememberValue` (`core/filter-state.ts`), e isso continua.
- Só Cursos (`features/management/courses.page.ts`) tem formulário de cadastro na própria tela de lista. Advertências, avisos, residentes, responsáveis, supervisores, alojamentos e quartos já abrem o cadastro em rota própria (`/advertencias/nova`, `/avisos/novo` etc.).
- `cleaning-form-local.page.ts` mostra local, "Quando foi a avaliação?", critérios (`cleaning-criteria-fields.component.ts`), média e observação num só formulário, e o envio abre um diálogo de revisão (`review()`).
- `long-exit-detail.component.ts` (só acesso por conta) mostra dados, histórico, documento enviado, arquivos recebidos, arquivos sem vínculo, autorização e ações ao mesmo tempo, com "Atualizar dados" e sem atualização automática. `exit-detail-local.component.ts` tem "Aprovar", "Rejeitar", "Registrar saída", "Registrar volta", "Cancelar pedido" e "Atualizar dados", e o diálogo da volta já se chama "Confirmar volta".
- `styles.scss` já tem `.status` com `data-tone` `success`, `warning`, `danger` e `info` (sem tom é neutro, cinza). As etiquetas de operações usam `.op-status`, sempre cinza. Não existe botão de perigo.
- Nomes divergentes: `communication-filters.component.ts` oferece "Ativa" para advertência vigente, e a lista mostra "Valendo" (`warnings-local.pages.ts`); no modo das comunicações do residente oferece "Publicado", e a lista mostra "Valendo" (`communicationStateLabels`).
- Links de ação com ícone (`.op-row-link`, `mixin back-link` em `shared/_back-link.scss`, "Abrir ajuda") são `inline-flex`. Num contêiner flex, o ícone vira item de bloco e o sublinhado do link se propaga até ele; `text-decoration: none` no ícone não desfaz um sublinhado propagado.
- A chamada (`night-call-local.component.ts`) tem os filtros Marcação, Casa ou bloco e Quarto em "Mais filtros".
- Duas changes ativas, do mesmo pedido do dono, mexem nos detalhes de saída: `auto-departure-on-approval` faz a aprovação do pedido para sair agora registrar a partida e deixa "Registrar saída" só na saída agendada aprovada, a partir da hora pedida (`canDepart`), com "Saída marcada para <data e hora>" antes disso; `auto-refresh-pages` faz as telas se atualizarem sozinhas a cada 15 segundos e tira "Atualizar dados". Esta change parte das telas já com as duas aplicadas.
- A monografia cita nomes dessas telas: o diálogo "Conferir autorização recebida", "Confirmar conferência", "Recusar arquivo", "Baixar arquivo" e o anexo manual na página da saída longa (cap. 7, Fig. 6.3, capturada no acesso por conta), e o botão "Registrar volta", com a orientação de ver o residente pessoalmente (cap. 8, tabela de correspondência).

## Goals / Non-Goals

**Goals:**

- Cada tela abre mostrando só o essencial e um caminho: a lista, a ação principal ou o próximo passo.
- Peças pequenas e reaproveitadas: painel de filtro sem memória, um mapa de tons com a legenda, um estilo de passos e um botão de perigo. O saldo nas telas tocadas é de remoção de texto e de botões.
- Nenhuma mudança de contrato de API, banco, permissão ou regra de domínio.

**Non-Goals:**

- Reescrever o vocabulário (fica com `plain-language`) ou as telas só da demonstração.
- Simplificar os critérios de limpeza ou remover advertências e termos (outra change).
- Componente genérico de assistente (stepper).

## Decisions

### D1. "Mais filtros" sempre fechado, sem memória do painel

Em `filter-panel.component.ts`, saem `FilterState`, `ngOnInit`, o sinal `open` e o `(toggle)`: o `<details>` fica sem `open`, então começa fechado em toda abertura da tela e o navegador cuida do clique. Os chips continuam fora do `<details>`.

- Rejeitado: manter a memória e só mudar o padrão para fechado. O painel voltaria a abrir sozinho depois de aberto uma vez, que é o que o dono não quer.
- Rejeitado: entrada `startOpen` por tela. Nenhuma tela precisa dela.

### D2. Formulário de Cursos aberto pelo botão, na mesma tela

`courses.page.ts` ganha o sinal `formOpen`. "Cadastrar curso" abre o formulário vazio; Editar abre preenchido; salvar com sucesso e Cancelar fecham e limpam. Ao abrir, o foco vai ao campo Nome; ao fechar, volta ao botão que abriu. O `sagerUnsaved` continua protegendo a navegação com dados digitados. "Cancelar edição" passa a se chamar "Cancelar" e vale para os dois modos. Advertências já segue a regra (lista com "Nova advertência" levando a `/advertencias/nova`) e só ganha teste.

- Rejeitado: rota própria `/cursos/novo`, como Advertências. Seriam rota, página e volta para um formulário de quatro campos.
- Rejeitado: diálogo. No celular, um diálogo com seleção de nível e duração fica apertado, e o formulário em linha é menos código.

### D3. Uma frase por tela, medida por teste

O limite é uma frase de até 20 palavras no cabeçalho (`main > header`) de cada tela do acesso por conta, exceto a Ajuda. Explicações que sobram vão para a Ajuda ou para `<details class="learn-more"><summary>Saiba mais</summary>`. Avisos de erro, conflito e prazo ficam à vista. Um helper de e2e, `frontend/e2e/short-text.ts`, confere o cabeçalho (no máximo um `<p>`, até 20 palavras) e cada área o chama nas próprias rotas.

- Rejeitado: dica em tooltip. Não funciona no toque nem é confiável no leitor de tela.
- Rejeitado: apagar as explicações. Algumas regras precisam de explicação; a Ajuda e o "Saiba mais" as guardam.
- Rejeitado: auditoria única em `route-audit.spec.ts`. Ela roda na demonstração, cujas telas próprias ficam fora do escopo.

### D4. Confirmação em uma frase

Os diálogos de confirmação existentes mantêm a estrutura e os campos exigidos pela regra (justificativa, observação de atraso, horário); muda só o texto: uma frase com o que vai acontecer e o botão com o nome da ação.

- Rejeitado: tirar a confirmação de atos simples. Os atos de saída e de disciplina ficam no histórico e são difíceis de desfazer.

### D5. Tom pelo nome da situação

`shared/status-tones.ts` exporta um único `Record<string, { tone; meaning }>` indexado pelo nome que aparece na tela, e as telas usam `.status` com `data-tone`. Indexar pelo nome garante que o mesmo nome tenha a mesma cor em qualquer lugar. Um teste percorre `exitStatusLabels`, `callMarkLabels`, `notificationLabels`, `communicationStateLabels`, os nomes de aviso, de advertência e da chamada e falha se algum nome não tiver entrada.

| Tom | Cor | Situações |
| --- | --- | --- |
| atenção (`warning`) | amarelo | Aguardando análise, Aguardando autorização do responsável, Retorno confirmado com atraso, chamada Aberta, marcação Pendente, notificação Pendente |
| informação (`info`) | azul | Aprovada, Em andamento, Ausência justificada, Visualizada, Em análise |
| sucesso (`success`) | verde | Retorno confirmado, chamada Fechada, Presente, aviso Publicado, Valendo |
| perigo (`danger`) | vermelho | Rejeitada, Falha no envio, Ausente, arquivo Recusado |
| neutro (sem tom) | cinza | Cancelada, Expirada, Anulada, Anulado, Arquivada, Convertida em advertência, Rascunho, Retirado, Versão anterior |

"Valendo" é verde nas advertências e nas comunicações do residente porque é o mesmo nome; "Ausente" é vermelho porque gera ocorrência. As duas escolhas estão nas pendências abaixo.

- Rejeitado: um mapa de tons por tela, pelo código da situação. Repetiria a tabela em seis telas e deixaria o mesmo nome ter cores diferentes.
- Rejeitado: um tom só para "ativo". Não distingue o que espera alguém do que está em curso, que é o que o supervisor precisa ver primeiro.

### D6. Legenda pequena e recolhida

`shared/status-legend.component.ts` recebe a lista de nomes da tela e mostra `<details><summary>O que significa cada cor?</summary>` com uma `<dl>`: a etiqueta na cor e o `meaning` do mapa de D5. Cada tela passa só os nomes que pode mostrar. A legenda do mapa de quartos continua a dela (`room-map`).

- Rejeitado: legenda sempre aberta. É texto a mais em toda lista.
- Rejeitado: explicação em cada etiqueta. Repete o texto em cada linha.

### D7. Mesmo nome no filtro e na lista

No filtro de advertências, "Ativa" vira "Valendo". No das comunicações do residente, as opções passam a vir de `communicationStateLabels` ("Valendo", "Versão anterior", "Retirado", "Anulado"). A tela de avisos do supervisor continua com "Publicado", porque é outra tela, com o ciclo do aviso (`institutional-notices`).

- Rejeitado: trocar "Valendo" por "Publicado" nas comunicações do residente. "Valendo" diz ao residente o que importa e já aparece na lista.

### D8. Botão de perigo em contorno vermelho

`.btn-danger` em `styles.scss`: fundo branco, borda e texto em `--danger`, hover em `--danger-bg`, alvo de 48 px como `.btn-secondary`. Usado em "Rejeitar" (saídas curta e longa) e "Recusar arquivo".

- Rejeitado: botão vermelho cheio. Competiria com o botão principal, e a regra pede que rejeitar não seja o principal.

### D9. Passos só com estilo, sem componente

Em `styles.scss`: `.step-count` ("Passo 1 de 3"), título do passo com `tabindex="-1"` e `.step-actions` com Voltar (secundário) e Continuar (principal). Ao trocar de passo, o foco vai ao título do passo, como a paginação já faz com o título da lista.

- Rejeitado: `MatStepper`. O Angular Material fica só com diálogos e traria outro visual.
- Rejeitado: componente compartilhado de passos. A limpeza é um assistente com Voltar e Continuar; a saída longa avança pela situação do pedido. Um componente teria de servir aos dois com opções.

### D10. Avaliação de limpeza com um formulário e três passos

`cleaning-form-local.page.ts` mantém um só `FormGroup` e ganha `step = signal(1)`. Continuar marca e valida só os controles do passo e foca o primeiro inválido. Passo 1: alojamento, casa ou bloco e quarto, e o seletor atual "Quando foi a avaliação?" dentro de `<details>` "Foi em outro dia?", aberto quando o modo é retroativo. Passo 2: `sager-cleaning-criteria-fields`, a média de `preview()` e a observação. Passo 3: resumo em `<dl>`, o motivo da correção quando é correção e "Salvar avaliação", que envia direto; o diálogo de revisão sai, porque o passo 3 é a revisão. A correção (`id` presente) começa no passo 2 e mostra "Passo 1 de 2".

- Rejeitado: uma rota por passo. Exigiria proteção de dados não salvos e estado entre rotas.
- Rejeitado: seções recolhíveis numa só página. Tudo continuaria à vista de uma vez.
- Rejeitado: manter o diálogo de revisão depois do passo 3. Seria a mesma conferência duas vezes.

### D11. Saída longa guiada pela situação do pedido

`long-exit-detail.component.ts` ganha `nextStep = computed(...)` a partir das `capabilities` e da situação já recebidas: `authorization`, `decision`, `depart`, `return` ou `none`. A tela mostra o resumo (residente, saída, volta, motivo, responsável) e só a seção do passo atual:

- **Autorização do responsável:** os arquivos candidatos, cada um com a prévia de imagem que já existe, "Baixar arquivo" (o download protegido atual), "Confirmar conferência" (o diálogo atual "Conferir autorização recebida", com a declaração e a justificativa de remetente divergente) e "Recusar arquivo" (a recusa atual, com justificativa, em `.btn-danger`). "Anexar arquivo" fica à vista neste passo, como contingência na página da saída (cap. 6 e Fig. 6.3 da monografia; `guardian-authorization` "Anexo manual"). "Rejeitar" (`.btn-danger`) fica à vista neste passo, porque a rejeição antes da conferência continua permitida (`guardian-authorization` "Rejeição antes da conferência"). Sem candidato: "Aguardando o responsável enviar pelo WhatsApp" e `<details>` "Outras opções" com "Reenviar documento".
- **Decisão:** "Aprovar saída" e "Rejeitar" (`.btn-danger`), com a regra atual de aprovação. No pedido para sair agora, o diálogo confirma com "Aprovar e registrar a saída agora" e a tela vai direto à "Volta" (`auto-departure-on-approval`).
- **Saída:** só na saída agendada aprovada: "Saída marcada para <data e hora>" e, quando a hora pedida chega (`canDepart`), só "Registrar saída".
- **Volta:** com a saída em andamento, só "Registrar volta", com o diálogo atual "Confirmar volta".

"Mais detalhes" (`<details>`, fechado) reúne histórico, documento enviado com o histórico dos envios, arquivos já decididos, arquivos sem vínculo com "Vincular a este pedido" e "Cancelar pedido". O histórico continua com o título "Histórico" e com evento, hora, perfil, situação e justificativa (cap. 8). "Atualizar dados" já terá saído com `auto-refresh-pages`, cuja atualização automática faz o arquivo do responsável e o "Registrar saída" da agendada aparecerem sem recarregar a página; "Recarregar dados" continua no conflito de versão (`plain-language` "Erros que dizem o que fazer"). Na visão do residente, "Mudar pedido" e "Cancelar pedido" continuam à vista, e só o histórico vai para "Mais detalhes".

- Rejeitado: abas (Autorização, Decisão, Histórico). O supervisor teria de escolher a aba; o próximo passo aparece sozinho.
- Rejeitado: assistente com Voltar e Continuar. Os passos dependem do responsável, da decisão e da hora, não de preencher um formulário.
- Rejeitado: uma consulta periódica própria no passo da autorização. Repetiria o que `auto-refresh-pages` já entrega para todas as telas de saída.
- Rejeitado: trocar "Confirmar conferência", "Recusar arquivo" e "Baixar arquivo" por "É esta autorização", "Não é esta" e "Ver arquivo", e "Registrar volta" por "Confirmar volta". A monografia descreve a tela com os nomes atuais (cap. 7, Fig. 6.3; cap. 8).
- Rejeitado: "Anexar arquivo" recolhido quando não há aviso de entrega. A Fig. 6.3 mostra o anexo na página com um arquivo recebido, e uma regra só ("à vista no passo da autorização") é mais simples que duas.

### D12. Saída curta com o mesmo padrão

`exit-detail-local.component.ts` segue os passos da longa, sem o da autorização: "Decisão", com "Aprovar" (principal) e "Rejeitar" (`.btn-danger`); "Saída", só na agendada aprovada, com "Saída marcada para <data e hora>" e "Registrar saída" quando a hora pedida chega; e "Volta", em andamento, só com "Registrar volta". Histórico e, para o supervisor, "Cancelar pedido" vão para "Mais detalhes". O conflito continua oferecendo "Recarregar dados". A frase "Veja o residente pessoalmente antes de confirmar a volta." passa ao diálogo "Confirmar volta", aberto por "Registrar volta" (cap. 8).

- Rejeitado: tirar "Registrar saída" da tela. A saída agendada ficaria sem caminho para começar (`auto-departure-on-approval`, D2).
- Rejeitado: tirar "Atualizar dados" nesta change. Já sai em `auto-refresh-pages`, e a regra ficaria em dois lugares.

### D13. Chamada sem o filtro Marcação

Em `night-call-local.component.ts`, saem o sinal `markFilter`, o `<select>`, o chip e o trecho do filtro. Ficam a busca à vista e casa ou bloco e quarto em "Mais filtros" (`room-filters` "Filtro de quarto na chamada noturna" não muda). O resumo continua contando toda a chamada. O aviso das marcações automáticas vira uma frase: "Quem está fora com saída já entra justificado: confira." (`night-call-justification` "Aviso de conferência" continua atendido). A situação da chamada e as marcações usam o tom de D5.

- Rejeitado: trocar o filtro por um atalho "Só pendentes". A reunião decidiu os três filtros; o resumo e a barra de progresso já mostram quantas faltam.

### D14. Sublinhado só no texto, sem mexer nas telas

Os links de ação com ícone deixam de ser `inline-flex` e passam a `inline-block`, com o ícone `inline-block` e `vertical-align: middle` e o alvo de 44 px mantido por `padding-block` e `min-height`. Num bloco de linha, o ícone `inline-block` é um elemento atômico, e o sublinhado do link não chega a ele. A mudança fica nas regras compartilhadas de `styles.scss` (link com ícone e "Abrir ajuda") e no `mixin back-link`; os templates não mudam. O e2e `action-links.spec.ts` passa a conferir, além do sublinhado no hover, que o ícone é `inline-block` e que a caixa do ícone não cruza a linha do sublinhado, com captura em `visual-review`.

- Rejeitado: envolver o texto de cada link num `<span>` sublinhado. Mexe em dezenas de templates, e um link novo sem o `<span>` volta ao defeito.
- Rejeitado: `text-decoration: none` no ícone. Não desfaz um sublinhado propagado, que é a causa do defeito atual.

### D15. Ajuda, manual e documentos

A Ajuda (`HelpPage` em `portal/portal.pages.ts`) ganha as explicações retiradas das telas, em passos numerados: avaliar a limpeza, conferir e aprovar a saída longa, o que significa cada cor e onde estão os filtros. `docs/MANUAL.md` segue o mesmo texto. `DESIGN.md` troca "aberto no computador e fechado no celular, com o estado lembrado por tela na sessão" por "fechado ao abrir a tela" e ganha os padrões de formulário sob demanda, passos e cores. `AGENTS.md` ganha uma linha em Coding Style apontando para `openspec/specs/simple-screens`. `docs/ARQUITETURA.md` acerta o número de capacidades pelo total de `openspec/specs` depois do arquivamento, porque `auto-refresh-pages` também cria uma.

- Rejeitado: guia separado para TDAH. Seria uma segunda fonte; as telas e a Ajuda já seguem as mesmas regras.

### D16. Demonstração

As telas compartilhadas com a demonstração (residentes, responsáveis, supervisores, alojamentos, quartos e relatórios) acompanham a mudança, e o painel de filtro fecha nelas também. As telas só da demonstração, inclusive o início da demonstração em `portal.pages.ts` (Fig. 6.1), ficam como estão, para preservar as figuras e as capturas da monografia, e nenhuma carga nova chama a API com a demonstração ativa.

- Rejeitado: levar os passos e as cores às telas só da demonstração. Mudaria as figuras citadas na monografia sem decisão do dono.

## Risks / Trade-offs

- [No computador, ver um filtro extra pede um clique a mais] → Os filtros ativos continuam à vista como chips, e a busca principal, que é o filtro mais usado, fica fora da área recolhida.
- [Aplicar esta change antes de `auto-departure-on-approval` ou `auto-refresh-pages`] → As tarefas 2.2, 2.3 e 2.5 de `tasks.md` exigem as duas aplicadas; sem elas, o diálogo de aprovação não diria "Aprovar e registrar a saída agora", e o arquivo do responsável e o "Registrar saída" da agendada só apareceriam com F5.
- [As três changes mexem nos mesmos arquivos de saída] → Aplicar na ordem `auto-departure-on-approval`, `auto-refresh-pages`, esta, e rodar os e2e de operações a cada uma.
- [Cor sem contraste suficiente] → As cores de `.status` já passam no axe; os e2e de cada área rodam o axe com as etiquetas coloridas, e o texto continua escrito.
- [Limite de 20 palavras corta uma orientação necessária] → O texto vai para "Saiba mais" ou para a Ajuda, sem sumir.
- [Trocar `inline-flex` por `inline-block` desalinha o ícone ou reduz o alvo] → `target-audit.spec.ts` confere os 44 px, e `visual-review.spec.ts` guarda a captura antes e depois.
- [Tirar o diálogo de revisão da limpeza muda um hábito] → O passo 3 mostra o mesmo conteúdo do diálogo, antes do botão de salvar.

## Migration Plan

Só interface. Não há dado a migrar: a memória do painel ficava em memória na sessão e some sozinha. A ordem de implementação segue os grupos de `tasks.md`: primeiro as peças compartilhadas (grupo 1), depois as áreas, que podem seguir em paralelo; as tarefas 2.2, 2.3 e 2.5 esperam `auto-departure-on-approval` e `auto-refresh-pages` aplicadas. Para desfazer, basta reverter os commits da change.

## Pendências da instituição e do operador

- **Dono:** confirmar "Valendo" em verde para advertência (D5) ou pedir amarelo, sabendo que o mesmo nome passaria a ter duas cores; confirmar "Ausente" em vermelho.
- **Dono:** a Fig. 6.3 (cap. 7) foi capturada no detalhe da saída longa por conta. O diálogo e os nomes que o texto cita continuam, mas o fundo da tela muda (passos e "Mais detalhes"); decidir se a figura é capturada de novo. As demais figuras do cap. 7 vêm da demonstração, cujas telas próprias não mudam, e nenhuma mostra Cursos ou a avaliação de limpeza.
- **Assistência Estudantil:** testar as telas com servidores que vão usá-las, incluindo pessoas com pouca prática com computador, e dizer se a frase de até 20 palavras e a legenda recolhida bastam. Esta change não tem esse teste nem aprovação institucional registrada.
- **Operador:** nada a configurar.
