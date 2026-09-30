-- NOT VALID preserves previously registered residents without a birth date.
-- PostgreSQL enforces the check on every new or updated row. After legacy
-- records are corrected, validate this constraint in a later migration.
ALTER TABLE sager_resident
    ADD CONSTRAINT sager_resident_birth_date_required
    CHECK (birth_date IS NOT NULL) NOT VALID;
