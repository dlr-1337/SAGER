package br.edu.ifgoiano.sager.integrations;

import static br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.time;

import br.edu.ifgoiano.sager.integrations.WebhookEventParser.Delivery;
import br.edu.ifgoiano.sager.integrations.WebhookEventParser.Event;
import br.edu.ifgoiano.sager.integrations.WebhookEventParser.Ignored;
import br.edu.ifgoiano.sager.integrations.WebhookEventParser.Received;
import br.edu.ifgoiano.sager.integrations.WebhookEventParser.SessionChanged;
import br.edu.ifgoiano.sager.operations.longexits.LongExitApiException;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

/** The webhook only persists authenticated metadata; media and audit run in the worker. */
@RestController
@Profile({ "local", "production" })
public class IntegrationWebhookController {
    private static final int MAX_BODY = 1048576;
    private final JdbcTemplate jdbc;
    private final IntegrationProperties properties;
    private final WhatsAppGateway whatsapp;
    private final WhatsAppInbound inbound;
    private final ObjectMapper json;
    private final Clock clock;

    public IntegrationWebhookController(
            JdbcTemplate jdbc,
            IntegrationProperties properties,
            WhatsAppGateway whatsapp,
            WhatsAppInbound inbound,
            ObjectMapper json,
            Clock clock) {
        this.jdbc = jdbc;
        this.properties = properties;
        this.whatsapp = whatsapp;
        this.inbound = inbound;
        this.json = json;
        this.clock = clock;
    }

    @PostMapping("/api/v1/integracoes/whatsapp/webhook")
    @Transactional
    public ResponseEntity<Void> whatsapp(HttpServletRequest request) {
        if (!whatsapp.available())
            throw new LongExitApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "provider_unavailable",
                    "Provedor externo indisponível.");
        byte[] raw = body(request);
        if (!WebhookHmacVerifier.valid(
                request.getHeader("X-Webhook-Hmac"), properties.whatsappWebhookSecret(), raw))
            throw invalid(HttpStatus.UNAUTHORIZED);
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        String session = properties.whatsappSession();
        Event event;
        try {
            event = WebhookEventParser.parse(json.readTree(raw));
        } catch (RuntimeException malformed) {
            // Authentic but unreadable: marked at once, so a retry cannot block the queue.
            save(session, sha256(raw), Map.of("kind", "INVALID"), now, "event_invalid");
            return accepted();
        }
        switch (event) {
            case Ignored ignored -> {}
            case SessionChanged changed -> {
                if (session.equals(changed.session())
                        && inbound.recordSession(changed.status(), changed.at(), now))
                    save(
                            session,
                            sha256(
                                    ("SESSION_END:" + changed.at())
                                            .getBytes(StandardCharsets.UTF_8)),
                            Map.of("kind", "SESSION_END"),
                            now,
                            null);
            }
            case Delivery delivery -> {
                if (session.equals(delivery.session())) {
                    // Too early to know this id: the gateway retries after the send is recorded.
                    if (inbound.sendInProgress(delivery.messageId()))
                        throw new LongExitApiException(
                                HttpStatus.SERVICE_UNAVAILABLE,
                                "send_in_progress",
                                "Envio em andamento. Tente novamente.");
                    inbound.touchSession(now);
                    save(
                            session,
                            sha256(
                                    ("ACK:" + delivery.messageId() + ":" + delivery.status())
                                            .getBytes(StandardCharsets.UTF_8)),
                            Map.of(
                                    "kind", "ACK",
                                    "messageId", delivery.messageId(),
                                    "status", delivery.status(),
                                    "at", delivery.at().toString()),
                            now,
                            null);
                }
            }
            case Received received -> {
                if (session.equals(received.message().session())) {
                    inbound.touchSession(now);
                    if (inbound.afterLink(received.message().sentAt()))
                        save(
                                session,
                                sha256(
                                        ("MESSAGE:" + received.message().messageId())
                                                .getBytes(StandardCharsets.UTF_8)),
                                Map.of("kind", "MESSAGE", "message", received.message()),
                                now,
                                null);
                }
            }
        }
        return accepted();
    }

    private void save(
            String session, String key, Map<String, ?> payload, Instant now, String failure) {
        jdbc.update(
                """
INSERT INTO sager_webhook_inbox(id,provider,environment,event_key,payload,received_at,processed_at,failure_code)
VALUES (?,'WHATSAPP',?,?,?::jsonb,?,?,?) ON CONFLICT(provider,environment,event_key) DO NOTHING
""",
                UUID.randomUUID(),
                session,
                key,
                json.writeValueAsString(payload),
                time(now),
                failure == null ? null : time(now),
                failure);
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

    private static String sha256(byte[] value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 indisponível.");
        }
    }

    private LongExitApiException invalid(HttpStatus status) {
        return new LongExitApiException(status, "invalid_webhook", "Notificação externa inválida.");
    }

    private ResponseEntity<Void> accepted() {
        return ResponseEntity.accepted().header("Cache-Control", "no-store").build();
    }
}
