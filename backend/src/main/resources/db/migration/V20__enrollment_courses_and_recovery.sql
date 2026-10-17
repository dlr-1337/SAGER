-- Preserve legacy accounts without guessing an institutional enrollment.
ALTER TABLE sager_local_account ALTER COLUMN email DROP NOT NULL;
ALTER TABLE sager_local_account ADD COLUMN enrollment VARCHAR(64);
ALTER TABLE sager_local_account ADD CONSTRAINT sager_account_enrollment_valid
    CHECK (enrollment IS NULL OR (enrollment = trim(enrollment) AND length(enrollment) > 0
        AND enrollment !~ '[[:cntrl:]@]'));
CREATE UNIQUE INDEX sager_account_enrollment_unique ON sager_local_account (lower(enrollment));
WITH candidates AS (
    SELECT a.id, COALESCE(r.enrollment, s.institutional_id) AS enrollment
    FROM sager_local_account a
    LEFT JOIN sager_resident r ON r.id = a.resident_id
    LEFT JOIN sager_supervisor s ON s.id = a.supervisor_id
), unique_candidates AS (
    SELECT enrollment FROM candidates WHERE enrollment IS NOT NULL
    GROUP BY lower(enrollment), enrollment
    HAVING (SELECT count(*) FROM candidates c2
            WHERE lower(c2.enrollment) = lower(candidates.enrollment)) = 1
)
UPDATE sager_local_account a SET enrollment = c.enrollment
FROM candidates c JOIN unique_candidates u ON u.enrollment = c.enrollment
WHERE a.id = c.id AND c.enrollment !~ '[[:cntrl:]@]' AND length(trim(c.enrollment)) > 0;
-- Principals now use the immutable account UUID, rather than contact email.
DELETE FROM spring_session;

CREATE TABLE sager_course (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200 AND name !~ '[[:cntrl:]]'),
    normalized_name TEXT GENERATED ALWAYS AS (lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) STORED UNIQUE,
    active BOOLEAN NOT NULL DEFAULT true,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO sager_course (name)
SELECT min(regexp_replace(trim(course), '\s+', ' ', 'g')) FROM sager_resident
WHERE course IS NOT NULL AND length(trim(course)) > 0
GROUP BY lower(regexp_replace(trim(course), '\s+', ' ', 'g'));
ALTER TABLE sager_resident ADD COLUMN course_id UUID REFERENCES sager_course(id);
ALTER TABLE sager_resident ADD COLUMN institutional_email VARCHAR(320);
ALTER TABLE sager_resident ADD CONSTRAINT sager_resident_institutional_email_valid
    CHECK (institutional_email IS NULL OR
        (institutional_email = lower(trim(institutional_email)) AND institutional_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
-- Backfill must also preserve pre-V10 rows that have no birth date.
ALTER TABLE sager_resident DROP CONSTRAINT sager_resident_birth_date_required;
UPDATE sager_resident r SET course_id = c.id, course = c.name FROM sager_course c
WHERE lower(regexp_replace(trim(r.course), '\s+', ' ', 'g')) = c.normalized_name;
ALTER TABLE sager_resident ADD CONSTRAINT sager_resident_birth_date_required CHECK (birth_date IS NOT NULL) NOT VALID;
CREATE INDEX sager_resident_course_idx ON sager_resident(course_id);

DO $$ DECLARE current_check TEXT; BEGIN
    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_resource_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_resource_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_resource_allowed CHECK ((%s) OR resource = ''COURSE'')', current_check);
    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_changed_fields_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_changed_fields_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_changed_fields_allowed CHECK ((%s) OR
        (array_position(changed_fields,NULL) IS NULL AND
            ((resource = ''COURSE'' AND changed_fields <@ ARRAY[''name'',''active'']::TEXT[]) OR
             (resource = ''RESIDENT'' AND changed_fields <@ ARRAY[''name'',''enrollment'',''birthDate'',''course'',''courseId'',''institutionalEmail'']::TEXT[]))))', current_check);
END $$;
