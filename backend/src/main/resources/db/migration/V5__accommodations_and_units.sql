CREATE TABLE sager_accommodation (
    id UUID PRIMARY KEY,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(200) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sager_accommodation_code_not_blank
        CHECK (LENGTH(BTRIM(code)) > 0 AND code = BTRIM(code)),
    CONSTRAINT sager_accommodation_name_not_blank CHECK (LENGTH(BTRIM(name)) > 0),
    CONSTRAINT sager_accommodation_version_nonnegative CHECK (version >= 0)
);

CREATE UNIQUE INDEX sager_accommodation_code_unique ON sager_accommodation (LOWER(code));

CREATE TABLE sager_accommodation_unit (
    id UUID PRIMARY KEY,
    accommodation_id UUID NOT NULL,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(200) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sager_accommodation_unit_accommodation_fk
        FOREIGN KEY (accommodation_id) REFERENCES sager_accommodation (id),
    CONSTRAINT sager_accommodation_unit_id_accommodation_unique UNIQUE (id, accommodation_id),
    CONSTRAINT sager_accommodation_unit_code_not_blank
        CHECK (LENGTH(BTRIM(code)) > 0 AND code = BTRIM(code)),
    CONSTRAINT sager_accommodation_unit_name_not_blank CHECK (LENGTH(BTRIM(name)) > 0),
    CONSTRAINT sager_accommodation_unit_version_nonnegative CHECK (version >= 0)
);

CREATE UNIQUE INDEX sager_accommodation_unit_code_unique
    ON sager_accommodation_unit (accommodation_id, LOWER(code));
