# SAGER

## Documento de Requisitos do Produto — PRD completo

**Sistema de Apoio à Gestão de Residentes**  
Instituto Federal Goiano — Campus Urutaí  
Módulo único de Assistência Estudantil

**Versão do PRD:** 2.0  
**Data:** 24/09/2026  
**Status:** requisitos de produto para homologação pela AE/TI; Angular e Java/Spring Boot confirmados pelo solicitante; decisões técnicas complementares consolidadas nesta revisão.  
**Documento-base:** SAGER_Corrigido(1).docx, SRS-SAGER-001, versão 2.1, datada de 26/04/2026, com 55 páginas na representação analisada.

**Revisão da estrutura local de alojamentos:** 29/09/2026.

**Substituição da assinatura eletrônica por link (2026-10-31):** a saída longa passa a exigir autorização do responsável recebida pelo WhatsApp e conferida por um servidor. Ver a nota na seção 11.

### Como interpretar este PRD

Os requisitos sem marcador especial são derivados do documento-base. Os critérios de aceite transformam essas regras em resultados verificáveis, sem atribuir aprovação institucional a este PRD. **[U] Definido pelo solicitante** identifica Angular e Java com Spring Boot e as escolhas locais datadas neste documento. **[T] Decisão técnica** identifica escolhas de implementação feitas nesta revisão por delegação do solicitante. **[P] Proposta** identifica regras ou processos sugeridos que ainda precisam de validação. **[A] A definir** identifica informação institucional ausente, contraditória ou insuficiente na fonte. **[U/T]** combina uma escolha autorizada pelo solicitante com sua delimitação técnica local.

A divisão em épicos E01–E15 é uma organização deste PRD. Os identificadores RF, UC, RN e RNF-WA da SRS foram preservados; não foram inventados casos de uso para preencher lacunas de numeração. As referências de página apontam para a representação de 55 páginas do arquivo, não para a paginação desatualizada do sumário original.

**Escopo deste material:** produto completo descrito na SRS, com os 15 épicos e os 72 critérios de aceite funcionais preservados. A revisão acrescenta as decisões tecnológicas da conversa de 24/09/2026 e a estrutura local de alojamentos autorizada em 29/09/2026. As regras institucionais pendentes continuam na seção 23. O áudio OGG anexado originalmente não foi transcrito; não se presume conteúdo adicional dele.

### Políticas locais delegadas em 30/09/2026

**[U/T]** O solicitante delegou as escolhas operacionais ainda abertas para
concluir a implementação. Na fase de desenvolvimento, o
[contrato de operações](docs/fase-3/README.md) define a janela de chamada,
alocação, partida física e expiração. O
[contrato disciplinar](docs/fase-5/CONTRATO.md) define D12–D14 e D18:
ausência sem justificativa em chamada fechada e retorno físico atrasado geram
notificação interna, com análise humana antes de advertência. Cancelamento é
arquivamento motivado; origem corrigida exige revisão. Duas advertências vigentes
da mesma categoria e de origens distintas em 90 dias indicam possível
reincidência, a confirmar pelo supervisor; não emitem termo automaticamente.
Avisos têm destinatários UUID congelados e versões; leitura é distinta de ciência
autenticada. O modelo local de termo v1 preserva PDF e evidência imutáveis.

Essas políticas prevalecem no desenvolvimento sobre as passagens que deixam os
mesmos parâmetros sem valor ou proíbem escolhê-los sem uma resposta específica.
São escolhas autorizadas do projeto, identificadas e versionadas; não são dados
de exemplo apresentados como métricas reais nem aprovação institucional da AE/TI.
A homologação e as integrações externas reais continuam exigindo evidência própria.

### Guia de leitura

**Stack definida:** Angular no frontend; Java com Spring Boot no backend. Complementos: Angular Material, PostgreSQL, Spring Security, Spring Data JPA, Flyway e Docker Compose. A seção 24 resume a arquitetura. O documento complementar **SAGER — Especificação Técnica e Arquitetura v2.0** detalha versões, bibliotecas, dados, API, segurança, testes e implantação.

Visão e perfis: seções 1–2. Rastreabilidade: seção 3. Funcionalidades e aceite: seções 4–17. Estados e dados: seções 18–19. Qualidade e segurança: seções 20–21. Validação: seção 22. Pendências institucionais: seção 23. Stack e decisões de implementação: seção 24.

**Fonte:** SRS, identificação e histórico da versão, pp. 1–2; finalidade, escopo e descrição geral, pp. 4–6.

<!-- pagebreak -->

# 1. Visão do produto e limites

## 1.1 Problema e proposta de valor

O SAGER substitui controles residenciais em papel por processos digitais rastreáveis. Centraliza dados de residentes, chamada noturna, autorizações de saída, confirmação de retorno de saídas curtas, assinatura de responsáveis em saídas longas, avaliações de limpeza, ranking, avisos, análise de notificações e relatórios da Assistência Estudantil.

O resultado esperado é permitir que a AE acompanhe as operações diárias e o histórico de cada residente, identificando quem registrou, analisou ou decidiu cada evento. O produto não transforma alertas de comportamento em sanções automáticas.

## 1.2 Objetivos do produto

Digitalizar os registros de residência e reduzir a dependência de papel; tornar saídas e retornos verificáveis; exigir autorização do responsável, conferida por um servidor, antes da aprovação de saída longa; apoiar a avaliação humana de ocorrências; tornar a gestão de limpeza e ocupação compreensível; disponibilizar relatórios e histórico individual com acesso controlado.

**[A] Metas de impacto:** a SRS não informa quantidade atual de formulários, tempo médio dos processos ou metas percentuais de redução. Esses resultados não devem ser apresentados como ganhos já medidos. Indicadores propostos para o piloto aparecem na seção 22.

## 1.3 Escopo definido pela especificação

Uma plataforma web responsiva, de uso institucional no Campus Urutaí, com um único Módulo de Assistência Estudantil. Inclui os 16 requisitos funcionais da SRS, os casos de uso relacionados, RN01–RN10, requisitos de interface, suporte e integrações obrigatórias.

O produto atende residentes matriculados. A gestão cadastral e o ranking não se limitam aos menores de idade; a chamada noturna e as solicitações formais de saída descritas na SRS aplicam-se aos residentes menores de idade.

## 1.4 Limites explícitos e itens não autorizados

Não há aplicativo móvel próprio: o acesso pelo celular ocorre pela interface web. O uso institucional não autoriza, por si só, uma versão comercial multi-instituição. Não existe autorização para gerar advertências ou penalidades automaticamente, nem para o residente confirmar o próprio retorno.

**[A] Fora da especificação detalhada:** controle de saídas de maiores de idade, confirmação de retorno de saída longa, biometria, geolocalização, publicação em lojas, integração com catracas e operação transacional totalmente offline. Não devem ser tratados como entregas obrigatórias sem ampliação expressa do escopo.

## 1.5 Dependências e responsáveis

A AE deve definir regras operacionais e homologar os fluxos. A TI deve disponibilizar infraestrutura e operação técnica. O login próprio do SAGER foi definido pelo solicitante em 30/09/2026 para a fase atual; eventual integração com SUAP ou Google fica para decisão futura. São dependências previstas: responsável legal ativo com telefone válido, autorização institucional para comunicação por WhatsApp, gateway de mensagens disponível, com anexo manual como contingência, além do treinamento inicial dos usuários.

**Fonte:** SRS, seções 1.1–1.3 e 2, pp. 4–6; restrições e propriedade intelectual, pp. 47–49; RN01–RN10, pp. 50–51.

<!-- pagebreak -->

# 2. Perfis, responsabilidades e permissões

## 2.1 Atores do produto

| Ator              | Responsabilidade prevista                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gestor            | Administração de supervisores, residentes, quartos e responsáveis legais; relatórios estratégicos e inclusão manual de residentes.                                                             |
| Supervisor        | Administração operacional de residentes, responsáveis e quartos; chamada, limpeza, notificações, advertências, saídas e retorno curto. Acesso médico segue restrito à profissão.               |
| Residente         | Solicitação de saída quando menor de idade; acompanhamento das próprias solicitações; consulta de avisos, advertências e ranking; registro explícito de ciência.                               |
| Responsável legal | Recebe o documento de saída longa pelo WhatsApp, no telefone pré-cadastrado, e devolve a autorização em foto ou PDF. Não acessa o sistema.                                                         |
| Sistema           | Geração de alertas e documentos, integração com mensagens, guarda dos arquivos de autorização, atualização de estados e auditoria. Não decide sanções.                                                               |
| Equipe de TI      | Suporte, manutenção e monitoramento. A SRS não define um perfil funcional próprio de administrador de TI.                                                                                      |

## 2.2 Matriz funcional de referência

| Operação                                   | Gestor            | Supervisor             | Residente / responsável                                 |
| ------------------------------------------ | ----------------- | ---------------------- | ------------------------------------------------------- |
| Cadastrar e editar supervisores            | Sim               | Não (desde 31/10/2026) | Não previsto                                            |
| Cadastrar e editar residentes              | Sim               | Sim                    | Edição própria a definir                                |
| Gerenciar quartos e alocações              | Sim               | Sim                    | Não previsto                                            |
| Gerenciar responsáveis legais              | Sim               | Sim                    | Alteração própria não definida                          |
| Registrar chamada e avaliar limpeza        | Não previsto      | Sim                    | Não                                                     |
| Aprovar/rejeitar e confirmar retorno curto | Não previsto      | Sim                    | Não                                                     |
| Analisar notificações internas             | Gestor autorizado | Sim                    | Não                                                     |
| Registrar advertência manual               | Não previsto      | Sim                    | Não                                                     |
| Relatórios operacionais e estratégicos     | Sim               | Sim                    | Relatório completo não previsto                         |
| Consultar avisos e marcar ciência          | A definir         | A definir              | Residente: somente seus itens                           |
| Consultar ranking                          | A definir         | Posição após avaliação | Residente: posições gerais e detalhes do próprio quarto |
| Assinar autorização longa                  | Não               | Não                    | Responsável legal vinculado                             |

**[U] Decisão de 30/09/2026:** o supervisor tem autoridade operacional máxima e recebe as permissões do gestor nos recursos de gestão integrados, inclusive supervisores, residentes, responsáveis, alojamentos, quartos e alocações. O gestor também pode inserir residentes manualmente. As funções operacionais de chamada, limpeza, decisões de saída e advertências mantêm as permissões anteriores; esta decisão não amplia o acesso do gestor a elas. Informações médicas podem ser compartilhadas entre profissionais autorizados para a finalidade assistencial, sob sigilo profissional; o papel de supervisor ou gestor, isoladamente, não concede esse acesso. As demais permissões do produto completo ainda exigem validação institucional.

## 2.3 Isolamento e autenticação

O usuário autenticado deve acessar apenas as funções e registros permitidos. Um residente não pode acessar dados privados de outro residente, notificações internas ou documentos de terceiros. O responsável legal devolve a autorização pelo WhatsApp, sem acesso ao sistema; não se presume uma conta institucional.

**[U] Decisão de 31/10/2026:** substitui a decisão de 30/09/2026 e D01 somente quanto aos supervisores. Só o gestor lista, consulta, cadastra e edita supervisores, porque está acima deles e a criação passou a definir a senha de login. A paridade continua nos demais recursos de gestão. A homologação institucional segue pendente.

**[A]** RF002 indica Gestor, mas UC015 admite Supervisor/Gestor; a paridade operacional local de 30/09 resolve a implementação atual, sem alterar o texto histórico da SRS. Ainda precisam de confirmação institucional os profissionais autorizados a dados médicos, o acesso a documentos assinados e os papéis acumuláveis. UC01 cita supervisor e residente, enquanto os demais requisitos pressupõem gestor autenticado.

**Fonte:** SRS, RF001–RF016, p. 7; atores, p. 8; UC01, p. 10; UC04, pp. 13–14; UC08, p. 20; UC015, pp. 29–30; interfaces e proteção de dados, pp. 47–49.

<!-- pagebreak -->

# 3. Catálogo e rastreabilidade do escopo

A classificação da SRS é preservada: **RF001 é “Importante”; RF002–RF016 são “Essencial”**. A ordem de implementação sugerida neste PRD não rebaixa requisitos nem retira funcionalidades do produto completo.

