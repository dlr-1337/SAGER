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

    @Test
    void v22FormatsResidentNamesOnlyAndMatchesTheApplicationRule() {
        String schema = "resident_name_format";
        migrate(schema, "9");
        JdbcTemplate jdbc = jdbc(schema);
        UUID legacy = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident (id, name, enrollment) VALUES (?, ?, ?)",
                legacy, "ANA-MARIA D'ÁVILA  ÇÃO", "DEMO-LEGACY");
        migrate(schema, "21");
        UUID formatted = UUID.randomUUID();
        UUID guardian = UUID.randomUUID();
        UUID account = UUID.randomUUID();
        UUID staff = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident (id, name, enrollment, birth_date, version) VALUES (?, ?, ?, ?, 7)",
                formatted, "Já Formatado", "DEMO-OK", LocalDate.of(2006, 1, 2));
        jdbc.update("INSERT INTO sager_guardian (id, resident_id, name, relationship, active) VALUES (?, ?, ?, ?, true)",
                guardian, legacy, "MARIA RESPONSÁVEL", "Mãe");
        jdbc.update("""
                INSERT INTO sager_local_account (id, enrollment, display_name, password_hash, profile, resident_id)
                VALUES (?, ?, ?, ?, 'residente', ?), (?, ?, ?, ?, 'gestor', NULL)
                """, account, "demo-legacy", "ANA-MARIA D'ÁVILA  ÇÃO", "hash", legacy,
                staff, "demo-staff", "EQUIPE GESTORA", "hash");
        var before = jdbc.queryForObject("SELECT updated_at FROM sager_resident WHERE id = ?",
                java.time.OffsetDateTime.class, legacy);

        migrate(schema, "22");

        String name = jdbc.queryForObject("SELECT name FROM sager_resident WHERE id = ?", String.class, legacy);
        assertThat(name).isEqualTo("Ana-Maria D'Ávila  Ção")
                .isEqualTo(ResidentService.formatName("ANA-MARIA D'ÁVILA  ÇÃO"));
        assertThat(jdbc.queryForObject("SELECT birth_date FROM sager_resident WHERE id = ?", LocalDate.class, legacy))
                .isNull();
        assertThat(jdbc.queryForObject("SELECT updated_at FROM sager_resident WHERE id = ?",
                java.time.OffsetDateTime.class, legacy)).isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT version FROM sager_resident WHERE id = ?", Long.class, formatted))
                .isEqualTo(7);
        assertThat(jdbc.queryForObject("SELECT name FROM sager_guardian WHERE id = ?", String.class, guardian))
                .isEqualTo("MARIA RESPONSÁVEL");
        assertThat(jdbc.queryForObject("SELECT display_name FROM sager_local_account WHERE id = ?", String.class, account))
                .isEqualTo(name);
        assertThat(jdbc.queryForObject("SELECT display_name FROM sager_local_account WHERE id = ?", String.class, staff))
                .isEqualTo("EQUIPE GESTORA");
        assertThat(jdbc.queryForList("SELECT resource_id FROM sager_audit_event WHERE origin = 'SYSTEM_JOB'", UUID.class))
                .containsExactly(legacy);
        assertThat(jdbc.queryForObject("SELECT convalidated FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace "
                + "WHERE c.conname = 'sager_resident_birth_date_required' AND n.nspname = ?", Boolean.class, schema)).isFalse();
    }

    @Test
    void v29AddsCourseLevelAndResidentProgressWithoutBackfillOrVersionChanges() {
        String schema = "resident_upgrade_v28";
        migrate(schema, "28");
        JdbcTemplate jdbc = jdbc(schema);
        UUID course = UUID.randomUUID();
        UUID resident = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_course (id, name, version) VALUES (?, ?, 3)", course, "Curso Sintético");
        jdbc.update("INSERT INTO sager_resident (id, name, enrollment, birth_date, course_id, version) VALUES (?, ?, ?, ?, ?, 5)",
                resident, "Estudante Sintético", "20261MIGRA00001", LocalDate.of(2006, 1, 2), course);
        int audits = jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event", Integer.class);

        migrate(schema, "29");

        assertThat(jdbc.queryForObject("SELECT level IS NULL AND duration_years IS NULL AND version = 3 FROM sager_course",
                Boolean.class)).isTrue();
        assertThat(jdbc.queryForObject("SELECT entry_year IS NULL AND extra_semesters = 0 AND version = 5 FROM sager_resident",
                Boolean.class)).isTrue();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event", Integer.class)).isEqualTo(audits);
        jdbc.update("UPDATE sager_course SET level = 'SUPERIOR', duration_years = 4 WHERE id = ?", course);
        jdbc.update("UPDATE sager_resident SET entry_year = 2026, extra_semesters = 10 WHERE id = ?", resident);
        for (String invalid : new String[] { "UPDATE sager_course SET level = 'TECNICO'",
                "UPDATE sager_course SET duration_years = 0", "UPDATE sager_course SET duration_years = 7",
                "UPDATE sager_resident SET entry_year = 1989", "UPDATE sager_resident SET entry_year = 2101",
                "UPDATE sager_resident SET extra_semesters = 11", "UPDATE sager_resident SET extra_semesters = -1",
                "UPDATE sager_resident SET extra_semesters = NULL" }) {
            assertThatThrownBy(() -> jdbc.update(invalid)).isInstanceOf(DataIntegrityViolationException.class);
        }
        audit(jdbc, "COURSE", course, "{name,active,level,durationYears}");
        audit(jdbc, "RESIDENT", resident, "{courseId,entryYear,extraSemesters}");
        audit(jdbc, "WHATSAPP_SESSION", UUID.randomUUID(), "{ended}");
        audit(jdbc, "ROOM", UUID.randomUUID(), "{situation}");
        assertThatThrownBy(() -> audit(jdbc, "COURSE", course, "{entryYear}"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> audit(jdbc, "RESIDENT", resident, "{durationYears}"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private void audit(JdbcTemplate jdbc, String resource, UUID id, String fields) {
        jdbc.update("""
                INSERT INTO sager_audit_event (origin, request_id, resource, resource_id, action, resulting_version, changed_fields)
                VALUES ('SYSTEM_JOB', gen_random_uuid(), ?, ?, 'UPDATE', 1, ?::text[])
                """, resource, id, fields);
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
