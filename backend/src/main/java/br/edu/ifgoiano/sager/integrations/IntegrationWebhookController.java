package br.edu.ifgoiano.sager.integrations;

import static br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.time;

import br.edu.ifgoiano.sager.operations.longexits.LongExitApiException;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Webhooks only persist authenticated notifications; API verification runs in the worker. */
@RestController
@Profile("local")
public class IntegrationWebhookController {
    private static final int MAX_BODY = 1048576;
    private final JdbcTemplate jdbc;
    private final IntegrationRepository repository;
    private final IntegrationProperties properties;
    private final SignatureProvider signatures;
    private final WhatsAppProvider whatsapp;
    private final ObjectMapper json;
    private final Clock clock;

    public IntegrationWebhookController(
            JdbcTemplate jdbc,
            IntegrationRepository repository,
            IntegrationProperties properties,
            SignatureProvider signatures,
            WhatsAppProvider whatsapp,
            ObjectMapper json,
            Clock clock) {
        this.jdbc = jdbc;
        this.repository = repository;
        this.properties = properties;
        this.signatures = signatures;
        this.whatsapp = whatsapp;
        this.json = json;
        this.clock = clock;
    }

    @GetMapping(value = "/api/v1/webhooks/whatsapp", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> challenge(
            @RequestParam("hub.mode") String mode,
            @RequestParam("hub.verify_token") String token,
            @RequestParam("hub.challenge") String challenge) {
        enabled(whatsapp.available());
        if (!"subscribe".equals(mode)
                || properties.whatsappVerifyToken().isBlank()
                || !MessageDigest.isEqual(
                        token.getBytes(StandardCharsets.UTF_8),
                        properties.whatsappVerifyToken().getBytes(StandardCharsets.UTF_8)))
            throw invalid(HttpStatus.UNAUTHORIZED);
        if (challenge.isEmpty()
                || challenge.length() > 1024
                || challenge.indexOf('\n') >= 0
                || challenge.indexOf('\r') >= 0) throw invalid(HttpStatus.BAD_REQUEST);
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(challenge);
    }

    @PostMapping("/api/v1/webhooks/clicksign")
    @Transactional
    public ResponseEntity<Void> clicksign(HttpServletRequest request) {
        enabled(signatures.available());
        byte[] raw = body(request);
        authenticate(
                raw, request.getHeader("Content-Hmac"), properties.clicksignWebhookSecret(), true);
        JsonNode payload = parse(raw);
        JsonNode event = payload.path("event"), document = payload.path("document");
        String name = text(event, "name", 64);
        if (!Set.of("sign", "document_closed").contains(name)) return accepted();
        UUID providerDocument = uuid(document, "key");
        JsonNode metadata = document.path("metadata");
        if (metadata.isString()) {
            try {
                metadata = json.readTree(metadata.asText());
            } catch (RuntimeException error) {
                throw invalid(HttpStatus.BAD_REQUEST);
            }
        }
        UUID bindingId = uuid(metadata, "bindingId"),
                revision = uuid(metadata, "documentVersionId");
        Instant occurred = date(text(event, "occurred_at", 64));
        var binding = repository.binding(bindingId, false).orElse(null);
        if (binding == null) return accepted();
        if (!revision.equals(binding.documentVersionId())
                || !providerDocument.equals(binding.providerDocumentId())
                || !signatures.environment().equals(binding.environment()))
            throw invalid(HttpStatus.BAD_REQUEST);
        Map<String, String> normalized = new LinkedHashMap<>();
        normalized.put("bindingId", bindingId.toString());
        normalized.put("documentVersionId", revision.toString());
        normalized.put("providerDocumentId", providerDocument.toString());
        normalized.put("event", name);
        normalized.put("occurredAt", occurred.toString());
        save("CLICKSIGN", binding.environment(), normalized);
        return accepted();
    }

    @PostMapping("/api/v1/webhooks/whatsapp")
    @Transactional
    public ResponseEntity<Void> whatsapp(HttpServletRequest request) {
        enabled(whatsapp.available());
        byte[] raw = body(request);
        authenticate(
                raw,
                request.getHeader("X-Hub-Signature-256"),
                properties.whatsappAppSecret(),
                true);
        JsonNode payload = parse(raw);
        if (!"whatsapp_business_account".equals(payload.path("object").asText()))
            throw invalid(HttpStatus.BAD_REQUEST);
        JsonNode entries = array(payload, "entry");
        for (JsonNode entry : entries) {
            if (!properties.wabaId().equals(text(entry, "id", 64)))
                throw invalid(HttpStatus.BAD_REQUEST);
            for (JsonNode change : array(entry, "changes")) {
                if (!"messages".equals(change.path("field").asText())) continue;
                JsonNode value = change.path("value");
                if (!properties
                        .phoneNumberId()
                        .equals(text(value.path("metadata"), "phone_number_id", 64)))
                    throw invalid(HttpStatus.BAD_REQUEST);
                if (value.path("statuses").isMissingNode()) continue;
                for (JsonNode status : array(value, "statuses")) {
                    String state = text(status, "status", 16),
                            recipient = text(status, "recipient_id", 15);
                    if (!Set.of("sent", "delivered", "read", "failed").contains(state)
                            || !recipient.matches("55[1-9][0-9]{9,10}"))
                        throw invalid(HttpStatus.BAD_REQUEST);
                    Instant at;
                    try {
                        at = Instant.ofEpochSecond(Long.parseLong(text(status, "timestamp", 20)));
                    } catch (RuntimeException malformed) {
                        throw invalid(HttpStatus.BAD_REQUEST);
                    }
                    if (at.isBefore(Instant.EPOCH) || at.isAfter(clock.instant().plusSeconds(300)))
                        throw invalid(HttpStatus.BAD_REQUEST);
                    Map<String, String> normalized = new LinkedHashMap<>();
                    normalized.put("providerMessageId", text(status, "id", 512));
                    normalized.put("recipient", recipient);
                    normalized.put("status", state);
                    normalized.put("statusAt", at.toString());
                    save("WHATSAPP", "cloud", normalized);
                }
            }
        }
        return accepted();
    }

    private void save(String provider, String environment, Map<String, String> normalized) {
        String serialized = json.writeValueAsString(normalized);
        jdbc.update(
                """
INSERT INTO sager_webhook_inbox(id,provider,environment,event_key,payload,received_at)
VALUES (?,?,?,?,?::jsonb,?) ON CONFLICT(provider,environment,event_key) DO NOTHING
""",
                UUID.randomUUID(),
                provider,
                environment,
                CapabilityTokens.hash(serialized),
                serialized,
                time(clock.instant().truncatedTo(ChronoUnit.MICROS)));
    }

    private byte[] body(HttpServletRequest request) {
        if (request.getContentLengthLong() > MAX_BODY) throw invalid(HttpStatus.BAD_REQUEST);
        try {
            byte[] raw = request.getInputStream().readNBytes(MAX_BODY + 1);
            if (raw.length == 0 || raw.length > MAX_BODY) throw invalid(HttpStatus.BAD_REQUEST);
            return raw;
        } catch (IOException error) {
            throw invalid(HttpStatus.BAD_REQUEST);
        }
    }

    private void authenticate(byte[] raw, String header, String secret, boolean prefix) {
        if (secret == null || secret.isBlank() || header == null)
            throw invalid(HttpStatus.UNAUTHORIZED);
        String hash =
                prefix && header.startsWith("sha256=") ? header.substring(7) : prefix ? "" : header;
        if (!hash.matches("[0-9a-fA-F]{64}")) throw invalid(HttpStatus.UNAUTHORIZED);
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            hmac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            if (!MessageDigest.isEqual(hmac.doFinal(raw), HexFormat.of().parseHex(hash)))
                throw invalid(HttpStatus.UNAUTHORIZED);
        } catch (java.security.GeneralSecurityException error) {
            throw new IllegalStateException("HMAC indisponível.");
        }
    }

