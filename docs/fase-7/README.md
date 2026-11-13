# Operação, segurança e recuperação

Entrega técnica de F7, integrada a F1–F6. A configuração de produção usa contas
próprias, sessão PostgreSQL, proteção CSRF e autorização do servidor. A interface
de produção remove o seletor de demonstração e orienta a recuperação da conta pelo
operador institucional.

## Documentos

- [Manual por perfil](MANUAL.md): acesso, tarefas, correções e suporte.
- [Operação e recuperação](../../infra/production/README.md): instalação,
  atualização, segredos externos, HTTPS e backup criptografado.
- [Homologação no Coolify](COOLIFY.md): instância implantada, verificações públicas,
  comandos operacionais e pendências.
- [Roteiro de homologação](HOMOLOGACAO.md): oito fluxos e critérios de uso.
- [QA](QA.md): comandos, resultados medidos, capturas e limites da evidência.

## Decisões técnicas delegadas

Contas são provisionadas por operador, com vínculo por UUID, ou criadas na mesma
transação do cadastro de residente ou supervisor, com a senha informada nele.
Nenhum cadastro habilita acesso assistencial. No provisionamento, senhas são lidas
pelo console oculto; reset, desativação e mudança de vínculo revogam sessões. Não
existe envio automático de senha. O tempo de inatividade da sessão é 30 minutos.

O perfil `production` exige HTTPS no proxy, cookie seguro, hostname configurado,
segredos distintos externos e role `sager_runtime`. Migrações usam outro processo,
perfil e role `sager_owner`. Configuração inadequada de production/migration ou
combinação desses perfis com outros é recusada antes da inicialização do banco.
A aplicação não altera o schema durante a execução normal. A auditoria permite
somente leitura e inserção pela role de
execução.

Contadores de login persistem HMAC de conta e IP, com janela de 15 minutos e erros
genéricos. O gateway substitui os cabeçalhos de encaminhamento do cliente e limita
rajadas. PostgreSQL, backend e métricas não têm publicação direta no host.

O backup pausa as gravações da aplicação, captura banco e documentos permanentes
no mesmo ponto, calcula hashes e criptografa com age. A restauração exige outro
stack vazio, verifica schema/auditoria/arquivos e descarta sessões antigas. Não
inicia a aplicação automaticamente. Relatórios transitórios expiram em 24 horas;
documentos permanentes e auditoria não têm descarte automático.

Essas escolhas permitem desenvolver e verificar a operação. Retenção dos demais
dados, identidade institucional, custódia da recuperação, acesso assistencial,
frequência/cópia externa de backups e responsabilidades precisam de aceite AE/TI
antes de uso real. Os scripts entregues não criam rotinas agendadas.

## Configuração e limites

O Compose limita a execução a 1 CPU e 1.632 MiB somados entre os três serviços.
A medição local está no QA; esse orçamento não comprova uma VPS física de
2 GB/1 CPU/50 GB. Disponibilidade mensal, MTBF e MTTR exigem acompanhamento no
piloto. O gateway de WhatsApp permanece desligado até configuração própria e
aceite institucional ([operação](../whatsapp/OPERACAO.md)).
