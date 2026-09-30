package br.edu.ifgoiano.sager.operations.shortexits;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import br.edu.ifgoiano.sager.operations.AuthorizedExitLookup;
import br.edu.ifgoiano.sager.operations.ExitOccupancyLookup;
import br.edu.ifgoiano.sager.operations.OperationResidents.Eligibility;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@Profile("local")
public class ShortExitRepository implements AuthorizedExitLookup, ExitOccupancyLookup {
    private static final Set<String> MUTABLE_COLUMNS = Set.of("departure_mode", "requested_departure_at",
            "expected_return_at", "reason", "notes", "status", "decision", "decision_comment",
            "decided_at", "actual_departure_at", "actual_return_at", "late_observation",
            "cancellation_reason", "expiry_reason");
    private final JdbcTemplate jdbc;

    public ShortExitRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<ShortExit> find(UUID id, boolean lock) {
        return jdbc.query("SELECT * FROM sager_short_exit WHERE id = ?" + (lock ? " FOR UPDATE" : ""),
                (result, row) -> map(result), id).stream().findFirst();
    }

    public List<ShortExit> list(UUID residentId, String search, String status) {
        StringBuilder query = new StringBuilder("SELECT * FROM sager_short_exit WHERE TRUE");
        List<Object> parameters = new ArrayList<>();
        if (residentId != null) {
            query.append(" AND resident_id = ?");
            parameters.add(residentId);
        }
        if (status != null) {
            query.append(" AND status = ?");
            parameters.add(status);
        }
        if (search != null && !search.isBlank()) {
            query.append(" AND (resident_name ILIKE ? ESCAPE '\\' OR enrollment ILIKE ? ESCAPE '\\')");
            String escaped = "%" + search.trim().replace("\\", "\\\\")
                    .replace("%", "\\%").replace("_", "\\_") + "%";
            parameters.add(escaped);
            parameters.add(escaped);
        }
        query.append(" ORDER BY created_at DESC, id DESC");
        return jdbc.query(query.toString(), (result, row) -> map(result), parameters.toArray());
    }

    public ShortExit insert(UUID id, Eligibility resident, ShortExitService.Plan plan, Instant now) {
        return jdbc.queryForObject("""
                INSERT INTO sager_short_exit(id, resident_id, resident_name, enrollment, departure_mode,
                    requested_departure_at, expected_return_at, reason, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
                """, (result, row) -> map(result), id, resident.residentId(), resident.residentName(),
                resident.enrollment(), plan.departureMode(), timestamp(plan.requestedDepartureAt()),
                timestamp(plan.expectedReturnAt()), plan.reason(), plan.notes(), timestamp(now), timestamp(now));
    }

    public ShortExit update(UUID id, long version, Map<String, Object> changes, Instant now) {
        StringBuilder query = new StringBuilder("UPDATE sager_short_exit SET ");
        List<Object> parameters = new ArrayList<>();
        changes.forEach((column, value) -> {
            if (!MUTABLE_COLUMNS.contains(column)) throw new IllegalArgumentException("Coluna não permitida.");
            query.append(column).append(" = ?, ");
            parameters.add(value instanceof Instant instant ? timestamp(instant) : value);
        });
        query.append("version = version + 1, updated_at = ? WHERE id = ? AND version = ? RETURNING *");
        parameters.add(timestamp(now));
        parameters.add(id);
        parameters.add(version);
        return jdbc.query(query.toString(), (result, row) -> map(result), parameters.toArray())
                .stream().findFirst().orElse(null);
    }

