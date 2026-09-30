# Pacote de decisões para revisão da AE/TI — Fase 2

**Preparação:** 29/09/2026. **Atualização:** 30/09/2026.
**Estado:** respostas do solicitante registradas e lacunas detalhadas, sem aceite
institucional registrado. **Destinatários propostos:** Assistência Estudantil
(AE) e equipe de tecnologia (TI); responsáveis nominais ainda não informados.

## Objetivo e material de referência

Este pacote reúne as escolhas necessárias para homologar os cadastros e o mapa
do SAGER. As regras locais autorizadas pelo solicitante já foram implementadas
nas cinco fatias: supervisores; alojamentos, unidades e quartos; residentes;
responsáveis; e alocação com histórico. Os
[aceites técnicos e suas evidências](QA.md) usam PostgreSQL, contas e dados
sintéticos. Eles comprovam o comportamento local descrito, sem comprovar
identidade institucional ou autorizar uso de dados reais.

### Respostas do solicitante em 30/09/2026

| Decisão | Escolha de projeto registrada                                                                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01     | Supervisor é a autoridade máxima na gestão; pode consultar, cadastrar, editar e movimentar os recursos existentes, com as mesmas operações do gestor.                                          |
| D02     | Cadastro manual pelo gestor; supervisor também pode cadastrar. Nome, matrícula e nascimento obrigatórios nas novas gravações; SUAP adiado por falta de autorização.                            |
| D15     | Na saída longa, basta uma assinatura válida de qualquer responsável cadastrado e vinculado ao residente; não são exigidos ambos.                                                               |
| D19     | Pela orientação de usar o documento com maior capacidade, as capacidades detalhadas do ZIP/planilha prevalecem em Residência 4 e Laticínio; PDF complementa inventário ausente no ZIP parcial. |
| D21     | Login próprio do SAGER; integrações com SUAP ou Google adiadas.                                                                                                                                |
| D22     | Compartilhamento entre profissionais de saúde permitido; registros de auditoria guardados permanentemente.                                                                                     |

Essas respostas substituem as escolhas provisórias anteriores nos pontos
respondidos. Registros legados de residentes sem nascimento são preservados,
mas novas gravações e edições exigem a data. Não se atribuem datas inventadas.
Retenção permanente foi definida para a auditoria; a retenção dos demais dados
e dos backups continua por definir. Compartilhamento de saúde mantém acesso
restrito a profissionais de saúde, com limites ainda por detalhar.

| Material                                                           | Uso na revisão                                   |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| [PRD v2.0, seção 23](../../SAGER_PRD_v2.0_Angular_SpringBoot.md)   | Requisitos e decisões D01–D26                    |
| [Registro de decisões](../fase-0/DECISOES.md)                      | Estado de cada decisão e origem das orientações  |
| [Contrato das cinco fatias](README.md)                             | Comportamento e limites atualmente implementados |
| [QA da Fase 2](QA.md)                                              | Verificações técnicas, resultados e limitações   |
| [Especificação técnica](../../SAGER_Especificacao_Tecnica_v2.0.md) | Desenho técnico e critérios de verificação       |
| [Roteiro de implementação](../ROADMAP_IMPLEMENTACAO.md)            | Dependências e critérios das fases seguintes     |

**D01, D02, D15, D19, D21 e D22 ainda não têm homologação institucional registrada.**
O login próprio já foi escolhido pelo solicitante; seu uso institucional exige
as entregas e definições de operação correspondentes. Este documento registra
as escolhas do solicitante, sem registrar contato, envio, assinatura, manifestação
formal da AE/TI ou data de homologação.

## D01 — Perfis, permissões e provisionamento

**Escolha de 30/09/2026:** supervisor é a autoridade máxima na gestão, com
permissão para todas as operações de gestão existentes. O gestor conserva
essas operações. A resposta substitui a restrição anterior de escrita somente
pelo gestor, inclusive para o cadastro funcional de supervisores.

