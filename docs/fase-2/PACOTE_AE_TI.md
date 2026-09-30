# Pacote de decisões para revisão da AE/TI — Fase 2

**Preparação:** 29/09/2026. **Estado:** preparado para revisão, sem aceite
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

| Material                                                           | Uso na revisão                                   |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| [PRD v2.0, seção 23](../../SAGER_PRD_v2.0_Angular_SpringBoot.md)   | Requisitos e decisões D01–D26                    |
| [Registro de decisões](../fase-0/DECISOES.md)                      | Estado de cada decisão e origem das orientações  |
| [Contrato das cinco fatias](README.md)                             | Comportamento e limites atualmente implementados |
| [QA da Fase 2](QA.md)                                              | Verificações técnicas, resultados e limitações   |
| [Especificação técnica](../../SAGER_Especificacao_Tecnica_v2.0.md) | Desenho técnico e critérios de verificação       |
| [Roteiro de implementação](../ROADMAP_IMPLEMENTACAO.md)            | Dependências e critérios das fases seguintes     |

**D01, D02, D15, D19 e D22 permanecem institucionalmente pendentes. D21 também
permanece pendente e condiciona o acesso institucional.** Este documento não
registra contato, envio, escolha aprovada, assinatura ou data de homologação.

## D01 — Perfis, permissões e provisionamento

**Fato preliminar:** o solicitante informou que os servidores da GAE, inclusive
profissionais de saúde, poderão consultar dados não sensíveis. Essa orientação
ainda precisa de uma matriz institucional por recurso, operação e vínculo.
Ela não estabelece acesso médico pelo perfil de gestor ou supervisor.

### Matriz implementada apenas no ambiente local

| Recurso ou operação                   | Gestor local                                     | Supervisor local                | Residente local                 |
| ------------------------------------- | ------------------------------------------------ | ------------------------------- | ------------------------------- |
| Cadastro funcional de supervisores    | Consulta, cadastro e edição                      | Sem acesso à API                | Sem acesso à API                |
| Residentes e responsáveis             | Consulta, cadastro e edição                      | Consulta                        | Sem acesso à API                |
| Alojamentos, unidades, quartos e mapa | Consulta, cadastro e edição                      | Consulta                        | Sem acesso à API                |
| Vínculos e histórico de alocação      | Consulta, alocação, transferência e encerramento | Consulta                        | Sem acesso à API                |
| Dados médicos ou prontuários          | Nenhuma API médica implementada                  | Nenhuma API médica implementada | Nenhuma API médica implementada |

As APIs exigem sessão; alterações exigem CSRF e controle de versão quando
aplicável. Fora do perfil `local`, as rotas permanecem fechadas. O domínio do
e-mail não concede perfil. O operador cria contas locais pela CLI com perfil
explícito; cadastrar um supervisor ou residente não cria conta de acesso.

**Escolhas a registrar pela AE/TI:**

1. Identificar funções institucionais e permitir ou restringir cada operação
   da matriz, incluindo o cadastro funcional de supervisores.
2. Definir se a consulta e as alterações têm limites por alojamento, turno,
   atribuição ou outro vínculo; identificar o acesso do residente aos próprios
   dados em fluxos futuros.
3. Definir quem concede, revisa e revoga perfis, como provisionar o gestor e
   qual procedimento tratará mudança de função e desligamento.
4. Aprovar a separação entre dados não sensíveis e dados de saúde conforme D22.

**Escopo condicionado:** homologação das permissões e qualquer acesso
institucional. A matriz local continua sendo uma regra provisória de
desenvolvimento. **Encaminhamento proposto:** AE/TI.

## D02 — Cadastro, matrícula e ciclo do residente

**Implementado provisoriamente:** digitação pelo gestor, UUID estável, nome e
matrícula obrigatórios, nascimento e curso opcionais. Matrícula é texto, com
espaços das pontas removidos, inclusive espaços Unicode, e unicidade sem
diferenciar maiúsculas/minúsculas. Não há formato universal inferido dos exemplos
de 16/17 posições. Nascimento informado deve ser válido e não futuro; nascimento
ausente mantém a idade desconhecida e não comprova maioridade. A matrícula é
independente do login local.

**Escolhas a registrar pela AE/TI:**

1. Selecionar a fonte do cadastro institucional: digitação validada, planilha,
   integração com sistema institucional ou outro processo identificado.
2. Aprovar o dicionário: campos obrigatórios, formato e unicidade da matrícula,
   fonte de comprovação e responsável pela validação. Os anexos de alojamentos
   não fornecem matrícula nem nascimento.
3. Definir correções, desligamento, reingresso e preservação do histórico sem
   trocar a identidade estável do registro por um login ou por uma matrícula.
4. Definir como comprovar nascimento e maioridade e o comportamento dos fluxos
   dependentes de idade quando a informação estiver ausente ou não validada.

**Escopo condicionado:** fonte e validade institucional do cadastro; fechamento
do requisito de vínculo de matrícula (AC07) e operações dependentes de idade.
A unicidade local não comprova vínculo institucional. **Encaminhamento
proposto:** AE/TI.

