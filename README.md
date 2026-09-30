# SAGER

Sistema de apoio à gestão da residência estudantil do IF Goiano, Campus Urutaí.
Angular 22, Spring Boot 4.1/Java 21 e PostgreSQL 17. As funcionalidades de gestão,
chamada, saídas, comunicações, saúde, limpeza e relatórios usam dados persistidos
e autorização do servidor.

## Desenvolvimento

Leia [frontend](frontend/README.md) e [backend](backend/README.md) para dependências,
contas sintéticas, banco local e comandos. A demonstração usa dados em memória;
o acesso com conta usa a API. Registros de desenvolvimento e teste são sintéticos.

## Operação

- [Configuração de produção](infra/production/README.md): Compose, HTTPS, segredos,
  migração separada e recuperação criptografada.
- [Manual por perfil](docs/fase-7/MANUAL.md) e [roteiro de homologação](docs/fase-7/HOMOLOGACAO.md).
- [Entregas e limites](docs/ROADMAP_IMPLEMENTACAO.md), [CI](docs/CI.md) e [QA final](docs/fase-7/QA.md).

Produção exige configuração e contas provisionadas pelo operador. Demonstração
fica desabilitada. Clicksign e WhatsApp dependem de credenciais/configuração e
homologação externa; Google e SUAP foram adiados. As regras delegadas e a evidência
técnica não substituem o aceite institucional ou a medição na VPS definitiva.
