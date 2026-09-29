CREATE TABLE sager_local_account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profile VARCHAR(32) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sager_local_account_email_normalized CHECK (email = LOWER(TRIM(email))),
    CONSTRAINT sager_local_account_profile_allowed
        CHECK (profile IN ('gestor', 'supervisor', 'residente'))
);

ALTER TABLE SPRING_SESSION ALTER COLUMN PRINCIPAL_NAME TYPE VARCHAR(320);
