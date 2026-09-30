CREATE TABLE sager_room_allocation (
    id UUID PRIMARY KEY,
    resident_id UUID NOT NULL REFERENCES sager_resident (id),
    room_id UUID NOT NULL REFERENCES sager_room (id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ,
    end_reason VARCHAR(16),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sager_room_allocation_end_valid CHECK (
        (ended_at IS NULL AND end_reason IS NULL)
        OR (ended_at IS NOT NULL AND ended_at >= started_at
            AND end_reason IS NOT NULL AND end_reason IN ('TRANSFER', 'END'))
    ),
    CONSTRAINT sager_room_allocation_version_nonnegative CHECK (version >= 0)
);

CREATE UNIQUE INDEX sager_room_allocation_active_resident_unique
    ON sager_room_allocation (resident_id) WHERE ended_at IS NULL;

CREATE INDEX sager_room_allocation_active_room_idx
    ON sager_room_allocation (room_id) WHERE ended_at IS NULL;

CREATE INDEX sager_room_allocation_resident_history_idx
    ON sager_room_allocation (resident_id, started_at DESC, id DESC);
