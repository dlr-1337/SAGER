# SAGER — protótipo Angular

Interface navegável para avaliação das telas do SAGER no IF Goiano, Campus Urutaí. Todos os registros são sintéticos; ações ficam em memória nesta sessão. Somente o perfil escolhido é guardado em `sessionStorage` para manter a navegação após recarregar a aba. Nenhum dado de residente é salvo no navegador. Não há autenticação institucional, backend, WhatsApp, assinatura com validade jurídica nem exportação de arquivos.

## Executar

Requer Node.js compatível com Angular 22.

```bash
npm install
npm start
```

Acesse `http://localhost:4200/acesso`, escolha um perfil em “Explorar demonstração” e navegue pelo menu. O seletor no cabeçalho permite trocar de perfil. Para o fluxo público da autorização longa de exemplo, acesse `/assinatura/S-1048` a partir do detalhe da solicitação.

```bash
npm run build
npm test -- --watch=false
npm run test:e2e
```

As telas foram separadas por domínio em `src/app/features/management`, `operations`, `communications`, `reports`, `signature` e `portal`. Os dados de demonstração ficam nos serviços de cada domínio. `src/app/app.routes.ts` concentra as rotas e os guards de perfil da demonstração; autorização real deverá ser aplicada pelo backend na próxima etapa.

O [PRD](../SAGER_PRD_v2.0_Angular_SpringBoot.md), a [especificação técnica](../SAGER_Especificacao_Tecnica_v2.0.md) e a [direção visual](../DESIGN.md) são a referência para continuidade.
