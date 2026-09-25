# Revisão visual e responsiva do SAGER — 25/09/2026

## Resultado visual

- A composição **Início B**, escolhida pelo usuário, orienta o painel: tarefa prioritária, lista ampla de pendências e navegação estável.
- A marca oficial do IF Goiano Campus Urutaí aparece sem alteração. O símbolo ilustrativo do conceito foi substituído pelo arquivo institucional.
- Duas avaliações independentes encontraram uma base heurística de **27/40** antes desta revisão. O detector retornou `[]`, mas a inspeção no navegador revelou menu fechado ainda focável, foco e rolagem no fundo com o menu aberto, cabeçalho de 212 px a 320 px, detalhe de aviso distante da lista e ações de saída abaixo da área inicial.
- O painel agora mostra quantidades derivadas dos Signals de demonstração e a situação de cada pendência. Saída longa usa colunas no desktop; filtros de relatórios formam uma grade regular. Em 320 px, os resultados aparecem como resumos expansíveis.
- O cabeçalho móvel foi compactado; a marca oficial aparece somente no topo do menu móvel aberto, com perfil e cenário abaixo da navegação. O Angular CDK contém o foco, o fundo fica inerte e sem rolagem, e o foco retorna ao botão Menu ao fechar.
- Avisos no celular alternam lista e detalhe, com Voltar à lista e ciência explícita em largura total. Abrir para leitura não registra ciência.
- Capturas finais em `.impeccable/reviews/`: início, saída longa, avisos, relatórios e menu móvel, em desktop e celular. A comparação é de estrutura, alinhamento, hierarquia e comportamento; marcas e textos dos conceitos eram ilustrativos.

## Comparação crítica com as composições

| Referência | Diferença medida na primeira implementação | Resultado após `layout`, `adapt`, `typeset` e `polish` |
| --- | --- | --- |
| [Início B](mocks/inicio-b.png) | O painel não apresentava as quantidades e situações que sustentam a lista de pendências. | [Captura desktop](reviews/inicio-supervisor-desktop.png): contagens derivadas dos dados de demonstração, lista ampla, próxima tarefa e apoio contextual. Mantidos os textos e a marca institucionais. |
| [Saída longa](mocks/saida-detalhe.png) | O próximo passo ficava abaixo do conteúdo principal e o alinhamento entre detalhes, histórico e decisão mudava sem uma grade própria. | [Captura desktop](reviews/saida-longa-desktop.png): três colunas em tela ampla, duas em 800 px e uma no celular. A assinatura pendente e o bloqueio da aprovação ficam explícitos. Reenvio aparece apenas na falha de envio. |
| [Avisos móvel](mocks/avisos-mobile.png) | Tocar em um aviso deixava a ação de ciência distante, depois de toda a lista. | [Captura móvel](reviews/avisos-residente-mobile.png): lista e detalhe são vistas distintas, com retorno e ação de ciência em largura total. A leitura não confirma ciência. |
| Casca de navegação | A 320 px, o cabeçalho tinha 212 px, truncava o perfil e a gaveta fechada ainda entrava na sequência de Tab. | [Captura do menu a 320 px](reviews/menu-mobile-320.png): cabeçalho compacto; marca oficial somente na gaveta móvel aberta; perfil e cenário com largura suficiente. Gaveta modal com fundo inerte, foco contido e rolagem bloqueada. |
| Relatórios | Filtros com ritmo irregular, tabela cortada no celular e exportação inicialmente ambígua. | [Desktop](reviews/relatorios-desktop.png) em grade 3 × 2; [320 px](reviews/relatorios-mobile-320.png) com filtros complementares recolhidos, cartões expansíveis e ações de simulação legíveis. [Diálogo](reviews/exportacao-modal-mobile-320.png) contém o foco e devolve-o ao botão. |

A segunda avaliação visual independente pontuou **28/40** na heurística de Nielsen antes do último polimento. Ela destacou o diálogo de exportação, a densidade dos filtros móveis e a oferta indevida de reenvio como problemas ainda abertos naquele momento; os três foram corrigidos e testados. O detector independente permaneceu em `[]` e não capturou essas falhas de interação, por isso a decisão final usou também capturas e navegação real no navegador. Não foi atribuída uma pontuação nova sem outra avaliação independente.

## Verificações executadas

- `npm run build`: compilação Angular 22 sem avisos.
- `npm test`: 8 arquivos, 17 testes aprovados.
- `npm run test:e2e`: 22 jornadas aprovadas. Elas cobrem os três perfis, rotas, estados de demonstração, assinatura simulada, avisos, relatórios, exportação modal e menu móvel por teclado.
- Auditoria axe com regras WCAG 2.0/2.1/2.2 A/AA em 44 combinações de rota e perfil: nenhuma violação automatizada. O diálogo de exportação também passou na auditoria; não houve erros de página.
- Verificação de alvos de pelo menos 44 × 44 px nas telas centrais em 1440 e 390 px; reflow sem rolagem horizontal nas telas principais em 320 e 640 px; grade intermediária da saída em 800 px; atalho para conteúdo, menu móvel e abas por teclado.
- Menu: Tab, Shift+Tab, Escape, fundo inerte, bloqueio de rolagem, fechamento pela área escurecida e retorno do foco. Relatórios: disclosure móvel, foco no diálogo, Tab/Shift+Tab, Escape, rolagem do fundo e retorno ao botão de origem.
- `impeccable detect --json frontend/src/app` e escopos `layout` e `type`: `[]`, código 0. A inspeção visual e os testes de interação continuam necessários porque o detector não captura todos os problemas de foco e composição.

## Limites da validação

Não houve teste com usuários mais velhos nem sessão com leitor de tela real. A auditoria automatizada, os nomes acessíveis verificados nos testes e a inspeção visual não demonstram conformidade WCAG integral nem facilidade de uso real. Autenticação, WhatsApp, assinatura juridicamente válida, exportação e persistência operacional serão implementados em outra etapa.

## Referências de projeto

- [W3C WAI: desenvolvimento para pessoas mais velhas](https://www.w3.org/WAI/older-users/developing/) — leitura, foco, navegação, rótulos e recuperação de erros.
- [W3C WAI: padrão de diálogo modal](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — foco dentro do diálogo, Escape e retorno à ação de origem.
- [WCAG 2.2: Target Size Enhanced](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced) — 44 × 44 px é critério AAA, adotado aqui como regra adicional do produto.
- [GOV.UK Design System: service navigation](https://design-system.service.gov.uk/components/service-navigation/) — rótulo explícito para o botão Menu em telas pequenas.
