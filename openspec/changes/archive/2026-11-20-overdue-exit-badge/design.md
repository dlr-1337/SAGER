## Context

A situação gravada da saída só muda quando alguém age. A curta em andamento depois do prazo continua `EM_ANDAMENTO`, e a rotina abre uma notificação de ocorrência para o supervisor. A longa não tem rotina de atraso. As listas vêm do servidor, paginadas e ordenadas do pedido mais novo ao mais antigo. Por isso, uma saída esquecida de um dia anterior fica no fim da lista.

## Goals / Non-Goals

**Goals:**
- Quem abre a lista ou o detalhe vê na hora que a saída passou do prazo.
- A saída vencida aparece primeiro na lista.

**Non-Goals:**
- Gravar a situação "atrasada" no banco ou criar advertência.

## Decisions

1. **"Atrasada" é uma situação mostrada, calculada a cada leitura.** A tela compara o retorno previsto com o horário do servidor que vem em cada saída (`now`). A situação gravada não muda.
   - Alternativa rejeitada: um estado `ATRASADA` gravado por uma rotina. Mudaria a versão do pedido sem ato humano, poderia causar conflito com o registro da volta e exigiria migração da restrição de situação.
2. **Filtro `ATRASADA` e "Em andamento" só dentro do prazo, no servidor.** A lista é paginada no servidor, então só ele consegue filtrar e contar certo. Para o servidor, `ATRASADA` significa `EM_ANDAMENTO` com retorno previsto até agora, pelo relógio da aplicação.
   - Alternativa rejeitada: filtrar na tela. O total e as páginas ficariam errados.
3. **Atrasadas primeiro na ordem da lista.** A busca paginada compartilhada aceita parâmetros na ordem. Assim, "retorno previsto até agora" usa o mesmo relógio da aplicação dos testes e da produção.
   - Alternativa rejeitada: `now()` do banco. Nos testes, o relógio da aplicação é controlado e difere do relógio do banco.
   - Alternativa rejeitada: pôr todas as saídas em andamento no topo. Os pedidos que esperam o residente aparecer ficariam abaixo das saídas sem pendência.
4. **"Atrasada" com a cor de perigo.** Pela regra de `simple-screens` ("perigo para rejeição ou falha"), o atraso é uma falha que pede atenção imediata.
   - Alternativa rejeitada: a cor de atenção, amarela. Ela já marca o que espera alguém, como "Aguardando análise", e o atraso se perderia entre esses itens.

## Risks / Trade-offs

- O selo depende do horário do servidor na leitura. A tela se atualiza sozinha (`auto-refresh`), então o selo aparece na atualização seguinte ao vencimento.
- A saída longa atrasada continua sem notificação de ocorrência automática. Por enquanto, o selo é o único aviso.

## Pendências institucionais

- **Notificar o residente sobre o atraso**: ficou em aberto na reunião.
- **Notificação de ocorrência para a saída longa atrasada**, como já existe na curta: não foi discutida.
