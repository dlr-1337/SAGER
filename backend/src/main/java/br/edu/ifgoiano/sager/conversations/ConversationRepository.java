package br.edu.ifgoiano.sager.conversations;

import br.edu.ifgoiano.sager.integrations.ConversationFileType;

import static br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.instant;
import static br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.time;

import br.edu.ifgoiano.sager.documents.StoredFile;
import br.edu.ifgoiano.sager.management.guardians.BrazilianPhone;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Read side of the conversations. Phones are compared through their ninth-digit variants. */
@Repository
@Profile({ "local", "production" })
public class ConversationRepository {
    private static final String SUMMARY =
            """
SELECT c.id,c.provider,c.session,c.chat_id,c.phone,c.last_message_at,
    (SELECT COUNT(*) FROM sager_whatsapp_message u WHERE u.conversation_id=c.id AND u.direction='IN'
        AND (c.read_at IS NULL OR u.received_at>c.read_at)) AS unread,
    m.direction,LEFT(m.body,200) AS preview,m.media_state,m.media_mime_type,m.delivery_status,m.sent_at
FROM sager_whatsapp_conversation c LEFT JOIN LATERAL (
    SELECT * FROM sager_whatsapp_message x WHERE x.conversation_id=c.id ORDER BY x.sent_at DESC,x.id DESC LIMIT 1
) m ON true
""";
    private static final String MESSAGE =
            """
SELECT m.*,NOT EXISTS(SELECT 1 FROM sager_guardian_authorization_file f
    WHERE f.message_id=m.id AND f.state<>'REFUSED') AS unlinked
FROM sager_whatsapp_message m
""";
    private final JdbcTemplate jdbc;

    public ConversationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Summary> list(String q, Cursor before, int limit) {
        StringBuilder sql = new StringBuilder(SUMMARY).append(" WHERE true");
        List<Object> args = new ArrayList<>();
        if (q != null) {
            String digits = q.replaceAll("[^0-9]", "");
            // Phones never contain a hyphen, so a term without enough digits matches no number.
            String needle = digits.length() < 4 ? "-" : digits;
            sql.append(" AND (c.phone = ANY(string_to_array(?,',')) OR position(? in c.phone)>0)");
            args.add(String.join(",", variants(guardianPhones(q, needle))));
            args.add(needle);
        }
        if (before != null) {
            sql.append(" AND (c.last_message_at,c.id) < (?,?)");
            args.add(time(before.at()));
            args.add(before.id());
        }
        sql.append(" ORDER BY c.last_message_at DESC,c.id DESC LIMIT ?");
        args.add(limit);
        return jdbc.query(sql.toString(), (r, n) -> summary(r), args.toArray());
    }

    public Optional<Summary> summary(UUID id) {
        return jdbc.query(SUMMARY + " WHERE c.id=?", (r, n) -> summary(r), id).stream().findFirst();
    }

    public Optional<Summary> byPhones(Collection<String> phones) {
        return jdbc
                .query(
                        SUMMARY
                                + " WHERE c.phone = ANY(string_to_array(?,','))"
                                + " ORDER BY c.last_message_at DESC,c.id DESC LIMIT 1",
                        (r, n) -> summary(r),
                        String.join(",", phones))
                .stream()
                .findFirst();
    }

    /** Active registrations for these phones, with the residents they answer for. */
    public List<GuardianLink> guardians(Collection<String> phones) {
        if (phones.isEmpty()) return List.of();
        return jdbc.query(
                """
SELECT g.id,g.name,g.relationship,g.phone,r.id AS resident_id,r.name AS resident_name
FROM sager_guardian g JOIN sager_resident r ON r.id=g.resident_id
WHERE g.active AND g.phone = ANY(string_to_array(?,',')) ORDER BY sager_search_text(g.name),g.id
""",
                (r, n) ->
                        new GuardianLink(
                                r.getObject("id", UUID.class),
                                r.getString("name"),
                                r.getString("relationship"),
                                r.getString("phone"),
                                r.getObject("resident_id", UUID.class),
                                r.getString("resident_name")),
                String.join(",", variants(phones)));
    }

