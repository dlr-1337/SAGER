package br.edu.ifgoiano.sager.integrations;

import static br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.instant;
import static br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.time;

import br.edu.ifgoiano.sager.audit.AuditAction;
import br.edu.ifgoiano.sager.audit.AuditResource;
import br.edu.ifgoiano.sager.audit.AuditService;
import br.edu.ifgoiano.sager.documents.StoredFile;
import br.edu.ifgoiano.sager.integrations.IntegrationRepository.BindingData;
import br.edu.ifgoiano.sager.integrations.WhatsAppGateway.InboundMessage;
import br.edu.ifgoiano.sager.management.guardians.BrazilianPhone;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Received messages, media jobs and session state. External I/O stays outside these methods. */
@Service
@Profile({ "local", "production" })
public class WhatsAppInbound {
    private static final String PROVIDER = "WHATSAPP_GATEWAY";
    private final JdbcTemplate jdbc;
    private final IntegrationRepository repository;
    private final IntegrationProperties properties;
    private final AuditService audit;
    private final Clock clock;

    public WhatsAppInbound(
            JdbcTemplate jdbc,
            IntegrationRepository repository,
            IntegrationProperties properties,
            AuditService audit,
            Clock clock) {
        this.jdbc = jdbc;
        this.repository = repository;
        this.properties = properties;
        this.audit = audit;
        this.clock = clock;
    }

    /** Provider, session and message id are the key, so retries and reconciliation converge. */
    @Transactional
    public void record(InboundMessage m, String origin) {
        // The reconciliation reads the same window every round: what is known writes nothing.
        if (Boolean.TRUE.equals(
                jdbc.queryForObject(
                        "SELECT EXISTS(SELECT 1 FROM sager_whatsapp_message WHERE provider=? AND"
                                + " session=? AND provider_message_id=?)",
                        Boolean.class,
                        PROVIDER,
                        m.session(),
                        m.messageId()))) return;
        Instant now = now(), sent = m.sentAt().isAfter(now) ? now : m.sentAt();
        // A contact may answer through its LID after a merge; it stays in the same conversation.
        String chat =
                m.senderLid() == null
                        ? m.chatId()
                        : jdbc
                                .query(
                                        "SELECT chat_id FROM sager_whatsapp_conversation WHERE"
                                                + " provider=? AND session=? AND lid=?",
                                        (r, n) -> r.getString(1),
                                        PROVIDER,
                                        m.session(),
                                        m.senderLid())
                                .stream()
                                .findFirst()
                                .orElse(m.chatId());
        UUID conversation = conversation(m.session(), chat, m.senderPhone(), m.senderLid(), sent, now);
        String mediaState =
                !m.hasMedia() ? "NONE" : m.mediaFailure() != null ? "FAILED" : "PENDING";
        UUID message =
                jdbc
                        .query(
                                """
INSERT INTO sager_whatsapp_message(id,conversation_id,provider,session,provider_message_id,direction,origin,
    sender_phone,sender_lid,body,quoted_message_id,media_state,media_path,media_mime_type,media_filename,
    media_failure_code,sent_at,received_at,delivery_status)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(provider,session,provider_message_id) DO NOTHING RETURNING id
""",
                                (r, n) -> r.getObject(1, UUID.class),
                                UUID.randomUUID(),
                                conversation,
                                PROVIDER,
                                m.session(),
                                m.messageId(),
                                m.fromMe() ? "OUT" : "IN",
                                m.fromMe() ? "DEVICE" : origin,
                                m.fromMe() ? null : m.senderPhone(),
                                m.fromMe() ? null : m.senderLid(),
                                m.body(),
                                m.quotedMessageId(),
                                mediaState,
                                m.mediaPath(),
                                m.mediaMimeType(),
                                m.mediaFilename(),
                                m.mediaFailure(),
                                time(sent),
                                time(now),
                                m.fromMe() ? "SENT" : null)
                        .stream()
                        .findFirst()
                        .orElse(null);
        if (message != null && "PENDING".equals(mediaState))
            jdbc.update(
                    """
INSERT INTO sager_whatsapp_job(id,message_id,type,next_attempt_at,created_at,updated_at)
VALUES (?,?,'DOWNLOAD',?,?,?)
""",
                    UUID.randomUUID(),
                    message,
                    time(now),
                    time(now),
                    time(now));
    }

