# simple-screens Specification

## Purpose
Manter as telas do SAGER simples para servidores com pouca prática com computador e para quem tem TDAH: uma frase de orientação por tela, formulário de cadastro só quando pedido, tarefas longas em passos, só a ação do momento à vista, confirmações em uma frase e cor de situação com legenda. As telas próprias do modo demonstração (RF027) ficam como estão.

## Requirements

### Requirement: Formulário de cadastro só quando pedido

No acesso por conta, uma tela de lista MUST NOT abrir com formulário de cadastro à vista: ela SHALL mostrar a lista e um botão de cadastro, e o formulário só aparece quando o usuário clica nele ou em Editar. Salvar com sucesso e Cancelar SHALL fechar o formulário e voltar à lista.

#### Scenario: Cursos ao abrir

- **WHEN** o gestor abre Cursos
- **THEN** ele vê a lista de cursos e o botão "Cadastrar curso", sem nenhum campo de cadastro

#### Scenario: Cadastrar curso

- **GIVEN** a tela de Cursos aberta
- **WHEN** o gestor clica em "Cadastrar curso", preenche o curso e salva
- **THEN** o formulário fecha e o curso novo aparece na lista

#### Scenario: Editar e cancelar

- **GIVEN** o formulário aberto pelo Editar de um curso, já preenchido com ele
- **WHEN** o gestor clica em Cancelar
- **THEN** o formulário fecha e o curso continua como estava

#### Scenario: Advertências ao abrir

- **WHEN** o supervisor abre Advertências
- **THEN** ele vê a lista e o botão "Nova advertência", sem campos de advertência, e o formulário só aparece depois do clique

### Requirement: Uma frase de orientação por tela

No acesso por conta, cada tela, exceto a Ajuda, SHALL ter no máximo uma frase de orientação de até 20 palavras abaixo do título. Explicações mais longas SHALL ficar na Ajuda ou num "Saiba mais" recolhido ao abrir a tela. Avisos de erro, de conflito e de prazo continuam à vista.

#### Scenario: Cabeçalho da tela

- **WHEN** o supervisor abre Advertências
- **THEN** abaixo do título há uma única frase, de até 20 palavras

#### Scenario: Explicação longa

- **GIVEN** uma tela com explicação de mais de uma frase
- **WHEN** o usuário abre a tela
- **THEN** a explicação está recolhida em "Saiba mais" e só aparece depois do clique

#### Scenario: Prazo continua à vista

- **GIVEN** uma saída curta aguardando análise, com prazo para iniciar
- **WHEN** o supervisor abre o detalhe
- **THEN** o prazo aparece à vista, fora de "Saiba mais"

### Requirement: Confirmação em uma frase

Toda pergunta de confirmação SHALL dizer em uma frase o que vai acontecer, e o botão de confirmar SHALL ter o nome da ação, sem repetir regras que a tela já mostrou. Os campos exigidos pela regra, como justificativa ou observação, continuam no diálogo.

#### Scenario: Cancelar um pedido

- **WHEN** o supervisor clica em "Cancelar pedido" numa saída aguardando análise
- **THEN** o diálogo diz em uma frase que o pedido será cancelado e o botão de confirmar se chama "Cancelar pedido"
- **AND** o botão que só fecha o diálogo se chama "Voltar"

### Requirement: Cor de cada situação

No acesso por conta, toda etiqueta de situação de saídas, chamada noturna, notificações, advertências, termos, avisos e comunicações do residente SHALL ter o tom do seu significado: atenção para o que espera alguém, informação para o que está em curso, sucesso para o que terminou bem ou vale, perigo para rejeição ou falha e neutro para o que acabou sem efeito. O texto da situação MUST continuar escrito na etiqueta.

#### Scenario: Saídas

- **WHEN** o supervisor abre a lista de saídas
- **THEN** "Aguardando análise" aparece em amarelo, "Aprovada" e "Em andamento" em azul, "Retorno confirmado" em verde, "Retorno confirmado com atraso" em amarelo, "Rejeitada" em vermelho e "Cancelada" e "Expirada" em cinza, cada uma com o nome escrito

