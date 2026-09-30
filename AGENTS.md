# Repository Guidelines

## Project Structure & Module Organization

`frontend/` contains the Angular 22 standalone application. Put shared UI in `frontend/src/app/shared/`, session logic in `core/`, and domain pages, routes, models, styles, and services in `features/` (`management`, `operations`, `communications`, `reports`, `signature`, and `portal`). Global styles live in `frontend/src/styles.scss`; public assets, including the official IF Goiano mark, live in `frontend/public/`. Keep unit tests beside their source as `*.spec.ts`; browser tests live in `frontend/e2e/`. `backend/` contains the Spring Boot application, feature packages under `src/main/java/br/edu/ifgoiano/sager/`, Flyway migrations under `src/main/resources/db/migration/`, and tests under `src/test/java/`. The root PRD, technical specification, `PRODUCT.md`, `DESIGN.md`, and `.impeccable/` record requirements and approved visual direction.

## Build, Test, and Development Commands

Run these from `frontend/`:

- `npm ci` — install the locked dependencies.
- `npm start` — serve the demo at `http://localhost:4200/acesso`.
- `npm run build` — compile the production bundle and check Angular templates.
- `npm test -- --watch=false` — run unit and component tests once.
- `npm run test:e2e` — run Playwright journeys; its configuration starts the dev server.

Run `./mvnw -B -ntp verify` from `backend/` (`.\mvnw.cmd` on Windows) with JDK 21 and Docker available. Testcontainers creates disposable PostgreSQL databases; no application database or account is required for tests. See `backend/README.md` for local provisioning and `docs/CI.md` for the GitHub Actions pipeline and browser test selection.

## Coding Style & Naming Conventions

Use two-space indentation, single quotes, and a 100-character print width as configured in `frontend/.prettierrc`. Format touched files with `npx prettier --write <path>`. Follow existing kebab-case filenames and suffixes such as `resident-form.component.ts`, `reports.pages.ts`, and `management-demo.service.ts`. Prefer standalone components, typed Reactive Forms, Signals, and feature-level services. Keep important actions clearly labeled and preserve the approved responsive design; use Impeccable for UI changes.

## Testing Guidelines

Angular unit tests use Vitest through `ng test`; end-to-end tests use Playwright and `@axe-core/playwright`. Add or update focused `*.spec.ts` tests for changed rules, permissions, forms, and navigation. Cover critical paths and accessibility behavior in `frontend/e2e/`. Backend integration tests use JUnit and PostgreSQL Testcontainers; verify migrations, constraints, permissions, CSRF, version conflicts and concurrent changes for the affected feature. Browser journeys with intercepted API calls verify the interface; they do not prove the complete application works against PostgreSQL. No numeric coverage threshold is configured; report the commands run and any untested risk.

## Commit & Pull Request Guidelines

History uses small, purpose-based commits such as `feat(frontend): ...`, `test(e2e): ...`, `docs: ...`, and `chore(repo): ...`. Keep unrelated changes in separate commits. In pull requests, summarize the behavior, cite relevant PRD requirements or acceptance criteria, list verification commands, and include before/after screenshots for visual changes.

## Security & Demo Data

Use synthetic records only. The public demonstration uses profile selection and in-memory data. The project has chosen SAGER-owned email/password accounts; Google and SUAP integrations are deferred. The current implementation uses operator-provisioned accounts, server sessions, CSRF and endpoint permissions only in the `local` profile bound to loopback. Keep the API closed outside `local` until production security, account provisioning/recovery, session policy, record authorization and deployment configuration are implemented and verified. Do not substitute demo data after a local API failure. Do not commit credentials, resident data, the excluded DOCX/PDF/ZIP originals, or generated build output. Keep the official IF Goiano mark unmodified.

## Current Domain Decisions

In the integrated management resources, gestor and supervisor have equal read/write permissions, including moves. New resident POST/PUT requests require name, enrollment and birth date; course is optional. Flyway V10 preserves legacy residents without birth dates for reading while requiring the date on future inserts and updates. Resident enrollment is entered manually until an authorized SUAP integration exists, and creating a resident does not create a login account. A future long exit requires one valid signature from any registered, linked guardian; that flow is not implemented yet. Permanent retention currently applies to audit records only; sharing health data among authorized professionals requires a future separate resource and permission model.
