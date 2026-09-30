CREATE TABLE sager_audit_event (
    sequence BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    actor_id UUID NOT NULL,
    actor_profile VARCHAR(32) NOT NULL,
    origin VARCHAR(32) NOT NULL,
    request_id UUID NOT NULL,
    resource VARCHAR(32) NOT NULL,
    resource_id UUID NOT NULL,
    action VARCHAR(16) NOT NULL,
    resulting_version BIGINT NOT NULL,
    changed_fields TEXT[] NOT NULL,
    CONSTRAINT sager_audit_event_profile_allowed
        CHECK (actor_profile IN ('gestor', 'supervisor', 'residente')),
    CONSTRAINT sager_audit_event_origin_allowed CHECK (origin = 'LOCAL_API'),
    CONSTRAINT sager_audit_event_resource_allowed CHECK (resource IN (
        'SUPERVISOR', 'RESIDENT', 'GUARDIAN', 'ACCOMMODATION',
        'ACCOMMODATION_UNIT', 'ROOM', 'ALLOCATION'
    )),
    CONSTRAINT sager_audit_event_action_allowed CHECK (action IN ('CREATE', 'UPDATE', 'END')),
    CONSTRAINT sager_audit_event_version_nonnegative CHECK (resulting_version >= 0),
    CONSTRAINT sager_audit_event_changed_fields_allowed CHECK (
        array_position(changed_fields, NULL) IS NULL
        AND changed_fields <@ CASE resource
            WHEN 'SUPERVISOR' THEN ARRAY['name', 'institutionalId', 'email']
            WHEN 'RESIDENT' THEN ARRAY['name', 'enrollment', 'birthDate', 'course']
            WHEN 'GUARDIAN' THEN ARRAY['residentId', 'name', 'relationship', 'phone', 'active']
            WHEN 'ACCOMMODATION' THEN ARRAY['code', 'name']
            WHEN 'ACCOMMODATION_UNIT' THEN ARRAY['accommodationId', 'code', 'name']
            WHEN 'ROOM' THEN ARRAY['code', 'number', 'accommodationId', 'unitId', 'floor',
                                   'capacity', 'situation']
            WHEN 'ALLOCATION' THEN ARRAY['residentId', 'roomId', 'startedAt', 'endedAt', 'endReason']
            ELSE ARRAY[]::TEXT[]
        END
    )
);

-- Deliberately no references to accounts or domain rows: their lifecycle cannot
-- remove or rewrite the permanent record. Existing rows are not backfilled.
CREATE INDEX sager_audit_event_resource_sequence_idx
    ON sager_audit_event (resource_id, sequence DESC);
CREATE INDEX sager_audit_event_actor_sequence_idx
    ON sager_audit_event (actor_id, sequence DESC);
CREATE INDEX sager_audit_event_request_sequence_idx
    ON sager_audit_event (request_id, sequence DESC);
CREATE INDEX sager_audit_event_type_sequence_idx
    ON sager_audit_event (resource, sequence DESC);

CREATE FUNCTION sager_reject_audit_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Audit events are immutable.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sager_audit_event_no_update_delete
    BEFORE UPDATE OR DELETE ON sager_audit_event
    FOR EACH STATEMENT EXECUTE FUNCTION sager_reject_audit_mutation();

CREATE TRIGGER sager_audit_event_no_truncate
    BEFORE TRUNCATE ON sager_audit_event
    FOR EACH STATEMENT EXECUTE FUNCTION sager_reject_audit_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON sager_audit_event FROM PUBLIC;
