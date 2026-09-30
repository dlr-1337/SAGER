package br.edu.ifgoiano.sager.health;

import static br.edu.ifgoiano.sager.health.HealthModels.*;

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
import java.util.function.Function;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
@Profile("local")
public class HealthRepository {
    private static final String GRANTS = """
            SELECT g.*, a.display_name AS account_name
            FROM sager_health_grant g JOIN sager_local_account a ON a.id = g.account_id
            """;
    private static final String ASSIGNMENTS = """
            SELECT c.*, r.name AS resident_name, a.display_name AS account_name, g.profession
            FROM sager_health_care_assignment c JOIN sager_health_grant g ON g.id = c.professional_grant_id
            JOIN sager_local_account a ON a.id = c.account_id JOIN sager_resident r ON r.id = c.resident_id
            """;
    private static final String CUSTODIES = """
            SELECT c.*, a.display_name AS recipient_account_name
            FROM sager_health_custody c JOIN sager_health_grant g ON g.id = c.recipient_grant_id
            JOIN sager_local_account a ON a.id = g.account_id
            """;
    private static final String NOTES = """
            SELECT n.*, v.version, v.body, v.recorded_at AS updated_at FROM sager_health_note n
            JOIN LATERAL (SELECT version, body, recorded_at FROM sager_health_revision
                          WHERE note_id = n.id ORDER BY version DESC LIMIT 1) v ON TRUE
            """;
    private static final String RESIDENTS = """
            SELECT r.id, r.name, r.enrollment, r.birth_date, NULL::timestamptz AS last_recorded_at
            FROM sager_resident r
            """;
    private final JdbcTemplate jdbc;

    public HealthRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    Optional<Actor> account(UUID id, boolean lock) {
        return one("SELECT id, email, display_name, profile, active, resident_id, supervisor_id "
                + "FROM sager_local_account WHERE id = ?" + (lock ? " FOR SHARE" : ""),
                (row, index) -> new Actor(uuid(row, "id"), row.getString("email"),
                        row.getString("display_name"), row.getString("profile"), row.getBoolean("active"),
                        uuid(row, "resident_id"), uuid(row, "supervisor_id")), id);
    }

