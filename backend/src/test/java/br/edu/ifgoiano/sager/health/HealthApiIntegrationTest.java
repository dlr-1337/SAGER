package br.edu.ifgoiano.sager.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class HealthApiIntegrationTest {
    private static final String PASSWORD = "Senha sintetica local 123!";
    private static final String REASON = "Verificacao administrativa sintetica";
    private static final String BODY = "Evolucao assistencial inteiramente sintetica.";
    private static final String PREFIX = "/api/v1/saude";
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");

    static { POSTGRES.start(); }

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired private LocalAccountProvisioningService provisioning;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper json;
    @LocalServerPort private int port;

    private final List<HttpClient> browsers = new ArrayList<>();
    private Actor manager;
    private Actor doctor;
    private Actor nurse;
    private Actor psychologist;
    private Actor outsider;
    private Actor patient;
    private UUID resident;

    @BeforeEach
    void syntheticFixtureWithNoAutomaticHealthRelationships() throws Exception {
        manager = actor("gestor");
        doctor = actor("saude");
        nurse = actor("saude");
        psychologist = actor("saude");
        outsider = actor("saude");
        patient = actor("residente");
        resident = resident();
        provisioning.linkResident(patient.email(), resident);
        patient = relogin(patient);
    }

    @AfterEach
    void closeBrowsers() { browsers.forEach(HttpClient::close); }

    @Test
    void administrativeMetadataDoesNotGrantHealthContentOrManagementToHealthRole() throws Exception {
        JsonNode capabilities = ok(get(manager, PREFIX + "/me"), 200);
        assertThat(capabilities.path("canAdministerAccess").asBoolean()).isTrue();
        assertThat(capabilities.path("professionalGrant").isNull()).isTrue();
        assertStatus(get(manager, PREFIX + "/residentes/" + resident + "/notas"), 403);
        assertStatus(get(doctor, "/api/v1/residentes"), 403);
        assertStatus(get(doctor, PREFIX + "/contas"), 403);
        assertStatus(get(doctor, PREFIX + "/habilitacoes"), 403);
        assertStatus(get(patient, PREFIX + "/vinculos?residentId=" + resident), 403);

        JsonNode grant = grant(doctor, "MEDICINA");
        assertThat(grant.path("profession").asText()).isEqualTo("MEDICINA");
        assertThat(grant.path("verifiedBy").asText()).isEqualTo(manager.id().toString());
        assertThat(grant.path("verificationReason").asText()).isEqualTo(REASON);
        assertThat(ok(get(doctor, PREFIX + "/me"), 200).path("professionalGrant").path("id").asText())
                .isEqualTo(grant.path("id").asText());
        assertStatus(get(doctor, PREFIX + "/residentes/" + resident), 404);
        assertThat(ok(get(doctor, PREFIX + "/residentes"), 200).path("totalCount").asLong()).isZero();
        JsonNode assignment = assign(grant, resident);
        assertThat(assignment.path("residentId").asText()).isEqualTo(resident.toString());
        JsonNode directory = ok(get(doctor, PREFIX + "/residentes"), 200);
        assertThat(directory.path("totalCount").asLong()).isEqualTo(1);
        assertThat(directory.path("items").get(0).path("id").asText()).isEqualTo(resident.toString());
        assertStatus(get(doctor, "/api/v1/residentes/" + resident), 403);
        assertStatus(post(manager, PREFIX + "/habilitacoes", grantInput(doctor, "MEDICINA")), 409);
        assertStatus(post(manager, PREFIX + "/vinculos", Map.of("residentId", resident,
                "professionalGrantId", grant.path("id").asText(), "reason", REASON)), 409);
    }

    @Test
    void professionCategoryMatrixIsEnforcedOnAuthoringAndSharing() throws Exception {
        JsonNode medical = grant(doctor, "MEDICINA");
        JsonNode nursing = grant(nurse, "ENFERMAGEM");
        JsonNode psychological = grant(psychologist, "PSICOLOGIA");
        assign(medical, resident); assign(nursing, resident); assign(psychological, resident);
        for (Actor author : List.of(doctor, nurse)) {
            note(author, "GENERAL", BODY);
            note(author, "SHARED_SUMMARY", BODY);
            assertStatus(post(author, notesPath(), Map.of("category", "PSYCHOLOGICAL", "body", BODY)), 403);
        }
        JsonNode privatePsych = note(psychologist, "PSYCHOLOGICAL", BODY);
        note(psychologist, "SHARED_SUMMARY", BODY);
        assertStatus(post(psychologist, notesPath(), Map.of("category", "GENERAL", "body", BODY)), 403);
        JsonNode general = note(doctor, "GENERAL", BODY);
        assertStatus(post(doctor, notePath(general) + "/partilhas",
                Map.of("version", 0, "recipientGrantIds", List.of(psychological.path("id").asText()))), 403);
        assertStatus(post(psychologist, notePath(privatePsych) + "/partilhas",
                Map.of("version", 0, "recipientGrantIds", List.of(medical.path("id").asText()))), 403);
        JsonNode summary = note(psychologist, "SHARED_SUMMARY", BODY);
        share(psychologist, summary, medical, nursing);
        assertStatus(get(doctor, notePath(summary)), 200);
        assertStatus(get(nurse, notePath(summary)), 200);
        assertThat(ok(get(psychologist, PREFIX + "/residentes/" + resident
                + "/profissionais?category=GENERAL"), 200).path("items").size()).isEqualTo(2);
    }

    @Test
    void privateNotesListsCountsHistoryAndIdsDoNotLeakBeforeExplicitSharing() throws Exception {
        JsonNode medical = grant(doctor, "MEDICINA");
        JsonNode nursing = grant(nurse, "ENFERMAGEM");
        assign(medical, resident); assign(nursing, resident);
        JsonNode first = note(doctor, "GENERAL", BODY);
        note(doctor, "SHARED_SUMMARY", "Outra evolucao sintetica.");
        JsonNode hidden = ok(get(nurse, notesPath()), 200);
        assertThat(hidden.path("items").size()).isZero();
        assertThat(hidden.path("totalCount").asLong()).isZero();
        assertStatus(get(nurse, notePath(first)), 404);
        assertStatus(get(nurse, notePath(first) + "/historico"), 404);
        JsonNode emptyCopy = ok(post(nurse, PREFIX + "/residentes/" + resident + "/exportacoes", null), 200);
        assertThat(emptyCopy.path("notes").size()).isZero();
        share(doctor, first, nursing);
        JsonNode visible = ok(get(nurse, notesPath()), 200);
        assertThat(visible.path("totalCount").asLong()).isEqualTo(1);
        assertThat(visible.path("items").get(0).has("body")).isFalse();
        JsonNode detail = ok(get(nurse, notePath(first)), 200);
        assertThat(detail.path("body").asText()).isEqualTo(BODY);
        assertThat(detail.path("canCorrect").asBoolean()).isFalse();
        assertThat(detail.path("canShare").asBoolean()).isFalse();
        assertStatus(post(nurse, notePath(first) + "/correcoes",
                Map.of("version", 0, "body", BODY, "reason", REASON)), 403);
        assertThat(ok(get(nurse, notePath(first) + "/historico"), 200).path("totalCount").asLong())
                .isEqualTo(1);
        assertStatus(get(outsider, notePath(first)), 403);
    }

    @Test
    void shareRevocationTakesEffectInExistingSessionAndRenewalDoesNotRestoreOldShare() throws Exception {
        JsonNode medical = grant(doctor, "MEDICINA");
        JsonNode nursing = grant(nurse, "ENFERMAGEM");
        assign(medical, resident); assign(nursing, resident);
        JsonNode note = note(doctor, "GENERAL", BODY);
        JsonNode shared = share(doctor, note, nursing);
        String shareId = shared.path("shares").get(0).path("id").asText();
        assertStatus(get(nurse, notePath(note)), 200);
        assertStatus(post(doctor, notePath(note) + "/partilhas/" + shareId + "/revogacao",
                Map.of("version", 0)), 200);
        assertStatus(get(nurse, notePath(note)), 404);
        assertThat(ok(get(nurse, notesPath()), 200).path("totalCount").asLong()).isZero();
        share(doctor, note, nursing);
        assertStatus(post(manager, PREFIX + "/habilitacoes/" + nursing.path("id").asText()
                + "/revogacao", Map.of("version", 0, "reason", REASON)), 200);
        assertStatus(get(nurse, notePath(note)), 403);
        JsonNode renewed = grant(nurse, "ENFERMAGEM");
        assertThat(renewed.path("id").asText()).isNotEqualTo(nursing.path("id").asText());
        assign(renewed, resident);
        assertStatus(get(nurse, notePath(note)), 404);
        share(doctor, note, renewed);
        assertStatus(get(nurse, notePath(note)), 200);
    }

    @Test
    void endingCareAssignmentBlocksAuthorAndRenewedRecipientRelationshipDoesNotRestoreShare() throws Exception {
        JsonNode medical = grant(doctor, "MEDICINA");
        JsonNode nursing = grant(nurse, "ENFERMAGEM");
        JsonNode authorAssignment = assign(medical, resident);
        JsonNode recipientAssignment = assign(nursing, resident);
        JsonNode note = note(doctor, "GENERAL", BODY);
        share(doctor, note, nursing);
        assertStatus(post(manager, PREFIX + "/vinculos/" + recipientAssignment.path("id").asText()
                + "/encerramento", Map.of("version", 0, "reason", REASON)), 200);
        assertStatus(get(nurse, notePath(note)), 404);
        JsonNode renewedAssignment = assign(nursing, resident);
        assertStatus(get(nurse, notePath(note)), 404);
        JsonNode newlyShared = share(doctor, note, nursing);
        assertThat(newlyShared.path("shares").size()).isEqualTo(2);
        assertThat(newlyShared.path("shares").valueStream()
                .map(value -> value.path("recipientCareAssignmentId").asText()).toList())
                .containsExactlyInAnyOrder(recipientAssignment.path("id").asText(),
                        renewedAssignment.path("id").asText());
        assertThat(newlyShared.path("shares").valueStream().allMatch(value -> value.path("endedAt").isNull()))
                .isTrue();
        assertStatus(get(nurse, notePath(note)), 200);
        assertStatus(post(doctor, notePath(note) + "/partilhas", Map.of("version", 0,
                "recipientGrantIds", List.of(nursing.path("id").asText()))), 409);
        assertStatus(post(manager, PREFIX + "/vinculos/" + authorAssignment.path("id").asText()
                + "/encerramento", Map.of("version", 0, "reason", REASON)), 200);
        assertStatus(get(doctor, notePath(note)), 404);
        assertStatus(post(doctor, notePath(note) + "/correcoes",
                Map.of("version", 0, "body", BODY, "reason", REASON)), 404);
        assertStatus(get(patient, "/api/v1/minha-saude/notas/" + note.path("id").asText()), 200);
    }

    @Test
    void correctionsAppendHistoryAndPreserveSharedVersionsWithStrictInputTypes() throws Exception {
        JsonNode medical = grant(doctor, "MEDICINA");
        JsonNode nursing = grant(nurse, "ENFERMAGEM");
        assign(medical, resident); assign(nursing, resident);
        JsonNode note = note(doctor, "GENERAL", BODY);
        share(doctor, note, nursing);
        String corrected = "Correcao assistencial sintetica.";
        JsonNode changed = ok(post(doctor, notePath(note) + "/correcoes",
                Map.of("version", 0, "body", "  " + corrected + "  ", "reason", "  " + REASON + "  ")), 200);
        assertThat(changed.path("version").asLong()).isEqualTo(1);
        assertThat(changed.path("body").asText()).isEqualTo(corrected);
        assertThat(changed.path("category").asText()).isEqualTo("GENERAL");
        assertStatus(post(doctor, notePath(note) + "/correcoes",
                Map.of("version", 0, "body", BODY, "reason", REASON)), 409);
        JsonNode history = ok(get(nurse, notePath(note) + "/historico?limit=1"), 200);
        assertThat(history.path("totalCount").asLong()).isEqualTo(2);
        assertThat(history.path("items").get(0).path("body").asText()).isEqualTo(corrected);
        assertThat(history.path("items").get(0).path("reason").asText()).isEqualTo(REASON);
        assertThat(history.path("nextCursor").asLong()).isEqualTo(1);
        JsonNode original = ok(get(nurse, notePath(note) + "/historico?beforeVersion=1"), 200);
        assertThat(original.path("items").get(0).path("body").asText()).isEqualTo(BODY);
        assertThat(original.path("items").get(0).path("reason").isNull()).isTrue();
        for (String version : List.of("\"1\"", "1.5", "-1", "null", "true", "9223372036854775807",
                "9223372036854775808")) {
            assertStatus(postRaw(doctor, notePath(note) + "/correcoes", "{\"version\":" + version
                    + ",\"body\":\"Texto sintetico\",\"reason\":\"Justificativa sintetica\"}"), 400);
        }
        assertStatus(post(doctor, notePath(note) + "/correcoes",
                Map.of("version", 1, "body", BODY, "reason", "curto")), 400);
        assertStatus(postRaw(doctor, notePath(note) + "/partilhas",
                "{\"version\":1,\"recipientGrantIds\":[123]}"), 400);
    }

    @Test
    void concurrentCorrectionsHaveOneWinnerWithoutRewritingOriginalRevision() throws Exception {
        JsonNode medical = grant(doctor, "MEDICINA"); assign(medical, resident);
        JsonNode note = note(doctor, "GENERAL", BODY);
        String token = csrf(doctor);
        List<CompletableFuture<HttpResponse<String>>> attempts = new ArrayList<>();
        for (int index = 0; index < 2; index++) {
            String text = json.writeValueAsString(Map.of("version", 0,
                    "body", "Correcao concorrente sintetica " + index, "reason", REASON));
            HttpRequest request = HttpRequest.newBuilder(uri(notePath(note) + "/correcoes"))
                    .header("Content-Type", "application/json").header("X-CSRF-TOKEN", token)
                    .POST(HttpRequest.BodyPublishers.ofString(text)).build();
            attempts.add(doctor.client().sendAsync(request, HttpResponse.BodyHandlers.ofString()));
        }
        assertThat(attempts.stream().map(future -> future.join().statusCode()).toList())
                .containsExactlyInAnyOrder(200, 409);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_health_revision WHERE note_id = ?",
                Long.class, uuid(note))).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT body FROM sager_health_revision WHERE note_id = ? "
                + "AND version = 0", String.class, uuid(note))).isEqualTo(BODY);
    }

    @Test
    void revokedAuthorCannotReadOrCorrectAndCompatibleCustodyCreatesOwnAuthoredComplement() throws Exception {
        JsonNode medical = grant(doctor, "MEDICINA");
        JsonNode nursing = grant(nurse, "ENFERMAGEM");
        JsonNode psychological = grant(psychologist, "PSICOLOGIA");
        assign(medical, resident);
        JsonNode recipientAssignment = assign(nursing, resident);
        assign(psychological, resident);
        JsonNode note = note(doctor, "GENERAL", BODY);
        Map<String, Object> transfer = Map.of("residentId", resident, "sourceAuthorAccountId", doctor.id(),
                "recipientGrantId", nursing.path("id").asText(), "reason", REASON);
        assertStatus(post(manager, PREFIX + "/custodias", transfer), 409);
        assertStatus(post(manager, PREFIX + "/habilitacoes/" + medical.path("id").asText()
                + "/revogacao", Map.of("version", 0, "reason", REASON)), 200);
        assertStatus(get(doctor, notePath(note)), 403);
        assertStatus(post(doctor, notePath(note) + "/correcoes",
                Map.of("version", 0, "body", BODY, "reason", REASON)), 403);
        assertStatus(post(manager, PREFIX + "/custodias", Map.of("residentId", resident,
                "sourceAuthorAccountId", doctor.id(), "recipientGrantId", psychological.path("id").asText(),
                "reason", REASON)), 403);
        JsonNode custody = ok(post(manager, PREFIX + "/custodias", transfer), 201);
        JsonNode inherited = ok(get(nurse, notePath(note)), 200);
        assertThat(inherited.path("custodyAccess").asBoolean()).isTrue();
        assertThat(inherited.path("canCorrect").asBoolean()).isFalse();
        assertStatus(post(nurse, notePath(note) + "/correcoes",
                Map.of("version", 0, "body", BODY, "reason", REASON)), 403);
        JsonNode complement = ok(post(nurse, notesPath(), Map.of("category", "GENERAL", "body", BODY,
                "relatedNoteId", note.path("id").asText())), 201);
        assertThat(complement.path("authorAccountId").asText()).isEqualTo(nurse.id().toString());
        assertThat(complement.path("relatedNoteId").asText()).isEqualTo(note.path("id").asText());
        assertThat(ok(get(nurse, notesPath()), 200).path("totalCount").asLong()).isEqualTo(2);
        assertStatus(post(manager, PREFIX + "/vinculos/" + recipientAssignment.path("id").asText()
                + "/encerramento", Map.of("version", 0, "reason", REASON)), 200);
        assign(nursing, resident);
        assertStatus(get(nurse, notePath(note)), 404);
        JsonNode renewedCustody = ok(post(manager, PREFIX + "/custodias", transfer), 201);
        assertThat(renewedCustody.path("id").asText()).isNotEqualTo(custody.path("id").asText());
        assertStatus(get(nurse, notePath(note)), 200);
        assertThat(jdbc.queryForObject("SELECT ended_at IS NULL FROM sager_health_custody WHERE id=?",
                Boolean.class, UUID.fromString(custody.path("id").asText()))).isTrue();
        assertStatus(post(manager, PREFIX + "/custodias/" + renewedCustody.path("id").asText() + "/encerramento",
                Map.of("version", 0, "reason", REASON)), 200);
        assertStatus(get(nurse, notePath(note)), 404);
        assertStatus(get(nurse, notePath(complement)), 200);
    }

    @Test
    void ownPatientRecordIncludesPrivatePsychologicalHistoryAndTraceableExportButNeverAnotherPatient() throws Exception {
        JsonNode medical = grant(doctor, "MEDICINA");
        JsonNode psychological = grant(psychologist, "PSICOLOGIA");
        assign(medical, resident); assign(psychological, resident);
        JsonNode note = note(doctor, "GENERAL", BODY);
        note(psychologist, "PSYCHOLOGICAL", "Registro psicologico sintetico.");
        ok(post(doctor, notePath(note) + "/correcoes",
                Map.of("version", 0, "body", "Evolucao revista sintetica.", "reason", REASON)), 200);
        UUID anotherResident = resident(); assign(medical, anotherResident);
        JsonNode foreign = ok(post(doctor, PREFIX + "/residentes/" + anotherResident + "/notas",
                Map.of("category", "GENERAL", "body", "Conteudo de outro residente sintetico.")), 201);
        String own = "/api/v1/minha-saude/notas";
        assertThat(ok(get(patient, own), 200).path("totalCount").asLong()).isEqualTo(2);
        assertStatus(get(patient, own + "/" + foreign.path("id").asText()), 404);
        assertStatus(get(patient, own + "/" + foreign.path("id").asText() + "/historico"), 404);
        JsonNode detail = ok(get(patient, own + "/" + note.path("id").asText()), 200);
        assertThat(detail.path("canCorrect").asBoolean()).isFalse();
        HttpResponse<String> response = post(patient, "/api/v1/minha-saude/exportacoes", null);
        JsonNode copy = ok(response, 200);
        assertThat(copy.path("resident").path("id").asText()).isEqualTo(resident.toString());
        assertThat(copy.path("notes").size()).isEqualTo(2);
        assertThat(copy.path("requestId").asText())
                .isEqualTo(response.headers().firstValue("X-Request-Id").orElseThrow());
        assertThat(UUID.fromString(copy.path("exportId").asText())).isNotNull();
        assertThat(response.headers().firstValue("Content-Disposition").orElseThrow())
                .contains(copy.path("exportId").asText()).doesNotContain("Residente");
        assertThat(response.body()).contains("Registro psicologico sintetico.", "Evolucao revista sintetica.", BODY)
                .doesNotContain(foreign.path("id").asText(), "Conteudo de outro residente sintetico.");
        assertStatus(get(outsider, own), 403);
    }

    @Test
    void listsUseAuthorizedCountsAndStableCursorsWithoutBodies() throws Exception {
        JsonNode medical = grant(doctor, "MEDICINA");
        JsonNode nursing = grant(nurse, "ENFERMAGEM");
        assign(medical, resident); assign(nursing, resident);
        JsonNode first = note(doctor, "GENERAL", BODY);
        JsonNode second = note(doctor, "GENERAL", BODY);
        note(doctor, "SHARED_SUMMARY", "Nota privada invisivel ao destinatario.");
        share(doctor, first, nursing); share(doctor, second, nursing);
        JsonNode page = ok(get(nurse, notesPath() + "?limit=1&category=GENERAL"), 200);
        assertThat(page.path("totalCount").asLong()).isEqualTo(2);
        assertThat(page.path("items").get(0).path("id").asText()).isEqualTo(second.path("id").asText());
        long cursor = page.path("nextCursor").asLong();
        JsonNode remaining = ok(get(nurse, notesPath() + "?limit=1&category=GENERAL&beforeSequence=" + cursor), 200);
        assertThat(remaining.path("totalCount").asLong()).isEqualTo(2);
        assertThat(remaining.path("items").get(0).path("id").asText()).isEqualTo(first.path("id").asText());
        assertThat(remaining.path("nextCursor").isNull()).isTrue();
        assertThat(page.toString()).doesNotContain(BODY, "Nota privada");
        for (String query : List.of("limit=0", "limit=101", "limit=abc", "beforeSequence=0", "category=OTHER")) {
            assertStatus(get(nurse, notesPath() + "?" + query), 400);
        }
        JsonNode header = ok(get(doctor, PREFIX + "/residentes/" + resident), 200);
        assertThat(header.path("lastRecordedAt").asText()).isNotBlank();
        assertThat(header.path("reviewAfter").asText()).startsWith("2046-");
    }

    @Test
    void invalidTextsAndUuidArraysDoNotCoerceJsonOrCreateRows() throws Exception {
        JsonNode medical = grant(doctor, "MEDICINA"); assign(medical, resident);
        for (String body : List.of("123", "true", "[]", "{}", "null")) {
            assertStatus(postRaw(doctor, notesPath(), "{\"category\":\"GENERAL\",\"body\":" + body + "}"), 400);
        }
        for (String body : List.of("", "   ", "x".repeat(4001), "<script>alert(1)</script>")) {
            assertStatus(post(doctor, notesPath(), Map.of("category", "GENERAL", "body", body)), 400);
        }
        for (String escaped : List.of("\\u0000", "\\uD800", "\\uDC00")) {
            assertStatus(postRaw(doctor, notesPath(),
                    "{\"category\":\"GENERAL\",\"body\":\"Texto sintetico " + escaped + "\"}"), 400);
        }
        assertStatus(postRaw(doctor, notesPath(), "{\"category\":123,\"body\":\"Texto sintetico\"}"), 400);
        assertStatus(post(doctor, notesPath(), Map.of("category", "GENERAL", "body", BODY,
                "relatedNoteId", "invalid")), 400);
        assertThat(ok(get(doctor, notesPath()), 200).path("totalCount").asLong()).isZero();
        assertStatus(postRaw(manager, PREFIX + "/habilitacoes",
                "{\"accountId\":123,\"profession\":\"MEDICINA\",\"registrationNumber\":\"TEST\","
                + "\"registrationRegion\":\"GO\",\"verificationReason\":\"Verificacao sintetica\"}"), 400);
        assertStatus(postRaw(manager, PREFIX + "/vinculos",
                "{\"residentId\":\"" + resident + "\",\"professionalGrantId\":\"" + medical.path("id").asText()
                + "\",\"reason\":123}"), 400);
    }

    @Test
    void invisiblePsychologicalActivityDoesNotChangeProfessionalHeaderDates() throws Exception {
        JsonNode medical = grant(doctor, "MEDICINA");
        JsonNode psychological = grant(psychologist, "PSICOLOGIA");
        assign(medical, resident); assign(psychological, resident);
        note(doctor, "GENERAL", BODY);
        String before = ok(get(doctor, PREFIX + "/residentes/" + resident), 200)
                .path("lastRecordedAt").asText();
        JsonNode psychologicalNote = note(psychologist, "PSYCHOLOGICAL", "Evolucao psicologica sintetica.");
        JsonNode header = ok(get(doctor, PREFIX + "/residentes/" + resident), 200);
        assertThat(header.path("lastRecordedAt").asText()).isEqualTo(before);
        assertThat(ok(get(doctor, PREFIX + "/residentes"), 200).path("items").get(0)
                .path("lastRecordedAt").asText()).isEqualTo(before);
        JsonNode patientCopy = ok(post(patient, "/api/v1/minha-saude/exportacoes", null), 200);
        assertThat(patientCopy.path("resident").path("lastRecordedAt").asText())
                .isEqualTo(psychologicalNote.path("updatedAt").asText());
    }

    @Test
    void globalAuditExcludesProtectedEventsBeforePaginationAndRejectsExplicitFilters() throws Exception {
        JsonNode medical = grant(doctor, "MEDICINA"); assign(medical, resident);
        JsonNode note = note(doctor, "GENERAL", BODY);
        HttpResponse<String> read = get(doctor, notePath(note)); ok(read, 200);
        HttpResponse<String> export = post(doctor, PREFIX + "/residentes/" + resident + "/exportacoes", null);
        ok(export, 200);
        for (String resource : List.of("HEALTH_NOTE", "HEALTH_SHARE", "HEALTH_EXPORT")) {
            assertStatus(get(manager, "/api/v1/auditoria?resource=" + resource), 403);
        }
        JsonNode page = ok(get(manager, "/api/v1/auditoria?actorId=" + doctor.id() + "&limit=1"), 200);
        assertThat(page.path("items").size()).isZero();
        assertThat(page.path("nextCursor").isNull()).isTrue();
        JsonNode administrative = ok(get(manager, "/api/v1/auditoria?resource=HEALTH_GRANT&resourceId="
                + medical.path("id").asText()), 200);
        assertThat(administrative.path("items").size()).isEqualTo(1);
        assertThat(administrative.toString()).doesNotContain(BODY, REASON, "TEST-", "example.invalid");
        UUID readRequest = UUID.fromString(read.headers().firstValue("X-Request-Id").orElseThrow());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE request_id = ? "
                + "AND resource = 'HEALTH_NOTE' AND action = 'READ' AND resource_id = ? "
                + "AND resulting_version = 0", Long.class, readRequest, uuid(note))).isEqualTo(1);
        UUID exportRequest = UUID.fromString(export.headers().firstValue("X-Request-Id").orElseThrow());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE request_id = ? "
                + "AND resource = 'HEALTH_NOTE' AND action = 'EXPORT' AND resource_id = ?",
                Long.class, exportRequest, uuid(note))).isEqualTo(1);
        assertThat(ok(get(manager, "/api/v1/auditoria?requestId=" + exportRequest), 200).path("items").size())
                .isZero();
    }

    @Test
    void failedReadOrExportAuditNeverDeliversClinicalContent() throws Exception {
        JsonNode medical = grant(doctor, "MEDICINA"); assign(medical, resident);
        JsonNode note = note(doctor, "GENERAL", BODY);
        jdbc.execute("CREATE FUNCTION health_test_reject_access_audit() RETURNS trigger AS $$ BEGIN "
                + "IF NEW.action IN ('READ','EXPORT') THEN RAISE EXCEPTION 'synthetic audit failure'; "
                + "END IF; RETURN NEW; END; $$ LANGUAGE plpgsql");
        jdbc.execute("CREATE TRIGGER health_test_reject_access BEFORE INSERT ON sager_audit_event "
                + "FOR EACH ROW EXECUTE FUNCTION health_test_reject_access_audit()");
        try {
            HttpResponse<String> read = get(doctor, notePath(note));
            assertStatus(read, 500);
            assertThat(read.body()).doesNotContain(BODY, "synthetic audit failure", "SQLException");
            HttpResponse<String> export = post(doctor, PREFIX + "/residentes/" + resident + "/exportacoes", null);
            assertStatus(export, 500);
            assertThat(export.body()).doesNotContain(BODY, "notes", "synthetic audit failure");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE request_id = ?",
                    Long.class, UUID.fromString(export.headers().firstValue("X-Request-Id").orElseThrow())))
                    .isZero();
        } finally {
            jdbc.execute("DROP TRIGGER health_test_reject_access ON sager_audit_event");
            jdbc.execute("DROP FUNCTION health_test_reject_access_audit()");
        }
        assertStatus(get(doctor, notePath(note)), 200);
    }

    @Test
    void csrfIsRequiredForAdministrativeNotesAndPatientExportMutations() throws Exception {
        assertStatus(postWithoutCsrf(manager, PREFIX + "/habilitacoes", grantInput(doctor, "MEDICINA")), 403);
        JsonNode medical = grant(doctor, "MEDICINA"); assign(medical, resident);
        assertStatus(postWithoutCsrf(doctor, notesPath(), Map.of("category", "GENERAL", "body", BODY)), 403);
        assertStatus(postWithoutCsrf(patient, "/api/v1/minha-saude/exportacoes", null), 403);
        try (HttpClient anonymous = browser()) {
            assertStatus(anonymous.send(HttpRequest.newBuilder(uri(PREFIX + "/me")).GET().build(),
                    HttpResponse.BodyHandlers.ofString()), 401);
        }
    }

    @Test
    void sqlImmutabilityPreservesDocumentAndAllItsRevisions() throws Exception {
        JsonNode medical = grant(doctor, "MEDICINA"); assign(medical, resident);
        JsonNode note = note(doctor, "GENERAL", BODY);
        for (String sql : List.of("UPDATE sager_health_note SET category='SHARED_SUMMARY' WHERE id='" + uuid(note) + "'",
                "DELETE FROM sager_health_note WHERE id='" + uuid(note) + "'",
                "UPDATE sager_health_revision SET body='Alteracao indevida' WHERE note_id='" + uuid(note) + "'",
                "DELETE FROM sager_health_revision WHERE note_id='" + uuid(note) + "'")) {
            assertThatThrownBy(() -> jdbc.execute(sql)).hasRootCauseInstanceOf(java.sql.SQLException.class);
        }
        assertThat(ok(get(doctor, notePath(note)), 200).path("body").asText()).isEqualTo(BODY);
    }

    private Actor actor(String profile) throws Exception {
        String email = UUID.randomUUID() + "@example.invalid";
        provisioning.create(email, "Pessoa Sintetica " + profile, profile, PASSWORD.toCharArray());
        UUID id = jdbc.queryForObject("SELECT id FROM sager_local_account WHERE email = ?", UUID.class, email);
        HttpClient client = browser();
        Actor actor = new Actor(id, email, client);
        login(actor);
        return actor;
    }

    private Actor relogin(Actor actor) throws Exception {
        Actor fresh = new Actor(actor.id(), actor.email(), browser());
        login(fresh);
        return fresh;
    }

    private void login(Actor actor) throws Exception {
        String token = csrf(actor);
        String form = "email=" + URLEncoder.encode(actor.email(), StandardCharsets.UTF_8) + "&password="
                + URLEncoder.encode(PASSWORD, StandardCharsets.UTF_8);
        HttpResponse<String> response = actor.client().send(HttpRequest.newBuilder(uri("/api/v1/auth/login"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("X-CSRF-TOKEN", token).POST(HttpRequest.BodyPublishers.ofString(form)).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(204);
    }

    private UUID resident() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident (id,name,enrollment,birth_date,course) "
                + "VALUES (?,'Residente Sintetico',?,'2000-01-02',NULL)", id, "SYN-" + id);
        return id;
    }

    private Map<String, Object> grantInput(Actor target, String profession) {
        return Map.of("accountId", target.id(), "profession", profession,
                "registrationNumber", "TEST-" + target.id().toString().substring(0, 8),
                "registrationRegion", "GO", "verificationReason", "  " + REASON + "  ");
    }

    private JsonNode grant(Actor target, String profession) throws Exception {
        return ok(post(manager, PREFIX + "/habilitacoes", grantInput(target, profession)), 201);
    }

    private JsonNode assign(JsonNode grant, UUID residentId) throws Exception {
        return ok(post(manager, PREFIX + "/vinculos", Map.of("residentId", residentId,
                "professionalGrantId", grant.path("id").asText(), "reason", REASON)), 201);
    }

    private JsonNode note(Actor author, String category, String body) throws Exception {
        return ok(post(author, notesPath(), Map.of("category", category, "body", body)), 201);
    }

    private JsonNode share(Actor author, JsonNode note, JsonNode... grants) throws Exception {
        return ok(post(author, notePath(note) + "/partilhas", Map.of("version", note.path("version").asLong(),
                "recipientGrantIds", java.util.Arrays.stream(grants).map(g -> g.path("id").asText()).toList())), 200);
    }

    private String notesPath() { return PREFIX + "/residentes/" + resident + "/notas"; }
    private String notePath(JsonNode note) { return PREFIX + "/notas/" + note.path("id").asText(); }
    private UUID uuid(JsonNode value) { return UUID.fromString(value.path("id").asText()); }

    private HttpClient browser() {
        HttpClient browser = HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
                .followRedirects(HttpClient.Redirect.NEVER).build();
        browsers.add(browser);
        return browser;
    }

    private String csrf(Actor actor) throws Exception {
        return json.readTree(get(actor, "/api/v1/auth/csrf").body()).path("token").asText();
    }

    private HttpResponse<String> get(Actor actor, String path) throws Exception {
        return actor.client().send(HttpRequest.newBuilder(uri(path)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> post(Actor actor, String path, Object body) throws Exception {
        return postRaw(actor, path, body == null ? "" : json.writeValueAsString(body));
    }

    private HttpResponse<String> postRaw(Actor actor, String path, String body) throws Exception {
        return actor.client().send(HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                .header("X-CSRF-TOKEN", csrf(actor)).POST(HttpRequest.BodyPublishers.ofString(body)).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> postWithoutCsrf(Actor actor, String path, Object body) throws Exception {
        return actor.client().send(HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body == null ? "" : json.writeValueAsString(body))).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode ok(HttpResponse<String> response, int status) throws Exception {
        assertStatus(response, status);
        assertThat(response.headers().firstValue("Cache-Control").orElseThrow()).contains("no-store");
        return json.readTree(response.body());
    }

    private void assertStatus(HttpResponse<String> response, int status) throws Exception {
        assertThat(response.statusCode()).as(response.body()).isEqualTo(status);
        if (status >= 400) {
            JsonNode error = json.readTree(response.body());
            assertThat(error.path("code").asText()).isNotBlank();
            assertThat(error.path("requestId").asText())
                    .isEqualTo(response.headers().firstValue("X-Request-Id").orElseThrow());
        }
    }

    private URI uri(String path) { return URI.create("http://127.0.0.1:" + port + path); }
    private record Actor(UUID id, String email, HttpClient client) {}
}
