-- Binding: gateway provider, functional deadline and human verification instead of API proof.
ALTER TABLE sager_signature_binding DROP CONSTRAINT sager_signature_binding_provider_check;
ALTER TABLE sager_signature_binding ADD CONSTRAINT sager_signature_binding_provider_check
    CHECK (provider IN ('CLICKSIGN', 'WHATSAPP_GATEWAY'));
ALTER TABLE sager_signature_binding ALTER COLUMN provider DROP DEFAULT;
ALTER TABLE sager_signature_binding ALTER COLUMN stage DROP DEFAULT;
ALTER TABLE sager_signature_binding DROP CONSTRAINT sager_signature_binding_environment_check;
ALTER TABLE sager_signature_binding ADD CONSTRAINT sager_signature_binding_environment_check
    CHECK (environment IN ('sandbox', 'production', 'disabled', 'gateway'));
ALTER TABLE sager_signature_binding ADD COLUMN verified_by UUID;
ALTER TABLE sager_signature_binding DROP CONSTRAINT sager_signature_binding_deadline_valid;
ALTER TABLE sager_signature_binding ADD CONSTRAINT sager_signature_binding_deadline_valid
    CHECK (expires_at > created_at AND (provider <> 'CLICKSIGN' OR expires_at <= created_at + INTERVAL '24 hours'));
ALTER TABLE sager_signature_binding DROP CONSTRAINT sager_signature_binding_valid;
ALTER TABLE sager_signature_binding ADD CONSTRAINT sager_signature_binding_valid CHECK ((status <> 'VALID' OR (
        (verified_api OR (provider = 'WHATSAPP_GATEWAY' AND verified_by IS NOT NULL))
        AND signed_at IS NOT NULL AND verified_at >= signed_at AND signed_at < expires_at AND signed_at >= created_at
        AND evidence_hash ~ '^[0-9a-f]{64}$' AND stage = 'DONE' AND revoked_at IS NULL)) IS TRUE);

-- The old provider never left simulation: pending requests continue by manual attachment or resend.
UPDATE sager_signature_binding b SET status = 'INVALIDATED', revoked_at = now(), version = b.version + 1
    FROM sager_long_exit e
    WHERE b.exit_id = e.id AND b.provider = 'CLICKSIGN' AND b.revoked_at IS NULL
        AND (b.status <> 'VALID' OR e.status = 'AGUARDANDO_ANALISE');
UPDATE sager_integration_task t SET state = 'CANCELLED', in_flight = false, lease_until = NULL, lease_owner = NULL,
        version = t.version + 1, updated_at = now()
    FROM sager_signature_binding b
    WHERE t.binding_id = b.id AND b.provider = 'CLICKSIGN' AND t.state IN ('PENDING', 'RUNNING');
UPDATE sager_webhook_inbox SET processed_at = now(), failure_code = 'provider_removed'
    WHERE provider = 'CLICKSIGN' AND processed_at IS NULL;

-- Received authorizations may be images; legacy rows without a type are PDFs.
ALTER TABLE sager_document_version ADD COLUMN signed_media_type VARCHAR(100);
ALTER TABLE sager_document_version ADD CONSTRAINT sager_document_version_signed_media_valid
    CHECK (signed_media_type IS NULL OR signed_state = 'STORED');
CREATE OR REPLACE FUNCTION sager_document_snapshot_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(NEW.id,NEW.exit_id,NEW.revision_number,NEW.template_version,NEW.snapshot,NEW.original_file_id,
            NEW.original_hash,NEW.original_size,NEW.original_state,NEW.created_at)
        IS DISTINCT FROM ROW(OLD.id,OLD.exit_id,OLD.revision_number,OLD.template_version,OLD.snapshot,
            OLD.original_file_id,OLD.original_hash,OLD.original_size,OLD.original_state,OLD.created_at)
        OR (OLD.signed_state = 'STORED' AND ROW(NEW.signed_file_id,NEW.signed_hash,NEW.signed_size,NEW.signed_state,NEW.signed_media_type)
            IS DISTINCT FROM ROW(OLD.signed_file_id,OLD.signed_hash,OLD.signed_size,OLD.signed_state,OLD.signed_media_type)) THEN
        RAISE EXCEPTION 'Document revision is immutable.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TABLE sager_whatsapp_session (
    provider VARCHAR(16) NOT NULL CHECK (provider = 'WHATSAPP_GATEWAY'),
    session VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('STOPPED','STARTING','SCAN_QR_CODE','PASSKEY_REQUIRED',
        'PASSKEY_CONFIRMATION_REQUIRED','WORKING','FAILED')),
    status_at TIMESTAMPTZ NOT NULL,
    linked_at TIMESTAMPTZ,
    last_event_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    PRIMARY KEY (provider, session)
);