| Épico | Entrega de produto                         | Referência de origem                        |
| ----- | ------------------------------------------ | ------------------------------------------- |
| E01   | Acesso com login próprio do SAGER          | RF001; UC01                                 |
| E02   | Residentes e responsáveis legais           | RF002; UC015; RN03                          |
| E03   | Gestão de supervisores                     | RF013; UC14                                 |
| E04   | Quartos e Mapa de Blocos                   | RF003; UC16; Figura 12                      |
| E05   | Chamada noturna                            | RF006; UC05                                 |
| E06   | Solicitação de saída curta ou longa        | RF007; UC06; RN01 e RN03                    |
| E07   | Aprovação e rejeição de saída              | RF008; UC07; RN05 e RN06                    |
| E08   | Confirmação presencial de retorno curto    | RF014; UC17; RN01 e RN02                    |
| E09   | Documento, WhatsApp e autorização          | RF015 e RF016; UC18; RN03–RN06; RNF-WA01–05 |
| E10   | Geração e análise de notificações internas | RF004 e RF005; UC04 e UC10; RN07            |
| E11   | Advertência manual, avisos e ciência       | UC03; RF009; UC08                           |
| E12   | Termo de Compromisso por reincidência      | RN10                                        |
| E13   | Avaliação de limpeza e ranking             | RF010 e RF012; UC09 e UC12                  |
| E14   | Relatórios e evolução individual           | RF011; UC11; Figuras 9 e 15                 |
| E15   | Painéis, experiência, ajuda e documentação | Seções 3.7, 3.9.2 e 3.10; Figuras 1–15      |

## 3.1 Requisitos transversais

RN08 exige auditoria dos eventos de saída, assinatura, decisão e alteração de status. RN09 exige minimização de dados nas mensagens. Segurança de comunicação, desempenho, confiabilidade, usabilidade, documentação e licenciamento aplicam-se ao produto inteiro, conforme as seções 20–21 deste PRD.

## 3.2 Observações sobre a fonte

O caso “Gerenciar Residentes” aparece como **UC015**; este PRD preserva essa identificação. Não há descrição de UC02 ou UC13 no material analisado. Advertência manual e Termo de Compromisso possuem respaldo em UC03 e RN10, mesmo sem requisitos funcionais exclusivos na tabela RF001–RF016.

Os diagramas de domínio e entidade-relacionamento das páginas 32 e 34 não constituem, isoladamente, um modelo final compatível com todos os fluxos revisados. A seção de sequência da página 33 não apresenta um fluxo utilizável. A conciliação dessas representações está registrada como pendência, não como correção já aprovada.

**Fonte:** SRS, tabela de requisitos, p. 7; casos de uso, pp. 10–31 e 52–55; diagramas, pp. 32–34; RN10, p. 51.

<!-- pagebreak -->

# 4. Acesso e gestão de supervisores

## E01 — Login e acesso ao SAGER

**Necessidade do usuário:** acessar o sistema com credenciais válidas e ser direcionado às funcionalidades do próprio perfil.

O usuário abre a tela de login, informa o e-mail e a senha da própria conta SAGER e solicita autenticação. O sistema valida as credenciais, autentica o usuário e o direciona à página inicial correspondente ao perfil. Credenciais inválidas devem produzir uma mensagem de erro e permitir nova tentativa. Indisponibilidade deve ser apresentada de forma explícita.

A SRS originalmente prescreve integração institucional, com LDAP e SSO como exemplos. **[U] Em 30/09/2026, o solicitante definiu login próprio por e-mail e senha para a fase atual**, deixando SUAP ou Google como possibilidades futuras, sem torná-las condição de cadastro ou aceite atual. As contas e a aceitação de qualquer senha exibidas na Figura 1 são elementos demonstrativos do protótipo, não critérios de autenticação do produto operacional. A implementação local presente permanece restrita a desenvolvimento em loopback; sua segurança e implantação real dependem de validação separada.

**[A]** Provisionamento, recuperação de acesso, política de senha, encerramento e duração de sessão para implantação real ainda precisam de validação. Uma futura integração externa deverá preservar as permissões e os vínculos locais.

## E03 — Gerenciar supervisores

**Necessidade do gestor:** manter os dados dos supervisores que operam a Assistência Estudantil e dar acesso a eles.

O gestor autenticado acessa a listagem, seleciona um registro existente ou inicia um cadastro, preenche ou altera os dados e confirma. Na criação, informa também a senha e a confirmação; a matrícula ou SIAPE vira o login, e registro, conta e vínculo são criados na mesma transação. A edição não altera a senha. O sistema valida os campos obrigatórios, persiste as informações e informa sucesso. Dados inválidos devem ser apontados para correção, sem concluir o cadastro como se estivesse válido.

**[A]** A SRS não fixa o formulário completo, critérios de unicidade, inativação, exclusão ou escopo por bloco/turno. O cadastro funcional e a conta de login próprio precisam ter vínculo controlado; criar um supervisor não deve gerar credenciais previsíveis.

## Critérios de aceite

| ID   | Verificação                                       | Resultado esperado                                                   |
| ---- | ------------------------------------------------- | -------------------------------------------------------------------- |
| AC01 | Login com e-mail e senha válidos da conta SAGER   | Usuário autenticado e direcionado ao perfil autorizado.              |
| AC02 | Credencial inválida ou serviço indisponível       | Mensagem correspondente; nenhuma sessão válida criada indevidamente. |
| AC03 | Acesso a funcionalidade fora do perfil            | Acesso negado; ocultar o botão não é o único controle.               |
| AC04 | Gestor cadastra ou edita supervisor; outros perfis recebem 403 | Informações válidas persistidas e confirmação de sucesso; quem foi criado já entra com a matrícula ou SIAPE e a senha informadas. |
| AC05 | Cadastro com campo obrigatório ausente            | Campo identificado e registro não concluído.                         |

AC03 operacionaliza a restrição de acesso por perfil. A paridade operacional local e o sigilo médico seguem a matriz da seção 2; permissões adicionais do produto completo dependem de validação.

**Fonte:** SRS, RF001 e RF013, p. 7; UC01, p. 10; UC14, pp. 27–28; Figura 1, p. 35; integração institucional, p. 47.

<!-- pagebreak -->

# 5. Residentes e responsáveis legais

## E02 — Cadastro e histórico do residente

**Necessidade da AE:** consultar e manter informações de residentes matriculados, com histórico operacional e acesso restrito a informações sensíveis.

O supervisor/gestor acessa os residentes, busca um registro ou inicia cadastro manual, preenche ou altera os dados permitidos e confirma. O sistema valida os dados, exige vínculo de matrícula e data de nascimento no cadastro atual, salva e informa o resultado. Desde 31/10/2026, o curso é obrigatório em novo cadastro e edição; residente antigo sem curso segue legível até a próxima edição. Erros devem ser associados aos campos correspondentes. Informações médicas seguem fluxo próprio, restrito a profissionais autorizados e ao sigilo profissional, ainda que um supervisor ou gestor possua acesso ao cadastro geral.

A consulta deve permitir chegar ao histórico do residente e às informações necessárias para os fluxos de chamada, saída, limpeza, avisos, advertências e relatórios. A Figura 5 apresenta busca e filtros por bloco, curso, status e faixa etária, além de nome, quarto, curso e idade na listagem. Esses elementos visuais complementam o caso de uso, mas não definem sozinhos todos os campos cadastrais.

## Responsável legal

Gestor e supervisor administram os dados de responsáveis legais na fase atual. Para uma saída longa, deve existir ao menos um responsável ativo e autorizado, vinculado ao residente, com telefone WhatsApp previamente cadastrado e válido. O envio deve usar esse contato, não um número livre informado no momento da solicitação pelo residente.

**Dados explicitamente necessários ao fluxo:** identificação do residente, condição de menor de idade, matrícula/vínculo institucional, identificação do responsável, vínculo/autorização, situação ativa e telefone para envio. A autorização gera dados adicionais de evidência, descritos na seção 11.

**[U/T]** A data de nascimento é obrigatória em novos cadastros e edições; a idade é calculada na data de referência da operação. O cadastro manual não impõe faixa etária de 16–17 anos. Registros legados sem nascimento permanecem legíveis, mas sua edição exige informar a data. A cardinalidade dos vínculos e a escolha de quem receberá o documento seguem D15; uma autorização conferida de qualquer responsável ativo, autorizado e vinculado basta para a saída longa, sem exigir a de todos. Isso não substitui prova de identidade, vínculo, autorização e telefone, que permanecem sujeitos à validação institucional.

## Critérios de aceite

| ID   | Verificação                                               | Resultado esperado                                                                         |
| ---- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| AC06 | Cadastro/edição válido por gestor ou supervisor           | Dados salvos e disponíveis para consulta; nascimento exigido em novos registros e edições. |
| AC07 | Tentativa de cadastrar residente sem vínculo de matrícula | Restrição apresentada; requisito de matrícula não ignorado.                                |
| AC08 | Consulta de informações médicas                           | Dados disponíveis apenas a profissionais autorizados, sob sigilo.                          |
| AC09 | Saída longa sem responsável ativo ou telefone válido      | Envio impedido e problema cadastral identificado.                                          |
| AC10 | Solicitação válida de saída longa                         | Destinatário corresponde ao responsável pré-cadastrado.                                    |

## Decisões de cadastro

**[A]** A AE/TI deve aprovar os demais campos e a validade da matrícula, inativação por desligamento, política de correção de histórico e tratamento da maioridade. Não existe especificação de integração automática com sistema acadêmico. A Figura 7 inclui “Meu perfil”, mas não determina autorização de edição pelo residente. A faixa de 16–17 anos descreve a população operacional atual; não é bloqueio geral do cadastro manual.

**Fonte:** SRS, RF002 e RF007, p. 7; atores, p. 8; UC015, pp. 29–30; Figuras 5 e 7, pp. 37–38; RN03, p. 50; UC18, pp. 54–55.

<!-- pagebreak -->

# 6. Quartos e mapa dos alojamentos

## E04 — Gerenciar quartos

**Necessidade do gestor:** identificar rapidamente situação, ocupação e limpeza dos quartos, sem depender de tabelas complexas como visualização principal.

O sistema deve apresentar um **mapa visual dos alojamentos**, com quartos agrupados por alojamento, unidade interna opcional (casa/bloco) e piso conhecido. O gestor seleciona um quarto no mapa para consultar ou editar seus dados, ou inicia um cadastro. Após validação e gravação, o mapa deve refletir a informação atualizada. O cadastro de alojamentos e unidades internas será acessível pelo mapa; a unidade selecionada deve pertencer ao alojamento informado.

Cada quarto deve apresentar identificação, ocupação, situação e nota de limpeza. **[U/T] Decisão de projeto de 29/09/2026:** distinguir o **código globalmente único** do **número local como texto**, preservando números como `01`. O número local pode se repetir em localizações diferentes, mas não na mesma combinação de alojamento, unidade opcional e piso opcional. Para detectar duplicidade, desconsiderar espaços nas extremidades e diferenças de maiúsculas/minúsculas; a ausência da unidade ou do piso representa a mesma localização ausente. Esta interpretação da identificação no UC16 é uma escolha técnica local autorizada pelo solicitante, sem homologação institucional da AE/TI. Campos obrigatórios devem ser validados. A situação precisa ser comunicada por texto ou ícone, além da cor.

| Situação     | Cor determinada na SRS | Exibição                                  |
| ------------ | ---------------------- | ----------------------------------------- |
| Disponível   | Verde                  | Identificação e situação do quarto.       |
| Ocupado      | Azul                   | Ocupação e situação do quarto.            |
| Manutenção   | Amarelo                | Identificação clara da manutenção.        |
| Indisponível | Vermelho               | Identificação clara da indisponibilidade. |

A legenda deve permanecer visível. A Figura 12 apresenta busca e filtros por bloco, andar e ocupação; a navegação por esses agrupamentos deve ser compatível com o mapa. No fluxo local, alojamentos e casas/blocos vêm do cadastro, sem opções fixas de “Bloco A/B”. O texto do UC16 usa “piso”; a nomenclatura final da interface deve permanecer consistente.

**[U/T] Fatia local de estrutura, autorizada em 29/09/2026:** o mapa inicia vazio e as capacidades são editáveis, com inteiro positivo ou ausência de definição. Apresentar **“Capacidade não definida”** quando ausente e identificar somatórios incompletos como parciais. Os quatro estados descritos são informados manualmente. Até integrar residentes e avaliações, ocupação, vagas livres e nota de limpeza são desconhecidas (`null`), com **“Ocupação ainda não integrada”** e **“Sem avaliação”** na interface; a situação manual não determina nenhuma dessas medidas.

