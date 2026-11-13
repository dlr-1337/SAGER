-- Removes the health module (remove-health-module). V13 stays as applied history.
-- No health record is ever deleted here: the migration aborts, and the transaction rolls back,
-- when any health table has a row.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM sager_health_grant)
        OR EXISTS (SELECT 1 FROM sager_health_care_assignment)
        OR EXISTS (SELECT 1 FROM sager_health_note)
        OR EXISTS (SELECT 1 FROM sager_health_revision)
        OR EXISTS (SELECT 1 FROM sager_health_share)
        OR EXISTS (SELECT 1 FROM sager_health_custody) THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
            MESSAGE = 'V30 recusada: ha registros de saude. A remocao do modulo nao apaga dados; '
                || 'recrie o banco local sintetico ou leve a decisao a AE antes de migrar.';
    END IF;
END
$$;

-- Explicit list without CASCADE: an unexpected dependent object makes the migration fail.
DROP TABLE sager_health_share, sager_health_custody, sager_health_revision, sager_health_note,
    sager_health_care_assignment, sager_health_grant;
DROP FUNCTION sager_reject_health_document_mutation();

-- Old 'saude' accounts are kept for history and only deactivated. The profile and audit
-- constraints keep accepting the old values so existing rows stay valid.
UPDATE sager_local_account SET active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE profile = 'saude';
