# Auditoria de facilidade de uso do SAGER

**Como testei**
- Rodei `ng serve` na porta 4332, com Playwright no Google Chrome.
- Cobri 53 rotas no modo demonstração, nos perfis público, gestor, supervisor e residente.
- Percorri as jornadas do modo local com API interceptada e com `sager-environment=production` injetado no documento, para ver o que o usuário real vê.
- O servidor foi encerrado e não editei nada no repositório.

**Fora da lista, porque não achei problema**
- Nenhum campo usa placeholder como único rótulo.
- Entre botões e links, nada ficou abaixo de 40 px no desktop. As exceções são as caixas de seleção (item 22).

## Lista priorizada

1. **Textos de teste aparecem em produção.** Formulários e listas de gestão.
   - **Onde:** o ramo que não é demonstração está fixo, sem checar `session.production`.
     - `resident-form.component.ts:70,88,113-114,443,552`
     - `supervisor-form.component.ts:29,47,72-73,217,283`
     - `room-form.component.ts:55,177,571`
     - `guardians.pages.ts:55,118,134,341,376,424,488-489,548,778-779`
     - `supervisors.component.ts:156,245`
     - `rooms.component.ts:207,302`
     - `resident-detail.component.ts:52,87,294,315,423,806-807`
     - `room-detail.component.ts:41,82,182,283`
     - `supervisor-detail.component.ts:21,55,86,95,135-136`
     - `accommodation-detail.component.ts:56,175,299`
     - `accommodations.component.ts:55,94`
     - `accommodation-api.service.ts`, `room-api.service.ts`
   - **Difícil:** a tela manda o gestor usar "somente dados fictícios no ambiente local de teste" e conferir "o backend local".
   - **Correção:**
     - Apague os trechos sobre ambiente de teste.
     - Salvou: "Cadastro salvo."
     - Carregando: "Carregando…"
     - Erro: "Não foi possível conectar. Verifique a internet e tente de novo."

2. **Regra de senha com "bytes" e sem o olhinho.** Cadastro de residente e recuperar senha.
   - **Onde:** `resident-form.component.ts:247-263`, `recovery.page.ts:79,88,93,175-183,205`, `portal.pages.ts:57`, `LocalAccountProvisioningService.java:155-160`.
   - **Difícil:** "De 12 a 72 caracteres; no máximo 72 bytes" é incompreensível para o usuário real, e 12 é muito para uma criança ou um idoso.
   - **Correção:**
     - Ajuda: "Use pelo menos 8 letras ou números."
     - Erro: "A senha precisa ter pelo menos 8 letras ou números."
     - Senhas diferentes: "As duas senhas não são iguais. Digite de novo."
     - Acima do limite: "Essa senha é longa demais. Use uma mais curta." (o limite de 72 bytes continua, mas some da tela)
     - Olhinho: botão com `aria-label` "Mostrar senha"/"Ocultar senha" em todos os campos de senha.
     - Baixe o mínimo também no backend, ou o servidor recusa. O valor 8 é sugestão minha, a decidir.

3. **Gerar relatório parece uma consulta técnica.** `/relatorios`.
   - **Onde:** `reports-local.pages.ts:60-63,74-78,135,219-301`.
   - **Difícil:** "recorte preservado", "Revisar consulta", "Período inclusivo", e um diálogo de confirmação para uma simples leitura.
   - **Correção:**
     - Texto de abertura: "Escolha o tipo de relatório e as datas. Depois clique em Gerar relatório."
     - Título: "Escolha o relatório"
     - Apague a ajuda de 366 dias e 10.000 linhas (linhas 75-78). Ela continua existindo como erro.
     - Botão: "Gerar relatório", indo direto para o resultado, sem diálogo.
     - Ponha alojamento, quarto, residente e situação em `<details>` "Filtrar mais (opcional)".
     - O e2e `cleaning-reports-local.spec.ts` precisa ser ajustado.

