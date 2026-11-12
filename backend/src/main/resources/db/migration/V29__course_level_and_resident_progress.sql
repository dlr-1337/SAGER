-- Course level/duration and resident entry year/extension feed the expected graduation.
-- No backfill: legacy rows keep NULL (or 0 semesters) and versions stay unchanged.
ALTER TABLE sager_course
    ADD COLUMN level VARCHAR(16) NULL CHECK (level IN ('MEDIO', 'SUPERIOR')),
    ADD COLUMN duration_years SMALLINT NULL CHECK (duration_years BETWEEN 1 AND 6);
ALTER TABLE sager_resident
    ADD COLUMN entry_year SMALLINT NULL CHECK (entry_year BETWEEN 1990 AND 2100),
    ADD COLUMN extra_semesters SMALLINT NOT NULL DEFAULT 0 CHECK (extra_semesters BETWEEN 0 AND 10);

DO $$ DECLARE current_check TEXT; BEGIN
    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_changed_fields_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_changed_fields_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_changed_fields_allowed CHECK ((%s) OR
        (array_position(changed_fields,NULL) IS NULL AND
            ((resource = ''COURSE'' AND changed_fields <@ ARRAY[''name'',''active'',''level'',''durationYears'']::TEXT[]) OR
             (resource = ''RESIDENT'' AND changed_fields <@ ARRAY[''name'',''enrollment'',''birthDate'',''course'',''courseId'',''institutionalEmail'',''entryYear'',''extraSemesters'']::TEXT[]))))', current_check);
END $$;