#### Scenario: Chamada noturna

- **WHEN** o supervisor abre uma chamada aberta e depois uma fechada
- **THEN** "Aberta" aparece em amarelo e "Fechada" em verde

#### Scenario: Comunicações

- **WHEN** o supervisor abre notificações, avisos e advertências
- **THEN** a notificação "Pendente" aparece em amarelo, "Arquivada" em cinza, o aviso "Publicado" em verde, "Rascunho" e "Retirado" em cinza e a advertência "Anulada" em cinza

#### Scenario: Arquivos da saída longa

- **WHEN** o supervisor abre uma saída longa com um arquivo aguardando conferência e outro recusado
- **THEN** "Aguardando conferência" aparece em amarelo, "Arquivo recusado" em vermelho e a situação da autorização na cor do seu nome

### Requirement: Legenda das cores

Cada tela com etiquetas de situação SHALL ter a legenda "O que significa cada cor?", recolhida ao abrir a tela, com uma linha para cada situação que a tela pode mostrar: a etiqueta, na mesma cor e com o mesmo nome da lista, e uma frase curta do que ela quer dizer.

#### Scenario: Legenda das saídas

- **GIVEN** a lista de saídas aberta, com a legenda fechada
- **WHEN** o supervisor abre "O que significa cada cor?"
- **THEN** ele vê uma linha para cada situação de saída, com a etiqueta colorida e o significado

#### Scenario: Legenda no detalhe

- **WHEN** o supervisor abre o detalhe de uma saída, notificação, aviso, advertência ou termo, ou o residente abre uma comunicação sua
- **THEN** a tela tem a legenda "O que significa cada cor?", fechada, com as situações que o detalhe pode mostrar

### Requirement: Mesmo nome no filtro e na lista

O nome de uma situação SHALL ser o mesmo no filtro, na etiqueta da lista, no detalhe e na legenda da mesma tela.

#### Scenario: Advertência valendo

- **WHEN** o supervisor abre o filtro de situação das advertências
- **THEN** as opções são "Valendo" e "Anulada", os mesmos nomes das etiquetas da lista

#### Scenario: Comunicações do residente

- **WHEN** o residente abre o filtro de situação das próprias comunicações
- **THEN** a opção da comunicação em vigor se chama "Valendo", como na lista

### Requirement: Rejeitar e recusar em vermelho

Os botões que rejeitam um pedido de saída ou recusam um arquivo de autorização SHALL usar o estilo de perigo, em vermelho, com o nome da ação escrito, e MUST NOT ser o botão principal da tela. No diálogo que confirma rejeitar, recusar ou cancelar um pedido, o botão de confirmar SHALL usar o mesmo estilo de perigo.

#### Scenario: Saída curta aguardando análise

- **WHEN** o supervisor abre uma saída curta aguardando análise
- **THEN** "Aprovar" é o botão principal e "Rejeitar" aparece em vermelho ao lado

### Requirement: Avaliação de limpeza em três passos

A avaliação de limpeza nova SHALL ser feita em três passos, um por vez, com "Passo N de 3", Voltar e Continuar: "Qual quarto?" (alojamento, casa ou bloco e quarto), "Notas" (os quatro critérios, a média calculada e a observação) e "Conferir e salvar". Continuar MUST NOT avançar com campo inválido do passo, e Voltar mantém o que foi preenchido. A correção começa em "Notas", com o quarto fixo.

#### Scenario: Primeiro passo

- **WHEN** o supervisor abre uma avaliação nova
- **THEN** ele vê só "Passo 1 de 3: Qual quarto?", sem os critérios, e Continuar sem quarto escolhido pede para escolher o quarto

#### Scenario: Notas com média

- **GIVEN** um quarto escolhido no passo 1
- **WHEN** o supervisor clica em Continuar e preenche 8, 7, 9 e 6,5
- **THEN** ele vê os quatro critérios, a observação e a média 7,63

#### Scenario: Conferir e voltar

