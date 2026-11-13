-- Account writes outside an audited registry: resident password recovery (LOCAL_API, the account
-- itself as actor) and the operator account commands (OPERATOR_CLI, no actor). Field names only.
-- Only constraints change; no row is touched.
DO $$ DECLARE current_check TEXT; BEGIN
    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_resource_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_resource_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_resource_allowed
        CHECK ((%s) OR resource = ''LOCAL_ACCOUNT'')', current_check);

    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_changed_fields_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_changed_fields_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_changed_fields_allowed CHECK ((%s) OR
        (array_position(changed_fields,NULL) IS NULL AND resource = ''LOCAL_ACCOUNT'' AND changed_fields <@
            ARRAY[''enrollment'',''email'',''name'',''profile'',''password'',''active'',''residentId'',''supervisorId'']::TEXT[]))',
        current_check);

    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_origin_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_origin_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_origin_allowed
        CHECK ((%s) OR origin = ''OPERATOR_CLI'')', current_check);

    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_origin_actor_valid';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_origin_actor_valid;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_origin_actor_valid
        CHECK ((%s) OR (origin = ''OPERATOR_CLI'' AND actor_id IS NULL AND actor_profile IS NULL
            AND resource = ''LOCAL_ACCOUNT''))', current_check);
END $$;
