package br.edu.ifgoiano.sager.operations.nightcalls;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import br.edu.ifgoiano.sager.operations.AuthorizedExitLookup.Reference;
import br.edu.ifgoiano.sager.operations.OpsInput;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@Profile({ "local", "production" })
public class NightCallRepository {
    private final JdbcTemplate jdbc;

    public NightCallRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Alojamento de maiores fica de fora, salvo enquanto tiver menor alocado (design D10). */
    public List<NightCall.AccommodationOption> accommodations(LocalDate today) {
        return jdbc.query("""
                SELECT id, code, name FROM sager_accommodation
                WHERE age_group IS DISTINCT FROM 'MAIORES' OR EXISTS (SELECT 1 FROM sager_room q
                    JOIN sager_room_allocation a ON a.room_id = q.id AND a.ended_at IS NULL
                    JOIN sager_resident r ON r.id = a.resident_id
                    WHERE q.accommodation_id = sager_accommodation.id AND r.birth_date > ?)
                ORDER BY code, id
                """, (result, row) -> new NightCall.AccommodationOption(result.getObject("id", UUID.class),
                result.getString("code"), result.getString("name")), today.minusYears(18));
    }

    public List<RosterResident> roster(UUID accommodationId, Instant now) {
        return jdbc.query("""
                SELECT r.id, r.name, r.enrollment, r.birth_date, q.id AS room_id, q.number AS room_number
                FROM sager_resident r
                JOIN sager_room_allocation a ON a.resident_id = r.id AND a.ended_at IS NULL AND a.started_at <= ?
                JOIN sager_room q ON q.id = a.room_id
                WHERE q.accommodation_id = ? ORDER BY q.number, r.name, r.id
                """, (result, row) -> new RosterResident(result.getObject("id", UUID.class),
                result.getString("name"), result.getString("enrollment"), result.getObject("birth_date", LocalDate.class),
                result.getObject("room_id", UUID.class), result.getString("room_number")), timestamp(now), accommodationId);
    }

    public UUID existing(UUID accommodationId, LocalDate date) {
        return jdbc.query("SELECT id FROM sager_night_call WHERE accommodation_id = ? AND reference_date = ?",
                (result, row) -> result.getObject(1, UUID.class), accommodationId, date).stream().findFirst().orElse(null);
    }

    public Optional<NightCall> find(UUID id, boolean lock) {
        return jdbc.query("SELECT * FROM sager_night_call WHERE id = ?" + (lock ? " FOR UPDATE" : ""),
                (result, row) -> map(result), id).stream().findFirst();
    }

    public List<NightCall> list(UUID accommodationId, LocalDate date) {
        StringBuilder query = new StringBuilder("SELECT * FROM sager_night_call WHERE TRUE");
        List<Object> parameters = new ArrayList<>();
        if (accommodationId != null) {
            query.append(" AND accommodation_id = ?");
            parameters.add(accommodationId);
        }
        if (date != null) {
            query.append(" AND reference_date = ?");
            parameters.add(date);
        }
        query.append(" ORDER BY reference_date DESC, opened_at DESC, id");
        return jdbc.query(query.toString(), (result, row) -> map(result), parameters.toArray());
    }

    public NightCall insert(UUID id, NightCall.AccommodationOption accommodation, LocalDate date,
            Instant now, UUID actorId, boolean outsideWindow, String justification) {
        return jdbc.queryForObject("""
                INSERT INTO sager_night_call(id, accommodation_id, accommodation_name, reference_date,
                    opened_at, opened_by, outside_window_confirmed, justification)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
                """, (result, row) -> map(result), id, accommodation.id(), accommodation.name(), date,
                timestamp(now), actorId, outsideWindow, justification);
    }

    public NightCall.ResidentMark insertMark(UUID callId, RosterResident resident) {
        return jdbc.queryForObject("""
                INSERT INTO sager_night_call_mark(id, call_id, resident_id, resident_name, enrollment,
                    birth_date, room_id, room_number)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
                """, (result, row) -> mapMark(result), UUID.randomUUID(), callId, resident.id(), resident.name(),
                resident.enrollment(), resident.birthDate(), resident.roomId(), resident.roomNumber());
    }

    public List<NightCall.ResidentMark> marks(UUID callId) {
        return jdbc.query("SELECT * FROM sager_night_call_mark WHERE call_id = ? ORDER BY room_number, resident_name, resident_id",
                (result, row) -> mapMark(result), callId);
    }

