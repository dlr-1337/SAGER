CREATE TABLE sager_long_exit (
    id UUID PRIMARY KEY,
    resident_id UUID NOT NULL REFERENCES sager_resident(id),
    resident_name VARCHAR(200) NOT NULL,
    enrollment VARCHAR(64) NOT NULL,
    guardian_id UUID NOT NULL REFERENCES sager_guardian(id),
    guardian_name VARCHAR(200) NOT NULL,
    guardian_relationship VARCHAR(80) NOT NULL,
    departure_mode VARCHAR(16) NOT NULL CHECK (departure_mode IN ('NOW', 'SCHEDULED')),
    requested_departure_at TIMESTAMPTZ NOT NULL,
    expected_return_at TIMESTAMPTZ NOT NULL,
    reason VARCHAR(2000) NOT NULL CHECK (LENGTH(BTRIM(reason)) BETWEEN 3 AND 2000),
    notes VARCHAR(2000),
    status VARCHAR(40) NOT NULL DEFAULT 'AGUARDANDO_ANALISE',
    current_document_version_id UUID NOT NULL,
    decision VARCHAR(16), decision_comment VARCHAR(2000), decided_at TIMESTAMPTZ,
    actual_departure_at TIMESTAMPTZ, actual_return_at TIMESTAMPTZ,
    late_observation VARCHAR(2000), cancellation_reason VARCHAR(2000), expiry_reason VARCHAR(40),
    created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    CONSTRAINT sager_long_exit_duration_valid CHECK (
        expected_return_at > requested_departure_at + INTERVAL '3 hours'),
    CONSTRAINT sager_long_exit_decision_valid CHECK ((
        (decision IS NULL AND decided_at IS NULL AND decision_comment IS NULL)
        OR (decision = 'APPROVE' AND decided_at IS NOT NULL)
        OR (decision = 'REJECT' AND decided_at IS NOT NULL AND decision_comment IS NOT NULL
            AND LENGTH(BTRIM(decision_comment)) BETWEEN 10 AND 2000)) IS TRUE),
    CONSTRAINT sager_long_exit_physical_valid CHECK ((
        (actual_departure_at IS NULL AND actual_return_at IS NULL)
        OR (actual_departure_at IS NOT NULL AND actual_departure_at >= requested_departure_at
            AND actual_departure_at < expected_return_at AND decision = 'APPROVE'
            AND decided_at <= actual_departure_at
            AND (actual_return_at IS NULL OR actual_return_at > actual_departure_at))) IS TRUE),
    CONSTRAINT sager_long_exit_status_valid CHECK ((
        (status = 'AGUARDANDO_ANALISE' AND decision IS NULL AND actual_departure_at IS NULL)
        OR (status = 'APROVADA' AND decision = 'APPROVE' AND actual_departure_at IS NULL)
        OR (status = 'REJEITADA' AND decision = 'REJECT' AND actual_departure_at IS NULL)
        OR (status = 'CANCELADA' AND actual_departure_at IS NULL AND cancellation_reason IS NOT NULL
            AND LENGTH(BTRIM(cancellation_reason)) BETWEEN 10 AND 2000)
        OR (status = 'EXPIRADA' AND actual_departure_at IS NULL AND expiry_reason IS NOT NULL)
        OR (status = 'EM_ANDAMENTO' AND decision = 'APPROVE' AND actual_departure_at IS NOT NULL
            AND actual_return_at IS NULL)
        OR (status = 'RETORNO_CONFIRMADO' AND actual_return_at IS NOT NULL AND actual_return_at <= expected_return_at)
        OR (status = 'RETORNO_CONFIRMADO_COM_ATRASO' AND actual_return_at > expected_return_at
            AND late_observation IS NOT NULL AND LENGTH(BTRIM(late_observation)) BETWEEN 10 AND 2000)) IS TRUE)
);
CREATE UNIQUE INDEX sager_long_exit_physical_open_unique ON sager_long_exit(resident_id)
    WHERE actual_departure_at IS NOT NULL AND actual_return_at IS NULL;
CREATE INDEX sager_long_exit_owner_idx ON sager_long_exit(resident_id, created_at DESC, id);
CREATE INDEX sager_long_exit_deadline_idx ON sager_long_exit(status, requested_departure_at, expected_return_at)
    WHERE status IN ('AGUARDANDO_ANALISE', 'APROVADA');

