# Proposal

## Why

A monografia de 10/11/2026 é a fonte da verdade do SAGER, e a conferência com o código achou oito pontos em que as telas contradizem o texto (itens 1, 2, 3, 4, 5, 6, 8 e 10 da seção 4 do plano de reconciliação), além de duas escritas sem auditoria, contra a RN16 (cap4.tex:171). Todos foram conferidos no código em 13/11. A banca vai comparar as telas e a demonstração (RF027) com o texto, por isso a correção entra agora, antes da defesa.

## What Changes

- **Ficha do residente sem a aba Termos** (RF002, RF022, UC21; tabela de permissões em cap4.tex:80). Hoje, no acesso por conta, a aba diz "Ainda não integrado… outra entrega da Fase 2" (`resident-detail.component.ts:415-437`). Na demonstração, ela diz que o termo depende de homologação (:735-745). Mas o termo existe: o supervisor o emite pela reincidência, e o residente o vê nas comunicações. A aba sai nos dois modos, e a ficha fica com Dados, Responsáveis e Histórico.
- **Ajuda de senha correta** (RF020, UC02; cap4.tex:126, :250). Hoje, a pergunta frequente do acesso por conta manda todos ao suporte (`portal.pages.ts:1150-1156`). Ela passa a orientar o residente a usar "Esqueci minha senha", com link para `/recuperar-senha`. Gestor e supervisor continuam procurando o suporte. A pergunta da demonstração não muda.
- **Rejeição de saída curta exige motivo** (RN05, cap4.tex:160; UC07, cap4.tex:348). Hoje, no acesso por conta, o diálogo de rejeição tem só um comentário opcional (`exit-detail-local.component.ts:362`), e a falta de motivo só aparece depois do envio, quando o servidor recusa (`ShortExitService.java:137`). A tela passa a pedir a justificativa antes de enviar, como já faz na saída longa.
- **Justificativas de até 2.000 caracteres** (RN05, cap4.tex:160; UC05, cap4.tex:328; UC07, cap4.tex:348). Hoje, o diálogo de revisão das operações limita o texto a 500 caracteres (`operations-local.utils.ts:62`, `review-dialog-local.component.ts:106-122`, :224, :279), embora o servidor e a monografia aceitem de 10 a 2.000. O limite passa a 2.000 nas saídas e na chamada noturna.
- **Demonstração: a saída longa pode ser rejeitada antes da conferência** (RN05; UC07, fluxo alternativo, cap4.tex:349). Hoje, a demonstração bloqueia "Rejeitar" até a conferência simulada (`exit-detail.component.ts:225`, `operations-demo.service.ts:471`) e aceita motivo de 1 caractere (:472). Passa a valer a mesma regra da API: rejeitar a qualquer momento antes da decisão, com motivo de 10 a 2.000 caracteres. Aprovar continua bloqueado até a conferência.
- **Demonstração: limpeza e ranking descrevem a regra adotada** (RF010, RF012, RN11, RN14; cap4.tex:220, :364). Hoje, as telas dizem "Critérios pendentes da AE" e "Fórmula pendente da AE" e mostram a nota com uma casa decimal (`cleaning.component.ts:28-32`, :78-103; `ranking.component.ts:23`, :28; `operations-demo.service.ts:257`). Passam a mostrar a média dos quatro critérios, com duas casas decimais, o limiar de 6,00 e a regra de empate. Também informam que essas regras são políticas locais que aguardam o aceite da Assistência Estudantil.
- **Fechar em data posterior pede confirmação** (RN09, cap4.tex:164; diagrama de sequência da chamada noturna, passo 9, cap4.tex:436). Hoje, a tela só pede confirmação e justificativa fora da janela (`night-call-local.component.ts:697`, :708-717). O servidor também as exige quando a chamada é de um dia anterior (`NightCallService.java:172`), e por isso o fechamento era recusado sem explicação. A tela passa a pedir as duas coisas nesse caso também, com um aviso próprio.
- **Demonstração: a chamada só lista menores** (RN02, cap4.tex:157; cap7.tex:43). Hoje, Beatriz Costa nasceu em 22/08/2007 e já tem 19 anos. Pedro Henrique Silva nasceu em 03/12/2008 e faz 18 anos em 03/12/2026 (`management-demo.service.ts:52`, :62). As datas fictícias passam a 22/08/2010 e 03/12/2009.
- **Auditoria das contas** (RN16, cap4.tex:171; RF025, cap4.tex:131; RN17). Hoje, a recuperação de senha do residente (`ResidentRecoveryService.recover`) troca o hash e encerra as sessões sem evento. Os comandos de contas do terminal (`create`, `reset`, `disable`, `link-*`, `unlink`, `assign-enrollment`) também gravam sem evento. Os dois casos passam a gravar o evento na mesma transação, só com os nomes dos campos. A auditoria do banco não aceita o recurso "conta" nem a origem "terminal", por isso entra a migração `V33__local_account_audit.sql`, com teste.

