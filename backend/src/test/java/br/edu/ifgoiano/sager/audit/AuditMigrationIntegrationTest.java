package br.edu.ifgoiano.sager.audit;

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

class AuditMigrationIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");

    static {
        POSTGRES.start();
    }

    @Test
    void upgradesExistingRecordsWithoutInventingHistoricalEvents() {
        String schema = "audit_upgrade";
        migrate(schema, "10");
        JdbcTemplate jdbc = jdbc(schema);
        UUID supervisor = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_supervisor (id, name, institutional_id, email)
                VALUES (?, 'Pessoa Sintética', 'DEMO-AUDIT', 'audit@example.invalid')
                """, supervisor);

        migrate(schema, null);

        assertThat(jdbc.queryForObject("SELECT to_regclass('sager_audit_event')", String.class))
                .as("permanent audit storage exists after upgrading V10")
                .isNotNull();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject("SELECT name FROM sager_supervisor WHERE id = ?",
                String.class, supervisor)).isEqualTo("Pessoa Sintética");
    }

    @Test
    void insertedEventsUseDatabaseIdentityAndTimeAndSurviveDomainAndActorRemoval() {
        JdbcTemplate jdbc = migrated("audit_retention");
        UUID actor = UUID.randomUUID();
        UUID resource = UUID.randomUUID();
        UUID request = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_local_account (id, email, display_name, password_hash, profile)
                VALUES (?, 'actor@example.invalid', 'Ator Sintético', 'test-only', 'gestor')
                """, actor);
        jdbc.update("""
                INSERT INTO sager_supervisor (id, name, institutional_id, email)
                VALUES (?, 'Registro Sintético', 'DEMO-RETENTION', 'record@example.invalid')
                """, resource);
        insert(jdbc, actor, resource, request);
        var event = jdbc.queryForMap("SELECT * FROM sager_audit_event");
        assertThat(event.get("id")).isInstanceOf(UUID.class);
        assertThat(event.get("sequence")).isEqualTo(1L);
        OffsetDateTime occurredAt = jdbc.queryForObject(
                "SELECT occurred_at FROM sager_audit_event", OffsetDateTime.class);
        assertThat(occurredAt).isNotNull();

        jdbc.update("DELETE FROM sager_supervisor WHERE id = ?", resource);
        jdbc.update("DELETE FROM sager_local_account WHERE id = ?", actor);

        assertThat(jdbc.queryForMap("SELECT actor_id, resource_id, request_id FROM sager_audit_event"))
                .containsEntry("actor_id", actor).containsEntry("resource_id", resource)
                .containsEntry("request_id", request);
        assertThat(jdbc.queryForList("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'audit_retention' AND table_name = 'sager_audit_event'
                """, String.class)).containsExactlyInAnyOrder("sequence", "id", "occurred_at",
                        "actor_id", "actor_profile", "origin", "request_id", "resource",
                        "resource_id", "action", "resulting_version", "changed_fields");
    }

    @Test
    void updateDeleteAndTruncateCannotErasePermanentEvents() {
        JdbcTemplate jdbc = migrated("audit_immutable");
        insert(jdbc, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        for (String mutation : new String[] {
                "UPDATE sager_audit_event SET actor_profile = 'supervisor'",
                "DELETE FROM sager_audit_event",
                "TRUNCATE sager_audit_event"
        }) {
            assertThatThrownBy(() -> jdbc.execute(mutation))
                    .satisfies(error -> assertThat(sqlState(error)).isEqualTo("55000"));
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event", Integer.class))
                    .isEqualTo(1);
        }
    }

    @Test
    void databaseRejectsPersonalValuesAndInvalidMetadata() {
        JdbcTemplate jdbc = migrated("audit_validation");
        for (String fieldArray : new String[] {
                "ARRAY['Pessoa Sintética']", "ARRAY['password']", "ARRAY['enrollment']",
                "ARRAY[NULL]::text[]"
        }) {
            assertThatThrownBy(() -> jdbc.update("""
                    INSERT INTO sager_audit_event
                        (actor_id, actor_profile, origin, request_id, resource, resource_id,
                         action, resulting_version, changed_fields)
                    VALUES (?, 'gestor', 'LOCAL_API', ?, 'SUPERVISOR', ?, 'CREATE', 0, %s)
                    """.formatted(fieldArray), UUID.randomUUID(), UUID.randomUUID(),
                            UUID.randomUUID()))
                    .satisfies(error -> assertThat(sqlState(error)).isEqualTo("23514"));
        }
        for (String invalid : new String[] {
                "'gestor', 'LOCAL_API', 'SUPERVISOR', 'CREATE', -1",
                "'unknown', 'LOCAL_API', 'SUPERVISOR', 'CREATE', 0",
                "'gestor', 'UNTRUSTED', 'SUPERVISOR', 'CREATE', 0",
                "'gestor', 'LOCAL_API', 'OTHER', 'CREATE', 0",
                "'gestor', 'LOCAL_API', 'SUPERVISOR', 'DELETE', 0"
        }) {
            assertThatThrownBy(() -> jdbc.update("""
                    INSERT INTO sager_audit_event
                        (actor_id, request_id, resource_id, actor_profile, origin, resource,
                         action, resulting_version, changed_fields)
                    SELECT ?, ?, ?, metadata.*, ARRAY['name']
                    FROM (SELECT %s) metadata
                    """.formatted(invalid), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID()))
                    .satisfies(error -> assertThat(sqlState(error)).isEqualTo("23514"));
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event", Integer.class))
                .isZero();
    }

    @Test
    void v33AcceptsAccountEventsWithFieldNamesOnlyAndKeepsOldEvents() {
        String schema = "audit_local_account";
        migrate(schema, "32");
        JdbcTemplate jdbc = jdbc(schema);
        insert(jdbc, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        String events = """
                SELECT sequence, id, occurred_at, actor_id, actor_profile, origin, request_id, resource,
                       resource_id, action, resulting_version, changed_fields::text AS fields
                FROM sager_audit_event ORDER BY sequence
                """;
        var before = jdbc.queryForList(events);

        migrate(schema, "33");

        assertThat(jdbc.queryForList(events)).isEqualTo(before);
        UUID account = UUID.randomUUID();
        accountEvent(jdbc, account, "'residente'", "'LOCAL_API'", "'LOCAL_ACCOUNT'", "ARRAY['password']");
        accountEvent(jdbc, null, "NULL", "'OPERATOR_CLI'", "'LOCAL_ACCOUNT'",
                "ARRAY['enrollment','name','profile','password']");
        for (Runnable invalid : new Runnable[] {
                () -> accountEvent(jdbc, account, "'residente'", "'LOCAL_API'", "'LOCAL_ACCOUNT'",
                        "ARRAY['passwordHash']"),
                () -> accountEvent(jdbc, account, "'gestor'", "'OPERATOR_CLI'", "'LOCAL_ACCOUNT'",
                        "ARRAY['active']"),
                () -> accountEvent(jdbc, null, "NULL", "'OPERATOR_CLI'", "'RESIDENT'", "ARRAY['name']")
        }) {
            assertThatThrownBy(invalid::run)
                    .satisfies(error -> assertThat(sqlState(error)).isEqualTo("23514"));
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event", Integer.class))
                .isEqualTo(3);
    }

    private void accountEvent(JdbcTemplate jdbc, UUID actor, String profile, String origin,
            String resource, String fields) {
        jdbc.update("""
                INSERT INTO sager_audit_event
                    (actor_id, actor_profile, origin, request_id, resource, resource_id,
                     action, resulting_version, changed_fields)
                VALUES (?, %s, %s, ?, %s, ?, 'UPDATE', 0, %s)
                """.formatted(profile, origin, resource, fields), actor, UUID.randomUUID(),
                UUID.randomUUID());
    }

    private void insert(JdbcTemplate jdbc, UUID actor, UUID resource, UUID request) {
        jdbc.update("""
                INSERT INTO sager_audit_event
                    (actor_id, actor_profile, origin, request_id, resource, resource_id,
                     action, resulting_version, changed_fields)
                VALUES (?, 'gestor', 'LOCAL_API', ?, 'SUPERVISOR', ?, 'CREATE', 0,
                        ARRAY['name', 'institutionalId', 'email'])
                """, actor, request, resource);
    }

    private String sqlState(Throwable error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql) {
                return sql.getSQLState();
            }
        }
        throw new AssertionError("Expected a PostgreSQL rejection", error);
    }

    private JdbcTemplate migrated(String schema) {
        migrate(schema, null);
        JdbcTemplate jdbc = jdbc(schema);
        assertThat(jdbc.queryForObject("SELECT to_regclass('sager_audit_event')", String.class))
                .isNotNull();
        return jdbc;
    }

    private void migrate(String schema, String version) {
        var configuration = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .schemas(schema).defaultSchema(schema).locations("classpath:db/migration");
        if (version != null) {
            configuration.target(version);
        }
        configuration.load().migrate();
    }

    private JdbcTemplate jdbc(String schema) {
        String separator = POSTGRES.getJdbcUrl().contains("?") ? "&" : "?";
        return new JdbcTemplate(new DriverManagerDataSource(
                POSTGRES.getJdbcUrl() + separator + "currentSchema=" + schema,
                POSTGRES.getUsername(), POSTGRES.getPassword()));
    }
}