    public Optional<NightCall.ResidentMark> mark(UUID callId, UUID residentId) {
        return jdbc.query("SELECT * FROM sager_night_call_mark WHERE call_id = ? AND resident_id = ?",
                (result, row) -> mapMark(result), callId, residentId).stream().findFirst();
    }

    public NightCall.ResidentMark updateMark(UUID id, String mark, Reference exit) {
        return jdbc.queryForObject("""
                UPDATE sager_night_call_mark SET mark = ?, authorized_exit_id = ?, authorized_exit_type = ?,
                    version = version + 1 WHERE id = ? RETURNING *
                """, (result, row) -> mapMark(result), mark, exit == null ? null : exit.id(),
                exit == null ? null : exit.type(), id);
    }

    public long advanceVersion(UUID id, long version) {
        List<Long> updated = jdbc.query("UPDATE sager_night_call SET version = version + 1"
                + " WHERE id = ? AND version = ? RETURNING version", (result, row) -> result.getLong(1), id, version);
        if (updated.isEmpty()) throw OpsInput.conflict("stale_version", "A chamada foi alterada.");
        return updated.getFirst();
    }

    public NightCall close(NightCall call, Instant now, UUID actorId, boolean exceptional, String justification) {
        return jdbc.queryForObject("""
                UPDATE sager_night_call SET status = 'FECHADA', closed_at = ?, closed_by = ?,
                    close_outside_window_confirmed = ?, close_justification = ?, version = version + 1
                WHERE id = ? AND version = ? RETURNING *
                """, (result, row) -> map(result), timestamp(now), actorId, exceptional,
                justification, call.id(), call.version());
    }

    public void history(NightCall.ResidentMark mark, long callVersion, String justification,
            Instant now, UUID actorId, String actorProfile) {
        jdbc.update("""
                INSERT INTO sager_night_call_mark_history(id, mark_id, mark, authorized_exit_id,
                    authorized_exit_type, justification, recorded_at, actor_id, actor_profile,
                    resulting_version, call_version)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), mark.id(), mark.mark(), mark.authorizedExitId(), mark.authorizedExitType(),
                justification, timestamp(now), actorId, actorProfile, mark.version(), callVersion);
    }

    public List<NightCall.MarkHistory> history(UUID markId) {
        return jdbc.query("SELECT * FROM sager_night_call_mark_history WHERE mark_id = ? ORDER BY sequence",
                (result, row) -> new NightCall.MarkHistory(result.getObject("id", UUID.class),
                result.getString("mark"), result.getObject("authorized_exit_id", UUID.class),
                result.getString("authorized_exit_type"), result.getString("justification"),
                instant(result, "recorded_at"), result.getObject("actor_id", UUID.class),
                result.getString("actor_profile"), result.getLong("resulting_version"), result.getLong("call_version")), markId);
    }

    private NightCall map(ResultSet result) throws SQLException {
        return new NightCall(result.getObject("id", UUID.class), result.getObject("accommodation_id", UUID.class),
                result.getString("accommodation_name"), result.getObject("reference_date", LocalDate.class),
                result.getString("status"), result.getLong("version"), instant(result, "opened_at"),
                result.getObject("opened_by", UUID.class), instant(result, "closed_at"),
                result.getObject("closed_by", UUID.class), result.getBoolean("outside_window_confirmed"),
                result.getString("justification"), result.getBoolean("close_outside_window_confirmed"),
                result.getString("close_justification"), null, List.of());
    }

    private NightCall.ResidentMark mapMark(ResultSet result) throws SQLException {
        return new NightCall.ResidentMark(result.getObject("id", UUID.class), result.getObject("resident_id", UUID.class),
                result.getString("resident_name"), result.getString("enrollment"), result.getObject("birth_date", LocalDate.class),
                result.getObject("room_id", UUID.class), result.getString("room_number"), result.getString("mark"),
                result.getObject("authorized_exit_id", UUID.class), result.getString("authorized_exit_type"),
                result.getLong("version"), List.of(), List.of());
    }

    private Instant instant(ResultSet result, String column) throws SQLException {
        OffsetDateTime time = result.getObject(column, OffsetDateTime.class);
        return time == null ? null : time.toInstant();
    }

    private OffsetDateTime timestamp(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    public record RosterResident(UUID id, String name, String enrollment, LocalDate birthDate,
            UUID roomId, String roomNumber) {
    }
}