    /** The authorization PDF joins the guardian's history as sent; with no job it never leaves twice. */
    @Transactional
    public void documentSent(
            String chat, String phone, String messageId, String body, String filename, StoredFile file) {
        Instant now = now();
        String session = properties.whatsappSession();
        // The guardian may already talk through a LID or the ninth-digit variant of this chat.
        String known =
                jdbc
                        .query(
                                """
SELECT chat_id FROM sager_whatsapp_conversation WHERE provider=? AND session=? AND phone = ANY(string_to_array(?,','))
ORDER BY last_message_at DESC,id DESC LIMIT 1
""",
                                (r, n) -> r.getString(1),
                                PROVIDER,
                                session,
                                String.join(",", BrazilianPhone.variants(phone)))
                        .stream()
                        .findFirst()
                        .orElse(chat);
        String resolved = WebhookEventParser.phone(chat);
        UUID conversation =
                conversation(
                        session,
                        known,
                        resolved == null ? phone : resolved,
                        chat.endsWith("@lid") ? chat : null,
                        now,
                        now);
        // A confirmation may arrive between the send being recorded and this message existing.
        UUID message =
                jdbc
                        .query(
                                """
INSERT INTO sager_whatsapp_message(id,conversation_id,provider,session,provider_message_id,direction,origin,body,
    media_state,media_mime_type,media_filename,media_file_id,media_hash,media_size,sent_at,received_at,delivery_status)
VALUES (?,?,?,?,?,'OUT','AUTHORIZATION',?,'STORED','application/pdf',?,?,?,?,?,?,
    COALESCE((SELECT status FROM sager_whatsapp_attempt
        WHERE provider_message_id=? AND status IN ('DELIVERED','READ') LIMIT 1),'SENT'))
ON CONFLICT(provider,session,provider_message_id) DO NOTHING RETURNING id
""",
                                (r, n) -> r.getObject(1, UUID.class),
                                UUID.randomUUID(),
                                conversation,
                                PROVIDER,
                                session,
                                messageId,
                                body,
                                filename,
                                file.id(),
                                file.sha256(),
                                file.size(),
                                time(now),
                                time(now),
                                messageId)
                        .stream()
                        .findFirst()
                        .orElse(null);
        if (message != null)
            audit.recordSystem(
                    message,
                    AuditResource.WHATSAPP_MESSAGE,
                    message,
                    AuditAction.CREATE,
                    0,
                    Set.of("conversationId", "deliveryStatus", "mediaType", "fileHash"));
    }

    /** Random, so a day with more active chats than one round holds cannot starve any of them. */
    public List<String> activeChats(Instant since, int limit) {
        return jdbc.query(
                """
SELECT chat_id FROM sager_whatsapp_conversation WHERE provider=? AND session=? AND last_message_at>=?
ORDER BY random() LIMIT ?
""",
                (r, n) -> r.getString(1),
                PROVIDER,
                properties.whatsappSession(),
                time(since),
                limit);
    }

    private UUID conversation(
            String session, String chat, String phone, String lid, Instant at, Instant now) {
        return jdbc.queryForObject(
                """
INSERT INTO sager_whatsapp_conversation(id,provider,session,chat_id,phone,lid,last_message_at,created_at,updated_at)
VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,session,chat_id) DO UPDATE SET
    last_message_at=GREATEST(sager_whatsapp_conversation.last_message_at,EXCLUDED.last_message_at),
    updated_at=EXCLUDED.updated_at,version=sager_whatsapp_conversation.version+1
RETURNING id
""",
                UUID.class,
                UUID.randomUUID(),
                PROVIDER,
                session,
                chat,
                phone,
                lid,
                time(at),
                time(now),
                time(now));
    }

