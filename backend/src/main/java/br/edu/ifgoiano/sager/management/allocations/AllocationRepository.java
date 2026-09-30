package br.edu.ifgoiano.sager.management.allocations;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@Profile("local")
public class AllocationRepository {
    private static final String COLUMNS =
            "id, resident_id, room_id, started_at, ended_at, end_reason, version";
    private final JdbcTemplate jdbc;

    public AllocationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Allocation> findByResident(UUID residentId) {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_room_allocation"
                        + " WHERE resident_id = ? ORDER BY started_at DESC, ended_at NULLS FIRST, id DESC",
                (result, row) -> map(result), residentId);
    }

    public List<Allocation> findByRoom(UUID roomId, Boolean active) {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_room_allocation"
                        + " WHERE room_id = ?" + (active == null ? ""
                        : active ? " AND ended_at IS NULL" : " AND ended_at IS NOT NULL")
                        + " ORDER BY started_at DESC, ended_at NULLS FIRST, id DESC",
                (result, row) -> map(result), roomId);
    }

    public Optional<Allocation> findById(UUID id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_room_allocation WHERE id = ?",
                (result, row) -> map(result), id).stream().findFirst();
    }

    public Optional<Allocation> findByIdForUpdate(UUID id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_room_allocation WHERE id = ? FOR UPDATE",
                (result, row) -> map(result), id).stream().findFirst();
    }

    public boolean lockResident(UUID residentId) {
        return !jdbc.query("SELECT id FROM sager_resident WHERE id = ? FOR UPDATE",
                (result, row) -> result.getObject(1, UUID.class), residentId).isEmpty();
    }

    public boolean activeResident(UUID residentId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM sager_room_allocation"
                + " WHERE resident_id = ? AND ended_at IS NULL)", Boolean.class, residentId));
    }

    public int activeRoomCount(UUID roomId) {
        return jdbc.queryForObject("SELECT COUNT(*)::integer FROM sager_room_allocation"
                + " WHERE room_id = ? AND ended_at IS NULL", Integer.class, roomId);
    }

    public Allocation insert(UUID id, UUID residentId, UUID roomId) {
        return jdbc.queryForObject("""
                INSERT INTO sager_room_allocation (id, resident_id, room_id)
                VALUES (?, ?, ?)
                RETURNING id, resident_id, room_id, started_at, ended_at, end_reason, version
                """, (result, row) -> map(result), id, residentId, roomId);
    }

    public Allocation close(UUID id, long version, String reason) {
        List<Allocation> updated = jdbc.query("""
                UPDATE sager_room_allocation
                SET ended_at = CURRENT_TIMESTAMP, end_reason = ?, version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND version = ? AND ended_at IS NULL
                RETURNING id, resident_id, room_id, started_at, ended_at, end_reason, version
                """, (result, row) -> map(result), reason, id, version);
        return updated.isEmpty() ? null : updated.getFirst();
    }

    private Allocation map(ResultSet result) throws SQLException {
        return new Allocation(result.getObject("id", UUID.class),
                result.getObject("resident_id", UUID.class), result.getObject("room_id", UUID.class),
                result.getObject("started_at", OffsetDateTime.class),
                result.getObject("ended_at", OffsetDateTime.class), result.getString("end_reason"),
                result.getLong("version"));
    }
}
