-- An outgoing message exists before the gateway assigns its identifier.
ALTER TABLE sager_whatsapp_message ALTER COLUMN provider_message_id DROP NOT NULL;
ALTER TABLE sager_whatsapp_message DROP CONSTRAINT sager_whatsapp_message_origin_check;
ALTER TABLE sager_whatsapp_message ADD CONSTRAINT sager_whatsapp_message_origin_check
    CHECK (origin IN ('WEBHOOK', 'RECONCILIATION', 'SUPERVISOR', 'DEVICE'));
ALTER TABLE sager_whatsapp_message
    ADD COLUMN delivery_status VARCHAR(16)
        CHECK (delivery_status IN ('QUEUED','SENT','DELIVERED','READ','FAILED','UNCERTAIN')),
    ADD COLUMN delivery_failure_code VARCHAR(64),
    ADD COLUMN created_by UUID,
    ADD COLUMN idempotency_key VARCHAR(128),
    ADD CONSTRAINT sager_whatsapp_message_delivery_valid CHECK ((
        ((direction = 'IN' AND delivery_status IS NULL) OR (direction = 'OUT' AND delivery_status IS NOT NULL))
        AND (provider_message_id IS NOT NULL OR delivery_status IN ('QUEUED','FAILED','UNCERTAIN'))) IS TRUE);
CREATE UNIQUE INDEX sager_whatsapp_message_idempotency_unique ON sager_whatsapp_message(created_by, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

ALTER TABLE sager_whatsapp_conversation ADD COLUMN read_at TIMESTAMPTZ;
CREATE INDEX sager_whatsapp_conversation_recent_idx ON sager_whatsapp_conversation(last_message_at DESC, id DESC);
CREATE INDEX sager_whatsapp_conversation_phone_idx ON sager_whatsapp_conversation(phone);

DO $$ DECLARE current_check TEXT; BEGIN
    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_resource_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_resource_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_resource_allowed CHECK ((%s) OR resource IN (''WHATSAPP_CONVERSATION'',''WHATSAPP_MESSAGE'',''WHATSAPP_SESSION''))', current_check);
    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_changed_fields_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_changed_fields_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_changed_fields_allowed CHECK ((%s) OR
        (array_position(changed_fields,NULL) IS NULL AND
            ((resource = ''WHATSAPP_CONVERSATION'' AND changed_fields <@ ARRAY[''guardianId'',''chatId'']::TEXT[]) OR
             (resource = ''WHATSAPP_MESSAGE'' AND changed_fields <@ ARRAY[''conversationId'',''deliveryStatus'',''mediaType'',''fileHash'',''providerMessageId'',''failureCode'']::TEXT[]) OR
             (resource = ''WHATSAPP_SESSION'' AND changed_fields <@ ARRAY[''started'',''qrRead'']::TEXT[]))))', current_check);
END $$;