**[U/T] Fatia local provisória de alocação, autorizada em 29/09/2026:** permitir um quarto ativo por residente, guardar histórico de alocações, transferências e encerramentos, e calcular ocupação pela contagem de vínculos ativos. Vagas livres serão `capacidade - ocupação` quando a capacidade estiver definida; caso contrário, permanecem desconhecidas. Nova alocação exige capacidade definida, não pode excedê-la e é bloqueada nos quartos em Manutenção ou Indisponível. Uma edição não pode tornar a capacidade ausente ou menor que a ocupação ativa. A situação continua manual, sem transição pela contagem de residentes. Nota de limpeza permanece sem avaliação. Essas regras atendem somente ao ambiente local de desenvolvimento e não homologam a política da AE nem resolvem as divergências dos anexos de 2026.

**[U] Precedência dos anexos em 30/09/2026:** nas divergências de capacidade, usar os valores detalhados do ZIP/planilha: Residência 4 com 66 lugares, em vez de 64 no PDF; Laticínio com 10, em vez de 8. O PDF complementa o inventário ausente no ZIP parcial, sem distribuir por inferência os quartos que faltam na Residência 3 nem a diferença de Zootecnia 3 (três quartos de dois lugares e total de oito no PDF). Os 300 lugares do PDF são capacidade total, não vagas livres. A divergência R4-21 (cinco ocupantes para capacidade quatro) não altera a capacidade declarada. Os anexos não fornecem matrícula, nascimento, responsáveis ou telefones e não autorizam importar estudantes reais. A conferência e homologação institucional das capacidades permanecem pendentes em D19.

## Critérios de aceite

| ID   | Verificação                                                                        | Resultado esperado                                                                                                                        |
| ---- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| AC11 | Gestor ou supervisor abre a gestão de quartos                                      | Mapa principal agrupado por alojamento, unidade opcional e piso conhecido, com legenda visível.                                           |
| AC12 | Usuário observa qualquer quarto                                                    | Identificação, ocupação, situação e nota de limpeza compreensíveis sem depender só da cor.                                                |
| AC13 | Gestor ou supervisor seleciona, edita e salva um quarto                            | Detalhes corretos e mapa atualizado com os dados persistidos.                                                                             |
| AC14 | Cadastro com código global existente ou número local repetido na mesma localização | Duplicidade rejeitada; número local repetido em alojamento, unidade ou piso diferente é permitido, preservando sua representação textual. |
| AC15 | Campo obrigatório inválido                                                         | Erro indicado; alteração inválida não concluída.                                                                                          |

## Decisões operacionais

**[A]** A SRS não define capacidade máxima, reserva de vaga, movimentação de residentes ou bloqueio de alocação em manutenção. Também não define quando um quarto parcialmente ocupado é “Disponível” ou “Ocupado”. A estrutura, a unicidade e a regra provisória de alocação acima são escolhas de projeto para desenvolvimento local; exceções de lotação, reservas, correção de histórico, transições automáticas e capacidades institucionais ainda dependem da AE. Os anexos recebidos em 29/09/2026 são referências parciais de estrutura e ocupação, com divergências documentadas na [D19](docs/fase-0/DECISOES.md); não são dados de carga do sistema.

**[P]** Não derivar automaticamente a situação do quarto somente pela quantidade de ocupantes até a AE aprovar a regra. Em ausência de avaliação, apresentar ausência de nota, em vez de atribuir uma nota fictícia.

**[U/T]** Gestor e supervisor locais consultam, cadastram, editam e movimentam a estrutura e os vínculos, com sessão, CSRF e controle de versão no servidor. A demonstração pública usa dados sintéticos em memória; uma falha da API local não pode preencher o mapa com registros demonstrativos. A estrutura e a alocação receberam [aceite técnico local](docs/fase-2/QA.md) em 29/09/2026, com provas pelo navegador em PostgreSQL e persistência após reinício. A paridade operacional foi decidida em 30/09/2026; esses aceites não encerram E04, a Fase 2 ou as decisões institucionais D01/D02/D15/D19/D22.

**Fonte:** SRS, RF003, p. 7; UC16, p. 31; Figura 12, p. 43.

<!-- pagebreak -->

# 7. Chamada noturna

## E05 — Registrar presença às 22h30

**Necessidade do supervisor:** registrar presença ou ausência dos residentes menores de idade e distinguir ausências justificadas por autorização válida.

O supervisor autenticado acessa a chamada noturna. O sistema lista os residentes menores de idade. O supervisor marca presença ou ausência de cada residente, revisa e confirma a chamada. O sistema valida a completude, grava os registros e informa sucesso.

A chamada deve ocorrer às **22h30**. A realização fora do horário padrão deve gerar alerta e requerer confirmação do registro tardio; o registro deve preservar essa indicação e o horário efetivo. Esse cenário não pode ser eliminado por um bloqueio absoluto de uso fora das 22h30.

Ao abrir a chamada, o sistema marca como ausência justificada o residente com uma saída aprovada e partida física registrada, e o supervisor confere e pode corrigir. Com mais de uma saída válida, o supervisor escolhe qual vincular. A existência de solicitação pendente, por si só, não corresponde a autorização aprovada.

A Figura 3 apresenta agrupamento por blocos, busca e filtros para apoiar a marcação, além de resumo de registros. O fechamento da chamada depende de todos os residentes abrangidos estarem marcados.

## Critérios de aceite

| ID   | Verificação                                              | Resultado esperado                                                               |
| ---- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| AC16 | Abertura da chamada                                      | Lista restrita aos residentes menores de idade abrangidos pelo cadastro.         |
| AC17 | Confirmação com marcações faltantes                      | Sistema identifica a incompletude e não finaliza a chamada como completa.        |
| AC18 | Confirmação de chamada completa                          | Presenças/ausências persistidas e confirmação exibida.                           |
| AC19 | Registro fora do horário padrão                          | Alerta, confirmação de registro tardio e indicação preservada no histórico.      |
| AC20 | Ausente com autorização válida                           | Ausência justificada marcada na abertura, com a saída indicada e correção possível. |
| AC21 | Ausência não justificada que atinge critério configurado | Notificação interna para análise; nenhuma advertência automática.                |

## Exceções e decisões pendentes

**[A]** Permanecem sem definição a tolerância em torno das 22h30, o fechamento por bloco, as regras de correção de chamada finalizada e a validade temporal de uma saída para justificar ausência. **[T]** Adotar America/Sao_Paulo como fuso de exibição e referência operacional do campus, armazenar instantes em UTC e rejeitar atualizações concorrentes sobre versão desatualizada, sem sobrescrever o lançamento de outro supervisor.

**[T]** Usar identificação inequívoca da chamada e unicidade da participação por chamada/residente. A aplicação informa conflito e exige recarga quando outro supervisor já alterou o registro. Isso resolve a concorrência técnica; a AE ainda define quem pode corrigir uma chamada concluída.

**Fonte:** SRS, RF004 e RF006, p. 7; UC05, p. 15; UC10, pp. 22–23; Figura 3, p. 36; exatidão, p. 49.

<!-- pagebreak -->

# 8. Solicitar autorização de saída

## E06 — Saída curta ou longa

**Necessidade do residente menor de idade:** solicitar uma saída, entender suas regras e acompanhar a aprovação sem usar formulário físico para a saída curta.

Ao abrir o formulário, o sistema deve preencher a data/hora de saída com a data/hora atual. O residente seleciona **Curta** ou **Longa**, confere o período, ajusta quando necessário e informa motivo e observações. Os campos obrigatórios e a validade do período são verificados antes do registro.

### Saída curta

O retorno previsto começa em **saída + 3 horas** e acompanha a saída enquanto o residente não o editar. Uma edição manual válida é preservada; se a mudança da saída a deixar fora do limite, o retorno volta à sugestão, com aviso. O residente pode antecipar esse retorno. A regra é: **retorno previsto posterior à saída e, no máximo, 3 horas depois dela**. Valores fora desse intervalo devem ser bloqueados na interface e no servidor, inclusive na edição.

Após o envio válido, a solicitação aguarda análise do supervisor. Não existe exigência de assinatura do responsável para essa modalidade. O retorno posterior será confirmado presencialmente pelo supervisor, não pelo residente.

### Saída longa

Exige responsável legal ativo e autorizado, telefone pré-cadastrado e autorização conferida por um servidor. Após o registro, o sistema gera o documento e o envia pelo WhatsApp. Uma autorização conferida de qualquer responsável vinculado, registrado e autorizado para o residente, com o arquivo armazenado, torna a solicitação apta à decisão; não se exige a de ambos ou de todos os responsáveis.

### Microtextos obrigatórios

**“Curta: até 3 horas; retorno confirmado presencialmente pelo supervisor”.**

**“Longa: exige autorização do responsável legal pelo WhatsApp, conferida por um servidor, e aprovação do supervisor”.**

Os campos de data/hora devem explicar o preenchimento automático e os limites. Erros devem aparecer junto ao campo correspondente.

## Edição e exceções

O residente pode editar solicitações pendentes. A alteração reaplica as validações e recalcula o limite do retorno curto. Quando uma alteração afetar uma saída longa já enviada ao responsável, a autorização anterior é invalidada e o documento da nova revisão é enviado. Dados inválidos ou ausência de responsável devem impedir o envio e orientar correção cadastral.

## Critérios de aceite

| ID   | Verificação                                               | Resultado esperado                                                                             |
| ---- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| AC22 | Formulário de saída curta aberto                          | Saída preenchida automaticamente; retorno inicial calculado em +3 horas; microtextos visíveis. |
| AC23 | Retorno igual/anterior à saída ou superior a +3 horas     | Operação rejeitada na interface e no servidor, também na edição.                               |
| AC24 | Alteração da saída ou antecipação válida do retorno       | Limites recalculados e período válido aceito.                                                  |
| AC25 | Saída longa alterada após envio ao responsável            | Autorização anterior invalidada e documento da nova revisão enviado.                           |
| AC26 | Residente não elegível ou responsável obrigatório ausente | Solicitação bloqueada com indicação do motivo.                                                 |

**[A]** A combinação “saída = agora” e “saída não pode estar no passado” necessita regra para o tempo gasto preenchendo o formulário. A AE também deve definir janelas de saída/retorno e conciliar “Breve” e “Visita pra casa” dos protótipos com os dois tipos textuais.

**Fonte:** SRS, RF007, p. 7; UC06, pp. 16–17; Figuras 8 e 13, pp. 39 e 44; RN01, RN03–RN05, p. 50.

<!-- pagebreak -->

# 9. Aprovar ou rejeitar saída

## E07 — Análise e decisão do supervisor

**Necessidade do supervisor:** tomar uma decisão consciente, com visão dos dados da solicitação e das etapas já cumpridas.

O supervisor abre a lista de solicitações, seleciona uma e consulta residente, tipo, datas/horas, motivo e documentos. A **Linha do Tempo Visual** deve destacar a etapa atual, as concluídas e as pendentes, com data/hora dos eventos registrados.

Na saída longa, o sistema verifica ao menos uma autorização conferida por servidor, de responsável ativo, autorizado e vinculado. Sem essa condição, a aprovação fica bloqueada e a pendência deve aparecer claramente. O supervisor pode manter a pendência, reenviar a mensagem ou anexar um arquivo recebido por outro meio.

Ao escolher “Aprovar” ou “Rejeitar”, o sistema valida a decisão e abre um **Modal de Revisão**. O modal apresenta os dados completos da ação, inclusive responsável quando aplicável, e os botões de confirmar/cancelar. Somente a confirmação explícita altera o status. Cancelar ou fechar o modal não altera a solicitação.

A rejeição exige comentário obrigatório. A decisão deve registrar data, hora e supervisor responsável, atualizar a linha do tempo e notificar o residente. Solicitações próximas da saída devem receber atenção especial, sem um intervalo numérico inventado pelo sistema.

## Linha do tempo

Saídas longas devem representar autorização e aprovação. Nas curtas, a autorização do responsável deve constar como não aplicável, e o retorno deve ser acompanhado conforme o UC17. Rejeição, cancelamento e expiração devem aparecer quando ocorrerem.

Quando a data/hora da saída já passou, o sistema identifica a condição de expiração e alerta o supervisor. O UC07 prevê ação do supervisor para cancelar ou registrar como expirada; não estabelece uma rotina automática de expiração como solução única.