    private JsonNode parse(byte[] raw) {
        try {
            JsonNode p = json.readTree(raw);
            if (!p.isObject()) throw invalid(HttpStatus.BAD_REQUEST);
            return p;
        } catch (RuntimeException malformed) {
            throw invalid(HttpStatus.BAD_REQUEST);
        }
    }

    private JsonNode array(JsonNode parent, String name) {
        JsonNode a = parent.path(name);
        if (!a.isArray() || a.size() > 100) throw invalid(HttpStatus.BAD_REQUEST);
        return a;
    }

    private String text(JsonNode parent, String name, int max) {
        JsonNode v = parent.path(name);
        if (!v.isString() || v.asText().isEmpty() || v.asText().length() > max)
            throw invalid(HttpStatus.BAD_REQUEST);
        return v.asText();
    }

    private UUID uuid(JsonNode parent, String name) {
        try {
            return UUID.fromString(text(parent, name, 36));
        } catch (IllegalArgumentException malformed) {
            throw invalid(HttpStatus.BAD_REQUEST);
        }
    }

    private Instant date(String value) {
        try {
            return Instant.parse(value);
        } catch (java.time.DateTimeException malformed) {
            throw invalid(HttpStatus.BAD_REQUEST);
        }
    }

    private void enabled(boolean available) {
        if (!available)
            throw new LongExitApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "provider_unavailable",
                    "Provedor externo indisponível.");
    }

    private LongExitApiException invalid(HttpStatus status) {
        return new LongExitApiException(status, "invalid_webhook", "Notificação externa inválida.");
    }

    private ResponseEntity<Void> accepted() {
        return ResponseEntity.accepted().header("Cache-Control", "no-store").build();
    }
}
