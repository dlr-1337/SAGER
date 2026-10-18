# SAGER — direção visual da primeira entrega

## Referência aprovada

A referência vigente é o canvas [SAGER — Telas](https://claude.ai/artifact/BKdtqU2e7xsG2noUAGLuQm) (17/10/2026), com 31 telas em seis grupos: acesso e assinatura, início e cadastros, operação, comunicação e limpeza, relatórios e saúde, e residente no celular. Ele parte da composição [Início B](.impeccable/mocks/inicio-b.png) — lista ampla de pendências, próxima tarefa evidente, navegação estável e apoio contextual discreto — e das referências de [saída longa](.impeccable/mocks/saida-detalhe.png) e [avisos no celular](.impeccable/mocks/avisos-mobile.png). Textos, datas e números do canvas são ilustrativos; elementos que dependem de dados ainda inexistentes (colunas de situação, quarto e responsável na lista de residentes, totais de leitura e ciência dos avisos, escala qualitativa de limpeza, agenda do início e aba de recuperação para a equipe) só entram quando o backend ou a decisão institucional existirem. O canvas é privado até ser compartilhado pelo responsável; para ver as telas implementadas sem acesso a ele, gere as capturas em `.impeccable/reviews/` com `SAGER_E2E_PORT=4320 npx playwright test -g 'captura telas centrais'` (a partir de `frontend/`). Use uma porta livre: fora do CI o Playwright reaproveita qualquer servidor já ativo na porta, como um container de homologação em 4200, e capturaria essa versão em vez do código local.

## Princípios de interface

1. A tela começa pela tarefa mais útil ao perfil, seguida por pendências em linhas amplas. Cada área tem um título direto e uma ação principal.
2. O verde escuro identifica navegação e ações; verde claro sinaliza apoio e sucesso. Avisos, erros e informação têm cores próprias acompanhadas por texto e ícone.
3. Os controles principais têm pelo menos 48 px de altura; controles secundários e alvos de toque têm pelo menos 44 × 44 px. Texto e espaço entre elementos favorecem leitura e coordenação motora.
4. Ícones Material Symbols acompanham rótulos nas ações importantes. Tabelas e gráficos apresentam resumo textual; nenhuma informação depende apenas de cor.
5. Foco visível, navegação por teclado, rótulos explícitos, indicação do erro junto ao campo e revisão antes de decisões são parte do fluxo.
6. O selo “Demonstração · dados fictícios” acompanha a navegação. Assinatura, exportação e autenticação aparecem claramente como simulações.

## Marca, tipografia e cores

- Marca oficial: PNG “Urutaí Horizontal Transparente” obtido da [página de marcas do IF Goiano](https://ifgoiano.edu.br/home/index.php/comunicacao/972-marcas-do-if-goiano.html), salvo sem alterações em `frontend/public/if-goiano-urutai.png`. O espaço claro ao redor da marca protege sua leitura sobre o cabeçalho verde.
- Tipografia: Open Sans local, com pesos 400, 600, 700 e 800. Números e status usam contraste e hierarquia de peso, sem depender de fontes carregadas pela rede.
- Verde de ação `#0c4837`; fundo claro `#f8fbfa`; texto principal `#182735`; linha `#d6e0e5`. A escala está em `frontend/src/styles.scss`.
- Padrões convergidos em todas as áreas: botão primário verde `#0c4837` (hover `#073b2d`) e secundário branco com borda `#9fb8ae`; cartões brancos com borda, raio de 14 px e sombra suave; status em pílula com texto; notas com fundo de cor própria; abas como controle segmentado; filtros em linha que quebram no celular; tabelas dentro de caixa com rolagem própria; foco em anel duplo, com `#f4ba35` por fora e verde-escuro `#073b2d` por dentro, para manter 3:1 tanto sobre o cabeçalho verde quanto sobre fundos claros. Bordas de campo usam `--field-border` (`#758a94`), mais escura que a do canvas, para manter contraste não textual de 3:1.
- O menu lateral separa três grupos: rotina do dia, cadastros e consultas, conta e apoio. O item ativo tem fundo verde-claro e barra de 4 px.
- Espaçamento em passos de 4 px, conteúdo amplo limitado a 1280 px, cartões com raio de 14 px e metadados de pelo menos 14 px. Gestão, operação e relatórios partilham esses valores; cada fluxo preserva a largura que sua tarefa exige.
- A composição foi medida com o Impeccable em `.impeccable/build/spec.json`. A análise automática sugeriu Fira Sans como aproximação de uma região de imagem, mas Open Sans foi mantida por consistência, legibilidade e menor variação entre telas. A marca oficial substitui o símbolo inventado no conceito, por isso a “plate” da marca não será gerada por IA.

## Padrões e estados

- Gestor: listas, formulários e detalhes de residentes, responsáveis e supervisores, mapa de quartos e relatórios. Supervisor: chamada, saídas/retornos, notificações e limpeza. Residente: próprias saídas, avisos/advertências e ranking. O seletor de perfil existe somente na demonstração.
- Lista: busca/filtros, resultado, vazio, erro e carregamento indicados em texto. Formulário: campos agrupados, validação, revisão e resultado. Decisão: contexto, consequências e opção de cancelar.
- Avisos e advertências usam abas distintas. A leitura não registra ciência; há uma confirmação própria.
- No celular, o cabeçalho mostra SAGER, Demonstração e Menu. A marca oficial aparece somente no topo do menu aberto; no desktop, permanece no cabeçalho. Exceção: nas páginas públicas (acesso), a marca permanece visível no cabeçalho também no celular. A gaveta móvel contém navegação, perfil e cenário, prende o foco enquanto está aberta e devolve o foco ao botão Menu ao fechar.
- No celular, abrir um aviso troca a lista pelo detalhe e oferece “Voltar à lista”. Resultados de relatórios usam resumos expansíveis em vez de uma tabela cortada; a tabela completa permanece no desktop. Os cinco filtros complementares ficam em “Mais filtros” no celular e os filtros aplicados são mostrados junto aos resultados.
- A exportação apresenta uma simulação já no rótulo dos botões. Seu diálogo bloqueia a interação com o fundo, mantém o foco, fecha com Escape e devolve o foco à ação de origem.
- Saída longa apresenta assinatura antes de permitir aprovação. O retorno curto é confirmado pelo supervisor.
- A métrica de comportamento, regras de ranking/limpeza, permissões finais e procedimento formal de assinatura ficam identificados como pendências da AE/TI.

## Revisão

Meta técnica: WCAG 2.2 AA, com regra adicional de alvo de 44 × 44 px. A verificação nesta etapa cobre fluxos automatizados e inspeção em desktop/celular, teclado, foco e zoom. Facilidade real para pessoas mais velhas depende de teste com usuários representativos na etapa de validação institucional.
