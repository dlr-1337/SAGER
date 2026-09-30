-- Ephemeral security counters. Identifiers are keyed HMACs, never emails or IP addresses.
CREATE TABLE sager_login_rate_bucket (
    key_hash CHAR(64) PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),
    window_started_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL CHECK (attempts BETWEEN 1 AND 2000000)
);
CREATE INDEX sager_login_rate_bucket_expiry_idx ON sager_login_rate_bucket(window_started_at);