## D15 — Responsáveis, vínculo e destinatário autorizado

**Implementado provisoriamente:** um residente pode ter vários responsáveis;
cada registro tem UUID, nome, vínculo declarado, telefone opcional, estado ativo
obrigatório e versão. Não há prioridade de contato nem quantidade máxima
presumida. O cadastro ativo não comprova guarda, identidade, autorização para
saída ou validade de assinatura. O solicitante esclareceu que as configurações
podem incluir detentor da guarda, ambos os pais, somente a mãe, somente o pai
ou outra configuração legalmente válida.

**Escolhas a registrar pela AE/TI:**

1. Aprovar as configurações de vínculo admitidas e o procedimento para comprovar,
   atualizar e inativar cada responsável, com indicação de quem faz a conferência.
2. Definir cardinalidade, prioridade e tratamento de divergências entre
   responsáveis; distinguir cadastro de autorização para cada operação.
3. Definir confirmação de identidade, validade e atualização do telefone antes
   de qualquer contato ou envio de documento.
4. Definir o critério de escolha do destinatário autorizado e do signatário.
   Esse ponto pode ser adiado para a Fase 4 com restrição explícita: nenhum envio
   ou fluxo de assinatura será ativado sem a decisão correspondente.

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

### Cinco divergências do inventário para conferência da AE

As referências recebidas em 29/09/2026 são um PDF de controle de vagas e um ZIP
com sete abas em HTML, sem XLSX. O solicitante confirmou que **300 lugares no
PDF representam capacidade total**, não vagas livres. Nenhuma das divergências
abaixo foi resolvida por escolha automática de fonte ou alteração de capacidade.

| Referência   | PDF                                            | ZIP                                       | Resposta necessária                                          |
| ------------ | ---------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| Residência 4 | 64 lugares                                     | Capacidades somam 66                      | Capacidade oficial e origem da diferença                     |
| Laticínio    | 8 lugares                                      | Capacidades somam 10                      | Capacidade oficial e origem da diferença                     |
| Residência 3 | 12 quartos                                     | 5 quartos listados                        | Inventário completo e quartos efetivamente utilizáveis       |
| R4-21        | —                                              | 5 ocupantes para capacidade indicada de 4 | Capacidade oficial e procedimento para o registro divergente |
| Zootecnia 3  | 3 quartos × 2 lugares, mas total indicado de 8 | —                                         | Quantidade e capacidade de cada quarto; total correto        |

**Escolhas a registrar pela AE:**

1. Validar inventário, códigos, localizações e capacidades oficiais, indicando
   a fonte e a correção de cada uma das cinco divergências.
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

**Orientação preliminar:** somente profissionais de saúde acessariam dados
sensíveis, respeitando o sigilo próprio de cada profissão, inclusive no
atendimento psicológico. Isso não define acesso irrestrito entre profissionais
de saúde. Nenhuma API médica foi implementada; gestor e supervisor não recebem
acesso médico por seus perfis locais. Backup conjunto de PostgreSQL e arquivos
com restauração ensaiada é desenho técnico sujeito à política institucional.

**Escolhas a registrar pela AE/TI:**

1. Classificar dados não sensíveis e sensíveis, aprovar finalidades e operações
   permitidas por profissão e vínculo de atendimento, inclusive os limites entre
   profissões e a trilha necessária para consulta e alteração.
2. Definir responsáveis pela concessão/revogação de acesso e pelo atendimento
   de incidentes, correções e solicitações relativas aos dados.
3. Aprovar retenção, descarte, frequência e destino dos backups de banco e
   arquivos; definir objetivo de perda máxima de dados (RPO), tempo de recuperação
   (RTO), responsáveis e evidência de restauração.

**Escopo condicionado:** tratamento de dados sensíveis e governança para uso
institucional; aceite operacional da Fase 7. Os anexos de alojamentos não
resolvem essas escolhas. **Encaminhamento proposto:** AE/TI.

## Dependência D21 — Autenticação institucional

O mecanismo institucional e seus atributos continuam indefinidos. O login por
e-mail e senha própria do SAGER é provisório, com conta criada por operador,
sessão no servidor e uso restrito ao ambiente local. A prova Google anterior
foi descontinuada como mecanismo ativo; seus testes sintéticos não comprovaram
acesso institucional. O login local também não fecha AC01/AC02 ou AT03.

A TI/AE ainda precisa definir provedor/mecanismo, atributos estáveis,
provisionamento, mudança de perfil e desligamento, além de realizar a prova
institucional. Aceitar as regras cadastrais deste pacote não homologa D21
nem libera o SAGER para operação institucional.

## Limites do escopo disponível para revisão

- Dados e contas das demonstrações, dos testes e das provas são sintéticos;
  nomes, dados pessoais, credenciais e anexos privados não são material de carga
  nem são reproduzidos neste pacote.
- O cadastro funcional não cria conta e o cadastro de responsável não comprova
  vínculo legal nem seleciona signatário.
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
