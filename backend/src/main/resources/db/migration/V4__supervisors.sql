CREATE TABLE sager_supervisor (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    institutional_id VARCHAR(64) NOT NULL,
    email VARCHAR(320) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sager_supervisor_name_not_blank CHECK (LENGTH(BTRIM(name)) > 0),
    CONSTRAINT sager_supervisor_institutional_id_not_blank
        CHECK (LENGTH(BTRIM(institutional_id)) > 0),
    CONSTRAINT sager_supervisor_email_not_blank CHECK (LENGTH(BTRIM(email)) > 0),
    CONSTRAINT sager_supervisor_version_nonnegative CHECK (version >= 0)
);

CREATE UNIQUE INDEX sager_supervisor_institutional_id_unique
    ON sager_supervisor (LOWER(institutional_id));
