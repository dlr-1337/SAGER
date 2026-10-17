package br.edu.ifgoiano.sager.integrations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;

import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "sager.operations.expiry.enabled=false",
            "sager.integrations.worker.enabled=false",
            "sager.integrations.clicksign.webhook-secret=synthetic-click-webhook",
            "sager.integrations.whatsapp.app-secret=synthetic-meta-app",
            "sager.integrations.whatsapp.verify-token=synthetic-meta-verify",
            "sager.integrations.whatsapp.waba-id=777",
            "sager.integrations.whatsapp.phone-number-id=888"
        })
@ActiveProfiles("local")
@Import(IntegrationFlowIntegrationTest.ProviderDoubles.class)
class IntegrationFlowIntegrationTest {
    static final Instant START = Instant.parse("2026-10-01T01:00:00Z");
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");
    static final Path PRIVATE =
            Path.of(System.getProperty("java.io.tmpdir"), "sager-f4-flow-" + UUID.randomUUID());

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
        r.add("sager.documents.private-root", PRIVATE::toString);
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired LocalAccountProvisioningService provisioning;
    @Autowired ApplicationContext context;
    @Autowired MutableClock clock;
    @Autowired StatefulDouble server;
    @LocalServerPort int port;
    UUID resident, guardian;

    @BeforeEach
    void fixtures() {
        clock.value = START;
        server.clear();
        // The integration with disciplinary evidence must not leave origin references in fixtures.
        jdbc.execute("TRUNCATE sager_occurrence,sager_warning,sager_notice,sager_commitment_term,"
                + "sager_communication,sager_discipline_idempotency RESTART IDENTITY CASCADE");
        for (String table :
                List.of(
                        "sager_webhook_inbox",
                        "sager_integration_task",
                        "sager_whatsapp_attempt",
                        "sager_long_exit_resend",
                        "sager_signature_binding",
                        "sager_long_exit_history",
                        "sager_long_exit",
                        "sager_document_version",
                        "sager_short_exit_history",
                        "sager_short_exit",
                        "sager_local_account",
                        "sager_guardian",
                        "sager_room_allocation",
                        "sager_room",
                        "sager_accommodation",
                        "sager_resident")) {
            if (Boolean.TRUE.equals(
                    jdbc.queryForObject("SELECT to_regclass(?) IS NOT NULL", Boolean.class, table)))
                jdbc.update("DELETE FROM " + table);
        }
        jdbc.update("DELETE FROM spring_session");
        UUID accommodation = UUID.randomUUID(), room = UUID.randomUUID();
        resident = UUID.randomUUID();
        guardian = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO sager_accommodation(id,code,name) VALUES (?,'FLOW','Alojamento"
                        + " sintético')",
                accommodation);
        jdbc.update(
                "INSERT INTO sager_room(id,code,number,accommodation_id,capacity,situation) VALUES"
                        + " (?,'FLOW-1','1',?,20,'Disponível')",
                room,
                accommodation);
        jdbc.update(
                "INSERT INTO sager_resident(id,name,enrollment,birth_date) VALUES (?,'Residente"
                        + " sintético','FLOW-A',?)",
                resident,
                LocalDate.of(2009, 1, 1));
        jdbc.update(
                "INSERT INTO sager_room_allocation(id,resident_id,room_id,started_at) VALUES"
                        + " (?,?,?,?)",
                UUID.randomUUID(),
                resident,
                room,
                OffsetDateTime.ofInstant(START.minusSeconds(86400), ZoneOffset.UTC));
        jdbc.update(
                "INSERT INTO sager_guardian(id,resident_id,name,relationship,phone,active) VALUES"
                        + " (?,?,'Responsável sintético','Mãe','+5562999990000',true)",
                guardian,
                resident);
        for (String p : List.of("residente", "supervisor", "gestor"))
            provisioning.create(
                    br.edu.ifgoiano.sager.TestIdentity.enrollment(p + "@example.invalid"), p + "@example.invalid",
                    "Pessoa sintética",
                    p,
                    "Senha sintética 123!".toCharArray());
        provisioning.linkResident("residente@example.invalid", resident);
    }