Em 26/09/2026, o solicitante informou que os servidores da GAE, inclusive
profissionais de saúde, poderão consultar dados não sensíveis. Essa orientação
ainda precisa de uma matriz institucional por recurso, operação e vínculo.
Ela não estabelece acesso médico pelo perfil de gestor ou supervisor.

### Matriz de gestão atualizada para o ambiente local

| Recurso ou operação                   | Gestor local                                     | Supervisor local                                 | Residente local                 |
| ------------------------------------- | ------------------------------------------------ | ------------------------------------------------ | ------------------------------- |
| Cadastro funcional de supervisores    | Consulta, cadastro e edição                      | Consulta, cadastro e edição                      | Sem acesso à API                |
| Residentes e responsáveis             | Consulta, cadastro e edição                      | Consulta, cadastro e edição                      | Sem acesso à API                |
| Alojamentos, unidades, quartos e mapa | Consulta, cadastro e edição                      | Consulta, cadastro e edição                      | Sem acesso à API                |
| Vínculos e histórico de alocação      | Consulta, alocação, transferência e encerramento | Consulta, alocação, transferência e encerramento | Sem acesso à API                |
| Dados médicos ou prontuários          | Nenhuma API médica implementada                  | Nenhuma API médica implementada                  | Nenhuma API médica implementada |

As APIs exigem sessão; alterações exigem CSRF e controle de versão quando
aplicável. Fora do perfil `local`, as rotas permanecem fechadas. O domínio do
e-mail não concede perfil. O operador cria contas locais pela CLI com perfil
explícito; cadastrar um supervisor ou residente não cria conta de acesso.

**Detalhes ainda necessários para uso institucional:**

1. Identificar como as funções institucionais se vinculam às contas e quem
   confere esse vínculo, conforme as permissões de gestão já escolhidas.
2. Identificar o acesso do residente aos próprios dados em fluxos futuros e
   os limites dos demais perfis ainda não abrangidos pela gestão atual.
3. Definir quem concede, revisa e revoga perfis, como provisionar gestor e supervisor e
   qual procedimento tratará mudança de função e desligamento.
4. Aprovar a separação entre dados não sensíveis e dados de saúde conforme D22.

**Escopo condicionado:** homologação das permissões e qualquer acesso
institucional. A matriz registra a escolha de projeto para o ambiente local;
o aceite formal continua sem evidência. **Encaminhamento proposto:** AE/TI.

## D02 — Cadastro, matrícula e ciclo do residente

**Escolha de 30/09/2026 e contrato atualizado:** digitação manual pelo gestor,
também permitida ao supervisor; UUID estável; nome, matrícula e nascimento
obrigatórios nas novas gravações e edições; curso opcional. A integração com
SUAP está adiada porque não há autorização. Matrícula é texto, com
espaços das pontas removidos, inclusive espaços Unicode, e unicidade sem
diferenciar maiúsculas/minúsculas. Não há formato universal inferido dos exemplos
de 16/17 posições. Nascimento deve ser válido e não futuro. O contrato anterior
permitia ausência: os registros legados são preservados sem inventar datas,
mas sua edição exige nascimento. Ausência legada mantém a idade desconhecida
e não comprova maioridade. A matrícula é
independente do login local.

**Detalhes ainda necessários para uso institucional:**

1. Informar quem confere o cadastro manual e quais documentos comprovam
   matrícula e nascimento.
2. Confirmar formato institucional da matrícula e regras dos demais campos
   além dos obrigatórios já escolhidos. Os anexos de alojamentos
   não fornecem matrícula nem nascimento.
3. Definir correções, desligamento, reingresso e preservação do histórico sem
   trocar a identidade estável do registro por um login ou por uma matrícula.
4. Definir como corrigir os registros legados sem nascimento e tratar fluxos
   dependentes de idade enquanto a informação estiver ausente ou não validada.