    public Optional<GuardianLink> activeGuardian(UUID id) {
        return jdbc
                .query(
                        """
SELECT g.id,g.name,g.relationship,g.phone,r.id AS resident_id,r.name AS resident_name
FROM sager_guardian g JOIN sager_resident r ON r.id=g.resident_id WHERE g.active AND g.id=?
""",
                        (r, n) ->
                                new GuardianLink(
                                        r.getObject("id", UUID.class),
                                        r.getString("name"),
                                        r.getString("relationship"),
                                        r.getString("phone"),
                                        r.getObject("resident_id", UUID.class),
                                        r.getString("resident_name")),
                        id)
                .stream()
                .findFirst();
    }

    public List<Message> messages(UUID conversation, Cursor before, int limit) {
        StringBuilder sql = new StringBuilder(MESSAGE).append(" WHERE m.conversation_id=?");
        List<Object> args = new ArrayList<>(List.of(conversation));
        if (before != null) {
            sql.append(" AND (m.sent_at,m.id) < (?,?)");
            args.add(time(before.at()));
            args.add(before.id());
        }
        sql.append(" ORDER BY m.sent_at DESC,m.id DESC LIMIT ?");
        args.add(limit);
        return jdbc.query(sql.toString(), (r, n) -> message(r), args.toArray());
    }

    public Optional<Message> message(UUID id) {
        return jdbc.query(MESSAGE + " WHERE m.id=?", (r, n) -> message(r), id).stream().findFirst();
    }

    public Optional<StoredMedia> media(UUID messageId) {
        return jdbc
                .query(
                        """
SELECT media_file_id,media_hash,media_size,media_mime_type,media_filename FROM sager_whatsapp_message
WHERE id=? AND media_state='STORED'
""",
                        (r, n) ->
                                new StoredMedia(
                                        new StoredFile(
                                                r.getObject("media_file_id", UUID.class),
                                                r.getString("media_hash"),
                                                r.getLong("media_size"),
                                                StoredFile.STORED),
                                        r.getString("media_mime_type"),
                                        r.getString("media_filename")),
                        messageId)
                .stream()
                .findFirst();
    }

