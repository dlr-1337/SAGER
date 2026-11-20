## MODIFIED Requirements

### Requirement: Cor de cada situação

No acesso por conta, toda etiqueta de situação de saídas, chamada noturna, notificações, advertências, termos, avisos e comunicações do residente SHALL ter o tom do seu significado: atenção para o que espera alguém, informação para o que está em curso, sucesso para o que terminou bem ou vale, perigo para rejeição, falha ou atraso e neutro para o que acabou sem efeito. O texto da situação MUST continuar escrito na etiqueta.

#### Scenario: Saídas

- **WHEN** o supervisor abre a lista de saídas
- **THEN** "Aguardando análise" aparece em amarelo, "Aprovada" e "Em andamento" em azul, "Atrasada" em vermelho, "Retorno confirmado" em verde, "Retorno confirmado com atraso" em amarelo, "Rejeitada" em vermelho e "Cancelada" e "Expirada" em cinza, cada uma com o nome escrito

#### Scenario: Chamada noturna

- **WHEN** o supervisor abre uma chamada aberta e depois uma fechada
- **THEN** "Aberta" aparece em amarelo e "Fechada" em verde

#### Scenario: Comunicações

- **WHEN** o supervisor abre notificações, avisos e advertências
- **THEN** a notificação "Pendente" aparece em amarelo, "Arquivada" em cinza, o aviso "Publicado" em verde, "Rascunho" e "Retirado" em cinza e a advertência "Anulada" em cinza

#### Scenario: Arquivos da saída longa

- **WHEN** o supervisor abre uma saída longa com um arquivo aguardando conferência e outro recusado
- **THEN** "Aguardando conferência" aparece em amarelo, "Arquivo recusado" em vermelho e a situação da autorização na cor do seu nome