    @Transactional
    public Job claimJob() {
        Instant now = now();
        Job due =
                jdbc
                        .query(
                                """
SELECT j.id,j.message_id,j.attempt_count,m.media_path,m.media_mime_type,m.sender_phone,m.sender_lid FROM sager_whatsapp_job j
JOIN sager_whatsapp_message m ON m.id=j.message_id
WHERE j.type='DOWNLOAD' AND ((j.state='PENDING' AND j.next_attempt_at<=?) OR (j.state='RUNNING' AND j.lease_until<=?))
ORDER BY j.next_attempt_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED
""",
                                (r, n) ->
                                        new Job(
                                                r.getObject("id", UUID.class),
                                                UUID.randomUUID(),
                                                r.getObject("message_id", UUID.class),
                                                r.getInt("attempt_count"),
                                                r.getString("media_path"),
                                                r.getString("media_mime_type"),
                                                r.getString("sender_phone"),
                                                r.getString("sender_lid")),
                                time(now),
                                time(now))
                        .stream()
                        .findFirst()
                        .orElse(null);
        if (due == null) return null;
        jdbc.update(
                """
UPDATE sager_whatsapp_job SET state='RUNNING',attempt_count=LEAST(5,attempt_count+1),lease_until=?,lease_token=?,
    version=version+1,updated_at=? WHERE id=?
""",
                time(now.plusSeconds(120)),
                due.leaseToken(),
                time(now),
                due.id());
        return due;
    }

    /** Stores the evidence metadata and links it only when the correlation is unambiguous. */
    @Transactional
    public void mediaStored(Job job, StoredFile file, String mediaType, String senderPhone) {
        Instant now = now();
        if (jdbc.update(
                        """
UPDATE sager_whatsapp_job SET state='SUCCEEDED',lease_until=NULL,lease_token=NULL,failure_code=NULL,version=version+1,
    updated_at=? WHERE id=? AND state='RUNNING' AND lease_token=?
""",
                        time(now),
                        job.id(),
                        job.leaseToken())
                == 0) return;
        jdbc.update(
                """
UPDATE sager_whatsapp_message SET media_state='STORED',media_file_id=?,media_hash=?,media_size=?,media_mime_type=?,
    sender_phone=?,version=version+1 WHERE id=?
""",
                file.id(),
                file.sha256(),
                file.size(),
                mediaType,
                senderPhone,
                job.messageId());
        if (senderPhone == null) return;
        jdbc.update(
                """
UPDATE sager_whatsapp_conversation SET phone=?,updated_at=?,version=version+1
WHERE id=(SELECT conversation_id FROM sager_whatsapp_message WHERE id=?) AND phone IS NULL
""",
                senderPhone,
                time(now),
                job.messageId());
        if (!AuthorizationFileType.accepts(mediaType)) return;
        Quote received =
                jdbc.queryForObject(
                        "SELECT sent_at,quoted_message_id FROM sager_whatsapp_message WHERE id=?",
                        (r, n) ->
                                new Quote(instant(r, "sent_at"), r.getString("quoted_message_id")),
                        job.messageId());
        BindingData binding =
                correlate(senderPhone, received.quoted(), received.sentAt(), now);
        if (binding == null) return;
        UUID created =
                repository.insertAuthorizationFile(
                        binding,
                        job.messageId(),
                        "WHATSAPP",
                        file,
                        mediaType,
                        senderPhone,
                        received.sentAt(),
                        now);
        if (created != null)
            audit.recordSystem(
                    job.messageId(),
                    AuditResource.AUTHORIZATION_FILE,
                    created,
                    AuditAction.CREATE,
                    0,
                    Set.of(
                            "exitId",
                            "documentVersionId",
                            "bindingId",
                            "messageId",
                            "origin",
                            "state",
                            "fileHash",
                            "mediaType"));
    }

    @Transactional
    public void jobFailed(Job job, ProviderFailure failure) {
        Instant now = now();
        boolean retry =
                failure.kind() == ProviderFailure.Kind.RETRYABLE && job.attempts() + 1 < 5;
        long wait =
                switch (job.attempts()) {
                    case 0 -> 60;
                    case 1 -> 300;
                    default -> 900;
                };
        if (jdbc.update(
                        """
UPDATE sager_whatsapp_job SET state=?,lease_until=NULL,lease_token=NULL,next_attempt_at=?,failure_code=?,
    version=version+1,updated_at=? WHERE id=? AND state='RUNNING' AND lease_token=?
""",
                        retry ? "PENDING" : "FAILED",
                        time(now.plusSeconds(retry ? wait : 0)),
                        failure.code(),
                        time(now),
                        job.id(),
                        job.leaseToken())
                == 0
                || retry) return;
        jdbc.update(
                "UPDATE sager_whatsapp_message SET media_state='FAILED',media_failure_code=?,"
                        + "version=version+1 WHERE id=?",
                failure.code(),
                job.messageId());
    }

