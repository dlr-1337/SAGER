package br.edu.ifgoiano.sager.integrations;

import br.edu.ifgoiano.sager.integrations.WhatsAppGateway.InboundMessage;

import tools.jackson.databind.JsonNode;

import java.net.URI;
import java.time.Instant;
import java.util.Set;

/** Turns a gateway event into domain terms. A malformed event raises IllegalArgumentException. */
public final class WebhookEventParser {
    private static final Set<String> SESSION_STATUS =
            Set.of(
                    "STOPPED",
                    "STARTING",
                    "SCAN_QR_CODE",
                    "PASSKEY_REQUIRED",
                    "PASSKEY_CONFIRMATION_REQUIRED",
                    "WORKING",
                    "FAILED");
    private static final int MAX_BODY_CHARACTERS = 65536;

    private WebhookEventParser() {}

    public sealed interface Event permits Ignored, Received, Delivery, SessionChanged {}

    public record Ignored() implements Event {}

    public record Received(InboundMessage message) implements Event {}

    public record Delivery(String session, String messageId, String status, Instant at)
            implements Event {}

    public record SessionChanged(String session, String status, Instant at) implements Event {}

    public static Event parse(JsonNode root) {
        if (root == null || !root.isObject()) throw new IllegalArgumentException("event");
        String event = root.path("event").asString("");
        return switch (event) {
            case "message", "message.any" -> {
                InboundMessage message = message(text(root, "session", 64), root.path("payload"));
                yield message == null ? new Ignored() : new Received(message);
            }
            case "message.ack" -> delivery(root);
            case "session.status" -> session(root);
            default -> {
                if (event.isEmpty()) throw new IllegalArgumentException("event");
                yield new Ignored();
            }
        };
    }

    /** Returns null for what is never recorded: API echoes, groups, status and channels. */
    public static InboundMessage message(String session, JsonNode payload) {
        if (!payload.isObject()) throw new IllegalArgumentException("payload");
        boolean own = payload.path("fromMe").asBoolean(false);
        // API sends were recorded when requested; only what the phone sent is new here.
        if (own && !"app".equals(payload.path("source").asString(""))) return null;
        String chat = text(payload, own ? "to" : "from", 128);
        if (!direct(chat)) return null;
        String id = shortId(text(payload, "id", 512));
        long seconds = payload.path("timestamp").asLong(0);
        if (seconds <= 0) throw new IllegalArgumentException("timestamp");
        String body = payload.path("body").isString() ? payload.path("body").asString() : null;
        if (body != null && body.length() > MAX_BODY_CHARACTERS)
            body = body.substring(0, MAX_BODY_CHARACTERS);
        boolean hasMedia = payload.path("hasMedia").asBoolean(false);
        JsonNode media = payload.path("media");
        String url = media.path("url").isString() ? media.path("url").asString() : null;
        String path = hasMedia && url != null ? mediaPath(url) : null;
        String failure =
                !hasMedia || path != null
                        ? null
                        : url == null ? "media_unavailable" : "media_path_refused";
        String mime = limited(media.path("mimetype"), 100), filename = limited(media.path("filename"), 255);
        JsonNode reply = payload.path("replyTo").path("id");
        return new InboundMessage(
                session,
                id,
                chat,
                chat.endsWith("@lid") ? null : phone(chat),
                chat.endsWith("@lid") ? chat : null,
                body,
                hasMedia,
                path,
                mime,
                filename,
                failure,
                reply.isString() && !reply.asString().isBlank() ? shortId(reply.asString()) : null,
                Instant.ofEpochSecond(seconds),
                own);
    }

    /** Groups, broadcast, status and channels have other suffixes and never qualify. */
    public static boolean direct(String chatId) {
        return chatId != null && chatId.matches("[0-9]{1,32}@(c\\.us|s\\.whatsapp\\.net|lid)");
    }

    /** Returns +digits for a phone chat, or null for anything else. */
    public static String phone(String chatId) {
        return chatId != null && chatId.matches("[1-9][0-9]{6,14}@(c\\.us|s\\.whatsapp\\.net)")
                ? "+" + chatId.substring(0, chatId.indexOf('@'))
                : null;
    }

    /** true_CHAT_ID and CHAT forms differ between events and replies; only the last part is stable. */
    public static String shortId(String id) {
        String[] parts = id.split("_");
        String value =
                parts.length >= 3 && ("true".equals(parts[0]) || "false".equals(parts[0]))
                        ? parts[2]
                        : id;
        if (value.isEmpty() || value.length() > 128) throw new IllegalArgumentException("id");
        return value;
    }

    /** Keeps only the path, so the API key can never follow a host chosen by the event. */
    public static String mediaPath(String url) {
        URI uri;
        try {
            uri = new URI(url);
        } catch (java.net.URISyntaxException | NullPointerException invalid) {
            return null;
        }
        String raw = uri.getRawPath(), decoded = uri.getPath();
        if (raw == null
                || !raw.startsWith("/api/files/")
                || raw.length() > 1024
                || decoded.contains("..")
                || decoded.contains("\\")
                || decoded.contains("//")) return null;
        return raw;
    }

    private static Event delivery(JsonNode root) {
        JsonNode payload = root.path("payload");
        if (!payload.path("fromMe").asBoolean(false)) return new Ignored();
        String id = shortId(text(payload, "id", 512));
        if (!payload.path("ack").isNumber()) throw new IllegalArgumentException("ack");
        String status =
                switch (payload.path("ack").asInt()) {
                    case -1 -> "FAILED";
                    case 1 -> "SENT";
                    case 2 -> "DELIVERED";
                    case 3, 4 -> "READ";
                    default -> null;
                };
        return status == null
                ? new Ignored()
                : new Delivery(text(root, "session", 64), id, status, millis(root));
    }

    private static Event session(JsonNode root) {
        String status = text(root.path("payload"), "status", 32);
        if (!SESSION_STATUS.contains(status)) throw new IllegalArgumentException("status");
        return new SessionChanged(text(root, "session", 64), status, millis(root));
    }

    private static Instant millis(JsonNode root) {
        long value = root.path("timestamp").asLong(0);
        if (value <= 0) throw new IllegalArgumentException("timestamp");
        return Instant.ofEpochMilli(value);
    }

    private static String text(JsonNode parent, String name, int max) {
        JsonNode value = parent.path(name);
        if (!value.isString() || value.asString().isEmpty() || value.asString().length() > max)
            throw new IllegalArgumentException(name);
        return value.asString();
    }

    private static String limited(JsonNode value, int max) {
        if (!value.isString()) return null;
        String text = value.asString();
        return text.length() > max ? text.substring(0, max) : text;
    }
}