## Critérios de aceite

| ID   | Verificação                         | Resultado esperado                                                    |
| ---- | ----------------------------------- | --------------------------------------------------------------------- |
| AC27 | Primeiro clique em aprovar/rejeitar | Modal aberto; status ainda inalterado.                                |
| AC28 | Fechamento ou cancelamento do modal | Nenhuma decisão persistida.                                           |
| AC29 | Rejeição sem comentário             | Confirmação bloqueada até completar a justificativa.                  |
| AC30 | Saída longa sem autorização conferida | Aprovação bloqueada e pendência visível.                              |
| AC31 | Decisão válida confirmada           | Status, auditoria e linha do tempo atualizados; residente notificado. |
| AC32 | Solicitação com saída já passada    | Condição expirada identificada e apresentada ao supervisor.           |

**[A]** Precisam de decisão: rejeitar uma saída longa antes da autorização, antecedência mínima, quem pode cancelar, editabilidade após aprovação e evento que coloca uma saída em andamento. Este PRD não presume um registro de portaria ou confirmação automática de partida. A paridade operacional de gestor e supervisor foi definida para a fase atual em 30/09/2026.

**Fonte:** SRS, RF008, p. 7; UC07, pp. 18–19; Figuras 10 e 11, pp. 41–42; RN05, RN06 e RN08, p. 50.

<!-- pagebreak -->

# 10. Confirmar retorno de saída curta

## E08 — Verificação presencial e encerramento

**Necessidade do supervisor:** registrar a chegada efetiva do residente e substituir o antigo papel de retorno por evidência digital auditável.

O fluxo exige supervisor autenticado, saída curta aprovada e em andamento e residente fisicamente presente no local de controle. O supervisor localiza a saída por nome, matrícula ou quarto, identifica o residente presencialmente e seleciona a solicitação correta.

A tela apresenta horário previsto e Linha do Tempo Visual. Ao clicar em **“Confirmar retorno”**, o sistema abre o Modal de Revisão com residente, tipo de saída, data/hora de saída, retorno previsto, horário real a registrar, motivo, supervisor e eventual atraso.

Somente após confirmação explícita o sistema registra data, hora e usuário responsável, atualiza o histórico e conclui a etapa de retorno. Fechar ou cancelar o modal não registra o retorno nem altera o status.

## Retorno com atraso

Quando o horário real ultrapassa o previsto, o sistema indica atraso. O supervisor deve preencher uma observação obrigatória e revisar os horários no modal. A confirmação atualiza o status para **“Retorno confirmado com atraso”**. Quando a regra estiver configurada, esse evento gera notificação de advertência para análise, nunca uma advertência automática.

No retorno sem atraso, o status é **“Retorno confirmado”**. Em ambos os casos, a linha do tempo deve indicar a conclusão e manter a assinatura do responsável como não aplicável à saída curta.

Se não existir saída curta ativa, o sistema informa a ausência do registro e não modifica outra solicitação. O supervisor pode buscar novamente ou registrar ocorrência manual. A tentativa de busca é registrada quando aplicável.

## Critérios de aceite

| ID   | Verificação                                   | Resultado esperado                                                                       |
| ---- | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| AC33 | Residente tenta confirmar o próprio retorno   | Operação negada.                                                                         |
| AC34 | Supervisor aciona retorno e cancela o modal   | Nenhum retorno registrado.                                                               |
| AC35 | Confirmação presencial sem atraso             | Horário real e supervisor gravados; status “Retorno confirmado”.                         |
| AC36 | Retorno atrasado sem observação               | Confirmação bloqueada.                                                                   |
| AC37 | Retorno atrasado com observação e confirmação | Status com atraso, linha do tempo e histórico atualizados; alerta apenas se configurado. |
| AC38 | Saída curta ativa não encontrada              | Mensagem correspondente; nenhum status alterado indevidamente.                           |

**[A]** A SRS não esclarece como tratar atraso do próprio lançamento pelo supervisor, edição do horário real ou residente que ainda não retornou depois do prazo. **[T]** Duas confirmações concorrentes devem produzir um único retorno persistido, com controle transacional e restrição de unicidade; a segunda ação não sobrescreve a primeira. Tais regras não autorizam converter ausência de confirmação em penalidade automática. A confirmação de retorno de saída longa não possui caso equivalente descrito.

**Fonte:** SRS, RF014, p. 7; RN01, RN02 e RN08, p. 50; UC17, pp. 52–53.

<!-- pagebreak -->

# 11. WhatsApp, documento e autorização

> **Nota de substituição (2026-10-31).** Por decisão do dono do produto, a assinatura eletrônica por link, com provedor externo de assinatura e template oficial de WhatsApp, deixa de ser o requisito vigente. Esta seção, RNF-WA01, RNF-WA02, RNF-WA05, AC25, AC30, AC39–AC44 e as decisões D07 e D15–D17 foram reescritos para a autorização do responsável recebida pelo WhatsApp e conferida por um servidor. Os trechos derivados da SRS (RF015, RF016, UC18, RN03–RN06) ficam no histórico do Git. Esta é uma decisão de produto, não um aceite institucional. As decisões que continuam pendentes estão em [`docs/whatsapp/OPERACAO.md`](docs/whatsapp/OPERACAO.md).

## E09 — Autorização de saída longa

**Necessidade do responsável legal:** receber pelo WhatsApp o documento da saída vinculada ao residente, revisar e devolver a autorização do jeito que preferir, antes da decisão do supervisor.

Após uma solicitação longa válida, o sistema gera documento contendo **nome do residente, nome do responsável, período da saída, motivo, termo, campo de assinatura, data, código curto e revisão**. O documento não traz data de nascimento, matrícula nem quarto, porque trafega pelo WhatsApp. O PDF é enviado ao telefone pré-cadastrado do responsável por um gateway WhatsApp auto-hospedado, desligado por padrão.

O responsável devolve o documento em foto ou PDF. O arquivo fica no armazenamento privado do SAGER, com hash, e vira candidato do pedido quando a correlação é segura: resposta citando o documento ou único pedido aberto para aquele telefone. Nos demais casos, o supervisor escolhe o pedido. Receber o arquivo não autoriza nada. Um supervisor confere responsável, documento e revisão, e confirma ou recusa com justificativa. A aprovação continua sendo um ato próprio, posterior e separado. Com o gateway desligado ou fora do ar, o supervisor anexa o arquivo recebido por outro meio, que passa pela mesma conferência.

**Limitação:** o registro comprova que um arquivo foi recebido de um número, em data e hora registradas, e que não mudou desde então. Não comprova a autoria da assinatura e não constitui assinatura eletrônica nos termos da Lei 14.063/2020. A redação completa está em [`docs/whatsapp/OPERACAO.md`](docs/whatsapp/OPERACAO.md).

## Requisitos de integração

| Referência | Comportamento obrigatório                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| RNF-WA01   | Enviar o documento em mensagem individual, disparada por um pedido real, com legenda objetiva, código e revisão.          |
| RNF-WA02   | Receber eventos de entrega, leitura, falha e mensagem recebida por webhook autenticado e reconciliação; manter auditoria. |
| RNF-WA03   | Proteger tokens, chaves e URLs privadas por criptografia ou gestão segura de segredos; nunca mantê-los no código-fonte.   |
| RNF-WA04   | Exibir falhas ao supervisor e permitir registrar providência, reenvio, contato alternativo autorizado ou anexo manual.    |
| RNF-WA05   | Não expor dados médicos, sensíveis ou pessoais excessivos nas mensagens; o documento enviado leva só os dados mínimos.    |

O envio deve registrar o identificador da mensagem. A conferência deve preservar, no mínimo, responsável, quem conferiu, data e hora do recebimento e da conferência, origem (WhatsApp ou manual), hash SHA-256 do arquivo como recebido, revisão e versão do termo. Chaves do gateway devem ser protegidas, e webhooks devem ser autenticados.

## Conversas pelo WhatsApp

Supervisores conversam com responsáveis de dentro do SAGER, com texto, imagem, documento e áudio, e veem a conexão do número e o QR de vinculação. Gestor, residente e profissional de saúde não têm acesso. O histórico fica no SAGER, a auditoria guarda metadados sem conteúdo, e a aba avisa para não tratar dados de saúde por esse canal. Uma mensagem de conversa nunca autoriza saída.

## Falha e reenvio

Telefone inválido ou gateway indisponível devem gerar erro registrado e status **“Falha no envio”**. A solicitação continua sem possibilidade de aprovação enquanto faltar autorização conferida. O supervisor visualiza a falha, corrige o cadastro ou aguarda o serviço, registra providência e solicita nova tentativa, ou anexa o arquivo recebido por outro meio. Sem confirmação de entrega em 15 minutos, a tela avisa e orienta o uso de outro canal.

Também é permitido reenviar enquanto a solicitação aguarda autorização. O sistema valida limite de reenvio e disponibilidade do gateway, registra a tentativa e atualiza o acompanhamento. Os limites técnicos locais estão em `docs/fase-4/CONTRATO.md`; não há valores definidos pela instituição.

Contato alternativo autorizado é contingência operacional, não dispensa automática de autorização nem aprovação excepcional implícita. Entrega, leitura ou recebimento de mensagem não equivalem à autorização.

## Critérios de aceite

| ID   | Verificação                                                | Resultado esperado                                                                                  |
| ---- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| AC39 | Solicitação longa válida é enviada                         | Documento correto, destinatário pré-cadastrado e identificador do envio registrados.                |
| AC40 | Mensagem chega, é lida ou arquivo é recebido, sem conferência | Saída não fica apta à aprovação.                                                                 |
| AC41 | Arquivo conferido por supervisor na revisão atual          | Arquivo preservado com hash; quem conferiu e quando ficam registrados; aprovação segue separada.    |
| AC42 | Telefone ou gateway falha                                  | Erro visível, “Falha no envio”, anexo manual disponível e nenhuma liberação indevida.               |
| AC43 | Reenvio dentro da política configurada                     | Nova tentativa rastreável; status atualizado sem perder histórico.                                  |
| AC44 | Inspeção da mensagem, do documento e do código             | Sem dados médicos, nascimento, matrícula ou quarto no documento, nem segredos no código-fonte.      |

**[T]** O canal é o gateway WAHA com motor GOWS, em imagem fixada por digest, isolado por uma interface substituível. Não há provedor externo de assinatura. **[A]** É uma integração não oficial do WhatsApp, sujeita a banimento do número e a veto da organização; o uso depende de aceite formal da instituição, assim como o nível mínimo de assinatura exigido para este ato. Se a instituição exigir nível avançado, a foto deixa de bastar como único meio. **[T]** Falha de armazenamento mantém a aprovação bloqueada; alteração do conteúdo gera nova revisão, invalida a autorização anterior e impede que arquivo de revisão antiga libere a nova.

**[T]** Separar o estado da mensagem, o estado da autorização e o estado da solicitação. Processar eventos repetidos sem duplicar arquivos, autorizações ou transições. Nenhum evento do gateway confirma autorização ou aprova pedido.

**Fonte:** SRS, RF015 e RF016, p. 7; UC06, p. 17; interfaces, pp. 47–48; RN03–RN09, p. 50; UC18 e RNF-WA01–05, pp. 54–55.

<!-- pagebreak -->

# 12. Notificações internas para análise

## E10 — Detectar critérios e apoiar a decisão humana

**Necessidade do supervisor:** identificar ocorrências que exigem atenção sem transformar uma regra automática em decisão disciplinar.

O sistema analisa avaliações de limpeza, ausências não justificadas e outras ocorrências registradas. Quando os critérios configurados forem atingidos, gera uma **notificação de advertência** vinculada à ocorrência ou avaliação original e identifica todos os residentes impactados.

A notificação é interna. Não deve aparecer ao residente como advertência, nem provocar penalidade automaticamente. Supervisor ou gestor autorizado pode consultar o painel; a decisão disciplinar descrita no UC03 é do supervisor.

O painel deve permitir visualização e filtros. Ao abrir um item, apresenta residente, origem, data, motivo e evidências, e registra a visualização. O supervisor pode manter em análise, arquivar com justificativa ou iniciar o registro manual de advertência. Alterações de status devem ser auditadas.

## Estados da notificação

**Pendente; Visualizada; Em análise; Arquivada; Convertida em advertência.** A conversão deve preservar o vínculo com a notificação original. O arquivamento não é exclusão da ocorrência nem apagamento do histórico da decisão.

