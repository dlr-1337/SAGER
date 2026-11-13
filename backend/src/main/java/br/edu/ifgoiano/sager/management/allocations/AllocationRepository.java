package br.edu.ifgoiano.sager.management.allocations;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import br.edu.ifgoiano.sager.management.residents.CourseProgress;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@Profile({ "local", "production" })
public class AllocationRepository {
    private static final String COLUMNS =
            "id, resident_id, room_id, started_at, ended_at, end_reason, version";
    private static final String COURSE_FACTS = "r.id AS resident_id, r.enrollment, r.entry_year,"
            + " r.extra_semesters, c.level, c.duration_years"
            + " FROM sager_resident r LEFT JOIN sager_course c ON c.id = r.course_id";
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

    /** Dados do curso de um residente; allocationId vem nulo. */
    public Optional<CourseFacts> courseFacts(UUID residentId) {
        return jdbc.query("SELECT NULL::uuid AS allocation_id, " + COURSE_FACTS + " WHERE r.id = ?",
                (result, row) -> facts(result), residentId).stream().findFirst();
    }

    /** Vínculos ativos com os dados do curso de cada morador. */
    public List<CourseFacts> activeCourseFacts() {
        return jdbc.query("SELECT a.id AS allocation_id, " + COURSE_FACTS
                + " JOIN sager_room_allocation a ON a.resident_id = r.id AND a.ended_at IS NULL",
                (result, row) -> facts(result));
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

    private CourseFacts facts(ResultSet result) throws SQLException {
        return new CourseFacts(result.getObject("allocation_id", UUID.class),
                result.getObject("resident_id", UUID.class), result.getString("enrollment"),
                result.getObject("entry_year", Integer.class), result.getInt("extra_semesters"),
                result.getString("level"), result.getObject("duration_years", Integer.class));
    }

    public record CourseFacts(UUID allocationId, UUID residentId, String enrollment, Integer entryYear,
            int extraSemesters, String level, Integer durationYears) {
        public boolean concluded(LocalDate today) {
            return CourseProgress.of(enrollment, entryYear, extraSemesters, level, durationYears, today).concluded();
        }
    }

    private Allocation map(ResultSet result) throws SQLException {
        return new Allocation(result.getObject("id", UUID.class),
                result.getObject("resident_id", UUID.class), result.getObject("room_id", UUID.class),
                result.getObject("started_at", OffsetDateTime.class),
                result.getObject("ended_at", OffsetDateTime.class), result.getString("end_reason"),
                result.getLong("version"));
    }
}
