package br.edu.ifgoiano.sager.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

class LocalAccountLinkMigrationIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");

    static {
        POSTGRES.start();
    }

    @Test
    void preservesUnlinkedLegacyAccountsWhenUpgradingV10() {
        String schema = "account_link_upgrade";
        migrate(schema, "10");
        JdbcTemplate jdbc = jdbc(schema);
        UUID account = account(jdbc, "legacy@example.invalid", "residente");
        migrate(schema, null);

        requireLinkColumns(jdbc, schema);
        assertThat(jdbc.queryForMap("""
                SELECT id, email, display_name, password_hash, profile, active,
                    resident_id, supervisor_id
                FROM sager_local_account WHERE id = ?
                """, account))
                .containsEntry("id", account)
                .containsEntry("email", "legacy@example.invalid")
                .containsEntry("display_name", "Conta Sintética")
                .containsEntry("password_hash", "synthetic-hash")
                .containsEntry("profile", "residente")
                .containsEntry("active", true)
                .containsEntry("resident_id", null)
                .containsEntry("supervisor_id", null);
    }

    @Test
    void enforcesExistingUniqueRecordsAndCompatibleProfiles() {
        String schema = "account_link_constraints";
        migrate(schema, null);
        JdbcTemplate jdbc = jdbc(schema);
        requireLinkColumns(jdbc, schema);
        UUID resident = resident(jdbc);
        UUID supervisor = supervisor(jdbc);
        UUID firstResidentAccount = account(jdbc, "resident-a@example.invalid", "residente");
        UUID secondResidentAccount = account(jdbc, "resident-b@example.invalid", "residente");
        UUID gestorAccount = account(jdbc, "gestor@example.invalid", "gestor");
        UUID supervisorAccount = account(jdbc, "supervisor@example.invalid", "supervisor");

        jdbc.update("UPDATE sager_local_account SET resident_id = ? WHERE id = ?",
                resident, firstResidentAccount);
        assertThatThrownBy(() -> jdbc.update(
                "UPDATE sager_local_account SET resident_id = ? WHERE id = ?",
                resident, secondResidentAccount)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(
                "UPDATE sager_local_account SET resident_id = ? WHERE id = ?",
                UUID.randomUUID(), secondResidentAccount))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(
                "UPDATE sager_local_account SET resident_id = ? WHERE id = ?",
                resident, gestorAccount)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(
                "UPDATE sager_local_account SET supervisor_id = ? WHERE id = ?",
                supervisor, secondResidentAccount)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(
                "UPDATE sager_local_account SET supervisor_id = ? WHERE id = ?",
                supervisor, firstResidentAccount)).isInstanceOf(DataIntegrityViolationException.class);

        jdbc.update("UPDATE sager_local_account SET supervisor_id = ? WHERE id = ?",
                supervisor, gestorAccount);
        assertThatThrownBy(() -> jdbc.update(
                "UPDATE sager_local_account SET supervisor_id = ? WHERE id = ?",
                supervisor, supervisorAccount)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(
                "UPDATE sager_local_account SET supervisor_id = ? WHERE id = ?",
                UUID.randomUUID(), supervisorAccount))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(
                "UPDATE sager_local_account SET profile = 'gestor' WHERE id = ?",
                firstResidentAccount)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("DELETE FROM sager_resident WHERE id = ?", resident))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("DELETE FROM sager_supervisor WHERE id = ?", supervisor))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private void requireLinkColumns(JdbcTemplate jdbc, String schema) {
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = ? AND table_name = 'sager_local_account'
                    AND column_name IN ('resident_id', 'supervisor_id')
                """, Integer.class, schema)).isEqualTo(2);
    }

    private UUID account(JdbcTemplate jdbc, String email, String profile) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_local_account (id, email, display_name, password_hash, profile)
                VALUES (?, ?, 'Conta Sintética', 'synthetic-hash', ?)
                """, id, email, profile);
        return id;
    }

    private UUID resident(JdbcTemplate jdbc) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident (id, name, enrollment, birth_date)"
                + " VALUES (?, 'Estudante Sintético', 'LINK-DEMO', ?)",
                id, LocalDate.of(2006, 1, 2));
        return id;
    }

    private UUID supervisor(JdbcTemplate jdbc) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_supervisor (id, name, institutional_id, email)
                VALUES (?, 'Supervisor Sintético', 'LINK-DEMO', 'registro@example.invalid')
                """, id);
        return id;
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
        return new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl() + separator
                + "currentSchema=" + schema, POSTGRES.getUsername(), POSTGRES.getPassword()));
    }
}
