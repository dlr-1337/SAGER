package br.edu.ifgoiano.sager.management.rooms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

class RoomMigrationIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");

    static {
        POSTGRES.start();
    }

    @Test
    void upgradesV4ToV6WithoutLosingExistingSupervisorAndLeavesMapEmpty() {
        String schema = "room_upgrade_v4";
        migrate(schema, "4");
        JdbcTemplate jdbc = jdbc(schema);
        UUID supervisor = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_supervisor (id, name, institutional_id, email) VALUES (?, ?, ?, ?)",
                supervisor, "Supervisor Sintético", "DEMO-UPGRADE", "upgrade@example.invalid");
        migrate(schema, "6");
        assertThat(jdbc.queryForObject("SELECT name FROM sager_supervisor WHERE id = ?", String.class, supervisor))
                .isEqualTo("Supervisor Sintético");
        for (String table : new String[] { "sager_accommodation", "sager_accommodation_unit", "sager_room" }) {
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class)).isZero();
        }
        assertThat(jdbc.queryForObject("SELECT MAX(version::int) FROM flyway_schema_history", Integer.class))
                .isEqualTo(6);
    }

    @Test
    void upgradesV5WithoutLosingAccommodationOrUnitAndAllowsRoomLink() {
        String schema = "room_upgrade_v5";
        migrate(schema, "5");
        JdbcTemplate jdbc = jdbc(schema);
        UUID accommodation = accommodation(jdbc, "DEMO-RES");
        UUID unit = unit(jdbc, accommodation, "CASA");
        jdbc.update("UPDATE sager_accommodation_unit SET version = 2 WHERE id = ?", unit);
        migrate(schema, "6");
        assertThat(jdbc.queryForObject("SELECT version FROM sager_accommodation_unit WHERE id = ?", Long.class, unit))
                .isEqualTo(2L);
        assertThat(jdbc.queryForObject("SELECT accommodation_id FROM sager_accommodation_unit WHERE id = ?",
                UUID.class, unit)).isEqualTo(accommodation);
        insertRoom(jdbc, "DEMO-01", "01", accommodation, unit, null, null, "Disponível");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_room", Integer.class)).isEqualTo(1);
    }

    @Test
    void freshDatabaseEnforcesNullableLocationUniquenessUnitOwnershipAndCapacity() {
        String schema = "room_fresh";
        migrate(schema, "6");
        JdbcTemplate jdbc = jdbc(schema);
        UUID first = accommodation(jdbc, "DEMO-A");
        UUID second = accommodation(jdbc, "DEMO-B");
        UUID wrongUnit = unit(jdbc, second, "CASA");
        insertRoom(jdbc, "DEMO-A-01", "01", first, null, null, null, "Disponível");
        assertThatThrownBy(() -> insertRoom(jdbc, "DEMO-DUP", "01", first, null, null, 4, "Ocupado"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> insertRoom(jdbc, "demo-a-01", "02", second, null, null, 4, "Ocupado"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> insertRoom(jdbc, "DEMO-WRONG", "03", first, wrongUnit, null, 4, "Disponível"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> insertRoom(jdbc, "DEMO-ZERO", "04", first, null, null, 0, "Disponível"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> insertRoom(jdbc, "DEMO-STATE", "05", first, null, null, 4, "Outro"))
                .isInstanceOf(DataIntegrityViolationException.class);
        insertRoom(jdbc, "DEMO-B-01", "01", second, null, null, 4, "Indisponível");
        insertRoom(jdbc, "DEMO-A-FLOOR", "01", first, null, "1", 4, "Manutenção");
        assertThatThrownBy(() -> insertRoom(jdbc, "DEMO-A-FLOOR-DUP", "01", first, null, "1", 4, "Manutenção"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_room", Integer.class)).isEqualTo(3);
    }

    @Test
    void v28KeepsOnlyManualSituationsAndAuditsTheNormalizationWithoutChangingVersions() {
        String schema = "room_upgrade_v27";
        migrate(schema, "27");
        JdbcTemplate jdbc = jdbc(schema);
        UUID accommodation = accommodation(jdbc, "DEMO-RES");
        insertRoom(jdbc, "DEMO-OCUPADO", "01", accommodation, null, null, 4, "Ocupado");
        insertRoom(jdbc, "DEMO-MANUT", "02", accommodation, null, null, 4, "Manutenção");
        insertRoom(jdbc, "DEMO-SEM-CAPACIDADE", "03", accommodation, null, null, null, "Ocupado");
        jdbc.update("UPDATE sager_room SET version = 3 WHERE code = 'DEMO-OCUPADO'");
        migrate(schema, "28");
        assertThat(jdbc.queryForList("SELECT code || ':' || situation || ':' || version FROM sager_room ORDER BY code",
                String.class)).containsExactly("DEMO-MANUT:Manutenção:0", "DEMO-OCUPADO:Disponível:3",
                        "DEMO-SEM-CAPACIDADE:Indisponível:0");
        assertThat(jdbc.queryForList("""
                SELECT origin || ':' || action || ':' || resulting_version || ':' || array_to_string(changed_fields, ',')
                FROM sager_audit_event WHERE resource = 'ROOM' ORDER BY resulting_version
                """, String.class)).containsExactly("SYSTEM_JOB:UPDATE:0:situation", "SYSTEM_JOB:UPDATE:3:situation");
        assertThatThrownBy(() -> insertRoom(jdbc, "DEMO-NOVO", "03", accommodation, null, null, 4, "Ocupado"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private UUID accommodation(JdbcTemplate jdbc, String code) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_accommodation (id, code, name) VALUES (?, ?, ?)", id, code, "Sintético " + code);
        return id;
    }

    private UUID unit(JdbcTemplate jdbc, UUID accommodation, String code) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_accommodation_unit (id, accommodation_id, code, name) VALUES (?, ?, ?, ?)",
                id, accommodation, code, "Casa Sintética");
        return id;
    }

    private void insertRoom(JdbcTemplate jdbc, String code, String number, UUID accommodation, UUID unit,
            String floor, Integer capacity, String situation) {
        jdbc.update("""
                INSERT INTO sager_room (id, code, number, accommodation_id, unit_id, floor, capacity, situation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), code, number, accommodation, unit, floor, capacity, situation);
    }

    private void migrate(String schema, String version) {
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .schemas(schema).defaultSchema(schema).locations("classpath:db/migration")
                .target(version).load().migrate();
    }

    private JdbcTemplate jdbc(String schema) {
        String separator = POSTGRES.getJdbcUrl().contains("?") ? "&" : "?";
        return new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl() + separator + "currentSchema=" + schema,
                POSTGRES.getUsername(), POSTGRES.getPassword()));
    }
}