4. **O botão de baixar fica no fim da página e tem três passos.** Resultado do relatório.
   - **Onde:** `reports-local.pages.ts:495-565`.
   - **Difícil:** a página tem mais de 3.100 px e a exportação só aparece no fim. Depois de "Preparar", é preciso clicar em "Consultar preparação" sem entender o motivo.
   - **Correção:**
     - Mova o bloco para logo abaixo do cabeçalho.
     - Título: "Baixar relatório"
     - Ajuda: "Clique em Preparar. Quando ficar pronto, aparece o botão Baixar."
     - Linha 533: "Ver se já está pronto"
     - Linha 511: trocar por "Arquivo pronto".
     - Linhas 512-515: apagar o SHA-256.
     - Linha 540: "Não foi possível preparar o arquivo. Tente de novo."

5. **Jargão de auditoria no resultado do relatório.**
   - **Onde:** `reports-local.pages.ts:321-322,334-355,363-385,391-403,433-438,492`.
   - **Correção:**
     - Apague as linhas 352-355 ("Catálogo · versão 1"), 363-381 (identificador e SHA-256) e 382-385.
     - "Recorte da consulta" → "Dados do relatório"
     - "Período inclusivo" → "Período"
     - "Total preservado" → "Total de registros"
     - "Média de limpeza das avaliações distintas" → "Nota média de limpeza"
     - "Ausências sem justificativa em chamadas fechadas" → "Faltas sem justificativa"
     - "Retornos físicos confirmados com atraso" → "Voltaram atrasados"
     - "Advertências vigentes no recorte" → "Advertências ativas"
     - "Séries mensais do recorte" → "Mês a mês"
     - "linhas" → "registros"

6. **A tabela do relatório quebra palavras no meio.**
   - **Onde:** `reports-local.scss:28`.
   - **Difícil:** aparece "Presen/ça", "Quart/o" e "31/10/20/26".
   - **Correção:** use `overflow-wrap: normal`. O `overflow-x: auto` já existe na linha 21.

7. **Chamada mostra UUID para o supervisor.** `/chamada`.
   - **Onde:** `night-call-local.component.ts:222-224,236`.
   - **Difícil:** aparece "Ausência justificada · saída 00000000-0000-…".
   - **Correção:** apague o id, deixando só "Ausência justificada". Apague também "Revisão {{ event.version }} ·".

8. **Textos da chamada e falta de explicação no botão desativado.**
   - **Onde:** `night-call-local.component.ts:37,57,71,75-76,136-137,140,216,304,320-321,338-339,357-358`.
   - **Correção:**
     - Linha 37: "Marque quem está presente hoje à noite."
     - Linha 57: tirar o código " · T".
     - Linha 71: "Ver chamada"
     - Linhas 75-76: "Horário da chamada: 22h às 23h30."
     - Linhas 136-137: apagar.
     - Linha 140: "Aberta fora do horário: {{motivo}}"
     - Linha 216: "Está fora com saída autorizada"
     - Linha 304: "Falta marcar {{n}} residente(s). Depois clique em Fechar chamada."
     - Linha 311: "Fechar chamada"
     - Linhas 320-321: "{{n}} residente(s) nesta chamada."
     - Linhas 338-339: "Agora não é o horário da chamada. Você vai precisar escrever o motivo."
     - Linhas 357-358: "Só é possível abrir a chamada de hoje. Escolha a data {{hoje}}."

9. **Ausência justificada exige clique manual.** Pedido direto do usuário.
   - **Onde:** `night-call-local.component.ts:275-285`.
   - **Difícil:** o supervisor precisa identificar e marcar quem já tem saída autorizada.
   - **Correção:**
     - Faça o backend gravar `AUSENCIA_JUSTIFICADA` ao abrir a chamada, para quem tem `authorizedExits`.
     - O supervisor só altera a marcação se a pessoa estiver presente.
     - A condição atual fica como está: saída autorizada e partida física válida na abertura.
     - Mexe em regra de negócio, não só em texto, e precisa de teste de integração.

