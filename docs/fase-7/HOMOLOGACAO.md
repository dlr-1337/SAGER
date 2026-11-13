# Roteiro de homologação e piloto

Este roteiro é um entregável técnico. Execução com registros sintéticos está no
[QA](QA.md); aceite institucional e medição com usuários reais não foram realizados.

## Oito fluxos

| Fluxo                    | Conferência para aceite AE/TI                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Cadastro e alocação      | Matrícula/nascimento, responsável, capacidade, transferência, conflito concorrente e histórico                                    |
| Chamada noturna          | Participantes congelados, ausência, justificativa por saída e movimento, fechamento e correção                                    |
| Saída curta              | Elegibilidade, prazo pelo relógio do servidor, análise, partida, retorno, expiração e posse do residente                          |
| Saída longa              | Destinatário autorizado, PDF vigente, autorização conferida na revisão vigente, revisão invalidando evidências e aprovação humana |
| Notificação e disciplina | Origem íntegra, correção, análise humana, advertência, reincidência, termo e ciência por versão                                   |
| Saúde                    | Habilitação/atribuição explícitas, compartilhamento/custódia, revisões e recusa de gestor/residente alheio                        |
| Limpeza e relatórios     | Critérios/pesos/limiar, participação histórica, empates, filtros, consulta congelada e arquivos integrais                         |
| Operação e contingência  | Login real, desligamento/vínculo, HTTPS, integração externa, falhas, backup/restauração e carga na VPS                            |

Use contas de todos os perfis, outra conta do mesmo perfil e usuário sem vínculo.
Registre comportamento esperado/observado, horário de São Paulo, versão do software,
schema, identificador de requisição e responsável. Não copie dados clínicos,
credenciais ou conteúdo pessoal para logs de homologação.

## Treinamento e usabilidade

Prepare uma sessão de até 2 horas para supervisores e até 30 minutos para residentes.
Após orientação pelo manual, peça a execução individual das tarefas do respectivo
perfil com registros sintéticos. Cronometre a sessão e cada tarefa; registre sucesso,
erro, ajuda solicitada e observação sem identificar o participante no relatório.

Calcule a taxa de erro como ações incorretas divididas pelo total de ações avaliadas,
com tarefas, tamanho da amostra e definição de erro acordados previamente pela AE/TI.
A meta é abaixo de 5%. Registre também conclusão das tarefas, compreensão dos estados,
navegação por teclado e leitura em celular. Testes automatizados não comprovam
aprendizado ou taxa de erro humano.

## Piloto operacional

Meça os cenários acordados de 250 residentes e 50 transações por minuto na VPS
prevista (2 GB/1 CPU/50 GB). Registre mediana, p95, máximo, respostas recusadas,
CPU/RAM e duração. Compare cada cenário à meta de resposta de 2 segundos.
Configuração de limite em Docker e medição no computador de desenvolvimento não
substituem esse ensaio.

Acompanhe no piloto disponibilidade mensal de 99%, MTBF de 500 horas e MTTR de
até 4 horas. Colete início/fim de cada incidente, impacto, recuperação e causa.
Os indicadores internos e logs entregues apoiam essa apuração; nenhuma série
mensal foi observada nesta implementação.

## Liberação institucional

O responsável AE/TI registra aceite datado das regras delegadas, finalidade e
retenção, contas e acesso assistencial, segredo/certificado, custódia e cópia externa
de backup, contingência e responsáveis. O gateway de WhatsApp precisa de número dedicado,
de aceite formal da integração não oficial e do [teste de aceite](../whatsapp/OPERACAO.md#teste-de-aceite-obrigatório). A CI verde comprova os gates
técnicos descritos no QA e não substitui esse aceite.
