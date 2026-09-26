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

## Como fechar uma decisão

Para cada ID, registrar neste registro ou em ata vinculada: **opção aprovada**,
**responsável institucional nominal**, **data**, **justificativa e evidência**,
**requisito afetado** e **versão do PRD**. Alterações que afetem contrato, dados
ou estados devem atualizar a especificação, o modelo, os testes e o roteiro de
homologação. Uma credencial disponível ou uma simulação não equivale a aprovação
institucional; uma escolha de fornecedor para estudo não autoriza contratação ou
tratamento de dados reais.
