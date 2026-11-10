# SAGER — interface Angular

Interface do SAGER no IF Goiano, Campus Urutaí. Desenvolvimento permite demonstração com dados sintéticos em memória e acesso a contas locais. Produção usa contas próprias com matrícula e senha, sessão do servidor e PostgreSQL, sem seletor de demonstração. Gestão, operações, comunicações, saúde, limpeza e relatórios usam a API persistida. A configuração HTTPS está em [F7](../docs/fase-7/README.md); o gateway de WhatsApp exige [configuração própria](../docs/whatsapp/OPERACAO.md) e fica desligado por padrão. A aba **Conversas** é só para supervisor e não funciona na demonstração. Google e SUAP foram adiados.

## Executar

O ambiente fixado e o CI usam Node.js 24.19.0 e npm 11.17.0.

```bash
npm ci
npm start
```

Acesse `http://localhost:4200/acesso`. Para desenvolvimento com persistência, inicie o [backend e uma conta sintética](../backend/README.md); o proxy de `/api` aponta para `127.0.0.1:8080`. Gestor e supervisor locais têm as mesmas operações nos recursos de gestão integrados. O formulário de residente exige nome, matrícula, data de nascimento e curso em novas gravações. Para explorar as telas demonstrativas, escolha um perfil em “Explorar demonstração”. No desktop, perfil e cenário ficam no cabeçalho; no celular, ficam no menu. A autorização longa de exemplo em `/saidas/S-1048` é simulada.

```bash
npm run build
npm test -- --watch=false
npm run test:e2e
```

As telas foram separadas por domínio em `src/app/features/management`, `operations`, `communications`, `reports` e `portal`. Os dados de demonstração ficam nos serviços de cada domínio. `src/app/app.routes.ts` concentra as rotas; o backend aplica as permissões das fatias locais integradas. Uma falha da API local não carrega dados demonstrativos. Registros legados sem nascimento permanecem legíveis; editá-los exige informar a data. O cadastro manual de residente cria a conta vinculada com a senha informada.

O [CI](../docs/CI.md) executa testes, build e jornadas de navegador sem alterar as capturas visuais de referência. Os contratos e provas de F1–F7 estão em `docs/`; o [manual por perfil](../docs/fase-7/MANUAL.md) descreve as tarefas e o suporte.

O [PRD](../SAGER_PRD_v2.0_Angular_SpringBoot.md), a [especificação técnica](../SAGER_Especificacao_Tecnica_v2.0.md) e a [direção visual](../DESIGN.md) são a referência para continuidade.
