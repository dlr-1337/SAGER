# Fase 0 do backend — estado e evidências

**Registro inicial:** 2026-09-25 · **Revisão do login:** 2026-09-26 · **Branch de
trabalho:** `backend` · **Estado:** login local provisório com aceite técnico local;
**homologação institucional e Fase 0 pendentes**.

Este diretório detalha a [Fase 0 do roteiro](../ROADMAP_IMPLEMENTACAO.md). Ele registra
o que foi escolhido para o projeto e o que depende de decisão da Assistência Estudantil
(AE), da TI ou da instituição. Nenhuma escolha técnica aqui concede autorização
institucional por si só.

| Item                                                  | Evidência atual                                                                                                                                                                                                                                                 | Pendência para a saída homologada                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [Versões e ambiente](VERSOES_E_AMBIENTE.md)           | Node 24.19.0 e Angular 22.2.0 verificados; Temurin 21.0.12.1+1 instalado. Spring Boot 4.1.1, PostgreSQL 17.11 e Maven Wrapper 3.9.16 executados na prova local. Docker Desktop 4.92.0.240144 passou no reinício e em uma partida fria; Engine 29.8.0 respondeu. | Revalidar o daemon em cada sessão e consolidar os ambientes da Fase 1.                                             |
| [Login local provisório](AUTENTICACAO_LOCAL.md)       | Backend e Angular integrados para desenvolvimento e teste, com contas criadas por operador e sessão no servidor. Testes e prova integrada constam no [QA](QA.md).                                                                                               | Decidir o provedor institucional e obter prova real e aceite TI/AE.                                                |
| [Prova Google OIDC histórica](AUTENTICACAO_GOOGLE.md) | A antiga prova passou em 16 testes sintéticos em 25/09/2026, sem login institucional real. Google foi retirado da implementação ativa por decisão posterior.                                                                                                    | Guardar apenas como evidência histórica; não é mecanismo vigente nem homologação.                                  |
| [WhatsApp e assinatura](INTEGRACOES.md)               | Meta direta, Twilio e opção via WhatsApp Web comparadas; Twilio recomendado para exploração futura. Modalidades de assinatura listadas.                                                                                                                         | Conta, contratação, operação, modalidade válida de assinatura e regras D15–D17/D25 dependem da instituição.        |
| [Decisões D01–D26](DECISOES.md)                       | 26 itens registrados com requisito, estado, responsável proposto, fase e evidência.                                                                                                                                                                             | Obter valores aprovados, responsáveis institucionais nominais, datas e evidências formais conforme a fase afetada. |
| [QA da Fase 0](QA.md)                                 | Histórico de 25/09/2026 e aceite técnico local de 26/09/2026 registrados com testes automatizados e prova em navegador real.                                                                                                                                    | Executar separadamente a prova institucional futura.                                                               |

## Portões ainda abertos

- **D21:** o provedor institucional não foi escolhido ou homologado. O login local
  pode receber aceite técnico de desenvolvimento, mas não fecha AC01/AC02, AT03 nem
  homologa a Fase 0. Faltam decisão e teste institucional, política de sessão e
  desligamento, e aceite com responsável, data e referência da TI/AE.
- **D01 e D02:** perfis funcionais e dicionário cadastral precisam de aprovação AE/TI.
  O login provisório não fornece matrícula; sua origem e validação ficaram para
  decisão posterior. A fatia de cadastro de residente prevista na Fase 1 depende
  dessa decisão.
- **D16/D25:** não há conta de WhatsApp, fornecedor contratado ou modalidade/serviço de
  assinatura escolhidos para produção. Uma saída longa continua sem aprovação possível
  até existir assinatura válida e documento assinado armazenado, conforme o PRD.

As verificações históricas demonstram apenas a antiga prova sintética, não a
homologação do login institucional ou dos fluxos do produto. Nenhuma credencial,
token, conta pessoal ou dado real de residente deve integrar os registros.