- **GIVEN** o passo 3 com o quarto, as quatro notas, a média e a observação
- **WHEN** o supervisor clica em Voltar
- **THEN** o passo 2 aparece com as notas que ele já tinha preenchido

#### Scenario: Avaliação de outro dia

- **WHEN** o supervisor abre uma avaliação nova
- **THEN** a avaliação de outro dia fica recolhida no passo 1 e, ao abri-la, pede a data e hora e o motivo do registro depois

#### Scenario: Correção

- **WHEN** o supervisor corrige uma avaliação existente
- **THEN** a tela começa em "Notas", com o quarto fixo, e o motivo da correção é pedido em "Conferir e salvar"

### Requirement: Saída longa com só o próximo passo

No detalhe da saída longa, o supervisor SHALL ver o resumo do pedido (residente, saída, volta, motivo e responsável) e só o passo atual: "Autorização do responsável" até a conferência; "Decisão", com "Aprovar saída"; "Saída", só na agendada aprovada, com "Registrar saída" a partir da hora pedida; e, em andamento, "Volta", só com "Registrar volta". "Rejeitar" MUST continuar à vista nos dois primeiros passos, também antes da conferência.

#### Scenario: Sem arquivo recebido

- **GIVEN** uma saída longa aguardando autorização, sem arquivo recebido
- **WHEN** o supervisor abre o detalhe
- **THEN** o passo "Autorização do responsável" diz "Aguardando o responsável enviar pelo WhatsApp", "Anexar arquivo" fica à vista, "Reenviar documento" fica recolhido em "Outras opções", "Rejeitar" aparece em vermelho e "Aprovar saída" não aparece

#### Scenario: Autorização conferida

- **GIVEN** uma autorização conferida na revisão atual
- **WHEN** o supervisor abre o detalhe
- **THEN** ele vê o passo "Decisão", com "Aprovar saída" e "Rejeitar" em vermelho

#### Scenario: Saída agendada antes da hora

- **GIVEN** uma saída longa agendada, aprovada, com partida pedida para daqui a 2 horas
- **WHEN** o supervisor abre o detalhe
- **THEN** o passo "Saída" mostra "Saída marcada para" com a data e a hora, sem "Registrar saída"

#### Scenario: Saída em andamento

- **GIVEN** uma saída longa em andamento
- **WHEN** o supervisor abre o detalhe
- **THEN** a única ação à vista é "Registrar volta"

### Requirement: Conferência por arquivo

Cada arquivo candidato SHALL aparecer com "Baixar arquivo", "Confirmar conferência" e "Recusar arquivo", os nomes do cap. 7 da monografia. "Confirmar conferência" MUST abrir o diálogo "Conferir autorização recebida", com a declaração atual de que o supervisor conferiu responsável e documento e a justificativa quando o telefone diverge; "Recusar arquivo" MUST pedir a justificativa da recusa. Nenhum dos dois aprova a saída.

#### Scenario: Confirmar a autorização

- **GIVEN** um arquivo candidato da revisão atual
- **WHEN** o supervisor clica em "Confirmar conferência" e confirma a declaração no diálogo
- **THEN** a autorização fica conferida, a saída continua aguardando decisão e a tela passa ao passo "Decisão"

#### Scenario: Recusar o arquivo

- **WHEN** o supervisor clica em "Recusar arquivo" e informa a justificativa
- **THEN** o arquivo fica recusado e o passo volta a aguardar o responsável

### Requirement: Detalhes recolhidos da saída longa

O histórico, o documento enviado, os arquivos já decididos, os arquivos sem vínculo e "Cancelar pedido" SHALL ficar em "Mais detalhes", recolhido ao abrir o detalhe da saída longa. "Anexar arquivo" SHALL ficar à vista no passo "Autorização do responsável", com ou sem o aviso de entrega não confirmada.

#### Scenario: Abrir o detalhe

- **WHEN** o supervisor abre uma saída longa
- **THEN** "Mais detalhes" está fechado

#### Scenario: Entrega não confirmada

