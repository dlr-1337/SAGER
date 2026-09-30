# Fase 0 do backend — estado e evidências

**Registro inicial:** 2026-09-25 · **Decisões atualizadas:** 2026-09-30 · **Estado:**
login próprio do SAGER escolhido, implementação ainda restrita ao perfil `local`;
**implantação operacional e homologação da Fase 0 pendentes**.

Este diretório detalha a [Fase 0 do roteiro](../ROADMAP_IMPLEMENTACAO.md). Ele registra
o que foi escolhido para o projeto e o que depende de decisão da Assistência Estudantil
(AE), da TI ou da instituição. Nenhuma escolha técnica aqui concede autorização
institucional por si só.

| Item                                                  | Evidência atual                                                                                                                                                                                                                                                 | Pendência para a saída homologada                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [Versões e ambiente](VERSOES_E_AMBIENTE.md)           | Node 24.19.0 e Angular 22.2.0 verificados; Temurin 21.0.12.1+1 instalado. Spring Boot 4.1.1, PostgreSQL 17.11 e Maven Wrapper 3.9.16 executados na prova local. Docker Desktop 4.92.0.240144 passou no reinício e em uma partida fria; Engine 29.8.0 respondeu. | Revalidar o daemon em cada sessão e consolidar os ambientes da Fase 1.                                                  |
| [Login próprio do SAGER](AUTENTICACAO_LOCAL.md)       | E-mail e senha escolhidos em 30/09/2026. Backend e Angular integrados no perfil `local`, com contas criadas por operador e sessão no servidor. A prova técnica anterior consta no [QA](QA.md).                                                                  | Implementar e verificar segurança, provisionamento, política de sessão e operação fora de `local`; obter aceite TI/AE.  |
| [Prova Google OIDC histórica](AUTENTICACAO_GOOGLE.md) | A antiga prova passou em 16 testes sintéticos em 25/09/2026, sem login institucional real. Google foi retirado da implementação ativa por decisão posterior.                                                                                                    | Guardar apenas como evidência histórica; não é mecanismo vigente nem homologação.                                       |
| [WhatsApp e assinatura](INTEGRACOES.md)               | Meta direta, Twilio e opção via WhatsApp Web comparadas; Twilio recomendado para exploração futura. Modalidades de assinatura listadas.                                                                                                                         | Conta, contratação, modalidade válida e detalhes D16/D17/D25 dependem da instituição; D15 define uma assinatura válida. |
| [Decisões D01–D26](DECISOES.md)                       | 26 itens registrados com requisito, estado, responsável proposto, fase e evidência.                                                                                                                                                                             | Obter valores aprovados, responsáveis institucionais nominais, datas e evidências formais conforme a fase afetada.      |
| [QA da Fase 0](QA.md)                                 | Histórico de 25/09/2026 e aceite técnico local de 26/09/2026 registrados com testes automatizados e prova em navegador real.                                                                                                                                    | Executar prova operacional do login próprio no ambiente de destino.                                                     |

## Portões ainda abertos

- **D21:** o solicitante escolheu contas próprias do SAGER por e-mail e senha. A
  implementação atual funciona somente em `local` e falha fechada fora dele.
  Faltam implantação segura, provisionamento/recuperação, política de sessão e
  desligamento, testes no ambiente de destino e aceite TI/AE. Integrações Google
  e SUAP ficaram para avaliação futura; não são pré-requisito do mecanismo atual.
- **D01 e D02:** gestor e supervisor receberam as mesmas operações nos recursos
  de gestão já integrados. Cadastro de residente é manual; nome, matrícula e
  nascimento são obrigatórios em novas gravações, curso é opcional. V10 mantém a
  leitura de residentes legados sem nascimento, mas exige a data em inserções e
  edições. A fonte e a conferência institucional da matrícula, assim como os
  demais detalhes cadastrais e a matriz final de acesso, precisam de revisão AE/TI.
- **D15 e D22:** uma assinatura válida de qualquer responsável cadastrado e
  vinculado basta para uma saída longa futura; a funcionalidade ainda não foi
  integrada. O compartilhamento de dados de saúde entre profissionais autorizados
  depende de recurso próprio. A retenção permanente foi escolhida para auditoria,
  sem estendê-la automaticamente a cadastros, dados de saúde ou documentos.
- **D16/D25:** não há conta de WhatsApp, fornecedor contratado ou modalidade/serviço de
  assinatura escolhidos para produção. Uma saída longa continua sem aprovação possível
  até existir assinatura válida e documento assinado armazenado, conforme o PRD.

As verificações históricas de Google foram sintéticas; a prova do login próprio
de 26/09/2026 cobriu apenas o ambiente local. Nenhuma delas demonstra a
implantação operacional atualizada nem homologa os fluxos do produto. Nenhuma
credencial, token, conta pessoal ou dado real de residente deve integrar os registros.
