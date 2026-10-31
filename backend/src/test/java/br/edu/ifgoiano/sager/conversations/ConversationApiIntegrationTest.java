package br.edu.ifgoiano.sager.conversations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.edu.ifgoiano.sager.TestIdentity;
import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;
import br.edu.ifgoiano.sager.integrations.IntegrationWorker;

import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "sager.operations.expiry.enabled=false",
            "sager.integrations.worker.enabled=false"
        })
@ActiveProfiles("local")
@Import(ConversationApiIntegrationTest.ClockConfiguration.class)
class ConversationApiIntegrationTest {
    static final Instant START = Instant.parse("2026-10-01T01:00:00Z");
    static final String SECRET = "synthetic-gateway-webhook";
    static final String CHAT = "5562999990000@c.us";
    static final String PASSWORD = "Senha sintética 123!";
    static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 1, 2, 3, 4};
    static final byte[] PDF = "%PDF-1.7 sintético".getBytes(StandardCharsets.UTF_8);
    static final byte[] OGG = "OggS-audio-sintetico".getBytes(StandardCharsets.US_ASCII);
    static final byte[] WEBM = {0x1A, 0x45, (byte) 0xDF, (byte) 0xA3, 1, 2, 3, 4};
    static final byte[] EXECUTABLE = "MZ-synthetic-executable".getBytes(StandardCharsets.US_ASCII);
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");
    static final Path PRIVATE =
            Path.of(System.getProperty("java.io.tmpdir"), "sager-conversations-" + UUID.randomUUID());
    static final GatewayDouble GATEWAY = new GatewayDouble();

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
        r.add("sager.documents.private-root", PRIVATE::toString);
        r.add("sager.integrations.whatsapp.enabled", () -> "true");
        r.add("sager.integrations.whatsapp.base-url", GATEWAY::root);
        r.add("sager.integrations.whatsapp.api-key", () -> "synthetic-gateway-key");
        r.add("sager.integrations.whatsapp.webhook-secret", () -> SECRET);
        r.add("sager.integrations.whatsapp.session", () -> "default");
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired LocalAccountProvisioningService provisioning;
    @Autowired IntegrationWorker integration;
    @Autowired ConversationWorker worker;
    @Autowired MutableClock clock;
    @LocalServerPort int port;
    UUID resident, guardian, room;
    final AtomicInteger messages = new AtomicInteger();

    @BeforeEach
    void fixtures() throws Exception {
        clock.value = START;
        GATEWAY.clear();
        for (String table :
                List.of(
                        "sager_webhook_inbox",
                        "sager_integration_task",
                        "sager_guardian_authorization_file",
                        "sager_whatsapp_job",
                        "sager_whatsapp_message",
                        "sager_whatsapp_conversation",
                        "sager_whatsapp_session",
                        "sager_whatsapp_attempt",
                        "sager_long_exit_resend",
                        "sager_signature_binding",
                        "sager_long_exit_history",
                        "sager_long_exit",
                        "sager_document_version",
                        "sager_local_account",
                        "sager_guardian",
                        "sager_room_allocation",
                        "sager_room",
                        "sager_accommodation",
                        "sager_resident")) {
            jdbc.update("DELETE FROM " + table);
        }
        jdbc.update("DELETE FROM spring_session");
        UUID accommodation = UUID.randomUUID();
        room = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO sager_accommodation(id,code,name) VALUES (?,'CONV','Alojamento sintético')",
                accommodation);
        jdbc.update(
                "INSERT INTO sager_room(id,code,number,accommodation_id,capacity,situation) VALUES"
                        + " (?,'CONV-1','1',?,20,'Disponível')",
                room,
                accommodation);
        resident = resident("CONV-A", "residente");
        guardian = guardian(resident, "Maria Sintética", "+5562999990000");
        for (String p : List.of("supervisor", "gestor")) account(p);
        session("WORKING");
    }

    @Test
    void onlyTheSupervisorReachesAnyRouteIncludingFiles() throws Exception {
        UUID message = received("audio-1", "", OGG, "audio/ogg");
        String file = "/api/v1/conversas/mensagens/" + message + "/midia";
        try (HttpClient anonymous = HttpClient.newHttpClient()) {
            assertThat(get(anonymous, file).statusCode()).isEqualTo(401);
            assertThat(get(anonymous, "/api/v1/conversas").statusCode()).isEqualTo(401);
        }
        for (String profile : List.of("gestor", "residente")) {
            try (HttpClient c = login(profile)) {
                for (String path :
                        List.of(
                                "/api/v1/conversas",
                                file,
                                "/api/v1/conversas/sessao",
                                "/api/v1/conversas/sessao/qr")) {
                    error(get(c, path), 403, "forbidden");
                }
                error(
                        post(c, "/api/v1/conversas", Map.of("guardianId", guardian.toString())),
                        403,
                        "forbidden");
                error(post(c, "/api/v1/conversas/sessao/inicio", Map.of()), 403, "forbidden");
                error(
                        post(
                                c,
                                "/api/v1/conversas/mensagens/" + message + "/vinculo",
                                Map.of("exitId", UUID.randomUUID().toString(), "version", 0)),
                        403,
                        "forbidden");
            }
        }
        assertThat(GATEWAY.posts()).isEmpty();
    }

    @Test
    void listIdentifiesGuardiansAndUnknownNumbersMostRecentFirstAndSearches() throws Exception {
        UUID sibling = resident("CONV-B", "irmao");
        guardian(sibling, "Maria Sintética", "+5562999990000");
        receive(CHAT, "primeira", null, null, null);
        clock.value = START.plusSeconds(60);
        receive("5511988887777@c.us", "número sem cadastro", null, null, null);
        run();
        try (HttpClient c = login("supervisor")) {
            JsonNode items = ok(get(c, "/api/v1/conversas")).path("items");
            assertThat(items).hasSize(2);
            JsonNode unknown = items.get(0), known = items.get(1);
            assertThat(unknown.path("phone").asString()).isEqualTo("+5511988887777");
            assertThat(unknown.path("linked").asBoolean()).isFalse();
            assertThat(unknown.path("guardians")).isEmpty();
            assertThat(known.path("linked").asBoolean()).isTrue();
            assertThat(known.path("guardians")).hasSize(2);
            assertThat(known.toString())
                    .contains("Maria Sintética", "Residente Sintético CONV-A", "Residente Sintético CONV-B");
            assertThat(known.path("lastMessage").path("body").asString()).isEqualTo("primeira");
            assertThat(known.path("unreadCount").asInt()).isEqualTo(1);

            assertThat(search(c, "maria sintetica")).containsExactly("+5562999990000");
            assertThat(search(c, "conv-b")).containsExactly("+5562999990000");
            assertThat(search(c, "98888")).containsExactly("+5511988887777");
            assertThat(search(c, "nenhum")).isEmpty();

            JsonNode page = ok(get(c, "/api/v1/conversas?limit=1"));
            assertThat(page.path("items")).hasSize(1);
            String next = page.path("nextCursor").asString();
            JsonNode rest = ok(get(c, "/api/v1/conversas?limit=1&before=" + encode(next)));
            assertThat(rest.path("items").get(0).path("id").asString())
                    .isEqualTo(known.path("id").asString());
            assertThat(rest.path("nextCursor").isNull()).isTrue();
            error(get(c, "/api/v1/conversas?before=quebrado"), 400, "invalid_input");
            error(get(c, "/api/v1/conversas?limit=500"), 400, "invalid_input");

            UUID id = UUID.fromString(known.path("id").asString());
            assertThat(post(c, "/api/v1/conversas/" + id + "/leitura", Map.of()).statusCode())
                    .isEqualTo(204);
            assertThat(ok(get(c, "/api/v1/conversas/" + id)).path("unreadCount").asInt()).isZero();
        }
    }

    private List<String> search(HttpClient c, String q) throws Exception {
        List<String> phones = new ArrayList<>();
        ok(get(c, "/api/v1/conversas?q=" + encode(q)))
                .path("items")
                .forEach(i -> phones.add(i.path("phone").asString()));
        return phones;
    }

    @Test
    void aGuardianOnAnOlderNumberWithoutTheNinthDigitIsStillRecognized() throws Exception {
        receive("556299990000@c.us", "conta antiga", null, null, null);
        run();
        try (HttpClient c = login("supervisor")) {
            JsonNode item = ok(get(c, "/api/v1/conversas")).path("items").get(0);
            assertThat(item.path("linked").asBoolean()).isTrue();
            assertThat(search(c, "99999")).containsExactly("+556299990000");
        }
    }

    @Test
    void historyIsChronologicalPagedAndKeepsTheBodyAsLiteralText() throws Exception {
        String script = "<script>alert(1)</script>";
        receive(CHAT, script, null, null, null);
        for (int i = 0; i < 3; i++) {
            clock.value = clock.value.plusSeconds(60);
            receive(CHAT, "texto " + i, null, null, null);
        }
        run();
        try (HttpClient c = login("supervisor")) {
            UUID id = conversation(c);
            JsonNode newest = ok(get(c, "/api/v1/conversas/" + id + "/mensagens?limit=2"));
            assertThat(newest.path("items").get(0).path("body").asString()).isEqualTo("texto 1");
            assertThat(newest.path("items").get(1).path("body").asString()).isEqualTo("texto 2");
            JsonNode older =
                    ok(
                            get(
                                    c,
                                    "/api/v1/conversas/"
                                            + id
                                            + "/mensagens?limit=2&before="
                                            + encode(newest.path("nextCursor").asString())));
            assertThat(older.path("items").get(0).path("body").asString()).isEqualTo(script);
            assertThat(older.path("items").get(1).path("kind").asString()).isEqualTo("TEXT");
            assertThat(older.path("nextCursor").isNull()).isTrue();
            error(get(c, "/api/v1/conversas/" + UUID.randomUUID() + "/mensagens"), 404, "not_found");
        }
    }

    @Test
    void receivedAudioPlaysInlineAndOtherFilesComeWithSafeHeaders() throws Exception {
        UUID audio = received("audio", "", OGG, "audio/ogg; codecs=opus");
        UUID image = received("foto", "foto", JPEG, "image/jpeg");
        UUID pdf = received("doc", "", PDF, "application/pdf");
        try (HttpClient c = login("supervisor")) {
            HttpResponse<byte[]> sound = bytes(c, "/api/v1/conversas/mensagens/" + audio + "/midia");
            assertThat(sound.statusCode()).isEqualTo(200);
            assertThat(sound.body()).isEqualTo(OGG);
            assertThat(sound.headers().firstValue("Content-Type").orElseThrow()).isEqualTo("audio/ogg");
            assertThat(sound.headers().firstValue("X-Content-Type-Options").orElseThrow())
                    .isEqualTo("nosniff");
            assertThat(sound.headers().firstValue("Cache-Control").orElseThrow()).contains("no-store");
            assertThat(sound.headers().firstValue("Content-Disposition").orElseThrow())
                    .startsWith("inline");
            assertThat(
                            bytes(c, "/api/v1/conversas/mensagens/" + image + "/midia")
                                    .headers()
                                    .firstValue("Content-Disposition")
                                    .orElseThrow())
                    .startsWith("inline");
            UUID disguised = received("boleto\u202E.hta", "", PDF, "application/pdf");
            assertThat(
                            bytes(c, "/api/v1/conversas/mensagens/" + disguised + "/midia")
                                    .headers()
                                    .firstValue("Content-Disposition")
                                    .orElseThrow())
                    .contains("boleto.pdf")
                    .doesNotContain(".hta");
            HttpResponse<byte[]> document = bytes(c, "/api/v1/conversas/mensagens/" + pdf + "/midia");
            assertThat(document.headers().firstValue("Content-Type").orElseThrow())
                    .isEqualTo("application/pdf");
            assertThat(document.headers().firstValue("Content-Disposition").orElseThrow())
                    .startsWith("attachment");
            JsonNode history =
                    ok(get(c, "/api/v1/conversas/" + conversation(c) + "/mensagens")).path("items");
            assertThat(history.get(0).path("kind").asString()).isEqualTo("AUDIO");
            assertThat(history.get(0).path("linkable").asBoolean()).isFalse();
            assertThat(history.get(1).path("kind").asString()).isEqualTo("IMAGE");
            assertThat(history.get(1).path("linkable").asBoolean()).isTrue();
            assertThat(history.get(2).path("kind").asString()).isEqualTo("DOCUMENT");
        }
    }

    @Test
    void aFileThatCannotBeKeptSaysSoInsteadOfLookingLikeNoAttachment() throws Exception {
        UUID refused = received("virus", "", EXECUTABLE, "image/jpeg");
        GATEWAY.fileStatus = 404;
        receive(CHAT, "", "/api/files/default/sumiu.jpg", "image/jpeg", "sumiu.jpg");
        run();
        GATEWAY.fileStatus = 200;
        GATEWAY.files.put("/api/files/default/grande.jpg", new byte[10485761]);
        clock.value = clock.value.plusSeconds(1);
        receive(CHAT, "", "/api/files/default/grande.jpg", "image/jpeg", "grande.jpg");
        run();
        // A declared audio with unknown bytes is not audio.
        GATEWAY.fileStatus = 200;
        GATEWAY.files.put("/api/files/default/falso.ogg", EXECUTABLE);
        clock.value = clock.value.plusSeconds(1);
        receive(CHAT, "", "/api/files/default/falso.ogg", "audio/ogg", "falso.ogg");
        run();
        try (HttpClient c = login("supervisor")) {
            JsonNode history =
                    ok(get(c, "/api/v1/conversas/" + conversation(c) + "/mensagens")).path("items");
            assertThat(history).hasSize(4);
            assertThat(history.findValuesAsString("mediaState")).containsOnly("FAILED");
            assertThat(history.findValuesAsString("mediaFailureCode"))
                    .contains("media_type_not_allowed", "media_unavailable", "media_too_large");
            error(get(c, "/api/v1/conversas/mensagens/" + refused + "/midia"), 404, "not_found");
        }
    }

    @Test
    void textGoesFromQueueToReadAndConfirmationsOnlyMoveForward() throws Exception {
        try (HttpClient c = login("supervisor")) {
            UUID id = opened(c);
            JsonNode queued = created(send(c, id, "key-text-0001", "Olá, responsável"));
            assertThat(queued.path("deliveryStatus").asString()).isEqualTo("QUEUED");
            assertThat(queued.path("direction").asString()).isEqualTo("OUT");
            assertThat(GATEWAY.posts()).isEmpty();

            worker.runOnce();
            assertThat(GATEWAY.posts()).hasSize(1);
            Call call = GATEWAY.posts().getFirst();
            assertThat(call.path()).isEqualTo("/api/sendText");
            JsonNode body = json.readTree(call.body());
            assertThat(body.path("chatId").asString()).isEqualTo(CHAT);
            assertThat(body.path("text").asString()).isEqualTo("Olá, responsável");
            assertThat(status(c, id)).isEqualTo("SENT");

            ack("MSG1", 3);
            run();
            assertThat(status(c, id)).isEqualTo("READ");
            ack("MSG1", 2);
            ack("MSG1", 1);
            ack("MSG1", -1);
            run();
            assertThat(status(c, id)).isEqualTo("READ");

            worker.runOnce();
            assertThat(GATEWAY.posts()).hasSize(1);
        }
    }

    @Test
    void aDoubleClickWithTheSameKeyCreatesOneMessageAndOneSend() throws Exception {
        try (HttpClient c = login("supervisor")) {
            UUID id = opened(c);
            JsonNode first = created(send(c, id, "key-double-01", "Só uma vez"));
            HttpResponse<String> again = send(c, id, "key-double-01", "Só uma vez");
            assertThat(again.statusCode()).isEqualTo(200);
            assertThat(json.readTree(again.body()).path("id").asString())
                    .isEqualTo(first.path("id").asString());
            error(send(c, id, "key-double-01", "Outro texto"), 409, "idempotency_conflict");
            error(send(c, id, null, "Sem chave"), 400, "invalid_input");
            error(send(c, id, "curta", "Chave curta"), 400, "invalid_input");
            error(send(c, id, "key-nul-000001", "nu\u0000lo"), 400, "invalid_input");
            worker.runOnce();
            worker.runOnce();
            assertThat(GATEWAY.posts()).hasSize(1);
            assertThat(count("sager_whatsapp_message", "direction='OUT'")).isEqualTo(1);
            // The replay still answers once the session is gone: nothing new would be sent.
            GATEWAY.status = "STOPPED";
            assertThat(send(c, id, "key-double-01", "Só uma vez").statusCode()).isEqualTo(200);
        }
    }

    @Test
    void aRefusalShowsTheFailureAndKeepsTheText() throws Exception {
        GATEWAY.sendStatus = 422;
        try (HttpClient c = login("supervisor")) {
            UUID id = opened(c);
            created(send(c, id, "key-refused-1", "Texto que não pode sumir"));
            worker.runOnce();
            JsonNode message = last(c, id);
            assertThat(message.path("deliveryStatus").asString()).isEqualTo("FAILED");
            assertThat(message.path("failureCode").asString()).isEqualTo("provider_http_rejected");
            assertThat(message.path("body").asString()).isEqualTo("Texto que não pode sumir");
            clock.value = clock.value.plusSeconds(3600);
            worker.runOnce();
            assertThat(GATEWAY.posts()).hasSize(1);
        }
    }

    @Test
    void anAmbiguousFailureBecomesUncertainAndIsNeverResent() throws Exception {
        GATEWAY.sendStatus = 500;
        try (HttpClient c = login("supervisor")) {
            UUID id = opened(c);
            created(send(c, id, "key-uncertain", "Talvez tenha ido"));
            worker.runOnce();
            assertThat(status(c, id)).isEqualTo("UNCERTAIN");
            assertThat(count("sager_whatsapp_job", "type='SEND' AND state='UNCERTAIN'")).isEqualTo(1);
            GATEWAY.sendStatus = 200;
            clock.value = clock.value.plusSeconds(86400);
            worker.runOnce();
            assertThat(GATEWAY.posts()).hasSize(1);
        }
    }

    @Test
    void anExpiredLeaseAfterTheSendStartedNeverPostsAgain() throws Exception {
        try (HttpClient c = login("supervisor")) {
            UUID id = opened(c);
            created(send(c, id, "key-lease-001", "Caiu no meio do envio"));
            // A worker that died between claiming and answering leaves exactly this state.
            OffsetDateTime expires = OffsetDateTime.ofInstant(START.plusSeconds(120), ZoneOffset.UTC);
            jdbc.update(
                    "UPDATE sager_whatsapp_job SET state='RUNNING',attempt_count=1,lease_until=?,"
                            + "lease_token=? WHERE type='SEND'",
                    expires,
                    UUID.randomUUID());
            worker.runOnce();
            assertThat(status(c, id)).isEqualTo("QUEUED");

            clock.value = START.plusSeconds(121);
            worker.runOnce();
            assertThat(GATEWAY.posts()).isEmpty();
            JsonNode message = last(c, id);
            assertThat(message.path("deliveryStatus").asString()).isEqualTo("UNCERTAIN");
            assertThat(message.path("failureCode").asString()).isEqualTo("interrupted_external_post");
        }
    }

    @Test
    void aFailureBeforeTheGatewayIsReachedRetriesWithBackoff() throws Exception {
        GATEWAY.sendStatus = 429;
        try (HttpClient c = login("supervisor")) {
            UUID id = opened(c);
            created(send(c, id, "key-retry-0001", "Tente de novo"));
            worker.runOnce();
            assertThat(status(c, id)).isEqualTo("QUEUED");
            worker.runOnce();
            assertThat(GATEWAY.posts()).hasSize(1);
            GATEWAY.sendStatus = 200;
            clock.value = clock.value.plusSeconds(61);
            worker.runOnce();
            assertThat(GATEWAY.posts()).hasSize(2);
            assertThat(status(c, id)).isEqualTo("SENT");
        }
    }

    @Test
    void aConfirmationForASendStillRunningAsksTheGatewayToRetry() throws Exception {
        try (HttpClient c = login("supervisor")) {
            UUID id = opened(c);
            created(send(c, id, "key-inflight-1", "Em andamento"));
            jdbc.update(
                    "UPDATE sager_whatsapp_job SET state='RUNNING',lease_until=?,lease_token=?"
                            + " WHERE type='SEND'",
                    OffsetDateTime.ofInstant(START.plusSeconds(120), ZoneOffset.UTC),
                    UUID.randomUUID());
            byte[] event = ackEvent("ANTES-DA-RESPOSTA", 2);
            assertThat(webhook(event).statusCode()).isEqualTo(503);
            assertThat(count("sager_webhook_inbox", "payload->>'kind'='ACK'")).isZero();
            jdbc.update("UPDATE sager_whatsapp_job SET lease_until=? WHERE type='SEND'",
                    OffsetDateTime.ofInstant(START.minusSeconds(1), ZoneOffset.UTC));
            assertThat(webhook(event).statusCode()).isEqualTo(202);
            assertThat(id).isNotNull();
        }
    }

    @Test
    void imageDocumentAndAudioUseTheirOwnGatewayRoutes() throws Exception {
        try (HttpClient c = login("supervisor")) {
            UUID id = opened(c);
            created(multipart(c, id, "key-image-0001", JPEG, "image/jpeg", "../foto.jpg", "legenda"));
            created(multipart(c, id, "key-doc-000001", PDF, "application/pdf", "termo.pdf", null));
            JsonNode audio =
                    created(multipart(c, id, "key-audio-0001", WEBM, "audio/webm;codecs=opus", "voz.webm", null));
            assertThat(audio.path("kind").asString()).isEqualTo("AUDIO");
            assertThat(audio.path("mediaType").asString()).isEqualTo("audio/webm");
            worker.runOnce();
            assertThat(GATEWAY.posts()).extracting(Call::path)
                    .containsExactlyInAnyOrder("/api/sendImage", "/api/sendFile", "/api/sendVoice");

            JsonNode image = json.readTree(GATEWAY.post("/api/sendImage").body());
            assertThat(image.path("caption").asString()).isEqualTo("legenda");
            assertThat(image.path("file").path("filename").asString()).isEqualTo("foto.jpg");
            assertThat(Base64.getDecoder().decode(image.path("file").path("data").asString()))
                    .isEqualTo(JPEG);
            JsonNode document = json.readTree(GATEWAY.post("/api/sendFile").body());
            assertThat(document.path("file").path("mimetype").asString()).isEqualTo("application/pdf");
            JsonNode voice = json.readTree(GATEWAY.post("/api/sendVoice").body());
            assertThat(voice.path("convert").asBoolean()).isTrue();
            assertThat(voice.path("file").path("mimetype").asString()).isEqualTo("audio/webm");
            assertThat(Base64.getDecoder().decode(voice.path("file").path("data").asString()))
                    .isEqualTo(WEBM);

            // The original recording stays available, whatever the gateway converted.
            HttpResponse<byte[]> original =
                    bytes(c, "/api/v1/conversas/mensagens/" + audio.path("id").asString() + "/midia");
            assertThat(original.body()).isEqualTo(WEBM);
        }
    }

    @Test
    void uploadsOutsideTheAllowedListOrLimitAreRefused() throws Exception {
        try (HttpClient c = login("supervisor")) {
            UUID id = opened(c);
            error(multipart(c, id, "key-exe-000001", EXECUTABLE, "image/jpeg", "a.jpg", null), 400, "invalid_input");
            error(multipart(c, id, "key-heic-00001", heic(), "image/heic", "a.heic", null), 400, "invalid_input");
            error(multipart(c, id, "key-video-0001", WEBM, "video/webm", "a.webm", null), 400, "invalid_input");
            error(multipart(c, id, "key-caption-01", OGG, "audio/ogg", "a.ogg", "legenda"), 400, "invalid_input");
            error(multipart(c, id, null, JPEG, "image/jpeg", "a.jpg", null), 400, "invalid_input");
            byte[] tooBig = new byte[10485761];
            System.arraycopy(JPEG, 0, tooBig, 0, JPEG.length);
            error(multipart(c, id, "key-large-0001", tooBig, "image/jpeg", "a.jpg", null), 413, "file_too_large");
            assertThat(count("sager_whatsapp_message", "direction='OUT'")).isZero();
        }
    }

    private static byte[] heic() {
        return new byte[] {0, 0, 0, 24, 'f', 't', 'y', 'p', 'h', 'e', 'i', 'c', 0, 0};
    }

    @Test
    void sendingIsRefusedWithTheReasonWhileTheSessionIsDownAndHistoryStaysReadable()
            throws Exception {
        receive(CHAT, "guardada", null, null, null);
        run();
        try (HttpClient c = login("supervisor")) {
            UUID id = conversation(c);
            GATEWAY.status = "SCAN_QR_CODE";
            error(send(c, id, "key-down-00001", "Sem sessão"), 503, "session_not_ready");
            JsonNode session = ok(get(c, "/api/v1/conversas/sessao"));
            assertThat(session.path("canSend").asBoolean()).isFalse();
            assertThat(session.path("unavailableReason").asString()).isEqualTo("session_not_ready");
            GATEWAY.sessionStatus = 500;
            error(send(c, id, "key-down-00002", "Sem gateway"), 503, "gateway_unreachable");
            assertThat(ok(get(c, "/api/v1/conversas/" + id + "/mensagens")).path("items")).hasSize(1);
            assertThat(count("sager_whatsapp_message", "direction='OUT'")).isZero();
        }
    }

    @Test
    void messagesSentFromThePhoneAppearAndApiEchoesDoNot() throws Exception {
        try (HttpClient c = login("supervisor")) {
            UUID id = opened(c);
            created(send(c, id, "key-echo-00001", "Pelo sistema"));
            worker.runOnce();
            clock.value = clock.value.plusSeconds(5);
            assertThat(webhook(own("MSG1", "api", "Pelo sistema")).statusCode()).isEqualTo(202);
            assertThat(webhook(own("CELULAR1", "app", "Pelo celular")).statusCode()).isEqualTo(202);
            run();
            JsonNode items = ok(get(c, "/api/v1/conversas/" + id + "/mensagens")).path("items");
            assertThat(items).hasSize(2);
            assertThat(items.get(1).path("body").asString()).isEqualTo("Pelo celular");
            assertThat(items.get(1).path("origin").asString()).isEqualTo("DEVICE");
            assertThat(items.get(1).path("direction").asString()).isEqualTo("OUT");
            assertThat(items.get(1).path("deliveryStatus").asString()).isEqualTo("SENT");
            ack("CELULAR1", 3);
            run();
            assertThat(status(c, id)).isEqualTo("READ");
            // What the phone sent never counts as unread nor as something received.
            assertThat(ok(get(c, "/api/v1/conversas/" + id)).path("unreadCount").asInt()).isZero();
        }
    }

    @Test
    void conversationsStartOnlyWithARegisteredGuardianAfterTheGatewayConfirmsTheNumber()
            throws Exception {
        try (HttpClient c = login("supervisor")) {
            GATEWAY.numberExists = false;
            error(
                    post(c, "/api/v1/conversas", Map.of("guardianId", guardian.toString())),
                    422,
                    "number_not_found");
            assertThat(count("sager_whatsapp_conversation", "true")).isZero();
            assertThat(GATEWAY.posts()).isEmpty();

            error(
                    post(c, "/api/v1/conversas", Map.of("guardianId", UUID.randomUUID().toString())),
                    404,
                    "not_found");
            error(post(c, "/api/v1/conversas", Map.of("phone", "+5562999990000")), 400, "invalid_input");
            UUID former = guardian(resident, "Antigo Responsável", "+5562911110000");
            jdbc.update("UPDATE sager_guardian SET active=false WHERE id=?", former);
            error(post(c, "/api/v1/conversas", Map.of("guardianId", former.toString())), 404, "not_found");

            GATEWAY.numberExists = true;
            HttpResponse<String> started =
                    post(c, "/api/v1/conversas", Map.of("guardianId", guardian.toString()));
            JsonNode conversation = created(started);
            assertThat(conversation.path("chatId").asString()).isEqualTo(CHAT);
            assertThat(conversation.path("linked").asBoolean()).isTrue();
            assertThat(GATEWAY.posts()).isEmpty();
            assertThat(
                            post(c, "/api/v1/conversas", Map.of("guardianId", guardian.toString()))
                                    .statusCode())
                    .isEqualTo(200);
            assertThat(count("sager_whatsapp_conversation", "true")).isEqualTo(1);
        }
    }

    @Test
    void onlyAConfirmedMissingNumberIsReportedAsNotFound() throws Exception {
        try (HttpClient c = login("supervisor")) {
            Map<String, String> start = Map.of("guardianId", guardian.toString());
            for (int status : List.of(400, 401, 403, 404, 500)) {
                GATEWAY.checkStatus = status;
                error(post(c, "/api/v1/conversas", start), 503, "gateway_unreachable");
            }
            GATEWAY.checkStatus = 422;
            error(post(c, "/api/v1/conversas", start), 503, "session_not_ready");
            assertThat(count("sager_whatsapp_conversation", "true")).isZero();
        }
    }

    @Test
    void aFileBecomesACandidateOfTheChosenOpenExitAndAuthorizationStaysPending() throws Exception {
        UUID sibling = resident("CONV-B", "irmao");
        UUID secondGuardian = guardian(sibling, "Maria Sintética", "+5562999990000");
        JsonNode first, second;
        try (HttpClient student = login("residente")) {
            first = created(post(student, "/api/v1/saidas-longas", plan(guardian)));
        }
        try (HttpClient student = login("irmao")) {
            second = created(post(student, "/api/v1/saidas-longas", plan(secondGuardian)));
        }
        run();
        worker.runOnce();
        integration.runOnce();
        clock.value = clock.value.plusSeconds(60);
        // Two open exits: the correlation cannot choose, so the file waits for a person.
        UUID photo = received("foto-vinculo", "", JPEG, "image/jpeg");
        UUID audio = received("audio-vinculo", "", OGG, "audio/ogg");
        assertThat(count("sager_guardian_authorization_file", "true")).isZero();
        try (HttpClient c = login("supervisor")) {
            UUID id = conversation(c);
            JsonNode open = ok(get(c, "/api/v1/conversas/" + id + "/saidas-abertas"));
            assertThat(open).hasSize(2);
            UUID exit = UUID.fromString(first.path("id").asString());
            long version = first.path("version").asLong();
            HttpResponse<String> linked =
                    post(
                            c,
                            "/api/v1/conversas/mensagens/" + photo + "/vinculo",
                            Map.of("exitId", exit.toString(), "version", version));
            assertThat(linked.statusCode()).describedAs(linked.body()).isEqualTo(200);
            JsonNode view = json.readTree(linked.body());
            assertThat(view.path("signatureStatus").asString()).isEqualTo("PENDING");
            assertThat(view.path("status").asString()).isEqualTo("AGUARDANDO_ANALISE");
            assertThat(
                            count(
                                    "sager_guardian_authorization_file",
                                    "exit_id='" + exit + "' AND state='CANDIDATE' AND message_id='" + photo + "'"))
                    .isEqualTo(1);
            assertThat(ok(get(c, "/api/v1/conversas/" + id + "/mensagens")).path("items").get(0)
                            .path("linkable").asBoolean())
                    .isFalse();

            UUID other = UUID.fromString(second.path("id").asString());
            error(
                    post(
                            c,
                            "/api/v1/conversas/mensagens/" + audio + "/vinculo",
                            Map.of("exitId", other.toString(), "version", second.path("version").asLong())),
                    400,
                    "invalid_input");
            jdbc.update(
                    "UPDATE sager_long_exit SET status='REJEITADA',decision='REJECT',decided_at=?,"
                            + "decision_comment='Recusa sintética do pedido' WHERE id=?",
                    OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC),
                    other);
            UUID newer = received("foto-fechada", "", JPEG, "image/jpeg");
            error(
                    post(
                            c,
                            "/api/v1/conversas/mensagens/" + newer + "/vinculo",
                            Map.of("exitId", other.toString(), "version", second.path("version").asLong())),
                    409,
                    "exit_not_open");
            error(
                    post(
                            c,
                            "/api/v1/conversas/mensagens/" + UUID.randomUUID() + "/vinculo",
                            Map.of("exitId", other.toString(), "version", 0)),
                    404,
                    "not_found");
        }
    }

    @Test
    void audioNeverBecomesAnAuthorizationCandidateEvenWithASingleOpenExit() throws Exception {
        JsonNode exit;
        try (HttpClient student = login("residente")) {
            exit = created(post(student, "/api/v1/saidas-longas", plan(guardian)));
        }
        clock.value = clock.value.plusSeconds(60);
        UUID audio = received("so-audio", "", OGG, "audio/ogg");
        assertThat(count("sager_guardian_authorization_file", "true")).isZero();
        try (HttpClient c = login("supervisor")) {
            JsonNode unlinked =
                    ok(get(c, "/api/v1/saidas-longas/" + exit.path("id").asString() + "/autorizacao/nao-vinculados"));
            assertThat(unlinked.toString()).doesNotContain(audio.toString());
            error(
                    post(
                            c,
                            "/api/v1/saidas-longas/" + exit.path("id").asString() + "/autorizacao/vinculos",
                            Map.of("version", exit.path("version").asLong(), "messageId", audio.toString())),
                    404,
                    "not_found");
        }
        // With a single open exit, an image still correlates as before.
        received("foto-unica", "", JPEG, "image/jpeg");
        assertThat(count("sager_guardian_authorization_file", "state='CANDIDATE'")).isEqualTo(1);
    }

    @Test
    void anExitOfAnotherGuardianCannotReceiveThisConversationsFile() throws Exception {
        UUID other = guardian(resident, "Outro Responsável", "+5511977776666");
        JsonNode exit;
        try (HttpClient student = login("residente")) {
            exit = created(post(student, "/api/v1/saidas-longas", plan(other)));
        }
        clock.value = clock.value.plusSeconds(60);
        UUID photo = received("foto-alheia", "", JPEG, "image/jpeg");
        // The PDF sent to the other guardian opens a conversation of its own.
        UUID conversation =
                jdbc.queryForObject(
                        "SELECT conversation_id FROM sager_whatsapp_message WHERE id=?",
                        UUID.class,
                        photo);
        try (HttpClient c = login("supervisor")) {
            assertThat(ok(get(c, "/api/v1/conversas/" + conversation + "/saidas-abertas"))).isEmpty();
            error(
                    post(
                            c,
                            "/api/v1/conversas/mensagens/" + photo + "/vinculo",
                            Map.of("exitId", exit.path("id").asString(), "version", exit.path("version").asLong())),
                    409,
                    "exit_not_open");
        }
    }

    @Test
    void sessionRoutesReportStateStartTheSessionAndAuditTheQr() throws Exception {
        try (HttpClient c = login("supervisor")) {
            long reads = count("sager_audit_event", "resource='WHATSAPP_SESSION' AND action='READ'");
            long starts = count("sager_audit_event", "resource='WHATSAPP_SESSION' AND action='UPDATE'");
            JsonNode session = ok(get(c, "/api/v1/conversas/sessao"));
            assertThat(session.path("available").asBoolean()).isTrue();
            assertThat(session.path("status").asString()).isEqualTo("WORKING");
            assertThat(session.path("canSend").asBoolean()).isTrue();

            ok(post(c, "/api/v1/conversas/sessao/inicio", Map.of()));
            assertThat(GATEWAY.calls).extracting(Call::path).contains("/api/sessions/default/start");

            HttpResponse<byte[]> qr = bytes(c, "/api/v1/conversas/sessao/qr");
            assertThat(qr.statusCode()).isEqualTo(200);
            assertThat(qr.headers().firstValue("Content-Type").orElseThrow()).isEqualTo("image/png");
            assertThat(qr.headers().firstValue("Cache-Control").orElseThrow()).contains("no-store");
            assertThat(qr.headers().firstValue("X-Content-Type-Options").orElseThrow()).isEqualTo("nosniff");
            assertThat(
                            count(
                                    "sager_audit_event",
                                    "resource='WHATSAPP_SESSION' AND action='READ' AND actor_id IS NOT NULL"
                                            + " AND changed_fields @> ARRAY['qrRead']"))
                    .isEqualTo(reads + 1);
            assertThat(count("sager_audit_event", "resource='WHATSAPP_SESSION' AND action='UPDATE'"))
                    .isEqualTo(starts + 1);

            GATEWAY.qrStatus = 422;
            error(get(c, "/api/v1/conversas/sessao/qr"), 409, "qr_unavailable");
        }
    }

    @Test
    void auditRecordsWhoSentAndStartedWithoutEverHoldingTheContent() throws Exception {
        String secret = "conteúdo-que-nunca-vai-para-auditoria";
        try (HttpClient c = login("supervisor")) {
            UUID id = opened(c);
            JsonNode message = created(send(c, id, "key-audit-0001", secret));
            worker.runOnce();
            UUID supervisor =
                    jdbc.queryForObject(
                            "SELECT created_by FROM sager_whatsapp_message WHERE id=?::uuid",
                            UUID.class,
                            message.path("id").asString());
            assertThat(
                            count(
                                    "sager_audit_event",
                                    "resource='WHATSAPP_MESSAGE' AND action='CREATE' AND actor_id='"
                                            + supervisor
                                            + "' AND resource_id='"
                                            + message.path("id").asString()
                                            + "'"))
                    .isEqualTo(1);
            assertThat(
                            count(
                                    "sager_audit_event",
                                    "resource='WHATSAPP_CONVERSATION' AND action='CREATE' AND actor_id='"
                                            + supervisor
                                            + "' AND resource_id='"
                                            + id
                                            + "'"))
                    .isEqualTo(1);
            assertThat(
                            count(
                                    "sager_audit_event",
                                    "resource='WHATSAPP_MESSAGE' AND action='UPDATE' AND actor_id IS NULL"
                                            + " AND resource_id='"
                                            + message.path("id").asString()
                                            + "'"))
                    .isEqualTo(1);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT COUNT(*) FROM sager_audit_event a WHERE a::text LIKE ?",
                                    Long.class,
                                    "%" + secret + "%"))
                    .isZero();
            JsonNode audit =
                    ok(get(c, "/api/v1/auditoria?resource=WHATSAPP_MESSAGE&resourceId="
                            + message.path("id").asString()));
            assertThat(audit.path("items")).hasSize(2);
            assertThat(audit.toString()).doesNotContain(secret);
        }
    }

    @Test
    void aLidContactResolvesToItsPhoneAndJoinsTheExistingConversation() throws Exception {
        GATEWAY.lids.put("777@lid", "5562999990000@c.us");
        try (HttpClient c = login("supervisor")) {
            UUID id = opened(c);
            clock.value = clock.value.plusSeconds(60);
            receive("777@lid", "resposta por LID", null, null, null);
            run();
            assertThat(count("sager_whatsapp_conversation", "true")).isEqualTo(2);

            integration.reconcileOnce();
            assertThat(count("sager_whatsapp_conversation", "true")).isEqualTo(1);
            JsonNode items = ok(get(c, "/api/v1/conversas/" + id + "/mensagens")).path("items");
            assertThat(items.get(0).path("body").asString()).isEqualTo("resposta por LID");

            // Later answers through the LID stay in the same conversation.
            clock.value = clock.value.plusSeconds(60);
            receive("777@lid", "outra", null, null, null);
            run();
            assertThat(count("sager_whatsapp_conversation", "true")).isEqualTo(1);
            assertThat(ok(get(c, "/api/v1/conversas/" + id + "/mensagens")).path("items")).hasSize(2);
        }
    }

    @Test
    void anUnknownLidRemainsUnlinkedUntilTheGatewayKnowsIt() throws Exception {
        receive("888@lid", "quem é?", null, null, null);
        run();
        integration.reconcileOnce();
        try (HttpClient c = login("supervisor")) {
            JsonNode item = ok(get(c, "/api/v1/conversas")).path("items").get(0);
            assertThat(item.path("phone").isNull()).isTrue();
            assertThat(item.path("linked").asBoolean()).isFalse();
            assertThat(item.path("chatId").asString()).isEqualTo("888@lid");
        }
    }

    @Test
    void outgoingMessagesObeyTheMigrationConstraints() {
        UUID conversation = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.ofInstant(START, ZoneOffset.UTC);
        jdbc.update(
                "INSERT INTO sager_whatsapp_conversation(id,provider,session,chat_id,created_at,updated_at)"
                        + " VALUES (?,'WHATSAPP_GATEWAY','default',?,?,?)",
                conversation,
                CHAT,
                now,
                now);
        String insert =
                "INSERT INTO sager_whatsapp_message(id,conversation_id,provider,session,provider_message_id,"
                        + "direction,origin,media_state,sent_at,received_at,delivery_status)"
                        + " VALUES (?,?,'WHATSAPP_GATEWAY','default',?,?,?,'NONE',?,?,?)";
        assertThatThrownBy(
                        () ->
                                jdbc.update(insert, UUID.randomUUID(), conversation, null, "OUT", "SUPERVISOR", now, now, null))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(
                        () ->
                                jdbc.update(insert, UUID.randomUUID(), conversation, null, "OUT", "SUPERVISOR", now, now, "SENT"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(
                        () ->
                                jdbc.update(insert, UUID.randomUUID(), conversation, "X", "IN", "WEBHOOK", now, now, "SENT"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbc.update(insert, UUID.randomUUID(), conversation, null, "OUT", "SUPERVISOR", now, now, "QUEUED"))
                .isEqualTo(1);
    }

    private UUID opened(HttpClient c) throws Exception {
        return UUID.fromString(
                created(post(c, "/api/v1/conversas", Map.of("guardianId", guardian.toString())))
                        .path("id")
                        .asString());
    }

    private UUID conversation(HttpClient c) throws Exception {
        return UUID.fromString(
                ok(get(c, "/api/v1/conversas")).path("items").get(0).path("id").asString());
    }

    private String status(HttpClient c, UUID id) throws Exception {
        return last(c, id).path("deliveryStatus").asString();
    }

    private JsonNode last(HttpClient c, UUID id) throws Exception {
        JsonNode items = ok(get(c, "/api/v1/conversas/" + id + "/mensagens")).path("items");
        return items.get(items.size() - 1);
    }

    private HttpResponse<String> send(HttpClient c, UUID id, String key, String text) throws Exception {
        HttpRequest.Builder request =
                request("/api/v1/conversas/" + id + "/mensagens", csrf(c))
                        .POST(
                                HttpRequest.BodyPublishers.ofString(
                                        json.writeValueAsString(Map.of("text", text))));
        if (key != null) request.header("Idempotency-Key", key);
        return c.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> multipart(
            HttpClient c, UUID id, String key, byte[] file, String type, String name, String text)
            throws Exception {
        String boundary = "sintetico" + UUID.randomUUID();
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        if (text != null)
            body.write(
                    ("--" + boundary + "\r\nContent-Disposition: form-data; name=\"text\"\r\n\r\n" + text + "\r\n")
                            .getBytes(StandardCharsets.UTF_8));
        body.write(
                ("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\""
                                + name
                                + "\"\r\nContent-Type: " + type + "\r\n\r\n")
                        .getBytes(StandardCharsets.UTF_8));
        body.write(file);
        body.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        HttpRequest.Builder request =
                HttpRequest.newBuilder(uri("/api/v1/conversas/" + id + "/mensagens"))
                        .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                        .header("X-CSRF-TOKEN", csrf(c))
                        .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray()));
        if (key != null) request.header("Idempotency-Key", key);
        return c.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private UUID received(String name, String body, byte[] file, String type) throws Exception {
        String path = "/api/files/default/" + name;
        GATEWAY.files.put(path, file);
        clock.value = clock.value.plusSeconds(1);
        String id = receive(CHAT, body, path, type, name);
        run();
        return jdbc.queryForObject(
                "SELECT id FROM sager_whatsapp_message WHERE provider_message_id=?", UUID.class, id);
    }

    private String receive(String chat, String body, String path, String type, String filename)
            throws Exception {
        String id = "IN" + messages.incrementAndGet();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", "false_" + chat + "_" + id);
        payload.put("timestamp", clock.instant().getEpochSecond());
        payload.put("from", chat);
        payload.put("fromMe", false);
        payload.put("body", body);
        payload.put("hasMedia", path != null);
        if (path != null)
            payload.put(
                    "media",
                    Map.of("url", GATEWAY.root() + path, "mimetype", type, "filename", filename));
        assertThat(webhook(envelope("message.any", payload)).statusCode()).isEqualTo(202);
        return id;
    }

    private byte[] own(String id, String source, String body) throws Exception {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", "true_" + CHAT + "_" + id);
        payload.put("timestamp", clock.instant().getEpochSecond());
        payload.put("from", "5562000000000@c.us");
        payload.put("to", CHAT);
        payload.put("fromMe", true);
        payload.put("source", source);
        payload.put("body", body);
        payload.put("hasMedia", false);
        return envelope("message.any", payload);
    }

    private void ack(String id, int ack) throws Exception {
        assertThat(webhook(ackEvent(id, ack)).statusCode()).isEqualTo(202);
    }

    private byte[] ackEvent(String id, int ack) throws Exception {
        return envelope(
                "message.ack", Map.of("id", "true_" + CHAT + "_" + id, "fromMe", true, "ack", ack));
    }

    private void session(String status) throws Exception {
        assertThat(
                        webhook(envelope("session.status", Map.of("name", "default", "status", status)))
                                .statusCode())
                .isEqualTo(202);
    }

    private byte[] envelope(String event, Map<String, ?> payload) throws Exception {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("id", "evt_" + UUID.randomUUID());
        v.put("timestamp", clock.instant().toEpochMilli());
        v.put("session", "default");
        v.put("event", event);
        v.put("payload", payload);
        return json.writeValueAsBytes(v);
    }

    private HttpResponse<String> webhook(byte[] body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA512");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
        try (HttpClient anonymous = HttpClient.newHttpClient()) {
            return anonymous.send(
                    HttpRequest.newBuilder(uri("/api/v1/integracoes/whatsapp/webhook"))
                            .header("Content-Type", "application/json")
                            .header("X-Webhook-Hmac", HexFormat.of().formatHex(mac.doFinal(body)))
                            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                            .build(),
                    HttpResponse.BodyHandlers.ofString());
        }
    }

    private void run() {
        integration.runOnce();
    }

    private long count(String table, String where) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE " + where, Long.class);
    }

    private Map<String, Object> plan(UUID chosen) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("departureMode", "NOW");
        v.put("expectedReturnAt", clock.instant().plusSeconds(4 * 3600).toString());
        v.put("reason", "Visita familiar sintética");
        v.put("guardianId", chosen.toString());
        return v;
    }

    private UUID resident(String enrollment, String login) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO sager_resident(id,name,enrollment,birth_date) VALUES (?,?,?,?)",
                id,
                "Residente Sintético " + enrollment,
                enrollment,
                LocalDate.of(2009, 1, 1));
        jdbc.update(
                "INSERT INTO sager_room_allocation(id,resident_id,room_id,started_at) VALUES (?,?,?,?)",
                UUID.randomUUID(),
                id,
                room,
                OffsetDateTime.ofInstant(START.minusSeconds(86400), ZoneOffset.UTC));
        account(login);
        provisioning.linkResident(login + "@example.invalid", id);
        return id;
    }

    private UUID guardian(UUID owner, String name, String phone) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO sager_guardian(id,resident_id,name,relationship,phone,active) VALUES"
                        + " (?,?,?,'Mãe',?,true)",
                id,
                owner,
                name,
                phone);
        return id;
    }

    private void account(String name) {
        provisioning.create(
                TestIdentity.enrollment(name + "@example.invalid"),
                name + "@example.invalid",
                "Pessoa sintética",
                "irmao".equals(name) ? "residente" : name,
                PASSWORD.toCharArray());
    }

    private HttpClient login(String profile) throws Exception {
        HttpClient c =
                HttpClient.newBuilder()
                        .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
                        .build();
        String body =
                "matricula="
                        + encode(TestIdentity.enrollment(profile + "@example.invalid"))
                        + "&password="
                        + encode(PASSWORD);
        assertThat(
                        c.send(
                                        HttpRequest.newBuilder(uri("/api/v1/auth/login"))
                                                .header("Content-Type", "application/x-www-form-urlencoded")
                                                .header("X-CSRF-TOKEN", csrf(c))
                                                .POST(HttpRequest.BodyPublishers.ofString(body))
                                                .build(),
                                        HttpResponse.BodyHandlers.ofString())
                                .statusCode())
                .isEqualTo(204);
        return c;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private URI uri(String p) {
        return URI.create("http://127.0.0.1:" + port + p);
    }

    private String csrf(HttpClient c) throws Exception {
        return ok(get(c, "/api/v1/auth/csrf")).path("token").asString();
    }

    private HttpRequest.Builder request(String p, String csrf) {
        return HttpRequest.newBuilder(uri(p))
                .header("Content-Type", "application/json")
                .header("X-CSRF-TOKEN", csrf);
    }

    private HttpResponse<String> get(HttpClient c, String p) throws Exception {
        return c.send(
                HttpRequest.newBuilder(uri(p)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<byte[]> bytes(HttpClient c, String p) throws Exception {
        return c.send(
                HttpRequest.newBuilder(uri(p)).GET().build(),
                HttpResponse.BodyHandlers.ofByteArray());
    }

    private HttpResponse<String> post(HttpClient c, String p, Map<String, ?> b) throws Exception {
        return c.send(
                request(p, csrf(c))
                        .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(b)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode ok(HttpResponse<String> r) throws Exception {
        assertThat(r.statusCode()).describedAs(r.body()).isEqualTo(200);
        return json.readTree(r.body());
    }

    private JsonNode created(HttpResponse<String> r) throws Exception {
        assertThat(r.statusCode()).describedAs(r.body()).isEqualTo(201);
        return json.readTree(r.body());
    }

    private void error(HttpResponse<String> r, int s, String code) throws Exception {
        assertThat(r.statusCode()).describedAs(r.body()).isEqualTo(s);
        assertThat(json.readTree(r.body()).path("code").asString()).isEqualTo(code);
    }

    @TestConfiguration
    static class ClockConfiguration {
        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock();
        }
    }

    static class MutableClock extends Clock {
        volatile Instant value = START;

        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        public Clock withZone(ZoneId z) {
            return Clock.fixed(value, z);
        }

        public Instant instant() {
            return value;
        }
    }

    record Call(String method, String path, byte[] body) {}

    /** Plays the gateway over real HTTP, in the shapes of the pinned image's contract. */
    static class GatewayDouble {
        final ObjectMapper mapper = new ObjectMapper();
        final List<Call> calls = new CopyOnWriteArrayList<>();
        final Map<String, byte[]> files = new ConcurrentHashMap<>();
        final Map<String, String> lids = new ConcurrentHashMap<>();
        final AtomicInteger sequence = new AtomicInteger();
        volatile int sendStatus = 201;
        volatile int fileStatus = 200;
        volatile int qrStatus = 200;
        volatile int sessionStatus = 200;
        volatile int checkStatus = 200;
        volatile boolean numberExists = true;
        volatile String status = "WORKING";
        final HttpServer http;

        GatewayDouble() {
            try {
                http = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            } catch (IOException failure) {
                throw new IllegalStateException(failure);
            }
            http.createContext(
                    "/",
                    exchange -> {
                        byte[] body = exchange.getRequestBody().readAllBytes();
                        String path = exchange.getRequestURI().getPath();
                        String query = exchange.getRequestURI().getRawQuery();
                        calls.add(new Call(exchange.getRequestMethod(), path, body));
                        int code = 200;
                        Object result = Map.of();
                        byte[] raw = null;
                        if (path.matches("/api/send(Text|Image|File|Voice)")) {
                            code = sendStatus;
                            String chat = mapper.readTree(body).path("chatId").asString();
                            result = Map.of("id", "true_" + chat + "_MSG" + sequence.incrementAndGet());
                        } else if (path.equals("/api/contacts/check-exists")) {
                            code = checkStatus;
                            String phone = query.replaceAll(".*phone=([0-9]+).*", "$1");
                            result =
                                    numberExists
                                            ? Map.of("numberExists", true, "chatId", phone + "@c.us")
                                            : Map.of("numberExists", false);
                        } else if (path.endsWith("/start")) {
                            result = Map.of("name", "default", "status", "STARTING");
                        } else if (path.equals("/api/sessions/default")) {
                            code = sessionStatus;
                            result = Map.of("name", "default", "status", status);
                        } else if (path.endsWith("/auth/qr")) {
                            code = qrStatus;
                            raw = new byte[] {(byte) 0x89, 'P', 'N', 'G'};
                        } else if (path.contains("/lids/")) {
                            Map<String, Object> value = new LinkedHashMap<>();
                            value.put("pn", lids.get(path.substring(path.lastIndexOf('/') + 1)));
                            result = value;
                        } else if (path.startsWith("/api/files/") && fileStatus != 200) {
                            code = fileStatus;
                        } else if (files.containsKey(path)) {
                            raw = files.get(path);
                        } else {
                            code = 404;
                        }
                        byte[] value = raw == null ? mapper.writeValueAsBytes(result) : raw;
                        exchange.sendResponseHeaders(code, value.length);
                        try (var out = exchange.getResponseBody()) {
                            out.write(value);
                        }
                        exchange.close();
                    });
            http.start();
        }

        String root() {
            return "http://127.0.0.1:" + http.getAddress().getPort();
        }

        List<Call> posts() {
            return calls.stream().filter(c -> c.path().matches("/api/send(Text|Image|File|Voice)")).toList();
        }

        Call post(String path) {
            return posts().stream().filter(c -> c.path().equals(path)).findFirst().orElseThrow();
        }

        void clear() {
            calls.clear();
            files.clear();
            lids.clear();
            sequence.set(0);
            sendStatus = 201;
            checkStatus = 200;
            fileStatus = 200;
            qrStatus = 200;
            sessionStatus = 200;
            numberExists = true;
            status = "WORKING";
        }
    }
}
