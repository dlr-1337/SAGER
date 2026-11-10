package br.edu.ifgoiano.sager.integrations;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/** Adapter for the HTTP contract of devlikeapro/waha:gows-2026.10.1. */
public final class WahaWhatsAppGateway implements WhatsAppGateway {
    private static final int MAX_MEDIA_BYTES = 10485760;
    private static final int MAX_QR_BYTES = 2097152;
    private static final int RECENT_LIMIT = 100;
    private final ProviderHttp http;
    private final URI root;
    private final String session;
    private final ObjectMapper json;

    public WahaWhatsAppGateway(
            HttpClient client,
            URI root,
            String apiKey,
            String session,
            ObjectMapper json,
            Duration timeout) {
        this.http = new ProviderHttp(client, json, timeout, apiKey);
        this.root = root;
        this.session = session;
        this.json = json;
    }

    @Override
    public boolean available() {
        return true;
    }

    @Override
    public SessionState session() {
        return new SessionState(
                ProviderHttp.text(http.json(uri("/api/sessions/" + session), "GET", null), "status"));
    }

    @Override
    public void startSession() {
        try {
            // The gateway's /start ignores a session it still holds, and a FAILED one stays held.
            String action = "FAILED".equals(session().status()) ? "restart" : "start";
            http.json(uri("/api/sessions/" + session + "/" + action), "POST", null);
        } catch (ProviderFailure failure) {
            if (!"provider_not_found".equals(failure.code())) throw failure;
            http.json(uri("/api/sessions"), "POST", Map.of("name", session, "start", true));
        }
    }

    @Override
    public byte[] qr() {
        return http.bytes(
                uri("/api/" + session + "/auth/qr?format=image"),
                "GET",
                "image/png",
                null,
                null,
                MAX_QR_BYTES);
    }

    @Override
    public String resolveRecipient(String phoneDigits) {
        if (!phoneDigits.matches("[0-9]{10,15}"))
            throw new ProviderFailure(ProviderFailure.Kind.PERMANENT, "recipient_invalid");
        JsonNode result;
        try {
            result =
                    http.json(
                            uri(
                                    "/api/contacts/check-exists?phone="
                                            + phoneDigits
                                            + "&session="
                                            + session),
                            "GET",
                            null);
        } catch (ProviderFailure failure) {
            // The gateway answers 422 while the session is not WORKING; the number was not judged.
            if (failure.httpStatus() == 422)
                throw new ProviderFailure(ProviderFailure.Kind.RETRYABLE, "session_not_ready");
            throw failure;
        }
        if (!result.path("numberExists").asBoolean(false))
            throw new ProviderFailure(ProviderFailure.Kind.PERMANENT, "recipient_not_found");
        String chat = ProviderHttp.text(result, "chatId");
        if (!WebhookEventParser.direct(chat)) throw ProviderHttp.invalid();
        return chat;
    }

    @Override
    public String resolveLid(String lid) {
        if (!lid.matches("[0-9]{1,32}@lid"))
            throw new ProviderFailure(ProviderFailure.Kind.PERMANENT, "lid_invalid");
        JsonNode result;
        try {
            result = http.json(uri("/api/" + session + "/lids/" + lid), "GET", null);
        } catch (ProviderFailure failure) {
            if ("provider_not_found".equals(failure.code())) return null;
            throw failure;
        }
        return WebhookEventParser.phone(result.path("pn").asString(""));
    }

    @Override
    public String sendDocument(String chatId, String filename, byte[] bytes, String caption) {
        return send(
                "/api/sendFile",
                Map.of(
                        "session",
                        session,
                        "chatId",
                        chat(chatId),
                        "caption",
                        caption,
                        "file",
                        file("application/pdf", filename, bytes)));
    }

    @Override
    public String sendText(String chatId, String text) {
        return send(
                "/api/sendText",
                Map.of("session", session, "chatId", chat(chatId), "text", text, "linkPreview", false));
    }

    @Override
    public String sendImage(
            String chatId, String filename, String mimeType, byte[] bytes, String caption) {
        return send(
                "/api/sendImage",
                Map.of(
                        "session",
                        session,
                        "chatId",
                        chat(chatId),
                        "caption",
                        caption,
                        "file",
                        file(mimeType, filename, bytes)));
    }

    @Override
    public String sendVoice(String chatId, String mimeType, byte[] bytes) {
        return send(
                "/api/sendVoice",
                Map.of(
                        "session",
                        session,
                        "chatId",
                        chat(chatId),
                        "convert",
                        true,
                        "file",
                        Map.of("mimetype", mimeType, "data", Base64.getEncoder().encodeToString(bytes))));
    }

    @Override
    public byte[] downloadMedia(String path) {
        String checked = WebhookEventParser.mediaPath(path);
        if (checked == null)
            throw new ProviderFailure(ProviderFailure.Kind.PERMANENT, "media_path_refused");
        try {
            return http.bytes(uri(checked), "GET", "*/*", null, null, MAX_MEDIA_BYTES);
        } catch (ProviderFailure failure) {
            throw switch (failure.code()) {
                case "provider_body_too_large" ->
                        new ProviderFailure(ProviderFailure.Kind.PERMANENT, "media_too_large");
                case "provider_not_found" ->
                        new ProviderFailure(ProviderFailure.Kind.PERMANENT, "media_unavailable");
                default -> failure;
            };
        }
    }

    @Override
    public List<InboundMessage> recentMessages(String chatId, Instant since) {
        JsonNode items =
                http.json(
                        uri(
                                "/api/"
                                        + session
                                        + "/chats/"
                                        + chat(chatId)
                                        + "/messages?limit="
                                        + RECENT_LIMIT
                                        + "&downloadMedia=true&filter.fromMe=false"
                                        + "&filter.timestamp.gte="
                                        + since.getEpochSecond()),
                        "GET",
                        null);
        if (!items.isArray()) throw ProviderHttp.invalid();
        List<InboundMessage> messages = new ArrayList<>();
        for (JsonNode item : items) {
            try {
                InboundMessage message = WebhookEventParser.message(session, item);
                if (message != null) messages.add(message);
            } catch (IllegalArgumentException malformed) {
                // One bad item must not hide the others from the reconciliation.
            }
        }
        return messages;
    }

    private String send(String path, Map<String, ?> body) {
        JsonNode response = http.json(uri(path), "POST", body);
        try {
            return WebhookEventParser.shortId(ProviderHttp.text(response, "id"));
        } catch (ProviderFailure error) {
            throw new ProviderFailure(ProviderFailure.Kind.UNCERTAIN, "provider_response_invalid");
        }
    }

    private Map<String, String> file(String mimeType, String filename, byte[] bytes) {
        return Map.of(
                "mimetype",
                mimeType,
                "filename",
                filename,
                "data",
                Base64.getEncoder().encodeToString(bytes));
    }

    private String chat(String chatId) {
        if (!WebhookEventParser.direct(chatId))
            throw new ProviderFailure(ProviderFailure.Kind.PERMANENT, "recipient_invalid");
        return chatId;
    }

    private URI uri(String suffix) {
        return ProviderHttp.append(root, suffix);
    }
}