10. **Pedido de saída tem explicação demais para uma criança.**
    - **Onde (curta):** `exit-form-local.component.ts:83-91,98,119,148-151,153,160`.
    - **Onde (longa):** `long-exit-form.component.ts:93-101,110,115,129,195-198,230-232,255`.
    - **Correção:**
      - Apague as linhas 148-151 (curta) e 195-198 (longa). "Última consulta do servidor" não ajuda ninguém.
      - Ajuda da curta: "Saída curta: até 3 horas. Fale com o supervisor antes de sair e ao voltar. Vai ficar mais tempo? Peça uma saída longa."
      - Ajuda da longa: "Saída longa: mais de 3 horas. Seu responsável precisa assinar antes de o supervisor aprovar."
      - Opção do select: "Agora"
      - "Retorno previsto" → "Que horas você volta?"
      - "Motivo da saída" → "Por que você quer sair?"
      - "Responsável para o convite" → "Quem vai assinar?"
      - Erro do motivo: "Escreva o motivo da saída."
      - Erro do responsável: "Escolha quem vai assinar."
      - Alerta ao editar: "Se você mudar o pedido, seu responsável precisa assinar de novo."
      - Botão: "Salvar alterações"

11. **Criança encontra só uma das saídas.** `/saidas`.
    - **Onde:** `exits-local.component.ts:49,56,72,82-115,127`.
    - **Difícil:** o botão de saída longa só aparece depois de abrir a aba "Longas". O residente ainda recebe a busca por "Nome ou matrícula", que não faz sentido na própria lista.
    - **Correção:**
      - Dois botões sempre visíveis: "Pedir saída curta (até 3 horas)" e "Pedir saída longa (mais de 3 horas)".
      - Abas: "Saídas curtas" e "Saídas longas".
      - Esconda os filtros para o perfil residente.
      - "0 registro(s)" → "Nenhum pedido ainda."

12. **Mensagens de bloqueio falam em jargão de cadastro.**
    - **Onde:** `operations-local.utils.ts:168-172`, `long-exit-form.component.ts:70,74,124`, `long-exit.utils.ts:52,69`.
    - **Correção:**
      - "É necessária uma alocação ativa em quarto." → "Você ainda não tem quarto no sistema. Fale com o supervisor."
      - Data de nascimento: "Sua data de nascimento não está no sistema. Fale com o supervisor."
      - Linha 70: "Seu responsável não tem telefone válido no sistema. Fale com o supervisor."
      - "cadastro indisponível" → "não pode assinar"

13. **Avisos ao criar saída longa expõem detalhes do sistema.**
    - **Onde:** `long-exit-form.component.ts:216-227`.
    - **Difícil:** "indisponível neste ambiente… confirmada posteriormente pelo servidor".
    - **Correção:** um único aviso: "O envio do pedido para seu responsável está fora do ar. Seu pedido fica salvo. Avise a equipe da residência."

14. **Erros não dizem o que fazer.**
    - **Onde:** `operations-local-api.service.ts:312-316`, `reporting-local.transport.ts:58` e vizinhas, `communications-local-api.service.ts:203-210`, `resident-form.component.ts:539`, `supervisor-form.component.ts:272`, `room-form.component.ts:532`, `guardians.pages.ts:850`.
    - **Correção:**
      - 409: "Outra pessoa alterou este registro. Clique em Recarregar, confira e tente de novo."
      - 401: "Sua sessão terminou. Entre de novo."
      - 403: "Sua conta não pode fazer isto. Se achar que é engano, saia e entre de novo ou fale com o gestor."
      - 404: "Não encontramos este registro."
      - 400/422: "Confira os campos e tente de novo."
      - Genérico: "Não deu certo. Verifique a internet e tente de novo."
      - "outra sessão" → "outra pessoa"
      - "Carregar versão atual…" em `resident-form:294`, `supervisor-form:140`, `room-form:313-315` e `guardians:650` → "Recarregar dados"

15. **"Leitura", "ciência" e "versão" confundem o residente.** `/avisos`.
    - **Onde:** `own-communications-local.pages.ts:76,85,96-99,230,269,277,289-290,300,310,412-417,497-498`, `communication-filters.component.ts:114`.
    - **Correção:**
      - Apague a linha 76 e o "versão N" das linhas 85 e 230.
      - Linha 300: "Já li"
      - Linha 310: "Estou ciente"
      - Linhas 289-290: "Clique em Já li quando terminar. Estou ciente mostra que você sabe do aviso; não é assinatura."
      - Etiquetas: "Lido", "Não lido", "Ciente"
      - Filtro "Superado" → "Versão anterior", igual a `communications-local.utils.ts:58`.