CREATE TABLE sager_whatsapp_conversation (
    id UUID PRIMARY KEY,
    provider VARCHAR(16) NOT NULL CHECK (provider = 'WHATSAPP_GATEWAY'),
    session VARCHAR(16) NOT NULL,
    chat_id VARCHAR(128) NOT NULL,
    phone VARCHAR(16) CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{6,14}$'),
    lid VARCHAR(128),
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    CONSTRAINT sager_whatsapp_conversation_unique UNIQUE (provider, session, chat_id)
);

CREATE TABLE sager_whatsapp_message (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES sager_whatsapp_conversation(id) ON DELETE CASCADE,
    provider VARCHAR(16) NOT NULL CHECK (provider = 'WHATSAPP_GATEWAY'),
    session VARCHAR(16) NOT NULL,
    provider_message_id VARCHAR(128) NOT NULL,
    direction VARCHAR(8) NOT NULL CHECK (direction IN ('IN', 'OUT')),
    origin VARCHAR(16) NOT NULL CHECK (origin IN ('WEBHOOK', 'RECONCILIATION')),
    sender_phone VARCHAR(16) CHECK (sender_phone IS NULL OR sender_phone ~ '^\+[1-9][0-9]{6,14}$'),
    sender_lid VARCHAR(128),
    body TEXT CHECK (body IS NULL OR LENGTH(body) <= 65536),
    quoted_message_id VARCHAR(128),
    media_state VARCHAR(16) NOT NULL CHECK (media_state IN ('NONE', 'PENDING', 'STORED', 'FAILED')),
    media_path VARCHAR(1024),
    media_mime_type VARCHAR(100),
    media_filename VARCHAR(255),
    media_file_id UUID UNIQUE,
    media_hash CHAR(64),
    media_size BIGINT,
    media_failure_code VARCHAR(64),
    sent_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    CONSTRAINT sager_whatsapp_message_key_unique UNIQUE (provider, session, provider_message_id),
    CONSTRAINT sager_whatsapp_message_media_valid CHECK ((
        (media_state = 'STORED' AND media_file_id IS NOT NULL AND media_hash ~ '^[0-9a-f]{64}$'
            AND media_size BETWEEN 1 AND 10485760)
        OR (media_state = 'FAILED' AND media_failure_code IS NOT NULL AND media_file_id IS NULL)
        OR (media_state IN ('NONE', 'PENDING') AND media_file_id IS NULL)) IS TRUE)
);
CREATE INDEX sager_whatsapp_message_conversation_idx ON sager_whatsapp_message(conversation_id, sent_at DESC, id);
CREATE INDEX sager_whatsapp_message_media_idx ON sager_whatsapp_message(sent_at DESC) WHERE media_state <> 'NONE';

CREATE TABLE sager_whatsapp_job (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES sager_whatsapp_message(id) ON DELETE CASCADE,
    type VARCHAR(16) NOT NULL CHECK (type IN ('DOWNLOAD', 'SEND')),
    state VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','RUNNING','SUCCEEDED','FAILED','UNCERTAIN')),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
    next_attempt_at TIMESTAMPTZ NOT NULL,
    lease_until TIMESTAMPTZ,
    lease_token UUID,
    failure_code VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    CONSTRAINT sager_whatsapp_job_message_type_unique UNIQUE (message_id, type),
    CONSTRAINT sager_whatsapp_job_lease_valid CHECK ((state <> 'RUNNING' OR (lease_until IS NOT NULL AND lease_token IS NOT NULL)) IS TRUE)
);
CREATE INDEX sager_whatsapp_job_due_idx ON sager_whatsapp_job(state, next_attempt_at, lease_until);

