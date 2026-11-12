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
@Profile({ "local", "production" })
public class RoomRepository {
    private static final String OCCUPANCY = "(SELECT COUNT(*)::integer FROM sager_room_allocation"
            + " WHERE room_id = sager_room.id AND ended_at IS NULL)";
    // Only Manutenção and Indisponível are stored by hand; Disponível/Ocupado follow the live occupancy.
    private static final String SITUATION = "CASE WHEN situation IN ('Manutenção', 'Indisponível')"
            + " THEN situation WHEN capacity IS NOT NULL AND " + OCCUPANCY + " >= capacity"
            + " THEN 'Ocupado' ELSE 'Disponível' END";
    private static final String COLUMNS = "id, code, number, accommodation_id, unit_id, floor,"
            + " capacity, " + SITUATION + " AS situation, version, " + OCCUPANCY + " AS occupancy";
    private final JdbcTemplate jdbc;

    public RoomRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public br.edu.ifgoiano.sager.management.ManagementSearch.Page<RoomRecord> search(java.util.Map<String,String> params) {
        return br.edu.ifgoiano.sager.management.ManagementSearch.query(jdbc, COLUMNS, "sager_room",
                "concat_ws(' ',code,number,floor,(SELECT name FROM sager_accommodation a WHERE a.id=accommodation_id),(SELECT name FROM sager_accommodation_unit u WHERE u.id=unit_id))", "code", "accommodation_id,unit_id NULLS FIRST,number,id", java.util.Map.of("accommodationId", "accommodation_id = ?::uuid", "unitId", "unit_id = ?::uuid", "situation", SITUATION + " = ?", "vacancy", "(capacity IS NOT NULL AND capacity > (SELECT count(*) FROM sager_room_allocation a WHERE a.room_id=sager_room.id AND a.ended_at IS NULL)) = ?::boolean"), params, (r,n) -> map(r));
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

    public Optional<RoomRecord> findByIdForUpdate(UUID id) {
        List<UUID> locked = jdbc.query("SELECT id FROM sager_room WHERE id = ? FOR UPDATE",
                (result, row) -> result.getObject(1, UUID.class), id);
        return locked.isEmpty() ? Optional.empty() : findById(id);
    }

    public int activeCount(UUID id) {
        return jdbc.queryForObject("SELECT COUNT(*)::integer FROM sager_room_allocation"
                + " WHERE room_id = ? AND ended_at IS NULL", Integer.class, id);
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
        Integer capacity = result.getObject("capacity", Integer.class);
        int occupancy = result.getInt("occupancy");
        return new RoomRecord(result.getObject("id", UUID.class), result.getString("code"),
                result.getString("number"), result.getObject("accommodation_id", UUID.class),
                result.getObject("unit_id", UUID.class), result.getString("floor"),
                capacity, result.getString("situation"), occupancy,
                capacity == null ? null : capacity - occupancy, null, result.getLong("version"));
    }
}
