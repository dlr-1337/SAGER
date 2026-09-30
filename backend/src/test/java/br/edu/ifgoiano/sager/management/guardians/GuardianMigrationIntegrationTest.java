package br.edu.ifgoiano.sager.management.guardians;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

class GuardianMigrationIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");

    static {
        POSTGRES.start();
    }

    @Test
    void upgradesV7PreservingExistingResidents() {
        String schema = "guardian_upgrade_v7";
        migrate(schema, "7");
        JdbcTemplate jdbc = jdbc(schema);
        UUID resident = resident(jdbc, "DEMO-UPGRADE");

        migrate(schema, "8");

        assertThat(jdbc.queryForObject("SELECT enrollment FROM sager_resident WHERE id = ?",
                String.class, resident)).isEqualTo("DEMO-UPGRADE");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_guardian", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT MAX(version::int) FROM flyway_schema_history",
                Integer.class)).isEqualTo(8);
    }

    @Test
    void freshDatabaseEnforcesForeignKeyRequiredValuesAndDefaults() {
        String schema = "guardian_fresh";
        migrate(schema, "8");
        JdbcTemplate jdbc = jdbc(schema);
        UUID resident = resident(jdbc, "DEMO-FRESH");
        UUID guardian = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_guardian (id, resident_id, name, relationship, active)
                VALUES (?, ?, ?, ?, ?)
                """, guardian, resident, "Pessoa Responsável", "Guardiã", true);
        assertThat(jdbc.queryForObject("SELECT version FROM sager_guardian WHERE id = ?",
                Long.class, guardian)).isZero();
        assertThat(jdbc.queryForObject("SELECT phone IS NULL AND created_at IS NOT NULL "
                + "AND updated_at IS NOT NULL FROM sager_guardian WHERE id = ?",
                Boolean.class, guardian)).isTrue();
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO sager_guardian (id, resident_id, name, relationship, active)
                VALUES (?, ?, ?, ?, ?)
                """, UUID.randomUUID(), UUID.randomUUID(), "Outra Pessoa", "Mãe", true))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO sager_guardian (id, resident_id, name, relationship, active)
                VALUES (?, ?, ?, ?, ?)
                """, UUID.randomUUID(), resident, "AB", "Mãe", true))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO sager_guardian (id, resident_id, name, relationship, active)
                VALUES (?, ?, ?, ?, ?)
                """, UUID.randomUUID(), resident, "Outra Pessoa", "Mãe", null))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO sager_guardian (id, resident_id, name, relationship, phone, active)
                VALUES (?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), resident, "Outra Pessoa", "Mãe", " ", true))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private UUID resident(JdbcTemplate jdbc, String enrollment) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident (id, name, enrollment, birth_date) VALUES (?, ?, ?, ?)",
                id, "Estudante Sintético", enrollment, java.time.LocalDate.of(2006, 1, 2));
        return id;
    }

    private void migrate(String schema, String version) {
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .schemas(schema).defaultSchema(schema).locations("classpath:db/migration")
                .target(version).load().migrate();
    }

    private JdbcTemplate jdbc(String schema) {
        String separator = POSTGRES.getJdbcUrl().contains("?") ? "&" : "?";
        return new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl() + separator
                + "currentSchema=" + schema, POSTGRES.getUsername(), POSTGRES.getPassword()));
    }
}