    public boolean overlaps(UUID residentId, UUID excluded, Instant departure, Instant returning, Instant now) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM sager_short_exit WHERE resident_id = ?
                    AND (?::uuid IS NULL OR id <> ?)
                    AND requested_departure_at < ? AND expected_return_at > ?
                    AND (status = 'EM_ANDAMENTO'
                        OR (status = 'APROVADA' AND expected_return_at > ?)
                        OR (status = 'AGUARDANDO_ANALISE' AND
                            CASE WHEN departure_mode = 'SCHEDULED' THEN requested_departure_at
                                ELSE expected_return_at END > ?)))
                """, Boolean.class, residentId, excluded, excluded, timestamp(returning), timestamp(departure),
                timestamp(now), timestamp(now)));
    }

    @Override
    public boolean physicalOpenFor(UUID residentId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM sager_short_exit"
                + " WHERE resident_id = ? AND actual_departure_at IS NOT NULL AND actual_return_at IS NULL)",
                Boolean.class, residentId));
    }

    @Override
    public boolean overlaps(UUID residentId, Reference excluded,
            Instant departure, Instant returning, Instant now) {
        UUID excludedId = excluded != null && "SHORT".equals(excluded.type()) ? excluded.id() : null;
        return overlaps(residentId, excludedId, departure, returning, now);
    }

    public List<UUID> due(Instant now) {
        return jdbc.query("""
                SELECT id FROM sager_short_exit
                WHERE (status = 'APROVADA' AND expected_return_at <= ?)
                    OR (status = 'AGUARDANDO_ANALISE' AND
                        CASE WHEN departure_mode = 'SCHEDULED' THEN requested_departure_at
                            ELSE expected_return_at END <= ?)
                ORDER BY resident_id, id
                """, (result, row) -> result.getObject(1, UUID.class), timestamp(now), timestamp(now));
    }

    public void history(ShortExit exit, String event, Instant recordedAt, Instant effectiveAt,
            UUID actorId, String actorProfile, String origin, String justification) {
        jdbc.update("""
                INSERT INTO sager_short_exit_history(id, exit_id, event, resulting_version, occurred_at,
                    effective_at, actor_id, actor_profile, origin, justification, departure_mode,
                    requested_departure_at, expected_return_at, reason, notes, status, decision,
                    decision_comment, actual_departure_at, actual_return_at, late_observation,
                    cancellation_reason, expiry_reason)
                SELECT ?, id, ?, version, ?, ?, ?, ?, ?, ?, departure_mode, requested_departure_at,
                    expected_return_at, reason, notes, status, decision, decision_comment,
                    actual_departure_at, actual_return_at, late_observation, cancellation_reason, expiry_reason
                FROM sager_short_exit WHERE id = ?
                """, UUID.randomUUID(), event, timestamp(recordedAt), timestamp(effectiveAt), actorId,
                actorProfile, origin, justification, exit.id());
    }

    public List<ShortExit.History> history(UUID exitId) {
        return jdbc.query("SELECT * FROM sager_short_exit_history WHERE exit_id = ? ORDER BY sequence",
                (result, row) -> new ShortExit.History(result.getObject("id", UUID.class),
                result.getString("event"), result.getLong("resulting_version"), instant(result, "occurred_at"),
                instant(result, "effective_at"), result.getObject("actor_id", UUID.class),
                result.getString("actor_profile"), result.getString("origin"), result.getString("justification"),
                result.getString("departure_mode"), instant(result, "requested_departure_at"),
                instant(result, "expected_return_at"), result.getString("reason"), result.getString("notes"),
                result.getString("status"), result.getString("decision"), result.getString("decision_comment"),
                instant(result, "actual_departure_at"), instant(result, "actual_return_at"),
                result.getString("late_observation"), result.getString("cancellation_reason"),
                result.getString("expiry_reason")), exitId);
    }

    @Override
    public List<Reference> authorizedFor(UUID residentId, Instant at) {
        return jdbc.query("""
                SELECT id FROM sager_short_exit WHERE resident_id = ? AND decision = 'APPROVE'
                    AND decided_at <= ? AND actual_departure_at <= ? AND expected_return_at >= ?
                    AND (actual_return_at IS NULL OR actual_return_at > ?)
                ORDER BY actual_departure_at DESC, id
                """, (result, row) -> new Reference(result.getObject(1, UUID.class), "SHORT"),
                residentId, timestamp(at), timestamp(at), timestamp(at), timestamp(at));
    }

    private ShortExit map(ResultSet result) throws SQLException {
        return new ShortExit(result.getObject("id", UUID.class), result.getObject("resident_id", UUID.class),
                result.getString("resident_name"), result.getString("enrollment"), result.getString("departure_mode"),
                instant(result, "requested_departure_at"), instant(result, "expected_return_at"),
                result.getString("reason"), result.getString("notes"), result.getString("status"),
                result.getString("decision"), result.getString("decision_comment"), instant(result, "decided_at"),
                instant(result, "actual_departure_at"), instant(result, "actual_return_at"),
                result.getString("late_observation"), result.getString("cancellation_reason"),
                result.getString("expiry_reason"), instant(result, "created_at"), instant(result, "updated_at"),
                result.getLong("version"), null, null, null, false, null, null, null, List.of());
    }

    static Instant instant(ResultSet result, String column) throws SQLException {
        OffsetDateTime value = result.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    static OffsetDateTime timestamp(Instant instant) {
        return instant == null ? null : OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
