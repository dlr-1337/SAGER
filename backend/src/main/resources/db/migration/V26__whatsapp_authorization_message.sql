-- The authorization PDF sent by the long exit flow also appears in the guardian's conversation.
ALTER TABLE sager_whatsapp_message DROP CONSTRAINT sager_whatsapp_message_origin_check;
ALTER TABLE sager_whatsapp_message ADD CONSTRAINT sager_whatsapp_message_origin_check
    CHECK (origin IN ('WEBHOOK', 'RECONCILIATION', 'SUPERVISOR', 'DEVICE', 'AUTHORIZATION'));
