package br.edu.ifgoiano.sager.management.allocations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

class AllocationMigrationIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");

    static {
        POSTGRES.start();
    }

    @Test
    void upgradesV8WithoutLosingResidentsRoomsOrGuardians() {
        String schema = "allocation_upgrade_v8";
        migrate(schema, "8");
        JdbcTemplate jdbc = jdbc(schema);
        UUID resident = resident(jdbc, "DEMO-A");
        UUID room = room(jdbc, "DEMO-01");
        UUID guardian = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_guardian (id, resident_id, name, relationship, active)
                VALUES (?, ?, 'Pessoa Sintética', 'Mãe', true)
                """, guardian, resident);
        migrate(schema, "9");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_room_allocation", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT enrollment FROM sager_resident WHERE id = ?",
                String.class, resident)).isEqualTo("DEMO-A");
        assertThat(jdbc.queryForObject("SELECT code FROM sager_room WHERE id = ?",
                String.class, room)).isEqualTo("DEMO-01");
        assertThat(jdbc.queryForObject("SELECT name FROM sager_guardian WHERE id = ?",
                String.class, guardian)).isEqualTo("Pessoa Sintética");
        assertThat(jdbc.queryForObject("SELECT MAX(version::int) FROM flyway_schema_history",
                Integer.class)).isEqualTo(9);
    }

    @Test
    void freshDatabaseEnforcesOneActiveRoomPerResidentAndValidClosure() {
        String schema = "allocation_fresh";
        migrate(schema, "9");
        JdbcTemplate jdbc = jdbc(schema);
        UUID resident = resident(jdbc, "DEMO-A");
        UUID firstRoom = room(jdbc, "DEMO-01");
        UUID secondRoom = room(jdbc, "DEMO-02");
        UUID first = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_room_allocation (id, resident_id, room_id) VALUES (?, ?, ?)",
                first, resident, firstRoom);
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO sager_room_allocation (id, resident_id, room_id) VALUES (?, ?, ?)
                """, UUID.randomUUID(), resident, secondRoom))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("""
                UPDATE sager_room_allocation SET end_reason = 'TRANSFER' WHERE id = ?
                """, first)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("""
                UPDATE sager_room_allocation SET ended_at = CURRENT_TIMESTAMP WHERE id = ?
                """, first)).isInstanceOf(DataIntegrityViolationException.class);
        jdbc.update("UPDATE sager_room_allocation SET ended_at = CURRENT_TIMESTAMP, end_reason = 'TRANSFER'"
                + " WHERE id = ?", first);
        UUID second = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_room_allocation (id, resident_id, room_id) VALUES (?, ?, ?)",
                second, resident, secondRoom);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_room_allocation WHERE resident_id = ?",
                Integer.class, resident)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_room_allocation"
                + " WHERE resident_id = ? AND ended_at IS NULL", Integer.class, resident)).isEqualTo(1);
        assertThatThrownBy(() -> jdbc.update("""
                UPDATE sager_room_allocation SET end_reason = 'INVALID', ended_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, second)).isInstanceOf(DataIntegrityViolationException.class);
    }

    private UUID resident(JdbcTemplate jdbc, String enrollment) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident (id, name, enrollment) VALUES (?, 'Estudante Sintético', ?)",
                id, enrollment);
        return id;
    }

    private UUID room(JdbcTemplate jdbc, String code) {
        UUID accommodation = jdbc.query("SELECT id FROM sager_accommodation WHERE code = 'DEMO'",
                (result, row) -> result.getObject(1, UUID.class)).stream().findFirst().orElseGet(() -> {
                    UUID id = UUID.randomUUID();
                    jdbc.update("INSERT INTO sager_accommodation (id, code, name) VALUES (?, 'DEMO', 'Sintético')", id);
                    return id;
                });
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_room (id, code, number, accommodation_id, capacity, situation)
                VALUES (?, ?, ?, ?, 2, 'Disponível')
                """, id, code, code, accommodation);
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
