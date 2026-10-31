-- The end of a WhatsApp session must also appear in the audit.
DO $$
DECLARE current_check TEXT;
BEGIN
    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_changed_fields_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_changed_fields_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_changed_fields_allowed CHECK ((%s) OR
        (array_position(changed_fields,NULL) IS NULL AND resource = ''WHATSAPP_SESSION'' AND changed_fields <@ ARRAY[''ended'']::TEXT[]))', current_check);
END $$;