    /** The order lets FAILED overtake SENT, but never a confirmed delivery. */
    @Transactional
    public void delivered(String messageId, String status) {
        jdbc.update(
                """
UPDATE sager_whatsapp_message SET delivery_status=?,version=version+1
WHERE provider=? AND session=? AND provider_message_id=? AND direction='OUT'
    AND array_position(ARRAY['QUEUED','SENT','FAILED','DELIVERED','READ'],delivery_status::text)
        < array_position(ARRAY['QUEUED','SENT','FAILED','DELIVERED','READ'],?::text)
""",
                status,
                PROVIDER,
                properties.whatsappSession(),
                messageId,
                status);
    }

    /** True only while an unknown id may belong to a send still waiting for the gateway's answer. */
    public boolean sendInProgress(String messageId) {
        return Boolean.TRUE.equals(
                jdbc.queryForObject(
                        """
SELECT EXISTS(SELECT 1 FROM sager_whatsapp_job WHERE type='SEND' AND state='RUNNING' AND lease_until>?)
    AND NOT EXISTS(SELECT 1 FROM sager_whatsapp_message WHERE provider_message_id=?)
    AND NOT EXISTS(SELECT 1 FROM sager_whatsapp_attempt WHERE provider_message_id=?)
""",
                        Boolean.class,
                        time(now()),
                        messageId,
                        messageId));
    }

    public List<String> unresolvedLids() {
        return jdbc.query(
                "SELECT lid FROM sager_whatsapp_conversation WHERE chat_id LIKE '%@lid'"
                        + " AND phone IS NULL ORDER BY updated_at DESC LIMIT 20",
                (r, n) -> r.getString(1));
    }

    @Transactional
    public void resolveLid(String lid, String phone) {
        jdbc.update(
                "UPDATE sager_whatsapp_conversation SET phone=?,updated_at=?,version=version+1"
                        + " WHERE lid=? AND phone IS NULL",
                phone,
                time(now()),
                lid);
    }

    /** One contact, one conversation: a LID chat joins the phone chat once both are known. */
    @Transactional
    public void mergeLidConversations() {
        Instant now = now();
        for (LidChat source :
                jdbc.query(
                        "SELECT id,lid,phone,last_message_at FROM sager_whatsapp_conversation"
                                + " WHERE chat_id LIKE '%@lid' AND phone IS NOT NULL FOR UPDATE",
                        (r, n) ->
                                new LidChat(
                                        r.getObject("id", UUID.class),
                                        r.getString("lid"),
                                        r.getString("phone"),
                                        instant(r, "last_message_at")))) {
            UUID target =
                    jdbc
                            .query(
                                    "SELECT id FROM sager_whatsapp_conversation WHERE chat_id NOT"
                                        + " LIKE '%@lid' AND phone = ANY(string_to_array(?,','))",
                                    (r, n) -> r.getObject(1, UUID.class),
                                    String.join(",", BrazilianPhone.variants(source.phone())))
                            .stream()
                            .findFirst()
                            .orElse(null);
            if (target == null) continue;
            jdbc.update(
                    "UPDATE sager_whatsapp_message SET conversation_id=? WHERE conversation_id=?",
                    target,
                    source.id());
            jdbc.update(
                    """
UPDATE sager_whatsapp_conversation SET lid=?,last_message_at=GREATEST(last_message_at,?),updated_at=?,version=version+1
WHERE id=?
""",
                    source.lid(),
                    time(source.lastMessageAt()),
                    time(now),
                    target);
            jdbc.update("DELETE FROM sager_whatsapp_conversation WHERE id=?", source.id());
        }
    }

