package br.edu.ifgoiano.sager.integrations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.edu.ifgoiano.sager.integrations.WebhookEventParser.Delivery;
import br.edu.ifgoiano.sager.integrations.WebhookEventParser.Ignored;
import br.edu.ifgoiano.sager.integrations.WebhookEventParser.Received;
import br.edu.ifgoiano.sager.integrations.WebhookEventParser.SessionChanged;
import br.edu.ifgoiano.sager.integrations.WhatsAppGateway.InboundMessage;

import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Shapes follow the pinned gateway image: send, check-exists, lids, sessions, files and events. */
class IntegrationProviderContractTest {
    private static final String KEY = "synthetic-gateway-key";
    private final ObjectMapper json = new ObjectMapper();
    private final List<Seen> seen = new CopyOnWriteArrayList<>();
    private HttpServer server;
    private WahaWhatsAppGateway gateway;
    private volatile int status = 200;
    private volatile String reply = "{}";
    private volatile byte[] rawReply;
    private volatile String location;

    record Seen(String method, String uri, String key, String accept, byte[] body) {}

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/",
                exchange -> {
                    seen.add(
                            new Seen(
                                    exchange.getRequestMethod(),
                                    exchange.getRequestURI().toString(),
                                    exchange.getRequestHeaders().getFirst("X-Api-Key"),
                                    exchange.getRequestHeaders().getFirst("Accept"),
                                    exchange.getRequestBody().readAllBytes()));
                    byte[] value =
                            rawReply != null ? rawReply : reply.getBytes(StandardCharsets.UTF_8);
                    if (location != null) exchange.getResponseHeaders().set("Location", location);
                    exchange.sendResponseHeaders(status, value.length);
                    try (var out = exchange.getResponseBody()) {
                        out.write(value);
                    }
                    exchange.close();
                });
        server.start();
        gateway =
                new WahaWhatsAppGateway(
                        HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build(),
                        URI.create("http://127.0.0.1:" + server.getAddress().getPort()),
                        KEY,
                        "default",
                        json,
                        Duration.ofSeconds(5));
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private Seen last() {
        return seen.getLast();
    }

    private ProviderFailure failure(Runnable action) {
        try {
            action.run();
        } catch (ProviderFailure failure) {
            return failure;
        }
        throw new AssertionError("Era esperada uma falha do provedor.");
    }

    @Test
    void sendFileCarriesTheApiKeyAndBase64PayloadAndReturnsTheShortId() throws Exception {
        reply = "{\"id\":\"true_5562999990000@c.us_3EB0ABC\",\"_data\":{}}";
        byte[] pdf = "%PDF-synthetic".getBytes(StandardCharsets.US_ASCII);
        String id = gateway.sendDocument("5562999990000@c.us", "doc.pdf", pdf, "Legenda sintética");
        assertThat(id).isEqualTo("3EB0ABC");
        assertThat(last().method()).isEqualTo("POST");
        assertThat(last().uri()).isEqualTo("/api/sendFile");
        assertThat(last().key()).isEqualTo(KEY);
        JsonNode body = json.readTree(last().body());
        assertThat(body.path("session").asString()).isEqualTo("default");
        assertThat(body.path("chatId").asString()).isEqualTo("5562999990000@c.us");
        assertThat(body.path("caption").asString()).isEqualTo("Legenda sintética");
        assertThat(body.path("file").path("mimetype").asString()).isEqualTo("application/pdf");
        assertThat(body.path("file").path("filename").asString()).isEqualTo("doc.pdf");
        assertThat(Base64.getDecoder().decode(body.path("file").path("data").asString())).isEqualTo(pdf);
    }

    @Test
    void textImageAndVoiceUseTheirOwnRoutes() throws Exception {
        reply = "{\"id\":\"true_1@c.us_M\"}";
        gateway.sendText("1@c.us", "Texto sintético");
        assertThat(last().uri()).isEqualTo("/api/sendText");
        gateway.sendImage("1@c.us", "a.png", "image/png", new byte[] {1}, "");
        assertThat(last().uri()).isEqualTo("/api/sendImage");
        gateway.sendVoice("1@c.us", "audio/ogg", new byte[] {1});
        assertThat(last().uri()).isEqualTo("/api/sendVoice");
        assertThat(json.readTree(last().body()).path("convert").asBoolean()).isTrue();
    }

    @Test
    void refusesGroupsAsRecipientsWithoutCallingTheGateway() {
        assertThat(failure(() -> gateway.sendText("123@g.us", "x")).code()).isEqualTo("recipient_invalid");
        assertThat(seen).isEmpty();
    }

    @Test
    void responseWithoutIdAfterPostIsUncertain() {
        reply = "{}";
        ProviderFailure failure = failure(() -> gateway.sendText("1@c.us", "x"));
        assertThat(failure.kind()).isEqualTo(ProviderFailure.Kind.UNCERTAIN);
    }

    @Test
    void checkExistsResolvesTheChatAndSeparatesNotReadyFromUnknown() {
        reply = "{\"numberExists\":true,\"chatId\":\"556212345678@c.us\"}";
        assertThat(gateway.resolveRecipient("5562912345678")).isEqualTo("556212345678@c.us");
        assertThat(last().uri())
                .isEqualTo("/api/contacts/check-exists?phone=5562912345678&session=default");
        reply = "{\"numberExists\":false}";
        ProviderFailure unknown = failure(() -> gateway.resolveRecipient("5562912345678"));
        assertThat(unknown.code()).isEqualTo("recipient_not_found");
        assertThat(unknown.kind()).isEqualTo(ProviderFailure.Kind.PERMANENT);
        status = 422;
        ProviderFailure busy = failure(() -> gateway.resolveRecipient("5562912345678"));
        assertThat(busy.code()).isEqualTo("session_not_ready");
        assertThat(busy.kind()).isEqualTo(ProviderFailure.Kind.RETRYABLE);
        status = 400;
        assertThat(failure(() -> gateway.resolveRecipient("5562912345678")).code())
                .isEqualTo("provider_http_rejected");
        status = 200;
        assertThat(failure(() -> gateway.resolveRecipient("../x")).code()).isEqualTo("recipient_invalid");
    }

    @Test
    void lidResolvesToAPhoneOrNull() {
        reply = "{\"lid\":\"123@lid\",\"pn\":\"5562999990000@c.us\"}";
        assertThat(gateway.resolveLid("123@lid")).isEqualTo("+5562999990000");
        assertThat(last().uri()).isEqualTo("/api/default/lids/123@lid");
        reply = "{\"lid\":\"123@lid\",\"pn\":null}";
        assertThat(gateway.resolveLid("123@lid")).isNull();
        status = 404;
        assertThat(gateway.resolveLid("123@lid")).isNull();
    }

    @Test
    void sessionStartAndQrFollowTheGatewayRoutes() {
        reply = "{\"name\":\"default\",\"status\":\"SCAN_QR_CODE\"}";
        assertThat(gateway.session().status()).isEqualTo("SCAN_QR_CODE");
        assertThat(last().uri()).isEqualTo("/api/sessions/default");
        gateway.startSession();
        assertThat(last().uri()).isEqualTo("/api/sessions/default/start");
        reply = "{\"name\":\"default\",\"status\":\"FAILED\"}";
        gateway.startSession();
        assertThat(last().uri()).isEqualTo("/api/sessions/default/restart");
        rawReply = new byte[] {(byte) 0x89, 'P', 'N', 'G'};
        assertThat(gateway.qr()).isEqualTo(rawReply);
        assertThat(last().uri()).isEqualTo("/api/default/auth/qr?format=image");
        assertThat(last().accept()).isEqualTo("image/png");
    }

    @Test
    void startCreatesTheSessionWhenItDoesNotExist() throws Exception {
        status = 404;
        assertThat(failure(gateway::startSession).code()).isEqualTo("provider_not_found");
        assertThat(seen).hasSize(2);
        assertThat(last().uri()).isEqualTo("/api/sessions");
        assertThat(json.readTree(last().body()).path("name").asString()).isEqualTo("default");
    }

    @Test
    void recentMessagesFilterTheQueryAndSkipBadItems() {
        reply =
                "[{\"id\":\"false_5562999990000@c.us_A\",\"timestamp\":1790000000,\"from\":\"5562999990000@c.us\","
                        + "\"fromMe\":false,\"hasMedia\":false},"
                        + "{\"id\":1},{\"id\":\"true_x@c.us_B\",\"timestamp\":1790000000,"
                        + "\"from\":\"5562999990000@c.us\",\"fromMe\":true}]";
        List<InboundMessage> messages =
                gateway.recentMessages("5562999990000@c.us", Instant.ofEpochSecond(1789999000));
        assertThat(messages).extracting(InboundMessage::messageId).containsExactly("A");
        assertThat(last().uri())
                .startsWith("/api/default/chats/5562999990000@c.us/messages?limit=")
                .contains("filter.fromMe=false", "filter.timestamp.gte=1789999000");
    }

    @Test
    void mediaUsesOnlyThePathAgainstTheConfiguredBase() {
        rawReply = new byte[] {1, 2, 3};
        assertThat(gateway.downloadMedia("/api/files/default/a.jpg")).containsExactly(1, 2, 3);
        assertThat(last().uri()).isEqualTo("/api/files/default/a.jpg");
        assertThat(last().accept()).isEqualTo("*/*");
        assertThat(gateway.downloadMedia("http://outside.invalid/api/files/default/a.jpg"))
                .containsExactly(1, 2, 3);
        assertThat(seen).hasSize(2);
    }

    @Test
    void mediaOutsideTheFilesPathIsNeverRequested() {
        for (String path :
                List.of(
                        "/api/server/stop",
                        "/api/files/../server/stop",
                        "/api/files/%2e%2e/server/stop",
                        "/api/files//a",
                        "not a url")) {
            assertThat(failure(() -> gateway.downloadMedia(path)).code())
                    .as(path)
                    .isEqualTo("media_path_refused");
        }
        assertThat(seen).isEmpty();
    }

    @Test
    void mediaSizeAndAbsenceBecomeDefinitiveFailures() {
        rawReply = new byte[10 * 1024 * 1024 + 1];
        ProviderFailure large = failure(() -> gateway.downloadMedia("/api/files/default/a"));
        assertThat(large.code()).isEqualTo("media_too_large");
        assertThat(large.kind()).isEqualTo(ProviderFailure.Kind.PERMANENT);
        rawReply = new byte[10 * 1024 * 1024];
        assertThat(gateway.downloadMedia("/api/files/default/a")).hasSize(10 * 1024 * 1024);
        rawReply = null;
        status = 404;
        assertThat(failure(() -> gateway.downloadMedia("/api/files/default/a")).code())
                .isEqualTo("media_unavailable");
    }

    @Test
    void redirectsAreNotFollowedSoTheKeyCannotLeave() throws Exception {
        HttpServer outside = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        List<String> visits = new CopyOnWriteArrayList<>();
        outside.createContext(
                "/",
                exchange -> {
                    visits.add(exchange.getRequestURI().toString());
                    exchange.sendResponseHeaders(200, -1);
                    exchange.close();
                });
        outside.start();
        try {
            status = 302;
            location = "http://127.0.0.1:" + outside.getAddress().getPort() + "/stolen";
            assertThat(failure(() -> gateway.downloadMedia("/api/files/default/a")).code())
                    .isEqualTo("provider_http_rejected");
            assertThat(visits).isEmpty();
        } finally {
            outside.stop(0);
        }
    }

    @Test
    void failureKindsSeparateAmbiguousPostsFromSafeRetries() {
        status = 503;
        assertThat(failure(() -> gateway.sendText("1@c.us", "x")).kind())
                .isEqualTo(ProviderFailure.Kind.UNCERTAIN);
        assertThat(failure(gateway::session).kind()).isEqualTo(ProviderFailure.Kind.RETRYABLE);
        status = 429;
        assertThat(failure(() -> gateway.sendText("1@c.us", "x")).kind())
                .isEqualTo(ProviderFailure.Kind.RETRYABLE);
        status = 400;
        assertThat(failure(() -> gateway.sendText("1@c.us", "x")).kind())
                .isEqualTo(ProviderFailure.Kind.PERMANENT);
        server.stop(0);
        assertThat(failure(() -> gateway.sendText("1@c.us", "x")).kind())
                .isEqualTo(ProviderFailure.Kind.RETRYABLE);
    }

    @Test
    void disabledGatewayRefusesEveryOperation() {
        WhatsAppGateway disabled = new WhatsAppGateway() {};
        assertThat(disabled.available()).isFalse();
        assertThatThrownBy(() -> disabled.sendText("1@c.us", "x"))
                .isInstanceOf(ProviderFailure.class);
    }

    @Test
    void parserReadsMessageWithMediaAndQuote() {
        var event =
                WebhookEventParser.parse(
                        json.readTree(
                                """
                                {"id":"evt_1","timestamp":1790000000123,"event":"message","session":"default",
                                 "payload":{"id":"false_5562999990000@c.us_3EB0AA","timestamp":1790000000,
                                 "from":"5562999990000@c.us","fromMe":false,"body":"segue","hasMedia":true,
                                 "media":{"url":"http://gw:3000/api/files/default/3EB0AA.jpeg",
                                 "mimetype":"image/jpeg","filename":null,"error":null},
                                 "replyTo":{"id":"3EB0BB","participant":null,"body":null}}}
                                """));
        InboundMessage message = ((Received) event).message();
        assertThat(message.messageId()).isEqualTo("3EB0AA");
        assertThat(message.senderPhone()).isEqualTo("+5562999990000");
        assertThat(message.senderLid()).isNull();
        assertThat(message.mediaPath()).isEqualTo("/api/files/default/3EB0AA.jpeg");
        assertThat(message.mediaFailure()).isNull();
        assertThat(message.quotedMessageId()).isEqualTo("3EB0BB");
        assertThat(message.sentAt()).isEqualTo(Instant.ofEpochSecond(1790000000));
    }

    @Test
    void parserKeepsMediaFailuresAndLidSenders() {
        JsonNode payload =
                json.readTree(
                        "{\"id\":\"false_123@lid_A\",\"timestamp\":1,\"from\":\"123@lid\",\"hasMedia\":true,"
                                + "\"media\":{\"url\":\"http://gw/secret/a\"}}");
        InboundMessage message = WebhookEventParser.message("default", payload);
        assertThat(message.senderPhone()).isNull();
        assertThat(message.senderLid()).isEqualTo("123@lid");
        assertThat(message.mediaPath()).isNull();
        assertThat(message.mediaFailure()).isEqualTo("media_path_refused");
        JsonNode absent =
                json.readTree(
                        "{\"id\":\"A\",\"timestamp\":1,\"from\":\"5562999990000@c.us\",\"hasMedia\":true,\"media\":null}");
        assertThat(WebhookEventParser.message("default", absent).mediaFailure())
                .isEqualTo("media_unavailable");
    }

    @Test
    void parserDiscardsWhatIsNeverRecorded() {
        for (String from :
                List.of("120363@g.us", "status@broadcast", "120363@newsletter", "0@broadcast")) {
            assertThat(
                            WebhookEventParser.message(
                                    "default",
                                    json.readTree(
                                            "{\"id\":\"A\",\"timestamp\":1,\"from\":\"" + from + "\"}")))
                    .as(from)
                    .isNull();
        }
        assertThat(
                        WebhookEventParser.parse(
                                json.readTree(
                                        "{\"event\":\"presence.update\",\"session\":\"default\",\"payload\":{}}")))
                .isInstanceOf(Ignored.class);
        assertThat(
                        WebhookEventParser.parse(
                                json.readTree(
                                        "{\"event\":\"message\",\"session\":\"default\",\"payload\":"
                                                + "{\"id\":\"A\",\"timestamp\":1,\"from\":\"1@c.us\",\"fromMe\":true}}")))
                .isInstanceOf(Ignored.class);
    }

    @Test
    void parserMapsAcknowledgementsAndSessionStates() {
        String template =
                "{\"event\":\"message.ack\",\"session\":\"default\",\"timestamp\":1790000000123,\"payload\":"
                        + "{\"id\":\"true_1@c.us_A\",\"fromMe\":true,\"ack\":%d}}";
        Map<Integer, String> expected =
                Map.of(-1, "FAILED", 1, "SENT", 2, "DELIVERED", 3, "READ", 4, "READ");
        expected.forEach(
                (ack, name) -> {
                    var event = WebhookEventParser.parse(json.readTree(template.formatted(ack)));
                    assertThat(((Delivery) event).status()).isEqualTo(name);
                    assertThat(((Delivery) event).messageId()).isEqualTo("A");
                    assertThat(((Delivery) event).at()).isEqualTo(Instant.ofEpochMilli(1790000000123L));
                });
        assertThat(WebhookEventParser.parse(json.readTree(template.formatted(0))))
                .isInstanceOf(Ignored.class);
        var session =
                WebhookEventParser.parse(
                        json.readTree(
                                "{\"event\":\"session.status\",\"session\":\"default\",\"timestamp\":5,"
                                        + "\"payload\":{\"name\":\"default\",\"status\":\"PASSKEY_REQUIRED\"}}"));
        assertThat(((SessionChanged) session).status()).isEqualTo("PASSKEY_REQUIRED");
    }

    @Test
    void parserRejectsMalformedEvents() {
        for (String event :
                List.of(
                        "[]",
                        "{}",
                        "{\"event\":\"message\",\"session\":\"default\"}",
                        "{\"event\":\"message\",\"session\":\"default\",\"payload\":{\"from\":\"1@c.us\",\"id\":\"A\"}}",
                        "{\"event\":\"session.status\",\"session\":\"default\",\"timestamp\":5,\"payload\":{\"status\":\"X\"}}",
                        "{\"event\":\"message.ack\",\"session\":\"default\",\"payload\":{\"id\":\"A\",\"fromMe\":true,\"ack\":\"x\"}}")) {
            assertThatThrownBy(() -> WebhookEventParser.parse(json.readTree(event)))
                    .as(event)
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void identifiersConvergeAcrossTheirForms() {
        assertThat(WebhookEventParser.shortId("true_1@c.us_ABC")).isEqualTo("ABC");
        assertThat(WebhookEventParser.shortId("false_1@lid_ABC")).isEqualTo("ABC");
        assertThat(WebhookEventParser.shortId("ABC")).isEqualTo("ABC");
    }

    @Test
    void hmacCoversTheRawBytesWithSha512() throws Exception {
        byte[] body = "{\"a\": 1}".getBytes(StandardCharsets.UTF_8);
        Mac mac = Mac.getInstance("HmacSHA512");
        mac.init(new SecretKeySpec("segredo".getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
        String good = HexFormat.of().formatHex(mac.doFinal(body));
        assertThat(WebhookHmacVerifier.valid(good, "segredo", body)).isTrue();
        assertThat(WebhookHmacVerifier.valid(good.toUpperCase(), "segredo", body)).isTrue();
        assertThat(WebhookHmacVerifier.valid(good, "outro", body)).isFalse();
        assertThat(WebhookHmacVerifier.valid(good, "segredo", "{\"a\":1}".getBytes(StandardCharsets.UTF_8)))
                .isFalse();
        assertThat(WebhookHmacVerifier.valid(null, "segredo", body)).isFalse();
        assertThat(WebhookHmacVerifier.valid("abc", "segredo", body)).isFalse();
        assertThat(WebhookHmacVerifier.valid("z".repeat(128), "segredo", body)).isFalse();
        assertThat(WebhookHmacVerifier.valid(good, "", body)).isFalse();
    }

    @Test
    void fileTypeComesFromTheBytes() {
        assertThat(AuthorizationFileType.detect("%PDF-1.7".getBytes(StandardCharsets.US_ASCII)))
                .isEqualTo("application/pdf");
        assertThat(AuthorizationFileType.detect(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0}))
                .isEqualTo("image/jpeg");
        assertThat(AuthorizationFileType.detect("MZ-synthetic".getBytes(StandardCharsets.US_ASCII))).isNull();
        assertThat(AuthorizationFileType.detect(new byte[0])).isNull();
        assertThat(AuthorizationFileType.extension("image/jpeg")).isEqualTo("jpg");
    }
}
