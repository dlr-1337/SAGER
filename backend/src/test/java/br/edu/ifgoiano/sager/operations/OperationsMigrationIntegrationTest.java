package br.edu.ifgoiano.sager.operations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

class OperationsMigrationIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");

    static {
        POSTGRES.start();
    }

    @Test
    void extendsInstalledAuditChecksWithoutReplacingPriorResourcesOrEvents() throws Exception {
        String schema = "ops_upgrade_prior";
        migrate(schema, "13");
        JdbcTemplate jdbc = jdbc(schema);
        String resourceCheck = check(jdbc, "sager_audit_event_resource_allowed");
        String fieldsCheck = check(jdbc, "sager_audit_event_changed_fields_allowed");
        jdbc.execute("ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_resource_allowed");
        jdbc.execute("ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_resource_allowed CHECK (("
                + resourceCheck + ") OR resource = 'PRIOR_RECORD')");
        jdbc.execute("ALTER TABLE sager_audit_event DROP CONSTRAINT sager_audit_event_changed_fields_allowed");
        jdbc.execute("ALTER TABLE sager_audit_event ADD CONSTRAINT sager_audit_event_changed_fields_allowed CHECK (("
                + fieldsCheck + ") OR (resource = 'PRIOR_RECORD' AND array_position(changed_fields, NULL) IS NULL"
                + " AND changed_fields <@ ARRAY['priorField']::text[]))");
        UUID old = UUID.randomUUID();
        insertAudit(jdbc, "PRIOR_RECORD", old, "LOCAL_API", UUID.randomUUID(), "supervisor", "ARRAY['priorField']");
        String projection = "SELECT id, sequence, occurred_at, actor_id, actor_profile, origin, request_id,"
                + " resource, resource_id, action, resulting_version, changed_fields::text AS changed_fields"
                + " FROM sager_audit_event WHERE resource_id = ?";
        var original = jdbc.queryForMap(projection, old);

        migrate(schema, null);

        assertThat(jdbc.queryForMap(projection, old)).isEqualTo(original);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_night_call", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_short_exit", Integer.class)).isZero();
        insertAudit(jdbc, "PRIOR_RECORD", UUID.randomUUID(), "LOCAL_API", UUID.randomUUID(),
                "supervisor", "ARRAY['priorField']");
        insertAudit(jdbc, "NIGHT_CALL", UUID.randomUUID(), "LOCAL_API", UUID.randomUUID(),
                "supervisor", "ARRAY['referenceDate', 'status']");
        insertAudit(jdbc, "NIGHT_CALL_MARK", UUID.randomUUID(), "LOCAL_API", UUID.randomUUID(),
                "supervisor", "ARRAY['mark', 'authorizedExitId']");
        insertAudit(jdbc, "SHORT_EXIT", UUID.randomUUID(), "SYSTEM_JOB", null, null,
                "ARRAY['status', 'expiryReason']");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event", Integer.class)).isEqualTo(5);
        assertThatThrownBy(() -> jdbc.update("DELETE FROM sager_audit_event WHERE resource_id = ?", old))
                .satisfies(error -> assertThat(sqlState(error)).isEqualTo("55000"));
    }

    @Test
    void systemMetadataRequiresNullActorsAndApiMetadataRequiresAuthenticatedActors() {
        String schema = "ops_system_metadata";
        migrate(schema, null);
        JdbcTemplate jdbc = jdbc(schema);
        insertAudit(jdbc, "SHORT_EXIT", UUID.randomUUID(), "SYSTEM_JOB", null, null,
                "ARRAY['status', 'expiryReason']");
        assertThatThrownBy(() -> insertAudit(jdbc, "SHORT_EXIT", UUID.randomUUID(), "LOCAL_API", null,
                null, "ARRAY['status']")).satisfies(error -> assertThat(sqlState(error)).isEqualTo("23514"));
        assertThatThrownBy(() -> insertAudit(jdbc, "SHORT_EXIT", UUID.randomUUID(), "SYSTEM_JOB",
                UUID.randomUUID(), "supervisor", "ARRAY['status']"))
                .satisfies(error -> assertThat(sqlState(error)).isEqualTo("23514"));
        for (String fields : new String[] { "ARRAY['Motivo sintético']", "ARRAY['password']",
                "ARRAY['diagnosis']", "ARRAY[NULL]::text[]" }) {
            assertThatThrownBy(() -> insertAudit(jdbc, "SHORT_EXIT", UUID.randomUUID(), "LOCAL_API",
                    UUID.randomUUID(), "residente", fields))
                    .satisfies(error -> assertThat(sqlState(error)).isEqualTo("23514"));
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event", Integer.class)).isEqualTo(1);
    }

    @Test
    void physicalUniqueConstraintSurvivesNonoverlappingPlansAndAllowsNextExitAfterReturn() {
        String schema = "ops_physical_unique";
        migrate(schema, null);
        JdbcTemplate jdbc = jdbc(schema);
        UUID resident = resident(jdbc);
        UUID first = approvedExit(jdbc, resident, 0);
        UUID second = approvedExit(jdbc, resident, 10800);
        jdbc.update("UPDATE sager_short_exit SET status = 'EM_ANDAMENTO', actual_departure_at = requested_departure_at"
                + " WHERE id = ?", first);
        assertThatThrownBy(() -> jdbc.update("UPDATE sager_short_exit SET status = 'EM_ANDAMENTO',"
                + " actual_departure_at = requested_departure_at WHERE id = ?", second))
                .satisfies(error -> assertThat(sqlState(error)).isEqualTo("23505"));
        jdbc.update("UPDATE sager_short_exit SET status = 'RETORNO_CONFIRMADO',"
                + " actual_return_at = requested_departure_at + INTERVAL '1 hour' WHERE id = ?", first);
        jdbc.update("UPDATE sager_short_exit SET status = 'EM_ANDAMENTO', actual_departure_at = requested_departure_at"
                + " WHERE id = ?", second);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_short_exit WHERE actual_departure_at IS NOT NULL"
                + " AND actual_return_at IS NULL", Integer.class)).isEqualTo(1);
        assertThatThrownBy(() -> jdbc.update("UPDATE sager_short_exit SET status = 'RETORNO_CONFIRMADO',"
                + " actual_return_at = actual_departure_at WHERE id = ?", second))
                .satisfies(error -> assertThat(sqlState(error)).isEqualTo("23514"));
    }

    @Test
    void databaseEnforcesDurationAndLateReturnEvidence() {
        String schema = "ops_state_evidence";
        migrate(schema, null);
        JdbcTemplate jdbc = jdbc(schema);
        UUID exit = approvedExit(jdbc, resident(jdbc), 0);
        assertThatThrownBy(() -> jdbc.update("UPDATE sager_short_exit SET expected_return_at ="
                + " requested_departure_at + INTERVAL '3 hours 1 second' WHERE id = ?", exit))
                .satisfies(error -> assertThat(sqlState(error)).isEqualTo("23514"));
        jdbc.update("UPDATE sager_short_exit SET status = 'EM_ANDAMENTO', actual_departure_at = requested_departure_at"
                + " WHERE id = ?", exit);
        assertThatThrownBy(() -> jdbc.update("UPDATE sager_short_exit SET status = 'RETORNO_CONFIRMADO_COM_ATRASO',"
                + " actual_return_at = expected_return_at + INTERVAL '1 second' WHERE id = ?", exit))
                .satisfies(error -> assertThat(sqlState(error)).isEqualTo("23514"));
        assertThat(jdbc.queryForObject("SELECT status FROM sager_short_exit WHERE id = ?", String.class, exit))
                .isEqualTo("EM_ANDAMENTO");
    }

    @Test
    void markHistoryAcceptsSystemActorOnlyForJustifiedAbsenceAtCallVersionZero() {
        String schema = "ops_mark_history_actor";
        migrate(schema, null);
        JdbcTemplate jdbc = jdbc(schema);
        UUID resident = resident(jdbc);
        UUID accommodation = UUID.randomUUID();
        UUID call = UUID.randomUUID();
        UUID mark = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_accommodation(id, code, name) VALUES (?, 'OPS', 'Sintético')", accommodation);
        jdbc.update("INSERT INTO sager_night_call(id, accommodation_id, accommodation_name, reference_date,"
                + " opened_at, opened_by) VALUES (?, ?, 'Sintético', DATE '2026-09-30', NOW(), ?)",
                call, accommodation, UUID.randomUUID());
        jdbc.update("INSERT INTO sager_night_call_mark(id, call_id, resident_id, resident_name, enrollment,"
                + " birth_date, room_id, room_number) VALUES (?, ?, ?, 'Estudante Sintético', 'OPS-MIGRATION',"
                + " DATE '2009-01-01', ?, '1')", mark, call, resident, UUID.randomUUID());
        insertMarkHistory(jdbc, mark, "sistema", "AUSENCIA_JUSTIFICADA", 0);
        insertMarkHistory(jdbc, mark, "supervisor", "AUSENCIA_JUSTIFICADA", 1);
        insertMarkHistory(jdbc, mark, "supervisor", "PRESENTE", 1);
        assertRejectedMarkHistory(jdbc, mark, "sistema", "PRESENTE", 0);
        assertRejectedMarkHistory(jdbc, mark, "sistema", "AUSENTE", 0);
        assertRejectedMarkHistory(jdbc, mark, "sistema", "AUSENCIA_JUSTIFICADA", 1);
        assertRejectedMarkHistory(jdbc, mark, "supervisor", "AUSENCIA_JUSTIFICADA", 0);
        assertRejectedMarkHistory(jdbc, mark, "gestor", "PRESENTE", 1);
    }

    private void assertRejectedMarkHistory(JdbcTemplate jdbc, UUID mark, String profile, String value, long callVersion) {
        assertThatThrownBy(() -> insertMarkHistory(jdbc, mark, profile, value, callVersion))
                .satisfies(error -> assertThat(sqlState(error)).isEqualTo("23514"));
    }

    private void insertMarkHistory(JdbcTemplate jdbc, UUID mark, String profile, String value, long callVersion) {
        boolean justified = "AUSENCIA_JUSTIFICADA".equals(value);
        jdbc.update("INSERT INTO sager_night_call_mark_history(id, mark_id, mark, authorized_exit_id,"
                + " authorized_exit_type, recorded_at, actor_id, actor_profile, resulting_version, call_version)"
                + " VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, 1, ?)", UUID.randomUUID(), mark, value,
                justified ? UUID.randomUUID() : null, justified ? "SHORT" : null, UUID.randomUUID(), profile, callVersion);
    }

    private String check(JdbcTemplate jdbc, String name) {
        return jdbc.queryForObject("SELECT pg_get_expr(conbin, conrelid) FROM pg_constraint"
                + " WHERE conrelid = 'sager_audit_event'::regclass AND conname = ?", String.class, name);
    }

    private void insertAudit(JdbcTemplate jdbc, String resource, UUID id, String origin, UUID actor,
            String profile, String fields) {
        jdbc.update("INSERT INTO sager_audit_event(actor_id, actor_profile, origin, request_id, resource, resource_id,"
                + " action, resulting_version, changed_fields) VALUES (?, ?, ?, ?, ?, ?, 'UPDATE', 1, " + fields + ")",
                actor, profile, origin, UUID.randomUUID(), resource, id);
    }

    private UUID resident(JdbcTemplate jdbc) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident(id, name, enrollment, birth_date)"
                + " VALUES (?, 'Estudante Sintético', 'OPS-MIGRATION', DATE '2009-01-01')", id);
        return id;
    }

    private UUID approvedExit(JdbcTemplate jdbc, UUID resident, int seconds) {
        UUID id = UUID.randomUUID();
        OffsetDateTime departure = OffsetDateTime.parse("2026-10-01T01:00:00Z").plusSeconds(seconds);
        jdbc.update("""
                INSERT INTO sager_short_exit(id, resident_id, resident_name, enrollment, departure_mode,
                    requested_departure_at, expected_return_at, reason, status, decision, decided_at,
                    created_at, updated_at)
                VALUES (?, ?, 'Estudante Sintético', 'OPS-MIGRATION', 'SCHEDULED', ?, ?, 'Motivo sintético',
                    'APROVADA', 'APPROVE', ?, ?, ?)
                """, id, resident, departure, departure.plusHours(3), departure.minusSeconds(1),
                departure.minusSeconds(1), departure.minusSeconds(1));
        return id;
    }

    private String sqlState(Throwable error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql) return sql.getSQLState();
        }
        throw new AssertionError("Expected PostgreSQL rejection", error);
    }

    private void migrate(String schema, String version) {
        var configuration = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .schemas(schema).defaultSchema(schema).locations("classpath:db/migration");
        if (version != null) configuration.target(version);
        configuration.load().migrate();
    }

    private JdbcTemplate jdbc(String schema) {
        String separator = POSTGRES.getJdbcUrl().contains("?") ? "&" : "?";
        return new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl() + separator + "currentSchema=" + schema,
                POSTGRES.getUsername(), POSTGRES.getPassword()));
    }
}
