-- A rotina diária encerra o vínculo de quem passou da saída prevista do curso com o motivo CONCLUSION.
ALTER TABLE sager_room_allocation DROP CONSTRAINT sager_room_allocation_end_valid;
ALTER TABLE sager_room_allocation ADD CONSTRAINT sager_room_allocation_end_valid CHECK (
    (ended_at IS NULL AND end_reason IS NULL)
    OR (ended_at IS NOT NULL AND ended_at >= started_at
        AND end_reason IS NOT NULL AND end_reason IN ('TRANSFER', 'END', 'CONCLUSION'))
);
