# Repository Guidelines

## Project Structure & Module Organization

`frontend/` contains the Angular 22 standalone application. Put shared UI in `frontend/src/app/shared/`, demo session logic in `core/`, and domain pages, routes, models, styles, and demo services in `features/` (`management`, `operations`, `communications`, `reports`, `signature`, and `portal`). Global styles live in `frontend/src/styles.scss`; public assets, including the official IF Goiano mark, live in `frontend/public/`. Keep unit tests beside their source as `*.spec.ts`; browser tests live in `frontend/e2e/`. The root PRD, technical specification, `PRODUCT.md`, `DESIGN.md`, and `.impeccable/` record requirements and approved visual direction. There is no backend in this repository yet.

## Build, Test, and Development Commands

Run these from `frontend/`:

- `npm ci` — install the locked dependencies.
- `npm start` — serve the demo at `http://localhost:4200/acesso`.
- `npm run build` — compile the production bundle and check Angular templates.
- `npm test -- --watch=false` — run unit and component tests once.
- `npm run test:e2e` — run Playwright journeys; its configuration starts the dev server.

## Coding Style & Naming Conventions

Use two-space indentation, single quotes, and a 100-character print width as configured in `frontend/.prettierrc`. Format touched files with `npx prettier --write <path>`. Follow existing kebab-case filenames and suffixes such as `resident-form.component.ts`, `reports.pages.ts`, and `management-demo.service.ts`. Prefer standalone components, typed Reactive Forms, Signals, and feature-level services. Keep important actions clearly labeled and preserve the approved responsive design; use Impeccable for UI changes.

## Testing Guidelines

Angular unit tests use Vitest through `ng test`; end-to-end tests use Playwright and `@axe-core/playwright`. Add or update focused `*.spec.ts` tests for changed rules, permissions, forms, and navigation. Cover critical paths and accessibility behavior in `frontend/e2e/`. No numeric coverage threshold is configured; report the commands run and any untested risk.

## Commit & Pull Request Guidelines

History uses small, purpose-based commits such as `feat(frontend): ...`, `test(e2e): ...`, `docs: ...`, and `chore(repo): ...`. Keep unrelated changes in separate commits. In pull requests, summarize the behavior, cite relevant PRD requirements or acceptance criteria, list verification commands, and include before/after screenshots for visual changes.

## Security & Demo Data

Use synthetic records only. The current profile selector and guards demonstrate navigation; they do not provide real authentication or server authorization. Do not commit credentials, resident data, the excluded DOCX/PDF originals, or generated build output. Keep the official IF Goiano mark unmodified.
