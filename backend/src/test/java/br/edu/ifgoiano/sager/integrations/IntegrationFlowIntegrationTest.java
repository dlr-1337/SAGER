package br.edu.ifgoiano.sager.integrations;

import static org.assertj.core.api.Assertions.assertThat;

import br.edu.ifgoiano.sager.TestIdentity;
import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;

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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

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
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
            "sager.integrations.worker.enabled=false"
        })
@ActiveProfiles("local")
@Import(IntegrationFlowIntegrationTest.ClockConfiguration.class)
class IntegrationFlowIntegrationTest {
    static final Instant START = Instant.parse("2026-10-01T01:00:00Z");
    static final String API_KEY = "synthetic-gateway-key";
    static final String SECRET = "synthetic-gateway-webhook";
    static final String GUARDIAN_CHAT = "5562999990000@c.us";
    static final String COMMENT = "Justificativa sintética para o registro";
    static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 1, 2, 3, 4};
    static final byte[] EXECUTABLE = "MZ-synthetic-executable".getBytes(StandardCharsets.US_ASCII);
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");
    static final Path PRIVATE =
            Path.of(System.getProperty("java.io.tmpdir"), "sager-whatsapp-flow-" + UUID.randomUUID());
    static final GatewayDouble GATEWAY = new GatewayDouble();
    static final GatewayDouble OUTSIDE = new GatewayDouble();

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
        r.add("sager.integrations.whatsapp.api-key", () -> API_KEY);
        r.add("sager.integrations.whatsapp.webhook-secret", () -> SECRET);
        r.add("sager.integrations.whatsapp.session", () -> "default");
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired LocalAccountProvisioningService provisioning;
    @Autowired IntegrationWorker worker;
    @Autowired IntegrationTransactions transactions;
    @Autowired MutableClock clock;
    @LocalServerPort int port;
    UUID resident, guardian, room;

    @BeforeEach
    void fixtures() throws Exception {
        clock.value = START;
        GATEWAY.clear();
        OUTSIDE.clear();
        jdbc.execute(
                "TRUNCATE sager_occurrence,sager_warning,sager_notice,sager_commitment_term,"
                        + "sager_communication,sager_discipline_idempotency RESTART IDENTITY CASCADE");
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
                        "sager_short_exit_history",
                        "sager_short_exit",
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
        guardian = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO sager_accommodation(id,code,name) VALUES (?,'FLOW','Alojamento sintético')",
                accommodation);
        jdbc.update(
                "INSERT INTO sager_room(id,code,number,accommodation_id,capacity,situation) VALUES"
                        + " (?,'FLOW-1','1',?,20,'Disponível')",
                room,
                accommodation);
        resident = resident("FLOW-A", "residente");
        jdbc.update(
                "INSERT INTO sager_guardian(id,resident_id,name,relationship,phone,active) VALUES"
                        + " (?,?,'Responsável sintético','Mãe','+5562999990000',true)",
                guardian,
                resident);
        for (String p : List.of("supervisor", "gestor")) account(p);
        session("WORKING");
    }

    @Test
    void creationSendsTheRevisionPdfAndRecordsTheAttempt() throws Exception {
        try (HttpClient student = login("residente")) {
            JsonNode exit = create(student, 4 * 3600);
            assertThat(exit.path("signatureStatus").asText()).isEqualTo("PENDING");
            assertThat(exit.path("whatsappAvailable").asBoolean()).isTrue();
            run();
            assertThat(GATEWAY.sends()).hasSize(1);
            Call call = GATEWAY.sends().getFirst();
            assertThat(call.apiKey()).isEqualTo(API_KEY);
            JsonNode body = json.readTree(call.body());
            assertThat(body.path("session").asText()).isEqualTo("default");
            assertThat(body.path("chatId").asText()).isEqualTo(GUARDIAN_CHAT);
            assertThat(body.path("file").path("mimetype").asText()).isEqualTo("application/pdf");
            assertThat(body.path("file").path("filename").asText())
                    .matches("autorizacao-[0-9A-F]{8}-r1\\.pdf");
            UUID original =
                    jdbc.queryForObject(
                            "SELECT original_file_id FROM sager_document_version", UUID.class);
            assertThat(Base64.getDecoder().decode(body.path("file").path("data").asText()))
                    .isEqualTo(Files.readAllBytes(PRIVATE.resolve(original.toString())));
            assertThat(body.path("caption").asText())
                    .contains("revisão 1", "respondendo a esta mensagem")
                    .doesNotContain("Residente sintético", "Responsável sintético")
                    .doesNotContainIgnoringCase("assinatura válida");
            assertThat(count("sager_whatsapp_attempt", "status='ACCEPTED' AND provider_message_id='MSG1'"))
                    .isEqualTo(1);
            assertThat(count("sager_integration_task", "state='SUCCEEDED'")).isEqualTo(1);
            assertThat(read(student, uuid(exit, "id")).path("signatureStatus").asText())
                    .isEqualTo("PENDING");
        }
    }

    @Test
    void editingInvalidatesTheFirstRevisionAndSendsTheSecond() throws Exception {
        try (HttpClient student = login("residente")) {
            JsonNode first = create(student, 4 * 3600);
            run();
            Map<String, Object> edit = plan(5 * 3600);
            edit.put("version", first.path("version").asLong());
            JsonNode second =
                    response(put(student, "/api/v1/saidas-longas/" + uuid(first, "id"), edit), 200);
            assertThat(second.path("currentDocument").path("revisionNumber").asInt()).isEqualTo(2);
            assertThat(count("sager_signature_binding", "status='INVALIDATED'")).isEqualTo(1);
            clock.value = START.plusSeconds(600);
            run();
            assertThat(GATEWAY.sends()).hasSize(2);
            assertThat(json.readTree(GATEWAY.sends().get(1).body()).path("file").path("filename").asText())
                    .endsWith("-r2.pdf");
            assertThat(read(student, uuid(first, "id")).path("signatureStatus").asText())
                    .isEqualTo("PENDING");
        }
    }

    @Test
    void residentEditsAndNewRequestsFollowTheResendLimitsAndOnlyTheLatestRevisionGoesOut()
            throws Exception {
        try (HttpClient student = login("residente")) {
            JsonNode exit = create(student, 3 * 86400);
            UUID id = uuid(exit, "id");
            run();
            exit = edit(student, id, exit);
            exit = edit(student, id, exit);
            assertThat(exit.path("messageStatus").asText()).isEqualTo("QUEUED");
            run();
            assertThat(GATEWAY.sends()).hasSize(1);

            clock.value = START.plusSeconds(600);
            run();
            assertThat(GATEWAY.sends()).hasSize(2);
            assertThat(json.readTree(GATEWAY.sends().get(1).body()).path("file").path("filename").asText())
                    .endsWith("-r3.pdf");

            exit = edit(student, id, exit);
            clock.value = START.plusSeconds(1200);
            run();
            assertThat(GATEWAY.sends()).hasSize(3);

            exit = edit(student, id, exit);
            clock.value = START.plusSeconds(1800);
            run();
            assertThat(GATEWAY.sends()).hasSize(3);

            // Cancelling and asking again counts against the same limit.
            response(
                    post(
                            student,
                            path(id, "cancelamento"),
                            Map.of("version", exit.path("version").asLong(), "comment", COMMENT)),
                    200);
            create(student, 3 * 86400);
            clock.value = START.plusSeconds(2400);
            run();
            assertThat(GATEWAY.sends()).hasSize(3);
        }
    }

    @Test
    void interruptedSendShowsTheUncertainStateAndIsNotRepeated() throws Exception {
        try (HttpClient student = login("residente")) {
            UUID id = uuid(create(student, 4 * 3600), "id");
            assertThat(transactions.beginSend(transactions.claim())).isNotNull();
            jdbc.update(
                    "UPDATE sager_integration_task SET lease_until=?",
                    OffsetDateTime.ofInstant(START.minusSeconds(1), ZoneOffset.UTC));
            run();
            assertThat(GATEWAY.sends()).isEmpty();
            assertThat(count("sager_integration_task", "state='UNCERTAIN'")).isEqualTo(1);
            assertThat(read(student, id).path("messageStatus").asText()).isEqualTo("UNCERTAIN");
        }
    }

    @Test
    void sendThatEndsAfterItsTaskWasCancelledStillRecordsTheMessage() throws Exception {
        try (HttpClient student = login("residente")) {
            create(student, 4 * 3600);
            var task = transactions.claim();
            var send = transactions.beginSend(task);
            jdbc.update("UPDATE sager_integration_task SET state='CANCELLED'");
            transactions.sent(task, send.attemptId(), "LATE");
            assertThat(count("sager_whatsapp_attempt", "status='ACCEPTED' AND provider_message_id='LATE'"))
                    .isEqualTo(1);
            assertThat(count("sager_integration_task", "state='CANCELLED'")).isEqualTo(1);
        }
    }

    @Test
    void citingASupersededRevisionNeverBecomesACandidateOfTheCurrentOne() throws Exception {
        try (HttpClient student = login("residente")) {
            JsonNode exit = create(student, 4 * 3600);
            run();
            edit(student, uuid(exit, "id"), exit);
            clock.value = START.plusSeconds(600);
            run();
            clock.value = START.plusSeconds(660);
            arrive("OLD", GUARDIAN_CHAT, JPEG, "true_" + GUARDIAN_CHAT + "_MSG1");
            assertThat(count("sager_guardian_authorization_file", "TRUE")).isZero();
            arrive("NEW", GUARDIAN_CHAT, JPEG, "true_" + GUARDIAN_CHAT + "_MSG2");
            assertThat(count("sager_guardian_authorization_file", "TRUE")).isEqualTo(1);
        }
    }

    @Test
    void afterAResendAnAnswerToTheFirstSendBelongsToTheSameRevision() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = uuid(create(student, 4 * 3600), "id");
            run();
            clock.value = START.plusSeconds(600);
            JsonNode resent =
                    response(
                            post(
                                    supervisor,
                                    path(id, "reenvio"),
                                    Map.of("version", 0, "comment", COMMENT)),
                            200);
            run();
            clock.value = START.plusSeconds(660);
            arrive("ANSWER", GUARDIAN_CHAT, JPEG, "true_" + GUARDIAN_CHAT + "_MSG1");
            JsonNode exit = read(supervisor, id);
            assertThat(exit.path("version").asLong()).isEqualTo(resent.path("version").asLong());
            JsonNode confirmed =
                    response(
                            confirm(
                                    supervisor,
                                    id,
                                    exit.path("authorizationFiles").get(0).path("id").asText(),
                                    exit.path("version").asLong(),
                                    null),
                            200);
            assertThat(confirmed.path("signatureStatus").asText()).isEqualTo("VALID");
        }
    }

    @Test
    void aFileWaitingForConferenceHoldsTheResendAndARefusedOneCanStillBeLinked() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = candidate(student);
            clock.value = START.plusSeconds(700);
            JsonNode exit = read(supervisor, id);
            assertThat(exit.path("capabilities").path("canResend").asBoolean()).isFalse();
            long version = exit.path("version").asLong();
            error(
                    post(supervisor, path(id, "reenvio"), Map.of("version", version, "comment", COMMENT)),
                    409,
                    "authorization_pending");
            String file = exit.path("authorizationFiles").get(0).path("id").asText();
            JsonNode refused =
                    response(
                            post(
                                    supervisor,
                                    path(id, "autorizacao/arquivos/" + file + "/recusa"),
                                    Map.of("version", version, "comment", COMMENT)),
                            200);
            assertThat(refused.path("capabilities").path("canResend").asBoolean()).isTrue();
            JsonNode resent =
                    response(
                            post(
                                    supervisor,
                                    path(id, "reenvio"),
                                    Map.of(
                                            "version",
                                            refused.path("version").asLong(),
                                            "comment",
                                            COMMENT)),
                            200);
            JsonNode received =
                    response(get(supervisor, path(id, "autorizacao/nao-vinculados")), 200).get(0);
            JsonNode linked =
                    response(
                            post(
                                    supervisor,
                                    path(id, "autorizacao/vinculos"),
                                    Map.of(
                                            "version",
                                            resent.path("version").asLong(),
                                            "messageId",
                                            received.path("messageId").asText())),
                            200);
            assertThat(
                            response(
                                            confirm(
                                                    supervisor,
                                                    id,
                                                    linked.path("authorizationFiles")
                                                            .get(0)
                                                            .path("id")
                                                            .asText(),
                                                    linked.path("version").asLong(),
                                                    null),
                                            200)
                                    .path("signatureStatus")
                                    .asText())
                    .isEqualTo("VALID");
        }
    }

    @Test
    void correctingTheGuardianKeepsTheAttachmentPathOpenWithoutMessagingAnyone() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = uuid(create(student, 4 * 3600), "id");
            jdbc.update(
                    "UPDATE sager_guardian SET phone='+5562977770000',version=version+1 WHERE id=?",
                    guardian);
            JsonNode attached = attach(supervisor, id, read(supervisor, id).path("version").asLong());
            assertThat(attached.path("currentDocument").path("revisionNumber").asInt()).isEqualTo(1);
            JsonNode confirmed =
                    response(
                            confirm(
                                    supervisor,
                                    id,
                                    attached.path("authorizationFiles").get(0).path("id").asText(),
                                    attached.path("version").asLong(),
                                    null),
                            200);
            assertThat(confirmed.path("signatureStatus").asText()).isEqualTo("VALID");
            run();
            assertThat(GATEWAY.sends()).isEmpty();
        }
    }

    @Test
    void aCheckedFileOfAnOlderGuardianRecordGivesWayToANewRevision() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = candidate(student);
            JsonNode exit = read(supervisor, id);
            response(
                    confirm(
                            supervisor,
                            id,
                            exit.path("authorizationFiles").get(0).path("id").asText(),
                            exit.path("version").asLong(),
                            null),
                    200);
            jdbc.update(
                    "UPDATE sager_guardian SET phone='+5562977770000',version=version+1 WHERE id=?",
                    guardian);
            exit = read(supervisor, id);
            assertThat(exit.path("signatureStatus").asText()).isEqualTo("INVALIDATED");
            assertThat(exit.path("capabilities").path("canAttachAuthorization").asBoolean()).isTrue();
            JsonNode attached = attach(supervisor, id, exit.path("version").asLong());
            assertThat(attached.path("currentDocument").path("revisionNumber").asInt()).isEqualTo(2);
            assertThat(attached.path("history").toString()).contains("GUARDIAN_CHANGED");
            String attachedFile = null;
            for (JsonNode file : attached.path("authorizationFiles"))
                if ("CANDIDATE".equals(file.path("state").asText())) attachedFile = file.path("id").asText();
            JsonNode confirmed =
                    response(
                            confirm(supervisor, id, attachedFile, attached.path("version").asLong(), null),
                            200);
            assertThat(response(post(supervisor, path(id, "decisao"), approval(confirmed)), 200).path("status").asText())
                    .isEqualTo("APROVADA");
        }
    }

    @Test
    void theEndOfASessionIsAuditedAndAReadingIsNotAnEvent() throws Exception {
        String ended = "resource='WHATSAPP_SESSION' AND 'ended'=ANY(changed_fields)";
        clock.value = START.plusSeconds(60);
        session("FAILED");
        run();
        assertThat(count("sager_audit_event", ended)).isEqualTo(1);
        session("STOPPED");
        run();
        assertThat(count("sager_audit_event", ended)).isEqualTo(1);

        OffsetDateTime lastEvent =
                jdbc.queryForObject(
                        "SELECT last_event_at FROM sager_whatsapp_session", OffsetDateTime.class);
        clock.value = START.plusSeconds(600);
        worker.reconcileOnce();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM sager_whatsapp_session", String.class))
                .isEqualTo("WORKING");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT last_event_at FROM sager_whatsapp_session",
                                OffsetDateTime.class))
                .isEqualTo(lastEvent);
    }

    @Test
    void deliveryAndReadNeverAuthorize() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = uuid(create(student, 4 * 3600), "id");
            run();
            ack("MSG1", 3);
            ack("MSG1", 2);
            run();
            JsonNode exit = read(supervisor, id);
            assertThat(exit.path("messageStatus").asText()).isEqualTo("READ");
            assertThat(exit.path("signatureStatus").asText()).isEqualTo("PENDING");
            assertThat(exit.path("capabilities").path("canApprove").asBoolean()).isFalse();
            error(post(supervisor, path(id, "decisao"), approval(exit)), 409, "signature_required");
        }
    }

    @Test
    void authenticMessageWithFileStaysACandidateAndApprovesNothing() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = uuid(create(student, 4 * 3600), "id");
            run();
            clock.value = START.plusSeconds(60);
            arrive("IN1", GUARDIAN_CHAT, JPEG, null);
            JsonNode exit = read(supervisor, id);
            JsonNode file = exit.path("authorizationFiles").get(0);
            assertThat(file.path("state").asText()).isEqualTo("CANDIDATE");
            assertThat(file.path("origin").asText()).isEqualTo("WHATSAPP");
            assertThat(file.path("senderDivergent").asBoolean()).isFalse();
            assertThat(exit.path("signatureStatus").asText()).isEqualTo("PENDING");
            assertThat(exit.path("capabilities").path("canApprove").asBoolean()).isFalse();
            assertThat(exit.path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
            error(post(supervisor, path(id, "decisao"), approval(exit)), 409, "signature_required");
            assertThat(read(student, id).path("authorizationFiles").size()).isZero();
        }
    }

    @Test
    void correlatesOnlyAnUnambiguousSenderAndLetsTheSupervisorLinkTheRest() throws Exception {
        UUID sibling = resident("FLOW-B", "irmao");
        jdbc.update(
                "INSERT INTO sager_guardian(id,resident_id,name,relationship,phone,active) VALUES"
                        + " (?,?,'Responsável sintético','Mãe','+5562999990000',true)",
                UUID.randomUUID(),
                sibling);
        try (HttpClient one = login("residente");
                HttpClient two = login("irmao");
                HttpClient supervisor = login("supervisor")) {
            UUID first = uuid(create(one, 4 * 3600), "id");
            run();
            clock.value = START.plusSeconds(30);
            arrive("BEFORE", "5562988880000@c.us", JPEG, null);
            assertThat(count("sager_guardian_authorization_file", "TRUE")).isZero();
            Map<String, Object> plan = plan(4 * 3600);
            plan.put(
                    "guardianId",
                    jdbc.queryForObject(
                                    "SELECT id FROM sager_guardian WHERE resident_id=?",
                                    UUID.class,
                                    sibling)
                            .toString());
            UUID second = uuid(response(post(two, "/api/v1/saidas-longas", plan), 201), "id");
            run();
            clock.value = START.plusSeconds(60);
            arrive("AMBIGUOUS", GUARDIAN_CHAT, JPEG, null);
            assertThat(count("sager_guardian_authorization_file", "TRUE")).isZero();
            JsonNode unlinked =
                    response(get(supervisor, path(first, "autorizacao/nao-vinculados")), 200);
            JsonNode received = null;
            for (JsonNode item : unlinked) {
                if ("+5562999990000".equals(item.path("senderPhone").asText())) received = item;
            }
            assertThat(received.path("fromGuardian").asBoolean()).isTrue();
            arrive("QUOTED", GUARDIAN_CHAT, JPEG, "true_" + GUARDIAN_CHAT + "_MSG2");
            assertThat(read(supervisor, second).path("authorizationFiles").size()).isEqualTo(1);
            assertThat(read(supervisor, first).path("authorizationFiles").size()).isZero();
            JsonNode exit = read(supervisor, first);
            JsonNode linked =
                    response(
                            post(
                                    supervisor,
                                    path(first, "autorizacao/vinculos"),
                                    Map.of(
                                            "version",
                                            exit.path("version").asLong(),
                                            "messageId",
                                            received.path("messageId").asText())),
                            200);
            assertThat(linked.path("authorizationFiles").get(0).path("state").asText())
                    .isEqualTo("CANDIDATE");
            error(
                    post(
                            supervisor,
                            path(first, "autorizacao/vinculos"),
                            Map.of(
                                    "version",
                                    linked.path("version").asLong(),
                                    "messageId",
                                    received.path("messageId").asText())),
                    409,
                    "already_linked");
        }
    }

    @Test
    void unknownNumberCreatesNoLink() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = uuid(create(student, 4 * 3600), "id");
            run();
            clock.value = START.plusSeconds(60);
            arrive("UNKNOWN", "5562988880000@c.us", JPEG, null);
            assertThat(count("sager_guardian_authorization_file", "TRUE")).isZero();
            assertThat(count("sager_whatsapp_message", "direction='IN' AND media_state='STORED'"))
                    .isEqualTo(1);
            JsonNode item =
                    response(get(supervisor, path(id, "autorizacao/nao-vinculados")), 200).get(0);
            assertThat(item.path("fromGuardian").asBoolean()).isFalse();
        }
    }

    @Test
    void supervisorConfirmsThenApprovesAsSeparateActs() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient manager = login("gestor");
                HttpClient supervisor = login("supervisor")) {
            UUID id = candidate(student);
            JsonNode exit = read(supervisor, id);
            String file = exit.path("authorizationFiles").get(0).path("id").asText();
            long version = exit.path("version").asLong();
            String download = path(id, "autorizacao/arquivos/" + file);
            assertThat(get(manager, download).statusCode()).isEqualTo(403);
            assertThat(get(student, download).statusCode()).isEqualTo(403);
            HttpResponse<byte[]> bytes =
                    supervisor.send(
                            HttpRequest.newBuilder(uri(download)).GET().build(),
                            HttpResponse.BodyHandlers.ofByteArray());
            assertThat(bytes.body()).isEqualTo(JPEG);
            assertThat(bytes.headers().firstValue("Content-Type").orElseThrow())
                    .startsWith("image/jpeg");
            assertThat(bytes.headers().firstValue("X-Content-Type-Options").orElseThrow())
                    .isEqualTo("nosniff");
            assertThat(bytes.headers().firstValue("Cache-Control").orElseThrow())
                    .contains("no-store");
            error(confirm(manager, id, file, version, null), 403, "forbidden");
            error(confirm(student, id, file, version, null), 403, "forbidden");
            error(
                    post(
                            supervisor,
                            path(id, "autorizacao/arquivos/" + file + "/conferencia"),
                            Map.of("version", version, "confirmed", false)),
                    400,
                    "invalid_input");
            error(confirm(supervisor, id, file, version + 1, null), 409, "stale_version");
            clock.value = START.plusSeconds(120);
            JsonNode confirmed = response(confirm(supervisor, id, file, version, null), 200);
            assertThat(confirmed.path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
            assertThat(confirmed.path("signatureStatus").asText()).isEqualTo("VALID");
            assertThat(confirmed.path("capabilities").path("canApprove").asBoolean()).isTrue();
            assertThat(confirmed.path("capabilities").path("canAttachAuthorization").asBoolean())
                    .isFalse();
            JsonNode binding = confirmed.path("bindings").get(0);
            assertThat(binding.path("verifiedBy").asText()).isNotBlank();
            assertThat(binding.path("verifiedByName").asText()).isEqualTo("Pessoa sintética");
            assertThat(confirmed.path("authorizationFiles").get(0).path("decidedByName").asText())
                    .isEqualTo("Pessoa sintética");
            assertThat(read(student, id).path("bindings").get(0).path("verifiedByName").isNull())
                    .isTrue();
            assertThat(binding.path("verifiedAt").asText()).isEqualTo(clock.value.toString());
            assertThat(confirmed.path("authorizationFiles").get(0).path("state").asText())
                    .isEqualTo("ACCEPTED");
            assertThat(confirmed.path("history").toString()).contains("AUTHORIZATION_CONFIRMED");
            UUID signed =
                    jdbc.queryForObject(
                            "SELECT signed_file_id FROM sager_document_version", UUID.class);
            assertThat(Files.readAllBytes(PRIVATE.resolve(signed.toString()))).isEqualTo(JPEG);
            HttpResponse<byte[]> evidence =
                    supervisor.send(
                            HttpRequest.newBuilder(
                                            uri(
                                                    path(
                                                            id,
                                                            "documentos/"
                                                                    + confirmed
                                                                            .path("currentDocument")
                                                                            .path("documentVersionId")
                                                                            .asText()
                                                                    + "/assinado")))
                                    .GET()
                                    .build(),
                            HttpResponse.BodyHandlers.ofByteArray());
            assertThat(evidence.body()).isEqualTo(JPEG);
            assertThat(evidence.headers().firstValue("Content-Type").orElseThrow())
                    .startsWith("image/jpeg");
            assertThat(evidence.headers().firstValue("Content-Disposition").orElseThrow())
                    .contains(".jpg");
            JsonNode approved =
                    response(post(supervisor, path(id, "decisao"), approval(confirmed)), 200);
            assertThat(approved.path("status").asText()).isEqualTo("APROVADA");
        }
    }

    @Test
    void candidateOfAnEarlierRevisionIsStale() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = candidate(student);
            JsonNode exit = read(supervisor, id);
            String file = exit.path("authorizationFiles").get(0).path("id").asText();
            Map<String, Object> edit = plan(5 * 3600);
            edit.put("version", exit.path("version").asLong());
            JsonNode edited = response(put(student, "/api/v1/saidas-longas/" + id, edit), 200);
            error(
                    confirm(supervisor, id, file, edited.path("version").asLong(), null),
                    409,
                    "stale_document");
            assertThat(count("sager_signature_binding", "status='VALID'")).isZero();
        }
    }

    @Test
    void divergentSenderRequiresJustificationAndIsHighlighted() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = uuid(create(student, 4 * 3600), "id");
            run();
            clock.value = START.plusSeconds(60);
            arrive("OTHER", "5562988880000@c.us", JPEG, null);
            JsonNode exit = read(supervisor, id);
            String message =
                    response(get(supervisor, path(id, "autorizacao/nao-vinculados")), 200)
                            .get(0)
                            .path("messageId")
                            .asText();
            JsonNode linked =
                    response(
                            post(
                                    supervisor,
                                    path(id, "autorizacao/vinculos"),
                                    Map.of(
                                            "version",
                                            exit.path("version").asLong(),
                                            "messageId",
                                            message)),
                            200);
            JsonNode file = linked.path("authorizationFiles").get(0);
            assertThat(file.path("senderDivergent").asBoolean()).isTrue();
            long version = linked.path("version").asLong();
            error(confirm(supervisor, id, file.path("id").asText(), version, null), 400, "invalid_input");
            error(confirm(supervisor, id, file.path("id").asText(), version, "curta"), 400, "invalid_input");
            JsonNode confirmed =
                    response(confirm(supervisor, id, file.path("id").asText(), version, COMMENT), 200);
            assertThat(confirmed.path("authorizationFiles").get(0).path("decisionReason").asText())
                    .isEqualTo(COMMENT);
        }
    }

    @Test
    void refusalKeepsTheFileAndANewOneCanArrive() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient manager = login("gestor");
                HttpClient supervisor = login("supervisor")) {
            UUID id = candidate(student);
            JsonNode exit = read(supervisor, id);
            String file = exit.path("authorizationFiles").get(0).path("id").asText();
            String p = path(id, "autorizacao/arquivos/" + file + "/recusa");
            long version = exit.path("version").asLong();
            error(post(manager, p, Map.of("version", version, "comment", COMMENT)), 403, "forbidden");
            error(post(supervisor, p, Map.of("version", version, "comment", "curta")), 400, "invalid_input");
            JsonNode refused =
                    response(post(supervisor, p, Map.of("version", version, "comment", COMMENT)), 200);
            assertThat(refused.path("authorizationFiles").get(0).path("state").asText())
                    .isEqualTo("REFUSED");
            assertThat(refused.path("signatureStatus").asText()).isEqualTo("PENDING");
            assertThat(refused.path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
            assertThat(refused.path("history").toString()).contains("AUTHORIZATION_REFUSED");
            error(
                    confirm(supervisor, id, file, refused.path("version").asLong(), null),
                    409,
                    "invalid_state");
            clock.value = START.plusSeconds(180);
            arrive("IN2", GUARDIAN_CHAT, JPEG, null);
            assertThat(count("sager_guardian_authorization_file", "state='CANDIDATE'")).isEqualTo(1);
            assertThat(count("sager_guardian_authorization_file", "state='REFUSED'")).isEqualTo(1);
        }
    }

    @Test
    void alteredStoredFilesAndChangedGuardianBlockTheDecision() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = candidate(student);
            JsonNode exit = read(supervisor, id);
            JsonNode confirmed =
                    response(
                            confirm(
                                    supervisor,
                                    id,
                                    exit.path("authorizationFiles").get(0).path("id").asText(),
                                    exit.path("version").asLong(),
                                    null),
                            200);
            Path signed =
                    PRIVATE.resolve(
                            jdbc.queryForObject(
                                            "SELECT signed_file_id FROM sager_document_version",
                                            UUID.class)
                                    .toString());
            byte[] kept = Files.readAllBytes(signed);
            signed.toFile().setWritable(true);
            Files.write(signed, "ALTERADO".getBytes(StandardCharsets.US_ASCII));
            error(
                    post(supervisor, path(id, "decisao"), approval(confirmed)),
                    409,
                    "document_unavailable");
            Files.write(signed, kept);
            jdbc.update(
                    "UPDATE sager_guardian SET phone='+5562977770000',version=version+1 WHERE id=?",
                    guardian);
            assertThat(
                            post(supervisor, path(id, "decisao"), approval(confirmed))
                                    .statusCode())
                    .isEqualTo(409);
            assertThat(read(supervisor, id).path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
        }
    }

    @Test
    void candidateFromAGuardianWhoChangedCannotBeConfirmed() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = candidate(student);
            JsonNode exit = read(supervisor, id);
            jdbc.update(
                    "UPDATE sager_guardian SET phone='+5562977770000',version=version+1 WHERE id=?",
                    guardian);
            error(
                    confirm(
                            supervisor,
                            id,
                            exit.path("authorizationFiles").get(0).path("id").asText(),
                            exit.path("version").asLong(),
                            null),
                    409,
                    "guardian_not_eligible");
        }
    }

    @Test
    void attachingToARequestWithoutAnOpenBindingNeverMessagesTheGuardian() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = uuid(create(student, 4 * 3600), "id");
            jdbc.update("UPDATE sager_integration_task SET state='CANCELLED'");
            jdbc.update("UPDATE sager_signature_binding SET status='INVALIDATED',revoked_at=?",
                    OffsetDateTime.ofInstant(START, ZoneOffset.UTC));
            JsonNode exit = read(supervisor, id);
            JsonNode attached = attach(supervisor, id, exit.path("version").asLong());
            assertThat(attached.path("authorizationFiles").get(0).path("origin").asText())
                    .isEqualTo("MANUAL");
            assertThat(attached.path("messageStatus").asText()).isEqualTo("UNAVAILABLE");
            run();
            assertThat(GATEWAY.sends()).isEmpty();
            assertThat(count("sager_integration_task", "state='PENDING'")).isZero();
        }
    }

    @Test
    void warnsOnlyAfterFifteenMinutesWithoutDelivery() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = uuid(create(student, 4 * 3600), "id");
            run();
            clock.value = START.plusSeconds(14 * 60);
            assertThat(read(supervisor, id).path("deliveryUnconfirmed").asBoolean()).isFalse();
            clock.value = START.plusSeconds(20 * 60);
            JsonNode late = read(supervisor, id);
            assertThat(late.path("deliveryUnconfirmed").asBoolean()).isTrue();
            assertThat(late.path("capabilities").path("canAttachAuthorization").asBoolean()).isTrue();
            assertThat(read(student, id).path("deliveryUnconfirmed").asBoolean()).isFalse();
            ack("MSG1", 2);
            run();
            assertThat(read(supervisor, id).path("deliveryUnconfirmed").asBoolean()).isFalse();
        }
    }

    @Test
    void webhookIsAuthenticatedByTheSignatureOverTheRawBytesWithoutCsrf() throws Exception {
        byte[] body = envelope("message", incoming("SIGNED", GUARDIAN_CHAT, null, null));
        int before = count("sager_webhook_inbox", "TRUE");
        error(webhook(body, null), 401, "invalid_webhook");
        error(webhook(body, "00" + signature(body).substring(2)), 401, "invalid_webhook");
        error(webhook(body, "not-hexadecimal"), 401, "invalid_webhook");
        byte[] other = Arrays.copyOf(body, body.length + 1);
        other[body.length] = ' ';
        error(webhook(other, signature(body)), 401, "invalid_webhook");
        assertThat(count("sager_webhook_inbox", "TRUE")).isEqualTo(before);
        assertThat(webhook(other, signature(other)).statusCode()).isEqualTo(202);
        assertThat(count("sager_webhook_inbox", "TRUE")).isEqualTo(before + 1);
    }

    @Test
    void repeatedEventKeepsOneRecord() throws Exception {
        clock.value = START.plusSeconds(60);
        byte[] body = envelope("message", incoming("REPEAT", GUARDIAN_CHAT, null, null));
        assertThat(webhook(body, signature(body)).statusCode()).isEqualTo(202);
        assertThat(webhook(body, signature(body)).statusCode()).isEqualTo(202);
        run();
        byte[] again = envelope("message", incoming("REPEAT", GUARDIAN_CHAT, null, null));
        assertThat(webhook(again, signature(again)).statusCode()).isEqualTo(202);
        run();
        assertThat(count("sager_webhook_inbox", "TRUE")).isEqualTo(1);
        assertThat(count("sager_whatsapp_message", "provider_message_id='REPEAT'")).isEqualTo(1);
    }

    @Test
    void groupsStatusChannelsAndOwnMessagesRecordNothing() throws Exception {
        clock.value = START.plusSeconds(60);
        for (String chat :
                List.of("120363000000000000@g.us", "status@broadcast", "120363000000000000@newsletter")) {
            byte[] body = envelope("message", incoming("X" + chat.hashCode(), chat, null, null));
            assertThat(webhook(body, signature(body)).statusCode()).isEqualTo(202);
        }
        Map<String, Object> own = incoming("OWN", GUARDIAN_CHAT, null, null);
        own.put("fromMe", true);
        byte[] body = envelope("message", own);
        assertThat(webhook(body, signature(body)).statusCode()).isEqualTo(202);
        run();
        assertThat(count("sager_webhook_inbox", "TRUE")).isZero();
        assertThat(count("sager_whatsapp_message", "TRUE")).isZero();
        assertThat(count("sager_whatsapp_conversation", "TRUE")).isZero();
    }

    @Test
    void messagesFromBeforeTheLinkAreIgnoredAndARestartKeepsTheLinkInstant() throws Exception {
        clock.value = START.plusSeconds(600);
        Map<String, Object> old = incoming("OLD", GUARDIAN_CHAT, null, null);
        old.put("timestamp", START.minusSeconds(60).getEpochSecond());
        byte[] body = envelope("message", old);
        assertThat(webhook(body, signature(body)).statusCode()).isEqualTo(202);
        run();
        assertThat(count("sager_whatsapp_message", "TRUE")).isZero();

        session("STOPPED");
        clock.value = START.plusSeconds(700);
        session("WORKING");
        assertThat(
                        jdbc.queryForObject(
                                        "SELECT linked_at FROM sager_whatsapp_session",
                                        OffsetDateTime.class)
                                .toInstant())
                .isEqualTo(START);

        session("SCAN_QR_CODE");
        Map<String, Object> during = incoming("DURING", GUARDIAN_CHAT, null, null);
        body = envelope("message", during);
        assertThat(webhook(body, signature(body)).statusCode()).isEqualTo(202);
        run();
        assertThat(count("sager_whatsapp_message", "TRUE")).isZero();

        clock.value = START.plusSeconds(800);
        session("WORKING");
        assertThat(
                        jdbc.queryForObject(
                                        "SELECT linked_at FROM sager_whatsapp_session",
                                        OffsetDateTime.class)
                                .toInstant())
                .isEqualTo(START.plusSeconds(800));
    }

    @Test
    void malformedAndFailingEventsAreMarkedAndDoNotBlockTheNext() throws Exception {
        clock.value = START.plusSeconds(60);
        byte[] unreadable = "{not-json".getBytes(StandardCharsets.UTF_8);
        assertThat(webhook(unreadable, signature(unreadable)).statusCode()).isEqualTo(202);
        assertThat(count("sager_webhook_inbox", "failure_code='event_invalid' AND processed_at IS NOT NULL"))
                .isEqualTo(1);
        assertThat(webhook(unreadable, signature(unreadable)).statusCode()).isEqualTo(202);
        assertThat(count("sager_webhook_inbox", "TRUE")).isEqualTo(1);
        jdbc.update(
                "INSERT INTO sager_webhook_inbox(id,provider,environment,event_key,payload,received_at)"
                        + " VALUES (?,'WHATSAPP','default',repeat('b',64),'{\"kind\":\"BROKEN\"}'::jsonb,?)",
                UUID.randomUUID(),
                OffsetDateTime.ofInstant(START, ZoneOffset.UTC));
        byte[] good = envelope("message", incoming("GOOD", GUARDIAN_CHAT, null, null));
        assertThat(webhook(good, signature(good)).statusCode()).isEqualTo(202);
        run();
        assertThat(count("sager_webhook_inbox", "failure_code='event_processing_failed'")).isEqualTo(1);
        assertThat(count("sager_whatsapp_message", "provider_message_id='GOOD'")).isEqualTo(1);
        assertThat(count("sager_webhook_inbox", "processed_at IS NULL")).isZero();
    }

    @Test
    void numberWithoutTheNinthDigitIsTheSameGuardian() throws Exception {
        jdbc.update(
                "UPDATE sager_guardian SET phone='+5562912345678',version=version+1 WHERE id=?",
                guardian);
        try (HttpClient student = login("residente")) {
            create(student, 4 * 3600);
            run();
            assertThat(json.readTree(GATEWAY.sends().getFirst().body()).path("chatId").asText())
                    .isEqualTo("5562912345678@c.us");
            clock.value = START.plusSeconds(60);
            arrive("OLDFORM", "556212345678@c.us", JPEG, null);
            assertThat(
                            count(
                                    "sager_guardian_authorization_file",
                                    "sender_phone='+556212345678' AND state='CANDIDATE'"))
                    .isEqualTo(1);
        }
    }

    @Test
    void lidIsResolvedThroughTheGatewayAndUnresolvedStaysUnlinked() throws Exception {
        try (HttpClient student = login("residente")) {
            create(student, 4 * 3600);
            run();
            clock.value = START.plusSeconds(60);
            arrive("LIDUNK", "111111111111@lid", JPEG, null);
            assertThat(count("sager_guardian_authorization_file", "TRUE")).isZero();
            assertThat(
                            count(
                                    "sager_whatsapp_message",
                                    "provider_message_id='LIDUNK' AND sender_phone IS NULL"
                                            + " AND sender_lid='111111111111@lid' AND media_state='STORED'"))
                    .isEqualTo(1);
            GATEWAY.lids.put("222222222222@lid", "5562999990000@c.us");
            arrive("LIDOK", "222222222222@lid", JPEG, null);
            assertThat(
                            count(
                                    "sager_guardian_authorization_file",
                                    "sender_phone='+5562999990000' AND state='CANDIDATE'"))
                    .isEqualTo(1);
        }
    }

    @Test
    void mediaHostFromTheEventIsNeverContactedAndOutsidePathsAreRefused() throws Exception {
        clock.value = START.plusSeconds(60);
        String file = "/api/files/default/HOSTILE.jpg";
        GATEWAY.files.put(file, JPEG);
        post(incoming("HOSTILE", GUARDIAN_CHAT, OUTSIDE.root() + file, null));
        post(incoming("OUTPATH", GUARDIAN_CHAT, GATEWAY.root() + "/api/server/stop", null));
        post(incoming("DOTS", GUARDIAN_CHAT, GATEWAY.root() + "/api/files/../server/stop", null));
        run();
        assertThat(OUTSIDE.calls).isEmpty();
        assertThat(GATEWAY.calls.stream().map(Call::path)).containsExactly(file);
        assertThat(GATEWAY.calls.getFirst().apiKey()).isEqualTo(API_KEY);
        assertThat(count("sager_whatsapp_message", "provider_message_id='HOSTILE' AND media_state='STORED'"))
                .isEqualTo(1);
        assertThat(
                        count(
                                "sager_whatsapp_message",
                                "provider_message_id IN ('OUTPATH','DOTS') AND media_state='FAILED'"
                                        + " AND media_failure_code='media_path_refused'"))
                .isEqualTo(2);
    }

    @Test
    void oversizedTypeRefusedAndMissingMediaStayVisible() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = uuid(create(student, 4 * 3600), "id");
            run();
            clock.value = START.plusSeconds(60);
            arrive("BIG", GUARDIAN_CHAT, new byte[11 * 1024 * 1024], null);
            arrive("EXE", GUARDIAN_CHAT, EXECUTABLE, null);
            post(incoming("GONE", GUARDIAN_CHAT, GATEWAY.root() + "/api/files/default/GONE.jpg", null));
            run();
            assertThat(failure("BIG")).isEqualTo("media_too_large");
            assertThat(failure("EXE")).isEqualTo("media_type_not_allowed");
            assertThat(failure("GONE")).isEqualTo("media_unavailable");
            assertThat(count("sager_guardian_authorization_file", "TRUE")).isZero();
            JsonNode unlinked = response(get(supervisor, path(id, "autorizacao/nao-vinculados")), 200);
            assertThat(unlinked.toString())
                    .contains("media_too_large", "media_type_not_allowed", "media_unavailable");
        }
    }

    @Test
    void temporaryMediaFailureRetriesWithALeaseAndThenStops() throws Exception {
        clock.value = START.plusSeconds(60);
        String path = "/api/files/default/SLOW.jpg";
        GATEWAY.fileStatus = 503;
        post(incoming("SLOW", GUARDIAN_CHAT, GATEWAY.root() + path, null));
        run();
        assertThat(count("sager_whatsapp_job", "state='PENDING' AND failure_code='provider_http_temporary'"))
                .isEqualTo(1);
        run();
        assertThat(GATEWAY.calls).hasSize(1);
        for (int wait : List.of(60, 300, 900, 900)) {
            clock.value = clock.value.plusSeconds(wait);
            run();
        }
        assertThat(GATEWAY.calls).hasSize(5);
        assertThat(count("sager_whatsapp_job", "state='FAILED'")).isEqualTo(1);
        assertThat(failure("SLOW")).isEqualTo("provider_http_temporary");
        clock.value = clock.value.plusSeconds(3600);
        run();
        assertThat(GATEWAY.calls).hasSize(5);
    }

    @Test
    void reconciliationRecoversALostFileWithoutDuplicates() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = uuid(create(student, 4 * 3600), "id");
            run();
            clock.value = START.plusSeconds(60);
            GATEWAY.calls.clear();
            String path = "/api/files/default/LOST.jpg";
            GATEWAY.files.put(path, JPEG);
            Map<String, Object> lost = incoming("LOST", GUARDIAN_CHAT, GATEWAY.root() + path, null);
            lost.put("id", "false_" + GUARDIAN_CHAT + "_LOST");
            Map<String, Object> beforeLink = incoming("ANCIENT", GUARDIAN_CHAT, null, null);
            beforeLink.put("timestamp", START.minusSeconds(3600).getEpochSecond());
            Map<String, Object> own = incoming("MINE", GUARDIAN_CHAT, null, null);
            own.put("fromMe", true);
            GATEWAY.history.put(GUARDIAN_CHAT, List.of(lost, beforeLink, own, Map.of("id", 1)));
            worker.reconcileOnce();
            run();
            Call query =
                    GATEWAY.calls.stream()
                            .filter(c -> c.path().endsWith("/messages"))
                            .findFirst()
                            .orElseThrow();
            assertThat(query.path()).isEqualTo("/api/default/chats/" + GUARDIAN_CHAT + "/messages");
            assertThat(query.query()).contains("limit=", "filter.fromMe=false", "filter.timestamp.gte=");
            assertThat(read(supervisor, id).path("authorizationFiles").size()).isEqualTo(1);
            assertThat(count("sager_whatsapp_message", "origin='RECONCILIATION'")).isEqualTo(1);
            worker.reconcileOnce();
            run();
            post(incoming("LOST", GUARDIAN_CHAT, GATEWAY.root() + path, null));
            run();
            assertThat(count("sager_whatsapp_message", "direction='IN'")).isEqualTo(1);
            assertThat(count("sager_whatsapp_job", "TRUE")).isEqualTo(1);
            assertThat(count("sager_guardian_authorization_file", "TRUE")).isEqualTo(1);
        }
    }

    @Test
    void reconciliationRecoversWhatAFreeConversationLostOncePerRound() throws Exception {
        String chat = "5562988880000@c.us";
        clock.value = START.plusSeconds(60);
        post(incoming("SEEN", chat, null, null));
        run();
        clock.value = START.plusSeconds(120);
        Map<String, Object> lost = incoming("GONE", chat, null, null);
        lost.put("id", "false_" + chat + "_GONE");
        GATEWAY.history.put(chat, List.of(lost));
        worker.reconcileOnce();
        run();
        assertThat(count("sager_whatsapp_message", "origin='RECONCILIATION'")).isEqualTo(1);
        worker.reconcileOnce();
        run();
        assertThat(count("sager_whatsapp_message", "TRUE")).isEqualTo(2);

        // More than a day without activity: the gateway is no longer asked about this chat.
        clock.value = START.plusSeconds(120 + 86400 + 1);
        GATEWAY.calls.clear();
        worker.reconcileOnce();
        assertThat(GATEWAY.calls.stream().filter(c -> c.path().endsWith("/messages"))).isEmpty();
    }

    @Test
    void reconciliationAsksOnceForAPendingChatAndRespectsTheRoundLimit() throws Exception {
        try (HttpClient student = login("residente")) {
            create(student, 4 * 3600);
            run();
        }
        clock.value = START.plusSeconds(60);
        GATEWAY.calls.clear();
        worker.reconcileOnce();
        assertThat(GATEWAY.calls.stream().filter(c -> c.path().endsWith("/messages"))).hasSize(1);

        for (int i = 0; i < 30; i++) {
            jdbc.update(
                    "INSERT INTO sager_whatsapp_conversation(id,provider,session,chat_id,last_message_at,"
                            + "created_at,updated_at) VALUES (?,'WHATSAPP_GATEWAY','default',?,?,?,?)",
                    UUID.randomUUID(),
                    "55629000000" + i + "@c.us",
                    OffsetDateTime.ofInstant(clock.value, ZoneOffset.UTC),
                    OffsetDateTime.ofInstant(clock.value, ZoneOffset.UTC),
                    OffsetDateTime.ofInstant(clock.value, ZoneOffset.UTC));
        }
        GATEWAY.calls.clear();
        worker.reconcileOnce();
        // The pending chat, plus at most 20 active ones.
        assertThat(GATEWAY.calls.stream().filter(c -> c.path().endsWith("/messages")).count())
                .isBetween(20L, 21L);
    }

    @Test
    void theAuthorizationPdfJoinsTheGuardiansConversationOnce() throws Exception {
        // The guardian already talks from the form of the number without the ninth digit.
        jdbc.update(
                "UPDATE sager_guardian SET phone='+5562912345678',version=version+1 WHERE id=?",
                guardian);
        post(incoming("HELLO", "556212345678@c.us", null, null));
        run();
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            UUID id = uuid(create(student, 4 * 3600), "id");
            run();
            run();
            assertThat(GATEWAY.sends()).hasSize(1);
            assertThat(count("sager_whatsapp_conversation", "TRUE")).isEqualTo(1);
            assertThat(
                            count(
                                    "sager_whatsapp_message",
                                    "direction='OUT' AND origin='AUTHORIZATION' AND provider_message_id='MSG1'"
                                            + " AND delivery_status='SENT' AND media_state='STORED'"
                                            + " AND media_mime_type='application/pdf'"
                                            + " AND media_filename LIKE 'autorizacao-%'"))
                    .isEqualTo(1);
            assertThat(count("sager_whatsapp_job", "TRUE")).isZero();
            assertThat(read(supervisor, id).path("signatureStatus").asText()).isEqualTo("PENDING");

            UUID message =
                    jdbc.queryForObject(
                            "SELECT id FROM sager_whatsapp_message WHERE provider_message_id='MSG1'",
                            UUID.class);
            HttpResponse<byte[]> media =
                    supervisor.send(
                            HttpRequest.newBuilder(
                                            uri("/api/v1/conversas/mensagens/" + message + "/midia"))
                                    .GET()
                                    .build(),
                            HttpResponse.BodyHandlers.ofByteArray());
            assertThat(media.statusCode()).isEqualTo(200);
            assertThat(media.body())
                    .isEqualTo(
                            Base64.getDecoder()
                                    .decode(
                                            json.readTree(GATEWAY.sends().getFirst().body())
                                                    .path("file")
                                                    .path("data")
                                                    .asText()));

            ack("MSG1", 3);
            run();
            assertThat(
                            count(
                                    "sager_whatsapp_message",
                                    "provider_message_id='MSG1' AND delivery_status='READ'"))
                    .isEqualTo(1);

            // A resend of the same revision is another message of the same PDF.
            clock.value = START.plusSeconds(600);
            response(
                    post(
                            supervisor,
                            path(id, "reenvio"),
                            Map.of(
                                    "version",
                                    read(supervisor, id).path("version").asLong(),
                                    "comment",
                                    COMMENT)),
                    200);
            run();
            assertThat(count("sager_whatsapp_message", "origin='AUTHORIZATION'")).isEqualTo(2);
        }
    }

    @Test
    void aHistoryThatCannotBeWrittenDoesNotHoldTheExit() throws Exception {
        jdbc.execute(
                "ALTER TABLE sager_whatsapp_message ADD CONSTRAINT test_history_refused"
                        + " CHECK (origin <> 'AUTHORIZATION') NOT VALID");
        try (HttpClient student = login("residente")) {
            JsonNode exit = create(student, 4 * 3600);
            run();
            assertThat(GATEWAY.sends()).hasSize(1);
            assertThat(count("sager_integration_task", "state='SUCCEEDED'")).isEqualTo(1);
            assertThat(count("sager_whatsapp_attempt", "status='ACCEPTED'")).isEqualTo(1);
            assertThat(count("sager_whatsapp_message", "TRUE")).isZero();
            assertThat(read(student, uuid(exit, "id")).path("status").asText())
                    .isEqualTo("AGUARDANDO_ANALISE");
        } finally {
            jdbc.execute("ALTER TABLE sager_whatsapp_message DROP CONSTRAINT test_history_refused");
        }
    }

    @Test
    void ambiguousSendIsNeverRepeated() throws Exception {
        try (HttpClient student = login("residente")) {
            JsonNode exit = create(student, 4 * 3600);
            GATEWAY.sendStatus = 503;
            run();
            assertThat(GATEWAY.sends()).hasSize(1);
            assertThat(count("sager_integration_task", "state='UNCERTAIN'")).isEqualTo(1);
            run();
            assertThat(GATEWAY.sends()).hasSize(1);
            assertThat(read(student, uuid(exit, "id")).path("messageStatus").asText())
                    .isEqualTo("UNCERTAIN");
            jdbc.update(
                    "UPDATE sager_integration_task SET state='RUNNING',in_flight=true,lease_until=?",
                    OffsetDateTime.ofInstant(START.minusSeconds(1), ZoneOffset.UTC));
            run();
            assertThat(GATEWAY.sends()).hasSize(1);
            assertThat(count("sager_integration_task", "state='UNCERTAIN'")).isEqualTo(1);
        }
    }

    @Test
    void safeRetriesWaitAndStopAfterFiveAttempts() throws Exception {
        try (HttpClient student = login("residente")) {
            create(student, 4 * 3600);
            GATEWAY.sendStatus = 429;
            run();
            assertThat(
                            jdbc.queryForObject(
                                            "SELECT next_attempt_at FROM sager_integration_task",
                                            OffsetDateTime.class)
                                    .toInstant())
                    .isEqualTo(START.plusSeconds(60));
            run();
            assertThat(GATEWAY.sends()).hasSize(1);
            for (int wait : List.of(60, 300, 900, 900)) {
                clock.value = clock.value.plusSeconds(wait);
                run();
            }
            assertThat(GATEWAY.sends()).hasSize(5);
            assertThat(count("sager_integration_task", "state='FAILED' AND attempt_count=5"))
                    .isEqualTo(1);
            clock.value = clock.value.plusSeconds(3600);
            run();
            assertThat(GATEWAY.sends()).hasSize(5);
        }
    }

    @Test
    void sessionNotReadyWaitsAndUnknownNumberFailsWithoutPosting() throws Exception {
        try (HttpClient student = login("residente")) {
            JsonNode exit = create(student, 4 * 3600);
            GATEWAY.checkStatus = 422;
            run();
            assertThat(GATEWAY.sends()).isEmpty();
            assertThat(count("sager_integration_task", "state='PENDING' AND failure_code='session_not_ready'"))
                    .isEqualTo(1);
            // A retry is scheduled, so the request still waits; the reason reaches the screen.
            JsonNode waiting = read(student, uuid(exit, "id"));
            assertThat(waiting.path("messageStatus").asText()).isEqualTo("QUEUED");
            assertThat(waiting.path("bindings").get(0).path("failureCode").asText())
                    .isEqualTo("session_not_ready");
            GATEWAY.checkStatus = 200;
            GATEWAY.numberExists = false;
            clock.value = clock.value.plusSeconds(60);
            run();
            assertThat(GATEWAY.sends()).isEmpty();
            assertThat(count("sager_integration_task", "state='FAILED' AND failure_code='recipient_not_found'"))
                    .isEqualTo(1);
            JsonNode failed = read(student, uuid(exit, "id"));
            assertThat(failed.path("messageStatus").asText()).isEqualTo("FAILED");
            assertThat(failed.path("bindings").get(0).path("failureCode").asText())
                    .isEqualTo("recipient_not_found");
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
            Map<String, Object> body = Map.of("version", 0, "comment", COMMENT);
            error(post(supervisor, p, body), 409, "resend_cooldown");
            clock.value = START.plusSeconds(600);
            String csrf = csrf(supervisor);
            String raw = json.writeValueAsString(body);
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
            run();
            assertThat(GATEWAY.sends()).hasSize(2);
            for (int i = 2; i <= 3; i++) {
                clock.value = START.plusSeconds(i * 600);
                response(
                        post(
                                supervisor,
                                p,
                                Map.of(
                                        "version",
                                        read(supervisor, id).path("version").asLong(),
                                        "comment",
                                        COMMENT)),
                        200);
            }
            clock.value = START.plusSeconds(2400);
            JsonNode current = read(supervisor, id);
            error(
                    post(
                            supervisor,
                            p,
                            Map.of("version", current.path("version").asLong(), "comment", COMMENT)),
                    409,
                    "resend_limit");
            assertThat(current.path("remainingResends").asInt()).isZero();
            assertThat(current.path("resendAvailableAt").asText()).isNotBlank();
        }
    }

    @Test
    void changingGuardianOnResendCreatesANewDocumentWithTheSamePlan() throws Exception {
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
                                            "Documento destinado ao outro responsável vinculado")),
                            200);
            assertThat(resent.path("currentDocument").path("revisionNumber").asInt()).isEqualTo(2);
            assertThat(resent.path("guardianId").asText()).isEqualTo(other.toString());
            assertThat(resent.path("requestedDepartureAt").asText())
                    .isEqualTo(first.path("requestedDepartureAt").asText());
            assertThat(resent.path("expectedReturnAt").asText())
                    .isEqualTo(first.path("expectedReturnAt").asText());
            assertThat(count("sager_signature_binding", "status='INVALIDATED'")).isEqualTo(1);
            run();
            assertThat(json.readTree(GATEWAY.sends().getLast().body()).path("chatId").asText())
                    .isEqualTo("5562999991111@c.us");
        }
    }

    @Test
    void guardianDeactivatedBeforeProcessingIsNeverSentTheDocument() throws Exception {
        try (HttpClient student = login("residente")) {
            create(student, 4 * 3600);
            jdbc.update(
                    "UPDATE sager_guardian SET active=false,version=version+1 WHERE id=?",
                    guardian);
            run();
            assertThat(GATEWAY.sends()).isEmpty();
            assertThat(count("sager_integration_task", "state='CANCELLED'")).isEqualTo(1);
        }
    }

    @Test
    void auditShowsTheAuthorizationActsWithoutTheirContent() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient manager = login("gestor");
                HttpClient supervisor = login("supervisor")) {
            UUID id = candidate(student);
            JsonNode exit = read(supervisor, id);
            String file = exit.path("authorizationFiles").get(0).path("id").asText();
            response(confirm(supervisor, id, file, exit.path("version").asLong(), COMMENT), 200);
            JsonNode page =
                    response(
                            get(
                                    manager,
                                    "/api/v1/auditoria?resource=AUTHORIZATION_FILE&resourceId=" + file),
                            200);
            assertThat(page.path("items").size()).isEqualTo(2);
            assertThat(page.toString())
                    .contains("fileHash", "decisionReason")
                    .doesNotContain(COMMENT, "+5562999990000");
            assertThat(page.path("items").get(0).path("origin").asText()).isEqualTo("LOCAL_API");
        }
    }

    @Test
    void oldRoutesAreGone() throws Exception {
        try (HttpClient anonymous = HttpClient.newHttpClient();
                HttpClient supervisor = login("supervisor")) {
            for (String p :
                    List.of(
                            "/api/v1/webhooks/clicksign",
                            "/api/v1/webhooks/whatsapp",
                            "/api/v1/assinaturas/acesso")) {
                HttpResponse<String> response =
                        anonymous.send(
                                HttpRequest.newBuilder(uri(p))
                                        .POST(HttpRequest.BodyPublishers.ofString("{}"))
                                        .build(),
                                HttpResponse.BodyHandlers.ofString());
                assertThat(response.statusCode()).as(p).isIn(401, 403);
                assertThat(get(anonymous, p).statusCode()).as(p).isEqualTo(401);
                assertThat(get(supervisor, p).statusCode()).as(p).isIn(403, 404);
            }
            error(
                    post(
                            supervisor,
                            "/api/v1/saidas-longas/" + UUID.randomUUID() + "/reconciliacao",
                            Map.of("version", 0)),
                    404,
                    "not_found");
        }
    }

    private JsonNode attach(HttpClient supervisor, UUID id, long version) throws Exception {
        String boundary = "sager-sintetico";
        byte[] head =
                ("--" + boundary + "\r\nContent-Disposition: form-data; name=\"version\"\r\n\r\n"
                                + version + "\r\n--" + boundary
                                + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.jpg\"\r\n\r\n")
                        .getBytes(StandardCharsets.US_ASCII);
        byte[] tail = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.US_ASCII);
        byte[] body = new byte[head.length + JPEG.length + tail.length];
        System.arraycopy(head, 0, body, 0, head.length);
        System.arraycopy(JPEG, 0, body, head.length, JPEG.length);
        System.arraycopy(tail, 0, body, head.length + JPEG.length, tail.length);
        return response(
                supervisor.send(
                        HttpRequest.newBuilder(uri(path(id, "autorizacao/arquivos")))
                                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                                .header("X-CSRF-TOKEN", csrf(supervisor))
                                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                                .build(),
                        HttpResponse.BodyHandlers.ofString()),
                200);
    }

    private JsonNode edit(HttpClient student, UUID id, JsonNode exit) throws Exception {
        Map<String, Object> edit = plan(5 * 3600);
        edit.put("version", exit.path("version").asLong());
        return response(put(student, "/api/v1/saidas-longas/" + id, edit), 200);
    }

    private UUID candidate(HttpClient student) throws Exception {
        UUID id = uuid(create(student, 4 * 3600), "id");
        run();
        clock.value = START.plusSeconds(60);
        arrive("IN1", GUARDIAN_CHAT, JPEG, null);
        return id;
    }

    private void arrive(String id, String chat, byte[] bytes, String quoted) throws Exception {
        String file = "/api/files/default/" + id + ".jpg";
        GATEWAY.files.put(file, bytes);
        post(incoming(id, chat, GATEWAY.root() + file, quoted));
        run();
    }

    private void post(Map<String, Object> message) throws Exception {
        byte[] body = envelope("message", message);
        assertThat(webhook(body, signature(body)).statusCode()).isEqualTo(202);
    }

    private void ack(String id, int ack) throws Exception {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", "true_" + GUARDIAN_CHAT + "_" + id);
        payload.put("from", GUARDIAN_CHAT);
        payload.put("fromMe", true);
        payload.put("ack", ack);
        byte[] body = envelope("message.ack", payload);
        assertThat(webhook(body, signature(body)).statusCode()).isEqualTo(202);
    }

    private void session(String status) throws Exception {
        byte[] body = envelope("session.status", Map.of("name", "default", "status", status));
        assertThat(webhook(body, signature(body)).statusCode()).isEqualTo(202);
    }

    private Map<String, Object> incoming(String id, String from, String mediaUrl, String quoted) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", "false_" + from + "_" + id);
        payload.put("timestamp", clock.value.getEpochSecond());
        payload.put("from", from);
        payload.put("fromMe", false);
        payload.put("body", "");
        payload.put("hasMedia", mediaUrl != null);
        if (mediaUrl != null)
            payload.put("media", Map.of("url", mediaUrl, "mimetype", "image/jpeg"));
        if (quoted != null) payload.put("replyTo", Map.of("id", quoted));
        return payload;
    }

    private byte[] envelope(String event, Map<String, ?> payload) {
        return json.writeValueAsBytes(
                Map.of(
                        "id",
                        "evt_" + UUID.randomUUID(),
                        "timestamp",
                        clock.value.toEpochMilli(),
                        "event",
                        event,
                        "session",
                        "default",
                        "engine",
                        "GOWS",
                        "payload",
                        payload));
    }

    private String signature(byte[] body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA512");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
        return HexFormat.of().formatHex(mac.doFinal(body));
    }

    private HttpResponse<String> webhook(byte[] body, String signature) throws Exception {
        HttpRequest.Builder request =
                HttpRequest.newBuilder(uri("/api/v1/integracoes/whatsapp/webhook"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofByteArray(body));
        if (signature != null) request.header("X-Webhook-Hmac", signature);
        try (HttpClient anonymous = HttpClient.newHttpClient()) {
            return anonymous.send(request.build(), HttpResponse.BodyHandlers.ofString());
        }
    }

    private HttpResponse<String> confirm(
            HttpClient c, UUID id, String file, long version, String justification) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("version", version);
        body.put("confirmed", true);
        if (justification != null) body.put("justification", justification);
        return post(c, path(id, "autorizacao/arquivos/" + file + "/conferencia"), body);
    }

    private String failure(String message) {
        return jdbc.queryForObject(
                "SELECT media_failure_code FROM sager_whatsapp_message WHERE provider_message_id=?",
                String.class,
                message);
    }

    private UUID resident(String enrollment, String login) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO sager_resident(id,name,enrollment,birth_date) VALUES (?,?,?,?)",
                id,
                "Residente sintético " + enrollment,
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

    private void account(String name) {
        String profile = "irmao".equals(name) ? "residente" : name;
        provisioning.create(
                TestIdentity.enrollment(name + "@example.invalid"),
                name + "@example.invalid",
                "Pessoa sintética",
                profile,
                "Senha sintética 123!".toCharArray());
    }

    private void run() {
        worker.runOnce();
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
                        + URLEncoder.encode(
                                TestIdentity.enrollment(profile + "@example.invalid"),
                                StandardCharsets.UTF_8)
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
        assertThat(r.statusCode()).describedAs(r.body()).isEqualTo(status);
        return json.readTree(r.body());
    }

    private void error(HttpResponse<String> r, int s, String code) throws Exception {
        assertThat(response(r, s).path("code").asText()).isEqualTo(code);
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

    record Call(String method, String path, String query, String apiKey, byte[] body) {}

    /** Plays the gateway over real HTTP, following the shapes of the pinned image. */
    static class GatewayDouble {
        final ObjectMapper mapper = new ObjectMapper();
        final List<Call> calls = new CopyOnWriteArrayList<>();
        final Map<String, byte[]> files = new ConcurrentHashMap<>();
        final Map<String, String> lids = new ConcurrentHashMap<>();
        final Map<String, List<?>> history = new ConcurrentHashMap<>();
        final AtomicInteger sequence = new AtomicInteger();
        volatile int sendStatus = 200;
        volatile int checkStatus = 200;
        volatile int fileStatus = 200;
        volatile boolean numberExists = true;
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
                        boolean probe =
                                path.endsWith("/check-exists")
                                        || path.contains("/lids/")
                                        || path.startsWith("/api/sessions/");
                        if (!probe)
                            calls.add(
                                    new Call(
                                            exchange.getRequestMethod(),
                                            path,
                                            query,
                                            exchange.getRequestHeaders().getFirst("X-Api-Key"),
                                            body));
                        int code = 200;
                        Object result = Map.of();
                        byte[] raw = null;
                        if (path.equals("/api/sendFile")) {
                            code = sendStatus;
                            String chat = mapper.readTree(body).path("chatId").asString();
                            result =
                                    Map.of(
                                            "id",
                                            "true_" + chat + "_MSG" + sequence.incrementAndGet(),
                                            "_data",
                                            Map.of());
                        } else if (path.equals("/api/contacts/check-exists")) {
                            code = checkStatus;
                            String phone = query.replaceAll(".*phone=([0-9]+).*", "$1");
                            result =
                                    numberExists
                                            ? Map.of(
                                                    "numberExists", true, "chatId", phone + "@c.us")
                                            : Map.of("numberExists", false);
                        } else if (path.startsWith("/api/sessions/")) {
                            result = Map.of("name", "default", "status", "WORKING");
                        } else if (path.contains("/lids/")) {
                            String pn = lids.get(path.substring(path.lastIndexOf('/') + 1));
                            Map<String, Object> value = new LinkedHashMap<>();
                            value.put("pn", pn);
                            result = value;
                        } else if (path.endsWith("/messages")) {
                            String chat = path.split("/")[4];
                            result = history.getOrDefault(chat, List.of());
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

        List<Call> sends() {
            return new ArrayList<>(
                    calls.stream().filter(c -> c.path().equals("/api/sendFile")).toList());
        }

        void clear() {
            calls.clear();
            files.clear();
            lids.clear();
            history.clear();
            sequence.set(0);
            sendStatus = 200;
            checkStatus = 200;
            fileStatus = 200;
            numberExists = true;
        }
    }
}
