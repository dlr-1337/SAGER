-- The system justifies an absence while the call is opened, so that row keeps call version 0.
ALTER TABLE sager_night_call_mark_history
    DROP CONSTRAINT sager_night_call_mark_history_actor_profile_check,
    DROP CONSTRAINT sager_night_call_mark_history_call_version_check,
    ADD CONSTRAINT sager_night_call_mark_history_actor_valid CHECK ((
        (actor_profile = 'supervisor' AND call_version >= 1)
        OR (actor_profile = 'sistema' AND call_version = 0 AND mark = 'AUSENCIA_JUSTIFICADA')
    ) IS TRUE);