CREATE TABLE sager_guardian_authorization_file (
    id UUID PRIMARY KEY,
    exit_id UUID NOT NULL REFERENCES sager_long_exit(id) ON DELETE CASCADE,
    document_version_id UUID NOT NULL,
    binding_id UUID NOT NULL REFERENCES sager_signature_binding(id) ON DELETE CASCADE,
    message_id UUID REFERENCES sager_whatsapp_message(id),
    origin VARCHAR(16) NOT NULL CHECK (origin IN ('WHATSAPP', 'MANUAL')),
    state VARCHAR(16) NOT NULL DEFAULT 'CANDIDATE' CHECK (state IN ('CANDIDATE', 'ACCEPTED', 'REFUSED')),
    file_id UUID NOT NULL,
    file_hash CHAR(64) NOT NULL CHECK (file_hash ~ '^[0-9a-f]{64}$'),
    file_size BIGINT NOT NULL CHECK (file_size BETWEEN 1 AND 10485760),
    media_type VARCHAR(100) NOT NULL,
    sender_phone VARCHAR(16),
    received_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    decided_by UUID,
    decided_at TIMESTAMPTZ,
    decision_reason VARCHAR(2000),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    CONSTRAINT sager_authorization_file_document_fk FOREIGN KEY (exit_id, document_version_id)
        REFERENCES sager_document_version(exit_id, id),
    CONSTRAINT sager_authorization_file_origin_valid CHECK ((
        (origin = 'WHATSAPP' AND message_id IS NOT NULL) OR (origin = 'MANUAL' AND message_id IS NULL)) IS TRUE),
    CONSTRAINT sager_authorization_file_decision_valid CHECK ((
        (state = 'CANDIDATE' AND decided_by IS NULL AND decided_at IS NULL AND decision_reason IS NULL)
        OR (state = 'ACCEPTED' AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
        OR (state = 'REFUSED' AND decided_by IS NOT NULL AND decided_at IS NOT NULL
            AND LENGTH(BTRIM(decision_reason)) BETWEEN 10 AND 2000)) IS TRUE)
);
CREATE UNIQUE INDEX sager_authorization_file_message_unique ON sager_guardian_authorization_file(message_id)
    WHERE message_id IS NOT NULL AND state <> 'REFUSED';
CREATE UNIQUE INDEX sager_authorization_file_accepted_unique ON sager_guardian_authorization_file(document_version_id)
    WHERE state = 'ACCEPTED';
CREATE INDEX sager_authorization_file_exit_idx ON sager_guardian_authorization_file(exit_id, created_at DESC, id);
CREATE FUNCTION sager_authorization_file_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(NEW.id,NEW.exit_id,NEW.document_version_id,NEW.binding_id,NEW.message_id,NEW.origin,NEW.file_id,NEW.file_hash,
            NEW.file_size,NEW.media_type,NEW.sender_phone,NEW.received_at,NEW.created_at)
        IS DISTINCT FROM ROW(OLD.id,OLD.exit_id,OLD.document_version_id,OLD.binding_id,OLD.message_id,OLD.origin,OLD.file_id,OLD.file_hash,
            OLD.file_size,OLD.media_type,OLD.sender_phone,OLD.received_at,OLD.created_at) THEN
        RAISE EXCEPTION 'Authorization file evidence is immutable.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER sager_authorization_file_immutable BEFORE UPDATE ON sager_guardian_authorization_file
    FOR EACH ROW EXECUTE FUNCTION sager_authorization_file_immutable();

DO $$ DECLARE current_check TEXT; BEGIN
    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_resource_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_resource_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_resource_allowed CHECK ((%s) OR resource = ''AUTHORIZATION_FILE'')', current_check);
    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_changed_fields_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_changed_fields_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_changed_fields_allowed CHECK ((%s) OR
        (array_position(changed_fields,NULL) IS NULL AND
            ((resource = ''AUTHORIZATION_FILE'' AND changed_fields <@ ARRAY[''exitId'',''documentVersionId'',''bindingId'',''messageId'',''origin'',''state'',''fileHash'',''mediaType'',''decidedBy'',''decidedAt'',''decisionReason'']::TEXT[]) OR
             (resource = ''SIGNATURE_BINDING'' AND changed_fields <@ ARRAY[''exitId'',''documentVersionId'',''guardianId'',''status'',''expiresAt'',''revokedAt'',''verifiedAt'',''verifiedBy'',''signedAt'',''evidenceHash'']::TEXT[]) OR
             (resource = ''DOCUMENT_VERSION'' AND changed_fields <@ ARRAY[''exitId'',''revisionNumber'',''originalState'',''signedState'',''originalHash'',''signedHash'',''signedMediaType'']::TEXT[]))))', current_check);
END $$;
