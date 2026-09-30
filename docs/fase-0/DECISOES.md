# Registro de decisões D01–D26

**Registro inicial:** 25/09/2026. **Revisão do login:** 26/09/2026.
**Informações preliminares da Fase 2:** 26/09/2026. **Estrutura dos alojamentos e
anexos recebidos:** 29/09/2026. **Respostas do solicitante:** 30/09/2026.
**Base funcional:**
[PRD v2.0, seção 23](../../SAGER_PRD_v2.0_Angular_SpringBoot.md). **Base de
implementação:**
[Especificação Técnica v2.0](../../SAGER_Especificacao_Tecnica_v2.0.md) e
[roteiro de fases](../ROADMAP_IMPLEMENTACAO.md).

Este registro separa uma **escolha de projeto** da **homologação
institucional**. AE significa Assistência Estudantil; TI significa a equipe de
tecnologia da instituição. Os responsáveis abaixo seguem os encaminhamentos
propostos pelo PRD e precisam ser confirmados pela governança institucional.
**Não há opção institucional aprovada, data de aprovação ou evidência de
homologação registrada para D01–D26.** A data acima é apenas a data deste
registro. Em cada decisão, “pendente” indica a decisão que ainda deve ser
formalizada; uma proposta técnica não a substitui. As respostas de 30/09/2026
definem escolhas do projeto para D01, D02, D15, D19, D21 e D22, sem registrar
manifestação formal da AE/TI. Elas prevalecem sobre as regras provisórias
anteriores nos pontos expressamente respondidos.

## D01 — Matriz de perfis, permissões e provisionamento do gestor; E01–E03, RF002, UC01/UC015.

**Estado atual e encaminhamento:** **Permissões de gestão definidas pelo
solicitante em 30/09/2026; homologação institucional pendente.** O supervisor
é a autoridade máxima na gestão e pode consultar, cadastrar e editar os
cadastros existentes, inclusive supervisores, residentes, responsáveis,
alojamentos, unidades e quartos, e alocar, transferir e encerrar vínculos de
quartos. O gestor conserva essas operações. Essa paridade de gestão substitui
o recorte de 29/09/2026, que restringia a escrita ao gestor e não liberava a API
de supervisores ao supervisor.

O projeto usa perfis locais explícitos e autorização
no servidor, sem atribuir perfil pelo domínio do e-mail ou conceder acesso
médico ao gestor. O solicitante
informou que os servidores da GAE, inclusive os profissionais de saúde, poderão
acessar dados não sensíveis. Esta orientação ainda precisa ser traduzida em uma
matriz de recursos e operações por perfil, com confirmação da AE/TI. Acesso a
dados sensíveis segue a delimitação atualizada da D22. Para a fatia local de
residentes, responsáveis, alojamentos, unidades, quartos, mapa e alocações,
o contrato atualizado prevê leitura, escrita e movimentação por gestor e
supervisor. O cadastro funcional de supervisores não cria conta de acesso. Acesso de residente
às APIs desses cadastros não está liberado. Este recorte autorizado para
desenvolvimento não aprova a matriz institucional.

**Responsável / até a fase:** AE/TI; entrada da Fase 1.

**Evidência:** PRD §2.2–2.3 e §23.1; roteiro F0–F1; informação do solicitante
de 26/09/2026 e escolhas de permissões locais de 29/09/2026;
decisão do solicitante em 30/09/2026 sobre autoridade e operações do supervisor;
[aceites técnicos das cinco fatias](../fase-2/QA.md), sem aceite institucional
registrado. A matriz atual e os pontos a confirmar estão no
[pacote AE/TI](../fase-2/PACOTE_AE_TI.md).

## D02 — Dicionário cadastral, campos, unicidade, matrícula, desligamento e maioridade; E02, RF002, UC015.

**Estado atual e encaminhamento:** **Cadastro manual e nascimento obrigatório
definidos pelo solicitante em 30/09/2026; homologação institucional pendente.**
O cadastro será manual, realizado pelo gestor; o supervisor também pode cadastrar
e editar conforme D01. A integração com SUAP está adiada porque não há autorização.
Nome, matrícula e nascimento são obrigatórios nas novas gravações, inclusive
edições de registros existentes. A matrícula
é tratada como texto, sem inferir quantidade de dígitos ou composição; espaços
nas pontas, inclusive espaços Unicode, são retirados e a unicidade não distingue
maiúsculas de minúsculas. Nascimento deve ser válido e não futuro; curso permanece
opcional. A regra anterior de 29/09/2026 permitia nascimento ausente: registros
legados nessa condição são preservados, sem inventar datas, mas precisam informar
a data ao serem editados. A ausência legada não implica maioridade nem autoriza
operações que dependam da idade. O cadastro recebe um UUID local
estável, independente do login e da matrícula. Esta regra viabiliza apenas a
fatia local de cadastro e consulta; uma integração institucional futura exige
autorização e novo contrato de origem dos dados.

