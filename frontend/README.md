# Interface do SAGER

Aplicação Angular 22 com componentes standalone, Signals e Reactive Forms tipados. A interface mostra a cada perfil só o que lhe cabe, mas quem decide a permissão é sempre o backend. Arquitetura e decisões: [docs/ARQUITETURA.md](../docs/ARQUITETURA.md). Ambientes e CI: [docs/OPERACAO.md](../docs/OPERACAO.md).

## Executar

O projeto e a CI usam Node.js 24.19.0 e npm 11.17.0.

```bash
npm ci
npm start
```

Abra http://localhost:4200/acesso. O `npm start` repassa `/api` para `http://127.0.0.1:8080` (`proxy.conf.json`), então o [backend](../backend/README.md) precisa estar rodando no host com o perfil `local` e uma conta sintética. Para subir tudo de uma vez, sem Node nem Java na máquina, use `./sager up` na raiz.

Se a API falhar, a tela mostra o erro; não há dados de exemplo no lugar.

## Testar

```bash
npm test -- --watch=false
npm run build
npm run test:e2e
```

- `npm test` roda os testes unitários e de componente (Vitest). Eles ficam ao lado do código, em `*.spec.ts`.
- `npm run build` gera o pacote de produção e confere os templates.
- `npm run test:e2e` roda as jornadas Playwright de `e2e/`, com verificação de acessibilidade pelo axe. A configuração sobe o servidor de desenvolvimento sozinha.

Formate os arquivos alterados com `npx prettier --write <caminho>`.

## Pastas

| Pasta | Conteúdo |
| --- | --- |
| `src/app/core` | Sessão, mensagens de erro e estado de filtros e listas. |
| `src/app/shared` | Componentes e regras reutilizados. |
| `src/app/features/management` | Residentes, responsáveis, supervisores, cursos, alojamentos, quartos e alocações. |
| `src/app/features/operations` | Chamada noturna e saídas curtas e longas. |
| `src/app/features/communications` | Notificações, advertências, termos, avisos e conversas do WhatsApp. |
| `src/app/features/cleaning` | Avaliações de limpeza, indicadores e ranking. |
| `src/app/features/reports` | Relatórios em PDF e Excel. |
| `src/app/features/portal` | Acesso, início de cada perfil e recuperação de senha. |

As rotas ficam em `src/app/app.routes.ts`, os estilos globais em `src/styles.scss` e os arquivos públicos, inclusive a marca oficial do IF Goiano, em `public/`. A direção visual está em [DESIGN.md](../DESIGN.md).
