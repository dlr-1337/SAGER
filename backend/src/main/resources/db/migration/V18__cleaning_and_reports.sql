CREATE TABLE sager_cleaning_policy (
 version BIGINT PRIMARY KEY CHECK(version=1), criteria JSONB NOT NULL, threshold NUMERIC(4,2) NOT NULL);
INSERT INTO sager_cleaning_policy VALUES(1,'{"PISO":0.25,"SUPERFICIES":0.25,"RESIDUOS":0.25,"ORGANIZACAO":0.25}',6.00);
CREATE FUNCTION sager_cleaning_values_valid(values_json JSONB,result_score NUMERIC) RETURNS BOOLEAN
 LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE key TEXT; value NUMERIC; total NUMERIC=0;
BEGIN
 IF jsonb_typeof(values_json)<>'object' OR (SELECT COUNT(*) FROM jsonb_object_keys(values_json))<>4 THEN RETURN false; END IF;
 FOREACH key IN ARRAY ARRAY['PISO','SUPERFICIES','RESIDUOS','ORGANIZACAO'] LOOP
  IF NOT values_json?key OR jsonb_typeof(values_json->key)<>'number' THEN RETURN false; END IF;
  value=(values_json->>key)::numeric;
  IF value<0 OR value>10 OR value*10<>TRUNC(value*10) THEN RETURN false; END IF;
  total=total+value;
 END LOOP;
 RETURN result_score=ROUND(total/4,2);
EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN RETURN false;
END; $$;
CREATE TABLE sager_cleaning_assessment (
 sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE, id UUID PRIMARY KEY,
 room_id UUID NOT NULL REFERENCES sager_room(id), room_code VARCHAR(64) NOT NULL,
 accommodation_id UUID NOT NULL, evaluated_at TIMESTAMPTZ NOT NULL, assessment_date DATE NOT NULL,
 time_mode VARCHAR(16) NOT NULL CHECK(time_mode IN ('NOW','RETROACTIVE')), registration_reason VARCHAR(2000),
 policy_version BIGINT NOT NULL REFERENCES sager_cleaning_policy(version),
 criteria JSONB NOT NULL, score NUMERIC(4,2) NOT NULL CHECK(score BETWEEN 0 AND 10),
 observation VARCHAR(2000), version BIGINT NOT NULL DEFAULT 0 CHECK(version>=0),
 recorded_at TIMESTAMPTZ NOT NULL, recorded_by UUID NOT NULL,
 CHECK(sager_cleaning_values_valid(criteria,score)),
 UNIQUE(room_id,assessment_date),
 CHECK(assessment_date=(evaluated_at AT TIME ZONE 'America/Sao_Paulo')::date),
 CHECK(time_mode<>'RETROACTIVE' OR LENGTH(BTRIM(registration_reason)) BETWEEN 10 AND 2000));
CREATE TABLE sager_cleaning_participant (
 assessment_id UUID NOT NULL REFERENCES sager_cleaning_assessment(id),
 allocation_id UUID NOT NULL, resident_id UUID NOT NULL REFERENCES sager_resident(id),
 resident_name VARCHAR(200) NOT NULL, PRIMARY KEY(assessment_id,resident_id));
CREATE INDEX sager_cleaning_own_idx ON sager_cleaning_participant(resident_id,assessment_id);
CREATE INDEX sager_cleaning_period_idx ON sager_cleaning_assessment(assessment_date,room_id);
CREATE TABLE sager_cleaning_revision (
 assessment_id UUID NOT NULL REFERENCES sager_cleaning_assessment(id), version BIGINT NOT NULL,
 criteria JSONB NOT NULL, score NUMERIC(4,2) NOT NULL, observation VARCHAR(2000),
 reason VARCHAR(2000), recorded_at TIMESTAMPTZ NOT NULL, recorded_by UUID NOT NULL,
 CHECK(sager_cleaning_values_valid(criteria,score)),
 PRIMARY KEY(assessment_id,version));
CREATE TRIGGER sager_cleaning_policy_immutable BEFORE UPDATE OR DELETE ON sager_cleaning_policy
 FOR EACH ROW EXECUTE FUNCTION sager_discipline_immutable();
CREATE TRIGGER sager_cleaning_participant_immutable BEFORE UPDATE OR DELETE ON sager_cleaning_participant
 FOR EACH ROW EXECUTE FUNCTION sager_discipline_immutable();
CREATE TRIGGER sager_cleaning_revision_immutable BEFORE UPDATE OR DELETE ON sager_cleaning_revision
 FOR EACH ROW EXECUTE FUNCTION sager_discipline_immutable();