- **GIVEN** um documento enviado há 20 minutos sem confirmação de entrega
- **WHEN** o supervisor abre o detalhe
- **THEN** a tela avisa e mostra "Anexar arquivo" à vista, fora de "Mais detalhes"

### Requirement: Saída curta com só a ação do momento

No detalhe da saída curta, o supervisor SHALL ver o resumo do pedido e só a ação do momento: "Aprovar" e "Rejeitar" enquanto aguarda análise; na agendada aprovada, "Saída marcada para" com a data e a hora e, a partir da hora pedida, só "Registrar saída"; com a saída em andamento, só "Registrar volta". O histórico e "Cancelar pedido" ficam em "Mais detalhes", recolhido.

#### Scenario: Saída agendada na hora

- **GIVEN** uma saída curta agendada e aprovada cuja partida pedida chegou
- **WHEN** o supervisor abre o detalhe
- **THEN** a única ação à vista é "Registrar saída"

#### Scenario: Saída em andamento

- **GIVEN** uma saída curta em andamento
- **WHEN** o supervisor abre o detalhe
- **THEN** a única ação à vista é "Registrar volta" e o histórico está recolhido em "Mais detalhes"

#### Scenario: Conflito de edição

- **GIVEN** outra pessoa alterou o pedido enquanto o detalhe estava aberto
- **WHEN** o supervisor tenta registrar a volta
- **THEN** a tela informa a alteração e oferece "Recarregar dados"

### Requirement: Filtros da chamada noturna

A chamada noturna SHALL oferecer a busca por nome ou matrícula à vista e só casa ou bloco e quarto em "Mais filtros", sem filtro por marcação.

#### Scenario: Abrir os filtros da chamada

- **GIVEN** uma chamada aberta
- **WHEN** o supervisor abre "Mais filtros"
- **THEN** ele vê casa ou bloco e quarto, e não vê "Marcação"

### Requirement: Cabeçalho e menu sempre à vista

Nas telas internas, o cabeçalho com a marca, "Sair" e "Menu" SHALL ficar no topo da janela enquanto a página rola. No computador, o menu lateral SHALL ficar ao lado do conteúdo com a altura da janela; quando a lista não couber, só ela rola, e o botão de sair fica à vista ao pé. A página MUST continuar rolando pela janela, e um item focado MUST NOT ficar escondido sob o cabeçalho.

#### Scenario: Lista longa no computador

- **GIVEN** o supervisor numa tela com mais dados que a janela
- **WHEN** ele rola até o fim da página
- **THEN** o cabeçalho, o menu lateral e o botão de sair continuam à vista

#### Scenario: Celular

- **GIVEN** o supervisor no celular, numa tela rolada até o fim
- **WHEN** ele olha o topo da tela
- **THEN** "Menu" está à vista e abre a gaveta com o botão de sair

#### Scenario: Foco pelo teclado

- **GIVEN** uma tela rolada até o fim
- **WHEN** o foco vai para um item do topo do conteúdo
- **THEN** o item aparece abaixo do cabeçalho

### Requirement: Acesso sem rolar

A tela de acesso SHALL caber na altura visível da janela, sem rolar, a partir de 360 por 640 px no celular e de 1024 por 600 px no computador. Em telas menores, com o teclado aberto ou com zoom, a página MUST continuar rolando, sem esconder nenhuma parte do formulário.

#### Scenario: Celular pequeno

- **GIVEN** o acesso de produção numa tela de 360 por 640 px
- **WHEN** a tela abre
- **THEN** usuário, senha, "Entrar" e os links de ajuda aparecem sem rolar

#### Scenario: Notebook com barra do navegador

- **GIVEN** o acesso de produção numa janela de 1366 por 617 px
- **WHEN** a tela abre
- **THEN** a página não rola

#### Scenario: Tela menor que o formulário

- **GIVEN** o acesso numa tela de 320 por 568 px
- **WHEN** o usuário rola até o fim
- **THEN** o botão "Entrar" e os links de ajuda ficam alcançáveis