**Escopo condicionado:** fonte e validade institucional do cadastro; fechamento
do requisito de vínculo de matrícula (AC07) e operações dependentes de idade.
A unicidade local não comprova vínculo institucional. **Encaminhamento
proposto:** AE/TI.

## D15 — Responsáveis, vínculo e destinatário autorizado

**Escolha de 30/09/2026:** uma assinatura válida de qualquer responsável
cadastrado e vinculado ao residente é suficiente para saída longa; não são
exigidas assinaturas de ambos. O destinatário não é escolhido automaticamente
por essa regra. Serviço, modalidade e comprovação da assinatura dependem de D16/D17.

**Cadastro local:** um residente pode ter vários responsáveis;
cada registro tem UUID, nome, vínculo declarado, telefone opcional, estado ativo
obrigatório e versão. Não há prioridade de contato nem quantidade máxima
presumida. O cadastro ativo não comprova guarda, identidade, autorização para
saída ou validade de assinatura. O solicitante esclareceu que as configurações
podem incluir detentor da guarda, ambos os pais, somente a mãe, somente o pai
ou outra configuração legalmente válida.

**Detalhes ainda necessários para a assinatura e o uso institucional:**

1. Aprovar as configurações de vínculo admitidas e o procedimento para comprovar,
   atualizar e inativar cada responsável, com indicação de quem faz a conferência.
2. Definir tratamento de divergências entre responsáveis e eventuais limites
   do cadastro; preservar a regra já escolhida de uma assinatura suficiente.
3. Definir confirmação de identidade, validade e atualização do telefone antes
   de qualquer contato ou envio de documento.
4. Definir quem escolhe qual responsável vinculado receberá o documento para
   assinatura e como essa escolha será registrada. Nenhum envio ou fluxo de
   assinatura foi ativado pela resposta ou por esta fatia.

**Escopo condicionado:** homologação do vínculo e autorização dos responsáveis;
destinatário e assinatura também dependem de D16/D17. A quarta fatia não ativou
WhatsApp, assinatura ou aprovação de saída longa. **Encaminhamento proposto:** AE/TI.

## D19 — Inventário, capacidade e movimentação

**Implementado provisoriamente:** alojamentos com código e nome; unidades
internas opcionais; quartos com código global único, número local textual e piso
opcional. O número local não se repete na mesma combinação de alojamento,
unidade e piso. A capacidade é inteira positiva ou ausente; situação do quarto
é manual. O mapa começa vazio e não importa os anexos privados.

A quinta fatia mantém no máximo um quarto ativo por residente e preserva
histórico de alocação, transferência e encerramento. Nova entrada exige
capacidade definida e vaga e é recusada em Manutenção ou Indisponível. A
capacidade não pode ser apagada enquanto houver ocupantes nem reduzida abaixo
da ocupação ativa. Ocupação
é a contagem de vínculos ativos; vagas livres são `capacidade - ocupação` somente
quando a capacidade é conhecida. A situação manual não muda automaticamente
com a ocupação e a nota de limpeza continua sem integração.

### Precedência das fontes e cinco divergências do inventário

As referências recebidas em 29/09/2026 são um PDF de controle de vagas e um ZIP
com sete abas em HTML, sem XLSX. O solicitante confirmou que **300 lugares no
PDF representam capacidade total**, não vagas livres.

Em 30/09/2026, o solicitante reiterou a orientação de usar o documento com maior
capacidade dos quartos. O ZIP/planilha detalhada apresenta as maiores capacidades
nos locais divergentes: Residência 4, 66; Laticínio, 10. Essas capacidades detalhadas
do ZIP são a referência de projeto escolhida nesses casos. O PDF é referência
complementar para o inventário ausente no ZIP parcial. Os 300 lugares não são
distribuídos por quarto e dados faltantes não são inventados. Não houve importação
de ocupantes ou homologação institucional das capacidades.

