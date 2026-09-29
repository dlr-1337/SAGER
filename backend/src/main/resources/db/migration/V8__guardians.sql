CREATE TABLE sager_guardian (
    id UUID PRIMARY KEY,
    resident_id UUID NOT NULL REFERENCES sager_resident (id),
    name VARCHAR(200) NOT NULL,
    relationship VARCHAR(80) NOT NULL,
    phone VARCHAR(30),
    active BOOLEAN NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sager_guardian_name_valid
        CHECK (LENGTH(name) BETWEEN 3 AND 200 AND name = BTRIM(name)),
    CONSTRAINT sager_guardian_relationship_valid
        CHECK (LENGTH(relationship) BETWEEN 2 AND 80 AND relationship = BTRIM(relationship)),
    CONSTRAINT sager_guardian_phone_valid
        CHECK (phone IS NULL OR (LENGTH(phone) BETWEEN 1 AND 30 AND phone = BTRIM(phone))),
    CONSTRAINT sager_guardian_version_nonnegative CHECK (version >= 0)
);

CREATE INDEX sager_guardian_resident_idx ON sager_guardian (resident_id);
