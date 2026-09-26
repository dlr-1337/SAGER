# Registro de decisões da Fase 0

**Registro:** 25/09/2026. **Base funcional:**
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
formalizada; uma proposta técnica não a substitui.

## D01 — Matriz de perfis, permissões e provisionamento do gestor; E01–E03, RF002, UC01/UC015.

**Estado atual e encaminhamento:** **Institucional pendente.** O projeto prevê
perfis locais explícitos e autorização no servidor, mas não atribui perfil pelo
domínio do e-mail nem presume acesso do gestor a dados médicos.

**Responsável / até a fase:** AE/TI; entrada da Fase 1.

**Evidência:** PRD §2.2–2.3 e §23.1; roteiro F0–F1.

## D02 — Dicionário cadastral, campos, unicidade, matrícula, desligamento e maioridade; E02, RF002, UC015.

**Estado atual e encaminhamento:** **Adiada a origem da matrícula pelo
solicitante; homologação pendente.** O login Google padrão não entrega
matrícula. A fatia de cadastro de residente da Fase 1 deve aguardar decisão de
dados e vínculo, sem inventar matrícula ou regra de validação.

**Responsável / até a fase:** AE/TI; antes da fatia cadastral da Fase 1 e da
Fase 2.

**Evidência:** PRD §E02 e §23.1; roteiro F1–F2; decisão do solicitante nesta
Fase 0.

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

**Estado atual e encaminhamento:** **Institucional pendente.** Definir vínculo
ativo, autorização e destinatário antes do envio ao responsável.

**Responsável / até a fase:** AE/TI; Fases 2 e 4.

**Evidência:** PRD §E02, §E09 e §23.2; roteiro F2/F4.

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

## D19 — Unicidade, capacidade, alocação e estados dos quartos; E04, UC16.

**Estado atual e encaminhamento:** **Institucional pendente.** O número único
exigido pelo UC16 não resolve sozinho ocupação parcial nem movimentação de
residentes.

**Responsável / até a fase:** AE; antes da Fase 2.

**Evidência:** PRD §E04 e §23.2; roteiro F2.

## D20 — Exportações por perfil, dados sensíveis, colunas e filtros; E14, RF011/UC11.

**Estado atual e encaminhamento:** **Institucional pendente.** Não assumir que a
restrição a gestor vista no protótipo substitui o texto RF/UC.

**Responsável / até a fase:** AE; Fase 6.

**Evidência:** PRD §E14 e §23.2; roteiro F6.

## Como fechar uma decisão

Para cada ID, registrar neste registro ou em ata vinculada: **opção aprovada**,
**responsável institucional nominal**, **data**, **justificativa e evidência**,
**requisito afetado** e **versão do PRD**. Alterações que afetem contrato, dados
ou estados devem atualizar a especificação, o modelo, os testes e o roteiro de
homologação. Uma credencial disponível ou uma simulação não equivale a aprovação
institucional; uma escolha de fornecedor para estudo não autoriza contratação ou
tratamento de dados reais.