| Referência   | PDF                                            | ZIP                                       | Resposta necessária                                                                                 |
| ------------ | ---------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Residência 4 | 64 lugares                                     | Capacidades somam 66                      | ZIP escolhido como referência; conferir origem da diferença e homologar capacidades detalhadas      |
| Laticínio    | 8 lugares                                      | Capacidades somam 10                      | ZIP escolhido como referência; conferir origem da diferença e homologar capacidades detalhadas      |
| Residência 3 | 12 quartos                                     | 5 quartos listados                        | PDF complementa inventário; conferir identificação e capacidade dos quartos ausentes no ZIP         |
| R4-21        | —                                              | 5 ocupantes para capacidade indicada de 4 | Conferir divergência histórica; capacidade não aumenta pelo número de ocupantes e não há importação |
| Zootecnia 3  | 3 quartos × 2 lugares, mas total indicado de 8 | —                                         | Quantidade e capacidade de cada quarto; total correto                                               |

**Escolhas a registrar pela AE:**

1. Validar inventário, códigos, localizações e capacidades oficiais, indicando
   a conferência de cada uma das cinco divergências conforme a precedência já
   escolhida para o projeto; completar as lacunas de Residência 3 e Zootecnia 3.
2. Aceitar ou alterar a regra provisória de um vínculo ativo, capacidade definida,
   limite de lotação e bloqueio de novas entradas em Manutenção/Indisponível.
3. Definir reservas, exceções para ocupação histórica acima do limite e
   procedimento de correção de vínculos, com preservação de evidência.
4. Definir migração dos ocupantes existentes e sua conferência cadastral; decidir
   se haverá transições automáticas de situação do quarto e sua regra.

**Escopo condicionado:** capacidades oficiais, importação, exceções, reservas
e homologação de E04/Fase 2. A regra local não corrige as fontes privadas nem
autoriza inserir ocupantes reais. **Encaminhamento proposto:** AE, com TI para
integridade e migração.

## D22 — Dados sensíveis, retenção e recuperação

**Escolhas de 30/09/2026:** compartilhamento de dados de saúde permitido entre
profissionais de saúde; registros de auditoria guardados permanentemente.
Mantém-se a orientação de 26/09/2026 de que somente profissionais de saúde
acessam dados sensíveis, respeitando o sigilo próprio de cada profissão,
inclusive no atendimento psicológico. Categorias, vínculo de atendimento e
limites do compartilhamento continuam por detalhar.

Nenhuma API médica foi implementada; gestor e supervisor não recebem
acesso médico por seus perfis locais. Backup conjunto de PostgreSQL e arquivos
com restauração ensaiada é desenho técnico sujeito à política institucional.

**Detalhes ainda necessários para uso institucional:**

1. Classificar dados não sensíveis e sensíveis, aprovar finalidades e operações
   permitidas por profissão e vínculo de atendimento, inclusive os limites entre
   profissões e a trilha necessária para consulta e alteração.
2. Definir responsáveis pela concessão/revogação de acesso e pelo atendimento
   de incidentes, correções e solicitações relativas aos dados.
3. Definir retenção e descarte de cadastros, prontuários e documentos e a
   frequência, destino e retenção dos backups de banco e arquivos. A auditoria
   tem retenção permanente; essa escolha não se estende aos demais dados.
   Definir objetivo de perda máxima de dados (RPO), tempo de recuperação
   (RTO), responsáveis e evidência de restauração.

**Escopo condicionado:** tratamento de dados sensíveis e governança para uso
institucional; aceite operacional da Fase 7. Os anexos de alojamentos não
resolvem essas escolhas. **Encaminhamento proposto:** AE/TI.

## Dependência D21 — Login próprio e operação institucional

