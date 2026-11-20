# Project Structure

O SAGER é um projeto fullstack com frontend Angular standalone e backend Spring
Boot/JDBC em módulos separados.

## Modules and layers

| Module | Main layers | Functional areas |
|---|---|---|
| `frontend/` | routes, standalone pages/components, feature services, models/utils, shared UI, core session/auth | portal, management, operations, health, communications, cleaning, reports, signature |
| `backend/` | controllers, application services, JDBC repositories, integration workers, Flyway migrations, integration tests | auth, management, operations, health, discipline, communications, cleaning/reports, audit, integrations |

Frontend entry points are `src/main.ts`, `src/app/app.ts`, `src/app/app.config.ts`
and `src/app/app.routes.ts`. Backend entry point is
`src/main/java/br/edu/ifgoiano/sager/SagerApplication.java`; scheduled entry
points include exit expiry and report export workers.

The frontend has 138 TypeScript files, 12 SCSS files and 35 unit-spec files under
`src/app`, plus Playwright journeys under `e2e`. The backend has 147 Java files
under `src/main/java` and 38 integration test classes.

## Structural cleanup observations

- `frontend/src/app/features/management` repeats list/detail/form patterns for
  residents, guardians, rooms, accommodations and supervisors.
- `frontend/src/app/features/operations` contains parallel local/API/demo
  implementations and repeated exit workflows.
- `frontend/src/app/features/communications` and `cleaning` repeat local-page
  loading/error/form/filter patterns.
- `backend` keeps domain services and repositories reasonably separated, but
  actor resolution, time conversion, existence checks, locks and optimistic
  version checks are repeated across modules.
- Integration task claiming, retries, webhook handling and signature state
  transitions are concentrated in `IntegrationTransactions.java`; split
  candidates must preserve the transaction boundaries.