CREATE FUNCTION sager_cleaning_identity_preserved() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['criteria','score','observation','version','recorded_at','recorded_by'])
 IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['criteria','score','observation','version','recorded_at','recorded_by'])
 THEN RAISE EXCEPTION 'assessment identity and participants frozen' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER sager_cleaning_identity_preserved BEFORE UPDATE ON sager_cleaning_assessment
 FOR EACH ROW EXECUTE FUNCTION sager_cleaning_identity_preserved();

CREATE TABLE sager_report_snapshot (
 id UUID PRIMARY KEY, owner_id UUID NOT NULL, catalog_code VARCHAR(32) NOT NULL, catalog_version BIGINT NOT NULL,
 filters JSONB NOT NULL, columns JSONB NOT NULL, rows JSONB NOT NULL, summary JSONB NOT NULL, monthly JSONB NOT NULL,
 row_count INTEGER NOT NULL CHECK(row_count BETWEEN 0 AND 10000), content_hash VARCHAR(64) NOT NULL,
 as_of TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL CHECK(expires_at=as_of+INTERVAL '24 hours'));
CREATE INDEX sager_report_snapshot_expiry_idx ON sager_report_snapshot(expires_at);
CREATE TABLE sager_report_expired_snapshot(id UUID PRIMARY KEY,owner_id UUID NOT NULL,expires_at TIMESTAMPTZ NOT NULL);
CREATE TRIGGER sager_report_snapshot_immutable BEFORE UPDATE ON sager_report_snapshot
 FOR EACH ROW EXECUTE FUNCTION sager_discipline_immutable();
CREATE TABLE sager_report_export (
 id UUID PRIMARY KEY, snapshot_id UUID NOT NULL, owner_id UUID NOT NULL,
 format VARCHAR(8) NOT NULL CHECK(format IN ('PDF','XLSX')),
 status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','READY','FAILED','EXPIRED')),
 created_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 lease_token UUID, lease_until TIMESTAMPTZ, attempts INTEGER NOT NULL DEFAULT 0, version BIGINT NOT NULL DEFAULT 0,
 document_id UUID, document_sha256 VARCHAR(64), document_size BIGINT, error_code VARCHAR(64),
 UNIQUE(snapshot_id,format),
 CHECK(status<>'READY' OR (document_id IS NOT NULL AND document_sha256~'^[0-9a-f]{64}$' AND document_size>0)));
CREATE INDEX sager_report_export_pending_idx ON sager_report_export(status,lease_until);
CREATE FUNCTION sager_report_export_identity_preserved() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id<>OLD.id OR NEW.snapshot_id<>OLD.snapshot_id OR NEW.owner_id<>OLD.owner_id
 OR NEW.format<>OLD.format OR NEW.created_at<>OLD.created_at OR NEW.expires_at<>OLD.expires_at
 THEN RAISE EXCEPTION 'export identity immutable' USING ERRCODE='23514'; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER sager_report_export_identity_preserved BEFORE UPDATE ON sager_report_export
 FOR EACH ROW EXECUTE FUNCTION sager_report_export_identity_preserved();

DO $$
DECLARE current_check TEXT;
BEGIN
 SELECT pg_get_expr(conbin,conrelid) INTO current_check FROM pg_constraint WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_resource_allowed';
 ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_resource_allowed;
 EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_resource_allowed CHECK ((%s) OR resource IN (''CLEANING_ASSESSMENT'',''REPORT_SNAPSHOT'',''REPORT_EXPORT''))',current_check);
 SELECT pg_get_expr(conbin,conrelid) INTO current_check FROM pg_constraint WHERE conrelid='sager_audit_event'::regclass AND conname='sager_audit_event_changed_fields_allowed';
 ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_changed_fields_allowed;
 EXECUTE format('ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_changed_fields_allowed CHECK ((%s) OR (array_position(changed_fields,NULL) IS NULL AND (
 (resource=''CLEANING_ASSESSMENT'' AND changed_fields <@ ARRAY[''roomId'',''evaluatedAt'',''criteria'',''score'',''observation'',''participantIds'',''reason'']::TEXT[])
 OR (resource=''REPORT_SNAPSHOT'' AND changed_fields <@ ARRAY[''catalogCode'',''filters'',''rowCount'',''expiresAt'']::TEXT[])
 OR (resource=''REPORT_EXPORT'' AND changed_fields <@ ARRAY[''snapshotId'',''format'',''status'',''document'',''reason'']::TEXT[]))))',current_check);
END; $$;
