CREATE TABLE sager_discipline_policy (
    code VARCHAR(40) NOT NULL,
    version BIGINT NOT NULL CHECK (version > 0),
    parameters JSONB NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (code, version)
);
INSERT INTO sager_discipline_policy(code, version, parameters) VALUES
 ('ABSENCE', 1, '{"closedCallRequired":true,"justifiedExcluded":true}'),
 ('LATE_RETURN', 1, '{"confirmedReturnRequired":true,"toleranceSeconds":0}'),
 ('LOW_CLEANING', 1, '{"scoreBelow":6.00,"participants":"assessmentSnapshot"}'),
 ('RECURRENCE', 1, '{"minimumWarnings":2,"windowDays":90,"sameCategory":true,"humanConfirmationRequired":true}');

CREATE TABLE sager_occurrence (
    sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    id UUID PRIMARY KEY,
    resident_id UUID NOT NULL REFERENCES sager_resident(id),
    source_type VARCHAR(32) NOT NULL CHECK (source_type IN ('NIGHT_CALL','SHORT_RETURN','LONG_RETURN','CLEANING_ASSESSMENT','MANUAL')),
    source_id UUID NOT NULL,
    category VARCHAR(32) NOT NULL CHECK (category IN ('AUSENCIA','ATRASO_RETORNO','LIMPEZA','OUTRA')),
    source_version BIGINT NOT NULL CHECK (source_version >= 0),
    occurred_at TIMESTAMPTZ NOT NULL,
    valid BOOLEAN NOT NULL,
    evidence JSONB NOT NULL,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    UNIQUE(source_type, source_id, resident_id)
);
CREATE TABLE sager_occurrence_revision (
    occurrence_id UUID NOT NULL REFERENCES sager_occurrence(id),
    version BIGINT NOT NULL CHECK (version >= 0),
    source_version BIGINT NOT NULL CHECK (source_version >= 0),
    occurred_at TIMESTAMPTZ NOT NULL,
    valid BOOLEAN NOT NULL,
    evidence JSONB NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (occurrence_id, version)
);
CREATE TABLE sager_discipline_notification (
    sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    id UUID PRIMARY KEY,
    occurrence_id UUID NOT NULL REFERENCES sager_occurrence(id),
    policy_code VARCHAR(40) NOT NULL,
    policy_version BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','VISUALIZADA','EM_ANALISE','ARQUIVADA','CONVERTIDA')),
    requires_review BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_occurrence_version BIGINT NOT NULL DEFAULT 0 CHECK (reviewed_occurrence_version >= 0),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    FOREIGN KEY(policy_code, policy_version) REFERENCES sager_discipline_policy(code,version),
    UNIQUE(occurrence_id, policy_code)
);
CREATE TABLE sager_notification_event (
    sequence BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id UUID NOT NULL UNIQUE,
    notification_id UUID NOT NULL REFERENCES sager_discipline_notification(id),
    action VARCHAR(32) NOT NULL,
    actor_id UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    resulting_version BIGINT NOT NULL,
    occurrence_version BIGINT NOT NULL,
    reason_code VARCHAR(32),
    reason VARCHAR(2000)
);
CREATE TABLE sager_warning (
    sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    id UUID PRIMARY KEY,
    resident_id UUID NOT NULL REFERENCES sager_resident(id),
    occurrence_id UUID REFERENCES sager_occurrence(id),
    notification_id UUID UNIQUE REFERENCES sager_discipline_notification(id),
    category VARCHAR(32) NOT NULL CHECK (category IN ('AUSENCIA','ATRASO_RETORNO','LIMPEZA','OUTRA')),
    severity VARCHAR(16) NOT NULL CHECK (severity IN ('LEVE','MODERADA','GRAVE')),
    description VARCHAR(2000) NOT NULL CHECK (LENGTH(BTRIM(description)) BETWEEN 3 AND 2000),
    justification VARCHAR(2000) NOT NULL CHECK (LENGTH(BTRIM(justification)) BETWEEN 10 AND 2000),
    warning_date DATE NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    issued_by UUID NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'VIGENTE' CHECK (status IN ('VIGENTE','ANULADA')),
    annulled_at TIMESTAMPTZ,
    annulled_by UUID,
    annulment_reason VARCHAR(2000),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    CHECK ((status = 'VIGENTE' AND annulled_at IS NULL AND annulled_by IS NULL AND annulment_reason IS NULL)
        OR (status = 'ANULADA' AND annulled_at IS NOT NULL AND annulled_by IS NOT NULL
            AND LENGTH(BTRIM(annulment_reason)) BETWEEN 10 AND 2000))
);
CREATE UNIQUE INDEX sager_warning_active_origin_unique ON sager_warning(occurrence_id) WHERE status = 'VIGENTE' AND occurrence_id IS NOT NULL;
CREATE INDEX sager_warning_recurrence_idx ON sager_warning(resident_id, category, issued_at DESC);

