package br.edu.ifgoiano.sager.management.accommodations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

class AccommodationMigrationIntegrationTest {
    private static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:17.11");

    static {
        POSTGRES.start();
    }

    @Test
    void upgradesV4WithoutLosingExistingSupervisorAndStartsHousingRegistryEmpty() {
        String schema = "accommodation_upgrade";
        migrate(schema, "4");
        JdbcTemplate jdbc = jdbc(schema);
        UUID supervisor = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_supervisor (id, name, institutional_id, email) VALUES (?, ?, ?, ?)",
                supervisor, "Supervisor Sintético", "DEMO-UPGRADE", "upgrade@example.invalid");

        migrate(schema, "5");

        assertThat(jdbc.queryForObject("SELECT name FROM sager_supervisor WHERE id = ?",
                String.class, supervisor)).isEqualTo("Supervisor Sintético");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_accommodation", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_accommodation_unit", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject("SELECT MAX(version::int) FROM flyway_schema_history",
                Integer.class)).isEqualTo(5);
    }

    @Test
    void freshDatabaseProtectsUnitLinkAndCaseInsensitiveCodes() {
        String schema = "accommodation_fresh";
        migrate(schema, "5");
        JdbcTemplate jdbc = jdbc(schema);
        UUID accommodation = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_accommodation (id, code, name) VALUES (?, ?, ?)",
                accommodation, "DEMO-RES", "Residência Sintética");

        assertThatThrownBy(() -> jdbc.update("INSERT INTO sager_accommodation (id, code, name)"
                + " VALUES (?, ?, ?)", UUID.randomUUID(), "demo-res", "Duplicada"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO sager_accommodation_unit"
                + " (id, accommodation_id, code, name) VALUES (?, ?, ?, ?)", UUID.randomUUID(),
                UUID.randomUUID(), "CASA", "Sem Alojamento"))
                .isInstanceOf(DataIntegrityViolationException.class);
        jdbc.update("INSERT INTO sager_accommodation_unit (id, accommodation_id, code, name)"
                + " VALUES (?, ?, ?, ?)", UUID.randomUUID(), accommodation, "CASA", "Casa Sintética");
        assertThatThrownBy(() -> jdbc.update("INSERT INTO sager_accommodation_unit"
                + " (id, accommodation_id, code, name) VALUES (?, ?, ?, ?)", UUID.randomUUID(),
                accommodation, "casa", "Duplicada"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_accommodation_unit", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void v32FillsAgeGroupFromTheNameWithSystemAuditAndSameVersion() {
        String schema = "accommodation_age_group";
        migrate(schema, "31");
        JdbcTemplate jdbc = jdbc(schema);
        UUID minors = accommodation(jdbc, "R2", "Residência 2 · Masculina · menores de 18");
        UUID adults = accommodation(jdbc, "VILA", "Vila Estudantil · Masculina · MAIORES DE 18");
        UUID plain = accommodation(jdbc, "SINT", "Alojamento Sintético");
        UUID both = accommodation(jdbc, "MISTO", "Misto · menores de 18 e maiores de 18");
        migrate(schema, "32");

        assertThat(ageGroup(jdbc, minors)).isEqualTo("MENORES");
        assertThat(ageGroup(jdbc, adults)).isEqualTo("MAIORES");
        assertThat(ageGroup(jdbc, plain)).isNull();
        assertThat(ageGroup(jdbc, both)).isNull();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_accommodation WHERE version <> 0", Integer.class))
                .isZero();
        for (UUID classified : new UUID[] { minors, adults }) {
            assertThat(jdbc.queryForObject("""
                    SELECT COUNT(*) FROM sager_audit_event WHERE resource = 'ACCOMMODATION' AND resource_id = ?
                    AND origin = 'SYSTEM_JOB' AND actor_id IS NULL AND action = 'UPDATE' AND resulting_version = 0
                    AND changed_fields = ARRAY['ageGroup']::text[]
                    """, Integer.class, classified)).isOne();
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE resource_id IN (?, ?)",
                Integer.class, plain, both)).isZero();

        assertThatThrownBy(() -> jdbc.update("UPDATE sager_accommodation SET age_group = 'ADULTOS' WHERE id = ?",
                plain)).isInstanceOf(DataIntegrityViolationException.class);
        jdbc.update(audit("ACCOMMODATION"), UUID.randomUUID(), plain);
        assertThatThrownBy(() -> jdbc.update(audit("ROOM"), UUID.randomUUID(), plain))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private static String audit(String resource) {
        return "INSERT INTO sager_audit_event (origin, request_id, resource, resource_id, action, resulting_version,"
                + " changed_fields) VALUES ('SYSTEM_JOB', ?, '" + resource + "', ?, 'UPDATE', 1, ARRAY['ageGroup'])";
    }

    private static UUID accommodation(JdbcTemplate jdbc, String code, String name) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_accommodation (id, code, name) VALUES (?, ?, ?)", id, code, name);
        return id;
    }

    private static String ageGroup(JdbcTemplate jdbc, UUID id) {
        return jdbc.queryForObject("SELECT age_group FROM sager_accommodation WHERE id = ?", String.class, id);
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
