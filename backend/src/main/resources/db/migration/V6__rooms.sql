CREATE TABLE sager_room (
    id UUID PRIMARY KEY,
    code VARCHAR(64) NOT NULL,
    number VARCHAR(64) NOT NULL,
    accommodation_id UUID NOT NULL,
    unit_id UUID,
    floor VARCHAR(64),
    capacity INTEGER,
    situation VARCHAR(32) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sager_room_accommodation_fk
        FOREIGN KEY (accommodation_id) REFERENCES sager_accommodation (id),
    CONSTRAINT sager_room_unit_accommodation_fk
        FOREIGN KEY (unit_id, accommodation_id)
        REFERENCES sager_accommodation_unit (id, accommodation_id),
    CONSTRAINT sager_room_code_not_blank
        CHECK (LENGTH(BTRIM(code)) > 0 AND code = BTRIM(code)),
    CONSTRAINT sager_room_number_not_blank
        CHECK (LENGTH(BTRIM(number)) > 0 AND number = BTRIM(number)),
    CONSTRAINT sager_room_floor_not_blank
        CHECK (floor IS NULL OR (LENGTH(BTRIM(floor)) > 0 AND floor = BTRIM(floor))),
    CONSTRAINT sager_room_capacity_positive CHECK (capacity IS NULL OR capacity > 0),
    CONSTRAINT sager_room_situation_valid
        CHECK (situation IN ('Disponível', 'Ocupado', 'Manutenção', 'Indisponível')),
    CONSTRAINT sager_room_version_nonnegative CHECK (version >= 0)
);

CREATE UNIQUE INDEX sager_room_code_unique ON sager_room (LOWER(code));

CREATE UNIQUE INDEX sager_room_location_unique
    ON sager_room (accommodation_id, unit_id, LOWER(floor), LOWER(number)) NULLS NOT DISTINCT;