    /** A restart keeps the link instant; only a new pairing (QR) starts a new timeline. */
    /** Tells whether the session stopped working; a webhook leaves the audit to the worker. */
    @Transactional
    public boolean recordSession(String status, Instant at, Instant now) {
        return session(status, at, now, now);
    }

    /** What the worker reads from the gateway is not an event: a silent webhook must stay visible. */
    @Transactional
    public void recordPolledSession(String status, Instant now) {
        if (session(status, now, now, null)) auditSessionEnd(UUID.randomUUID());
    }

    @Transactional
    public void auditSessionEnd(UUID correlation) {
        UUID resource =
                UUID.nameUUIDFromBytes(
                        (PROVIDER + ":" + properties.whatsappSession())
                                .getBytes(StandardCharsets.UTF_8));
        audit.recordSystem(
                correlation,
                AuditResource.WHATSAPP_SESSION,
                resource,
                AuditAction.END,
                0,
                Set.of("ended"));
    }

    private boolean session(String status, Instant at, Instant now, Instant eventAt) {
        String session = properties.whatsappSession();
        jdbc.update(
                """
INSERT INTO sager_whatsapp_session(provider,session,status,status_at,updated_at)
VALUES (?,?,?,?,?) ON CONFLICT(provider,session) DO NOTHING
""",
                PROVIDER,
                session,
                "STOPPED",
                time(Instant.EPOCH),
                time(now));
        var previous =
                jdbc.queryForObject(
                        "SELECT status_at,status FROM sager_whatsapp_session WHERE provider=? AND"
                                + " session=? FOR UPDATE",
                        (r, n) -> Map.entry(instant(r, "status_at"), r.getString("status")),
                        PROVIDER,
                        session);
        if (at.isBefore(previous.getKey())) return false;
        jdbc.update(
                """
UPDATE sager_whatsapp_session SET status=?,status_at=?,last_event_at=COALESCE(?::timestamptz,last_event_at),
    updated_at=?,version=version+1,
    linked_at=CASE WHEN ?='SCAN_QR_CODE' THEN NULL
                   WHEN ?='WORKING' THEN COALESCE(linked_at,?) ELSE linked_at END
WHERE provider=? AND session=?
""",
                status,
                time(at),
                eventAt == null ? null : time(eventAt),
                time(now),
                status,
                status,
                time(at),
                PROVIDER,
                session);
        return "WORKING".equals(previous.getValue()) && !"WORKING".equals(status);
    }

    @Transactional
    public void touchSession(Instant now) {
        jdbc.update(
                "UPDATE sager_whatsapp_session SET last_event_at=? WHERE provider=? AND session=?",
                time(now),
                PROVIDER,
                properties.whatsappSession());
    }

    public Instant linkedAt() {
        return jdbc
                .query(
                        "SELECT linked_at FROM sager_whatsapp_session WHERE provider=? AND session=?",
                        (r, n) -> instant(r, "linked_at"),
                        PROVIDER,
                        properties.whatsappSession())
                .stream()
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    public boolean afterLink(Instant sentAt) {
        Instant linked = linkedAt();
        return linked != null && !sentAt.isBefore(linked.truncatedTo(ChronoUnit.SECONDS));
    }

    private BindingData correlate(String phone, String quoted, Instant sentAt, Instant now) {
        List<BindingData> open =
                repository.openForPhones(BrazilianPhone.variants(phone), sentAt, now).stream()
                        .filter(repository::guardianCurrent)
                        .toList();
        UUID target = quoted == null ? null : repository.bindingByMessage(quoted);
        if (target != null) {
            // The citation names a document: only that document's open send may receive the file.
            UUID document = repository.binding(target, false).orElseThrow().documentVersionId();
            return open.stream()
                    .filter(binding -> binding.documentVersionId().equals(document))
                    .findFirst()
                    .orElse(null);
        }
        return open.size() == 1 ? open.getFirst() : null;
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    public record Job(
            UUID id,
            UUID leaseToken,
            UUID messageId,
            int attempts,
            String mediaPath,
            String declaredType,
            String senderPhone,
            String senderLid) {
        public boolean exhausted() {
            return attempts >= 5;
        }
    }

    private record Quote(Instant sentAt, String quoted) {}

    private record LidChat(UUID id, String lid, String phone, Instant lastMessageAt) {}
}
