# SAGER — interface Angular

Interface do SAGER no IF Goiano, Campus Urutaí, com demonstração pública e acesso local de desenvolvimento. A demonstração usa dados sintéticos em memória e perfil em `sessionStorage`. O acesso local usa sessão do backend e PostgreSQL para supervisores, residentes, responsáveis, alojamentos, quartos e alocações. As operações ainda não integradas continuam demonstrativas. Autenticação institucional, WhatsApp e assinatura válida continuam pendentes.

## Executar

O ambiente fixado e o CI usam Node.js 24.19.0 e npm 11.17.0.

```bash
npm ci
npm start
```

Acesse `http://localhost:4200/acesso`. Para desenvolvimento com persistência, inicie o [backend e uma conta sintética](../backend/README.md); o proxy de `/api` aponta para `127.0.0.1:8080`. Para explorar as telas demonstrativas, escolha um perfil em “Explorar demonstração”. No desktop, perfil e cenário ficam no cabeçalho; no celular, ficam no menu. A autorização longa de exemplo em `/assinatura/S-1048` é simulada.

```bash
npm run build
npm test -- --watch=false
npm run test:e2e
```

As telas foram separadas por domínio em `src/app/features/management`, `operations`, `communications`, `reports`, `signature` e `portal`. Os dados de demonstração ficam nos serviços de cada domínio. `src/app/app.routes.ts` concentra as rotas; o backend aplica as permissões das fatias locais integradas. Uma falha da API local não carrega dados demonstrativos.

O [CI](../docs/CI.md) executa testes, build e jornadas de navegador sem alterar as capturas visuais de referência. O [contrato da Fase 2](../docs/fase-2/README.md) registra as funcionalidades persistidas e seus limites.

O [PRD](../SAGER_PRD_v2.0_Angular_SpringBoot.md), a [especificação técnica](../SAGER_Especificacao_Tecnica_v2.0.md) e a [direção visual](../DESIGN.md) são a referência para continuidade.
