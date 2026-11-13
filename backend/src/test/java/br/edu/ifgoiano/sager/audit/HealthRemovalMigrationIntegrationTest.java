package br.edu.ifgoiano.sager.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

class HealthRemovalMigrationIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");
    private static final List<String> HEALTH_TABLES = List.of("sager_health_grant", "sager_health_care_assignment",
            "sager_health_note", "sager_health_revision", "sager_health_share", "sager_health_custody");
    private static final String AUDIT_PROJECTION = "SELECT id, sequence, occurred_at, actor_id, actor_profile, origin,"
            + " request_id, resource, resource_id, action, resulting_version, changed_fields::text AS changed_fields"
            + " FROM sager_audit_event ORDER BY sequence";

    static {
        POSTGRES.start();
    }

    @Test
    void dropsEmptyHealthTablesDeactivatesHealthAccountsAndKeepsAuditEvents() {
        String schema = "health_removal_empty";
        migrate(schema, "29");
        JdbcTemplate jdbc = jdbc(schema);
        UUID account = account(jdbc, "saude", "SAUDE-LEGADA");
        UUID gestor = account(jdbc, "gestor", "GESTOR-ATIVO");
        audit(jdbc, account, "HEALTH_GRANT", "CREATE", "ARRAY['accountId','profession']");
        audit(jdbc, account, "HEALTH_NOTE", "READ", "ARRAY['body']");
        audit(jdbc, account, "HEALTH_EXPORT", "EXPORT", "ARRAY['notes','versions']");
        List<Map<String, Object>> events = jdbc.queryForList(AUDIT_PROJECTION);

        migrate(schema, null);

        assertThat(latestVersion(jdbc)).isEqualTo(30);
        for (String table : HEALTH_TABLES) {
            assertThat(jdbc.queryForObject("SELECT to_regclass(?) IS NULL", Boolean.class, table)).as(table).isTrue();
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace"
                + " WHERE n.nspname = ? AND p.proname = 'sager_reject_health_document_mutation'", Integer.class, schema))
                .isZero();
        assertThat(jdbc.queryForMap("SELECT profile, active FROM sager_local_account WHERE id = ?", account))
                .containsEntry("profile", "saude").containsEntry("active", false);
        assertThat(jdbc.queryForObject("SELECT active FROM sager_local_account WHERE id = ?", Boolean.class, gestor))
                .isTrue();
        assertThat(jdbc.queryForList(AUDIT_PROJECTION)).isEqualTo(events);
    }

    @Test
    void refusesToRunWhileAnyHealthRecordExists() {
        String schema = "health_removal_with_data";
        migrate(schema, "29");
        JdbcTemplate jdbc = jdbc(schema);
        UUID professional = account(jdbc, "saude", "SAUDE-COM-DADOS");
        UUID verifier = account(jdbc, "gestor", "GESTOR-VERIFICADOR");
        UUID grant = jdbc.queryForObject("""
                INSERT INTO sager_health_grant (account_id, profession, registration_number, registration_region,
                    verified_by, verification_reason)
                VALUES (?, 'ENFERMAGEM', 'COREN-000', 'GO', ?, 'Registro sintético conferido.')
                RETURNING id
                """, UUID.class, professional, verifier);

        assertThatThrownBy(() -> migrate(schema, null)).isInstanceOf(FlywayException.class)
                .hasMessageContaining("V30 recusada");

        assertThat(latestVersion(jdbc)).isEqualTo(29);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_health_grant WHERE id = ?", Integer.class, grant))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT active FROM sager_local_account WHERE id = ?", Boolean.class,
                professional)).isTrue();
    }

    private static UUID account(JdbcTemplate jdbc, String profile, String enrollment) {
        return jdbc.queryForObject("""
                INSERT INTO sager_local_account (email, display_name, password_hash, profile, enrollment)
                VALUES (?, 'Conta Sintética', 'hash-sintetico', ?, ?) RETURNING id
                """, UUID.class, enrollment.toLowerCase() + "@example.invalid", profile, enrollment);
    }

    private static void audit(JdbcTemplate jdbc, UUID actor, String resource, String action, String fields) {
        jdbc.update("INSERT INTO sager_audit_event (actor_id, actor_profile, origin, request_id, resource, resource_id,"
                + " action, resulting_version, changed_fields) VALUES (?, 'saude', 'LOCAL_API', ?, ?, ?, ?, 0, "
                + fields + ")", actor, UUID.randomUUID(), resource, UUID.randomUUID(), action);
    }

    private static int latestVersion(JdbcTemplate jdbc) {
        return jdbc.queryForObject("SELECT MAX(CAST(version AS INTEGER)) FROM flyway_schema_history"
                + " WHERE success AND version IS NOT NULL", Integer.class);
    }

    private static void migrate(String schema, String version) {
        var configuration = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .schemas(schema).defaultSchema(schema).locations("classpath:db/migration");
        if (version != null) configuration.target(version);
        configuration.load().migrate();
    }

    private static JdbcTemplate jdbc(String schema) {
        String separator = POSTGRES.getJdbcUrl().contains("?") ? "&" : "?";
        return new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl() + separator + "currentSchema=" + schema,
                POSTGRES.getUsername(), POSTGRES.getPassword()));
    }
}
