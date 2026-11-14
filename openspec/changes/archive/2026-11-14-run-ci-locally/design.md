# Design

## Decisões

### 1. Subcomando `ci` no script `sager`

O `sager` já é a entrada única para rodar o sistema no PC (`up`, `down`, `logs`, `account`, `backup`), e o `ci` entra no mesmo `case`. Cada job é uma função que encadeia os passos com `&&`, roda num subshell próprio e grava a saída em `.ci/<job>.log`. Um job que falha não impede os seguintes, como na CI, onde os três jobs eram independentes. O comando sai com código 1 se algum job falhou e com 2 se recebeu um nome de job desconhecido.

- **Alternativa rejeitada:** um script novo em `scripts/`. A pasta não é versionada e guarda scripts do dono para popular dados; um segundo ponto de entrada repetiria a detecção do Docker.
- **Alternativa rejeitada:** hook de pre-push. A verificação completa leva cerca de 30 minutos e travaria cada push, inclusive os de documentação.

### 2. Desativar o workflow no GitHub e manter o arquivo

`gh workflow disable CI` para os disparos sem apagar nada; `gh workflow enable CI` volta atrás quando a conta for regularizada. O arquivo continua igual porque a monografia descreve a integração contínua no GitHub Actions, com os três jobs.

- **Alternativa rejeitada:** apagar `.github/workflows/ci.yml`. Obrigaria a reescrever a monografia em quatro capítulos e perderia a configuração fixada por hash.
- **Alternativa rejeitada:** runner auto-hospedado no PC. Continua dependendo da conta do GitHub, que está bloqueada, e executaria código de pull requests nesta máquina.

### 3. Os mesmos passos e as mesmas escolhas do workflow

Como a CI partia de um checkout limpo, o job `backend` roda `./mvnw -B -ntp clean verify`: uma migração renomeada ou apagada não sobra em `backend/target`. Os smokes apagam seus containers, volumes e redes, mas não as imagens que constroem; o job `infra` apaga no fim as imagens com tag `sager-smoke-*` ou `sager-coolify-smoke-*`, sem forçar, para não acumular imagens a cada execução. O job `frontend` roda `npm ci`, os testes unitários, o build e as jornadas com um único worker, sem "captura telas centrais", como na CI e como a monografia descreve. O Playwright recebe `CI=1` e a porta `SAGER_E2E_PORT` (4323 por padrão), para nunca reaproveitar o `./sager up`, que ocupa a porta 4200. O job `infra` usa `python3` e, se esse comando não existir (no Windows ele abre a loja), usa `python`. A variável `MSYS_NO_PATHCONV`, que o `sager` liga para o `account`, é desligada no `ci` para os scripts de smoke rodarem como rodam fora dele.

- **Alternativa rejeitada:** jornadas com dois workers, o padrão do `playwright.config.ts`. O comando fica cerca de 5 minutos mais rápido, mas deixa de ser a configuração que a monografia relata.

### 4. Resumo com o commit verificado

O commit e o `git status` são lidos antes do primeiro job. O resumo final mostra cada job como `ok` ou `falhou`, o commit curto, se havia alterações sem commit em arquivos rastreados e quantos arquivos fora do Git estavam na árvore, e avisa se o commit ou a árvore mudaram durante a execução. Esse resumo é a evidência que vai para o PR antes de mesclar.

- **Alternativa rejeitada:** publicar o resultado como status do commit no GitHub. Ninguém pediu e exigiria um token com escrita no repositório.

## Riscos

- `npm ci` apaga `frontend/node_modules`. Um `npm start` aberto no Windows pode travar arquivos e fazer o job falhar; basta fechá-lo.
- Os smokes de infraestrutura criam projetos Docker descartáveis com nomes próprios e recusam colisão. Eles não tocam no `sager-local`.

## Pendências do dono

- Monografia: o RNF de suportabilidade (cap4) cita "integração contínua", e a seção de testes (cap5) diz que ela é acionada a cada envio à `main`. Com o workflow desativado, o dono decide se reescreve esses trechos para a verificação local ou se reativa o workflow quando a cobrança do GitHub for regularizada.
