# Fase 0 do backend — estado e evidências

**Registro:** 2026-09-25 · **Branch de trabalho:** `backend` · **Estado:** documentação
e prova técnica local preparadas; **homologação institucional do login pendente**.

Este diretório detalha a [Fase 0 do roteiro](../ROADMAP_IMPLEMENTACAO.md). Ele registra
o que foi escolhido para o projeto e o que depende de decisão da Assistência Estudantil
(AE), da TI ou da instituição. Nenhuma escolha técnica aqui concede autorização
institucional por si só.

| Item                                                   | Evidência atual                                                                                                                                                                                                          | Pendência para a saída homologada                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [Versões e ambiente](VERSOES_E_AMBIENTE.md)            | Node 24.19.0 e Angular 22.2.0 verificados; Temurin 21.0.12.1+1 instalado. Spring Boot 4.1.1, PostgreSQL 17.11 e Maven Wrapper 3.9.16 agora executados na prova local. Docker Desktop respondeu como daemon Linux 29.8.0. | Consolidar a fundação e os ambientes completos na Fase 1.                                                                                      |
| [Contrato e prova Google OIDC](AUTENTICACAO_GOOGLE.md) | Prova mínima implementada em [`backend/`](../../backend/README.md); 16 testes sintéticos passaram, inclusive banco real e servidor HTTP.                                                                                 | Confirmar cliente/URI/política Workspace com TI; executar login real de servidor, estudante e conta sem perfil; registrar `hd` e aceite TI/AE. |
| [WhatsApp e assinatura](INTEGRACOES.md)                | Meta direta, Twilio e opção via WhatsApp Web comparadas; Twilio recomendado para exploração futura. Modalidades de assinatura listadas.                                                                                  | Conta, contratação, operação, modalidade válida de assinatura e regras D15–D17/D25 dependem da instituição.                                    |
| [Decisões D01–D26](DECISOES.md)                        | 26 itens registrados com requisito, estado, responsável proposto, fase e evidência.                                                                                                                                      | Obter valores aprovados, responsáveis institucionais nominais, datas e evidências formais conforme a fase afetada.                             |
| [QA da Fase 0](QA.md)                                  | Formatação, links, decisões, ambiente, frontend e prova técnica do backend verificados.                                                                                                                                  | Reexecutar os cenários com contas e aprovação institucionais.                                                                                  |

## Portões ainda abertos

- **D21:** não houve login real. A existência de um cliente web foi informada pelo
  solicitante, mas suas credenciais locais, URI cadastrada e autorização no Google
  Workspace ainda não foram comprovadas neste projeto. A Fase 0 não está homologada
  sem o teste institucional e o aceite TI/AE; AC01/AC02/AT03 continuam pendentes.
- **D01 e D02:** perfis funcionais e dicionário cadastral precisam de aprovação AE/TI.
  Matrícula não faz parte do login Google padrão e ficou para decisão posterior. A fatia
  de cadastro de residente prevista na Fase 1 depende dessa decisão.
- **D16/D25:** não há conta de WhatsApp, fornecedor contratado ou modalidade/serviço de
  assinatura escolhidos para produção. Uma saída longa continua sem aprovação possível
  até existir assinatura válida e documento assinado armazenado, conforme o PRD.

As verificações locais demonstram o funcionamento da prova sintética, não a
homologação do login institucional ou dos fluxos do produto. Nenhuma credencial,
token, conta pessoal ou dado real de residente foi adicionado aos registros.
