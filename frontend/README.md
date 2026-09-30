# SAGER — interface Angular

Interface do SAGER no IF Goiano, Campus Urutaí, com demonstração pública e acesso local de desenvolvimento. A demonstração usa dados sintéticos em memória e perfil em `sessionStorage`. O solicitante escolheu login próprio do SAGER por e-mail e senha; a implementação atual funciona apenas no perfil `local`, com sessão do backend e PostgreSQL. Supervisores, residentes, responsáveis, alojamentos, quartos e alocações já usam a API local. As operações ainda não integradas continuam demonstrativas. A implantação segura do login próprio, WhatsApp e assinatura válida continuam pendentes; Google e SUAP foram adiados.

## Executar

O ambiente fixado e o CI usam Node.js 24.19.0 e npm 11.17.0.

```bash
npm ci
npm start
```

Acesse `http://localhost:4200/acesso`. Para desenvolvimento com persistência, inicie o [backend e uma conta sintética](../backend/README.md); o proxy de `/api` aponta para `127.0.0.1:8080`. Gestor e supervisor locais têm as mesmas operações nos recursos de gestão integrados. O formulário de residente exige nome, matrícula e data de nascimento em novas gravações; curso é opcional. Para explorar as telas demonstrativas, escolha um perfil em “Explorar demonstração”. No desktop, perfil e cenário ficam no cabeçalho; no celular, ficam no menu. A autorização longa de exemplo em `/assinatura/S-1048` é simulada.

```bash
npm run build
npm test -- --watch=false
npm run test:e2e
```

As telas foram separadas por domínio em `src/app/features/management`, `operations`, `communications`, `reports`, `signature` e `portal`. Os dados de demonstração ficam nos serviços de cada domínio. `src/app/app.routes.ts` concentra as rotas; o backend aplica as permissões das fatias locais integradas. Uma falha da API local não carrega dados demonstrativos. Registros legados sem nascimento permanecem legíveis; editá-los exige informar a data. O cadastro manual de residente não cria uma conta de login.

O [CI](../docs/CI.md) executa testes, build e jornadas de navegador sem alterar as capturas visuais de referência. O [contrato da Fase 2](../docs/fase-2/README.md) registra as funcionalidades persistidas e seus limites.

O [PRD](../SAGER_PRD_v2.0_Angular_SpringBoot.md), a [especificação técnica](../SAGER_Especificacao_Tecnica_v2.0.md) e a [direção visual](../DESIGN.md) são a referência para continuidade.
