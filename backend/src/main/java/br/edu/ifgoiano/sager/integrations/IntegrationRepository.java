package br.edu.ifgoiano.sager.integrations;

import static br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.instant;
import static br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.time;

import br.edu.ifgoiano.sager.documents.StoredFile;
import br.edu.ifgoiano.sager.operations.longexits.LongExit;
import br.edu.ifgoiano.sager.operations.longexits.LongExitGuardians.Guardian;
import br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.Row;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Repository
@Profile({ "local", "production" })
public class IntegrationRepository {
    private final JdbcTemplate jdbc;

    public IntegrationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public BindingData create(Row exit, Guardian guardian, Instant now, boolean enabled) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                """
INSERT INTO sager_signature_binding(id,exit_id,document_version_id,guardian_id,guardian_version,
    guardian_name,guardian_relationship,guardian_phone,provider,stage,environment,status,expires_at,created_at)
VALUES (?,?,?,?,?,?,?,?,'WHATSAPP_GATEWAY','DONE',?,?,?,?)
""",
                id,
                exit.id(),
                exit.documentVersionId(),
                guardian.id(),
                guardian.version(),
                guardian.name(),
                guardian.relationship(),
                guardian.phone(),
                enabled ? "gateway" : "disabled",
                enabled ? "PENDING" : "UNAVAILABLE",
                time(exit.deadline()),
                time(now));
        return binding(id, false).orElseThrow();
    }

    public Optional<BindingData> binding(UUID id, boolean lock) {
        return jdbc
                .query(
                        "SELECT * FROM sager_signature_binding WHERE id=?"
                                + (lock ? " FOR UPDATE" : ""),
                        (r, n) -> binding(r),
                        id)
                .stream()
                .findFirst();
    }

    private BindingData binding(ResultSet r) throws SQLException {
        return new BindingData(
                r.getObject("id", UUID.class),
                r.getObject("exit_id", UUID.class),
                r.getObject("document_version_id", UUID.class),
                r.getObject("guardian_id", UUID.class),
                r.getLong("guardian_version"),
                r.getString("guardian_name"),
                r.getString("guardian_relationship"),
                r.getString("guardian_phone"),
                r.getString("status"),
                instant(r, "expires_at"),
                instant(r, "revoked_at"),
                instant(r, "signed_at"),
                instant(r, "verified_at"),
                r.getObject("verified_by", UUID.class),
                r.getString("evidence_hash"),
                r.getString("failure_code"),
                instant(r, "created_at"),
                r.getLong("version"));
    }

    public List<BindingData> current(Row exit) {
        return jdbc.query(
                "SELECT * FROM sager_signature_binding WHERE exit_id=? AND"
                        + " document_version_id=? ORDER BY created_at DESC,id DESC",
                (r, n) -> binding(r),
                exit.id(),
                exit.documentVersionId());
    }

    /** Open means the current revision of a pending request still waiting for an authorization. */
    public List<BindingData> openForPhones(
            Collection<String> phones, Instant receivedAt, Instant now) {
        return jdbc.query(
                """
SELECT b.* FROM sager_signature_binding b JOIN sager_long_exit e ON e.id=b.exit_id
WHERE e.status='AGUARDANDO_ANALISE' AND e.current_document_version_id=b.document_version_id
    AND b.revoked_at IS NULL AND b.status IN ('PENDING','UNAVAILABLE') AND b.expires_at>?
    AND b.created_at<=? AND b.guardian_phone = ANY(?)
ORDER BY b.created_at,b.id
""",
                ps -> {
                    ps.setObject(1, time(now));
                    ps.setObject(2, time(receivedAt));
                    ps.setArray(3, ps.getConnection().createArrayOf("text", phones.toArray()));
                },
                (r, n) -> binding(r));
    }

    public UUID bindingByMessage(String providerMessageId) {
        return jdbc
                .query(
                        "SELECT binding_id FROM sager_whatsapp_attempt WHERE provider_message_id=?",
                        (r, n) -> r.getObject(1, UUID.class),
                        providerMessageId)
                .stream()
                .findFirst()
                .orElse(null);
    }

    /** Conversations worth asking the gateway about: phones with an authorization still pending. */
    public List<PendingChat> pendingChats(Instant now) {
        return jdbc.query(
                """
SELECT b.guardian_phone,MIN(b.created_at) AS since FROM sager_signature_binding b
JOIN sager_long_exit e ON e.id=b.exit_id
WHERE e.status='AGUARDANDO_ANALISE' AND e.current_document_version_id=b.document_version_id
    AND b.revoked_at IS NULL AND b.status='PENDING' AND b.expires_at>?
GROUP BY b.guardian_phone
""",
                (r, n) -> new PendingChat(r.getString("guardian_phone"), instant(r, "since")),
                time(now));
    }

    /** The name of who checked the file is for the staff; a resident only sees the result. */
    public List<LongExit.Binding> views(
            UUID exitId, boolean whatsappAvailable, Instant now, boolean names) {
        boolean pending =
                Boolean.TRUE.equals(
                        jdbc.queryForObject(
                                "SELECT status='AGUARDANDO_ANALISE' FROM sager_long_exit WHERE"
                                    + " id=?",
                                Boolean.class,
                                exitId));
        return jdbc
                .query(
                        "SELECT * FROM sager_signature_binding WHERE exit_id=? ORDER BY created_at"
                                + " DESC,id DESC",
                        (r, n) -> binding(r),
                        exitId)
                .stream()
                .map(
                        b -> {
                            String status = effectiveStatus(b, now);
                            if (pending
                                    && b.revokedAt() == null
                                    && Set.of("PENDING", "VALID", "EXPIRED").contains(b.status())
                                    && !guardianCurrent(b)) status = "INVALIDATED";
                            return new LongExit.Binding(
                                    b.id(),
                                    b.documentVersionId(),
                                    b.guardianId(),
                                    b.guardianName(),
                                    status,
                                    messageStatus(b.id(), whatsappAvailable),
                                    b.expiresAt(),
                                    b.createdAt(),
                                    b.revokedAt(),
                                    b.signedAt(),
                                    b.verifiedAt(),
                                    b.verifiedBy(),
                                    names ? accountName(b.verifiedBy()) : null,
                                    b.failureCode());
                        })
                .toList();
    }

    public String accountName(UUID id) {
        if (id == null) return null;
        return jdbc
                .query(
                        "SELECT display_name FROM sager_local_account WHERE id=?",
                        (r, n) -> r.getString(1),
                        id)
                .stream()
                .findFirst()
                .orElse(null);
    }

    public String messageStatus(UUID bindingId, boolean enabled) {
        return jdbc
                .query(
                        "SELECT status FROM sager_whatsapp_attempt WHERE binding_id=? ORDER BY"
                                + " created_at DESC,id DESC LIMIT 1",
                        (r, n) -> r.getString(1),
                        bindingId)
                .stream()
                .findFirst()
                .orElseGet(() -> enabled && hasQueuedTask(bindingId) ? "QUEUED" : "UNAVAILABLE");
    }

    // An anchor for a manual attachment has no task: nothing is on its way to the guardian.
    private boolean hasQueuedTask(UUID bindingId) {
        return Boolean.TRUE.equals(
                jdbc.queryForObject(
                        "SELECT EXISTS(SELECT 1 FROM sager_integration_task WHERE binding_id=? AND"
                                + " state IN ('PENDING','RUNNING'))",
                        Boolean.class,
                        bindingId));
    }

    public boolean guardianCurrent(BindingData binding) {
        return Boolean.TRUE.equals(
                jdbc.queryForObject(
                        """
SELECT EXISTS(SELECT 1 FROM sager_guardian g JOIN sager_long_exit e ON e.resident_id=g.resident_id
    WHERE e.id=? AND g.id=? AND g.active AND g.version=? AND g.name=? AND g.relationship=? AND g.phone=?)
""",
                        Boolean.class,
                        binding.exitId(),
                        binding.guardianId(),
                        binding.guardianVersion(),
                        binding.guardianName(),
                        binding.guardianRelationship(),
                        binding.guardianPhone()));
    }

    public List<UUID> invalidate(UUID exitId, UUID excluded, Instant now) {
        return jdbc.query(
                """
UPDATE sager_signature_binding SET status='INVALIDATED',revoked_at=?,version=version+1
WHERE exit_id=? AND (?::uuid IS NULL OR id<>?) AND revoked_at IS NULL RETURNING id
""",
                (r, n) -> r.getObject(1, UUID.class),
                time(now),
                exitId,
                excluded,
                excluded);
    }

    public void cancelPendingTasks(UUID bindingId, Instant now) {
        jdbc.update(
                "UPDATE sager_integration_task SET state='CANCELLED',version=version+1,updated_at=?"
                    + " WHERE binding_id=? AND state IN ('PENDING','RUNNING')",
                time(now),
                bindingId);
    }

    /**
     * When a resident's request may reach the guardian: ten minutes after the previous document and
     * at most three in 24 hours, the limits of a supervisor's resend. Later edits replace the task
     * still waiting, so the guardian receives only the latest revision.
     */
    public Instant nextResidentSend(UUID residentId, Instant now) {
        List<Instant> sends =
                jdbc.query(
                        """
SELECT a.created_at AS at FROM sager_whatsapp_attempt a
JOIN sager_signature_binding b ON b.id=a.binding_id JOIN sager_long_exit e ON e.id=b.exit_id
WHERE e.resident_id=? AND a.status<>'FAILED' AND a.created_at>?
    AND NOT EXISTS (SELECT 1 FROM sager_long_exit_resend r WHERE r.binding_id=b.id)
UNION ALL
SELECT t.next_attempt_at FROM sager_integration_task t
JOIN sager_signature_binding b ON b.id=t.binding_id JOIN sager_long_exit e ON e.id=b.exit_id
WHERE e.resident_id=? AND t.state IN ('PENDING','RUNNING')
    AND NOT EXISTS (SELECT 1 FROM sager_long_exit_resend r WHERE r.binding_id=b.id)
ORDER BY 1 DESC
""",
                        (r, n) -> instant(r, "at"),
                        residentId,
                        time(now.minusSeconds(86400)),
                        residentId);
        Instant next = now;
        if (!sends.isEmpty() && next.isBefore(sends.getFirst().plusSeconds(600)))
            next = sends.getFirst().plusSeconds(600);
        if (sends.size() >= 3 && next.isBefore(sends.get(2).plusSeconds(86400)))
            next = sends.get(2).plusSeconds(86400);
        return next;
    }

    public UUID enqueue(UUID bindingId, String type, String key, Instant now, Instant sendAt) {
        UUID id = UUID.randomUUID();
        return jdbc
                .query(
                        """
INSERT INTO sager_integration_task(id,binding_id,type,idempotency_key,next_attempt_at,created_at,updated_at)
VALUES (?,?,?,?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id
""",
                        (r, n) -> r.getObject(1, UUID.class),
                        id,
                        bindingId,
                        type,
                        key,
                        time(sendAt),
                        time(now),
                        time(now))
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void resend(UUID exitId, UUID bindingId, UUID actor, String reason, Instant now) {
        jdbc.update(
                "INSERT INTO"
                    + " sager_long_exit_resend(id,exit_id,binding_id,requested_at,actor_id,reason)"
                    + " VALUES (?,?,?,?,?,?)",
                UUID.randomUUID(),
                exitId,
                bindingId,
                time(now),
                actor,
                reason);
    }

    public int recentResends(UUID exitId, Instant now) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM sager_long_exit_resend WHERE exit_id=? AND requested_at>?",
                Integer.class,
                exitId,
                time(now.minusSeconds(86400)));
    }

    public Instant lastResend(UUID exitId) {
        return jdbc
                .query(
                        "SELECT created_at FROM sager_signature_binding WHERE exit_id=? ORDER BY"
                                + " created_at DESC LIMIT 1",
                        (r, n) -> instant(r, "created_at"),
                        exitId)
                .stream()
                .findFirst()
                .orElse(null);
    }

    public Instant oldestRecentResend(UUID exitId, Instant now) {
        return jdbc
                .query(
                        "SELECT requested_at FROM sager_long_exit_resend WHERE exit_id=? AND"
                                + " requested_at>? ORDER BY requested_at LIMIT 1",
                        (r, n) -> instant(r, "requested_at"),
                        exitId,
                        time(now.minusSeconds(86400)))
                .stream()
                .findFirst()
                .orElse(null);
    }

    /** Returns null when this message already has an active link. */
    public UUID insertAuthorizationFile(
            BindingData binding,
            UUID messageId,
            String origin,
            StoredFile file,
            String mediaType,
            String senderPhone,
            Instant receivedAt,
            Instant now) {
        return jdbc
                .query(
                        """
INSERT INTO sager_guardian_authorization_file(id,exit_id,document_version_id,binding_id,message_id,origin,
    file_id,file_hash,file_size,media_type,sender_phone,received_at,created_at)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING id
""",
                        (r, n) -> r.getObject(1, UUID.class),
                        UUID.randomUUID(),
                        binding.exitId(),
                        binding.documentVersionId(),
                        binding.id(),
                        messageId,
                        origin,
                        file.id(),
                        file.sha256(),
                        file.size(),
                        mediaType,
                        senderPhone,
                        time(receivedAt),
                        time(now))
                .stream()
                .findFirst()
                .orElse(null);
    }

    public Optional<AuthorizationFile> authorizationFile(UUID id, boolean lock) {
        return jdbc
                .query(
                        FILE_SELECT + " WHERE f.id=?" + (lock ? " FOR UPDATE OF f" : ""),
                        (r, n) -> authorizationFile(r),
                        id)
                .stream()
                .findFirst();
    }

    public List<AuthorizationFile> authorizationFiles(UUID exitId) {
        return jdbc.query(
                FILE_SELECT + " WHERE f.exit_id=? ORDER BY f.created_at DESC,f.id DESC",
                (r, n) -> authorizationFile(r),
                exitId);
    }

    public void decideAuthorizationFile(
            AuthorizationFile file, String state, UUID actor, String reason, Instant now) {
        jdbc.update(
                """
UPDATE sager_guardian_authorization_file SET state=?,decided_by=?,decided_at=?,decision_reason=?,version=version+1
WHERE id=? AND state='CANDIDATE'
""",
                state,
                actor,
                time(now),
                reason,
                file.id());
    }

    /** Promotion is a single write: the database forbids changing an accepted evidence later. */
    public boolean promote(AuthorizationFile file) {
        return jdbc.update(
                        """
UPDATE sager_document_version SET signed_file_id=?,signed_hash=?,signed_size=?,signed_state='STORED',signed_media_type=?
WHERE id=? AND signed_state='MISSING'
""",
                        file.file().id(),
                        file.file().sha256(),
                        file.file().size(),
                        file.mediaType(),
                        file.documentVersionId())
                == 1;
    }

    public void verify(BindingData binding, AuthorizationFile file, UUID actor, Instant now) {
        // A file answering this revision may predate its last resend; the file keeps the real time.
        Instant signed =
                file.receivedAt().isBefore(binding.createdAt())
                        ? binding.createdAt()
                        : file.receivedAt();
        jdbc.update(
                """
UPDATE sager_signature_binding SET status='VALID',signed_at=?,verified_at=?,verified_by=?,evidence_hash=?,
    failure_code=NULL,version=version+1 WHERE id=?
""",
                time(signed),
                time(now),
                actor,
                file.file().sha256(),
                binding.id());
    }

    public Optional<StoredMessage> storedMessage(UUID id) {
        return jdbc
                .query(
                        MESSAGE_SELECT
                                + " WHERE m.id=? AND m.media_state='STORED' AND m.direction='IN'"
                                + " AND m.media_mime_type NOT LIKE 'audio/%'",
                        (r, n) -> storedMessage(r),
                        id)
                .stream()
                .findFirst();
    }

    /** Received files without an active link, including the ones that could not be kept. */
    public List<StoredMessage> unlinkedMessages(Instant since) {
        return jdbc.query(
                MESSAGE_SELECT
                        + """
 WHERE m.direction='IN' AND m.media_state IN ('STORED','FAILED') AND m.sent_at>=?
    AND COALESCE(m.media_mime_type,'') NOT LIKE 'audio/%'
    AND NOT EXISTS(SELECT 1 FROM sager_guardian_authorization_file f WHERE f.message_id=m.id AND f.state<>'REFUSED')
ORDER BY m.sent_at DESC,m.id LIMIT 50
""",
                (r, n) -> storedMessage(r),
                time(since));
    }

    private StoredMessage storedMessage(ResultSet r) throws SQLException {
        UUID file = r.getObject("media_file_id", UUID.class);
        return new StoredMessage(
                r.getObject("id", UUID.class),
                r.getString("sender_phone"),
                r.getString("media_state"),
                r.getString("media_failure_code"),
                r.getString("media_mime_type"),
                file == null
                        ? null
                        : new StoredFile(
                                file,
                                r.getString("media_hash"),
                                r.getLong("media_size"),
                                StoredFile.STORED),
                instant(r, "sent_at"));
    }

    private AuthorizationFile authorizationFile(ResultSet r) throws SQLException {
        return new AuthorizationFile(
                r.getObject("id", UUID.class),
                r.getObject("exit_id", UUID.class),
                r.getObject("document_version_id", UUID.class),
                r.getObject("binding_id", UUID.class),
                r.getString("guardian_phone"),
                r.getString("origin"),
                r.getString("state"),
                new StoredFile(
                        r.getObject("file_id", UUID.class),
                        r.getString("file_hash"),
                        r.getLong("file_size"),
                        StoredFile.STORED),
                r.getString("media_type"),
                r.getString("sender_phone"),
                instant(r, "received_at"),
                r.getObject("decided_by", UUID.class),
                instant(r, "decided_at"),
                r.getString("decision_reason"),
                r.getLong("version"));
    }

    public static String effectiveStatus(BindingData b, Instant now) {
        return "PENDING".equals(b.status()) && !now.isBefore(b.expiresAt())
                ? "EXPIRED"
                : b.status();
    }

    private static final String FILE_SELECT =
            "SELECT f.*,b.guardian_phone FROM sager_guardian_authorization_file f"
                    + " JOIN sager_signature_binding b ON b.id=f.binding_id";
    private static final String MESSAGE_SELECT =
            "SELECT m.id,m.sender_phone,m.media_state,m.media_failure_code,m.media_mime_type,"
                    + "m.media_file_id,m.media_hash,m.media_size,m.sent_at"
                    + " FROM sager_whatsapp_message m";

    public record BindingData(
            UUID id,
            UUID exitId,
            UUID documentVersionId,
            UUID guardianId,
            long guardianVersion,
            String guardianName,
            String guardianRelationship,
            String guardianPhone,
            String status,
            Instant expiresAt,
            Instant revokedAt,
            Instant signedAt,
            Instant verifiedAt,
            UUID verifiedBy,
            String evidenceHash,
            String failureCode,
            Instant createdAt,
            long version) {}

    public record AuthorizationFile(
            UUID id,
            UUID exitId,
            UUID documentVersionId,
            UUID bindingId,
            String guardianPhone,
            String origin,
            String state,
            StoredFile file,
            String mediaType,
            String senderPhone,
            Instant receivedAt,
            UUID decidedBy,
            Instant decidedAt,
            String decisionReason,
            long version) {}

    public record StoredMessage(
            UUID id,
            String senderPhone,
            String mediaState,
            String mediaFailureCode,
            String mediaType,
            StoredFile file,
            Instant receivedAt) {}

    public record PendingChat(String phone, Instant since) {}
}