Quando faltarem evidências mínimas, o sistema deve alertar e permitir complementar a justificativa ou arquivar a notificação. O cenário de revisão também permite corrigir avaliação ou cancelar notificação, mantendo auditoria; a relação desse cancelamento com os cinco estados enumerados ainda precisa de definição.

## Critérios de aceite

| ID   | Verificação                                   | Resultado esperado                                                  |
| ---- | --------------------------------------------- | ------------------------------------------------------------------- |
| AC45 | Evento atinge critério configurado            | Notificação interna criada e vinculada à origem.                    |
| AC46 | Notificação gerada automaticamente            | Nenhuma advertência ou penalidade registrada automaticamente.       |
| AC47 | Residente tenta consultar notificação interna | Acesso negado; item não aparece como advertência em sua área.       |
| AC48 | Supervisor visualiza ou muda o status         | Ação registrada com trilha de auditoria.                            |
| AC49 | Supervisor arquiva                            | Justificativa exigida e status atualizado.                          |
| AC50 | Supervisor converte em advertência            | Advertência nasce pelo fluxo manual e permanece vinculada à origem. |

## Parâmetros ainda não definidos

**[A]** Limites de nota baixa, critérios para outras ocorrências, filtros exatos do painel, evidências mínimas e autorização para alterar regras não são fixados. Tampouco há regra completa de contestação pelo residente ou de desduplicação de alertas após edição da ocorrência.

**[P]** Tratar a configuração desses critérios como decisão versionada da AE. Não criar limites numéricos de nota, quantidade de faltas ou prazo disciplinar apenas para preencher a implementação.

**Fonte:** SRS, RF004 e RF005, p. 7; UC04, pp. 13–14; UC10, pp. 22–23; RN07 e RN08, p. 50.

<!-- pagebreak -->

# 13. Advertências, avisos e ciência

## E11 — Registrar advertência manual

**Necessidade do supervisor:** formalizar uma advertência somente depois de analisar ocorrência, histórico ou notificação que justifique a decisão.

O supervisor autenticado seleciona a origem da análise, consulta os detalhes, decide registrar a advertência, preenche **descrição, data, gravidade e justificativa**, revisa e confirma. O sistema valida, salva e notifica o residente.

A data não pode ser futura. A gravidade deve seguir níveis preestabelecidos, e a justificativa textual é obrigatória. A advertência não pode ser criada automaticamente. Se não houver motivo para advertência, o supervisor pode arquivar a notificação com justificativa.

## Consultar avisos e advertências

**Necessidade do residente:** distinguir comunicação institucional de advertência formal e registrar que tomou ciência de um item.

A área deve conter abas separadas **“Avisos”** e **“Advertências”**. O residente consulta apenas registros destinados a ele. Notificações internas em análise ficam fora dessa área até que exista aviso ou advertência efetivamente registrado.

Abrir um item deve mostrar seus detalhes e, enquanto não houver ciência, o botão destacado **“Marcar como Ciente”**. A ciência exige ação explícita: abrir ou ler o item não basta. Após a confirmação, o sistema exibe **“Ciente”**, data e hora, e evita duplicidade para o mesmo residente e item.

O histórico deve distinguir leitura de ciência. Abas sem itens devem informar a ausência de registros sem ocultar a outra categoria. Uma nova advertência deve ser destacada na aba correta.

## Critérios de aceite

| ID   | Verificação                                                         | Resultado esperado                                              |
| ---- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| AC51 | Advertência sem justificativa, campo obrigatório ou com data futura | Registro impedido e problema informado.                         |
| AC52 | Registro manual válido confirmado                                   | Advertência salva e residente notificado.                       |
| AC53 | Abertura da área do residente                                       | Abas distintas; somente seus registros visíveis.                |
| AC54 | Residente abre um item, sem acionar o botão                         | Leitura pode ser registrada; ciência continua pendente.         |
| AC55 | Residente marca ciência, inclusive repetindo a ação                 | Um único registro de ciência por item/residente, com data/hora. |
| AC56 | Nova advertência ou aba vazia                                       | Destaque do novo item ou estado vazio correto.                  |

**[A]** Os níveis de gravidade, criação/publicação de avisos, segmentação de destinatários, possibilidade de revisão/anulação da advertência e canais de notificação não estão completamente definidos. O UC04 contém trechos remanescentes sobre e-mail e envio ao residente misturados ao fluxo interno; isso exige conciliação, não envio automático presumido de qualquer alerta.

**Fonte:** SRS, UC03, pp. 11–12; UC04, pp. 13–14; RF009, p. 7; UC08, p. 20; Figura 13, p. 44.

<!-- pagebreak -->

# 14. Termo de Compromisso por reincidência

## E12 — Registrar o termo e sua motivação

**Necessidade da AE:** formalizar o tratamento de uma reincidência confirmada pelo supervisor, preservando a decisão e o vínculo com as ocorrências.

Quando houver reincidência confirmada após análise do supervisor, deve ser utilizado e registrado um **Termo de Compromisso**, vinculado ao residente e às ocorrências que motivaram sua emissão.

O histórico do residente deve conservar o termo, a decisão, a data, a identificação do supervisor responsável e o registro de ciência/assinatura conforme procedimento da AE. Essa exigência não institui geração automática de advertência ou penalidade.

A SRS determina explicitamente que os critérios de reincidência e os signatários seguem as regras da AE, sem fixar um número de ocorrências. Assim, “três advertências”, “segunda falta” ou qualquer outro limiar não podem ser adotados como regra documentada.

## Jornada mínima derivada de RN10

O supervisor analisa o histórico e as ocorrências, confirma a reincidência segundo a regra institucional, registra a decisão e vincula o Termo de Compromisso ao residente e às ocorrências motivadoras. O registro de ciência/assinatura segue o procedimento da AE e permanece consultável no histórico por usuários autorizados.

Essa jornada organiza RN10 em ações verificáveis, mas não define quem elabora o documento, em qual formato ele chega ao sistema ou se a coleta de assinatura usa o mesmo serviço das saídas longas.

## Critérios de aceite

| ID   | Verificação                                                 | Resultado esperado                                                           |
| ---- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| AC57 | Reincidência confirmada segundo a regra da AE               | Termo utilizado e registrado com vínculo ao residente.                       |
| AC58 | Consulta ao termo registrado                                | Ocorrências motivadoras, decisão, data e supervisor identificáveis.          |
| AC59 | Ciência/assinatura realizada conforme procedimento aprovado | Evidência preservada no histórico do residente.                              |
| AC60 | Quantidade de ocorrências atinge um limite técnico isolado  | Nenhuma sanção ou confirmação de reincidência automática sem análise humana. |

## Dependências de homologação

**[A]** São decisões da AE: critérios de reincidência, modelo e conteúdo do termo, signatários, forma de ciência/assinatura, prazo, tratamento de recusa, revisão e conclusão do compromisso. Não há UC específico detalhando essas etapas.

**[P]** A interface pode reunir, no histórico do residente, uma área de termos com documento e referências das ocorrências. Upload de documento pronto e geração por modelo são alternativas de implementação a escolher; nenhuma delas é exigida isoladamente pela fonte.

**Fonte:** SRS, Complemento de Revisão 2.1, p. 50; RN10, p. 51.

<!-- pagebreak -->

# 15. Limpeza e ranking de organização

## E13 — Avaliar limpeza

**Necessidade do supervisor:** registrar a avaliação de um dormitório e compreender imediatamente seu impacto na nota e na posição do ranking.

O supervisor seleciona um quarto cadastrado, preenche os critérios de avaliação e confirma. O sistema valida, registra automaticamente a data, salva a avaliação e atualiza o ranking.

Na mesma tela, sem recarregamento manual, deve exibir **nota anterior, nova nota, variação em pontos e nova posição do quarto no ranking**. A variação corresponde à nova nota menos a nota anterior, indicando aumento, redução ou estabilidade. Na primeira avaliação, deve informar **“Sem avaliação anterior”**, sem inventar variação.

O supervisor pode editar avaliação anterior. Depois de salvar, o sistema recalcula o ranking e apresenta o mesmo feedback, comparando a nota anterior à edição com a nova nota. A confirmação visual precisa refletir o que foi efetivamente salvo, e não uma previsão desconectada do resultado persistido.

Se o quarto não estiver cadastrado, o sistema informa a situação. Se a avaliação atingir critério configurado de alerta, gera notificação interna para análise, sem advertência automática.

## Consultar ranking

**Necessidade do residente:** acompanhar a posição do seu dormitório e a classificação geral de organização.

O ranking deve refletir as avaliações mais recentes e permitir filtro de período **semanal, mensal e semestral**. O residente pode ver posições de todos os dormitórios, mas detalhes específicos apenas do próprio. Se o ranking estiver em processamento, o sistema deve indicar atualização em andamento.

## Critérios de aceite

| ID   | Verificação                         | Resultado esperado                                                                            |
| ---- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| AC61 | Avaliação válida salva              | Data automática e ranking atualizado.                                                         |
| AC62 | Avaliação com histórico anterior    | Feedback imediato com ambas as notas, diferença aritmética e posição atualizada.              |
| AC63 | Primeira avaliação                  | “Sem avaliação anterior”; nenhuma variação fictícia.                                          |
| AC64 | Avaliação editada                   | Feedback compara valor anterior à edição e novo valor salvo.                                  |
| AC65 | Residente consulta outro dormitório | Posição geral disponível; detalhes privados indisponíveis.                                    |
| AC66 | Filtro semanal/mensal/semestral     | Classificação correspondente ao período; atualização em andamento informada quando aplicável. |

**[A]** Escala de notas, critérios, pesos, média por período, desempates, arredondamento e limiar de nota baixa não estão definidos. A apresentação de notas em protótipos não estabelece essas fórmulas. A definição geral menciona residentes ou dormitórios, enquanto o UC12 descreve ranking por dormitório; não deve ser criado um ranking disciplinar individual por inferência.

**Fonte:** SRS, RF010 e RF012, p. 7; UC09, p. 21; UC10, pp. 22–23; UC12, p. 26; Figura 14, p. 45.

<!-- pagebreak -->

# 16. Relatórios e histórico individual

## E14 — Relatórios operacionais e estratégicos

**Necessidade do supervisor/gestor:** consultar e exportar informações confiáveis sobre presença, limpeza, ocorrências, saídas, retornos, assinaturas, notificações de advertência e advertências registradas.

O usuário escolhe o tipo de relatório e combina os filtros de **período, residente, ocorrência e status**. O sistema deve aplicar todos os filtros selecionados simultaneamente, mostrar quais estão ativos e permitir limpá-los. A data inicial não pode ser posterior à final.

Após o processamento, a visualização deve oferecer os botões **“Exportar PDF”** e **“Exportar Excel”** diretamente visíveis, sem depender de menus ocultos. A exportação precisa respeitar os mesmos filtros e permissões da consulta. Dados sensíveis só podem compor visualizações e arquivos acessíveis aos usuários autorizados.

A ausência de dados suficientes deve gerar mensagem explícita, sem apresentar valores fictícios. Relatórios de notificações internas devem manter a distinção entre alertas para análise e advertências efetivamente registradas.

## Painel individual do aluno/residente

Deve apresentar gráficos de evolução do comportamento e das ocorrências ao longo do tempo, histórico pedagógico em linha do tempo e distribuição por tipo de ocorrência, utilizando os registros existentes e o período filtrado.

**[A]** A presença do gráfico de comportamento é obrigatória, mas a SRS não define fórmula de “nota de comportamento”, composição de indicadores ou periodicidade de agregação. O protótipo não é suficiente para inventar uma pontuação disciplinar. A AE deve definir a métrica antes da implementação desse cálculo.

## Critérios de aceite

| ID   | Verificação                              | Resultado esperado                                                      |
| ---- | ---------------------------------------- | ----------------------------------------------------------------------- |
| AC67 | Quatro filtros preenchidos conjuntamente | Todas as condições respeitadas; filtros ativos visíveis e removíveis.   |
| AC68 | Data inicial posterior à final           | Geração bloqueada com indicação do erro.                                |
| AC69 | Painel de relatório aberto               | Botões PDF e Excel visíveis diretamente.                                |
| AC70 | Exportação por usuário autorizado        | Arquivo corresponde aos filtros e às permissões da visualização.        |
| AC71 | Relatório individual com registros       | Evoluções, linha do tempo e distribuição por tipo refletindo o período. |
| AC72 | Período sem dados                        | Ausência informada; gráficos e valores não fabricados.                  |

