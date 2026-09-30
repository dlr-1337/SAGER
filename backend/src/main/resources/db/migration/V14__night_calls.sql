CREATE TABLE sager_night_call (
    id UUID PRIMARY KEY,
    accommodation_id UUID NOT NULL REFERENCES sager_accommodation(id),
    accommodation_name VARCHAR(200) NOT NULL,
    reference_date DATE NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ABERTA',
    opened_at TIMESTAMPTZ NOT NULL,
    opened_by UUID NOT NULL,
    closed_at TIMESTAMPTZ,
    closed_by UUID,
    outside_window_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    justification VARCHAR(2000),
    close_outside_window_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    close_justification VARCHAR(2000),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT sager_night_call_day_unique UNIQUE(accommodation_id, reference_date),
    CONSTRAINT sager_night_call_status_valid CHECK ((
        (status = 'ABERTA' AND closed_at IS NULL AND closed_by IS NULL)
        OR (status = 'FECHADA' AND closed_at >= opened_at AND closed_by IS NOT NULL)
    ) IS TRUE),
    CONSTRAINT sager_night_call_version_valid CHECK (version >= 0),
    CONSTRAINT sager_night_call_exception_valid CHECK ((
        (NOT outside_window_confirmed AND justification IS NULL)
        OR (outside_window_confirmed AND LENGTH(BTRIM(justification)) BETWEEN 10 AND 2000)
    ) IS TRUE),
    CONSTRAINT sager_night_call_close_exception_valid CHECK ((
        (NOT close_outside_window_confirmed AND close_justification IS NULL)
        OR (close_outside_window_confirmed AND LENGTH(BTRIM(close_justification)) BETWEEN 10 AND 2000)
    ) IS TRUE)
);

CREATE TABLE sager_night_call_mark (
    id UUID PRIMARY KEY,
    call_id UUID NOT NULL REFERENCES sager_night_call(id),
    resident_id UUID NOT NULL REFERENCES sager_resident(id),
    resident_name VARCHAR(200) NOT NULL,
    enrollment VARCHAR(64) NOT NULL,
    birth_date DATE NOT NULL,
    room_id UUID NOT NULL,
    room_number VARCHAR(64) NOT NULL,
    mark VARCHAR(32),
    authorized_exit_id UUID,
    authorized_exit_type VARCHAR(8),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT sager_night_call_mark_resident_unique UNIQUE(call_id, resident_id),
    CONSTRAINT sager_night_call_mark_version_valid CHECK (version >= 0),
    CONSTRAINT sager_night_call_mark_valid CHECK ((
        (mark IS NULL AND authorized_exit_id IS NULL AND authorized_exit_type IS NULL)
        OR (mark IN ('PRESENTE', 'AUSENTE') AND authorized_exit_id IS NULL AND authorized_exit_type IS NULL)
        OR (mark = 'AUSENCIA_JUSTIFICADA' AND authorized_exit_id IS NOT NULL
            AND authorized_exit_type IS NOT NULL AND authorized_exit_type IN ('SHORT', 'LONG'))
    ) IS TRUE)
);

CREATE TABLE sager_night_call_mark_history (
    sequence BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id UUID NOT NULL UNIQUE,
    mark_id UUID NOT NULL REFERENCES sager_night_call_mark(id),
    mark VARCHAR(32) NOT NULL CHECK (mark IN ('PRESENTE', 'AUSENTE', 'AUSENCIA_JUSTIFICADA')),
    authorized_exit_id UUID,
    authorized_exit_type VARCHAR(8),
    justification VARCHAR(2000),
    recorded_at TIMESTAMPTZ NOT NULL,
    actor_id UUID NOT NULL,
    actor_profile VARCHAR(32) NOT NULL CHECK (actor_profile = 'supervisor'),
    resulting_version BIGINT NOT NULL CHECK (resulting_version >= 1),
    call_version BIGINT NOT NULL CHECK (call_version >= 1),
    CONSTRAINT sager_night_call_mark_history_authorization_valid CHECK ((
        (mark IN ('PRESENTE', 'AUSENTE') AND authorized_exit_id IS NULL AND authorized_exit_type IS NULL)
        OR (mark = 'AUSENCIA_JUSTIFICADA' AND authorized_exit_id IS NOT NULL
            AND authorized_exit_type IS NOT NULL AND authorized_exit_type IN ('SHORT', 'LONG'))
    ) IS TRUE)
);
CREATE INDEX sager_night_call_date_idx ON sager_night_call(reference_date DESC, accommodation_id);
CREATE INDEX sager_night_call_mark_history_idx ON sager_night_call_mark_history(mark_id, sequence);

-- Extend the installed constraints, including any resource introduced by V13.
-- Definitions come only from PostgreSQL metadata, never from request input.
DO $$
DECLARE current_check TEXT;
BEGIN
    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid = 'sager_audit_event'::regclass
        AND conname = 'sager_audit_event_resource_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_resource_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_resource_allowed
        CHECK ((%s) OR resource IN (''NIGHT_CALL'', ''NIGHT_CALL_MARK''))', current_check);

    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid = 'sager_audit_event'::regclass
        AND conname = 'sager_audit_event_changed_fields_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_changed_fields_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_changed_fields_allowed
        CHECK ((%s) OR (array_position(changed_fields, NULL) IS NULL AND (
            (resource = ''NIGHT_CALL'' AND changed_fields <@ ARRAY[''accommodationId'', ''referenceDate'',
                ''status'', ''closedAt'', ''outsideWindowConfirmed'', ''justification'']::TEXT[])
            OR (resource = ''NIGHT_CALL_MARK'' AND changed_fields <@ ARRAY[''callId'', ''residentId'',
                ''mark'', ''authorizedExitId'', ''authorizedExitType'', ''justification'']::TEXT[])
        )))', current_check);
END;
$$;