CREATE TABLE sager_notice (
    sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    id UUID PRIMARY KEY,
    title VARCHAR(200) NOT NULL CHECK (LENGTH(BTRIM(title)) BETWEEN 3 AND 200),
    body VARCHAR(4000) NOT NULL CHECK (LENGTH(BTRIM(body)) BETWEEN 3 AND 4000),
    status VARCHAR(16) NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO','PUBLICADO','RETIRADO')),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    published_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    withdrawal_reason VARCHAR(2000)
);
CREATE TABLE sager_notice_draft_recipient (
    notice_id UUID NOT NULL REFERENCES sager_notice(id),
    resident_id UUID NOT NULL REFERENCES sager_resident(id),
    PRIMARY KEY(notice_id,resident_id)
);
CREATE TABLE sager_commitment_term (
    sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    id UUID PRIMARY KEY,
    resident_id UUID NOT NULL REFERENCES sager_resident(id),
    basis_hash VARCHAR(64) NOT NULL,
    model_version BIGINT NOT NULL DEFAULT 1 CHECK (model_version = 1),
    policy_code VARCHAR(40) NOT NULL DEFAULT 'RECURRENCE',
    policy_version BIGINT NOT NULL DEFAULT 1,
    decision VARCHAR(2000) NOT NULL CHECK (LENGTH(BTRIM(decision)) BETWEEN 10 AND 2000),
    issued_at TIMESTAMPTZ NOT NULL,
    issued_by UUID NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'EMITIDO' CHECK (status IN ('EMITIDO','ANULADO')),
    document_id UUID NOT NULL UNIQUE,
    document_sha256 VARCHAR(64) NOT NULL CHECK (document_sha256 ~ '^[0-9a-f]{64}$'),
    document_size BIGINT NOT NULL CHECK (document_size > 0),
    annulled_at TIMESTAMPTZ,
    annulled_by UUID,
    annulment_reason VARCHAR(2000),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    FOREIGN KEY(policy_code,policy_version) REFERENCES sager_discipline_policy(code,version),
    UNIQUE(resident_id,basis_hash,model_version),
    CHECK ((status = 'EMITIDO' AND annulled_at IS NULL AND annulled_by IS NULL AND annulment_reason IS NULL)
        OR (status = 'ANULADO' AND annulled_at IS NOT NULL AND annulled_by IS NOT NULL
            AND LENGTH(BTRIM(annulment_reason)) BETWEEN 10 AND 2000))
);
CREATE TABLE sager_commitment_basis (
    term_id UUID NOT NULL REFERENCES sager_commitment_term(id),
    warning_id UUID NOT NULL REFERENCES sager_warning(id),
    PRIMARY KEY(term_id,warning_id)
);
CREATE TABLE sager_communication (
    sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    id UUID PRIMARY KEY,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('AVISO','ADVERTENCIA','TERMO')),
    source_id UUID NOT NULL,
    content_version BIGINT NOT NULL CHECK (content_version >= 0),
    title VARCHAR(200) NOT NULL,
    body VARCHAR(4000) NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    published_by UUID NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PUBLICADO' CHECK (status IN ('PUBLICADO','SUPERADO','RETIRADO','ANULADO')),
    state_reason VARCHAR(2000),
    UNIQUE(kind,source_id,content_version)
);
CREATE TABLE sager_communication_recipient (
    communication_id UUID NOT NULL REFERENCES sager_communication(id),
    resident_id UUID NOT NULL REFERENCES sager_resident(id),
    read_at TIMESTAMPTZ,
    read_by UUID,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID,
    PRIMARY KEY(communication_id,resident_id),
    CHECK ((read_at IS NULL) = (read_by IS NULL)),
    CHECK ((acknowledged_at IS NULL) = (acknowledged_by IS NULL))
);
CREATE INDEX sager_communication_recipient_owner_idx ON sager_communication_recipient(resident_id,communication_id);
CREATE TABLE sager_discipline_idempotency (
    actor_id UUID NOT NULL,
    action VARCHAR(64) NOT NULL,
    key UUID NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    resource_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY(actor_id,action,key)
);