Fora do escopo:
- Item 7 (perfil e módulo de saúde) e item 9 (o terminal cria conta de qualquer perfil): ficam na `remove-health-module`.
- O modo demonstração (RF027) continua. Esta mudança só ajusta textos, regras e dados fictícios da demonstração para seguirem a monografia. Nenhum ramo `isDemo()`/`session.active()` nem `*-demo.service` é removido ou renomeado.
- Auditar a conta criada no cadastro assistido de residente ou supervisor: ela nasce na mesma transação do cadastro, que já grava o evento CREATE do residente ou do supervisor.
- Auditar sessões, contadores de tentativa de login e de recuperação e tentativas de recuperação recusadas. São controles técnicos, não registros do domínio, e uma recusa não grava nada.
- Listar termos de compromisso na ficha do residente: a monografia não prevê essa tela.
- Aprovar a regra de limpeza e de ranking: a decisão é da Assistência Estudantil. A tela só diz que a regra é uma política local.
- Texto da monografia: a contagem de migrações (cap5.tex:102 e tab:migracoes) e a linha da V33 entram depois que a V33 for aplicada (design.md, "Pendências").

## Capabilities

### New Capabilities

- `resident-record`: as seções da ficha do residente vistas por gestor e supervisor.
- `demo-fidelity`: coerência da demonstração (RF027) com as regras da monografia, apesar dos dados fictícios em memória.
- `account-audit`: auditoria das escritas em contas de acesso fora do cadastro assistido, ou seja, a recuperação de senha e os comandos do terminal.

### Modified Capabilities

- `exit-scheduling`: novos requisitos sobre a rejeição de saída curta com motivo e as justificativas de 10 a 2.000 caracteres nas saídas.
- `guardian-authorization`: novo requisito sobre a rejeição de saída longa antes da conferência, também na demonstração.
- `night-call-justification`: novos requisitos sobre o fechamento em data posterior e as justificativas da chamada de até 2.000 caracteres.
- `password-policy`: novo requisito para que a ajuda indique o caminho certo de recuperação de senha para cada perfil.

## Impact

- Frontend, acesso por conta: `features/management/resident-detail.component.ts`, `features/portal/portal.pages.ts` (HelpPage), `features/operations/exit-detail-local.component.ts`, `operations-local.utils.ts`, `review-dialog-local.component.ts`, `night-call-local.component.ts`.
- Frontend, demonstração: `features/operations/operations-demo.service.ts`, `exit-detail.component.ts`, `review-dialog.component.ts`, `cleaning.component.ts`, `ranking.component.ts`, `features/management/management-demo.service.ts`.
- Testes do frontend: `operations-local.utils.spec.ts`, `review-dialog-local.component.spec.ts`, `night-call-local.component.spec.ts`, `operations-demo.service.spec.ts`, `management-demo.service.spec.ts`, `portal.pages.spec.ts`, `e2e/tab-scroll.spec.ts`, `e2e/operations-local.spec.ts`, `e2e/journeys.spec.ts`.
- Backend: `audit/AuditResource.java`, `audit/AuditService.java`, `audit/AuditRepository.java`, `auth/ResidentRecoveryService.java`, `auth/LocalAccountProvisioningService.java`, `auth/LocalAccountRepository.java` e a nova `db/migration/V33__local_account_audit.sql`. Testes: `audit/AuditMigrationIntegrationTest.java`, `audit/AuditServiceIntegrationTest.java`, `management/residents/ResidentApiIntegrationTest.java` (recuperação) e `auth/LocalAccountLinksIntegrationTest.java` (comandos).
- API: a consulta `GET /api/v1/auditoria` passa a devolver o recurso `LOCAL_ACCOUNT` e a origem `OPERATOR_CLI`. Nenhuma rota nova.
- Documentos: `docs/ARQUITETURA.md` ("Auditoria", :78) e `docs/OPERACAO.md` (comandos de contas).
- Ordem: os grupos de frontend não dependem de outras changes (arquivos compartilhados em design.md, D10). O grupo da auditoria entra depois de `remove-health-module`, que edita os mesmos arquivos de auditoria e de contas, e só quando V30, V31 e V32 já estiverem no código, porque a V33 não pode chegar ao banco antes delas.
