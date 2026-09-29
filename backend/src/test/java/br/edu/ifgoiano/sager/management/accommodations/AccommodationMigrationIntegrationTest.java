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
