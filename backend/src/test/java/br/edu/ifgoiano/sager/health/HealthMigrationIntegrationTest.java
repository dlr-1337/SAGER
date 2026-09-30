package br.edu.ifgoiano.sager.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.SQLException;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

class HealthMigrationIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");
    private static final JdbcTemplate JDBC;

    static {
        POSTGRES.start();
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(),
                POSTGRES.getPassword()).load().migrate();
        JDBC = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(),
                POSTGRES.getUsername(), POSTGRES.getPassword()));
    }

    @Test
    void createsSeparateHealthResourcesWithoutBackfillOrAutomaticAccess() {
        for (String table : new String[] { "sager_health_grant", "sager_health_care_assignment",
                "sager_health_note", "sager_health_revision", "sager_health_share",
                "sager_health_custody" }) {
            assertThat(JDBC.queryForObject("SELECT COUNT(*) FROM " + table, Long.class)).isZero();
        }
    }

    @Test
    void newHealthProfileDoesNotRequireOrCreateDomainLinks() {
        UUID account = account("saude");
        assertThat(JDBC.queryForObject("SELECT resident_id IS NULL AND supervisor_id IS NULL "
                + "FROM sager_local_account WHERE id = ?", Boolean.class, account)).isTrue();
    }

    @Test
    void notesAndRevisionsRejectAllDestructiveStatementsIncludingEmptyTables() {
        for (String table : new String[] { "sager_health_note", "sager_health_revision" }) {
            for (String sql : new String[] { "UPDATE " + table + " SET id = id WHERE FALSE",
                    "DELETE FROM " + table + " WHERE FALSE", table.equals("sager_health_note")
                            ? "TRUNCATE sager_health_note, sager_health_revision, sager_health_share"
                            : "TRUNCATE " + table }) {
                assertThatThrownBy(() -> JDBC.execute(sql)).hasRootCauseInstanceOf(SQLException.class)
                        .satisfies(error -> assertThat(((SQLException) root(error)).getSQLState())
                                .isEqualTo("55000"));
            }
        }
    }

    @Test
    void auditAllowsHealthMetadataAndReadExportButRejectsSensitiveFieldValues() {
        UUID actor = account("saude");
        for (String action : new String[] { "CREATE", "UPDATE", "READ", "EXPORT" }) {
            JDBC.update("INSERT INTO sager_audit_event (actor_id, actor_profile, origin, request_id, "
                    + "resource, resource_id, action, resulting_version, changed_fields) "
                    + "VALUES (?, 'saude', 'LOCAL_API', ?, 'HEALTH_NOTE', ?, ?, 0, ARRAY['body'])",
                    actor, UUID.randomUUID(), UUID.randomUUID(), action);
        }
        assertThatThrownBy(() -> JDBC.update("INSERT INTO sager_audit_event (actor_id, actor_profile, "
                + "origin, request_id, resource, resource_id, action, resulting_version, changed_fields) "
                + "VALUES (?, 'saude', 'LOCAL_API', ?, 'HEALTH_NOTE', ?, 'READ', 0, ARRAY['diagnosis'])",
                actor, UUID.randomUUID(), UUID.randomUUID())).hasRootCauseInstanceOf(SQLException.class);
    }

    private UUID account(String profile) {
        UUID id = UUID.randomUUID();
        JDBC.update("INSERT INTO sager_local_account (id,email,display_name,password_hash,profile) "
                + "VALUES (?,?,'Pessoa Sintetica','not-a-password',?)", id,
                id + "@example.invalid", profile);
        return id;
    }

    private Throwable root(Throwable error) {
        while (error.getCause() != null) error = error.getCause();
        return error;
    }
}