O login local não fornece nem valida matrícula. O IF Goiano informa que ela é
usada como identificador de acesso ao SUAP, o que não define sua obtenção no
SAGER. Os exemplos mascarados relatados pelo solicitante têm 16 e 17 posições,
sem confirmação de formato universal. Os anexos de alojamentos recebidos em
29/09/2026 não contêm matrícula nem nascimento. Responsável pela conferência,
comprovação dos campos, correções, desligamento e ciclo do vínculo permanecem abertos.

**Responsável / até a fase:** AE/TI; antes da homologação e da integração
institucional do cadastro.

**Evidência:** PRD §E02 e §23.1; roteiro F1–F2; escolha do solicitante em
29/09/2026 por digitação provisória, matrícula obrigatória e única e nascimento/
curso opcionais como antecedente; decisão do solicitante em 30/09/2026 por
cadastro manual, nascimento obrigatório e adiamento da integração SUAP;
[infográfico do IF Goiano](https://ifgoiano.edu.br/pdf/infografico_email.pdf)
para uso da matrícula no SUAP; relato de 26/09/2026 sobre comprimento, sem
confirmação de regra institucional.

## D03 — Referência temporal para envio da saída preenchida com “agora”; E06, UC06.

**Estado atual e encaminhamento:** **Institucional pendente.** Definir se o
horário é atualizado, se vale o instante do envio ou qual intervalo de
preenchimento é aceito; sem tolerância implícita.

**Responsável / até a fase:** AE/TI; Fase 3.

**Evidência:** PRD §E06 e §23.1; roteiro F3.

## D04 — Modalidades Curta/Longa versus rótulos adicionais dos protótipos; E06, UC06/RN01.

**Estado atual e encaminhamento:** **Proposta de projeto; AE pendente.** Usar
Curta e Longa conforme UC/RN revisados até homologar; não criar Breve ou Visita
pra casa por inferência.

**Responsável / até a fase:** AE; Fase 3.

**Evidência:** PRD §E06 e §23.1; roteiro F3.

## D05 — Evento de entrada em “em andamento” e distinção da saída física; E07–E08, UC17.

**Estado atual e encaminhamento:** **Institucional pendente.** A aprovação não
deve ser interpretada automaticamente como registro de partida.

**Responsável / até a fase:** AE; Fase 3.

**Evidência:** PRD §18.1 e §23.1; roteiro F3.

## D06 — Prazos, atores e transições de cancelamento/expiração; E06–E07, UC07.

**Estado atual e encaminhamento:** **Institucional pendente.** Definir
antecedência, automação e tratamento de solicitações vencidas antes de criar
transições definitivas.

**Responsável / até a fase:** AE; Fase 3.

**Evidência:** PRD §E07 e §23.1; roteiro F3.

## D07 — Possibilidade de rejeitar saída longa antes da assinatura; E07/E09, UC07/RN05.

**Estado atual e encaminhamento:** **AE pendente.** Permanece vigente o
requisito do PRD: **aprovação de saída longa exige assinatura válida e documento
assinado armazenado**; a dúvida é apenas a ordem permitida da rejeição.

**Responsável / até a fase:** AE; Fases 3–4.

**Evidência:** PRD §E07, §E09 e §23.1; roteiro F4.

## D08 — Lançamento tardio, correção e saída curta aberta após o prazo; E08, UC17.

**Estado atual e encaminhamento:** **Institucional pendente.** Confirmar também
o limite do fluxo de retorno longo antes de implementar correções retroativas.

**Responsável / até a fase:** AE; Fase 3.

**Evidência:** PRD §E08 e §23.1; roteiro F3.

## D09 — Janela, população, fechamento e correção da chamada das 22h30; E05, UC05.

**Estado atual e encaminhamento:** **Técnica definida; AE pendente.** Fuso
`America/Sao_Paulo`, unicidade por chamada/residente e controle de versão são
referências técnicas, não uma janela de tolerância aprovada.

**Responsável / até a fase:** AE; Fase 3.

**Evidência:** PRD §E05 e §23.1; especificação §4.3/§7; roteiro F3.

## D10 — Escala, pesos, períodos, desempate e limiar de alerta da limpeza; E13, UC09/UC12.

**Estado atual e encaminhamento:** **Institucional pendente.** Não usar números
ou fórmula do protótipo como regra oficial.

**Responsável / até a fase:** AE; Fase 6.

**Evidência:** PRD §E13 e §23.1; roteiro F6.

## D11 — Métrica da “evolução do comportamento”; E14, RF011/UC11.

**Estado atual e encaminhamento:** **Institucional pendente.** Definir
indicadores, agregação e origem antes de calcular ou apresentar série histórica.

**Responsável / até a fase:** AE; Fase 6.

**Evidência:** PRD §E14 e §23.1; roteiro F6.

## D12 — Cancelamento da notificação ausente da lista de estados; E10, UC10.

**Estado atual e encaminhamento:** **Institucional pendente.** Escolher estado
adicional ou representação auditável equivalente e definir revisão posterior.

**Responsável / até a fase:** AE/TI; Fase 5.

**Evidência:** PRD §E10 e §23.1; roteiro F5.

## D13 — Critérios, gravidades e evidências de notificações; E05/E10/E13, RF004/RF005.

**Estado atual e encaminhamento:** **Institucional pendente.** Catálogos,
limites e responsáveis por configuração devem ser aprovados; não gerar sanção
automática.

**Responsável / até a fase:** AE; antes dos alertas nas Fases 3, 5 e 6.

**Evidência:** PRD §E10 e §23.1; roteiro F3/F5/F6.

## D14 — Limiar, modelo, signatários e procedimento do Termo de Compromisso; E12, RN10.

**Estado atual e encaminhamento:** **Institucional pendente.** Não inferir
quantidade de reincidências nem modalidade de ciência/assinatura.

**Responsável / até a fase:** AE; Fase 5.

**Evidência:** PRD §E12 e §23.1; roteiro F5.

## D15 — Cardinalidade e prioridade dos responsáveis, identidade e telefone; E02/E09, RN03.

**Estado atual e encaminhamento:** **Uma assinatura suficiente definida pelo
solicitante em 30/09/2026; comprovação e homologação institucional pendentes.**
Para saída longa, basta a assinatura válida de qualquer responsável cadastrado
e vinculado ao residente; não são exigidas assinaturas de ambos. Essa regra
define a quantidade e a elegibilidade cadastral do signatário, mas não escolhe
automaticamente o destinatário nem define serviço, modalidade ou comprovação
de identidade da assinatura (D16/D17).

No cadastro local, um residente pode ter
vários registros de responsáveis, cada um com nome, vínculo declarado, telefone
opcional e estado ativo informado por gestor ou supervisor. Esse cadastro não
comprova guarda nem a validade de uma assinatura. Comprovação do vínculo e da identidade,
seleção do destinatário e tratamento de divergências precisam ser definidos
antes de qualquer envio ao responsável. O solicitante
esclareceu que um residente pode ter como responsáveis legais quem detém sua
guarda, pai e mãe, apenas a mãe, apenas o pai ou outra configuração legalmente
válida. A regra institucional para quantidade, comprovação do vínculo,
identidade e telefone válido ainda depende de confirmação da AE/TI. Os anexos recebidos em
29/09/2026 não contêm responsáveis legais ou seus telefones e não resolvem essas
regras.

**Responsável / até a fase:** AE/TI; Fases 2 e 4.

**Evidência:** PRD §E02, §E09 e §23.2; roteiro F2/F4; esclarecimento do
solicitante em 26/09/2026, autorização para desenvolvimento local em 29/09/2026,
decisão do solicitante em 30/09/2026 por uma assinatura de qualquer responsável
cadastrado e vinculado, e [aceite técnico da quarta fatia](../fase-2/QA.md), sem aceite institucional
registrado.

## D16 — Modalidade, identidade, serviço e contratação da assinatura; E09, RF015/RF016.

**Estado atual e encaminhamento:** **Serviço e modalidade adiados pelo
solicitante; aprovação pendente.** A Clicksign API 3.0 da especificação é só
referência técnica condicionada; não há fornecedor nem assinatura
manual/digital/gov.br homologados. O bloqueio da aprovação longa continua
obrigatório.

**Responsável / até a fase:** AE/TI e instituição; antes de ativar a Fase 4.

**Evidência:** PRD §E09 e §23.2; especificação §8.1; roteiro F4; decisão do
solicitante nesta Fase 0.

## D17 — Expiração, reenvio e recusa do link de assinatura; E09, UC18.

**Estado atual e encaminhamento:** **Institucional pendente.** Versões
imutáveis, eventos idempotentes e bloqueio após falha de armazenamento são
desenho técnico, não política de prazo ou recusa.

**Responsável / até a fase:** AE/TI; Fase 4.

**Evidência:** PRD §E09 e §23.2; especificação §8.3–8.4; roteiro F4.

## D18 — Autoria, publicação, segmentação, revisão e canais dos avisos; E11, UC04/UC08.

**Estado atual e encaminhamento:** **Institucional pendente.** Separar avisos de
alertas internos sigilosos; não presumir envio por e-mail.

**Responsável / até a fase:** AE; Fase 5.

**Evidência:** PRD §E11 e §23.2; roteiro F5.

## D19 — Estrutura, código global, número local, capacidade, alocação e estados dos quartos; E04, AC14, UC16.

**Estado atual e encaminhamento:** **Estrutura local autorizada e precedência
das fontes definida como escolha de projeto; homologação institucional pendente.**
Em 29/09/2026, o solicitante
autorizou alojamentos com código e nome, unidades internas opcionais (casas/blocos)
e quartos com piso opcional. Cada quarto tem código globalmente único e número
local textual, preservando valores como `01`. O número pode se repetir em
localizações diferentes, mas não na mesma combinação de alojamento, unidade e
piso. Duplicidades desconsideram espaços nas extremidades e diferenças de
maiúsculas/minúsculas; valores ausentes de unidade e piso representam a mesma
localização ausente. A unidade informada deve pertencer ao alojamento do quarto.

Capacidade é editável, inteira positiva ou ausente (`null`), sem assumir zero.
Disponível, Ocupado, Manutenção e Indisponível são situações manuais. Ocupação,
vagas livres e nota de limpeza permaneceram desconhecidas (`null`) na fatia
estrutural; a situação manual não determina essas medidas. O mapa local inicia
vazio. A demonstração e os testes usam registros sintéticos, sem importar
residentes dos anexos. Pela atualização de D01 em 30/09/2026, gestor e supervisor
locais consultam, cadastram, editam e movimentam vínculos, com sessão, CSRF nas
alterações e controle de versão. Este contrato
não substitui a matriz institucional da D01.

**Regra adicional provisória de 29/09/2026:** o solicitante autorizou, apenas
para desenvolvimento local, um quarto ativo por residente e histórico de
alocações, transferências e encerramentos. Nova alocação exige capacidade
definida e vaga dentro desse limite; quartos em Manutenção ou Indisponível não
recebem novos residentes. Alterar a capacidade para ausente ou abaixo da
ocupação ativa deve ser recusado. A ocupação passa a ser a contagem dos vínculos
ativos e vagas livres são `capacidade - ocupação` somente quando a capacidade é
conhecida. A situação do quarto continua manual: não é alterada pela ocupação.
Nota de limpeza continua sem integração. Essas regras não corrigem nem importam
as divergências dos anexos privados.

Foram recebidos um PDF de controle de vagas e um ZIP contendo **sete abas em
HTML, sem XLSX**. O solicitante confirmou que os **300 lugares do PDF representam
capacidade total**, não vagas livres. Os documentos oferecem referência parcial
de estrutura e ocupação; não incluem matrícula, nascimento, responsáveis legais
ou telefones.

**Precedência de projeto em 30/09/2026:** o solicitante reiterou a orientação
de usar o documento com maior capacidade dos quartos. Na comparação recebida,
o ZIP/planilha detalhada traz as maiores capacidades nos locais divergentes:
Residência 4, 66 frente a 64 no PDF; Laticínio, 10 frente a 8. O projeto adota
as capacidades detalhadas do ZIP nesses casos, mantendo o PDF como referência
complementar de inventário ausente no ZIP parcial. Isso não transforma os 300
lugares do PDF em capacidades por quarto e não inventa quartos ou distribuições
ausentes. As diferenças continuam registradas para conferência e homologação:

| Referência   | Divergência e tratamento no projeto                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Residência 4 | PDF: 64; ZIP: 66. Capacidades detalhadas do ZIP são a referência escolhida; origem da diferença e homologação permanecem para conferência.             |
| Laticínio    | PDF: 8; ZIP: 10. Capacidades detalhadas do ZIP são a referência escolhida; origem da diferença e homologação permanecem para conferência.              |
| Residência 3 | PDF: 12 quartos; ZIP: 5 quartos listados. Inventário complementar no PDF; identificação e capacidade dos quartos ausentes continuam por conferir.      |
| R4-21        | ZIP: 5 ocupantes para capacidade de 4. Capacidade indicada não é aumentada pelo número de ocupantes; divergência histórica preservada, sem importação. |
| Zootecnia 3  | PDF: 3 quartos com 2 lugares, mas total de 8. Distribuição e total correto continuam por conferir; não distribuir a diferença por inferência.          |

O fluxo provisório local não define reserva de vaga, exceções a lotação,
correção de histórico, migração de ocupantes existentes ou transições
automáticas. Essas políticas, as lacunas do inventário e a homologação das
capacidades continuam pendentes da AE. A precedência escolhida não autoriza
importar ocupantes reais. Não há aceite nominal da AE/TI nem homologação da Fase 2.

**Responsável / até a fase:** AE; revisão das capacidades e regras antes da
homologação da Fase 2. A estrutura e o fluxo provisório de alocação receberam
[aceite técnico local](../fase-2/QA.md) em 29/09/2026. As provas pelo navegador
em PostgreSQL verificaram cadastro, capacidade editável, vínculo ativo,
transferência, encerramento, conflitos e persistência após reinício; não são
aceite da AE/TI.

**Evidência:** PRD §E04, AC14 e §23.2; [fatia estrutural da Fase 2](../fase-2/README.md);
plano estrutural e regra provisória de alocação autorizados pelo solicitante em
29/09/2026; orientação de precedência reiterada pelo solicitante em 30/09/2026,
aplicada pela comparação das capacidades detalhadas; anexos privados
`Controle de Vagas das Residências Estudantis 2026.xlsx - Vagas Residências Est. 2026.pdf`
e `RESIDÊNCIAS ESTUDANTIS 2026_1.xlsx.zip`, recebidos na conversa e usados como
referência, sem nomes ou dados pessoais reproduzidos neste registro.

## D20 — Exportações por perfil, dados sensíveis, colunas e filtros; E14, RF011/UC11.

**Estado atual e encaminhamento:** **Institucional pendente.** Não assumir que a
restrição a gestor vista no protótipo substitui o texto RF/UC.

**Responsável / até a fase:** AE; Fase 6.

**Evidência:** PRD §E14 e §23.2; roteiro F6.

## D21 — Mecanismo, atributos e ciclo da conta institucional; E01, RF001/UC01.

**Estado atual e encaminhamento:** **Login próprio do SAGER escolhido pelo
solicitante em 30/09/2026; operação institucional e homologação pendentes.**
O mecanismo escolhido é conta própria do SAGER com e-mail e senha. Integrações
com SUAP ou Google foram adiadas e não são dependência do login desta etapa.
Por decisão do solicitante em 26/09/2026, a antiga prova Google
OIDC foi descontinuada como mecanismo ativo. Para desenvolvimento e teste, o projeto
adota login local provisório por e-mail e senha própria do SAGER, com contas e perfis
criados por operador, sessão no servidor e acesso limitado ao ambiente local. O
e-mail identifica a conta de teste; seu domínio não concede perfil. A prova Google
anterior passou em 16 testes sintéticos, mas jamais comprovou acesso institucional.
O login local também **não** comprova identidade institucional nem fecha AC01/AC02
ou AT03 no uso institucional. A antiga dependência de homologar Google ou outro
provedor externo foi substituída pela escolha de login próprio; SUAP e Google
não bloqueiam esta etapa. Provisionamento institucional, verificação da identidade, recuperação
de senha, mudança de perfil e desligamento ainda exigem definição e implementação
para uso real. **A Fase 0 não está homologada sem prova institucional do mecanismo escolhido e
aceite TI/AE.**

**Responsável / até a fase:** TI/AE; decisão e prova institucional pendentes da
Fase 0, dependência da Fase 1; mecanismo escolhido pelo solicitante.

**Evidência:** PRD §E01 e §23.2; especificação §6; roteiro F0–F1; decisão do
solicitante de 26/09/2026 e escolha do login próprio em 30/09/2026;
[contrato local](AUTENTICACAO_LOCAL.md),
[registro histórico da prova Google](AUTENTICACAO_GOOGLE.md) e [QA técnico](QA.md).

## D22 — Acesso a dados, retenção, descarte e objetivos de recuperação; proteção transversal.

**Estado atual e encaminhamento:** **Compartilhamento entre profissionais de
saúde e retenção permanente da auditoria definidos pelo solicitante em
30/09/2026; governança e homologação institucional pendentes.** O compartilhamento
de dados de saúde entre profissionais de saúde é permitido. Categorias de dados,
escopo por profissão e vínculo de atendimento, operações e concessão/revogação
de acesso continuam por detalhar. Não há API médica implementada.

Os registros de auditoria devem ser guardados permanentemente. Essa decisão
abrange a auditoria; não define retenção permanente dos cadastros, prontuários,
documentos ou backups. Retenção e descarte desses outros dados, frequência,
destino, RPO e RTO dos backups continuam pendentes. Backup conjunto de PostgreSQL
e arquivos com restauração ensaiada é desenho técnico.

Em 26/09/2026, o solicitante informou que somente
profissionais de saúde poderão acessar dados sensíveis, respeitando o sigilo
próprio de cada profissão, como no atendimento psicológico. A permissão de
compartilhamento de 30/09/2026 mantém o acesso restrito a profissionais de saúde;
não concede acesso médico pelo perfil geral de gestor ou supervisor. Os anexos
de alojamentos recebidos em 29/09/2026 não especificam essas permissões.

**Responsável / até a fase:** AE/TI; entrada sensível da Fase 1 e Fase 7.

**Evidência:** PRD §21 e §23.2; especificação §11–12; roteiro F1/F7;
esclarecimento do solicitante em 26/09/2026 e decisões do solicitante em
30/09/2026 sobre compartilhamento e retenção permanente da auditoria, sem aceite
institucional registrado.

## D23 — Escopo de “relatórios offline” e contingência; E14 e operação.

**Estado atual e encaminhamento:** **Institucional pendente.** Definir forma de
degradação; não presumir aplicativo inteiro offline.

**Responsável / até a fase:** AE/TI; Fase 7.

**Evidência:** PRD §21.3 e §23.2; roteiro F7.

## D24 — Cenário de carga e método de medição na VPS; metas técnicas AT.

**Estado atual e encaminhamento:** **Institucional pendente.** Os limites da SRS
são metas, não medição já realizada; TI deve definir concorrência, cenários e
fronteira dos 2 segundos.

**Responsável / até a fase:** TI/AE; Fase 7.

**Evidência:** PRD §23.2; especificação §1.2/§13; roteiro F7.

## D25 — Licenças, contratação, orçamento e uso de provedores externos; E09 e operação.

**Estado atual e encaminhamento:** **Institucional pendente.** Twilio é
**recomendação de projeto para integração futura de WhatsApp**, por API e
sandbox; não é fornecedor de produção aprovado. Produção depende de
cadastro/verificação Meta e da avaliação institucional de custos, termos e
licenças. O desenho anterior cita Meta direta e Clicksign como referências, a
conciliar antes da Fase 4.

**Responsável / até a fase:** Instituição/TI; antes de contratar/ativar a
Fase 4.

**Evidência:** PRD §23.2; especificação §8.1/§17; roteiro F4; decisão do
solicitante nesta Fase 0.

## D26 — Diagramas e modelo físico após a homologação dos fluxos; domínio transversal.

**Estado atual e encaminhamento:** **Institucional pendente.** Atualizar
vínculos, estados, mensagens, assinaturas, ciência e termos conforme decisões
aprovadas; retirar penalidades antigas incompatíveis.

**Responsável / até a fase:** AE/TI; consolidar até a Fase 7.

**Evidência:** PRD §23.2; roteiro F7.

## Como fechar uma decisão

O [pacote de revisão da AE/TI](../fase-2/PACOTE_AE_TI.md) reúne D01, D02, D15,
D19 e D22, explicita a dependência D21 e oferece um formulário de evidência ainda
sem preenchimento institucional. Preparar esse pacote não registra homologação.

Para cada ID, registrar neste registro ou em ata vinculada: **opção aprovada**,
**responsável institucional nominal**, **data**, **justificativa e evidência**,
**requisito afetado** e **versão do PRD**. Alterações que afetem contrato, dados
ou estados devem atualizar a especificação, o modelo, os testes e o roteiro de
homologação. Uma credencial disponível ou uma simulação não equivale a aprovação
institucional; uma escolha de fornecedor para estudo não autoriza contratação ou
tratamento de dados reais.
