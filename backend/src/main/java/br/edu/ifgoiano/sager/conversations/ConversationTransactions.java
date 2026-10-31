package br.edu.ifgoiano.sager.conversations;

import static br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.time;

import br.edu.ifgoiano.sager.audit.AuditAction;
import br.edu.ifgoiano.sager.audit.AuditResource;
import br.edu.ifgoiano.sager.audit.AuditService;
import br.edu.ifgoiano.sager.conversations.ConversationRepository.Summary;
import br.edu.ifgoiano.sager.documents.StoredFile;
import br.edu.ifgoiano.sager.integrations.ProviderFailure;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.UUID;

/** Each method commits on its own, so gateway calls always run outside a database transaction. */
@Service
@Profile({ "local", "production" })
public class ConversationTransactions {
    private static final String PROVIDER = "WHATSAPP_GATEWAY";
    private static final int MAX_ATTEMPTS = 5;
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final Clock clock;

    public ConversationTransactions(JdbcTemplate jdbc, AuditService audit, Clock clock) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.clock = clock;
    }

    /** The conversation starts empty and sorted as recent; no message leaves because of it. */
    @Transactional
    public UUID open(String session, String chat, String phone) {
        Instant now = now();
        UUID id = UUID.randomUUID();
        var created =
                jdbc.query(
                        """
INSERT INTO sager_whatsapp_conversation(id,provider,session,chat_id,phone,lid,last_message_at,created_at,updated_at)
VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,session,chat_id) DO NOTHING RETURNING id
""",
                        (r, n) -> r.getObject(1, UUID.class),
                        id,
                        PROVIDER,
                        session,
                        chat,
                        phone,
                        chat.endsWith("@lid") ? chat : null,
                        time(now),
                        time(now),
                        time(now));
        if (created.isEmpty())
            return jdbc.queryForObject(
                    "SELECT id FROM sager_whatsapp_conversation WHERE provider=? AND session=?"
                            + " AND chat_id=?",
                    UUID.class,
                    PROVIDER,
                    session,
                    chat);
        audit.record(
                AuditResource.WHATSAPP_CONVERSATION,
                id,
                AuditAction.CREATE,
                0,
                Set.of("guardianId", "chatId"));
        return id;
    }

    /** Returns null when a concurrent request with the same key got there first. */
    @Transactional
    public UUID enqueue(
            Summary conversation,
            UUID actor,
            String key,
            String body,
            StoredFile file,
            String mediaType,
            String filename) {
        Instant now = now();
        UUID id = UUID.randomUUID();
        var created =
                jdbc.query(
                        """
INSERT INTO sager_whatsapp_message(id,conversation_id,provider,session,direction,origin,body,media_state,
    media_mime_type,media_filename,media_file_id,media_hash,media_size,sent_at,received_at,delivery_status,
    created_by,idempotency_key)
VALUES (?,?,?,?,'OUT','SUPERVISOR',?,?,?,?,?,?,?,?,?,'QUEUED',?,?)
ON CONFLICT (created_by,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING id
""",
                        (r, n) -> r.getObject(1, UUID.class),
                        id,
                        conversation.id(),
                        conversation.provider(),
                        conversation.session(),
                        body,
                        file == null ? "NONE" : "STORED",
                        mediaType,
                        filename,
                        file == null ? null : file.id(),
                        file == null ? null : file.sha256(),
                        file == null ? null : file.size(),
                        time(now),
                        time(now),
                        actor,
                        key);
        if (created.isEmpty()) return null;
        jdbc.update(
                "INSERT INTO sager_whatsapp_job(id,message_id,type,next_attempt_at,created_at,updated_at)"
                        + " VALUES (?,?,'SEND',?,?,?)",
                UUID.randomUUID(),
                id,
                time(now),
                time(now),
                time(now));
        jdbc.update(
                "UPDATE sager_whatsapp_conversation SET last_message_at=GREATEST(last_message_at,?),"
                        + "updated_at=?,version=version+1 WHERE id=?",
                time(now),
                time(now),
                conversation.id());
        audit.record(
                AuditResource.WHATSAPP_MESSAGE,
                id,
                AuditAction.CREATE,
                0,
                file == null
                        ? Set.of("conversationId", "deliveryStatus")
                        : Set.of("conversationId", "deliveryStatus", "mediaType", "fileHash"));
        return id;
    }

    @Transactional
    public void auditSession(UUID resource, AuditAction action, String field) {
        audit.record(AuditResource.WHATSAPP_SESSION, resource, action, 0, Set.of(field));
    }

    /**
     * RUNNING means the request may have reached the gateway: an expired lease comes back marked as
     * interrupted, never as a new attempt.
     */
    @Transactional
    public SendJob claimSend() {
        Instant now = now();
        Claimed due =
                jdbc
                        .query(
                                """
SELECT j.id,j.state,j.attempt_count,m.id AS message_id,m.body,m.media_file_id,m.media_hash,m.media_size,
    m.media_mime_type,m.media_filename,c.chat_id
FROM sager_whatsapp_job j JOIN sager_whatsapp_message m ON m.id=j.message_id
JOIN sager_whatsapp_conversation c ON c.id=m.conversation_id
WHERE j.type='SEND' AND ((j.state='PENDING' AND j.next_attempt_at<=?) OR (j.state='RUNNING' AND j.lease_until<=?))
ORDER BY j.next_attempt_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED
""",
                                (r, n) -> {
                                    UUID file = r.getObject("media_file_id", UUID.class);
                                    return new Claimed(
                                            r.getString("state"),
                                            new SendJob(
                                                    r.getObject("id", UUID.class),
                                                    UUID.randomUUID(),
                                                    r.getObject("message_id", UUID.class),
                                                    r.getInt("attempt_count"),
                                                    false,
                                                    r.getString("chat_id"),
                                                    r.getString("body"),
                                                    file == null
                                                            ? null
                                                            : new StoredFile(
                                                                    file,
                                                                    r.getString("media_hash"),
                                                                    r.getLong("media_size"),
                                                                    StoredFile.STORED),
                                                    r.getString("media_mime_type"),
                                                    r.getString("media_filename")));
                                },
                                time(now),
                                time(now))
                        .stream()
                        .findFirst()
                        .orElse(null);
        if (due == null) return null;
        SendJob job = due.job();
        boolean interrupted = "RUNNING".equals(due.state());
        int attempts = interrupted ? job.attempts() : Math.min(MAX_ATTEMPTS, job.attempts() + 1);
        jdbc.update(
                """
UPDATE sager_whatsapp_job SET state='RUNNING',attempt_count=?,lease_until=?,lease_token=?,version=version+1,updated_at=?
WHERE id=?
""",
                attempts,
                time(now.plusSeconds(120)),
                job.leaseToken(),
                time(now),
                job.id());
        return new SendJob(
                job.id(),
                job.leaseToken(),
                job.messageId(),
                attempts,
                interrupted,
                job.chatId(),
                job.body(),
                job.file(),
                job.mediaType(),
                job.filename());
    }

    @Transactional
    public void sent(SendJob job, String providerMessageId) {
        if (!finish(job, "SUCCEEDED", null, now())) return;
        jdbc.update(
                """
UPDATE sager_whatsapp_message SET provider_message_id=?,delivery_status='SENT',delivery_failure_code=NULL,version=version+1
WHERE id=? AND delivery_status='QUEUED'
""",
                providerMessageId,
                job.messageId());
        audited(job.messageId(), Set.of("deliveryStatus", "providerMessageId"));
    }

    /** Only a failure proven to precede delivery may retry; an ambiguous one waits for a person. */
    @Transactional
    public void sendFailed(SendJob job, ProviderFailure failure) {
        Instant now = now();
        boolean retry =
                failure.kind() == ProviderFailure.Kind.RETRYABLE && job.attempts() < MAX_ATTEMPTS;
        if (retry) {
            long wait =
                    switch (job.attempts()) {
                        case 1 -> 60;
                        case 2 -> 300;
                        default -> 900;
                    };
            jdbc.update(
                    """
UPDATE sager_whatsapp_job SET state='PENDING',lease_until=NULL,lease_token=NULL,next_attempt_at=?,failure_code=?,
    version=version+1,updated_at=? WHERE id=? AND state='RUNNING' AND lease_token=?
""",
                    time(now.plusSeconds(wait)),
                    failure.code(),
                    time(now),
                    job.id(),
                    job.leaseToken());
            return;
        }
        String state = failure.kind() == ProviderFailure.Kind.UNCERTAIN ? "UNCERTAIN" : "FAILED";
        if (!finish(job, state, failure.code(), now)) return;
        jdbc.update(
                "UPDATE sager_whatsapp_message SET delivery_status=?,delivery_failure_code=?,"
                        + "version=version+1 WHERE id=? AND delivery_status='QUEUED'",
                state,
                failure.code(),
                job.messageId());
        audited(job.messageId(), Set.of("deliveryStatus", "failureCode"));
    }

    private boolean finish(SendJob job, String state, String code, Instant now) {
        return jdbc.update(
                        """
UPDATE sager_whatsapp_job SET state=?,lease_until=NULL,lease_token=NULL,failure_code=?,version=version+1,updated_at=?
WHERE id=? AND state='RUNNING' AND lease_token=?
""",
                        state,
                        code,
                        time(now),
                        job.id(),
                        job.leaseToken())
                == 1;
    }

    private void audited(UUID message, Set<String> fields) {
        Long version =
                jdbc.queryForObject(
                        "SELECT version FROM sager_whatsapp_message WHERE id=?", Long.class, message);
        audit.recordSystem(
                message, AuditResource.WHATSAPP_MESSAGE, message, AuditAction.UPDATE, version, fields);
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    private record Claimed(String state, SendJob job) {}

    public record SendJob(
            UUID id,
            UUID leaseToken,
            UUID messageId,
            int attempts,
            boolean interrupted,
            String chatId,
            String body,
            StoredFile file,
            String mediaType,
            String filename) {}
}
