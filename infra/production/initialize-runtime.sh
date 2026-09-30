#!/bin/sh
# Run after every schema migration, with operator secrets mounted in this container only.
set -eu
export PGPASSWORD="$(cat /run/secrets/db_owner_password)"
export SAGER_RUNTIME_PASSWORD="$(cat /run/secrets/db_runtime_password)"
test "${#SAGER_RUNTIME_PASSWORD}" -ge 32
test "$PGPASSWORD" != "$SAGER_RUNTIME_PASSWORD"
psql --no-psqlrc --no-password --host=database --username=sager_owner --dbname=sager \
  --set=ON_ERROR_STOP=1 <<'SQL'
SET log_min_error_statement = 'fatal';
\getenv runtime_password SAGER_RUNTIME_PASSWORD
SELECT 'CREATE ROLE sager_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sager_runtime') \gexec
ALTER ROLE sager_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'runtime_password';
REVOKE ALL ON DATABASE sager FROM PUBLIC;
GRANT CONNECT ON DATABASE sager TO sager_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO sager_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sager_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sager_runtime;
REVOKE ALL ON TABLE flyway_schema_history FROM sager_runtime;
GRANT SELECT ON TABLE flyway_schema_history TO sager_runtime;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE sager_audit_event FROM sager_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE sager_owner IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
SQL
unset PGPASSWORD SAGER_RUNTIME_PASSWORD
echo 'Runtime role configured; migration credentials remain separate.'
