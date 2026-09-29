package br.edu.ifgoiano.sager.management.rooms;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@Profile("local")
public class RoomRepository {
    private static final String COLUMNS =
            "id, code, number, accommodation_id, unit_id, floor, capacity, situation, version";
    private final JdbcTemplate jdbc;

    public RoomRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<RoomRecord> findAll() {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_room"
                + " ORDER BY accommodation_id, unit_id NULLS FIRST, floor NULLS FIRST, number, code, id",
                (result, row) -> map(result));
    }

    public Optional<RoomRecord> findById(UUID id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_room WHERE id = ?",
                (result, row) -> map(result), id).stream().findFirst();
    }

    public void insert(UUID id, String code, String number, UUID accommodationId, UUID unitId,
            String floor, Integer capacity, String situation) {
        jdbc.update("""
                INSERT INTO sager_room (id, code, number, accommodation_id, unit_id, floor, capacity, situation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, id, code, number, accommodationId, unitId, floor, capacity, situation);
    }

    public int update(UUID id, String code, String number, UUID accommodationId, UUID unitId,
            String floor, Integer capacity, String situation, long version) {
        return jdbc.update("""
                UPDATE sager_room
                SET code = ?, number = ?, accommodation_id = ?, unit_id = ?, floor = ?, capacity = ?,
                    situation = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND version = ?
                """, code, number, accommodationId, unitId, floor, capacity, situation, id, version);
    }

    private RoomRecord map(ResultSet result) throws SQLException {
        return new RoomRecord(result.getObject("id", UUID.class), result.getString("code"),
                result.getString("number"), result.getObject("accommodation_id", UUID.class),
                result.getObject("unit_id", UUID.class), result.getString("floor"),
                result.getObject("capacity", Integer.class), result.getString("situation"),
                null, null, null, result.getLong("version"));
    }
}
