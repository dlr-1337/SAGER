CREATE TABLE sager_short_exit (
    id UUID PRIMARY KEY,
    resident_id UUID NOT NULL REFERENCES sager_resident(id),
    resident_name VARCHAR(200) NOT NULL,
    enrollment VARCHAR(64) NOT NULL,
    departure_mode VARCHAR(16) NOT NULL CHECK (departure_mode IN ('NOW', 'SCHEDULED')),
    requested_departure_at TIMESTAMPTZ NOT NULL,
    expected_return_at TIMESTAMPTZ NOT NULL,
    reason VARCHAR(2000) NOT NULL CHECK (LENGTH(BTRIM(reason)) BETWEEN 3 AND 2000),
    notes VARCHAR(2000),
    status VARCHAR(40) NOT NULL DEFAULT 'AGUARDANDO_ANALISE',
    decision VARCHAR(16),
    decision_comment VARCHAR(2000),
    decided_at TIMESTAMPTZ,
    actual_departure_at TIMESTAMPTZ,
    actual_return_at TIMESTAMPTZ,
    late_observation VARCHAR(2000),
    cancellation_reason VARCHAR(2000),
    expiry_reason VARCHAR(40),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT sager_short_exit_duration_valid CHECK (
        expected_return_at > requested_departure_at
        AND expected_return_at <= requested_departure_at + INTERVAL '3 hours'
    ),
    CONSTRAINT sager_short_exit_version_valid CHECK (version >= 0),
    CONSTRAINT sager_short_exit_decision_valid CHECK ((
        (decision IS NULL AND decided_at IS NULL AND decision_comment IS NULL)
        OR (decision = 'APPROVE' AND decided_at IS NOT NULL)
        OR (decision = 'REJECT' AND decided_at IS NOT NULL AND decision_comment IS NOT NULL
            AND LENGTH(BTRIM(decision_comment)) BETWEEN 10 AND 2000)
    ) IS TRUE),
    CONSTRAINT sager_short_exit_physical_valid CHECK ((
        (actual_departure_at IS NULL AND actual_return_at IS NULL)
        OR (actual_departure_at IS NOT NULL AND actual_departure_at >= requested_departure_at
            AND actual_departure_at < expected_return_at
            AND decision = 'APPROVE' AND decided_at <= actual_departure_at
            AND (actual_return_at IS NULL OR actual_return_at > actual_departure_at))
    ) IS TRUE),
    CONSTRAINT sager_short_exit_status_valid CHECK ((
        (status = 'AGUARDANDO_ANALISE' AND decision IS NULL AND actual_departure_at IS NULL)
        OR (status = 'APROVADA' AND decision = 'APPROVE' AND actual_departure_at IS NULL)
        OR (status = 'REJEITADA' AND decision = 'REJECT' AND actual_departure_at IS NULL)
        OR (status = 'CANCELADA' AND actual_departure_at IS NULL AND cancellation_reason IS NOT NULL
            AND LENGTH(BTRIM(cancellation_reason)) BETWEEN 10 AND 2000)
        OR (status = 'EXPIRADA' AND actual_departure_at IS NULL AND expiry_reason IS NOT NULL)
        OR (status = 'EM_ANDAMENTO' AND decision = 'APPROVE' AND actual_departure_at IS NOT NULL
            AND actual_return_at IS NULL)
        OR (status = 'RETORNO_CONFIRMADO' AND actual_return_at IS NOT NULL
            AND actual_return_at <= expected_return_at)
        OR (status = 'RETORNO_CONFIRMADO_COM_ATRASO' AND actual_return_at > expected_return_at
            AND late_observation IS NOT NULL AND LENGTH(BTRIM(late_observation)) BETWEEN 10 AND 2000)
    ) IS TRUE)
);
CREATE UNIQUE INDEX sager_short_exit_physical_open_unique ON sager_short_exit(resident_id)
    WHERE actual_departure_at IS NOT NULL AND actual_return_at IS NULL;
CREATE INDEX sager_short_exit_owner_history_idx ON sager_short_exit(resident_id, created_at DESC, id);
CREATE INDEX sager_short_exit_pending_deadline_idx ON sager_short_exit(status, requested_departure_at,
    expected_return_at) WHERE status IN ('AGUARDANDO_ANALISE', 'APROVADA');

CREATE TABLE sager_short_exit_history (
    sequence BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id UUID NOT NULL UNIQUE,
    exit_id UUID NOT NULL REFERENCES sager_short_exit(id),
    event VARCHAR(32) NOT NULL,
    resulting_version BIGINT NOT NULL CHECK (resulting_version >= 0),
    occurred_at TIMESTAMPTZ NOT NULL,
    effective_at TIMESTAMPTZ,
    actor_id UUID,
    actor_profile VARCHAR(32),
    origin VARCHAR(32) NOT NULL,
    justification VARCHAR(2000),
    departure_mode VARCHAR(16) NOT NULL,
    requested_departure_at TIMESTAMPTZ NOT NULL,
    expected_return_at TIMESTAMPTZ NOT NULL,
    reason VARCHAR(2000) NOT NULL,
    notes VARCHAR(2000),
    status VARCHAR(40) NOT NULL,
    decision VARCHAR(16),
    decision_comment VARCHAR(2000),
    actual_departure_at TIMESTAMPTZ,
    actual_return_at TIMESTAMPTZ,
    late_observation VARCHAR(2000),
    cancellation_reason VARCHAR(2000),
    expiry_reason VARCHAR(40),
    CONSTRAINT sager_short_exit_history_version_unique UNIQUE(exit_id, resulting_version),
    CONSTRAINT sager_short_exit_history_actor_valid CHECK ((
        (origin = 'LOCAL_API' AND actor_id IS NOT NULL AND actor_profile IS NOT NULL
            AND actor_profile IN ('supervisor', 'residente'))
        OR (origin = 'SYSTEM_JOB' AND actor_id IS NULL AND actor_profile IS NULL)
    ) IS TRUE)
);
CREATE INDEX sager_short_exit_history_idx ON sager_short_exit_history(exit_id, sequence);

ALTER TABLE sager_audit_event ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE sager_audit_event ALTER COLUMN actor_profile DROP NOT NULL;
ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_origin_allowed;
ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_origin_allowed
    CHECK (origin IN ('LOCAL_API', 'SYSTEM_JOB'));
ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_origin_actor_valid CHECK (
    (origin = 'LOCAL_API' AND actor_id IS NOT NULL AND actor_profile IS NOT NULL)
    OR (origin = 'SYSTEM_JOB' AND actor_id IS NULL AND actor_profile IS NULL)
);

DO $$
DECLARE current_check TEXT;
BEGIN
    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid = 'sager_audit_event'::regclass
        AND conname = 'sager_audit_event_resource_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_resource_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_resource_allowed
        CHECK ((%s) OR resource = ''SHORT_EXIT'')', current_check);

    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid = 'sager_audit_event'::regclass
        AND conname = 'sager_audit_event_changed_fields_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_changed_fields_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_changed_fields_allowed
        CHECK ((%s) OR (resource = ''SHORT_EXIT'' AND array_position(changed_fields, NULL) IS NULL
            AND changed_fields <@ ARRAY[''residentId'', ''departureMode'', ''requestedDepartureAt'',
                ''expectedReturnAt'', ''reason'', ''notes'', ''status'', ''decision'', ''decisionComment'',
                ''actualDepartureAt'', ''actualReturnAt'', ''lateObservation'', ''cancellationReason'',
                ''expiryReason'']::TEXT[]))', current_check);
END;
$$;
