package br.edu.ifgoiano.sager.operations.longexits;

import br.edu.ifgoiano.sager.documents.StoredFile;
import br.edu.ifgoiano.sager.operations.AuthorizedExitLookup;
import br.edu.ifgoiano.sager.operations.ExitOccupancyLookup;
import br.edu.ifgoiano.sager.operations.OperationResidents.Eligibility;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

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

@Repository
@Profile({ "local", "production" })
public class LongExitRepository implements AuthorizedExitLookup, ExitOccupancyLookup {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private static final Set<String> COLUMNS =
            Set.of(
                    "guardian_id",
                    "guardian_name",
                    "guardian_relationship",
                    "departure_mode",
                    "requested_departure_at",
                    "expected_return_at",
                    "reason",
                    "notes",
                    "status",
                    "current_document_version_id",
                    "decision",
                    "decision_comment",
                    "decided_at",
                    "actual_departure_at",
                    "actual_return_at",
                    "late_observation",
                    "cancellation_reason",
                    "expiry_reason");

    public LongExitRepository(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public Optional<Row> find(UUID id, boolean lock) {
        return jdbc
                .query(
                        "SELECT * FROM sager_long_exit WHERE id=?" + (lock ? " FOR UPDATE" : ""),
                        (r, n) -> row(r),
                        id)
                .stream()
                .findFirst();
    }

    public br.edu.ifgoiano.sager.management.ManagementSearch.Page<Row> search(java.util.Map<String,String> filters) {
        return br.edu.ifgoiano.sager.management.ManagementSearch.query(jdbc,"*","sager_long_exit",
                "concat_ws(' ',resident_name,enrollment)","enrollment","created_at DESC,id DESC",
                java.util.Map.of("residentId","resident_id=?::uuid","status","status=?",
                    "from","(requested_departure_at AT TIME ZONE 'America/Sao_Paulo')::date>=?::date",
                    "to","(requested_departure_at AT TIME ZONE 'America/Sao_Paulo')::date<=?::date",
                    "accommodationId","EXISTS (SELECT 1 FROM sager_room_allocation al JOIN sager_room room ON room.id=al.room_id WHERE al.resident_id=sager_long_exit.resident_id AND al.started_at<=sager_long_exit.requested_departure_at AND (al.ended_at IS NULL OR al.ended_at>sager_long_exit.requested_departure_at) AND room.accommodation_id=?::uuid)",
                    "unitId","EXISTS (SELECT 1 FROM sager_room_allocation al JOIN sager_room room ON room.id=al.room_id WHERE al.resident_id=sager_long_exit.resident_id AND al.started_at<=sager_long_exit.requested_departure_at AND (al.ended_at IS NULL OR al.ended_at>sager_long_exit.requested_departure_at) AND room.unit_id=?::uuid)",
                    "roomId","EXISTS (SELECT 1 FROM sager_room_allocation al WHERE al.resident_id=sager_long_exit.resident_id AND al.started_at<=sager_long_exit.requested_departure_at AND (al.ended_at IS NULL OR al.ended_at>sager_long_exit.requested_departure_at) AND al.room_id=?::uuid)"),filters,(r,n)->row(r));
    }

    public List<Row> list(UUID residentId, String search, String status) {
        StringBuilder query = new StringBuilder("SELECT * FROM sager_long_exit WHERE TRUE");
        List<Object> args = new ArrayList<>();
        if (residentId != null) {
            query.append(" AND resident_id=?");
            args.add(residentId);
        }
        if (status != null) {
            query.append(" AND status=?");
            args.add(status);
        }
        if (search != null && !search.isBlank()) {
            query.append(
                    " AND (position(sager_search_text(?) in sager_search_text(resident_name)) > 0 OR position(sager_search_text(?) in sager_search_text(enrollment)) > 0)");
            String escaped = search.trim();
            args.add(escaped);
            args.add(escaped);
        }
        query.append(" ORDER BY created_at DESC,id DESC");
        return jdbc.query(query.toString(), (r, n) -> row(r), args.toArray());
    }

    public Row insert(
            UUID id,
            Eligibility resident,
            LongExitGuardians.Guardian guardian,
            LongExitService.Plan plan,
            UUID documentId,
            Instant now) {
        return jdbc.queryForObject(
                """
INSERT INTO sager_long_exit(id,resident_id,resident_name,enrollment,guardian_id,guardian_name,
    guardian_relationship,departure_mode,requested_departure_at,expected_return_at,reason,notes,
    current_document_version_id,created_at,updated_at)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *
""",
                (r, n) -> row(r),
                id,
                resident.residentId(),
                resident.residentName(),
                resident.enrollment(),
                guardian.id(),
                guardian.name(),
                guardian.relationship(),
                plan.departureMode(),
                time(plan.requestedDepartureAt()),
                time(plan.expectedReturnAt()),
                plan.reason(),
                plan.notes(),
                documentId,
                time(now),
                time(now));
    }

    public Row update(Row current, Map<String, Object> changes, Instant now) {
        StringBuilder query = new StringBuilder("UPDATE sager_long_exit SET ");
        List<Object> args = new ArrayList<>();
        changes.forEach(
                (k, v) -> {
                    if (!COLUMNS.contains(k))
                        throw new IllegalArgumentException("Coluna inválida.");
                    query.append(k).append("=?, ");
                    args.add(v instanceof Instant i ? time(i) : v);
                });
        query.append("version=version+1,updated_at=? WHERE id=? AND version=? RETURNING *");
        args.add(time(now));
        args.add(current.id());
        args.add(current.version());
        return jdbc.query(query.toString(), (r, n) -> row(r), args.toArray()).stream()
                .findFirst()
                .orElse(null);
    }

    public DocumentRow document(UUID id) {
        return jdbc
                .query(
                        "SELECT * FROM sager_document_version WHERE id=?",
                        (r, n) ->
                                new DocumentRow(
                                        r.getObject("id", UUID.class),
                                        r.getObject("exit_id", UUID.class),
                                        r.getInt("revision_number"),
                                        r.getString("snapshot"),
                                        new StoredFile(
                                                r.getObject("original_file_id", UUID.class),
                                                r.getString("original_hash"),
                                                r.getLong("original_size"),
                                                r.getString("original_state")),
                                        r.getObject("signed_file_id", UUID.class) == null
                                                ? null
                                                : new StoredFile(
                                                        r.getObject("signed_file_id", UUID.class),
                                                        r.getString("signed_hash"),
                                                        r.getLong("signed_size"),
                                                        r.getString("signed_state")),
                                        r.getString("signed_media_type")),
                        id)
                .stream()
                .findFirst()
                .orElseThrow(br.edu.ifgoiano.sager.operations.OpsInput::notFound);
    }

    public void insertDocument(
            UUID id, Row exit, int revision, String snapshot, StoredFile file, Instant now) {
        jdbc.update(
                """
INSERT INTO sager_document_version(id,exit_id,revision_number,template_version,snapshot,
    original_file_id,original_hash,original_size,original_state,created_at)
VALUES (?,?,?,?,?::jsonb,?,?,?,?,?)
""",
                id,
                exit.id(),
                revision,
                br.edu.ifgoiano.sager.documents.LongExitPdfGenerator.TERM_VERSION,
                snapshot,
                file.id(),
                file.sha256(),
                file.size(),
                file.state(),
                time(now));
    }

    public void history(
            Row exit,
            String event,
            Instant now,
            Instant effective,
            UUID actor,
            String profile,
            String origin,
            String reason) {
        jdbc.update(
                """
INSERT INTO sager_long_exit_history(id,exit_id,event,resulting_version,recorded_at,effective_at,
    actor_id,actor_profile,origin,justification,snapshot)
SELECT ?,id,?,version,?,?,?,?,?,?,to_jsonb(sager_long_exit) FROM sager_long_exit WHERE id=?
""",
                UUID.randomUUID(),
                event,
                time(now),
                time(effective),
                actor,
                profile,
                origin,
                reason,
                exit.id());
    }

    public List<LongExit.History> history(UUID exitId) {
        return jdbc.query(
                "SELECT * FROM sager_long_exit_history WHERE exit_id=? ORDER BY sequence",
                (r, n) -> {
                    JsonNode s = json.readTree(r.getString("snapshot"));
                    return new LongExit.History(
                            r.getObject("id", UUID.class),
                            r.getString("event"),
                            r.getLong("resulting_version"),
                            instant(r, "recorded_at"),
                            instant(r, "effective_at"),
                            r.getObject("actor_id", UUID.class),
                            r.getString("actor_profile"),
                            r.getString("origin"),
                            r.getString("justification"),
                            UUID.fromString(s.path("guardian_id").asText()),
                            UUID.fromString(s.path("current_document_version_id").asText()),
                            text(s, "departure_mode"),
                            date(s, "requested_departure_at"),
                            date(s, "expected_return_at"),
                            text(s, "reason"),
                            text(s, "notes"),
                            text(s, "status"),
                            text(s, "decision"),
                            text(s, "decision_comment"),
                            date(s, "actual_departure_at"),
                            date(s, "actual_return_at"),
                            text(s, "late_observation"),
                            text(s, "cancellation_reason"),
                            text(s, "expiry_reason"));
                },
                exitId);
    }

    public List<UUID> due(Instant now) {
        return jdbc.query(
                """
SELECT id FROM sager_long_exit WHERE (status='APROVADA' AND expected_return_at<=?)
    OR (status='AGUARDANDO_ANALISE' AND CASE WHEN departure_mode='SCHEDULED'
        THEN requested_departure_at ELSE expected_return_at END<=?) ORDER BY resident_id,id
""",
                (r, n) -> r.getObject(1, UUID.class),
                time(now),
                time(now));
    }

    @Override
    public boolean physicalOpenFor(UUID residentId) {
        return Boolean.TRUE.equals(
                jdbc.queryForObject(
                        "SELECT EXISTS(SELECT 1 FROM sager_long_exit WHERE resident_id=? AND"
                                + " actual_departure_at IS NOT NULL AND actual_return_at IS NULL)",
                        Boolean.class,
                        residentId));
    }

    @Override
    public boolean overlaps(
            UUID residentId,
            Reference excluded,
            Instant departure,
            Instant returning,
            Instant now) {
        UUID id = excluded != null && "LONG".equals(excluded.type()) ? excluded.id() : null;
        return Boolean.TRUE.equals(
                jdbc.queryForObject(
                        """
SELECT EXISTS(SELECT 1 FROM sager_long_exit WHERE resident_id=? AND (?::uuid IS NULL OR id<>?)
    AND requested_departure_at<? AND expected_return_at>?
    AND (status='EM_ANDAMENTO' OR (status='APROVADA' AND expected_return_at>?)
        OR (status='AGUARDANDO_ANALISE' AND CASE WHEN departure_mode='SCHEDULED'
            THEN requested_departure_at ELSE expected_return_at END>?)))
""",
                        Boolean.class,
                        residentId,
                        id,
                        id,
                        time(returning),
                        time(departure),
                        time(now),
                        time(now)));
    }

    @Override
    public List<Reference> authorizedFor(UUID residentId, Instant at) {
        return jdbc.query(
                """
SELECT id FROM sager_long_exit WHERE resident_id=? AND decision='APPROVE' AND decided_at<=?
    AND actual_departure_at<=? AND expected_return_at>=? AND (actual_return_at IS NULL OR actual_return_at>?)
ORDER BY actual_departure_at DESC,id
""",
                (r, n) -> new Reference(r.getObject(1, UUID.class), "LONG"),
                residentId,
                time(at),
                time(at),
                time(at),
                time(at));
    }

    private Row row(ResultSet r) throws SQLException {
        return new Row(
                r.getObject("id", UUID.class),
                r.getObject("resident_id", UUID.class),
                r.getString("resident_name"),
                r.getString("enrollment"),
                r.getObject("guardian_id", UUID.class),
                r.getString("guardian_name"),
                r.getString("guardian_relationship"),
                r.getString("departure_mode"),
                instant(r, "requested_departure_at"),
                instant(r, "expected_return_at"),
                r.getString("reason"),
                r.getString("notes"),
                r.getString("status"),
                r.getObject("current_document_version_id", UUID.class),
                r.getString("decision"),
                r.getString("decision_comment"),
                instant(r, "decided_at"),
                instant(r, "actual_departure_at"),
                instant(r, "actual_return_at"),
                r.getString("late_observation"),
                r.getString("cancellation_reason"),
                r.getString("expiry_reason"),
                instant(r, "created_at"),
                instant(r, "updated_at"),
                r.getLong("version"));
    }

    private static String text(JsonNode n, String field) {
        return n.path(field).isNull() ? null : n.path(field).asText();
    }

    private static Instant date(JsonNode n, String field) {
        String s = text(n, field);
        return s == null ? null : OffsetDateTime.parse(s).toInstant();
    }

    public static Instant instant(ResultSet r, String c) throws SQLException {
        OffsetDateTime v = r.getObject(c, OffsetDateTime.class);
        return v == null ? null : v.toInstant();
    }

    public static OffsetDateTime time(Instant v) {
        return v == null ? null : OffsetDateTime.ofInstant(v, ZoneOffset.UTC);
    }

    public record DocumentRow(
            UUID id,
            UUID exitId,
            int revision,
            String snapshot,
            StoredFile original,
            StoredFile signed,
            String signedMediaType) {}

    public record Row(
            UUID id,
            UUID residentId,
            String residentName,
            String enrollment,
            UUID guardianId,
            String guardianName,
            String guardianRelationship,
            String departureMode,
            Instant requestedDepartureAt,
            Instant expectedReturnAt,
            String reason,
            String notes,
            String status,
            UUID documentVersionId,
            String decision,
            String decisionComment,
            Instant decidedAt,
            Instant actualDepartureAt,
            Instant actualReturnAt,
            String lateObservation,
            String cancellationReason,
            String expiryReason,
            Instant createdAt,
            Instant updatedAt,
            long version) {
        public Instant deadline() {
            return LongExit.PENDING.equals(status)
                    ? ("SCHEDULED".equals(departureMode) ? requestedDepartureAt : expectedReturnAt)
                    : LongExit.APPROVED.equals(status) ? expectedReturnAt : null;
        }
    }
}
