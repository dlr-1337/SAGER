# Guia de uso do SAGER

Como usar o sistema em cada perfil. Para instalar e operar, veja [OPERACAO.md](OPERACAO.md). Dentro do sistema, a página **Ajuda** traz orientações curtas por perfil.

## Sumário

- [Acesso](#acesso)
- [Demonstração](#demonstração)
- [Gestor](#gestor)
- [Supervisor](#supervisor)
- [Residente](#residente)
- [Quando algo dá errado](#quando-algo-dá-errado)
- [Glossário](#glossário)

## Acesso

1. Abra o endereço do SAGER e entre com seu **usuário** e sua senha. O residente usa a matrícula; o supervisor, o usuário definido no cadastro dele; o gestor, o usuário criado pelo suporte da instituição.
2. Esqueceu a senha? O residente usa **Esqueci minha senha**, que confere matrícula, nome, data de nascimento e, se houver responsável ativo, o nome de um deles. Gestor e supervisor procuram o suporte da instituição, que confere quem é a pessoa e troca a senha.
3. Ao terminar, use **Sair**, principalmente em computador compartilhado. A sessão também se encerra sozinha 30 minutos depois da sua última ação, mesmo com a tela se atualizando sozinha.

As telas se atualizam sozinhas a cada 15 segundos. Depois de 30 minutos sem uso, a tela para de se atualizar e a sessão termina; entre de novo.

Depois de 5 senhas erradas para o mesmo usuário, o login fica bloqueado por até 15 minutos. Não há cadastro público: as contas nascem com o cadastro do residente ou do supervisor, e as de gestor são criadas pelo suporte da instituição.

No celular, as telas ficam no botão **Menu**. Tudo também funciona só pelo teclado.

Em cada lista, a busca fica à vista; os outros filtros ficam em **Mais filtros**, que abre fechado. A situação de cada registro aparece escrita e com uma cor: amarelo espera alguém agir, azul está em curso, verde deu certo ou está valendo, vermelho foi negado ou deu problema e cinza está encerrado. Abra **O que significa cada cor?** para ver os nomes de cada tela.

## Demonstração

Para conhecer as telas sem conta, use **Explorar com um perfil fictício** na tela de acesso e escolha gestor, supervisor ou residente. Os dados são fictícios e nada do que você fizer altera o sistema real. A demonstração não existe na versão oficial, e, se o sistema real falhar, ele mostra o erro, nunca dados de exemplo.

## Gestor

1. **Cadastros.** Comece pela estrutura: em **Cursos**, clique em **Cadastrar curso** (o formulário só abre pelo botão; no ensino médio a duração já fica em 3 anos, e no superior você informa de 1 a 6); em **Quartos** › **Gerenciar alojamentos**, os alojamentos (com a faixa etária, se houver) e as casas ou blocos; depois, os quartos. Só então cadastre os residentes, que exigem curso e ano de entrada, e os responsáveis. O cadastro de residente e de supervisor já cria a conta de acesso, com a senha escolhida por quem cadastra.
2. **Alocação.** Abra o residente em **Residentes**, escolha o quarto em **Colocar no quarto** (ou em **Mudar para**, se ele já tem quarto) e confirme. **Tirar do quarto** encerra a alocação. O histórico guarda a ocupação anterior. O sistema recusa alocar em alojamento de outra faixa etária e alocar quem já concluiu o curso.
3. **Limpeza e ranking.** Em **Limpeza** e **Ranking**, acompanhe as avaliações por período. Nota zero e falta de avaliação são coisas diferentes.
4. **Relatórios.** Em **Relatórios**, escolha o tipo, o período e os filtros e gere PDF ou planilha. O arquivo traz o recorte daquele momento e fica disponível por 24 horas; para ver mudanças posteriores, gere outro.

O gestor não opera chamada noturna, saídas, disciplina nem avisos.

## Supervisor

1. **Chamada noturna.** Entre 22h e 23h30, escolha o alojamento e clique em **Abrir chamada**. A lista dos residentes menores alocados fica congelada na abertura, e quem está fora com saída válida já aparece com ausência justificada; confira e corrija se preciso. Para achar alguém, use a busca por nome ou matrícula, ou casa ou bloco e quarto em **Mais filtros**. Marque cada um e clique em **Fechar chamada**, que só funciona com todos marcados. Fora desse horário, o sistema pede confirmação e justificativa. Corrigir depois também exige justificativa e preserva o registro original.
2. **Saídas e retornos.** Analise os pedidos e registre a partida e o retorno reais. Ao aprovar um pedido para sair agora, a aprovação já registra a saída; no pedido agendado, registre a saída a partir do horário marcado. Na saída curta, as 3 horas contam da saída que você registra; se o residente não voltar nesse prazo, o sistema abre uma notificação de ocorrência. O detalhe da saída mostra só o passo da vez:
   - **Autorização do responsável** (só na longa): abra o arquivo com **Baixar arquivo** e clique em **Confirmar conferência** ou **Recusar arquivo**. Recebeu por outro meio? Use **Anexar arquivo**. A rejeição, com motivo, pode vir antes da conferência.
   - **Decisão:** **Aprovar** (na longa, **Aprovar saída**) ou **Rejeitar**. Aprovar é um passo separado da conferência. Mensagem enviada ou arquivo recebido não aprova nada.
   - **Saída** (só na agendada): quando chegar a hora marcada, **Registrar saída**.
   - **Volta:** quando o residente chegar, **Registrar volta**.

   Histórico, arquivos antigos e **Cancelar pedido** ficam em **Mais detalhes**.
3. **Notificações de ocorrência, advertências e termos.** O sistema abre uma notificação de ocorrência para análise quando há falta sem justificativa na chamada, saída curta que passou das 3 horas sem volta registrada, volta atrasada ou limpeza abaixo de 6. Analise a origem e as evidências e arquive a notificação de ocorrência com motivo ou converta-a em advertência. Você também registra advertências manuais e as anula com motivo. Quando o sistema indicar possível reincidência (duas advertências vigentes da mesma categoria em 90 dias), use **Revisar possível reincidência** e decida se emite o termo de compromisso. Nada vira punição sozinho.
4. **Avisos.** Em **Quem recebe?**, escolha todos os moradores, um alojamento, um quarto, só maiores ou só menores de 18, ou escolha pessoas uma a uma. Confira quantos vão receber e, se precisar, desmarque alguém em **Ver quem vai receber**. Quem não tem data de nascimento não entra nas opções por idade. A lista fica fixa no rascunho: quem chegar depois não recebe. Confira destinatários e texto antes de publicar. Editar cria nova versão, e a ciência anterior não vale para ela.
5. **Limpeza.** Clique em **Registrar avaliação** e siga os três passos: **Qual quarto?** (foi em outro dia? abra essa opção e escolha a data), **Notas** (de 0 a 10 nos quatro critérios, com a média calculada) e **Conferir e salvar**. Use **Voltar** para mudar algo antes de salvar.
6. **Conversas (opcional).** Quando o gateway de WhatsApp estiver ligado, troque mensagens com os responsáveis. A integração ainda não foi testada com um número real, e nenhuma mensagem aprova saída: a autorização continua sendo conferida e decidida no sistema. Arquivo do responsável que já está numa saída longa mostra o residente e a situação, com **Abrir saída**; arquivo livre mostra **Vincular a uma saída longa**.
7. **Cadastros, ranking e relatórios.** Funcionam como para o gestor, exceto o cadastro de supervisores, que é só do gestor.

## Residente

1. **Meu perfil.** Confira seu nome, sua matrícula e seu quarto. Se algum dado estiver errado, ou se o quarto não aparecer, procure a equipe da residência. Se a tela disser que sua conta não está ligada ao seu cadastro, peça ao suporte da instituição para ligar.
2. **Minhas comunicações.** Leia avisos, advertências e termos de compromisso. O que está em vigor aparece como **Valendo**, na lista e no filtro. Confirme a ciência só depois de ler a versão apresentada. Ciência não é assinatura.
3. **Minha limpeza e Ranking.** Veja as avaliações do seu quarto e a posição geral.
4. **Minhas saídas** (só para menores de idade). Peça uma saída curta ou longa e acompanhe o pedido. Na curta, você diz só quando quer sair e por quê: ela dura até 3 horas a partir da hora em que o supervisor registra sua saída. Na saída longa, escolha o responsável que vai autorizar; o supervisor confere a autorização antes de aprovar. Quem registra a saída e a volta é o supervisor; no pedido para sair agora, a aprovação já registra a saída. O residente maior de idade não pede saídas e não vê esse item no menu.

## Quando algo dá errado

| Situação | O que fazer |
| --- | --- |
| Sessão encerrada | Entre de novo. |
| Login bloqueado | Espere até 15 minutos e tente de novo. |
| Sem permissão | Confira o perfil com que entrou e procure o suporte da instituição. |
| Registro alterado por outra pessoa | Clique em **Recarregar dados** e refaça a ação. Nada é sobrescrito. |
| WhatsApp fora do ar | O supervisor anexa a autorização à mão. |
| Relatório expirado | Gere outro; os arquivos ficam disponíveis por 24 horas. |

## Glossário

| Termo | Significado |
| --- | --- |
| **Advertência** | Registro disciplinar feito pelo supervisor depois de analisar o caso. |
| **Alocação** | Vínculo do residente com um quarto, com data de início e de fim. |
| **Autorização conferida** | Registro de que o supervisor conferiu responsável, documento e revisão da autorização de uma saída longa. É uma revisão humana, não uma assinatura eletrônica. |
| **Aviso** | Comunicado da Assistência Estudantil para os residentes escolhidos. Não é punição. |
| **Chamada noturna** | Conferência de presença dos residentes menores alocados, feita pelo supervisor. |
| **Ciência** | Confirmação do residente de que leu uma versão de um aviso, advertência ou termo. |
| **Expirada** | Pedido de saída cujo prazo passou sem decisão ou sem partida. O sistema faz isso sozinho. |
| **Faixa etária** | Indica se o alojamento recebe só menores ou só maiores de 18 anos. |
| **Notificação de ocorrência** | Caso que o sistema separa para o supervisor analisar: falta sem justificativa, saída curta sem volta depois das 3 horas, volta atrasada ou limpeza abaixo de 6. Nunca vira advertência sozinha. |
| **Ranking** | Classificação dos quartos pela média das avaliações de limpeza no período. |
| **Saída curta** | Saída de até 3 horas, contadas da hora em que o supervisor registra a saída. |
| **Saída longa** | Saída com retorno previsto em mais de 3 horas. Exige a autorização do responsável. |
| **Suporte da instituição** | Equipe de TI responsável pelo SAGER: cria as contas de gestor e troca a senha de servidores. |
| **Termo de compromisso** | Documento emitido pelo supervisor quando há possível reincidência. |
