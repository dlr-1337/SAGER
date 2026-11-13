package br.edu.ifgoiano.sager.operations.longexits;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;
import br.edu.ifgoiano.sager.auth.LocalAccountPrincipal;

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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.postgresql.PostgreSQLContainer;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "sager.operations.expiry.enabled=false",
            "sager.integrations.worker.enabled=false"
        })
@ActiveProfiles("local")
@Import(LongExitApiIntegrationTest.TimeConfiguration.class)
class LongExitApiIntegrationTest {
    static final Instant START = Instant.parse("2026-10-01T01:00:00Z");
    static final String ROOT = "/api/v1/saidas-longas";
    static final String PASSWORD = "Senha sintética 123!";
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add(
                "sager.documents.private-root",
                () ->
                        System.getProperty("java.io.tmpdir")
                                + "/sager-long-api-"
                                + POSTGRES.getContainerId());
    }

    @Autowired LocalAccountProvisioningService provisioning;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired MutableClock clock;
    @Autowired LongExitExpiryService expiry;
    @Autowired LongExitService service;
    @Autowired PlatformTransactionManager transactionManager;
    @LocalServerPort int port;
    UUID resident;
    UUID guardian;
    UUID room;

    @BeforeEach
    void fixtures() {
        clock.value = START;
        for (String table :
                List.of(
                        "sager_night_call_mark_history",
                        "sager_night_call_mark",
                        "sager_night_call",
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
                        "sager_accommodation_unit",
                        "sager_accommodation",
                        "sager_resident")) {
            if (Boolean.TRUE.equals(
                    jdbc.queryForObject("SELECT to_regclass(?) IS NOT NULL", Boolean.class, table)))
                jdbc.update("DELETE FROM " + table);
        }
        jdbc.update("DELETE FROM spring_session");
        UUID accommodation = UUID.randomUUID();
        room = UUID.randomUUID();
        resident = UUID.randomUUID();
        guardian = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO sager_accommodation(id,code,name) VALUES (?,'F4','Alojamento"
                        + " sintético')",
                accommodation);
        jdbc.update(
                "INSERT INTO sager_room(id,code,number,accommodation_id,capacity,situation) VALUES"
                        + " (?,'F4-1','1',?,20,'Disponível')",
                room,
                accommodation);
        jdbc.update(
                "INSERT INTO sager_resident(id,name,enrollment,birth_date) VALUES (?,'Estudante"
                        + " sintético','F4-A',?)",
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
        for (String profile : List.of("residente", "supervisor", "gestor"))
            provisioning.create(
                    br.edu.ifgoiano.sager.TestIdentity.enrollment(profile + "@example.invalid"), profile + "@example.invalid",
                    "Pessoa sintética",
                    profile,
                    PASSWORD.toCharArray());
        provisioning.linkResident("residente@example.invalid", resident);
    }

    @Test
    void legacyListsBindNameAndEnrollmentSearch() throws Exception {
        UUID exitId;
        try (HttpClient student = login("residente")) {
            exitId = UUID.fromString(created(post(student, ROOT, plan(4 * 3600))).path("id").asText());
        }
        UUID actorId = jdbc.queryForObject("SELECT id FROM sager_local_account WHERE email=?",
                UUID.class, "supervisor@example.invalid");
        var principal = new LocalAccountPrincipal(actorId, "supervisor@example.invalid",
                "Supervisor Sintético", "supervisor", null, null, "TESTE-SUPERVISOR");
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, List.of()));
        try {
            for (String query : new String[] {"  ESTUDANTE sintetico  ", "  f4-a  ", null, "   "}) {
                assertThat(service.list(null, query, null)).extracting(LongExit::id)
                        .containsExactly(exitId);
                assertThat(service.list(resident, query, "AGUARDANDO_ANALISE"))
                        .extracting(LongExit::id).containsExactly(exitId);
            }
            assertThat(service.list(null, "Sem correspondência", null)).isEmpty();
            assertThat(service.list(null, "%", null)).isEmpty();
            assertThat(service.list(UUID.randomUUID(), "sintetico", null)).isEmpty();
            assertThat(service.list(resident, "F4-A", "CANCELADA")).isEmpty();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void listFiltersByRoomAndAccommodationAllocatedAtRequestedDeparture() throws Exception {
        String exitId;
        try (HttpClient student = login("residente")) {
            exitId = created(post(student, ROOT, plan(4 * 3600))).path("id").asText();
        }
        UUID accommodation =
                jdbc.queryForObject("SELECT accommodation_id FROM sager_room WHERE id=?", UUID.class, room);
        UUID laterAccommodation = UUID.randomUUID();
        UUID laterRoom = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO sager_accommodation(id,code,name) VALUES (?,'F4-B','Alojamento B')",
                laterAccommodation);
        jdbc.update(
                "INSERT INTO sager_room(id,code,number,accommodation_id,capacity,situation) VALUES"
                        + " (?,'F4-B-1','1',?,20,'Disponível')",
                laterRoom,
                laterAccommodation);
        OffsetDateTime moved = OffsetDateTime.ofInstant(START.plusSeconds(3600), ZoneOffset.UTC);
        jdbc.update(
                "UPDATE sager_room_allocation SET ended_at=?,end_reason='END' WHERE resident_id=?",
                moved,
                resident);
        jdbc.update(
                "INSERT INTO sager_room_allocation(id,resident_id,room_id,started_at) VALUES (?,?,?,?)",
                UUID.randomUUID(),
                resident,
                laterRoom,
                moved);
        UUID unit = UUID.randomUUID();
        UUID laterUnit = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO sager_accommodation_unit(id,accommodation_id,code,name) VALUES"
                        + " (?,?,'BL-A','Bloco A')",
                unit,
                accommodation);
        jdbc.update(
                "INSERT INTO sager_accommodation_unit(id,accommodation_id,code,name) VALUES"
                        + " (?,?,'BL-A','Bloco A')",
                laterUnit,
                laterAccommodation);
        jdbc.update("UPDATE sager_room SET unit_id=? WHERE id=?", unit, room);
        jdbc.update("UPDATE sager_room SET unit_id=? WHERE id=?", laterUnit, laterRoom);
        try (HttpClient supervisor = login("supervisor")) {
            assertThat(read(supervisor, ROOT + "?roomId=" + room).get(0).path("id").asText())
                    .isEqualTo(exitId);
            assertThat(read(supervisor, ROOT + "?roomId=" + laterRoom).size()).isZero();
            assertThat(read(supervisor, ROOT + "?accommodationId=" + accommodation).size()).isEqualTo(1);
            assertThat(read(supervisor, ROOT + "?accommodationId=" + laterAccommodation).size())
                    .isZero();
            assertThat(read(supervisor, ROOT + "?unitId=" + unit).get(0).path("id").asText())
                    .isEqualTo(exitId);
            assertThat(read(supervisor, ROOT + "?unitId=" + laterUnit).size()).isZero();
        }
        try (HttpClient student = login("residente")) {
            assertThat(read(student, ROOT + "?roomId=" + room).size()).isEqualTo(1);
            assertThat(read(student, ROOT + "?roomId=" + laterRoom).size()).isZero();
        }
    }

    @Test
    void createsPrivateRevisionWithDisabledProvidersAndNoFabricatedSignature() throws Exception {
        try (HttpClient student = login("residente")) {
            JsonNode exit = created(post(student, ROOT, plan(4 * 3600)));
            assertThat(exit.path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
            assertThat(exit.path("signatureStatus").asText()).isEqualTo("UNAVAILABLE");
            assertThat(exit.path("messageStatus").asText()).isEqualTo("UNAVAILABLE");
            assertThat(exit.path("requestedDepartureAt").asText()).isEqualTo(START.toString());
            assertThat(exit.path("whatsappAvailable").asBoolean()).isFalse();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_integration_task", Integer.class))
                    .isZero();
            assertThat(exit.path("currentDocument").path("revisionNumber").asInt()).isEqualTo(1);
            assertThat(exit.path("currentDocument").path("originalState").asText())
                    .isEqualTo("STORED");
            assertThat(exit.path("capabilities").path("canEdit").asBoolean()).isTrue();
            assertThat(exit.toString())
                    .doesNotContain("tokenHash", "private-root", "accessToken", ".pdf");
            assertThat(read(student, ROOT).size()).isEqualTo(1);
        }
    }

    @Test
    void requiresMoreThanThreeHoursOwnIdentityAndActiveBrazilianGuardian() throws Exception {
        try (HttpClient student = login("residente")) {
            error(post(student, ROOT, plan(3 * 3600)), 400, "invalid_input");
            Map<String, Object> identity = plan(4 * 3600);
            identity.put("residentId", resident);
            error(post(student, ROOT, identity), 400, "invalid_input");
            Map<String, Object> nowTime = plan(4 * 3600);
            nowTime.put("requestedDepartureAt", START.toString());
            error(post(student, ROOT, nowTime), 400, "invalid_input");
            jdbc.update("UPDATE sager_guardian SET phone='+14155550000' WHERE id=?", guardian);
            error(post(student, ROOT, plan(4 * 3600)), 409, "guardian_not_eligible");
            jdbc.update(
                    "UPDATE sager_guardian SET phone='+5562999990000',active=false WHERE id=?",
                    guardian);
            error(post(student, ROOT, plan(4 * 3600)), 409, "guardian_not_eligible");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_long_exit", Integer.class))
                    .isZero();
        }
    }

    @Test
    void refusesAdultOnTheEighteenthBirthdayAndAcceptsTheEveInSaoPaulo() throws Exception {
        // START é 22h de 30/09/2026 em Brasília e já 01/10 em UTC.
        jdbc.update("UPDATE sager_resident SET birth_date=DATE '2008-09-30' WHERE id=?", resident);
        try (HttpClient student = login("residente")) {
            JsonNode adult = read(student, ROOT + "/elegibilidade");
            assertThat(adult.path("eligible").asBoolean()).isFalse();
            assertThat(adult.path("blockers").toString()).contains("not_minor");
            error(post(student, ROOT, plan(4 * 3600)), 409, "not_eligible");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_long_exit", Integer.class))
                    .isZero();
            jdbc.update("UPDATE sager_resident SET birth_date=DATE '2008-10-01' WHERE id=?", resident);
            assertThat(read(student, ROOT + "/elegibilidade").path("eligible").asBoolean()).isTrue();
        }
    }

    @Test
    void scheduledDepartureAtNowHasNoSignatureWindowAndReturnsValidationError() throws Exception {
        try (HttpClient student = login("residente")) {
            Map<String, Object> input = plan(4 * 3600);
            input.put("departureMode", "SCHEDULED");
            input.put("requestedDepartureAt", START.toString());
            error(post(student, ROOT, input), 400, "invalid_input");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_long_exit", Integer.class))
                    .isZero();
        }
    }

    @Test
    void onlySupervisorDecidesAndCanRejectBeforeSignature() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor");
                HttpClient manager = login("gestor")) {
            JsonNode exit = created(post(student, ROOT, plan(4 * 3600)));
            String path = ROOT + "/" + exit.path("id").asText() + "/decisao";
            Map<String, Object> approval =
                    Map.of(
                            "version",
                            0,
                            "documentVersionId",
                            exit.path("currentDocument").path("documentVersionId").asText(),
                            "decision",
                            "APPROVE");
            error(post(supervisor, path, approval), 409, "signature_required");
            error(post(manager, path, approval), 403, "forbidden");
            error(post(student, path, approval), 403, "forbidden");
            JsonNode rejected =
                    readResponse(
                            post(
                                    supervisor,
                                    path,
                                    Map.of(
                                            "version",
                                            0,
                                            "decision",
                                            "REJECT",
                                            "comment",
                                            "Rejeição antes da assinatura")),
                            200);
            assertThat(rejected.path("status").asText()).isEqualTo("REJEITADA");
            assertThat(rejected.path("history").size()).isEqualTo(2);
            assertThat(rejected.path("capabilities").path("canResend").asBoolean()).isFalse();
        }
    }

    @Test
    void editPreservesOldDocumentAndInvalidatesOldBindingAtomically() throws Exception {
        try (HttpClient student = login("residente")) {
            JsonNode first = created(post(student, ROOT, plan(4 * 3600)));
            String id = first.path("id").asText();
            Map<String, Object> edit = plan(5 * 3600);
            edit.put("version", 0);
            JsonNode second = readResponse(put(student, ROOT + "/" + id, edit), 200);
            assertThat(second.path("version").asLong()).isEqualTo(1);
            assertThat(second.path("currentDocument").path("revisionNumber").asInt()).isEqualTo(2);
            assertThat(second.path("currentDocument").path("documentVersionId").asText())
                    .isNotEqualTo(first.path("currentDocument").path("documentVersionId").asText());
            error(put(student, ROOT + "/" + id, edit), 409, "stale_version");
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT COUNT(*) FROM sager_document_version", Integer.class))
                    .isEqualTo(2);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT COUNT(*) FROM sager_signature_binding WHERE"
                                            + " status='INVALIDATED'",
                                    Integer.class))
                    .isEqualTo(1);
        }
    }

    @Test
    void longAndShortIntervalsUseTheSameResidentLockAndConflictRule() throws Exception {
        try (HttpClient student = login("residente")) {
            created(post(student, ROOT, plan(4 * 3600)));
            Map<String, Object> shortBody = new LinkedHashMap<>(plan(3600));
            shortBody.remove("guardianId");
            error(post(student, "/api/v1/saidas-curtas", shortBody), 409, "overlapping_exit");
        }
    }

    @Test
    void downloadsRequireOwnershipAndDoNotExposePrivateFiles() throws Exception {
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor");
                HttpClient manager = login("gestor")) {
            JsonNode exit = created(post(student, ROOT, plan(4 * 3600)));
            String path =
                    ROOT
                            + "/"
                            + exit.path("id").asText()
                            + "/documentos/"
                            + exit.path("currentDocument").path("documentVersionId").asText()
                            + "/original";
            HttpResponse<byte[]> response =
                    student.send(
                            HttpRequest.newBuilder(uri(path)).GET().build(),
                            HttpResponse.BodyHandlers.ofByteArray());
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(new String(response.body(), StandardCharsets.ISO_8859_1))
                    .startsWith("%PDF-");
            assertThat(response.headers().firstValue("Cache-Control").orElseThrow())
                    .contains("no-store");
            assertThat(response.headers().firstValue("X-Content-Type-Options").orElseThrow())
                    .isEqualTo("nosniff");
            assertThat(get(manager, path).statusCode()).isEqualTo(403);
            assertThat(get(supervisor, path).statusCode()).isEqualTo(200);
            assertThat(get(HttpClient.newHttpClient(), "/api/v1/assinaturas/acesso").statusCode())
                    .isEqualTo(401);
        }
    }

    @Test
    void manualAttachmentWorksWithTheGatewayOffAndPassesTheSameConference() throws Exception {
        byte[] photo = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 1, 2, 3, 4};
        try (HttpClient student = login("residente");
                HttpClient manager = login("gestor");
                HttpClient supervisor = login("supervisor")) {
            JsonNode exit = created(post(student, ROOT, plan(4 * 3600)));
            String id = exit.path("id").asText();
            long version = exit.path("version").asLong();
            assertThat(attach(manager, id, version, photo).statusCode()).isEqualTo(403);
            assertThat(attach(student, id, version, photo).statusCode()).isEqualTo(403);
            error(
                    attach(supervisor, id, version, "MZ-executavel".getBytes(StandardCharsets.US_ASCII)),
                    400,
                    "invalid_input");
            HttpResponse<String> large = attach(supervisor, id, version, new byte[10 * 1024 * 1024 + 1]);
            error(large, 413, "file_too_large");
            HttpResponse<String> attached = attach(supervisor, id, version, photo);
            assertThat(attached.statusCode()).describedAs(attached.body()).isEqualTo(200);
            JsonNode body = json.readTree(attached.body());
            JsonNode file = body.path("authorizationFiles").get(0);
            assertThat(file.path("origin").asText()).isEqualTo("MANUAL");
            assertThat(file.path("state").asText()).isEqualTo("CANDIDATE");
            assertThat(file.path("senderDivergent").asBoolean()).isFalse();
            assertThat(file.path("senderPhone").isNull()).isTrue();
            assertThat(body.path("capabilities").path("canApprove").asBoolean()).isFalse();
            JsonNode confirmed =
                    json.readTree(
                            post(
                                            supervisor,
                                            ROOT + "/" + id + "/autorizacao/arquivos/"
                                                    + file.path("id").asText() + "/conferencia",
                                            Map.of(
                                                    "version",
                                                    body.path("version").asLong(),
                                                    "confirmed",
                                                    true))
                                    .body());
            assertThat(confirmed.path("signatureStatus").asText()).isEqualTo("VALID");
            assertThat(confirmed.path("capabilities").path("canApprove").asBoolean()).isTrue();
            assertThat(confirmed.path("bindings").get(0).path("verifiedBy").asText()).isNotBlank();
            assertThat(
                            post(
                                            supervisor,
                                            ROOT + "/" + id + "/decisao",
                                            Map.of(
                                                    "version",
                                                    confirmed.path("version").asLong(),
                                                    "decision",
                                                    "APPROVE",
                                                    "documentVersionId",
                                                    confirmed
                                                            .path("currentDocument")
                                                            .path("documentVersionId")
                                                            .asText()))
                                    .statusCode())
                    .isEqualTo(200);
        }
    }

    @Test
    void residentOutOnLongExitIsJustifiedBySystemWhenTheNightCallOpens() throws Exception {
        clock.value = START.minusSeconds(3600);
        byte[] photo = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 1, 2, 3, 4};
        try (HttpClient student = login("residente");
                HttpClient supervisor = login("supervisor")) {
            JsonNode exit = created(post(student, ROOT, plan(4 * 3600)));
            String id = exit.path("id").asText();
            JsonNode attached =
                    readResponse(attach(supervisor, id, exit.path("version").asLong(), photo), 200);
            JsonNode confirmed =
                    readResponse(
                            post(
                                    supervisor,
                                    ROOT + "/" + id + "/autorizacao/arquivos/"
                                            + attached.path("authorizationFiles").get(0).path("id").asText()
                                            + "/conferencia",
                                    Map.of(
                                            "version",
                                            attached.path("version").asLong(),
                                            "confirmed",
                                            true)),
                            200);
            JsonNode approved =
                    readResponse(
                            post(
                                    supervisor,
                                    ROOT + "/" + id + "/decisao",
                                    Map.of(
                                            "version",
                                            confirmed.path("version").asLong(),
                                            "decision",
                                            "APPROVE",
                                            "documentVersionId",
                                            confirmed
                                                    .path("currentDocument")
                                                    .path("documentVersionId")
                                                    .asText())),
                            200);
            readResponse(
                    post(
                            supervisor,
                            ROOT + "/" + id + "/partida",
                            Map.of("version", approved.path("version").asLong(), "timeMode", "NOW")),
                    200);
            clock.value = START;
            JsonNode mark =
                    created(
                                    post(
                                            supervisor,
                                            "/api/v1/chamadas",
                                            Map.of(
                                                    "accommodationId",
                                                    jdbc.queryForObject(
                                                            "SELECT id FROM sager_accommodation",
                                                            UUID.class))))
                            .path("records")
                            .get(0);
            assertThat(mark.path("mark").asText()).isEqualTo("AUSENCIA_JUSTIFICADA");
            assertThat(mark.path("authorizedExitId").asText()).isEqualTo(id);
            assertThat(mark.path("authorizedExitType").asText()).isEqualTo("LONG");
            assertThat(mark.path("history").get(0).path("actorProfile").asText()).isEqualTo("sistema");
        }
    }

    @Test
    void unsupportedDocumentCharactersReturnValidationErrorWithoutPartialDatabaseRows()
            throws Exception {
        try (HttpClient student = login("residente")) {
            Map<String, Object> input = plan(4 * 3600);
            input.put("reason", "Visita familiar \uD83D\uDE00");
            error(post(student, ROOT, input), 400, "invalid_input");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_long_exit", Integer.class))
                    .isZero();
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT COUNT(*) FROM sager_document_version", Integer.class))
                    .isZero();
        }
    }

    @Test
    void expiryBatchRollsBackWithAuditAndPreservesOneSystemCorrelation() throws Exception {
        UUID second = UUID.randomUUID(), document = UUID.randomUUID();
        try (HttpClient student = login("residente")) {
            JsonNode first = created(post(student, ROOT, plan(4 * 3600)));
            UUID id = UUID.fromString(first.path("id").asText());
            new TransactionTemplate(transactionManager)
                    .executeWithoutResult(
                            status -> {
                                jdbc.update(
                                        """
INSERT INTO sager_long_exit(id,resident_id,resident_name,enrollment,guardian_id,guardian_name,
    guardian_relationship,departure_mode,requested_departure_at,expected_return_at,reason,
    current_document_version_id,created_at,updated_at)
SELECT ?,resident_id,resident_name,enrollment,guardian_id,guardian_name,guardian_relationship,
    departure_mode,requested_departure_at,expected_return_at,reason,?,created_at,updated_at
FROM sager_long_exit WHERE id=?
""",
                                        second,
                                        document,
                                        id);
                                jdbc.update(
                                        """
INSERT INTO sager_document_version(id,exit_id,revision_number,template_version,snapshot,
    original_file_id,original_hash,original_size,original_state,created_at)
SELECT ?,?,1,template_version,snapshot,?,original_hash,original_size,original_state,created_at
FROM sager_document_version WHERE exit_id=?
""",
                                        document,
                                        second,
                                        UUID.randomUUID(),
                                        id);
                            });
            clock.value = START.plusSeconds(4 * 3600);
            jdbc.execute(
                    "CREATE FUNCTION reject_long_expiry_test() RETURNS trigger LANGUAGE plpgsql AS"
                        + " $$ BEGIN IF NEW.resource='LONG_EXIT' AND NEW.origin='SYSTEM_JOB' AND"
                        + " NEW.resource_id='"
                            + second
                            + "'::uuid THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN"
                            + " NEW; END; $$");
            jdbc.execute(
                    "CREATE TRIGGER reject_long_expiry_test BEFORE INSERT ON sager_audit_event FOR"
                            + " EACH ROW EXECUTE FUNCTION reject_long_expiry_test()");
            try {
                assertThatThrownBy(expiry::expireDue).isInstanceOf(RuntimeException.class);
            } finally {
                jdbc.execute("DROP TRIGGER reject_long_expiry_test ON sager_audit_event");
                jdbc.execute("DROP FUNCTION reject_long_expiry_test()");
            }
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT COUNT(*) FROM sager_long_exit WHERE"
                                            + " status='AGUARDANDO_ANALISE'",
                                    Integer.class))
                    .isEqualTo(2);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT COUNT(*) FROM sager_long_exit_history WHERE"
                                            + " event='EXPIRE'",
                                    Integer.class))
                    .isZero();
            assertThat(expiry.expireDue()).isEqualTo(2);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT COUNT(DISTINCT request_id) FROM sager_audit_event WHERE"
                                            + " resource='LONG_EXIT' AND resource_id IN (?,?) AND"
                                            + " origin='SYSTEM_JOB'",
                                    Integer.class,
                                    id,
                                    second))
                    .isEqualTo(1);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT COUNT(*) FROM sager_audit_event WHERE"
                                            + " resource='LONG_EXIT' AND resource_id IN (?,?) AND"
                                            + " origin='SYSTEM_JOB' AND actor_id IS NULL AND"
                                            + " actor_profile IS NULL",
                                    Integer.class,
                                    id,
                                    second))
                    .isEqualTo(2);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT status FROM sager_signature_binding WHERE exit_id=?",
                                    String.class,
                                    id))
                    .isEqualTo("INVALIDATED");
        }
    }

    @Test
    void databaseRejectsMutableSnapshotsAndSignatureAtExclusiveDeadline() throws Exception {
        try (HttpClient student = login("residente")) {
            created(post(student, ROOT, plan(4 * 3600)));
            assertThatThrownBy(
                            () ->
                                    jdbc.update(
                                            "UPDATE sager_document_version SET"
                                                    + " snapshot='{}'::jsonb"))
                    .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            assertThatThrownBy(
                            () ->
                                    jdbc.update(
                                            "UPDATE sager_signature_binding SET"
                                                + " status='VALID',stage='DONE',verified_by=gen_random_uuid(),signed_at=expires_at,verified_at=expires_at,evidence_hash=repeat('a',64)"))
                    .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            assertThatThrownBy(
                            () ->
                                    jdbc.update(
                                            "UPDATE sager_signature_binding SET status='VALID',stage='DONE',"
                                                    + "signed_at=created_at,verified_at=created_at,"
                                                    + "evidence_hash=repeat('a',64)"))
                    .as("sem verified_by não há autorização conferida")
                    .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT status FROM sager_signature_binding", String.class))
                    .isEqualTo("UNAVAILABLE");
        }
    }

    @Test
    void anotherResidentCannotReadModifyOrDownloadTheOwnersRequest() throws Exception {
        UUID other = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO sager_resident(id,name,enrollment,birth_date) VALUES (?,'Outra pessoa"
                        + " sintética','F4-B',?)",
                other,
                LocalDate.of(2009, 2, 2));
        provisioning.create(
                br.edu.ifgoiano.sager.TestIdentity.enrollment("outra@example.invalid"), "outra@example.invalid",
                "Outra pessoa sintética",
                "residente",
                PASSWORD.toCharArray());
        provisioning.linkResident("outra@example.invalid", other);
        try (HttpClient owner = login("residente");
                HttpClient outsider = login("outra")) {
            JsonNode exit = created(post(owner, ROOT, plan(4 * 3600)));
            String id = exit.path("id").asText();
            assertThat(read(outsider, ROOT)).isEmpty();
            error(get(outsider, ROOT + "/" + id), 404, "not_found");
            error(get(outsider, ROOT + "?residentId=" + resident), 404, "not_found");
            error(
                    get(
                            outsider,
                            ROOT
                                    + "/"
                                    + id
                                    + "/documentos/"
                                    + exit.path("currentDocument")
                                            .path("documentVersionId")
                                            .asText()
                                    + "/original"),
                    404,
                    "not_found");
            Map<String, Object> edit = plan(5 * 3600);
            edit.put("version", 0);
            error(put(outsider, ROOT + "/" + id, edit), 404, "not_found");
        }
    }

    @Test
    void concurrentShortAndLongRequestsShareOneResidentLock() throws Exception {
        try (HttpClient student = login("residente")) {
            String csrf = csrf(student);
            Map<String, Object> shortPlan = plan(3600);
            shortPlan.remove("guardianId");
            HttpRequest one =
                    HttpRequest.newBuilder(uri(ROOT))
                            .header("Content-Type", "application/json")
                            .header("X-CSRF-TOKEN", csrf)
                            .POST(
                                    HttpRequest.BodyPublishers.ofString(
                                            json.writeValueAsString(plan(4 * 3600))))
                            .build();
            HttpRequest two =
                    HttpRequest.newBuilder(uri("/api/v1/saidas-curtas"))
                            .header("Content-Type", "application/json")
                            .header("X-CSRF-TOKEN", csrf)
                            .POST(
                                    HttpRequest.BodyPublishers.ofString(
                                            json.writeValueAsString(shortPlan)))
                            .build();
            var longResult = student.sendAsync(one, HttpResponse.BodyHandlers.ofString());
            var shortResult = student.sendAsync(two, HttpResponse.BodyHandlers.ofString());
            assertThat(List.of(longResult.get().statusCode(), shortResult.get().statusCode()))
                    .containsExactlyInAnyOrder(201, 409);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT (SELECT COUNT(*) FROM sager_long_exit)+(SELECT COUNT(*)"
                                            + " FROM sager_short_exit)",
                                    Integer.class))
                    .isEqualTo(1);
        }
    }

    Map<String, Object> plan(long seconds) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("departureMode", "NOW");
        value.put("expectedReturnAt", clock.instant().plusSeconds(seconds).toString());
        value.put("reason", "Visita familiar sintética");
        value.put("guardianId", guardian.toString());
        return value;
    }

    HttpClient login(String profile) throws Exception {
        HttpClient c =
                HttpClient.newBuilder()
                        .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
                        .build();
        String body =
                "matricula="
                        + URLEncoder.encode(br.edu.ifgoiano.sager.TestIdentity.enrollment(profile + "@example.invalid"), StandardCharsets.UTF_8)
                        + "&password="
                        + URLEncoder.encode(PASSWORD, StandardCharsets.UTF_8);
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

    JsonNode created(HttpResponse<String> r) throws Exception {
        return readResponse(r, 201);
    }

    JsonNode read(HttpClient c, String p) throws Exception {
        return readResponse(get(c, p), 200);
    }

    JsonNode readResponse(HttpResponse<String> r, int s) throws Exception {
        assertThat(r.statusCode()).describedAs(r.body()).isEqualTo(s);
        return json.readTree(r.body());
    }

    void error(HttpResponse<String> r, int s, String code) throws Exception {
        assertThat(readResponse(r, s).path("code").asText()).isEqualTo(code);
    }

    String csrf(HttpClient c) throws Exception {
        return read(c, "/api/v1/auth/csrf").path("token").asText();
    }

    URI uri(String p) {
        return URI.create("http://127.0.0.1:" + port + p);
    }

    HttpResponse<String> get(HttpClient c, String p) throws Exception {
        return c.send(
                HttpRequest.newBuilder(uri(p)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    HttpResponse<String> post(HttpClient c, String p, Map<String, ?> b) throws Exception {
        return send(c, p, b, "POST");
    }

    HttpResponse<String> attach(HttpClient c, String id, long version, byte[] file) throws Exception {
        String boundary = "sager-sintetico";
        var body = new java.io.ByteArrayOutputStream();
        body.writeBytes(
                ("--" + boundary + "\r\nContent-Disposition: form-data; name=\"version\"\r\n\r\n" + version
                                + "\r\n--" + boundary
                                + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"anexo.bin\"\r\n"
                                + "Content-Type: application/octet-stream\r\n\r\n")
                        .getBytes(StandardCharsets.US_ASCII));
        body.writeBytes(file);
        body.writeBytes(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.US_ASCII));
        return c.send(
                HttpRequest.newBuilder(uri(ROOT + "/" + id + "/autorizacao/arquivos"))
                        .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                        .header("X-CSRF-TOKEN", csrf(c))
                        .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray()))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
    }

    HttpResponse<String> put(HttpClient c, String p, Map<String, ?> b) throws Exception {
        return send(c, p, b, "PUT");
    }

    HttpResponse<String> send(HttpClient c, String p, Map<String, ?> b, String method)
            throws Exception {
        return c.send(
                HttpRequest.newBuilder(uri(p))
                        .header("Content-Type", "application/json")
                        .header("X-CSRF-TOKEN", csrf(c))
                        .method(
                                method,
                                HttpRequest.BodyPublishers.ofString(json.writeValueAsString(b)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
    }

    @TestConfiguration
    static class TimeConfiguration {
        @Bean
        @Primary
        MutableClock clock() {
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
}
