-- Grupo de "Quem recebe?" gravado com o rascunho do aviso, montado pelo servidor a partir da opção
-- escolhida ("Todos os moradores", o nome do alojamento, o quarto com o alojamento...).
-- Avisos antigos ficam sem o grupo e continuam válidos; nenhuma linha é alterada.
ALTER TABLE sager_notice ADD COLUMN audience_label VARCHAR(500) NULL;
ALTER TABLE sager_notice ADD CONSTRAINT sager_notice_audience_label_valid
    CHECK (audience_label IS NULL OR LENGTH(BTRIM(audience_label)) BETWEEN 1 AND 500);

DO $$ DECLARE current_check TEXT; BEGIN
    SELECT pg_get_expr(conbin, conrelid) INTO current_check FROM pg_constraint
        WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_changed_fields_allowed';
    ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_changed_fields_allowed;
    EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_changed_fields_allowed CHECK ((%s) OR
        (array_position(changed_fields,NULL) IS NULL AND
            resource = ''NOTICE'' AND changed_fields <@ ARRAY[''title'',''body'',''residentIds'',''audience'']::TEXT[]))', current_check);
END $$;