    // Serializes creation of a replacement episode and the custody eligibility check
    // even when no current grant row exists to lock.
    void lockAccountEpisode(UUID accountId) {
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 7262411))",
                (org.springframework.jdbc.core.RowCallbackHandler) row -> {}, accountId.toString());
    }

    Optional<Grant> currentGrant(UUID accountId) {
        return one(GRANTS + " WHERE g.account_id = ? AND g.ended_at IS NULL AND a.active"
                + " FOR SHARE OF g, a", this::grant, accountId);
    }

    Optional<Grant> grant(UUID id, boolean writeLock, boolean activeOnly) {
        return one(GRANTS + " WHERE g.id = ?"
                + (activeOnly ? " AND g.ended_at IS NULL AND a.active" : "")
                + (writeLock ? " FOR UPDATE OF g" : " FOR SHARE OF g")
                + (activeOnly ? " FOR SHARE OF a" : ""), this::grant, id);
    }

    Grant insertGrant(UUID accountId, Profession profession, String number, String region,
            UUID actorId, String reason) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_health_grant
                  (id, account_id, profession, registration_number, registration_region, verified_by, verification_reason)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, id, accountId, profession.name(), number, region, actorId, reason);
        return grant(id, false, false).orElseThrow();
    }

    boolean endGrant(UUID id, long version, String reason) {
        return jdbc.update("""
                UPDATE sager_health_grant SET ended_at = clock_timestamp(), end_reason = ?, version = version + 1
                WHERE id = ? AND version = ? AND ended_at IS NULL
                """, reason, id, version) == 1;
    }

    Page<Grant> grants(UUID accountId, int limit, Long cursor) {
        String where = accountId == null ? " WHERE TRUE" : " WHERE g.account_id = ?";
        List<Object> args = accountId == null ? new ArrayList<>() : new ArrayList<>(List.of(accountId));
        return sequencePage(GRANTS + where, "SELECT COUNT(*) FROM sager_health_grant g" + where,
                args, "g.sequence", cursor, limit, this::grant, Grant::sequence);
    }

    Page<AccountChoice> accounts(String query, UUID afterId, int limit) {
        String where = " WHERE a.active AND (position(lower(?) in lower(a.display_name)) > 0"
                + " OR position(lower(?) in lower(a.email)) > 0)";
        List<Object> args = new ArrayList<>(List.of(query, query));
        long count = count("SELECT COUNT(*) FROM sager_local_account a" + where, args);
        String sql = "SELECT a.id,a.display_name,a.email,a.profile FROM sager_local_account a" + where;
        if (afterId != null) { sql += " AND a.id > ?"; args.add(afterId); }
        sql += " ORDER BY a.id LIMIT ?"; args.add(limit + 1);
        List<AccountChoice> items = jdbc.query(sql, (row, index) -> new AccountChoice(uuid(row, "id"),
                row.getString("display_name"), row.getString("email"), row.getString("profile")), args.toArray());
        boolean more = items.size() > limit;
        if (more) items = items.subList(0, limit);
        return new Page<>(items, more ? items.getLast().id() : null, count);
    }

    Optional<Assignment> assignment(UUID residentId, UUID grantId, boolean writeLock) {
        return one(ASSIGNMENTS + " WHERE c.resident_id = ? AND c.professional_grant_id = ?"
                + " AND c.ended_at IS NULL" + (writeLock ? " FOR UPDATE OF c" : " FOR SHARE OF c"),
                this::assignment, residentId, grantId);
    }

    Optional<Assignment> assignment(UUID id, boolean writeLock) {
        return one(ASSIGNMENTS + " WHERE c.id = ?"
                + (writeLock ? " FOR UPDATE OF c" : ""), this::assignment, id);
    }

    Assignment insertAssignment(UUID residentId, Grant grant, UUID actorId, String reason) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_health_care_assignment
                  (id,resident_id,professional_grant_id,account_id,created_by,reason) VALUES (?,?,?,?,?,?)
                """, id, residentId, grant.id(), grant.accountId(), actorId, reason);
        return assignment(id, false).orElseThrow();
    }

    boolean endAssignment(UUID id, long version, String reason) {
        return jdbc.update("""
                UPDATE sager_health_care_assignment SET ended_at=clock_timestamp(),end_reason=?,version=version+1
                WHERE id=? AND version=? AND ended_at IS NULL
                """, reason, id, version) == 1;
    }

    Page<Assignment> assignments(UUID residentId, int limit, Long cursor) {
        String where = residentId == null ? " WHERE TRUE" : " WHERE c.resident_id = ?";
        List<Object> args = residentId == null ? new ArrayList<>() : new ArrayList<>(List.of(residentId));
        return sequencePage(ASSIGNMENTS + where, "SELECT COUNT(*) FROM sager_health_care_assignment c" + where,
                args, "c.sequence", cursor, limit, this::assignment, Assignment::sequence);
    }

    Optional<ResidentHeader> resident(UUID id) {
        return one(RESIDENTS + " WHERE r.id = ?", this::mapResident, id);
    }

    ResidentHeader resident(Access access) {
        List<Object> args = new ArrayList<>();
        String scope = noteScope(access, null, args);
        args.add(access.residentId());
        return one("""
                SELECT r.id,r.name,r.enrollment,r.birth_date,
                  (SELECT MAX(v.recorded_at) FROM sager_health_note n
                     JOIN sager_health_revision v ON v.note_id=n.id
                """ + scope + ") AS last_recorded_at FROM sager_resident r WHERE r.id=?",
                this::mapResident, args.toArray()).orElseThrow();
    }

    Page<ResidentHeader> residents(Grant grant, String query, UUID afterId, int limit) {
        String where = """
                 WHERE EXISTS (SELECT 1 FROM sager_health_care_assignment c
                    WHERE c.resident_id=r.id AND c.professional_grant_id=? AND c.ended_at IS NULL)
                  AND (position(lower(?) in lower(r.name)) > 0 OR position(lower(?) in lower(r.enrollment)) > 0)
                """;
        List<Object> args = new ArrayList<>(List.of(grant.id(), query, query));
        long count = count("SELECT COUNT(*) FROM sager_resident r" + where, args);
        String sql = RESIDENTS + where;
        if (afterId != null) { sql += " AND r.id > ?"; args.add(afterId); }
        sql += " ORDER BY r.id LIMIT ?"; args.add(limit + 1);
        List<ResidentHeader> items = jdbc.query(sql, this::mapResident, args.toArray());
        boolean more = items.size() > limit;
        if (more) items = items.subList(0, limit);
        return new Page<>(items, more ? items.getLast().id() : null, count);
    }

    List<ProfessionalChoice> professionals(UUID residentId, Category category) {
        String compatible = category == Category.SHARED_SUMMARY ? "TRUE"
                : category == Category.PSYCHOLOGICAL ? "g.profession='PSICOLOGIA'"
                : "g.profession IN ('MEDICINA','ENFERMAGEM')";
        return jdbc.query("""
                SELECT g.account_id,g.id AS grant_id,c.id AS assignment_id,a.display_name,g.profession
                FROM sager_health_grant g JOIN sager_local_account a ON a.id=g.account_id
                JOIN sager_health_care_assignment c ON c.professional_grant_id=g.id
                WHERE g.ended_at IS NULL AND a.active AND c.ended_at IS NULL AND c.resident_id=?
                AND
                """ + compatible + " ORDER BY a.display_name,g.id",
                (row, index) -> new ProfessionalChoice(uuid(row, "account_id"), uuid(row, "grant_id"),
                        uuid(row, "assignment_id"), row.getString("display_name"),
                        Profession.valueOf(row.getString("profession"))), residentId);
    }

    Optional<NoteRow> note(UUID id, boolean writeLock) {
        return one(NOTES + " WHERE n.id = ?" + (writeLock ? " FOR UPDATE OF n" : " FOR SHARE OF n"),
                this::note, id);
    }

    Optional<UUID> noteResidentId(UUID id) {
        return one("SELECT resident_id FROM sager_health_note WHERE id=?",
                (row, index) -> uuid(row, "resident_id"), id);
    }

    Optional<NoteRow> authorizedNote(UUID id, Access access, boolean writeLock) {
        List<Object> args = new ArrayList<>();
        String where = noteScope(access, null, args) + " AND n.id=?";
        args.add(id);
        List<UUID> locked = jdbc.query("SELECT n.id FROM sager_health_note n" + where
                + (writeLock ? " FOR UPDATE OF n" : " FOR SHARE OF n"),
                (row, index) -> uuid(row, "id"), args.toArray());
        if (locked.isEmpty()) return Optional.empty();
        // A separate statement after the identity lock sees a revision committed
        // by a writer for whose lock this transaction may have waited.
        return one(NOTES + where, this::note, args.toArray());
    }

    NoteRow insertNote(Access access, Category category, UUID relatedNoteId, String body) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_health_note (id,resident_id,category,author_account_id,author_grant_id,
                  author_name,author_profession,author_registration_number,author_registration_region,related_note_id)
                VALUES (?,?,?,?,?,?,?,?,?,?)
                """, id, access.residentId(), category.name(), access.actor().id(), access.grant().id(),
                access.actor().name(), access.grant().profession().name(), access.grant().registrationNumber(),
                access.grant().registrationRegion(), relatedNoteId);
        insertRevision(id, 0, body, null, access.actor().id());
        return note(id, false).orElseThrow();
    }

    void insertRevision(UUID noteId, long version, String body, String reason, UUID actorId) {
        jdbc.update("""
                INSERT INTO sager_health_revision (note_id,version,body,reason,recorded_by) VALUES (?,?,?,?,?)
                """, noteId, version, body, reason, actorId);
    }

    Page<NoteRow> notes(Access access, Category category, int limit, Long cursor) {
        List<Object> args = new ArrayList<>();
        String where = noteScope(access, category, args);
        return sequencePage(NOTES + where, "SELECT COUNT(*) FROM sager_health_note n" + where,
                args, "n.sequence", cursor, limit, this::note, NoteRow::sequence);
    }

    List<UUID> noteIds(Access access) {
        List<Object> args = new ArrayList<>();
        return jdbc.query("SELECT n.id FROM sager_health_note n" + noteScope(access, null, args)
                + " ORDER BY n.id", (row, index) -> uuid(row, "id"), args.toArray());
    }

    private String noteScope(Access access, Category category, List<Object> args) {
        String where = " WHERE n.resident_id = ?"; args.add(access.residentId());
        if (category != null) { where += " AND n.category = ?"; args.add(category.name()); }
        if (!access.patient()) {
            where += access.grant().profession() == Profession.PSICOLOGIA
                    ? " AND n.category IN ('PSYCHOLOGICAL','SHARED_SUMMARY')"
                    : " AND n.category IN ('GENERAL','SHARED_SUMMARY')";
            where += """
                     AND (n.author_account_id = ? OR EXISTS (SELECT 1 FROM sager_health_share s
                         WHERE s.note_id=n.id AND s.recipient_grant_id=? AND s.recipient_care_assignment_id=?
                         AND s.ended_at IS NULL)
                       OR EXISTS (SELECT 1 FROM sager_health_custody c WHERE c.resident_id=n.resident_id
                         AND c.source_author_account_id=n.author_account_id AND c.recipient_grant_id=?
                         AND c.recipient_care_assignment_id=? AND c.ended_at IS NULL))
                    """;
            args.add(access.actor().id()); args.add(access.grant().id()); args.add(access.assignment().id());
            args.add(access.grant().id()); args.add(access.assignment().id());
        }
        return where;
    }

    boolean shared(NoteRow note, Access access, boolean lock) {
        return !jdbc.query("""
                SELECT id FROM sager_health_share WHERE note_id=? AND recipient_grant_id=?
                  AND recipient_care_assignment_id=? AND ended_at IS NULL
                """ + (lock ? " FOR SHARE" : ""), (row, index) -> uuid(row, "id"),
                note.id(), access.grant().id(), access.assignment().id()).isEmpty();
    }

    boolean custody(NoteRow note, Access access, boolean lock) {
        return !jdbc.query("""
                SELECT id FROM sager_health_custody WHERE resident_id=? AND source_author_account_id=?
                  AND recipient_grant_id=? AND recipient_care_assignment_id=? AND ended_at IS NULL
                """ + (lock ? " FOR SHARE" : ""), (row, index) -> uuid(row, "id"),
                note.residentId(), note.authorAccountId(), access.grant().id(), access.assignment().id()).isEmpty();
    }

    List<Share> shares(UUID noteId) {
        return jdbc.query("""
                SELECT s.*,a.display_name AS recipient_name,g.profession
                FROM sager_health_share s JOIN sager_health_grant g ON g.id=s.recipient_grant_id
                JOIN sager_local_account a ON a.id=g.account_id WHERE s.note_id=?
                ORDER BY s.created_at DESC,s.id
                """, this::share, noteId);
    }

    UUID insertShare(NoteRow note, Grant recipient, Assignment assignment, UUID actorId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_health_share
                  (id,note_id,resident_id,recipient_grant_id,recipient_care_assignment_id,created_by)
                VALUES (?,?,?,?,?,?)
                """, id, note.id(), note.residentId(), recipient.id(), assignment.id(), actorId);
        return id;
    }

    Optional<Share> share(UUID id, UUID noteId, boolean lock) {
        return one("""
                SELECT s.*,a.display_name AS recipient_name,g.profession FROM sager_health_share s
                JOIN sager_health_grant g ON g.id=s.recipient_grant_id
                JOIN sager_local_account a ON a.id=g.account_id WHERE s.id=? AND s.note_id=?
                """ + (lock ? " FOR UPDATE OF s" : ""), this::share, id, noteId);
    }

    boolean endShare(UUID id, long version) {
        return jdbc.update("UPDATE sager_health_share SET ended_at=clock_timestamp(),version=version+1 "
                + "WHERE id=? AND version=? AND ended_at IS NULL", id, version) == 1;
    }

    Page<Revision> revisions(UUID noteId, int limit, Long cursor) {
        List<Object> args = new ArrayList<>(List.of(noteId));
        return sequencePage("SELECT * FROM sager_health_revision WHERE note_id=?",
                "SELECT COUNT(*) FROM sager_health_revision WHERE note_id=?", args, "version",
                cursor, limit, this::revision, Revision::version);
    }

    List<Revision> allRevisions(UUID noteId) {
        return jdbc.query("SELECT * FROM sager_health_revision WHERE note_id=? ORDER BY version DESC",
                this::revision, noteId);
    }

    List<Category> sourceCategories(UUID residentId, UUID sourceAccountId) {
        return jdbc.query("SELECT DISTINCT category FROM sager_health_note WHERE resident_id=? "
                + "AND author_account_id=?", (row, index) -> Category.valueOf(row.getString("category")),
                residentId, sourceAccountId);
    }

    Optional<Custody> custody(UUID id, boolean lock) {
        return one(CUSTODIES + " WHERE c.id=?" + (lock ? " FOR UPDATE OF c" : ""),
                this::custody, id);
    }

    Custody insertCustody(UUID residentId, UUID sourceAccountId, Grant recipient,
            Assignment assignment, UUID actorId, String reason) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_health_custody (id,resident_id,source_author_account_id,
                  recipient_grant_id,recipient_care_assignment_id,created_by,reason) VALUES (?,?,?,?,?,?,?)
                """, id, residentId, sourceAccountId, recipient.id(), assignment.id(), actorId, reason);
        return custody(id, false).orElseThrow();
    }

    boolean endCustody(UUID id, long version, String reason) {
        return jdbc.update("UPDATE sager_health_custody SET ended_at=clock_timestamp(),end_reason=?,"
                + "version=version+1 WHERE id=? AND version=? AND ended_at IS NULL",
                reason, id, version) == 1;
    }

    Page<Custody> custodies(UUID residentId, int limit, Long cursor) {
        String where = residentId == null ? " WHERE TRUE" : " WHERE c.resident_id = ?";
        List<Object> args = residentId == null ? new ArrayList<>() : new ArrayList<>(List.of(residentId));
        return sequencePage(CUSTODIES + where, "SELECT COUNT(*) FROM sager_health_custody c" + where,
                args, "c.sequence", cursor, limit, this::custody, Custody::sequence);
    }

    private <T> Page<T> sequencePage(String sql, String countSql, List<Object> args, String sequenceColumn,
            Long cursor, int limit, RowMapper<T> mapper, Function<T, Long> key) {
        long count = count(countSql, args);
        List<Object> pagedArgs = new ArrayList<>(args);
        if (cursor != null) { sql += " AND " + sequenceColumn + " < ?"; pagedArgs.add(cursor); }
        sql += " ORDER BY " + sequenceColumn + " DESC LIMIT ?"; pagedArgs.add(limit + 1);
        List<T> items = jdbc.query(sql, mapper, pagedArgs.toArray());
        boolean more = items.size() > limit;
        if (more) items = items.subList(0, limit);
        return new Page<>(items, more ? key.apply(items.getLast()) : null, count);
    }

    private long count(String sql, List<Object> args) {
        return jdbc.queryForObject(sql, Long.class, args.toArray());
    }

    private <T> Optional<T> one(String sql, RowMapper<T> mapper, Object... args) {
        return jdbc.query(sql, mapper, args).stream().findFirst();
    }

    private Grant grant(ResultSet row, int index) throws SQLException {
        return new Grant(uuid(row, "id"), row.getLong("sequence"), uuid(row, "account_id"),
                row.getString("account_name"), Profession.valueOf(row.getString("profession")),
                row.getString("registration_number"), row.getString("registration_region"),
                uuid(row, "verified_by"), instant(row, "verified_at"), row.getString("verification_reason"),
                instant(row, "started_at"), instant(row, "ended_at"), row.getLong("version"));
    }

    private Assignment assignment(ResultSet row, int index) throws SQLException {
        return new Assignment(uuid(row, "id"), row.getLong("sequence"), uuid(row, "resident_id"),
                row.getString("resident_name"), uuid(row, "professional_grant_id"), uuid(row, "account_id"),
                row.getString("account_name"), Profession.valueOf(row.getString("profession")),
                instant(row, "started_at"), instant(row, "ended_at"), uuid(row, "created_by"),
                row.getString("reason"), row.getLong("version"));
    }

    private Custody custody(ResultSet row, int index) throws SQLException {
        return new Custody(uuid(row, "id"), row.getLong("sequence"), uuid(row, "resident_id"),
                uuid(row, "source_author_account_id"), uuid(row, "recipient_grant_id"),
                row.getString("recipient_account_name"), uuid(row, "created_by"),
                instant(row, "created_at"), row.getString("reason"), instant(row, "ended_at"), row.getLong("version"));
    }

    private ResidentHeader mapResident(ResultSet row, int index) throws SQLException {
        Instant last = instant(row, "last_recorded_at");
        return new ResidentHeader(uuid(row, "id"), row.getString("name"), row.getString("enrollment"),
                row.getObject("birth_date", LocalDate.class), last,
                last == null ? null : last.atZone(ZoneOffset.UTC).plusYears(20).toInstant());
    }

    private NoteRow note(ResultSet row, int index) throws SQLException {
        return new NoteRow(uuid(row, "id"), row.getLong("sequence"), uuid(row, "resident_id"),
                Category.valueOf(row.getString("category")), uuid(row, "author_account_id"),
                uuid(row, "author_grant_id"), row.getString("author_name"),
                Profession.valueOf(row.getString("author_profession")), row.getString("author_registration_number"),
                row.getString("author_registration_region"), instant(row, "created_at"), uuid(row, "related_note_id"),
                row.getLong("version"), row.getString("body"), instant(row, "updated_at"));
    }

    private Share share(ResultSet row, int index) throws SQLException {
        return new Share(uuid(row, "id"), uuid(row, "recipient_grant_id"),
                uuid(row, "recipient_care_assignment_id"), row.getString("recipient_name"),
                Profession.valueOf(row.getString("profession")), instant(row, "created_at"),
                instant(row, "ended_at"), row.getLong("version"));
    }

    private Revision revision(ResultSet row, int index) throws SQLException {
        return new Revision(uuid(row, "id"), uuid(row, "note_id"), row.getLong("version"),
                row.getString("body"), row.getString("reason"), instant(row, "recorded_at"), uuid(row, "recorded_by"));
    }

    private UUID uuid(ResultSet row, String column) throws SQLException {
        return row.getObject(column, UUID.class);
    }

    private Instant instant(ResultSet row, String column) throws SQLException {
        OffsetDateTime value = row.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }
}