16. **Avisos e notificações do supervisor falam em revisão e evidência.**
    - **Onde:** `notices-local.pages.ts:86,251,407,460,482-483,494,597-603,616`, `notifications-local.pages.ts:121,289,313,533,545,658`, `evidence-local.component.ts:23,43,59`.
    - **Correção:**
      - `notices:251`: "Depois de publicar, você pode corrigir o texto, mas não mudar quem recebe."
      - "Preparar nova versão" → "Corrigir aviso"
      - "Revisar e publicar nova versão" → "Publicar correção"
      - "Revisão humana da evidência registrada." → "Conferência registrada."
      - Apague "versão N" e "Identificador da origem".

17. **Página inicial descreve o sistema em vez de dizer o que fazer.**
    - **Onde:** `local-home.page.ts:55,70,76,103,112,117,124`.
    - **Correção:**
      - Linha 55: "Envie avisos aos residentes."
      - Linha 70: "Veja avisos e advertências."
      - Linha 76: "Veja seus registros de saúde."
      - Linha 103: "Veja as notas de limpeza dos quartos."
      - Linha 112: "Gere relatórios em PDF ou Excel."
      - Linha 117: "Cadastros e quartos"
      - Linha 124: "Escolha quem da saúde pode ver os registros."
      - Em `app.html:34,197,225`: apague o selo "Acesso autenticado" e a frase "Acesso conforme o perfil da sua conta."

18. **Curso: "Buscar curso" separado e marcado como opcional.** Pedido direto do usuário.
    - **Onde:** `resident-form.component.ts:197-208,283-285`.
    - **Correção:**
      - Apague o campo de busca.
      - Use `sagerSearchable` no próprio select, a diretiva já existe.
      - Rótulo: "Curso *"
      - Primeira opção: "Selecione o curso"
      - Erro: "Escolha o curso."
      - Adicione `Validators.required`.
      - O AGENTS.md declara curso opcional no backend, então backend e documento mudam junto.
      - Linhas 283-285: "Depois de salvar, você poderá adicionar responsáveis e escolher o quarto."

19. **"Alocação" em gestão de moradia.**
    - **Onde:** `residents.component.ts:87,241`, `resident-detail.component.ts:154,158,161,169,223,232,264-265,388,397`, `room-detail.component.ts:161,175,183`, `room-form.component.ts:299`.
    - **Correção:**
      - Filtro: "Tem quarto?"
      - "Alocado desde" → "No quarto desde"
      - "Encerrar alocação" → "Tirar do quarto"
      - "Sem alocações" → "Nunca teve quarto"
      - Apague "Vínculo local provisório" e "Regra local provisória, sujeita à AE".

20. **Cadastro de supervisor promete pouco e confunde.** Pedido direto do usuário.
    - **Onde:** `supervisor-form.component.ts:93,131-132`, `supervisors.component.ts:156`, `supervisor-detail.component.ts:86`.
    - **Difícil:** "não concede acesso… credenciais locais de teste".
    - **Correção:**
      - O conserto real é criar a conta na hora, com senha e confirmação, como no residente. Isso exige backend.
      - Até lá: "Este cadastro ainda não cria a senha de acesso. Peça ao suporte para criar."
      - "Identificação institucional" → "Matrícula", já que todos entram pela matrícula.

21. **Cadastro de quarto parece técnico.**
    - **Onde:** `room-form.component.ts:182,189,207,299-300`.
    - **Correção:**
      - "Código global *" → "Código do quarto *"
      - Ajuda: "Não pode repetir. Exemplo: A-101."
      - Linha 207: "Exemplo: 101."
      - Linhas 299-300: "A capacidade é o máximo de moradores do quarto."