    @Test
    void durablePipelineConfirmsApiEvidenceStoresExactSignedPdfAndRequiresHumanApproval()
            throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            JsonNode exit = create(student, 4 * 3600);
            UUID id = uuid(exit, "id");
            assertThat(exit.path("signatureStatus").asText()).isEqualTo("PENDING");
            run();
            assertThat(count("sager_integration_task", "state='SUCCEEDED'")).isEqualTo(2);
            assertThat(count("sager_signature_binding", "status='VALID'")).isZero();
            String token = server.lastToken;
            assertThat(token).hasSize(43);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT token_hash FROM sager_signature_binding", String.class))
                    .isEqualTo(CapabilityTokens.hash(token));
            assertThat(count("sager_webhook_inbox", "TRUE")).isZero();
            JsonNode access = capability(token, "/api/v1/assinaturas/acesso", 200);
            assertThat(access.path("widget").path("available").asBoolean()).isTrue();
            assertThat(access.path("widget").path("environment").asText()).isEqualTo("sandbox");
            assertThat(access.toString())
                    .doesNotContain(token, "tokenHash", "envelopeId", "providerDocumentId");
            assertThat(
                            capabilityPost(
                                            token,
                                            "/api/v1/assinaturas/acesso",
                                            Map.of("signatureStatus", "VALID"))
                                    .statusCode())
                    .isIn(403, 404, 405);
            JsonNode pending = read(supervisor, id);
            error(
                    post(supervisor, path(id, "decisao"), approval(pending)),
                    409,
                    "signature_required");
            Doc doc = server.onlyDoc();
            server.sign(doc, clock.instant().plusSeconds(60));
            clock.value = START.plusSeconds(120);
            byte[] body = clickWebhook(doc, "document_closed");
            assertThat(webhook("clicksign", body, "synthetic-click-webhook").statusCode())
                    .isEqualTo(202);
            assertThat(webhook("clicksign", body, "synthetic-click-webhook").statusCode())
                    .isEqualTo(202);
            assertThat(count("sager_webhook_inbox", "TRUE")).isEqualTo(1);
            assertThat(count("sager_signature_binding", "status='VALID'")).isZero();
            run();
            JsonNode verified = read(supervisor, id);
            assertThat(verified.path("signatureStatus").asText()).isEqualTo("VALID");
            assertThat(verified.path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
            assertThat(verified.path("capabilities").path("canApprove").asBoolean()).isTrue();
            assertThat(verified.path("currentDocument").path("signedState").asText())
                    .isEqualTo("STORED");
            String stored =
                    jdbc.queryForObject(
                            "SELECT signed_file_id::text FROM sager_document_version",
                            String.class);
            assertThat(Files.readAllBytes(PRIVATE.resolve(UUID.fromString(stored).toString())))
                    .isEqualTo(doc.signed);
            JsonNode approved =
                    response(post(supervisor, path(id, "decisao"), approval(verified)), 200);
            assertThat(approved.path("status").asText()).isEqualTo("APROVADA");
            JsonNode departed =
                    response(
                            post(
                                    supervisor,
                                    path(id, "partida"),
                                    Map.of(
                                            "version",
                                            approved.path("version").asLong(),
                                            "timeMode",
                                            "NOW")),
                            200);
            clock.value = START.plusSeconds(4 * 3600 + 60);
            error(
                    post(
                            supervisor,
                            path(id, "retorno"),
                            Map.of(
                                    "version",
                                    departed.path("version").asLong(),
                                    "timeMode",
                                    "NOW")),
                    400,
                    "invalid_input");
            JsonNode returned =
                    response(
                            post(
                                    supervisor,
                                    path(id, "retorno"),
                                    Map.of(
                                            "version",
                                            departed.path("version").asLong(),
                                            "timeMode",
                                            "NOW",
                                            "lateObservation",
                                            "Retorno tardio conferido presencialmente")),
                            200);
            assertThat(returned.path("status").asText()).isEqualTo("RETORNO_CONFIRMADO_COM_ATRASO");
            assertThat(returned.path("history").size()).isEqualTo(5);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_occurrence WHERE source_type='LONG_RETURN' AND source_id=? AND resident_id=? AND valid", Integer.class, id, resident)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_discipline_notification", Integer.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_warning", Integer.class)).isZero();
        }
    }

    @Test
    void editingAndRevocationBlockOldCapabilitiesAndKeepDocumentHistory() throws Exception {
        try (HttpClient student = login("residente")) {
            JsonNode first = create(student, 4 * 3600);
            run();
            String token = server.lastToken;
            UUID id = uuid(first, "id");
            String old = first.path("currentDocument").path("documentVersionId").asText();
            Map<String, Object> edit = plan(5 * 3600);
            edit.put("version", 0);
            JsonNode second = response(put(student, "/api/v1/saidas-longas/" + id, edit), 200);
            assertThat(second.path("currentDocument").path("revisionNumber").asInt()).isEqualTo(2);
            capability(token, "/api/v1/assinaturas/acesso", 401);
            assertThat(count("sager_document_version", "TRUE")).isEqualTo(2);
            assertThat(count("sager_signature_binding", "status='INVALIDATED'")).isEqualTo(1);
            run();
            assertThat(server.docs.values().stream().filter(d -> d.revision.toString().equals(old)))
                    .allMatch(d -> "canceled".equals(d.status));
            assertThat(second.path("signatureStatus").asText()).isEqualTo("PENDING");
        }
    }

    @Test
    void badHmacAndBrowserCallbacksNeverMutateSignatureOrBypassCsrf() throws Exception {
        try (HttpClient student = login("residente")) {
            JsonNode exit = create(student, 4 * 3600);
            run();
            Doc doc = server.onlyDoc();
            byte[] body = clickWebhook(doc, "sign");
            HttpResponse<String> denied = webhook("clicksign", body, "different-secret");
            error(denied, 401, "invalid_webhook");
            assertThat(count("sager_webhook_inbox", "TRUE")).isZero();
            assertThat(count("sager_signature_binding", "status='VALID'")).isZero();
            HttpResponse<String> noCsrf =
                    student.send(
                            HttpRequest.newBuilder(uri(path(uuid(exit, "id"), "decisao")))
                                    .header("Content-Type", "application/json")
                                    .POST(HttpRequest.BodyPublishers.ofString("{}"))
                                    .build(),
                            HttpResponse.BodyHandlers.ofString());
            assertThat(noCsrf.statusCode()).isEqualTo(403);
        }
    }

    @Test
    void manualResendsHaveRollingLimitCooldownAndOptimisticConcurrency() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            JsonNode exit = create(student, 3 * 86400);
            run();
            UUID id = uuid(exit, "id");
            String p = path(id, "reenvio");
            error(
                    post(
                            supervisor,
                            p,
                            Map.of("version", 0, "comment", "Nova tentativa manual justificada")),
                    409,
                    "resend_cooldown");
            clock.value = START.plusSeconds(600);
            String csrf = csrf(supervisor);
            String raw =
                    json.writeValueAsString(
                            Map.of("version", 0, "comment", "Nova tentativa manual justificada"));
            CompletableFuture<HttpResponse<String>> one =
                    supervisor.sendAsync(
                            request(p, csrf).POST(HttpRequest.BodyPublishers.ofString(raw)).build(),
                            HttpResponse.BodyHandlers.ofString());
            CompletableFuture<HttpResponse<String>> two =
                    supervisor.sendAsync(
                            request(p, csrf).POST(HttpRequest.BodyPublishers.ofString(raw)).build(),
                            HttpResponse.BodyHandlers.ofString());
            assertThat(List.of(one.get().statusCode(), two.get().statusCode()))
                    .containsExactlyInAnyOrder(200, 409);
            assertThat(count("sager_long_exit_resend", "TRUE")).isEqualTo(1);
            for (int i = 2; i <= 3; i++) {
                clock.value = START.plusSeconds(i * 600);
                JsonNode current = read(supervisor, id);
                response(
                        post(
                                supervisor,
                                p,
                                Map.of(
                                        "version",
                                        current.path("version").asLong(),
                                        "comment",
                                        "Nova tentativa manual justificada")),
                        200);
            }
            clock.value = START.plusSeconds(2400);
            JsonNode current = read(supervisor, id);
            error(
                    post(
                            supervisor,
                            p,
                            Map.of(
                                    "version",
                                    current.path("version").asLong(),
                                    "comment",
                                    "Nova tentativa manual justificada")),
                    409,
                    "resend_limit");
            assertThat(current.path("remainingResends").asInt()).isZero();
            assertThat(current.path("resendAvailableAt").asText()).isNotBlank();
        }
    }

    @Test
    void ambiguousPostAndInterruptedLeaseDoNotCreateDuplicateEnvelopes() throws Exception {
        try (HttpClient student = login("residente")) {
            JsonNode exit = create(student, 4 * 3600);
            server.failNextEnvelope = 503;
            run();
            assertThat(server.envelopePosts.get()).isEqualTo(1);
            assertThat(count("sager_integration_task", "state='UNCERTAIN'")).isEqualTo(1);
            run();
            assertThat(server.envelopePosts.get()).isEqualTo(1);
            assertThat(read(student, uuid(exit, "id")).path("signatureStatus").asText())
                    .isEqualTo("UNCERTAIN");
            jdbc.update(
                    "UPDATE sager_integration_task SET"
                            + " state='RUNNING',in_flight=true,lease_until=?",
                    OffsetDateTime.ofInstant(START.minusSeconds(1), ZoneOffset.UTC));
            run();
            assertThat(server.envelopePosts.get()).isEqualTo(1);
            assertThat(count("sager_integration_task", "state='UNCERTAIN'")).isEqualTo(1);
        }
    }

    @Test
    void safeRateLimitRetriesFiveTimesWithPersistedWaitsThenStops() throws Exception {
        try (HttpClient student = login("residente")) {
            create(student, 4 * 3600);
            server.failEveryEnvelope = 429;
            run();
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT attempt_count FROM sager_integration_task",
                                    Integer.class))
                    .isEqualTo(1);
            assertThat(
                            jdbc.queryForObject(
                                            "SELECT next_attempt_at FROM sager_integration_task",
                                            OffsetDateTime.class)
                                    .toInstant())
                    .isEqualTo(START.plusSeconds(60));
            run();
            assertThat(server.envelopePosts.get()).isEqualTo(1);
            for (int wait : List.of(60, 300, 900, 900)) {
                clock.value = clock.value.plusSeconds(wait);
                run();
            }
            assertThat(server.envelopePosts.get()).isEqualTo(5);
            assertThat(count("sager_integration_task", "state='FAILED' AND attempt_count=5"))
                    .isEqualTo(1);
            clock.value = clock.value.plusSeconds(3600);
            run();
            assertThat(server.envelopePosts.get()).isEqualTo(5);
        }
    }

    @Test
    void whatsappStatusChecksWabaNumberRecipientAndMonotonicProviderTimestamp() throws Exception {
        try (HttpClient student = login("residente")) {
            JsonNode exit = create(student, 4 * 3600);
            run();
            String id = server.lastMessage;
            clock.value = START.plusSeconds(100);
            response(
                    HttpClient.newHttpClient()
                            .send(
                                    HttpRequest.newBuilder(
                                                    uri(
                                                            "/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=synthetic-meta-verify&hub.challenge=123456"))
                                            .GET()
                                            .build(),
                                    HttpResponse.BodyHandlers.ofString()),
                    200,
                    false);
            byte[] delivered =
                    metaWebhook(
                            "777", "888", id, "5562999990000", "delivered", START.plusSeconds(30));
            assertThat(webhook("whatsapp", delivered, "synthetic-meta-app").statusCode())
                    .isEqualTo(202);
            run();
            assertThat(read(student, uuid(exit, "id")).path("messageStatus").asText())
                    .isEqualTo("DELIVERED");
            assertThat(
                            webhook(
                                            "whatsapp",
                                            metaWebhook(
                                                    "777",
                                                    "888",
                                                    id,
                                                    "5562999990000",
                                                    "sent",
                                                    START.plusSeconds(20)),
                                            "synthetic-meta-app")
                                    .statusCode())
                    .isEqualTo(202);
            run();
            assertThat(read(student, uuid(exit, "id")).path("messageStatus").asText())
                    .isEqualTo("DELIVERED");
            assertThat(
                            webhook(
                                            "whatsapp",
                                            metaWebhook(
                                                    "777",
                                                    "888",
                                                    id,
                                                    "5562999991111",
                                                    "read",
                                                    START.plusSeconds(40)),
                                            "synthetic-meta-app")
                                    .statusCode())
                    .isEqualTo(202);
            run();
            assertThat(read(student, uuid(exit, "id")).path("messageStatus").asText())
                    .isEqualTo("DELIVERED");
            error(
                    webhook(
                            "whatsapp",
                            metaWebhook(
                                    "wrong",
                                    "888",
                                    id,
                                    "5562999990000",
                                    "read",
                                    START.plusSeconds(40)),
                            "synthetic-meta-app"),
                    400,
                    "invalid_webhook");
            assertThat(count("sager_signature_binding", "status='VALID'")).isZero();
        }
    }

    @Test
    void originalHashGuardianEligibilityAndCurrentRevisionGateApproval() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            JsonNode exit = create(student, 4 * 3600);
            run();
            Doc doc = server.onlyDoc();
            server.sign(doc, START.plusSeconds(60));
            clock.value = START.plusSeconds(120);
            webhook("clicksign", clickWebhook(doc, "document_closed"), "synthetic-click-webhook");
            run();
            JsonNode valid = read(supervisor, uuid(exit, "id"));
            Map<String, Object> stale = new LinkedHashMap<>(approval(valid));
            stale.put("documentVersionId", UUID.randomUUID().toString());
            error(
                    post(supervisor, path(uuid(exit, "id"), "decisao"), stale),
                    409,
                    "stale_document");
            jdbc.update("UPDATE sager_guardian SET active=false WHERE id=?", guardian);
            error(
                    post(supervisor, path(uuid(exit, "id"), "decisao"), approval(valid)),
                    409,
                    "guardian_not_eligible");
            jdbc.update("UPDATE sager_guardian SET active=true WHERE id=?", guardian);
            UUID file =
                    jdbc.queryForObject(
                            "SELECT signed_file_id FROM sager_document_version", UUID.class);
            Files.delete(PRIVATE.resolve(file.toString()));
            error(
                    post(supervisor, path(uuid(exit, "id"), "decisao"), approval(valid)),
                    409,
                    "document_unavailable");
            assertThat(read(supervisor, uuid(exit, "id")).path("status").asText())
                    .isEqualTo("AGUARDANDO_ANALISE");
        }
    }

    @Test
    void changingGuardianOnResendCreatesANewDocumentWithTheSameOriginalPlan() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            JsonNode first = create(student, 4 * 3600);
            UUID other = UUID.randomUUID();
            jdbc.update(
                    "INSERT INTO sager_guardian(id,resident_id,name,relationship,phone,active)"
                        + " VALUES (?,?,'Outro responsável sintético','Pai','+5562999991111',true)",
                    other,
                    resident);
            clock.value = START.plusSeconds(600);
            JsonNode resent =
                    response(
                            post(
                                    supervisor,
                                    path(uuid(first, "id"), "reenvio"),
                                    Map.of(
                                            "version",
                                            0,
                                            "guardianId",
                                            other.toString(),
                                            "comment",
                                            "Convite destinado ao outro responsável vinculado")),
                            200);
            assertThat(resent.path("currentDocument").path("revisionNumber").asInt()).isEqualTo(2);
            assertThat(resent.path("guardianId").asText()).isEqualTo(other.toString());
            assertThat(resent.path("requestedDepartureAt").asText())
                    .isEqualTo(first.path("requestedDepartureAt").asText());
            assertThat(resent.path("expectedReturnAt").asText())
                    .isEqualTo(first.path("expectedReturnAt").asText());
            assertThat(count("sager_document_version", "TRUE")).isEqualTo(2);
            assertThat(count("sager_signature_binding", "status='INVALIDATED'")).isEqualTo(1);
        }
    }

    @Test
    void signatureMadeWithinInvitationWindowCanBeVerifiedAfterCapabilityExpires() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            JsonNode exit = create(student, 3 * 86400);
            run();
            String token = server.lastToken;
            Doc doc = server.onlyDoc();
            server.sign(doc, START.plusSeconds(23 * 3600));
            clock.value = START.plusSeconds(86400 + 60);
            capability(token, "/api/v1/assinaturas/acesso", 401);
            assertThat(
                            webhook(
                                            "clicksign",
                                            clickWebhook(doc, "document_closed"),
                                            "synthetic-click-webhook")
                                    .statusCode())
                    .isEqualTo(202);
            run();
            JsonNode valid = read(supervisor, uuid(exit, "id"));
            assertThat(valid.path("signatureStatus").asText()).isEqualTo("VALID");
            response(post(supervisor, path(uuid(exit, "id"), "decisao"), approval(valid)), 200);
        }
    }

    @Test
    void changedGuardianPhoneRevokesCapabilityAndBlocksApprovalOfOldSmsEvidence() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            JsonNode exit = create(student, 4 * 3600);
            run();
            String token = server.lastToken;
            Doc doc = server.onlyDoc();
            server.sign(doc, START.plusSeconds(60));
            clock.value = START.plusSeconds(120);
            webhook("clicksign", clickWebhook(doc, "document_closed"), "synthetic-click-webhook");
            run();
            JsonNode valid = read(supervisor, uuid(exit, "id"));
            jdbc.update(
                    "UPDATE sager_guardian SET phone='+5562999991111',version=version+1 WHERE id=?",
                    guardian);
            capability(token, "/api/v1/assinaturas/acesso", 401);
            error(
                    post(supervisor, path(uuid(exit, "id"), "decisao"), approval(valid)),
                    409,
                    "guardian_not_eligible");
            JsonNode invalid = read(supervisor, uuid(exit, "id"));
            assertThat(invalid.path("signatureStatus").asText()).isEqualTo("INVALIDATED");
            assertThat(invalid.path("capabilities").path("canApprove").asBoolean()).isFalse();
            clock.value = START.plusSeconds(600);
            JsonNode resent =
                    response(
                            post(
                                    supervisor,
                                    path(uuid(exit, "id"), "reenvio"),
                                    Map.of(
                                            "version",
                                            valid.path("version").asLong(),
                                            "comment",
                                            "Nova assinatura após correção do contato do"
                                                + " responsável")),
                            200);
            assertThat(resent.path("currentDocument").path("revisionNumber").asInt()).isEqualTo(2);
            assertThat(resent.path("signatureStatus").asText()).isEqualTo("PENDING");
            assertThat(resent.path("currentDocument").path("signedState").asText())
                    .isEqualTo("MISSING");
            run();
            Doc newDoc =
                    server.docs.values().stream()
                            .filter(
                                    d ->
                                            d.revision
                                                    .toString()
                                                    .equals(
                                                            resent.path("currentDocument")
                                                                    .path("documentVersionId")
                                                                    .asText()))
                            .findFirst()
                            .orElseThrow();
            server.sign(newDoc, START.plusSeconds(660));
            clock.value = START.plusSeconds(720);
            webhook(
                    "clicksign",
                    clickWebhook(newDoc, "document_closed"),
                    "synthetic-click-webhook");
            run();
            JsonNode recovered = read(supervisor, uuid(exit, "id"));
            assertThat(recovered.path("signatureStatus").asText()).isEqualTo("VALID");
            response(post(supervisor, path(uuid(exit, "id"), "decisao"), approval(recovered)), 200);
        }
    }

    @Test
    void guardianDeactivatedBeforeProcessingIsNeverSentAnInvitation() throws Exception {
        try (HttpClient student = login("residente")) {
            create(student, 4 * 3600);
            jdbc.update(
                    "UPDATE sager_guardian SET active=false,version=version+1 WHERE id=?",
                    guardian);
            run();
            assertThat(server.envelopePosts.get()).isZero();
            assertThat(server.lastToken).isNull();
            assertThat(count("sager_integration_task", "state='CANCELLED'")).isEqualTo(1);
        }
    }

    @Test
    void providerOriginalWithDifferentHashNeverConfirmsTheSignature() throws Exception {
        try (HttpClient student = login("residente")) {
            JsonNode exit = create(student, 4 * 3600);
            run();
            Doc doc = server.onlyDoc();
            server.sign(doc, START.plusSeconds(60));
            doc.original = java.util.Arrays.copyOf(doc.original, doc.original.length + 1);
            clock.value = START.plusSeconds(120);
            webhook("clicksign", clickWebhook(doc, "document_closed"), "synthetic-click-webhook");
            run();
            assertThat(read(student, uuid(exit, "id")).path("signatureStatus").asText())
                    .isEqualTo("PENDING");
            assertThat(
                            count(
                                    "sager_integration_task",
                                    "type='RECONCILE' AND state='FAILED' AND"
                                            + " failure_code='original_hash_mismatch'"))
                    .isEqualTo(1);
            assertThat(count("sager_document_version", "signed_state='STORED'")).isZero();
        }
    }

    @Test
    void interruptedSafeStageCannotExceedFiveTotalAttempts() throws Exception {
        try (HttpClient student = login("residente")) {
            create(student, 4 * 3600);
            run();
            long before = server.calls.stream().filter(c -> c.startsWith("PATCH ")).count();
            jdbc.update("UPDATE sager_signature_binding SET stage='ACTIVATE'");
            jdbc.update(
                    "UPDATE sager_integration_task SET"
                        + " state='RUNNING',attempt_count=5,in_flight=true,lease_until=?,lease_owner=NULL"
                        + " WHERE type='PROVISION'",
                    OffsetDateTime.ofInstant(START.minusSeconds(1), ZoneOffset.UTC));
            run();
            assertThat(server.calls.stream().filter(c -> c.startsWith("PATCH ")).count())
                    .isEqualTo(before);
            assertThat(
                            count(
                                    "sager_integration_task",
                                    "type='PROVISION' AND state='FAILED' AND attempt_count=5"))
                    .isEqualTo(1);
        }
    }

    private void run() {
        assertThatCode(
                        () ->
                                context.getBean("integrationWorker")
                                        .getClass()
                                        .getMethod("runOnce")
                                        .invoke(context.getBean("integrationWorker")))
                .doesNotThrowAnyException();
    }

    private int count(String table, String condition) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE " + condition, Integer.class);
    }

    private Map<String, Object> plan(long duration) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("departureMode", "NOW");
        v.put("expectedReturnAt", clock.instant().plusSeconds(duration).toString());
        v.put("reason", "Visita familiar sintética");
        v.put("guardianId", guardian.toString());
        return v;
    }

    private Map<String, Object> approval(JsonNode exit) {
        return Map.of(
                "version",
                exit.path("version").asLong(),
                "decision",
                "APPROVE",
                "documentVersionId",
                exit.path("currentDocument").path("documentVersionId").asText());
    }

    private JsonNode create(HttpClient c, long duration) throws Exception {
        return response(post(c, "/api/v1/saidas-longas", plan(duration)), 201);
    }

    private String path(UUID id, String action) {
        return "/api/v1/saidas-longas/" + id + "/" + action;
    }

    private UUID uuid(JsonNode n, String key) {
        return UUID.fromString(n.path(key).asText());
    }

    private HttpClient login(String profile) throws Exception {
        HttpClient c =
                HttpClient.newBuilder()
                        .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
                        .build();
        String body =
                "matricula="
                        + URLEncoder.encode(br.edu.ifgoiano.sager.TestIdentity.enrollment(profile + "@example.invalid"), StandardCharsets.UTF_8)
                        + "&password="
                        + URLEncoder.encode("Senha sintética 123!", StandardCharsets.UTF_8);
        assertThat(
                        c.send(
                                        HttpRequest.newBuilder(uri("/api/v1/auth/login"))
                                                .header(
                                                        "Content-Type",
                                                        "application/x-www-form-urlencoded")
                                                .header("X-CSRF-TOKEN", csrf(c))
                                                .POST(HttpRequest.BodyPublishers.ofString(body))
                                                .build(),
                                        HttpResponse.BodyHandlers.ofString())
                                .statusCode())
                .isEqualTo(204);
        return c;
    }

    private URI uri(String p) {
        return URI.create("http://127.0.0.1:" + port + p);
    }

    private String csrf(HttpClient c) throws Exception {
        return response(get(c, "/api/v1/auth/csrf"), 200).path("token").asText();
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

    private JsonNode read(HttpClient c, UUID id) throws Exception {
        return response(get(c, "/api/v1/saidas-longas/" + id), 200);
    }

    private HttpResponse<String> post(HttpClient c, String p, Map<String, ?> b) throws Exception {
        return c.send(
                request(p, csrf(c))
                        .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(b)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> put(HttpClient c, String p, Map<String, ?> b) throws Exception {
        return c.send(
                request(p, csrf(c))
                        .PUT(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(b)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode response(HttpResponse<String> r, int status) throws Exception {
        return response(r, status, true);
    }

    private JsonNode response(HttpResponse<String> r, int status, boolean parsed) throws Exception {
        assertThat(r.statusCode()).describedAs(r.body()).isEqualTo(status);
        return parsed ? json.readTree(r.body()) : null;
    }

    private void error(HttpResponse<String> r, int s, String code) throws Exception {
        assertThat(response(r, s).path("code").asText()).isEqualTo(code);
    }

    private JsonNode capability(String token, String p, int status) throws Exception {
        return response(
                HttpClient.newHttpClient()
                        .send(
                                HttpRequest.newBuilder(uri(p))
                                        .header("Authorization", "Bearer " + token)
                                        .GET()
                                        .build(),
                                HttpResponse.BodyHandlers.ofString()),
                status);
    }

    private HttpResponse<String> capabilityPost(String token, String p, Map<String, ?> body)
            throws Exception {
        return HttpClient.newHttpClient()
                .send(
                        HttpRequest.newBuilder(uri(p))
                                .header("Authorization", "Bearer " + token)
                                .header("Content-Type", "application/json")
                                .POST(
                                        HttpRequest.BodyPublishers.ofString(
                                                json.writeValueAsString(body)))
                                .build(),
                        HttpResponse.BodyHandlers.ofString());
    }

    private byte[] clickWebhook(Doc d, String name) {
        return json.writeValueAsBytes(
                Map.of(
                        "event",
                        Map.of("name", name, "occurred_at", clock.instant().toString()),
                        "document",
                        Map.of(
                                "key",
                                d.id,
                                "metadata",
                                Map.of("documentVersionId", d.revision, "bindingId", d.binding))));
    }

    private byte[] metaWebhook(
            String waba,
            String number,
            String message,
            String recipient,
            String status,
            Instant at) {
        return json.writeValueAsBytes(
                Map.of(
                        "object",
                        "whatsapp_business_account",
                        "entry",
                        List.of(
                                Map.of(
                                        "id",
                                        waba,
                                        "changes",
                                        List.of(
                                                Map.of(
                                                        "field",
                                                        "messages",
                                                        "value",
                                                        Map.of(
                                                                "messaging_product",
                                                                "whatsapp",
                                                                "metadata",
                                                                Map.of("phone_number_id", number),
                                                                "statuses",
                                                                List.of(
                                                                        Map.of(
                                                                                "id",
                                                                                message,
                                                                                "recipient_id",
                                                                                recipient,
                                                                                "status",
                                                                                status,
                                                                                "timestamp",
                                                                                Long.toString(
                                                                                        at
                                                                                                .getEpochSecond()))))))))));
    }

    private HttpResponse<String> webhook(String provider, byte[] body, String secret)
            throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String header = "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
        return HttpClient.newHttpClient()
                .send(
                        HttpRequest.newBuilder(uri("/api/v1/webhooks/" + provider))
                                .header("Content-Type", "application/json")
                                .header(
                                        "clicksign".equals(provider)
                                                ? "Content-Hmac"
                                                : "X-Hub-Signature-256",
                                        header)
                                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                                .build(),
                        HttpResponse.BodyHandlers.ofString());
    }

    @TestConfiguration
    static class ProviderDoubles {
        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock();
        }

        @Bean(destroyMethod = "close")
        StatefulDouble providerDouble(ObjectMapper json) throws Exception {
            return new StatefulDouble(json);
        }

        @Bean
        @Primary
        SignatureProvider testClicksign(StatefulDouble s, ObjectMapper json) {
            return new ClicksignHttpProvider(
                    HttpClient.newHttpClient(),
                    s.api(),
                    "synthetic-click-token",
                    "sandbox",
                    Set.of("127.0.0.1"),
                    json,
                    Duration.ofSeconds(20));
        }

        @Bean
        @Primary
        WhatsAppProvider testWhatsapp(StatefulDouble s, ObjectMapper json) {
            return new MetaWhatsAppHttpProvider(
                    HttpClient.newHttpClient(),
                    s.root(),
                    "v99.0",
                    "888",
                    "synthetic-meta-token",
                    "sager_autorizacao_saida_v1",
                    json,
                    Duration.ofSeconds(20));
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

    static class Doc {
        UUID id, envelope, revision, binding, signer;
        String name, phone, status = "running";
        byte[] original, signed;
        Instant signedAt;
        Map<UUID, Map<String, Object>> requirements = new LinkedHashMap<>();
    }

    static class StatefulDouble implements AutoCloseable {
        final HttpServer http;
        final ObjectMapper json;
        final Map<UUID, String> envelopes = new ConcurrentHashMap<>();
        final Map<UUID, Doc> docs = new ConcurrentHashMap<>();
        final List<String> calls = new CopyOnWriteArrayList<>();
        final AtomicInteger envelopePosts = new AtomicInteger();
        volatile int failNextEnvelope, failEveryEnvelope;
        volatile String lastToken, lastMessage;

        StatefulDouble(ObjectMapper json) throws Exception {
            this.json = json;
            http = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            http.setExecutor(java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor());
            http.createContext(
                    "/",
                    exchange -> {
                        String method = exchange.getRequestMethod(),
                                path = exchange.getRequestURI().getPath();
                        calls.add(method + " " + path);
                        JsonNode body = json.readTree(exchange.getRequestBody().readAllBytes());
                        Object result = Map.of();
                        int code = 200;
                        byte[] raw = null;
                        try {
                            String[] parts = path.split("/");
                            if (path.equals("/api/v3/envelopes") && method.equals("POST")) {
                                envelopePosts.incrementAndGet();
                                if (failEveryEnvelope != 0 || failNextEnvelope != 0) {
                                    code =
                                            failEveryEnvelope != 0
                                                    ? failEveryEnvelope
                                                    : failNextEnvelope;
                                    failNextEnvelope = 0;
                                } else {
                                    UUID id = UUID.randomUUID();
                                    envelopes.put(id, "draft");
                                    result = resource(id, "envelopes", Map.of("status", "draft"));
                                }
                            } else if (path.startsWith("/api/v3/envelopes/")) {
                                UUID e = UUID.fromString(parts[4]);
                                if (parts.length == 5) {
                                    if (method.equals("PATCH")) {
                                        String next =
                                                body.path("data")
                                                        .path("attributes")
                                                        .path("status")
                                                        .asText();
                                        envelopes.put(e, next);
                                        docs.values().stream()
                                                .filter(d -> d.envelope.equals(e))
                                                .forEach(d -> d.status = next);
                                    } else if (method.equals("DELETE")) {
                                        envelopes.remove(e);
                                        code = 204;
                                    }
                                    result =
                                            resource(
                                                    e,
                                                    "envelopes",
                                                    Map.of(
                                                            "status",
                                                            envelopes.getOrDefault(e, "canceled")));
                                } else if (parts[5].equals("documents")) {
                                    if (parts.length == 6 && method.equals("POST")) {
                                        JsonNode attrs = body.path("data").path("attributes");
                                        JsonNode metadata =
                                                json.readTree(attrs.path("metadata").asText());
                                        Doc d = new Doc();
                                        d.id = UUID.randomUUID();
                                        d.envelope = e;
                                        d.revision =
                                                UUID.fromString(
                                                        metadata.path("documentVersionId")
                                                                .asText());
                                        d.binding =
                                                UUID.fromString(
                                                        metadata.path("bindingId").asText());
                                        d.original =
                                                Base64.getDecoder()
                                                        .decode(
                                                                attrs.path("content_base64")
                                                                        .asText()
                                                                        .replace(
                                                                                "data:application/pdf;base64,",
                                                                                ""));
                                        docs.put(d.id, d);
                                        result =
                                                resource(
                                                        d.id,
                                                        "documents",
                                                        Map.of("status", "draft"));
                                    } else {
                                        Doc d = docs.get(UUID.fromString(parts[6]));
                                        if (parts.length == 8 && parts[7].equals("events")) {
                                            boolean sign =
                                                    exchange.getRequestURI()
                                                            .getRawQuery()
                                                            .endsWith("=sign");
                                            List<Object> events =
                                                    d.signedAt == null
                                                            ? List.of()
                                                            : sign
                                                                    ? List.of(
                                                                            Map.of(
                                                                                    "id",
                                                                                    UUID
                                                                                            .randomUUID(),
                                                                                    "type",
                                                                                    "events",
                                                                                    "attributes",
                                                                                    Map.of(
                                                                                            "name",
                                                                                            "sign",
                                                                                            "created",
                                                                                            d
                                                                                                    .signedAt
                                                                                                    .toString(),
                                                                                            "data",
                                                                                            Map.of(
                                                                                                    "signer",
                                                                                                    Map
                                                                                                            .of(
                                                                                                                    "key",
                                                                                                                    d.signer,
                                                                                                                    "phone_number",
                                                                                                                    d.phone,
                                                                                                                    "auths",
                                                                                                                    List
                                                                                                                            .of(
                                                                                                                                    "sms"))))))
                                                                    : List.of(
                                                                            Map.of(
                                                                                    "id",
                                                                                    UUID
                                                                                            .randomUUID(),
                                                                                    "type",
                                                                                    "events",
                                                                                    "attributes",
                                                                                    Map.of(
                                                                                            "name",
                                                                                            "document_closed",
                                                                                            "created",
                                                                                            d.signedAt
                                                                                                    .plusSeconds(
                                                                                                            1)
                                                                                                    .toString())));
                                            result = Map.of("data", events);
                                        } else {
                                            if (method.equals("PATCH"))
                                                d.status =
                                                        body.path("data")
                                                                .path("attributes")
                                                                .path("status")
                                                                .asText();
                                            result =
                                                    Map.of(
                                                            "data",
                                                            Map.of(
                                                                    "id",
                                                                    d.id,
                                                                    "type",
                                                                    "documents",
                                                                    "attributes",
                                                                    Map.of(
                                                                            "status",
                                                                            d.status,
                                                                            "metadata",
                                                                            Map.of(
                                                                                    "documentVersionId",
                                                                                    d.revision,
                                                                                    "bindingId",
                                                                                    d.binding)),
                                                                    "links",
                                                                    Map.of(
                                                                            "files",
                                                                            Map.of(
                                                                                    "original",
                                                                                    root()
                                                                                            + "/files/"
                                                                                            + d.id
                                                                                            + "/original",
                                                                                    "signed",
                                                                                    root()
                                                                                            + "/files/"
                                                                                            + d.id
                                                                                            + "/signed"))));
                                        }
                                    }
                                } else if (parts[5].equals("signers")) {
                                    Doc d =
                                            docs.values().stream()
                                                    .filter(v -> v.envelope.equals(e))
                                                    .findFirst()
                                                    .orElseThrow();
                                    if (method.equals("POST")) {
                                        d.signer = UUID.randomUUID();
                                        d.name =
                                                body.path("data")
                                                        .path("attributes")
                                                        .path("name")
                                                        .asText();
                                        d.phone =
                                                body.path("data")
                                                        .path("attributes")
                                                        .path("phone_number")
                                                        .asText();
                                    }
                                    result =
                                            resource(
                                                    d.signer,
                                                    "signers",
                                                    Map.of(
                                                            "name",
                                                            d.name,
                                                            "phone_number",
                                                            d.phone));
                                } else if (parts[5].equals("requirements")) {
                                    Doc d =
                                            docs.values().stream()
                                                    .filter(v -> v.envelope.equals(e))
                                                    .findFirst()
                                                    .orElseThrow();
                                    if (method.equals("POST")) {
                                        UUID id = UUID.randomUUID();
                                        Map<String, Object> attrs =
                                                json.convertValue(
                                                        body.path("data").path("attributes"),
                                                        Map.class);
                                        d.requirements.put(id, attrs);
                                        result = resource(id, "requirements", attrs);
                                    } else
                                        result =
                                                Map.of(
                                                        "data",
                                                        d.requirements.entrySet().stream()
                                                                .map(
                                                                        v ->
                                                                                Map.of(
                                                                                        "id",
                                                                                        v.getKey(),
                                                                                        "type",
                                                                                        "requirements",
                                                                                        "attributes",
                                                                                        v
                                                                                                .getValue()))
                                                                .toList());
                                }
                            } else if (path.equals("/v99.0/888/messages")) {
                                lastToken =
                                        body.path("template")
                                                .path("components")
                                                .get(0)
                                                .path("parameters")
                                                .get(0)
                                                .path("text")
                                                .asText();
                                lastMessage = "wamid." + UUID.randomUUID();
                                result =
                                        Map.of(
                                                "messaging_product",
                                                "whatsapp",
                                                "contacts",
                                                List.of(Map.of("wa_id", body.path("to").asText())),
                                                "messages",
                                                List.of(Map.of("id", lastMessage)));
                            } else if (path.startsWith("/files/")) {
                                Doc d = docs.get(UUID.fromString(parts[2]));
                                raw = parts[3].equals("original") ? d.original : d.signed;
                            } else code = 404;
                        } catch (Exception failure) {
                            code = 500;
                            result = Map.of("error", "synthetic-double-failure");
                        }
                        byte[] value = raw == null ? json.writeValueAsBytes(result) : raw;
                        exchange.getResponseHeaders()
                                .set(
                                        "Content-Type",
                                        raw == null ? "application/json" : "application/pdf");
                        exchange.sendResponseHeaders(code, code == 204 ? -1 : value.length);
                        if (code != 204)
                            try (var out = exchange.getResponseBody()) {
                                out.write(value);
                            }
                        exchange.close();
                    });
            http.start();
        }

        URI root() {
            return URI.create("http://127.0.0.1:" + http.getAddress().getPort());
        }

        URI api() {
            return URI.create(root() + "/api/v3");
        }

        Object resource(UUID id, String type, Map<String, Object> attrs) {
            return Map.of("data", Map.of("id", id, "type", type, "attributes", attrs));
        }

        void clear() {
            docs.clear();
            envelopes.clear();
            calls.clear();
            envelopePosts.set(0);
            failNextEnvelope = 0;
            failEveryEnvelope = 0;
            lastToken = null;
            lastMessage = null;
        }

        Doc onlyDoc() {
            assertThat(docs).hasSize(1);
            return docs.values().iterator().next();
        }

        void sign(Doc d, Instant at) {
            d.signedAt = at;
            d.status = "closed";
            envelopes.put(d.envelope, "closed");
            byte[] tail = "\n% signature fixture only\n".getBytes(StandardCharsets.US_ASCII);
            d.signed = java.util.Arrays.copyOf(d.original, d.original.length + tail.length);
            System.arraycopy(tail, 0, d.signed, d.original.length, tail.length);
        }

        public void close() {
            http.stop(0);
        }
    }
}