CREATE FUNCTION sager_discipline_immutable() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable discipline history' USING ERRCODE = '23514'; END; $$;
CREATE TRIGGER sager_discipline_policy_immutable BEFORE UPDATE OR DELETE ON sager_discipline_policy FOR EACH ROW EXECUTE FUNCTION sager_discipline_immutable();
CREATE TRIGGER sager_occurrence_revision_immutable BEFORE UPDATE OR DELETE ON sager_occurrence_revision FOR EACH ROW EXECUTE FUNCTION sager_discipline_immutable();
CREATE TRIGGER sager_notification_event_immutable BEFORE UPDATE OR DELETE ON sager_notification_event FOR EACH ROW EXECUTE FUNCTION sager_discipline_immutable();
CREATE TRIGGER sager_commitment_basis_immutable BEFORE UPDATE OR DELETE ON sager_commitment_basis FOR EACH ROW EXECUTE FUNCTION sager_discipline_immutable();
CREATE FUNCTION sager_discipline_published_content() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'published content retained' USING ERRCODE='23514'; END IF;
    IF TG_TABLE_NAME = 'sager_communication' THEN
        IF (to_jsonb(NEW) - ARRAY['status','state_reason']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','state_reason']) THEN
            RAISE EXCEPTION 'immutable published communication' USING ERRCODE='23514';
        END IF;
    ELSIF TG_TABLE_NAME = 'sager_warning' OR TG_TABLE_NAME = 'sager_commitment_term' THEN
        IF (to_jsonb(NEW) - ARRAY['status','annulled_at','annulled_by','annulment_reason','version'])
            IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','annulled_at','annulled_by','annulment_reason','version']) THEN
            RAISE EXCEPTION 'immutable disciplinary document' USING ERRCODE='23514';
        END IF;
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER sager_warning_content_immutable BEFORE UPDATE OR DELETE ON sager_warning FOR EACH ROW EXECUTE FUNCTION sager_discipline_published_content();
CREATE TRIGGER sager_term_content_immutable BEFORE UPDATE OR DELETE ON sager_commitment_term FOR EACH ROW EXECUTE FUNCTION sager_discipline_published_content();
CREATE TRIGGER sager_communication_content_immutable BEFORE UPDATE OR DELETE ON sager_communication FOR EACH ROW EXECUTE FUNCTION sager_discipline_published_content();
CREATE FUNCTION sager_communication_receipt_preserved() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'communication receipt retained' USING ERRCODE='23514'; END IF;
    IF NEW.communication_id<>OLD.communication_id OR NEW.resident_id<>OLD.resident_id
        OR (OLD.read_at IS NOT NULL AND (NEW.read_at IS DISTINCT FROM OLD.read_at OR NEW.read_by IS DISTINCT FROM OLD.read_by))
        OR (OLD.acknowledged_at IS NOT NULL AND (NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at OR NEW.acknowledged_by IS DISTINCT FROM OLD.acknowledged_by)) THEN
        RAISE EXCEPTION 'communication evidence is immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER sager_communication_receipt_preserved BEFORE UPDATE OR DELETE ON sager_communication_recipient FOR EACH ROW EXECUTE FUNCTION sager_communication_receipt_preserved();

DO $$
DECLARE current_check TEXT;
BEGIN
    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_resource_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_resource_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_resource_allowed CHECK ((%s) OR resource IN (''OCCURRENCE'',''DISCIPLINE_NOTIFICATION'',''WARNING'',''NOTICE'',''COMMUNICATION'',''COMMITMENT_TERM''))',current_check);
    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_changed_fields_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_changed_fields_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_changed_fields_allowed CHECK ((%s) OR (resource IN (''OCCURRENCE'',''DISCIPLINE_NOTIFICATION'',''WARNING'',''NOTICE'',''COMMUNICATION'',''COMMITMENT_TERM'') AND array_position(changed_fields,NULL) IS NULL AND changed_fields <@ ARRAY[''status'',''residentId'',''sourceId'',''sourceType'',''sourceVersion'',''evidence'',''requiresReview'',''occurrenceId'',''notificationId'',''category'',''severity'',''description'',''justification'',''warningDate'',''title'',''body'',''residentIds'',''contentVersion'',''readAt'',''acknowledgedAt'',''warningIds'',''decision'',''document'',''reason'']::TEXT[]))',current_check);
END; $$;