22. **Fonte e alvos pequenos para idosos.**
    - **Onde:** `styles.scss:64` (`--text-meta: 0.875rem`), `reports-local.scss:29`, `<small>` de 12,67 px em `resident-form.component.ts:174,206,258`, caixas de seleção de 20-22 px em `guardians.pages.ts:630,634`, `review-dialog-local.component.ts:131`, `night-call.component.ts:72`.
    - **Correção:**
      - `--text-meta: 1rem`.
      - `small { font-size: 1rem }` nos formulários.
      - `input[type='checkbox'] { width: 28px; height: 28px }`.
      - Revise o layout depois, porque as colunas estreitas crescem.

23. **Recuperar senha: texto e ordem.**
    - **Onde:** `recovery.page.ts:13-20,24,66,69,107,117-118`, `portal.pages.ts:74,280`.
    - **Correção:**
      - Abertura: "Confirme seus dados e crie uma senha nova."
      - Apague "Nenhuma mensagem será enviada…" e "Cadastros antigos…". Depois, em erro: "Não deu certo? Procure a equipe da residência."
      - Rótulo: "Nome completo do seu responsável (se tiver)"
      - Sucesso: "Senha trocada. Entre com sua matrícula e a senha nova."
      - `portal:74`: "É supervisor ou gestor? Peça ao suporte para trocar sua senha."
      - `portal:280`: "Matrícula ou senha errada. Confira e tente de novo. Se continuar, clique em Esqueci minha senha."

24. **Limpeza mostra regras internas.**
    - **Onde:** `cleaning-form-local.page.ts:88,111,138,172,295,319`, `cleaning-criteria-fields.component.ts:53`, `cleaning-local.pages.ts:144,361,365,463`.
    - **Correção:**
      - Dica do critério: "Nota de 0 a 10."
      - Linha 111: "Agora"
      - Linha 138: só "Média: {{valor}}"
      - Apague a linha 172 ("Política 1 · data institucional") e "Versão N".
      - "Nota calculada pelo servidor" → "Nota"

25. **Sobras no perfil, na ajuda e no responsável.**
    - **Onde:** `portal.pages.ts:1110,1117,1351,1357`, `exit-detail-local.component.ts:68,168`, `long-exit-detail.component.ts:63,85,195-196,235,252,332,356-357,402`, e o campo telefone do formulário de responsável em `guardians.pages.ts`.
    - **Difícil:** há telefone "(opcional)", mas sem telefone válido o responsável não recebe o pedido, e a criança só descobre ao pedir saída longa.
    - **Correção:**
      - Apague "Referência do cadastro" e os "Identificador".
      - Linha 1110: "Veja e confirme seus avisos."
      - Linha 1117: "Escolha o relatório e as datas."
      - "revisão atual" → "documento atual"
      - "confirmada pelo servidor" → "confirmada"
      - Dica do telefone: "Com DDD. Sem telefone, esta pessoa não recebe o pedido de saída longa."

## O que não verifiquei

- O backend real, nem o WhatsApp ou o Clicksign reais. O modo local usou fixtures minhas, então nem toda combinação de estados apareceu.
- Celular. A viewport foi só 1280×800.
- Leitor de tela e testes com pessoas reais.
- Fluxos sem execução:
  - envio bem-sucedido de saída;
  - decisão e aprovação;
  - fechamento da chamada;
  - publicação de aviso;
  - advertência e termos;
  - telas de saúde;
  - assinatura.
  Esses textos vieram só do código.
- `/advertencias/nova`, `/notificacoes`, `/minha-limpeza` e `/limpeza` no modo local deram erro porque meu mock não cobria os dados, sem indicar defeito do produto. O erro genérico é o que entrou no item 14.
- Formato da matrícula do IF Goiano e domínio institucional de e-mail. Não pesquisei, por estar fora desta auditoria, e também não avaliei favicon nem a rolagem das abas.

**Riscos:**
- Os itens 9, 18 e 20, além da parte de backend do item 2, mudam regra ou backend, então não são só texto.
- `integrations`, `operations/longexits` e o frontend de saídas estavam sendo editados por outro processo, então as linhas dos itens 10-13 e 25 podem ter mudado.