**[A]** Catálogo definitivo de colunas, filtros específicos por relatório, formato exato da planilha, agregações, comportamento de filtros não aplicáveis e acesso do residente ao relatório completo precisam ser definidos. A Figura 9 limita a exportação ao gestor, enquanto RF011/UC11 incluem supervisor e gestor; a permissão final requer homologação.

**Fonte:** SRS, RF011, p. 7; UC11, pp. 24–25; Figuras 6, 9 e 15, pp. 37, 40 e 46.

<!-- pagebreak -->

# 17. Painéis, navegação e ajuda

## E15 — Experiência por perfil

A interface deve ser web responsiva, adaptável a computador e celular, com login claro, painéis por perfil e formulários simplificados. **[U]** O frontend será Angular. **[T]** A biblioteca de interface será Angular Material com CDK e SCSS próprio, preservando as telas e regras de usabilidade da SRS. Material Design e Bootstrap eram referências exemplificativas na fonte; esta revisão escolhe Angular Material e não utiliza Bootstrap em paralelo.

A Figura 2 apresenta painel do gestor com residentes ativos, ocupação dos quartos, saídas pendentes, média de organização e atalhos administrativos. A Figura 7 apresenta painel do residente com identificação, quarto/curso, nota, posição no ranking, saídas recentes e últimos avisos. Os números exibidos nessas imagens são demonstrativos, não volumes operacionais do sistema.

O supervisor deve conseguir acessar chamada, saídas, limpeza, notificações, residentes e relatórios conforme seu perfil. As telas operacionais precisam mostrar ações pendentes e resultados sem ocultar as condições de assinatura, retorno e revisão humana.

## Inventário funcional de interfaces

| Área                      | Conteúdo mínimo                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Acesso e supervisores     | Login próprio do SAGER; lista e formulário de supervisores acessíveis só ao gestor.                                           |
| Residentes                | Listagem, cadastro/edição, informações autorizadas e histórico individual.                                                    |
| Responsáveis              | Dados vinculados ao residente e necessários ao envio do documento.                                                            |
| Quartos                   | Cadastro de alojamentos e unidades opcionais; mapa por alojamento/unidade/piso, legenda, situação, ocupação, nota e detalhes. |
| Chamada                   | Menores de idade, marcações, justificativa por autorização e confirmação.                                                     |
| Saídas do residente       | Solicitação curta/longa, edição pendente, status e microtextos.                                                               |
| Saídas do supervisor      | Lista, detalhes, linha do tempo, revisão da decisão, reenvio e retorno curto.                                                 |
| Autorização do responsável | No detalhe da saída longa: documento enviado, arquivos recebidos, conferência e anexo manual, só para supervisor.            |
| Conversas                 | Lista, conversa e conexão do WhatsApp, só para supervisor.                                                                    |
| Ocorrências e comunicação | Painel interno, advertência manual, abas de avisos/advertências e ciência.                                                    |
| Limpeza e ranking         | Avaliação, feedback imediato e classificação por período.                                                                     |
| Relatórios                | Filtros combináveis, exportações visíveis e evolução individual.                                                              |
| Ajuda                     | Manual integrado, tutoriais por funcionalidade e FAQ.                                                                         |

O inventário agrupa superfícies de interação; não exige uma rota de URL para cada linha. **[P]** A localização da área de Termos de Compromisso no histórico do residente e a organização do cadastro de responsáveis dentro do residente são propostas de navegação, não telas prescritas pela SRS.

## Regras de experiência obrigatórias

Modal de Revisão para aprovação, rejeição e retorno curto; Linha do Tempo Visual nas saídas; preenchimento e limites automáticos de data/hora; microtextos de tipos de saída; abas separadas com ciência explícita; mapa que não depende apenas de cor; feedback imediato da limpeza; filtros e exportações visíveis; informação clara quando não houver dados.

**[T]** Testar navegação por teclado, foco nos modais, mensagens de erro e leitura em telas pequenas. Os gráficos terão resumo textual e dados acessíveis. A SRS não determina nível formal de certificação de acessibilidade; a escolha da biblioteca não certifica o produto automaticamente.

**Fonte:** SRS, Projeto de Interface, pp. 35–46; interfaces, p. 47; usabilidade e ajuda, p. 49.

<!-- pagebreak -->

# 18. Estados e transições do produto

Esta seção organiza os estados citados na SRS. Ela não resolve silenciosamente lacunas de cancelamento, partida, expiração ou retorno longo.

## 18.1 Solicitações de saída

| Modalidade       | Sequência principal documentada                                                                                             | Condições e limites                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Curta            | Solicitação registrada → aguardando análise → aprovada → em andamento → retorno confirmado ou retorno confirmado com atraso | “Em andamento” é pré-condição do UC17, mas seu evento de entrada não foi definido.                                         |
| Longa            | Solicitação registrada → aguardando autorização → autorização conferida → aguardando aprovação → aprovada                   | Autorização conferida e arquivo armazenado precedem a aprovação. Não há encerramento por retorno longo especificado. |
| Longa com falha  | Falha no envio → reenvio ou anexo manual → retomada do fluxo de autorização                                                 | Reenvio depende dos limites e da disponibilidade configurados.                                                             |
| Decisão negativa | Rejeitada                                                                                                                   | Exige comentário e confirmação explícita no modal.                                                                         |
| Interrupção      | Expirada ou cancelada                                                                                                       | Estados exigidos; faltam responsabilidades e transições completas.                                                         |

A conferência da autorização deve ser preservada no acompanhamento, mesmo quando a solicitação segue imediatamente para “Aguardando aprovação”. Um status de entrega/leitura de WhatsApp não substitui nenhum desses marcos.

## 18.2 Notificações e ciência

A notificação interna pode estar Pendente, Visualizada, Em análise, Arquivada ou Convertida em advertência. A visualização é registrada; arquivamento exige justificativa; conversão depende do registro manual. O cancelamento citado no cenário de revisão precisa ser conciliado com essa lista.

A leitura de aviso/advertência e a ciência explícita são eventos distintos. O item só se torna “Ciente” quando o residente confirma. Esse reconhecimento não deve ser utilizado para substituir a autorização conferida por servidor exigida na saída longa.

## 18.3 Invariantes de negócio

Uma saída longa não pode ser aprovada sem autorização conferida por servidor e arquivo armazenado. Uma saída curta não pode ter período planejado superior a três horas. Retorno curto exige supervisor e verificação presencial. Cancelar o modal não altera estado. Notificação interna não é advertência. Ciência depende de ação explícita. Reincidência não recebe limiar ou penalidade automática inventados.

## 18.4 Organização técnica proposta

**[T]** Manter histórico de transições separado do estado atual e estados independentes para solicitação, mensagem e autorização. Relacionar cada autorização à versão exata do documento. Validar novamente as condições no momento de confirmar ações, usando transação e controle de versão para evitar decisões sobre estado antigo ou conteúdo alterado. O backend Spring Boot é a autoridade dessas validações.

**[A]** A máquina de estados definitiva depende das decisões D05–D08, D12 e D13 da seção 23. Nenhum estado administrativo novo deve ser confundido com ocorrência física de partida ou chegada.

**Fonte:** SRS, UC06–UC08, pp. 16–20; UC10, pp. 22–23; RN05–RN08, p. 50; UC17–UC18, pp. 52–55.

<!-- pagebreak -->

# 19. Dados e vínculos necessários

**[T] Modelo conceitual para implementação.** Os objetos abaixo organizam informações e relações exigidas pelos fluxos. O banco escolhido é PostgreSQL; a persistência usará Spring Data JPA/Hibernate e migrações Flyway. O modelo físico inicial está no documento técnico. A modelagem antiga dos diagramas não é tomada como definitiva, e campos/regras institucionais pendentes seguem identificados.

| Objeto conceitual              | Conteúdo necessário ao produto                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Usuário/perfil                 | Conta SAGER por e-mail/senha, vínculo ao perfil e permissões autorizadas; identidade externa pode ser associada futuramente.                           |
| Supervisor                     | Dados cadastrais validados e vínculo às operações e decisões realizadas.                                                                               |
| Residente                      | Identificação, vínculo de matrícula, condição etária, quarto, dados pessoais e históricos previstos.                                                   |
| Informação médica              | Dados sensíveis do residente com acesso restrito ao conjunto autorizado.                                                                               |
| Responsável legal/vínculo      | Identificação, vínculo/autorização, telefone pré-cadastrado e condição ativa.                                                                          |
| Alojamento/unidade interna     | Código e nome do alojamento; casas/blocos opcionais vinculados a ele.                                                                                  |
| Quarto                         | Código globalmente único, número local textual, alojamento, unidade e piso opcionais, capacidade editável, ocupação, situação e referência de limpeza. |
| Chamada/participação           | Data/horário, residente, presença/ausência, justificativa, supervisor e indicação de registro tardio.                                                  |
| Solicitação de saída           | Residente, tipo, período, motivo, observações, estado, decisões e histórico de eventos.                                                                |
| Retorno curto                  | Solicitação, horário real, supervisor e observação obrigatória quando houver atraso.                                                                   |
| Documento/autorização          | Conteúdo da autorização, versão do termo, responsável, data/hora, status, hash, arquivo como recebido, origem e servidor que conferiu.                 |
| Envio de WhatsApp              | Solicitação/documento, destinatário, identificador de mensagem/API, tentativas, estados de entrega/leitura/falha e erros.                              |
| Ocorrência/notificação interna | Origem, motivo, data, evidências, residentes impactados, estado e decisão de análise.                                                                  |
| Advertência                    | Residente, origem quando houver, descrição, data, gravidade, justificativa e supervisor.                                                               |
| Aviso/leitura/ciência          | Item e destinatário; leitura distinta de ciência; data/hora da confirmação explícita.                                                                  |
| Termo de Compromisso           | Residente, ocorrências motivadoras, documento, decisão, supervisor, data e ciência/assinatura.                                                         |
| Avaliação/ranking              | Quarto, critérios e resultado, data, avaliação anterior, posição e período segundo fórmula a definir.                                                  |
| Auditoria                      | Evento, objeto relacionado, data, hora, usuário e origem; evidência da ação relevante.                                                                 |

## Vínculos e integridade

As solicitações pertencem a residentes; as autorizações correspondem a documentos de uma saída longa; os retornos curtos pertencem à solicitação correspondente; notificações preservam a ocorrência/avaliação de origem; a advertência convertida mantém vínculo à notificação; o termo referencia residente e ocorrências; a ciência é única por residente e item.

**[T]** Usar UUIDs, chaves estrangeiras, restrições de unicidade e transações. O histórico distingue período planejado, horário real de retorno e momento do registro. Autorizações são vinculadas à versão e à referência do arquivo; downloads exigem autorização no servidor. O documento técnico especifica controles de concorrência e processamento de tarefas persistentes.

**[A]** Não estão definidos tamanhos de campos, formatos de anexos, limites de arquivos, cardinalidade de responsáveis, retenção, exclusão, migração de dados antigos ou fórmula física do ranking. Os diagramas das páginas 32 e 34 precisam ser atualizados com responsáveis, versões de documentos, mensagens, notificações, ciência e RN10 antes de servirem como modelo de implementação.

**Fonte:** SRS, RF001–RF016, p. 7; casos de uso e regras revisadas, pp. 10–31 e 50–55; diagramas, pp. 32–34.

<!-- pagebreak -->

# 20. Requisitos não funcionais

Os valores abaixo são os declarados pela SRS. A aprovação deste PRD não constitui evidência de que já foram medidos ou atingidos.

