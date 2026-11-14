Comandos: backend em `backend/` com `./mvnw -B -ntp verify` (JDK 21 e Docker); frontend em `frontend/` com `npm test -- --watch=false`, `npm run build` e `SAGER_E2E_PORT=4327 CI=1 npx playwright test <arquivo>`. O modo demonstração (RF027) continua: não remover os ramos `isDemo()`/`session.active()` dos arquivos tocados.

## 1. Servidor

- [x] 1.1 Em `SecurityConfiguration`, trocar a mensagem do 401 do login para "Usuário ou senha inválidos."; em `OpenApiConfiguration`, o resumo da rota para "Entrar com usuário e senha", sem mudar o parâmetro `matricula`. Verificar em `ApiFoundationIntegrationTest`: conta inexistente e senha errada de conta existente recebem 401 `invalid_credentials` com a mesma mensagem nova.
- [x] 1.2 Em `SupervisorService`, trocar os conflitos para "Usuário já utilizado por uma conta.", "Usuário já utilizado por uma conta ou inválido para acesso." e "Usuário já cadastrado."; em `LocalAccountProvisioningService`, "Já existe uma conta com esse usuário ou e-mail.", "A senha não pode ser igual ao usuário.", "Usuário já utilizado por outra conta." e "Usuário deve ter entre 1 e 64 caracteres, sem @ ou controles.". Manter os textos do comando de contas (`LocalAccountProvisioningRunner`, `ProductionSchemaVerifier`) e os do residente (`ResidentService`). Verificar com `LocalAccountPasswordPolicyTest` atualizado e `./mvnw -B -ntp verify`.

## 2. Página de acesso e ajuda

- [x] 2.1 Em `portal.pages.ts`, trocar o rótulo para "Usuário", ligar o texto "Residente: use sua matrícula." ao campo por `aria-describedby`, e trocar o subtítulo ("Entre com seu usuário e a senha do SAGER." / "Entre com o usuário e a senha local...."), o erro de campo vazio ("Informe seu usuário e senha.") e o de credenciais ("Usuário ou senha errados. ..."). Verificar com um caso novo de `AccessPage` em `portal.pages.spec.ts` (rótulo, dica ligada, sem "Matrícula" no rótulo, erro de campo vazio e do 401).
- [x] 2.2 Na ajuda "Usar sua conta SAGER", trocar "Entre com sua matrícula" por "Entre com seu usuário e a senha do SAGER (o residente usa a matrícula)". Manter a pergunta da recuperação do residente com "matrícula". Verificar no caso de `HelpPage` em `portal.pages.spec.ts`.
- [x] 2.3 Atualizar `e2e/local-auth.spec.ts` e `e2e/page-loading.spec.ts` para o rótulo e a mensagem novos, e conferir em `local-auth.spec.ts` que o campo "Usuário" tem a descrição acessível "Residente: use sua matrícula.". Verificar com `SAGER_E2E_PORT=4327 CI=1 npx playwright test e2e/local-auth.spec.ts e2e/page-loading.spec.ts`.

## 3. Supervisores

- [x] 3.1 Em `supervisor-form.component.ts`, `supervisor-detail.component.ts` e `supervisors.component.ts`, trocar "Matrícula ou SIAPE" por "Usuário" (rótulo "Usuário (usado para entrar) *", notas, conflito 409, detalhe e busca "Nome, usuário ou e-mail"); em `management-demo.service.ts`, o conflito da demonstração para "Este usuário já está cadastrado.". Verificar com `supervisor-form.component.spec.ts` e `management-pagination-local.spec.ts`.
- [x] 3.2 Em `shared/password-rules.ts`, permitir que `passwordRules` receba a mensagem de senha igual ao login, mantendo "à matrícula" como padrão, e usar "A senha não pode ser igual ao usuário." no formulário do supervisor. Verificar com `password-rules.spec.ts` e `supervisor-form.component.spec.ts`.
- [x] 3.3 Atualizar `e2e/supervisors-local.spec.ts` e `e2e/management-pagination-local.spec.ts` para os rótulos novos. Verificar com `SAGER_E2E_PORT=4327 CI=1 npx playwright test e2e/supervisors-local.spec.ts e2e/management-pagination-local.spec.ts`.

## 4. Demonstração de relatórios

- [x] 4.1 Em `reports-demo-api.service.ts`, gerar a matrícula fictícia `20241012020190` + número de 2 dígitos no lugar de `DEMO-00n`. Verificar que nenhum teste usa o valor antigo (`grep -rn "DEMO-00" frontend/src frontend/e2e` só acha o usuário `DEMO-003` do supervisor), que os valores gerados passam na regra de matrícula de residente de `field-rules.ts` (16 posições, 5º dígito 1) e com `npm test -- --watch=false` e a e2e completa.

## 5. Documentação e verificação final

- [x] 5.1 Trocar "login por matrícula" por "login por usuário" (o residente usa a matrícula) em `docs/ARQUITETURA.md`, `PRODUCT.md` e no Purpose de `openspec/specs/access-control/spec.md`, e dizer em `docs/OPERACAO.md` e `backend/README.md` que o valor de `--matricula` vai no campo Usuário. Verificar com `grep -rn -i "login por matrícula" docs PRODUCT.md openspec/specs`, que só acha o título do requisito, renomeado no arquivamento.
- [x] 5.2 Rodar a verificação completa: `./mvnw -B -ntp verify`, `npm test -- --watch=false`, `npm run build`, `SAGER_E2E_PORT=4327 CI=1 npx playwright test --grep-invert 'captura telas centrais' --workers=2` e `npx -y @fission-ai/openspec@2.0.0 validate --all --strict`.
