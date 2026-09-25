# Fase 0 — WhatsApp e assinatura

**Estado em 25/09/2026:** avaliação técnica para planejamento. Nenhuma conta, contratação,
credencial, mensagem ou assinatura real foi criada nesta fase. A escolha de fornecedor para
produção e a validade do procedimento dependem da instituição, AE e TI.

O [PRD, seção 11](../../SAGER_PRD_v2.0_Angular_SpringBoot.md) exige enviar ao responsável
pré-cadastrado um link individual e seguro, registrar estados e falhas de mensagem e guardar o
documento assinado com evidências. Entrega ou leitura da mensagem não é assinatura. A saída longa
só pode ser aprovada após assinatura válida e armazenamento do documento assinado (AC39–AC44).

## Canal WhatsApp: alternativas

| Alternativa                                                                                     | Teste inicial                                                                                                                                                                                                                                                                      | Produção e operação                                                                                                                                                                                                                                                                                                                                                                                               | Avaliação para o SAGER                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Meta WhatsApp Cloud API](https://whatsappbusiness.com/developers/developer-hub/) direta        | O portal da Meta oferece número e recursos de teste. Exige configurar aplicativo e acesso de desenvolvedor.                                                                                                                                                                        | Integração direta com a plataforma oficial; requer conta institucional, remetente e políticas da Meta. A TI operaria credenciais, webhooks e suporte da integração.                                                                                                                                                                                                                                               | Menos intermediários, mas maior trabalho inicial de configuração e operação.                                                                                                                          |
| [Twilio API para WhatsApp](https://www.twilio.com/docs/whatsapp/quickstart)                     | O [Sandbox](https://www.twilio.com/docs/whatsapp/sandbox) permite testar a API sem WhatsApp Business Account (WABA) nem remetente registrado. Só envia a participantes que aderiram ao Sandbox; o número compartilhado pode sofrer restrições temporárias para destinos no Brasil. | A [ativação de remetente](https://www.twilio.com/docs/whatsapp/self-sign-up) exige Meta Business Portfolio, WABA, verificação do telefone e, para entrar em produção, verificação da empresa pela Meta quando ainda pendente. Acrescenta custo e dependência de fornecedor.                                                                                                                                       | **Preferência técnica para a futura prova de integração**, pela API e pelo ambiente de teste acessível antes do cadastro institucional na Meta. Não é aprovação de contratação ou de uso em produção. |
| [Evolution API com Baileys/WhatsApp Web](https://github.com/evolution-foundation/evolution-api) | Pode iniciar por sessão vinculada por QR, sem configurar a Cloud API. A Evolution também oferece um modo separado que usa a Cloud API oficial.                                                                                                                                     | O modo Baileys depende do WhatsApp Web e pode ter limitações em relação à API oficial, segundo o próprio projeto. Seu uso institucional precisa de avaliação de estabilidade, segurança e dos [termos do WhatsApp Business App](https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-App/preview?lang=et), que restringem aplicações que interagem com o app sem consentimento prévio por escrito. | Não recomendado para o fluxo institucional de autorização enquanto a instituição não avaliar expressamente termos e riscos. Usar o modo Cloud API da Evolution não elimina as exigências da Meta.     |

**Encaminhamento do projeto:** preparar, na Fase 4, um adaptador de envio substituível e avaliar
primeiro a Twilio em ambiente de teste autorizado, com dados sintéticos. O Sandbox não serve para
produção e não demonstra entrega confiável a responsáveis no Brasil. A AE/TI precisa aprovar
destinatário, modelo de mensagem, consentimento e política de reenvio; a instituição precisa
definir conta, custos, contratação e operação antes do envio real. A mensagem deve conter somente
o necessário e levar a uma página segura para o documento completo, como exige RNF-WA01–05.

A [especificação técnica atual, seção 8](../../SAGER_Especificacao_Tecnica_v2.0.md) ainda cita
Meta Cloud API direta como referência. A preferência por Twilio registrada aqui requer alinhar
essa referência antes da implementação da Fase 4. Ela não altera por si só uma aprovação
institucional, que ainda não existe.

## Assinatura: decisão futura

| Modalidade a avaliar                                                                      | Ponto a esclarecer antes de escolher                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assinatura manual em papel                                                                | Exigiria procedimento presencial, conferência da identidade, digitalização e guarda da evidência. O PRD pede assinatura **eletrônica via link** para a saída longa; a via manual não pode substituí-la sem revisão e homologação expressa do requisito.                                                                             |
| Serviço de assinatura eletrônica com API, inclusive opção com certificado digital         | Verificar método de identificação do responsável, assinatura do documento correto, evidências, webhooks, documento assinado, custos e contrato. A [Clicksign API 3.0](https://developers.clicksign.com/reference/comece-agora) é somente a referência técnica hoje citada no PRD e na especificação; seu uso não foi aprovado.      |
| [Assinatura GOV.BR](https://www.gov.br/iti/pt-br/assuntos/assinatura-eletronica-avancada) | O ITI descreve assinatura avançada via portal ou API para aplicações públicas integradas e exige conta gov.br prata ou ouro. A TI deve confirmar elegibilidade de integração do SAGER, acesso à API, identidade dos responsáveis e capacidade de devolver documento e evidências ao fluxo. Não há integração autorizada nesta fase. |

**Decisão institucional pendente (D16 e D25):** AE/TI devem definir a modalidade admitida,
verificação de identidade, fornecedor ou serviço, acesso, orçamento, licenças e procedimento de
homologação. Também permanecem D07 (eventual rejeição antes da assinatura), D15 (responsável
destinatário) e D17 (expiração, recusa e reenvio). O texto das decisões está no
[PRD, seção 23](../../SAGER_PRD_v2.0_Angular_SpringBoot.md).

Até essa decisão, o backend pode usar um adaptador simulado em desenvolvimento. Simulação,
desenho de assinatura, mensagem entregue ou documento apenas gerado **não liberam aprovação**.
A regra de produção permanece: verificar assinatura válida do responsável correto para a versão
vigente, armazenar o documento assinado e as evidências e, só então, permitir análise e eventual
aprovação pelo supervisor ([PRD, seções 8 e 11](../../SAGER_PRD_v2.0_Angular_SpringBoot.md)).