Em 30/09/2026, o solicitante escolheu login próprio do SAGER e adiou integrações
com SUAP ou Google. O mecanismo desta etapa está definido. O login disponível
para desenvolvimento usa e-mail e senha própria, com conta criada por operador,
sessão no servidor e uso restrito ao ambiente local. A prova Google anterior
foi descontinuada como mecanismo ativo; seus testes sintéticos não comprovaram
acesso institucional. O login local também não fecha AC01/AC02 ou AT03.
As antigas exigências de homologar Google ou selecionar um provedor externo
foram substituídas pela escolha do login próprio; SUAP e Google não bloqueiam
esta etapa.

Restam definir responsáveis e procedimentos de criação de conta, conferência
de identidade, recuperação de senha, mudança de perfil e desligamento, implementar
o ciclo de conta para uso institucional e realizar a prova do mecanismo escolhido.
Aceitar as regras cadastrais deste pacote não homologa D21
nem libera o SAGER para operação institucional.

## Limites do escopo disponível para revisão

- Dados e contas das demonstrações, dos testes e das provas são sintéticos;
  nomes, dados pessoais, credenciais e anexos privados não são material de carga
  nem são reproduzidos neste pacote.
- O cadastro funcional não cria conta. Um responsável cadastrado e vinculado
  pode fornecer a assinatura suficiente de saída longa conforme a escolha do
  solicitante; o cadastro isolado não comprova vínculo legal, identidade ou
  validade da assinatura nem seleciona destinatário.
- Reservas, correção de histórico, migração de ocupantes, exceções de lotação,
  avaliação de limpeza e transições automáticas não integram a quinta fatia.
- Saúde, assinatura, envio a responsáveis, implantação de produção e uso de
  dados reais dependem das decisões e entregas de suas fases.
- O [pipeline de CI](../CI.md) está implementado. Sua execução e seus resultados
  devem ser conferidos no [QA](QA.md); execução técnica não registra aceite AE/TI.

## Formulário de decisão e evidência institucional

**Modelo vazio.** Preencher somente após manifestação institucional verificável.
Para cada decisão, escolher uma situação: aceita para o escopo descrito;
requer alteração; adiada com restrição explícita; ou pendente. Registrar a
regra efetiva, os pontos não decididos e o efeito sobre a liberação. Silêncio,
preparação do pacote, teste aprovado ou aceite técnico não são homologação.

| ID  | Situação institucional | Regra/opção decidida | Escopo aceito e restrições | Responsável nominal e função | Data da decisão | Referência da ata/evidência |
| --- | ---------------------- | -------------------- | -------------------------- | ---------------------------- | --------------- | --------------------------- |
| D01 |                        |                      |                            |                              |                 |                             |
| D02 |                        |                      |                            |                              |                 |                             |
| D15 |                        |                      |                            |                              |                 |                             |
| D19 |                        |                      |                            |                              |                 |                             |
| D22 |                        |                      |                            |                              |                 |                             |
| D21 |                        |                      |                            |                              |                 |                             |

**Detalhamento por decisão — copiar e preencher para cada ID:**

| Campo                                                                    | Registro institucional |
| ------------------------------------------------------------------------ | ---------------------- |
| ID da decisão e requisito/AC afetado                                     |                        |
| Versão do PRD e versão/commit do sistema revisado                        |                        |
| Regra aprovada ou alteração solicitada, com justificativa                |                        |
| Escopo liberado, exceções, restrições e pendências                       |                        |
| Responsável institucional nominal, função e competência para decidir     |                        |
| Data da decisão e referência verificável da ata/evidência                |                        |
| Evidência técnica considerada (referência no QA)                         |                        |
| Ajustes exigidos em contrato, migração, interface, documentação e testes |                        |
| Responsável e critério de conferência dos ajustes                        |                        |

Após receber a evidência, atualizar o [registro de decisões](../fase-0/DECISOES.md),
o PRD e os contratos afetados; executar os ajustes e verificações necessários.
A conclusão de um ID libera somente o escopo explicitamente aceito. A homologação
da Fase 2 exige resolver todas as dependências aplicáveis e registrar o aceite
institucional com evidência.