    /** Null when the key is unused; otherwise tells whether it was used for this same request. */
    public Replay replay(UUID actor, String key, UUID conversation, String body, String hash) {
        return jdbc
                .query(
                        """
SELECT id,(conversation_id=? AND body IS NOT DISTINCT FROM ?::text
    AND media_hash IS NOT DISTINCT FROM ?::char(64)) AS same
FROM sager_whatsapp_message WHERE created_by=? AND idempotency_key=?
""",
                        (r, n) -> new Replay(r.getObject("id", UUID.class), r.getBoolean("same")),
                        conversation,
                        body,
                        hash,
                        actor,
                        key)
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void markRead(UUID conversation, Instant now) {
        jdbc.update(
                "UPDATE sager_whatsapp_conversation SET read_at=GREATEST(read_at,?),"
                        + "version=version+1,updated_at=? WHERE id=?",
                time(now),
                time(now),
                conversation);
    }

    /** Open means still awaiting analysis, for a guardian answering at this conversation's phone. */
    public List<OpenExit> openExits(String phone) {
        if (phone == null) return List.of();
        return jdbc.query(
                """
SELECT e.id,e.version,e.resident_id,e.resident_name,e.guardian_id,e.guardian_name,e.requested_departure_at,
    e.expected_return_at
FROM sager_long_exit e JOIN sager_guardian g ON g.id=e.guardian_id
WHERE e.status='AGUARDANDO_ANALISE' AND g.phone = ANY(string_to_array(?,','))
ORDER BY e.requested_departure_at,e.id
""",
                (r, n) ->
                        new OpenExit(
                                r.getObject("id", UUID.class),
                                r.getLong("version"),
                                r.getObject("resident_id", UUID.class),
                                r.getString("resident_name"),
                                r.getObject("guardian_id", UUID.class),
                                r.getString("guardian_name"),
                                instant(r, "requested_departure_at"),
                                instant(r, "expected_return_at")),
                String.join(",", BrazilianPhone.variants(phone)));
    }

    public Optional<StoredSession> session(String session) {
        return jdbc
                .query(
                        "SELECT linked_at,last_event_at,status FROM sager_whatsapp_session WHERE"
                                + " provider='WHATSAPP_GATEWAY' AND session=?",
                        (r, n) ->
                                new StoredSession(
                                        r.getString("status"),
                                        instant(r, "linked_at"),
                                        instant(r, "last_event_at")),
                        session)
                .stream()
                .findFirst();
    }

    private List<String> guardianPhones(String q, String needle) {
        return jdbc.query(
                """
SELECT DISTINCT g.phone FROM sager_guardian g JOIN sager_resident r ON r.id=g.resident_id
WHERE g.active AND g.phone IS NOT NULL AND (position(sager_search_text(?) in sager_search_text(g.name))>0
    OR position(sager_search_text(?) in sager_search_text(r.name))>0 OR position(? in g.phone)>0)
""",
                (r, n) -> r.getString(1),
                q,
                q,
                needle);
    }

    private static Set<String> variants(Collection<String> phones) {
        return phones.stream()
                .filter(Objects::nonNull)
                .flatMap(p -> BrazilianPhone.variants(p).stream())
                .collect(Collectors.toSet());
    }

    private Summary summary(ResultSet r) throws SQLException {
        String direction = r.getString("direction");
        return new Summary(
                r.getObject("id", UUID.class),
                r.getString("provider"),
                r.getString("session"),
                r.getString("chat_id"),
                r.getString("phone"),
                instant(r, "last_message_at"),
                r.getLong("unread"),
                direction == null
                        ? null
                        : new Preview(
                                direction,
                                kind(r.getString("media_state"), r.getString("media_mime_type")),
                                r.getString("preview"),
                                r.getString("delivery_status"),
                                instant(r, "sent_at")));
    }

    private Message message(ResultSet r) throws SQLException {
        String state = r.getString("media_state"), type = r.getString("media_mime_type");
        String direction = r.getString("direction");
        return new Message(
                r.getObject("id", UUID.class),
                r.getObject("conversation_id", UUID.class),
                direction,
                r.getString("origin"),
                kind(state, type),
                r.getString("body"),
                state,
                r.getString("media_failure_code"),
                type,
                r.getString("media_filename") == null
                        ? null
                        : ConversationFileType.safeName(
                                r.getString("media_filename"), r.getString("media_mime_type")),
                r.getLong("media_size"),
                r.getString("delivery_status"),
                r.getString("delivery_failure_code"),
                instant(r, "sent_at"),
                "IN".equals(direction)
                        && "STORED".equals(state)
                        && !type.startsWith("audio/")
                        && r.getBoolean("unlinked"));
    }

    private static String kind(String state, String type) {
        if ("NONE".equals(state)) return "TEXT";
        if (type != null && type.startsWith("image/")) return "IMAGE";
        if (type != null && type.startsWith("audio/")) return "AUDIO";
        return "DOCUMENT";
    }

    public record Cursor(Instant at, UUID id) {}

    public record GuardianLink(
            UUID id,
            String name,
            String relationship,
            String phone,
            UUID residentId,
            String residentName) {}

    public record Preview(
            String direction, String kind, String body, String deliveryStatus, Instant sentAt) {}

    public record Summary(
            UUID id,
            String provider,
            String session,
            String chatId,
            String phone,
            Instant lastMessageAt,
            long unreadCount,
            Preview lastMessage) {}

    public record Message(
            UUID id,
            UUID conversationId,
            String direction,
            String origin,
            String kind,
            String body,
            String mediaState,
            String mediaFailureCode,
            String mediaType,
            String mediaFilename,
            long mediaSize,
            String deliveryStatus,
            String failureCode,
            Instant sentAt,
            boolean linkable) {}

    public record StoredMedia(StoredFile file, String mediaType, String filename) {}

    public record Replay(UUID messageId, boolean same) {}

    public record OpenExit(
            UUID id,
            long version,
            UUID residentId,
            String residentName,
            UUID guardianId,
            String guardianName,
            Instant requestedDepartureAt,
            Instant expectedReturnAt) {}

    public record StoredSession(String status, Instant linkedAt, Instant lastEventAt) {}
}