CREATE TABLE sager_document_version (
    id UUID PRIMARY KEY, exit_id UUID NOT NULL REFERENCES sager_long_exit(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL CHECK (revision_number > 0), template_version VARCHAR(32) NOT NULL,
    snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
    original_file_id UUID NOT NULL UNIQUE, original_hash CHAR(64) NOT NULL CHECK (original_hash ~ '^[0-9a-f]{64}$'),
    original_size BIGINT NOT NULL CHECK (original_size BETWEEN 1 AND 10485760),
    original_state VARCHAR(16) NOT NULL CHECK (original_state = 'STORED'),
    signed_file_id UUID UNIQUE, signed_hash CHAR(64), signed_size BIGINT,
    signed_state VARCHAR(16) NOT NULL DEFAULT 'MISSING' CHECK (signed_state IN ('MISSING', 'STORED')),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT sager_document_version_revision_unique UNIQUE (exit_id, revision_number),
    CONSTRAINT sager_document_version_exit_id_unique UNIQUE (exit_id, id),
    CONSTRAINT sager_document_version_signed_valid CHECK ((
        (signed_state = 'MISSING' AND signed_file_id IS NULL AND signed_hash IS NULL AND signed_size IS NULL)
        OR (signed_state = 'STORED' AND signed_file_id IS NOT NULL AND signed_hash ~ '^[0-9a-f]{64}$'
            AND signed_size BETWEEN 1 AND 10485760)) IS TRUE)
);
ALTER TABLE sager_long_exit ADD CONSTRAINT sager_long_exit_current_document_fk
    FOREIGN KEY(id, current_document_version_id) REFERENCES sager_document_version(exit_id, id)
    DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION sager_document_snapshot_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(NEW.id,NEW.exit_id,NEW.revision_number,NEW.template_version,NEW.snapshot,NEW.original_file_id,
            NEW.original_hash,NEW.original_size,NEW.original_state,NEW.created_at)
        IS DISTINCT FROM ROW(OLD.id,OLD.exit_id,OLD.revision_number,OLD.template_version,OLD.snapshot,
            OLD.original_file_id,OLD.original_hash,OLD.original_size,OLD.original_state,OLD.created_at)
        OR (OLD.signed_state = 'STORED' AND ROW(NEW.signed_file_id,NEW.signed_hash,NEW.signed_size,NEW.signed_state)
            IS DISTINCT FROM ROW(OLD.signed_file_id,OLD.signed_hash,OLD.signed_size,OLD.signed_state)) THEN
        RAISE EXCEPTION 'Document revision is immutable.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER sager_document_snapshot_immutable BEFORE UPDATE ON sager_document_version
    FOR EACH ROW EXECUTE FUNCTION sager_document_snapshot_immutable();

CREATE TABLE sager_signature_binding (
    id UUID PRIMARY KEY, exit_id UUID NOT NULL REFERENCES sager_long_exit(id) ON DELETE CASCADE,
    document_version_id UUID NOT NULL REFERENCES sager_document_version(id),
    guardian_id UUID NOT NULL REFERENCES sager_guardian(id), guardian_version BIGINT NOT NULL CHECK (guardian_version >= 0),
    guardian_name VARCHAR(200) NOT NULL, guardian_relationship VARCHAR(80) NOT NULL,
    guardian_phone VARCHAR(16) NOT NULL CHECK (guardian_phone ~ '^\+55[1-9][0-9]{9,10}$'),
    provider VARCHAR(16) NOT NULL DEFAULT 'CLICKSIGN' CHECK (provider = 'CLICKSIGN'),
    environment VARCHAR(16) NOT NULL CHECK (environment IN ('sandbox', 'production', 'disabled')),
    status VARCHAR(16) NOT NULL CHECK (status IN ('UNAVAILABLE','PENDING','VALID','FAILED','UNCERTAIN','EXPIRED','INVALIDATED')),
    stage VARCHAR(32) NOT NULL DEFAULT 'ENVELOPE' CHECK (stage IN ('ENVELOPE','DOCUMENT','SIGNER','AGREE','SMS','ACTIVATE','DONE')),
    envelope_id UUID, provider_document_id UUID, signer_id UUID, agree_requirement_id UUID, sms_requirement_id UUID,
    token_hash CHAR(64) UNIQUE CHECK (token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$'),
    issued_at TIMESTAMPTZ, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ,
    signed_at TIMESTAMPTZ, verified_at TIMESTAMPTZ, verified_api BOOLEAN NOT NULL DEFAULT FALSE,
    evidence_hash CHAR(64), failure_code VARCHAR(64), created_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    CONSTRAINT sager_signature_binding_document_fk FOREIGN KEY(exit_id,document_version_id)
        REFERENCES sager_document_version(exit_id,id),
    CONSTRAINT sager_signature_binding_deadline_valid CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL '24 hours'),
    CONSTRAINT sager_signature_binding_token_valid CHECK ((token_hash IS NULL AND issued_at IS NULL)
        OR (token_hash IS NOT NULL AND issued_at IS NOT NULL AND issued_at <= expires_at)),
    CONSTRAINT sager_signature_binding_valid CHECK ((status <> 'VALID' OR (verified_api AND signed_at IS NOT NULL
        AND verified_at >= signed_at AND signed_at < expires_at AND signed_at >= created_at
        AND evidence_hash ~ '^[0-9a-f]{64}$' AND stage = 'DONE' AND revoked_at IS NULL)) IS TRUE)
);
CREATE UNIQUE INDEX sager_signature_envelope_unique ON sager_signature_binding(provider, environment,envelope_id) WHERE envelope_id IS NOT NULL;
CREATE INDEX sager_signature_document_idx ON sager_signature_binding(provider_document_id);
CREATE INDEX sager_signature_current_idx ON sager_signature_binding(exit_id,document_version_id,created_at DESC);

CREATE TABLE sager_whatsapp_attempt (
    id UUID PRIMARY KEY, binding_id UUID NOT NULL REFERENCES sager_signature_binding(id) ON DELETE CASCADE,
    recipient VARCHAR(15) NOT NULL CHECK (recipient ~ '^55[1-9][0-9]{9,10}$'),
    status VARCHAR(16) NOT NULL CHECK (status IN ('QUEUED','ACCEPTED','SENT','DELIVERED','READ','FAILED','UNCERTAIN')),
    provider_message_id VARCHAR(512), created_at TIMESTAMPTZ NOT NULL, accepted_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, read_at TIMESTAMPTZ, status_at TIMESTAMPTZ,
    failure_code VARCHAR(64), version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    CONSTRAINT sager_whatsapp_message_unique UNIQUE (provider_message_id),
    CONSTRAINT sager_whatsapp_acceptance_valid CHECK ((status NOT IN ('ACCEPTED','SENT','DELIVERED','READ')
        OR (provider_message_id IS NOT NULL AND accepted_at IS NOT NULL)) IS TRUE)
);
CREATE TABLE sager_long_exit_resend (
    id UUID PRIMARY KEY, exit_id UUID NOT NULL REFERENCES sager_long_exit(id) ON DELETE CASCADE,
    binding_id UUID NOT NULL REFERENCES sager_signature_binding(id),
    requested_at TIMESTAMPTZ NOT NULL, actor_id UUID NOT NULL, reason VARCHAR(2000) NOT NULL
        CHECK (LENGTH(BTRIM(reason)) BETWEEN 10 AND 2000)
);
CREATE INDEX sager_long_exit_resend_window_idx ON sager_long_exit_resend(exit_id,requested_at DESC);

CREATE TABLE sager_integration_task (
    id UUID PRIMARY KEY, binding_id UUID NOT NULL REFERENCES sager_signature_binding(id) ON DELETE CASCADE,
    type VARCHAR(16) NOT NULL CHECK (type IN ('PROVISION','WHATSAPP','RECONCILE','CANCEL')),
    state VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','RUNNING','SUCCEEDED','FAILED','UNCERTAIN','CANCELLED')),
    idempotency_key VARCHAR(200) NOT NULL UNIQUE,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
    in_flight BOOLEAN NOT NULL DEFAULT FALSE,
    next_attempt_at TIMESTAMPTZ NOT NULL, lease_until TIMESTAMPTZ, lease_owner UUID,
    failure_code VARCHAR(64), created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    CONSTRAINT sager_integration_task_lease_valid CHECK ((state <> 'RUNNING' OR lease_until IS NOT NULL) IS TRUE)
);
CREATE INDEX sager_integration_task_due_idx ON sager_integration_task(state,next_attempt_at,lease_until);
CREATE TABLE sager_webhook_inbox (
    id UUID PRIMARY KEY, provider VARCHAR(16) NOT NULL CHECK (provider IN ('CLICKSIGN','WHATSAPP')),
    environment VARCHAR(16) NOT NULL, event_key CHAR(64) NOT NULL CHECK (event_key ~ '^[0-9a-f]{64}$'),
    payload JSONB NOT NULL CHECK (jsonb_typeof(payload)='object'), received_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ, failure_code VARCHAR(64),
    CONSTRAINT sager_webhook_event_unique UNIQUE(provider,environment,event_key)
);
CREATE INDEX sager_webhook_pending_idx ON sager_webhook_inbox(received_at) WHERE processed_at IS NULL;
CREATE TABLE sager_long_exit_history (
    sequence BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, id UUID NOT NULL UNIQUE,
    exit_id UUID NOT NULL REFERENCES sager_long_exit(id) ON DELETE CASCADE,
    event VARCHAR(32) NOT NULL, resulting_version BIGINT NOT NULL CHECK(resulting_version >= 0),
    recorded_at TIMESTAMPTZ NOT NULL, effective_at TIMESTAMPTZ, actor_id UUID, actor_profile VARCHAR(32),
    origin VARCHAR(32) NOT NULL, justification VARCHAR(2000), snapshot JSONB NOT NULL,
    CONSTRAINT sager_long_exit_history_version_unique UNIQUE(exit_id,resulting_version),
    CONSTRAINT sager_long_exit_history_actor_valid CHECK (((origin='LOCAL_API' AND actor_id IS NOT NULL
        AND actor_profile IN ('supervisor','residente')) OR (origin='SYSTEM_JOB' AND actor_id IS NULL AND actor_profile IS NULL)) IS TRUE)
);

DO $$
DECLARE current_check TEXT;
BEGIN
    SELECT pg_get_expr(conbin,conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_resource_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_resource_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_resource_allowed CHECK ((%s)
        OR resource IN (''LONG_EXIT'',''DOCUMENT_VERSION'',''SIGNATURE_BINDING'',''WHATSAPP_ATTEMPT'',''INTEGRATION_TASK''))', current_check);
    SELECT pg_get_expr(conbin,conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_changed_fields_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_changed_fields_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_changed_fields_allowed CHECK ((%s)
        OR (array_position(changed_fields,NULL) IS NULL AND CASE resource
            WHEN ''LONG_EXIT'' THEN changed_fields <@ ARRAY[''residentId'',''guardianId'',''departureMode'',''requestedDepartureAt'',''expectedReturnAt'',''reason'',''notes'',''status'',''decision'',''decisionComment'',''actualDepartureAt'',''actualReturnAt'',''lateObservation'',''cancellationReason'',''expiryReason'',''documentVersionId'']::TEXT[]
            WHEN ''DOCUMENT_VERSION'' THEN changed_fields <@ ARRAY[''exitId'',''revisionNumber'',''originalState'',''signedState'',''originalHash'',''signedHash'']::TEXT[]
            WHEN ''SIGNATURE_BINDING'' THEN changed_fields <@ ARRAY[''exitId'',''documentVersionId'',''guardianId'',''status'',''expiresAt'',''revokedAt'',''envelopeId'',''providerDocumentId'',''signerId'',''verifiedAt'',''signedAt'',''tokenHash'']::TEXT[]
            WHEN ''WHATSAPP_ATTEMPT'' THEN changed_fields <@ ARRAY[''bindingId'',''status'',''providerMessageId'',''acceptedAt'',''deliveredAt'',''readAt'',''failureCode'']::TEXT[]
            WHEN ''INTEGRATION_TASK'' THEN changed_fields <@ ARRAY[''bindingId'',''type'',''state'',''attemptCount'',''leaseUntil'',''nextAttemptAt'',''failureCode'']::TEXT[]
            ELSE FALSE END))',current_check);
END;
$$;