| Categoria       | Requisito documentado                                                           | Observação de validação                                                                                                             |
| --------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Resposta        | Máximo de 2 segundos para operações como solicitações e consultas               | Ambiente, massa de dados e fronteira da medição ainda não definidos. Não substituir “máximo” por percentil sem aceite.              |
| Vazão           | 50 transações por minuto no pico                                                | Tipos de transação e composição da carga a definir.                                                                                 |
| Capacidade      | Gerenciar simultaneamente até 250 residentes                                    | Não equivale automaticamente a 250 sessões concorrentes.                                                                            |
| Infraestrutura  | VPS com 2 GB de RAM, 1 CPU e 50 GB de armazenamento                             | Validar aplicação, documentos, integrações e testes nesse orçamento de recursos.                                                    |
| Degradação      | Manter operação básica em falhas parciais; exemplo de relatórios offline        | Funcionalidades e mecanismo offline não detalhados.                                                                                 |
| Plataforma      | Web responsiva, sem aplicativo móvel próprio                                    | Testar uso em computador e celular; matriz de navegadores a definir.                                                                |
| Autenticação    | SRS: integração institucional; decisão de 30/09: login próprio do SAGER         | E-mail e senha na fase atual; SUAP/Google são possibilidades futuras. Implantação real requer validação de segurança.               |
| Comunicação     | HTTPS entre cliente/servidor e proteção das integrações                         | Webhooks autenticados, credenciais protegidas e tratamento de falhas.                                                               |
| Aprendizado     | 2 horas para supervisores e 30 minutos para residentes                          | Validar por tarefas representativas após treinamento.                                                                               |
| Erro de uso     | Inferior a 5% após treinamento                                                  | Método, tarefas e cálculo da taxa a definir.                                                                                        |
| Disponibilidade | 99% mensal, exceto manutenção programada                                        | Janela de medição e observabilidade precisam ser acordadas.                                                                         |
| MTBF            | 500 horas de operação sem falhas críticas                                       | Definição de falha crítica e período de observação pendentes.                                                                       |
| MTTR            | Reparo em até 4 horas após falha detectada                                      | Exige processo operacional; não é uma política de backup completa.                                                                  |
| Exatidão        | Presença, saídas, retornos, autorizações e notificações sem duplicatas ou perdas | Validar repetição de ações, falhas e recuperação.                                                                                   |
| Manutenção      | Código documentado, padrões claros e logs                                       | [T] Java com Javadoc quando necessário; Angular/TypeScript com tipagem estrita, lint e formatação. PEP 8 era apenas exemplo da SRS. |
| Suporte         | Equipe de TI e alunos bolsistas do campus                                       | Responsabilidades de operação e acesso a produção a definir.                                                                        |
| Ajuda           | Manual integrado, tutoriais e FAQ                                               | Conteúdo precisa cobrir funcionalidades efetivamente entregues.                                                                     |
| Propriedade/uso | Propriedade intelectual do IF Goiano; uso restrito ao Campus Urutaí             | Condições formais de licença precisam ser conciliadas com “código aberto interno”.                                                  |
| Licenciamento   | Sem dependência de licenças comerciais externas                                 | Compatibilidade com serviços externos obrigatórios deve ser validada institucionalmente.                                            |

**Stack:** definida nesta revisão, conforme seção 24 e documento técnico complementar. **[A] Medição:** acordar operações, massa e fronteiras de medição com a AE/TI, mantendo os limites da tabela. **[T]** Testar a aplicação na VPS especificada e executar builds/testes de navegador fora dela. O uso de processamento em segundo plano não transforma o recebimento de uma tarefa em comprovação de que toda a integração terminou em até 2 segundos.

**Fonte:** SRS, seções 3.8–3.10, pp. 47–49; RNF-WA01–05, p. 55.

<!-- pagebreak -->

# 21. Segurança, auditoria e contingência

## 21.1 Proteção de dados prevista

A SRS exige conformidade com a LGPD, minimização dos dados enviados por WhatsApp, controle de finalidade, registro de consentimento/ciência do responsável quando aplicável e restrição de acesso aos documentos assinados. Dados médicos devem ser tratados como informações sensíveis e não enviados nas mensagens.

Estas são exigências da fonte, não uma conclusão de conformidade jurídica já obtida. A referência à Lei nº 14.063/2020 não define, sozinha, a modalidade de assinatura que a instituição aceitará. A decisão deve ser formalizada pelos responsáveis institucionais competentes.

## 21.2 Eventos auditáveis

Devem ser auditados os envios e reenvios, conferências de autorização, decisões de aprovação/rejeição, confirmações de retorno e alterações de status, com **data, hora, usuário e origem**. O fluxo de análise também preserva visualização e decisão; a área do residente mantém leitura e ciência. Termos de Compromisso guardam decisão, data e usuário responsável. **[U] A trilha de auditoria é permanente**; isso não implica guardar indefinidamente o conteúdo integral de dados médicos, documentos ou todas as cópias de backup. A implementação da trilha permanente ainda está pendente.

O registro da operação precisa permitir relacionar a ação à solicitação, documento, ocorrência ou item correto. Falhas de envio, recebimento e conferência devem ser tratadas e permanecer identificáveis para operação.

## 21.3 Contingência documentada

Falhas de WhatsApp/API ou telefone inválido devem aparecer no painel. O supervisor pode registrar providência, reenvio, contato alternativo autorizado ou anexo manual. Enquanto não houver autorização conferida na saída longa, o sistema não libera aprovação.

A manutenção de operações básicas em falha parcial está prevista, com relatórios offline como exemplo. Não há descrição de chamada offline, sincronização posterior de retornos ou liberação manual de saídas sem autorização conferida. Esses comportamentos não devem ser implementados como exceções implícitas.

## 21.4 Proteções adotadas na arquitetura

**[T]** Aplicar autorização no servidor com Spring Security; impedir duplicatas nas confirmações; validar autenticidade e correlação dos eventos externos; impedir que versões antigas concluam documentos novos; evitar dados sensíveis e segredos em logs; testar restauração de banco e documentos. As sessões serão mantidas no servidor com Spring Session JDBC; não se armazenam tokens de autenticação no localStorage.

**[T]** Controlar downloads por vínculo e permissão, separar credenciais de desenvolvimento/homologação/produção e manter documentos em volume privado, fora da pasta pública do Nginx. Cookies de sessão protegidos, CSRF e logs operacionais sem segredos integram a arquitetura. Essas são decisões desta revisão, não tecnologias prescritas pela SRS.

## Pendências obrigatórias de governança

**[A]** A instituição precisa definir finalidade de tratamento por conjunto de dados, retenção e descarte dos dados operacionais e médicos, lista de profissionais autorizados, modalidade de assinatura e responsáveis por incidentes. A decisão de auditoria permanente deve ser implementada com minimização do conteúdo sensível e controle de acesso. **[T]** O documento técnico especifica o mecanismo de backup e o procedimento de restauração. Frequência, retenção, destino institucional e objetivo de perda máxima de dados exigem aprovação; o MTTR da SRS não define esses parâmetros.

**Fonte:** SRS, referências, p. 5; UC04 e UC08, pp. 13–14 e 20; interfaces e proteção de dados, pp. 47–48; confiabilidade, p. 49; RN08–RN10, pp. 50–51; RNF-WA01–05, p. 55.

<!-- pagebreak -->

# 22. Validação, entregas e acompanhamento

## 22.1 Critério de conclusão do produto

**[P] Critério de liberação:** cada requisito aplicável da SRS deve ter implementação demonstrável e teste correspondente; os critérios AC01–AC72 e os critérios técnicos AT01–AT18 do documento complementar devem ser verificados; os fluxos integrais devem ser homologados pela AE; decisões pendentes que afetem segurança, assinatura, cálculos ou regras operacionais devem estar resolvidas ou formalmente delimitadas antes do uso real.

O uso de simulações para desenvolvimento não substitui a homologação das integrações institucionais e externas. A liberação não pode depender de contas demonstrativas, autorização apenas visual ou dados fictícios apresentados como registros reais.

## 22.2 Jornadas integradas de homologação

| Jornada                                          | Evidência esperada                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Cadastro → chamada → ausência justificada        | Residente elegível, marcação completa e vínculo com autorização válida.                            |
| Saída curta → aprovação → retorno                | Limite de 3 horas, dois modais no fluxo pertinente, presença verificada, horário real e histórico. |
| Saída curta com atraso → análise                 | Observação obrigatória, status com atraso e alerta condicionado à regra, sem sanção automática.    |
| Saída longa → WhatsApp → conferência → decisão   | Documento correto, arquivo armazenado, conferência antes da aprovação e eventos auditáveis.        |
| Falha de envio → providência → reenvio           | Erro visível, histórico das tentativas e manutenção do bloqueio de aprovação.                      |
| Ocorrência → notificação → advertência → ciência | Análise humana, justificativa, item do residente e ciência distinta da leitura.                    |
| Reincidência → Termo de Compromisso              | Critério da AE, ocorrências vinculadas e ciência/assinatura conforme procedimento.                 |
| Avaliação → ranking → relatório                  | Nota persistida, feedback correto, classificação e exportação coerentes.                           |

## 22.3 Ordem de execução sugerida

**[P] Etapa 0 — decisões e preparação:** validar o login próprio para implantação, assinatura, critérios de avaliação, matriz de acesso e ambiente. Integração com SUAP/Google pode ser estudada depois, sem bloquear o desenvolvimento atual. **Etapa 1 — fundação:** acesso, cadastros, mapa, permissões e auditoria. **Etapa 2 — operação residencial:** chamada, saídas curtas, aprovação e retorno. **Etapa 3 — integração longa:** documentos, WhatsApp, assinatura, falhas e reenvio. **Etapa 4 — acompanhamento:** notificações, advertências, ciência, termos, limpeza e ranking. **Etapa 5 — fechamento:** relatórios, ajuda, testes não funcionais e homologação integrada.

Essa sequência é planejamento proposto, não redução de escopo, prazo contratado ou autorização para operar parcialmente fluxos obrigatórios. A SRS não informa orçamento, cronograma nem tamanho da equipe.

## 22.4 Indicadores propostos para o piloto

**[P]** Acompanhar proporção de chamadas completas; tempo entre solicitação e decisão; envios com falha; tempo até a autorização; saídas curtas encerradas com retorno registrado; proporção de avisos/advertências com ciência; notificações analisadas/arquivadas/convertidas; tempo das consultas e erros após treinamento.

Metas de impacto e linhas de base devem ser aprovadas pela AE. Os valores não funcionais já documentados permanecem os da seção 20. Os indicadores não devem transformar pendências operacionais ou notas de limpeza em diagnóstico de comportamento individual não definido.

**Fonte das jornadas:** SRS, UC03–UC12, UC015–UC18 e RN10. Sequência, critérios de liberação e indicadores desta seção são propostas de organização deste PRD.

<!-- pagebreak -->

# 23. Lacunas, divergências e decisões pendentes

Este registro não retira requisitos documentados. Identifica as decisões necessárias para implementá-los sem inventar políticas ou esconder inconsistências. Os responsáveis abaixo são **[P] encaminhamentos sugeridos**, sujeitos à governança da instituição.

## 23.1 Regras operacionais bloqueantes

| ID  | Lacuna ou divergência identificada                                                                                                            | Decisão necessária / encaminhamento                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | RF002 indica Gestor; UC015 permite Supervisor/Gestor. UC01 não detalha Gestor.                                                                | [U] Em 30/09, paridade operacional de gestor e supervisor nas funções atuais, inclusive gestão de supervisores; médico apenas por profissão. Em 31/10, só o gestor gerencia supervisores, inclusive leitura; a paridade segue nos demais cadastros. AE/TI: demais perfis e permissões.                                      |
| D02 | Cadastro não lista todos os campos, unicidades ou como comprovar matrícula.                                                                   | [U] Em 30/09, cadastro manual sem limite 16–17 anos, nascimento obrigatório em novo/edição; legado sem nascimento legível. Desde 31/10/2026, curso também obrigatório em novo/edição; legado sem curso legível. AE/TI: demais campos, validade da matrícula e desligamento. |
| D03 | UC06 preenche saída com “agora”, mas proíbe horário anterior ao atual; o preenchimento leva tempo.                                            | AE/TI: referência temporal no envio, atualização do valor ou tratamento explícito do intervalo de preenchimento.                                                                                                     |
| D04 | Texto define Curta/Longa; Figuras 8 e 13 mostram também Breve e Visita pra casa. A Figura 4 exemplifica curta com intervalo acima de 3 horas. | AE: homologar modalidades. [P] Adotar os UC/RN revisados e corrigir protótipos conflitantes, sem incluir modalidades extras por inferência.                                                                          |
| D05 | UC17 requer saída “em andamento”, mas não define como ocorre a transição após aprovação.                                                      | AE: definir evento de início e distinguir autorização de efetiva saída física.                                                                                                                                       |
| D06 | Expiração e cancelamento são estados, sem política completa de prazos, atores ou automação.                                                   | AE: definir transições, cancelamento, antecedência e tratamento de solicitações já vencidas.                                                                                                                         |
| D07 | Aprovação longa exige autorização conferida; pré-condição do UC07 é ampla e não esclarece rejeição antes dela.                                | AE: definir se o supervisor pode rejeitar antes da autorização.                                                                                                                                                      |
| D08 | Retorno curto informa horário real, mas não define lançamento tardio, correção ou saída ainda não encerrada após o prazo.                     | AE: definir esses cenários e confirmar que retorno longo permanece fora do fluxo detalhado.                                                                                                                          |
| D09 | Chamada às 22h30, com alternativa tardia, sem tolerância e política de correção completas.                                                    | AE: janela, população, fechamento e correção. [T] Fuso America/Sao_Paulo, unicidade por chamada/residente e conflito de versão já definidos na arquitetura.                                                          |
| D10 | Escala, critérios e pesos da limpeza, períodos, desempates e limiar de alerta não definidos.                                                  | AE: aprovar fórmula da avaliação, ranking e parâmetros de notificação.                                                                                                                                               |
| D11 | “Evolução do comportamento” é exigida, sem definição da métrica.                                                                              | AE: determinar indicadores, agregação e origem; não usar nota fictícia ou fórmula inferida do protótipo.                                                                                                             |
| D12 | UC10 cita cancelar notificação, mas lista somente cinco estados, sem “Cancelada”.                                                             | AE/TI: definir estado adicional ou representação auditável equivalente e comportamento após revisão.                                                                                                                 |
| D13 | Critérios de notificação, gravidades e evidências mínimas não são enumerados.                                                                 | AE: definir catálogos, limites, responsáveis pela configuração e regras de revisão.                                                                                                                                  |
| D14 | RN10 exige Termo de Compromisso, sem limiar, modelo, signatários ou fluxo detalhado.                                                          | AE: aprovar procedimento e forma de registro/ciência/assinatura; sem número de reincidências inventado.                                                                                                              |

