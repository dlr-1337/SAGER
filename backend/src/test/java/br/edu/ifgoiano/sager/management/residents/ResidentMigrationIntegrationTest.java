package br.edu.ifgoiano.sager.management.residents;

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

class ResidentMigrationIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");

    static {
        POSTGRES.start();
    }

    @Test
    void upgradesV6WithoutChangingEarlierRecordsOrCreatingResidents() {
        String schema = "resident_upgrade_v6";
        migrate(schema, "6");
        JdbcTemplate jdbc = jdbc(schema);
        UUID accommodation = UUID.randomUUID();
        UUID room = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_accommodation (id, code, name) VALUES (?, ?, ?)",
                accommodation, "DEMO-A", "Alojamento Sintético");
        jdbc.update("""
                INSERT INTO sager_room (id, code, number, accommodation_id, situation)
                VALUES (?, ?, ?, ?, ?)
                """, room, "DEMO-A-01", "01", accommodation, "Disponível");

        migrate(schema, "7");

        assertThat(jdbc.queryForObject("SELECT code FROM sager_room WHERE id = ?", String.class, room))
                .isEqualTo("DEMO-A-01");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_resident", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT MAX(version::int) FROM flyway_schema_history",
                Integer.class)).isEqualTo(7);
    }

    @Test
    void freshDatabaseEnforcesUniqueEnrollmentAndRecordConstraints() {
        String schema = "resident_fresh";
        migrate(schema, "7");
        JdbcTemplate jdbc = jdbc(schema);
        UUID first = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_resident (id, name, enrollment, birth_date, course)
                VALUES (?, ?, ?, ?, ?)
                """, first, "Estudante Exemplo", "DEMO-2026-A", LocalDate.of(2006, 1, 2), null);
        assertThat(jdbc.queryForObject("SELECT version FROM sager_resident WHERE id = ?",
                Long.class, first)).isZero();
        assertThat(jdbc.queryForObject("SELECT created_at IS NOT NULL AND updated_at IS NOT NULL "
                + "FROM sager_resident WHERE id = ?", Boolean.class, first)).isTrue();
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO sager_resident (id, name, enrollment)
                VALUES (?, ?, ?)
                """, UUID.randomUUID(), "Outra Pessoa", "demo-2026-a"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO sager_resident (id, name, enrollment)
                VALUES (?, ?, ?)
                """, UUID.randomUUID(), "AB", "DEMO-B"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO sager_resident (id, name, enrollment)
                VALUES (?, ?, ?)
                """, UUID.randomUUID(), "Pessoa de Teste", " "))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO sager_resident (id, name, enrollment, course)
                VALUES (?, ?, ?, ?)
                """, UUID.randomUUID(), "Pessoa de Teste", "DEMO-C", " "))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_resident", Integer.class)).isEqualTo(1);
    }

    @Test
    void v10PreservesLegacyNullBirthDateButRequiresItForNewAndUpdatedRows() {
        String schema = "resident_birth_required_upgrade_v9";
        migrate(schema, "9");
        JdbcTemplate jdbc = jdbc(schema);
        UUID legacy = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident (id, name, enrollment) VALUES (?, ?, ?)",
                legacy, "Estudante Legado", "DEMO-LEGACY");

        migrate(schema, "10");
        assertThat(jdbc.queryForObject("SELECT birth_date FROM sager_resident WHERE id = ?",
                LocalDate.class, legacy)).isNull();
        assertThat(jdbc.queryForObject("""
                SELECT c.convalidated FROM pg_constraint c
                JOIN pg_namespace n ON n.oid = c.connamespace
                WHERE c.conname = 'sager_resident_birth_date_required' AND n.nspname = ?
                """, Boolean.class, schema)).isFalse();
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO sager_resident (id, name, enrollment) VALUES (?, ?, ?)
                """, UUID.randomUUID(), "Estudante Novo", "DEMO-NEW"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE sager_resident SET name = ? WHERE id = ?",
                "Estudante Legado Atualizado", legacy))
                .isInstanceOf(DataIntegrityViolationException.class);
        jdbc.update("UPDATE sager_resident SET birth_date = ? WHERE id = ?",
                LocalDate.of(2006, 1, 2), legacy);
        assertThat(jdbc.queryForObject("SELECT birth_date FROM sager_resident WHERE id = ?",
                LocalDate.class, legacy)).isEqualTo(LocalDate.of(2006, 1, 2));
        assertThat(jdbc.queryForObject("SELECT MAX(version::int) FROM flyway_schema_history",
                Integer.class)).isEqualTo(10);
    }

    @Test
    void freshV10DatabaseRejectsNullBirthDateAndAcceptsSyntheticDate() {
        String schema = "resident_birth_required_fresh";
        migrate(schema, "10");
        JdbcTemplate jdbc = jdbc(schema);
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO sager_resident (id, name, enrollment, birth_date)
                VALUES (?, ?, ?, NULL)
                """, UUID.randomUUID(), "Estudante Sintético", "DEMO-EMPTY"))
                .isInstanceOf(DataIntegrityViolationException.class);
        jdbc.update("""
                INSERT INTO sager_resident (id, name, enrollment, birth_date)
                VALUES (?, ?, ?, ?)
                """, UUID.randomUUID(), "Estudante Sintético", "DEMO-DATED", LocalDate.of(2006, 1, 2));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_resident", Integer.class)).isEqualTo(1);
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
