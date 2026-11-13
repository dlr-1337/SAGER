-- Optional age group of the whole accommodation; its rooms inherit it.
ALTER TABLE sager_accommodation ADD COLUMN age_group VARCHAR(8) NULL;
ALTER TABLE sager_accommodation ADD CONSTRAINT sager_accommodation_age_group_valid
    CHECK (age_group IN ('MENORES', 'MAIORES'));

DO $$ DECLARE current_check TEXT; BEGIN
    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_changed_fields_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_changed_fields_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_changed_fields_allowed CHECK ((%s) OR
        (array_position(changed_fields,NULL) IS NULL AND
            resource = ''ACCOMMODATION'' AND changed_fields <@ ARRAY[''code'',''name'',''ageGroup'']::TEXT[]))', current_check);
END $$;

-- Backfill from the name; a name with both texts stays without a group.
-- Version stays: open forms must not see this as a registry change.
WITH changed AS (
    UPDATE sager_accommodation SET age_group = CASE
        WHEN name ILIKE '%menores de 18%' THEN 'MENORES' ELSE 'MAIORES' END
    WHERE (name ILIKE '%menores de 18%') <> (name ILIKE '%maiores de 18%')
    RETURNING id, version
)
INSERT INTO sager_audit_event (origin, request_id, resource, resource_id, action, resulting_version, changed_fields)
SELECT 'SYSTEM_JOB', gen_random_uuid(), 'ACCOMMODATION', id, 'UPDATE', version, ARRAY['ageGroup'] FROM changed;
