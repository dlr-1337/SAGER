-- Same rule as ResidentService.formatName; pg_c_utf8 keeps accents independent of the database locale.
CREATE FUNCTION sager_format_resident_name(value TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    formatted TEXT := '';
    word_start BOOLEAN := TRUE;
    letter TEXT;
BEGIN
    FOREACH letter IN ARRAY string_to_array(value, NULL) LOOP
        formatted := formatted || CASE WHEN word_start THEN upper(letter COLLATE "pg_c_utf8")
            ELSE lower(letter COLLATE "pg_c_utf8") END;
        word_start := (letter COLLATE "pg_c_utf8") ~ '[[:space:]]' OR letter IN ('-', '''', U&'\2019');
    END LOOP;
    RETURN formatted;
END;
$$;

-- Backfill must also preserve pre-V10 rows that have no birth date.
ALTER TABLE sager_resident DROP CONSTRAINT sager_resident_birth_date_required;
-- Version stays: open forms and long exits must not see this as a registry change.
WITH changed AS (
    UPDATE sager_resident SET name = sager_format_resident_name(name)
    WHERE name <> sager_format_resident_name(name)
    RETURNING id, version
)
INSERT INTO sager_audit_event (origin, request_id, resource, resource_id, action, resulting_version, changed_fields)
SELECT 'SYSTEM_JOB', gen_random_uuid(), 'RESIDENT', id, 'UPDATE', version, ARRAY['name'] FROM changed;
ALTER TABLE sager_resident ADD CONSTRAINT sager_resident_birth_date_required CHECK (birth_date IS NOT NULL) NOT VALID;

UPDATE sager_local_account SET display_name = sager_format_resident_name(display_name)
WHERE resident_id IS NOT NULL AND display_name <> sager_format_resident_name(display_name);

DROP FUNCTION sager_format_resident_name(TEXT);
