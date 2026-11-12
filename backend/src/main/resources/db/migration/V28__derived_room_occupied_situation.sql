-- Ocupado is now derived from capacity and active allocations; only manual states are stored.
-- Without capacity Ocupado cannot be derived, so those rooms keep refusing entries as Indisponível.
-- Version stays: open forms must not see this as a registry change.
WITH changed AS (
    UPDATE sager_room SET situation = CASE WHEN capacity IS NULL THEN 'Indisponível' ELSE 'Disponível' END
    WHERE situation = 'Ocupado'
    RETURNING id, version
)
INSERT INTO sager_audit_event (origin, request_id, resource, resource_id, action, resulting_version, changed_fields)
SELECT 'SYSTEM_JOB', gen_random_uuid(), 'ROOM', id, 'UPDATE', version, ARRAY['situation'] FROM changed;

ALTER TABLE sager_room DROP CONSTRAINT sager_room_situation_valid;
ALTER TABLE sager_room ADD CONSTRAINT sager_room_situation_valid
    CHECK (situation IN ('Disponível', 'Manutenção', 'Indisponível'));
