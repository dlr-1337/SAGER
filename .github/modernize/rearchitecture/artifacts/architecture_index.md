# Architecture Index

This index is not the full contract. Do not implement from this file alone; follow
the artifact paths below.

## Global artifacts

- `project-structure.md`: module and layer boundaries; use to avoid moving a file across domains without checking routes and tests.
- `tech-stack.md`: framework/runtime facts and constraints.
- `data-model.md`: persistence groups and snapshot rules.
- `unit_graph.yaml`: unit triggers, dependencies, public signatures and shared refs.
- `shared_modules.yaml`: reusable code registry and god-class candidates.
- `cross_unit_state.yaml`: implicit session, request and runtime-selection flows.
- `wire_contracts.yaml`: frozen REST/browser/provider contracts.
- `migration_boundary.yaml`: phased cleanup scope; no source file is automatically a deletion target.

## Implementation Guide

For each unit, read its `behavior.yaml`, `bindings.yaml` and
`unit_decomposition.yaml`, then filter global rows by unit name. Before DONE,
report artifact paths read, reusable modules extracted, `must_preserve` behavior,
deferred cleanup and unit-focused tests/build evidence.

### Unit: auth

- External trigger: login/session/current-account APIs and security filters.
- Read `units/auth/*`, global `cross_unit_state.yaml` auth rows and all frozen auth contracts.
- Preserve session principal, profile checks, CSRF and rate-limit behavior.

### Unit: management

- External trigger: management CRUD routes and pages.
- Read `units/management/*`, shared rows for request state/review dialog/JDBC primitives.
- Preserve route paths, optimistic versions, audit and resident/room relationships.

### Unit: operations

- External trigger: night calls, short/long exits, notifications and scheduled expiry.
- Read `units/operations/*`, wire contracts and the time/session flows.
- Preserve America/Sao_Paulo civil-time rules, supervisor-only movement and history snapshots.

### Unit: health

- External trigger: professional access and resident health routes.
- Read `units/health/*` and data-model PHI rows.
- Preserve grant, assignment, share/custody authorization and immutable notes.

### Unit: discipline

- External trigger: occurrence, notification, warning and term APIs.
- Read `units/discipline/*` and cross-unit evidence flows.
- Preserve idempotency, source evidence versions and audit semantics.

### Unit: communications

- External trigger: notices, communications and recipient actions.
- Read `units/communications/*` and shared date/state helpers.
- Preserve publication state and recipient acknowledgment contracts.

### Unit: cleaning-reports

- External trigger: cleaning assessments/indicators and report/export APIs/jobs.
- Read `units/cleaning-reports/*`, data-model snapshots and scheduled binding rows.
- Preserve immutable corrections, snapshot expiry and export leases.

### Unit: integrations-signature

- External trigger: provider callbacks, signature access and workers.
- Read `units/integrations-signature/*`, wire contracts and integration-transactions shared row.
- Preserve HMAC/token verification, idempotency, leases, retries and the rule that callbacks never approve exits.

## Cleanup sequencing

1. Extract shared Angular date/state primitives and replace duplicate call sites.
2. Standardize typed CRUD page helpers by composition, not inheritance.
3. Centralize backend actor/time/lock/version mechanics while retaining domain-specific errors.
4. Split `IntegrationTransactions` by transaction concern with integration tests.
5. Revisit unused identity/tombstone tables only after production schema evidence.

