-- Local assistential notes. These resources do not certify a paperless clinical record.
ALTER TABLE sager_local_account DROP CONSTRAINT sager_local_account_profile_allowed;
ALTER TABLE sager_local_account ADD CONSTRAINT sager_local_account_profile_allowed
    CHECK (profile IN ('gestor', 'supervisor', 'residente', 'saude'));

CREATE TABLE sager_health_grant (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
    account_id UUID NOT NULL REFERENCES sager_local_account (id),
    profession VARCHAR(32) NOT NULL CHECK (profession IN ('MEDICINA', 'ENFERMAGEM', 'PSICOLOGIA')),
    registration_number VARCHAR(100) NOT NULL CHECK (char_length(trim(registration_number)) BETWEEN 1 AND 100),
    registration_region VARCHAR(2) NOT NULL CHECK (registration_region IN (
        'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
        'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
    verified_by UUID NOT NULL REFERENCES sager_local_account (id),
    verified_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    verification_reason VARCHAR(500) NOT NULL CHECK (char_length(trim(verification_reason)) BETWEEN 10 AND 500),
    started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    ended_at TIMESTAMPTZ,
    end_reason VARCHAR(500),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    UNIQUE (id, account_id),
    CHECK ((ended_at IS NULL AND end_reason IS NULL) OR
           (ended_at IS NOT NULL AND end_reason IS NOT NULL AND ended_at >= started_at
            AND char_length(trim(end_reason)) BETWEEN 10 AND 500))
);
CREATE UNIQUE INDEX sager_health_grant_active_account_idx
    ON sager_health_grant (account_id) WHERE ended_at IS NULL;

CREATE TABLE sager_health_care_assignment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
    resident_id UUID NOT NULL REFERENCES sager_resident (id),
    professional_grant_id UUID NOT NULL,
    account_id UUID NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    ended_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES sager_local_account (id),
    reason VARCHAR(500) NOT NULL CHECK (char_length(trim(reason)) BETWEEN 10 AND 500),
    end_reason VARCHAR(500),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    FOREIGN KEY (professional_grant_id, account_id) REFERENCES sager_health_grant (id, account_id),
    UNIQUE (id, professional_grant_id, resident_id),
    CHECK ((ended_at IS NULL AND end_reason IS NULL) OR
           (ended_at IS NOT NULL AND end_reason IS NOT NULL AND ended_at >= started_at
            AND char_length(trim(end_reason)) BETWEEN 10 AND 500))
);
CREATE UNIQUE INDEX sager_health_care_assignment_active_idx
    ON sager_health_care_assignment (resident_id, professional_grant_id) WHERE ended_at IS NULL;

CREATE TABLE sager_health_note (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
    resident_id UUID NOT NULL REFERENCES sager_resident (id),
    category VARCHAR(32) NOT NULL CHECK (category IN ('GENERAL','PSYCHOLOGICAL','SHARED_SUMMARY')),
    author_account_id UUID NOT NULL REFERENCES sager_local_account (id),
    author_grant_id UUID NOT NULL,
    author_name VARCHAR(200) NOT NULL,
    author_profession VARCHAR(32) NOT NULL CHECK (author_profession IN ('MEDICINA','ENFERMAGEM','PSICOLOGIA')),
    author_registration_number VARCHAR(100) NOT NULL,
    author_registration_region VARCHAR(2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    related_note_id UUID,
    UNIQUE (id, resident_id),
    FOREIGN KEY (author_grant_id, author_account_id) REFERENCES sager_health_grant (id, account_id),
    FOREIGN KEY (related_note_id, resident_id) REFERENCES sager_health_note (id, resident_id),
    CHECK ((category = 'GENERAL' AND author_profession IN ('MEDICINA','ENFERMAGEM')) OR
           (category = 'PSYCHOLOGICAL' AND author_profession = 'PSICOLOGIA') OR category = 'SHARED_SUMMARY')
);
CREATE INDEX sager_health_note_resident_sequence_idx ON sager_health_note (resident_id, sequence DESC);
CREATE INDEX sager_health_note_author_idx ON sager_health_note (author_account_id, resident_id);

CREATE TABLE sager_health_revision (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES sager_health_note (id),
    version BIGINT NOT NULL CHECK (version >= 0),
    body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 4000
                             AND body !~ '<[[:alpha:]!/][^>]*>'),
    reason VARCHAR(500),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    recorded_by UUID NOT NULL REFERENCES sager_local_account (id),
    UNIQUE (note_id, version),
    CHECK ((version = 0 AND reason IS NULL) OR
           (version > 0 AND reason IS NOT NULL AND char_length(trim(reason)) BETWEEN 10 AND 500))
);

CREATE TABLE sager_health_share (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL,
    resident_id UUID NOT NULL,
    recipient_grant_id UUID NOT NULL REFERENCES sager_health_grant (id),
    recipient_care_assignment_id UUID NOT NULL,
    created_by UUID NOT NULL REFERENCES sager_local_account (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    ended_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    FOREIGN KEY (note_id, resident_id) REFERENCES sager_health_note (id, resident_id),
    FOREIGN KEY (recipient_care_assignment_id, recipient_grant_id, resident_id)
        REFERENCES sager_health_care_assignment (id, professional_grant_id, resident_id),
    CHECK (ended_at IS NULL OR ended_at >= created_at)
);
CREATE UNIQUE INDEX sager_health_share_active_idx
    ON sager_health_share (note_id, recipient_grant_id, recipient_care_assignment_id)
    WHERE ended_at IS NULL;

CREATE TABLE sager_health_custody (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
    resident_id UUID NOT NULL REFERENCES sager_resident (id),
    source_author_account_id UUID NOT NULL REFERENCES sager_local_account (id),
    recipient_grant_id UUID NOT NULL REFERENCES sager_health_grant (id),
    recipient_care_assignment_id UUID NOT NULL,
    created_by UUID NOT NULL REFERENCES sager_local_account (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    reason VARCHAR(500) NOT NULL CHECK (char_length(trim(reason)) BETWEEN 10 AND 500),
    ended_at TIMESTAMPTZ,
    end_reason VARCHAR(500),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    FOREIGN KEY (recipient_care_assignment_id, recipient_grant_id, resident_id)
        REFERENCES sager_health_care_assignment (id, professional_grant_id, resident_id),
    CHECK ((ended_at IS NULL AND end_reason IS NULL) OR
           (ended_at IS NOT NULL AND end_reason IS NOT NULL AND ended_at >= created_at
            AND char_length(trim(end_reason)) BETWEEN 10 AND 500))
);
CREATE UNIQUE INDEX sager_health_custody_active_idx
    ON sager_health_custody (resident_id, source_author_account_id, recipient_grant_id,
                            recipient_care_assignment_id)
    WHERE ended_at IS NULL;

CREATE FUNCTION sager_reject_health_document_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Health documents are immutable.';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER sager_health_note_no_update_delete BEFORE UPDATE OR DELETE ON sager_health_note
    FOR EACH STATEMENT EXECUTE FUNCTION sager_reject_health_document_mutation();
CREATE TRIGGER sager_health_note_no_truncate BEFORE TRUNCATE ON sager_health_note
    FOR EACH STATEMENT EXECUTE FUNCTION sager_reject_health_document_mutation();
CREATE TRIGGER sager_health_revision_no_update_delete BEFORE UPDATE OR DELETE ON sager_health_revision
    FOR EACH STATEMENT EXECUTE FUNCTION sager_reject_health_document_mutation();
CREATE TRIGGER sager_health_revision_no_truncate BEFORE TRUNCATE ON sager_health_revision
    FOR EACH STATEMENT EXECUTE FUNCTION sager_reject_health_document_mutation();
REVOKE UPDATE, DELETE, TRUNCATE ON sager_health_note, sager_health_revision FROM PUBLIC;

ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_profile_allowed;
ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_profile_allowed
    CHECK (actor_profile IN ('gestor','supervisor','residente','saude'));
ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_resource_allowed;
ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_resource_allowed CHECK (resource IN (
    'SUPERVISOR','RESIDENT','GUARDIAN','ACCOMMODATION','ACCOMMODATION_UNIT','ROOM','ALLOCATION',
    'HEALTH_GRANT','CARE_ASSIGNMENT','HEALTH_CUSTODY','HEALTH_NOTE','HEALTH_SHARE','HEALTH_EXPORT'));
ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_action_allowed;
ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_action_allowed
    CHECK (action IN ('CREATE','UPDATE','END','READ','EXPORT'));
ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_changed_fields_allowed;
ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_changed_fields_allowed CHECK (
    array_position(changed_fields, NULL) IS NULL AND changed_fields <@ CASE resource
        WHEN 'SUPERVISOR' THEN ARRAY['name','institutionalId','email']
        WHEN 'RESIDENT' THEN ARRAY['name','enrollment','birthDate','course']
        WHEN 'GUARDIAN' THEN ARRAY['residentId','name','relationship','phone','active']
        WHEN 'ACCOMMODATION' THEN ARRAY['code','name']
        WHEN 'ACCOMMODATION_UNIT' THEN ARRAY['accommodationId','code','name']
        WHEN 'ROOM' THEN ARRAY['code','number','accommodationId','unitId','floor','capacity','situation']
        WHEN 'ALLOCATION' THEN ARRAY['residentId','roomId','startedAt','endedAt','endReason']
        WHEN 'HEALTH_GRANT' THEN ARRAY['accountId','profession','registrationNumber','registrationRegion',
                                       'verificationReason','endedAt','endReason']
        WHEN 'CARE_ASSIGNMENT' THEN ARRAY['residentId','professionalGrantId','reason','endedAt','endReason']
        WHEN 'HEALTH_CUSTODY' THEN ARRAY['residentId','sourceAuthorAccountId','recipientGrantId','reason',
                                         'endedAt','endReason']
        WHEN 'HEALTH_NOTE' THEN ARRAY['residentId','category','body','relatedNoteId','reason']
        WHEN 'HEALTH_SHARE' THEN ARRAY['noteId','recipientGrantId','recipientCareAssignmentId','endedAt']
        WHEN 'HEALTH_EXPORT' THEN ARRAY['notes','versions']
        ELSE ARRAY[]::TEXT[] END);
