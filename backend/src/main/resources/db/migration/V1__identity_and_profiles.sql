CREATE TABLE sager_identity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issuer VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sager_identity_issuer_subject_key UNIQUE (issuer, subject)
);

CREATE TABLE sager_identity_profile (
    identity_id UUID NOT NULL REFERENCES sager_identity (id) ON DELETE CASCADE,
    profile VARCHAR(32) NOT NULL,
    CONSTRAINT sager_identity_profile_pkey PRIMARY KEY (identity_id, profile),
    CONSTRAINT sager_identity_profile_allowed CHECK (profile IN ('gestor', 'supervisor', 'residente'))
);