## 23.2 Integração, dados e governança

| ID  | Lacuna ou divergência identificada                                                                                                           | Decisão necessária / encaminhamento                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D15 | Responsáveis não têm cardinalidade, prioridade de contato ou verificação de identidade definida.                                             | [U] Uma autorização conferida de qualquer responsável ativo, autorizado e vinculado basta para saída longa; não exigir ambos. AE/TI: prova de identidade, vínculo, escolha do destinatário e telefone.                                                                                                |
| D16 | Nível de assinatura exigido e uso de integração não oficial do WhatsApp não homologados.                                                     | [U] Em 2026-10-31, sem provedor externo de assinatura: autorização recebida pelo WhatsApp e conferida por servidor. [T] Gateway WAHA/GOWS. AE/TI/Procuradoria: nível mínimo exigido, aceite formal da integração, base legal e compatibilidade com D25 antes da ativação.                                                                                                                                                    |
| D17 | Prazo da autorização, reenvio ao responsável e recusa não definidos institucionalmente.                                                      | AE/TI: aprovar essas políticas e a retenção de mensagens e arquivos. [T] Versões imutáveis, eventos idempotentes e bloqueio durante falha de armazenamento já definidos no documento técnico.                                                                                                                                                  |
| D18 | UC08 permite consultar avisos, mas não detalha autoria, publicação, segmentação ou revisão. UC04 mistura trechos de e-mail ao fluxo interno. | AE: definir gestão de avisos e canais de notificação, preservando o sigilo dos alertas internos.                                                                                                                                                                                                            |
| D19 | UC16 exige número único; anexos de 2026 mostram alojamentos e unidades com divergências de capacidade e ocupação.                            | [U/T] Código global e número local por localização; alocação local provisória. Em 30/09, ZIP detalhado prevalece onde há divergência de capacidade: R4 66/64 e Laticínio 10/8; PDF complementa inventário ausente. Não inferir quartos de R3/Zootecnia nem importar alunos reais. AE: conferir e homologar. |
| D20 | UC11/RF011 permitem relatórios para supervisor/gestor; Figura 9 indica exportação somente para gestor.                                       | AE: confirmar exportações por perfil, dados sensíveis e colunas/filtros de cada relatório.                                                                                                                                                                                                                  |
| D21 | SRS prevê autenticação institucional; decisão atual é login próprio por e-mail/senha.                                                        | [U] SUAP/Google ficam para futuro. [T] Spring Security e sessão JDBC na fase atual local. TI: validar segurança, provisionamento, recuperação e implantação real; provedor externo não é bloqueio atual.                                                                                                    |
| D22 | Retenção, descarte e objetivos de recuperação não definidos na SRS.                                                                          | [U] Trilha de auditoria permanente, com implementação pendente; isso não abrange todo conteúdo médico nem backups. AE/TI: governança e prazos desses dados, acessos, destino externo e recuperação.                                                                                                         |
| D23 | “Relatórios offline” aparece apenas como exemplo de degradação.                                                                              | AE/TI: escolher escopo e forma da contingência; não presumir sistema inteiro offline.                                                                                                                                                                                                                       |
| D24 | Metas de resposta/capacidade existem sem cenário de teste; 250 residentes não fixa concorrência.                                             | TI: carga, métricas, condições de medição e validação na VPS definida.                                                                                                                                                                                                                                      |
| D25 | “Código aberto interno”, uso exclusivo e ausência de licenças comerciais coexistem com serviços externos obrigatórios.                       | Instituição/TI: esclarecer licença, contratação, orçamento e compatibilidade das dependências.                                                                                                                                                                                                              |
| D26 | Diagramas antigos contêm penalidades e não representam integralmente responsáveis, mensagens, assinaturas, ciência e termos.                 | AE/TI: atualizar diagramas e modelo físico a partir dos fluxos homologados.                                                                                                                                                                                                                                 |

## 23.3 Delimitação da aprovação

**[P]** Registrar para cada decisão: responsável institucional, opção aprovada, data, justificativa, requisitos impactados e versão do PRD. Dependências resolvidas por configuração devem ter valores explícitos em homologação; não basta existir um campo sem política definida.

Até essa validação, o documento cobre o escopo conhecido do software, mas não autoriza preencher as lacunas com limites disciplinares, permissões, fórmulas, custos ou decisões de assinatura não sustentados pela fonte.

**Fonte:** divergências entre RF/UC, pp. 7–31; diagramas, pp. 32–34; protótipos, pp. 35–46; requisitos não funcionais, pp. 47–49; regras e integrações, pp. 50–55.

<!-- pagebreak -->

# 24. Stack tecnológica e decisões de implementação

## 24.1 Base adotada nesta revisão

**[U]** O solicitante confirmou Angular no frontend e Java com Spring Boot no backend em 24/09/2026. **[T]** As escolhas abaixo completam essa base, priorizando ferramentas do próprio ecossistema, um único backend e poucos serviços para operar. Não representam uma pesquisa de popularidade nem aprovação institucional de contratos externos.

| Camada               | Escolha                                                     | Uso no SAGER                                                                     |
| -------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Frontend             | Angular 22, TypeScript e Angular CLI                        | Aplicação web responsiva com rotas por funcionalidade; sem app nativo.           |
| Interface            | Angular Material + CDK + SCSS                               | Formulários, modais, abas, navegação e componentes; mapa de quartos em CSS Grid. |
| Formulários e estado | Reactive Forms, Signals e RxJS                              | Validação, estado local e chamadas HTTP; sem NgRx na base inicial.               |
| Backend              | Java 21 LTS / Eclipse Temurin + Spring Boot 4.1             | API REST e regras de negócio em monólito modular, com Spring MVC.                |
| Dados                | PostgreSQL 17 + Spring Data JPA/Hibernate + Flyway          | Banco relacional, transações, consultas, integridade e migrações.                |
| Segurança            | Spring Security + Spring Session JDBC                       | Login próprio do SAGER, sessão no servidor e permissões por operação/registro.   |
| Integrações          | Gateway WAHA/GOWS auto-hospedado, por HTTP                  | Comunicação externa pelo backend, com interface única, auditoria e retentativas. |
| Autorização          | Conferência humana, sem provedor externo de assinatura      | Arquivo recebido e conferido por servidor; ativação depende de D16 e D25.        |
| Tarefas              | Agendador Spring + tabela persistente no PostgreSQL         | Envios, eventos e recuperação após reinício, sem Redis/RabbitMQ obrigatórios.    |
| Relatórios           | Apache PDFBox 3, Apache POI e Chart.js                      | PDFs, planilhas XLSX e gráficos com alternativa textual.                         |
| Implantação          | Docker Engine + Compose + Nginx em VPS Linux                | Frontend estático, backend Java e banco; documentos em volume privado.           |
| Qualidade            | JUnit Jupiter, Mockito, Testcontainers, Vitest e Playwright | Testes de regras, integração, componentes e jornadas de navegador.               |

**Referências técnicas:** documentação oficial listada na seção 17 da Especificação Técnica. As famílias de versão foram consultadas em 24/09/2026; a combinação exata de patches deve ser registrada nos arquivos de dependências e validada pela integração contínua. Não usar versões preview, snapshot ou a tag latest em produção.

## 24.2 Arquitetura e restrições técnicas

**[T]** Usar um monólito modular Spring Boot, organizado por funcionalidades, com um banco PostgreSQL. Servir o Angular compilado pelo Nginx e encaminhar as rotas da API e autenticação ao backend na mesma origem. Não executar Node.js em produção para servir esse frontend estático.

A configuração inicial possui três serviços permanentes: Nginx, aplicação Spring Boot e PostgreSQL. Banco e arquivos devem sobreviver à recriação dos contêineres. A fila de tarefas fica no PostgreSQL, e o processamento é feito dentro do backend; o agendador, sozinho, não garante a persistência das tarefas.

O servidor decide permissões, estados, horários válidos, ranking e regras de negócio. O frontend reaplica validações para orientar o usuário, mas não substitui a validação do servidor. Nenhum cálculo institucional em aberto pode ser preenchido com um valor inventado apenas para demonstrar a tela.

A base inicial não inclui microserviços, Kubernetes, Kafka, Redis, RabbitMQ, GraphQL, WebFlux, NgRx, renderização Angular no servidor ou autenticação JWT própria. Sua inclusão futura exige necessidade demonstrada e registro da decisão técnica. Isso não retira nenhuma funcionalidade da SRS.

## 24.3 Como usar os dois documentos

O **PRD v2.0** é a referência de escopo, regras de negócio, atores, experiência e critérios de aceite. A **Especificação Técnica e Arquitetura v2.0** é a referência de implementação: versões, dependências, organização do código, dados, API, sessões, segurança, arquivos, integrações, testes, implantação e recuperação.

O documento técnico não autoriza modificar as regras da SRS, resolver por conta própria decisões disciplinares da AE ou contratar serviços. Quando uma limitação técnica exigir mudança funcional, registrar o impacto e obter validação antes de alterar o comportamento.

## 24.4 Histórico desta revisão

| Versão           | Alteração                                                                                         | Efeito                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0              | Consolidação do escopo da SRS                                                                     | 15 épicos, 72 critérios de aceite e registro de lacunas.                                                                                                                |
| 2.0              | Confirmação de Angular e Java/Spring Boot; seleção dos complementos; criação do documento técnico | Stack deixa de ser pendência. São preservados RF001–RF016, RN01–RN10, RNF-WA01–05 e AC01–AC72.                                                                          |
| 2.0 — 29/09/2026 | Decisão de projeto para a fatia local de alojamentos, unidades e quartos                          | E04/AC14 distinguem código global e número local; capacidade e situação manuais não simulam ocupação nem limpeza. Fase 2 e homologação institucional continuam abertas. |
| 2.0 — 29/09/2026 | Regra provisória para a fatia local de alocação e transferência                                   | Um quarto ativo por residente, limite pela capacidade definida, histórico e bloqueios locais; situação manual e homologação institucional preservadas.                  |
| 2.0 — 30/09/2026 | Decisões do solicitante para autenticação, acesso, cadastro, responsáveis, capacidade e auditoria | Login próprio; paridade operacional com sigilo médico; nascimento obrigatório sem limite etário de cadastro; uma assinatura; precedência do ZIP; trilha permanente.     |
| 2.0 — 31/10/2026 | Substituição da assinatura eletrônica por link pela autorização conferida por servidor            | Seção 11, AC25, AC30, AC39–AC44 e D07, D15–D17 reescritos; conversas para supervisor; sem aceite institucional. |

A proposta anterior de React/Django não integra a arquitetura vigente. O repositório já contém implementação e testes locais; esta revisão documental não comprova homologação ou implantação real. A homologação do produto e das integrações reais continua necessária.
