-- Account creation and domain registration remain separate operations. Existing
-- accounts intentionally retain NULL links: no matching by email, name or enrollment.
ALTER TABLE sager_local_account
    ADD COLUMN resident_id UUID,
    ADD COLUMN supervisor_id UUID,
    ADD CONSTRAINT sager_local_account_resident_fk
        FOREIGN KEY (resident_id) REFERENCES sager_resident (id),
    ADD CONSTRAINT sager_local_account_supervisor_fk
        FOREIGN KEY (supervisor_id) REFERENCES sager_supervisor (id),
    ADD CONSTRAINT sager_local_account_resident_unique UNIQUE (resident_id),
    ADD CONSTRAINT sager_local_account_supervisor_unique UNIQUE (supervisor_id),
    ADD CONSTRAINT sager_local_account_single_link
        CHECK (resident_id IS NULL OR supervisor_id IS NULL),
    ADD CONSTRAINT sager_local_account_resident_profile
        CHECK (resident_id IS NULL OR profile = 'residente'),
    ADD CONSTRAINT sager_local_account_supervisor_profile
        CHECK (supervisor_id IS NULL OR profile IN ('gestor', 'supervisor'));
