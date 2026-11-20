# Data Model

The backend persists PostgreSQL data through Flyway migrations and direct JDBC.
The schema is shared by functional modules but protected by foreign keys,
constraints, service authorization and immutable history tables.

## Entity groups

- Identity/session: `sager_identity`, `sager_identity_profile`,
  `sager_local_account`, `SPRING_SESSION`, `SPRING_SESSION_ATTRIBUTES`.
- Management: supervisor, resident, guardian, accommodation, unit, room and
  room allocation.
- Operations: night calls and marks, short exits, long exits and histories.
- Health: grants, care assignments, notes, revisions, shares and custody.
- Integrations: document versions, signature bindings, WhatsApp attempts,
  resend windows, integration tasks and webhook inbox.
- Discipline/communications: occurrences, revisions, notifications, warnings,
  notices, commitment terms and communication receipts.
- Cleaning/reports: policy, assessments, participants, revisions, snapshots and
  export jobs.
- Cross-cutting: immutable audit events, idempotency and login rate buckets.

## Reuse-relevant relationships

`resident_id`, `account_id`, `room_id`, `version`, timestamps, actor identity
and audit metadata recur across many modules. These are good candidates for
typed shared mappers/helpers, but not for merging domain tables.

## Snapshot rule

Repeated names, enrollment, room numbers and guardian data in operation/history
records are snapshots. They must remain available for historical fidelity even
when the current management record changes.

