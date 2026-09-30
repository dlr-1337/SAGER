package br.edu.ifgoiano.sager.operations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
import java.util.concurrent.CompletableFuture;

import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;
import br.edu.ifgoiano.sager.operations.shortexits.ShortExitExpiryScheduler;
import br.edu.ifgoiano.sager.operations.shortexits.ShortExitExpiryService;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.ApplicationContext;
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

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT,
        properties = "sager.operations.expiry.enabled=false")
@ActiveProfiles("local")
@Import(OperationsApiIntegrationTest.TimeConfiguration.class)
class OperationsApiIntegrationTest {
    private static final String PASSWORD = "Senha sintética 123!";
    private static final String CALLS = "/api/v1/chamadas";
    private static final String EXITS = "/api/v1/saidas-curtas";
    private static final Instant START = Instant.parse("2026-10-01T01:00:00Z");
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired private LocalAccountProvisioningService provisioning;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper json;
    @Autowired private MutableClock clock;
    @Autowired private ApplicationContext context;
    @Autowired private LongExitFixture longExits;
    @LocalServerPort private int port;
    private UUID accommodation;
    private UUID room;
    private UUID resident;

    @BeforeEach
    void fixtures() {
        clock.set(START);
        // F5 retains origin evidence after a source correction; clear only these test-owned
        // child domains before deleting operation fixtures, never clinical/management parents.
        if (jdbc.queryForObject("SELECT to_regclass('sager_occurrence') IS NOT NULL", Boolean.class)) {
            jdbc.execute("TRUNCATE sager_communication_recipient, sager_communication,"
                    + " sager_commitment_basis, sager_commitment_term, sager_warning,"
                    + " sager_notification_event, sager_discipline_notification,"
                    + " sager_occurrence_revision, sager_occurrence, sager_notice_draft_recipient,"
                    + " sager_notice, sager_discipline_idempotency RESTART IDENTITY CASCADE");
        }
        longExits.clear();
        for (String table : List.of("sager_night_call_mark_history", "sager_night_call_mark",
                "sager_night_call", "sager_short_exit_history", "sager_short_exit")) {
            if (jdbc.queryForObject("SELECT to_regclass(?) IS NOT NULL", Boolean.class, table)) {
                jdbc.update("DELETE FROM " + table);
            }
        }
        jdbc.update("DELETE FROM spring_session");
        jdbc.update("DELETE FROM sager_local_account");
        jdbc.update("DELETE FROM sager_room_allocation");
        jdbc.update("DELETE FROM sager_room");
        jdbc.update("DELETE FROM sager_accommodation_unit");
        jdbc.update("DELETE FROM sager_accommodation");
        jdbc.update("DELETE FROM sager_resident");
        accommodation = UUID.randomUUID();
        room = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_accommodation(id, code, name) VALUES (?, 'OPS', 'Sintético')",
                accommodation);
        jdbc.update("INSERT INTO sager_room(id, code, number, accommodation_id, capacity, situation)"
                + " VALUES (?, 'OPS-1', '1', ?, 30, 'Disponível')", room, accommodation);
        resident = resident("OPS-A", LocalDate.of(2009, 1, 1), true);
        account("supervisor", "supervisor");
        account("gestor", "gestor");
        account("student", "residente");
        provisioning.linkResident("student@example.invalid", resident);
    }

    @Test
    void opensFrozenMinorRosterAndCompletesCallWithVersionedHistory() throws Exception {
        resident("OPS-ADULT", LocalDate.of(2008, 9, 30), true);
        resident("OPS-NO-ROOM", LocalDate.of(2009, 1, 1), false);
        try (HttpClient supervisor = logged("supervisor")) {
            JsonNode opened = open(supervisor);
            String id = opened.path("id").asText();
            assertThat(opened.path("referenceDate").asText()).isEqualTo("2026-09-30");
            assertThat(opened.path("records").size()).isEqualTo(1);
            assertThat(opened.path("records").get(0).path("residentId").asText())
                    .isEqualTo(resident.toString());
            assertError(post(supervisor, CALLS + "/" + id + "/fechamento", Map.of("version", 0)),
                    409, "incomplete_call");
            resident("OPS-NEW", LocalDate.of(2009, 1, 1), true);
            jdbc.update("UPDATE sager_room SET number = 'Novo' WHERE id = ?", room);
            assertThat(read(supervisor, CALLS + "/" + id).path("records").size()).isEqualTo(1);
            assertThat(read(supervisor, CALLS + "/" + id).path("records").get(0).path("roomNumber").asText())
                    .isEqualTo("1");
            assertThat(put(supervisor, CALLS + "/" + id + "/registros/" + resident,
                    Map.of("mark", "PRESENTE", "version", 0)).statusCode()).isEqualTo(200);
            assertError(put(supervisor, CALLS + "/" + id + "/registros/" + resident,
                    Map.of("mark", "AUSENTE", "version", 0)), 409, "stale_version");
            assertThat(post(supervisor, CALLS + "/" + id + "/fechamento", Map.of("version", 1))
                    .statusCode()).isEqualTo(200);
            assertError(put(supervisor, CALLS + "/" + id + "/registros/" + resident,
                    Map.of("mark", "AUSENTE", "version", 2)), 409, "invalid_state");
            assertError(post(supervisor, CALLS + "/" + id + "/correcoes/" + resident,
                    Map.of("mark", "AUSENTE", "version", 2, "justification", "breve")),
                    400, "invalid_input");
            assertThat(post(supervisor, CALLS + "/" + id + "/correcoes/" + resident,
                    Map.of("mark", "AUSENTE", "version", 2,
                            "justification", "Conferência presencial posterior")).statusCode()).isEqualTo(200);
            JsonNode closed = read(supervisor, CALLS + "/" + id);
            assertThat(closed.path("status").asText()).isEqualTo("FECHADA");
            assertThat(closed.path("version").asLong()).isEqualTo(3);
            JsonNode history = closed.path("records").get(0).path("history");
            assertThat(history.size()).isEqualTo(2);
            assertThat(history.get(0).path("mark").asText()).isEqualTo("PRESENTE");
            assertThat(history.get(1).path("mark").asText()).isEqualTo("AUSENTE");
            assertThat(history.get(1).path("actorId").asText()).isNotBlank();
            assertThat(read(supervisor, CALLS + "?accommodationId=" + accommodation + "&date=2026-09-30")
                    .size()).isEqualTo(1);
            assertError(post(supervisor, CALLS, Map.of("accommodationId", accommodation)),
                    409, "call_exists");
        }
    }

    @Test
    void usesSaoPauloBirthdayAndRequiresOutsideWindowConfirmationAtOpenAndClose() throws Exception {
        clock.set(Instant.parse("2026-10-01T02:30:00Z"));
        UUID birthday = resident("OPS-BIRTHDAY", LocalDate.of(2008, 10, 1), true);
        try (HttpClient supervisor = logged("supervisor")) {
            JsonNode info = read(supervisor, CALLS + "/contexto?accommodationId=" + accommodation);
            assertThat(info.path("outsideWindow").asBoolean()).isFalse();
            clock.set(Instant.parse("2026-10-01T03:00:00Z"));
            assertError(post(supervisor, CALLS, Map.of("accommodationId", accommodation)),
                    409, "outside_window");
            assertError(post(supervisor, CALLS, Map.of("accommodationId", accommodation,
                    "outsideWindowConfirmed", true, "justification", "breve")), 400, "invalid_input");
            JsonNode opened = created(post(supervisor, CALLS, Map.of("accommodationId", accommodation,
                    "outsideWindowConfirmed", true, "justification", "Exceção com conferência presencial")));
            assertThat(opened.path("referenceDate").asText()).isEqualTo("2026-10-01");
            assertThat(opened.path("records").size()).isEqualTo(1);
            assertThat(opened.path("records").get(0).path("residentId").asText())
                    .isNotEqualTo(birthday.toString());
            String id = opened.path("id").asText();
            assertThat(put(supervisor, CALLS + "/" + id + "/registros/" + resident,
                    Map.of("mark", "PRESENTE", "version", 0)).statusCode()).isEqualTo(200);
            assertError(post(supervisor, CALLS + "/" + id + "/fechamento", Map.of("version", 1)),
                    409, "outside_window");
            assertThat(post(supervisor, CALLS + "/" + id + "/fechamento", Map.of("version", 1,
                    "outsideWindowConfirmed", true, "justification", "Conclusão da conferência excepcional"))
                    .statusCode()).isEqualTo(200);
        }
    }

    @Test
    void missingLegacyBirthDateBlocksOpeningWithoutPartialRecords() throws Exception {
        jdbc.execute("ALTER TABLE sager_resident DISABLE TRIGGER ALL");
        jdbc.execute("ALTER TABLE sager_resident DROP CONSTRAINT sager_resident_birth_date_required");
        UUID missing;
        try {
            missing = resident("OPS-LEGACY", null, true);
        } finally {
            jdbc.execute("ALTER TABLE sager_resident ADD CONSTRAINT sager_resident_birth_date_required"
                    + " CHECK (birth_date IS NOT NULL) NOT VALID");
            jdbc.execute("ALTER TABLE sager_resident ENABLE TRIGGER ALL");
        }
        try (HttpClient supervisor = logged("supervisor")) {
            JsonNode info = read(supervisor, CALLS + "/contexto?accommodationId=" + accommodation);
            assertThat(info.path("missingBirthDates").get(0).path("residentId").asText())
                    .isEqualTo(missing.toString());
            assertError(post(supervisor, CALLS, Map.of("accommodationId", accommodation)),
                    409, "birth_date_required");
            assertThat(count("sager_night_call")).isZero();
        }
    }

    @Test
    void shortExitDerivesOwnerUsesServerNowAndEnforcesThreeHours() throws Exception {
        try (HttpClient student = logged("student")) {
            assertThat(read(student, EXITS + "/elegibilidade").path("eligible").asBoolean()).isTrue();
            Map<String, Object> body = exitBody("NOW", clock.instant(), clock.instant().plusSeconds(10800));
            body.put("residentId", UUID.randomUUID());
            assertError(post(student, EXITS, body), 400, "invalid_input");
            body.remove("residentId");
            body.put("requestedDepartureAt", clock.instant().minusSeconds(900).toString());
            assertError(post(student, EXITS, body), 400, "invalid_input");
            body.remove("requestedDepartureAt");
            JsonNode saved = created(post(student, EXITS, body));
            assertThat(saved.path("residentId").asText()).isEqualTo(resident.toString());
            assertThat(Instant.parse(saved.path("requestedDepartureAt").asText())).isEqualTo(clock.instant());
            assertThat(saved.path("actualDepartureAt").isNull()).isTrue();
            assertThat(saved.path("version").asLong()).isZero();
            assertError(post(student, EXITS, exitBody("NOW", clock.instant(),
                    clock.instant().plusSeconds(10801))), 400, "invalid_input");
            assertError(post(student, EXITS, exitBody("SCHEDULED", clock.instant().minusSeconds(1),
                    clock.instant().plusSeconds(3600))), 400, "invalid_input");
            assertThat(read(student, EXITS).size()).isEqualTo(1);
        }
    }

    @Test
    void permissionsOwnRecordsCsrfAndStaleVersionsPreventUntrustedMutation() throws Exception {
        UUID other = resident("OPS-OTHER", LocalDate.of(2009, 1, 1), true);
        account("other", "residente");
        provisioning.linkResident("other@example.invalid", other);
        try (HttpClient student = logged("student"); HttpClient another = logged("other");
                HttpClient supervisor = logged("supervisor"); HttpClient gestor = logged("gestor");
                HttpClient anonymous = browser()) {
            String id = createExit(student, "SCHEDULED", 3600, 7200).path("id").asText();
            assertThat(get(anonymous, EXITS).statusCode()).isEqualTo(401);
            assertThat(get(gestor, CALLS + "/contexto?accommodationId=" + accommodation).statusCode())
                    .isEqualTo(403);
            assertThat(get(gestor, EXITS).statusCode()).isEqualTo(403);
            assertThat(get(student, CALLS + "/contexto?accommodationId=" + accommodation).statusCode())
                    .isEqualTo(403);
            assertThat(read(another, EXITS).size()).isZero();
            assertError(get(another, EXITS + "/" + id), 404, "not_found");
            assertError(put(another, EXITS + "/" + id,
                    editBody("SCHEDULED", 3600, 7200, 0)), 404, "not_found");
            assertThat(postRaw(student, EXITS, json.writeValueAsString(exitBody("NOW", clock.instant(),
                    clock.instant().plusSeconds(3600))), null).statusCode()).isEqualTo(403);
            assertThat(post(student, EXITS + "/" + id + "/decisao",
                    Map.of("decision", "APPROVE", "version", 0)).statusCode()).isEqualTo(403);
            assertError(post(supervisor, EXITS + "/" + id + "/decisao",
                    Map.of("decision", "APPROVE", "version", 1)), 409, "stale_version");
            assertThat(post(supervisor, EXITS + "/" + id + "/decisao",
                    Map.of("decision", "APPROVE", "version", 0)).statusCode()).isEqualTo(200);
            assertError(put(student, EXITS + "/" + id, editBody("SCHEDULED", 3600, 7200, 1)),
                    409, "invalid_state");
        }
    }

    @Test
    void rejectsAdultUnallocatedAndUnlinkedResidents() throws Exception {
        jdbc.update("UPDATE sager_resident SET birth_date = DATE '2008-09-30' WHERE id = ?", resident);
        account("unlinked", "residente");
        try (HttpClient student = logged("student"); HttpClient unlinked = logged("unlinked")) {
            assertThat(read(student, EXITS + "/elegibilidade").path("eligible").asBoolean()).isFalse();
            assertError(post(student, EXITS, exitBody("NOW", clock.instant(),
                    clock.instant().plusSeconds(3600))), 409, "not_eligible");
            assertError(get(unlinked, EXITS + "/elegibilidade"), 403, "resident_link_required");
            jdbc.update("UPDATE sager_resident SET birth_date = DATE '2009-01-01' WHERE id = ?", resident);
            jdbc.update("UPDATE sager_room_allocation SET ended_at = started_at, end_reason = 'END'");
            assertError(post(student, EXITS, exitBody("NOW", clock.instant(),
                    clock.instant().plusSeconds(3600))), 409, "not_eligible");
        }
    }

    @Test
    void permitsOwnPendingCancellationAndSupervisorRejectionWithReasons() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String id = createExit(student, "SCHEDULED", 3600, 7200).path("id").asText();
            assertError(post(supervisor, EXITS + "/" + id + "/decisao",
                    Map.of("decision", "REJECT", "version", 0, "comment", "breve")),
                    400, "invalid_input");
            assertThat(post(supervisor, EXITS + "/" + id + "/decisao",
                    Map.of("decision", "REJECT", "version", 0, "comment", "Motivo de recusa sintético"))
                    .statusCode()).isEqualTo(200);
            String next = createExit(student, "SCHEDULED", 3600, 7200).path("id").asText();
            assertThat(post(student, EXITS + "/" + next + "/cancelamento",
                    Map.of("version", 0, "comment", "Solicitação cancelada pelo estudante"))
                    .statusCode()).isEqualTo(200);
            assertThat(read(student, EXITS + "/" + next).path("status").asText()).isEqualTo("CANCELADA");
            String approved = createExit(student, "SCHEDULED", 3600, 7200).path("id").asText();
            approve(supervisor, approved);
            assertError(post(student, EXITS + "/" + approved + "/cancelamento",
                    Map.of("version", 1, "comment", "Cancelamento após análise presencial")),
                    409, "invalid_state");
            assertThat(post(supervisor, EXITS + "/" + approved + "/cancelamento",
                    Map.of("version", 1, "comment", "Cancelamento antes da partida física"))
                    .statusCode()).isEqualTo(200);
        }
    }

    @Test
    void physicalTimesRequireJustificationAndLateReturnObservationWithoutAutomaticSanction() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String id = createExit(student, "NOW", 0, 3600).path("id").asText();
            approve(supervisor, id);
            clock.set(START.plusSeconds(60));
            assertError(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 1, "timeMode", "RETROACTIVE", "occurredAt", START.toString(),
                            "justification", "breve")), 400, "invalid_input");
            assertError(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 1, "timeMode", "RETROACTIVE", "occurredAt", START.minusSeconds(1).toString(),
                            "justification", "Conferência retroativa presencial")), 400, "invalid_input");
            assertThat(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 1, "timeMode", "RETROACTIVE", "occurredAt", START.toString(),
                            "justification", "Conferência retroativa presencial")).statusCode()).isEqualTo(200);
            clock.set(START.plusSeconds(12000));
            expire();
            assertThat(read(supervisor, EXITS + "/" + id).path("status").asText()).isEqualTo("EM_ANDAMENTO");
            assertError(post(supervisor, EXITS + "/" + id + "/cancelamento",
                    Map.of("version", 2, "comment", "Não pode cancelar após partida")), 409, "invalid_state");
            assertError(post(supervisor, EXITS + "/" + id + "/retorno",
                    Map.of("version", 2, "timeMode", "NOW")), 400, "invalid_input");
            assertThat(post(supervisor, EXITS + "/" + id + "/retorno", Map.of("version", 2,
                    "timeMode", "NOW", "lateObservation", "Retorno conferido após atraso sintético"))
                    .statusCode()).isEqualTo(200);
            JsonNode saved = read(supervisor, EXITS + "/" + id);
            assertThat(saved.path("status").asText()).isEqualTo("RETORNO_CONFIRMADO_COM_ATRASO");
            assertThat(saved.path("history").size()).isEqualTo(4);
            assertThat(Instant.parse(saved.path("actualReturnAt").asText())).isEqualTo(clock.instant());
            assertThat(count("sager_short_exit")).isEqualTo(1);
            assertError(post(supervisor, EXITS + "/" + id + "/retorno",
                    Map.of("version", 2, "timeMode", "NOW", "lateObservation", "Outra confirmação tardia")),
                    409, "stale_version");
        }
    }

    @Test
    void expiresExactDeadlinesWithSystemAuditAndRejectsActionsBeforeSchedulerRuns() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String scheduled = createExit(student, "SCHEDULED", 3600, 7200).path("id").asText();
            clock.set(START.plusSeconds(3600));
            assertError(post(supervisor, EXITS + "/" + scheduled + "/decisao",
                    Map.of("version", 0, "decision", "APPROVE")), 409, "deadline_passed");
            assertThat(read(supervisor, EXITS + "/" + scheduled).path("status").asText())
                    .isEqualTo("AGUARDANDO_ANALISE");
            expire();
            assertThat(read(supervisor, EXITS + "/" + scheduled).path("status").asText()).isEqualTo("EXPIRADA");
            String now = createExit(student, "NOW", 0, 3600).path("id").asText();
            clock.set(START.plusSeconds(7200));
            expire();
            assertThat(read(supervisor, EXITS + "/" + now).path("status").asText()).isEqualTo("EXPIRADA");
            String approved = createExit(student, "NOW", 0, 3600).path("id").asText();
            approve(supervisor, approved);
            clock.set(START.plusSeconds(10800));
            assertError(post(supervisor, EXITS + "/" + approved + "/partida",
                    Map.of("version", 1, "timeMode", "NOW")), 409, "deadline_passed");
            expire();
            assertThat(read(supervisor, EXITS + "/" + approved).path("status").asText()).isEqualTo("EXPIRADA");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event"
                    + " WHERE resource = 'SHORT_EXIT' AND resource_id IN (?, ?, ?)"
                    + " AND origin = 'SYSTEM_JOB' AND actor_id IS NULL AND actor_profile IS NULL",
                    Integer.class, UUID.fromString(scheduled), UUID.fromString(now), UUID.fromString(approved)))
                    .isEqualTo(3);
            expire();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event"
                    + " WHERE resource_id IN (?, ?, ?) AND origin = 'SYSTEM_JOB'", Integer.class,
                    UUID.fromString(scheduled), UUID.fromString(now), UUID.fromString(approved))).isEqualTo(3);
        }
    }

    @Test
    void onlyDepartureAuthorizedAtOpeningCanJustifyAbsence() throws Exception {
        clock.set(START.minusSeconds(3600));
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String exit = createExit(student, "NOW", 0, 7200).path("id").asText();
            approve(supervisor, exit);
            clock.set(START);
            String call = open(supervisor).path("id").asText();
            assertError(put(supervisor, CALLS + "/" + call + "/registros/" + resident,
                    Map.of("version", 0, "mark", "AUSENCIA_JUSTIFICADA")), 409, "authorized_exit_required");
            assertThat(post(supervisor, EXITS + "/" + exit + "/partida", Map.of("version", 1,
                    "timeMode", "RETROACTIVE", "occurredAt", START.minusSeconds(1800).toString(),
                    "justification", "Partida conferida retroativamente")).statusCode()).isEqualTo(200);
            assertThat(put(supervisor, CALLS + "/" + call + "/registros/" + resident,
                    Map.of("version", 0, "mark", "AUSENCIA_JUSTIFICADA")).statusCode()).isEqualTo(200);
            JsonNode mark = read(supervisor, CALLS + "/" + call).path("records").get(0);
            assertThat(mark.path("authorizedExitId").asText()).isEqualTo(exit);
            assertThat(mark.path("authorizedExitType").asText()).isEqualTo("SHORT");
            clock.set(START.plusSeconds(7201));
            JsonNode preserved = read(supervisor, CALLS + "/" + call).path("records").get(0);
            assertThat(preserved.path("authorizedExitId").asText()).isEqualTo(exit);
        }
    }

    @Test
    void concurrentOverlappingRequestsAndReturnsPersistOnlyOneChange() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String token = csrf(student);
            String body = json.writeValueAsString(exitBody("NOW", START, START.plusSeconds(3600)));
            CompletableFuture<Integer> first = CompletableFuture.supplyAsync(() -> status(student, EXITS, body, token));
            CompletableFuture<Integer> second = CompletableFuture.supplyAsync(() -> status(student, EXITS, body, token));
            assertThat(List.of(first.join(), second.join())).containsExactlyInAnyOrder(201, 409);
            String id = read(supervisor, EXITS).get(0).path("id").asText();
            approve(supervisor, id);
            assertThat(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 1, "timeMode", "NOW")).statusCode()).isEqualTo(200);
            clock.set(START.plusSeconds(60));
            String staffToken = csrf(supervisor);
            String returning = "{\"version\":2,\"timeMode\":\"NOW\"}";
            CompletableFuture<Integer> a = CompletableFuture.supplyAsync(() ->
                    status(supervisor, EXITS + "/" + id + "/retorno", returning, staffToken));
            CompletableFuture<Integer> b = CompletableFuture.supplyAsync(() ->
                    status(supervisor, EXITS + "/" + id + "/retorno", returning, staffToken));
            assertThat(List.of(a.join(), b.join())).containsExactlyInAnyOrder(200, 409);
            assertThat(read(supervisor, EXITS + "/" + id).path("history").size()).isEqualTo(4);
        }
    }

    @Test
    void auditFailureRollsBackDomainAndHistoryAndDoesNotRecordClinicalValues() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String id = createExit(student, "NOW", 0, 3600).path("id").asText();
            jdbc.execute("CREATE FUNCTION reject_ops_audit() RETURNS TRIGGER AS $$ BEGIN"
                    + " IF NEW.resource IN ('SHORT_EXIT', 'NIGHT_CALL', 'NIGHT_CALL_MARK') THEN"
                    + " RAISE EXCEPTION 'synthetic audit rollback'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql");
            jdbc.execute("CREATE TRIGGER reject_ops_audit BEFORE INSERT ON sager_audit_event"
                    + " FOR EACH ROW EXECUTE FUNCTION reject_ops_audit()");
            try {
                assertThat(post(supervisor, EXITS + "/" + id + "/decisao",
                        Map.of("version", 0, "decision", "APPROVE")).statusCode()).isEqualTo(500);
                assertThat(read(supervisor, EXITS + "/" + id).path("version").asLong()).isZero();
                assertThat(read(supervisor, EXITS + "/" + id).path("history").size()).isEqualTo(1);
                assertThat(post(supervisor, CALLS, Map.of("accommodationId", accommodation)).statusCode())
                        .isEqualTo(500);
                assertThat(count("sager_night_call")).isZero();
            } finally {
                jdbc.execute("DROP TRIGGER reject_ops_audit ON sager_audit_event");
                jdbc.execute("DROP FUNCTION reject_ops_audit()");
            }
            String stored = jdbc.queryForObject("SELECT string_agg(changed_fields::text, ',')"
                    + " FROM sager_audit_event WHERE resource_id = ?", String.class, UUID.fromString(id));
            assertThat(stored).contains("reason").doesNotContain("Motivo sintético", "Estudante", "Senha");
        }
    }

    @Test
    void rejectsOverlappingOrPhysicalLongExitsUsingSharedProviderGuard() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            longExits.resident = resident;
            longExits.overlap = true;
            assertError(post(student, EXITS, exitBody("NOW", START, START.plusSeconds(3600))),
                    409, "overlapping_exit");
            longExits.overlap = false;
            String id = createExit(student, "NOW", 0, 3600).path("id").asText();
            approve(supervisor, id);
            longExits.physical = true;
            assertError(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 1, "timeMode", "NOW")), 409, "physical_exit_conflict");
            assertThat(read(supervisor, EXITS + "/" + id).path("status").asText()).isEqualTo("APROVADA");
        }
    }

    @Test
    void acceptsAuthorizedLongExitReferenceFromRegisteredProvider() throws Exception {
        try (HttpClient supervisor = logged("supervisor")) {
            longExits.resident = resident;
            longExits.reference = new AuthorizedExitLookup.Reference(UUID.randomUUID(), "LONG");
            String id = open(supervisor).path("id").asText();
            assertThat(put(supervisor, CALLS + "/" + id + "/registros/" + resident,
                    Map.of("version", 0, "mark", "AUSENCIA_JUSTIFICADA",
                            "authorizedExitId", longExits.reference.id(), "authorizedExitType", "LONG"))
                    .statusCode()).isEqualTo(200);
            JsonNode mark = read(supervisor, CALLS + "/" + id).path("records").get(0);
            assertThat(mark.path("authorizedExitType").asText()).isEqualTo("LONG");
            assertThat(mark.path("authorizedExitId").asText()).isEqualTo(longExits.reference.id().toString());
        }
    }

    @Test
    void databaseRejectsNullStateAndPhysicalEvidenceInsteadOfPassingUnknownChecks() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            UUID exit = UUID.fromString(createExit(student, "NOW", 0, 3600).path("id").asText());
            assertThatThrownBy(() -> jdbc.update("UPDATE sager_short_exit SET status = 'APROVADA' WHERE id = ?", exit))
                    .isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbc.update("UPDATE sager_short_exit SET status = 'EM_ANDAMENTO',"
                    + " actual_departure_at = requested_departure_at WHERE id = ?", exit))
                    .isInstanceOf(DataIntegrityViolationException.class);
            UUID call = UUID.fromString(open(supervisor).path("id").asText());
            assertThatThrownBy(() -> jdbc.update("UPDATE sager_night_call SET status = 'FECHADA', closed_by = ? WHERE id = ?",
                    UUID.randomUUID(), call)).isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbc.update("UPDATE sager_night_call SET outside_window_confirmed = TRUE WHERE id = ?", call))
                    .isInstanceOf(DataIntegrityViolationException.class);
        }
    }

    @Test
    void pendingEditPreservesPreviousSnapshotAndAuditsOnlyChangedFields() throws Exception {
        try (HttpClient student = logged("student")) {
            UUID id = UUID.fromString(createExit(student, "SCHEDULED", 3600, 7200).path("id").asText());
            Map<String, Object> body = editBody("SCHEDULED", 3600, 7200, 0);
            body.put("reason", "Novo motivo sintético da saída");
            assertThat(put(student, EXITS + "/" + id, body).statusCode()).isEqualTo(200);
            JsonNode updated = read(student, EXITS + "/" + id);
            assertThat(updated.path("version").asLong()).isEqualTo(1);
            assertThat(updated.path("history").get(0).path("reason").asText()).isEqualTo("Motivo sintético da saída");
            assertThat(updated.path("history").get(1).path("reason").asText()).isEqualTo("Novo motivo sintético da saída");
            assertThat(auditFields(id)).containsExactly("reason");
            assertError(put(student, EXITS + "/" + id, body), 409, "stale_version");
        }
    }

    @Test
    void markerAuditDoesNotClaimUnchangedAuthorizationFields() throws Exception {
        try (HttpClient supervisor = logged("supervisor")) {
            JsonNode opened = open(supervisor);
            UUID mark = UUID.fromString(opened.path("records").get(0).path("id").asText());
            String id = opened.path("id").asText();
            assertThat(put(supervisor, CALLS + "/" + id + "/registros/" + resident,
                    Map.of("version", 0, "mark", "PRESENTE")).statusCode()).isEqualTo(200);
            assertThat(auditFields(mark)).containsExactly("mark");
        }
    }

    @Test
    void nowSubmissionAndEditionUseServerClockAfterFormDelay() throws Exception {
        try (HttpClient student = logged("student")) {
            Map<String, Object> body = exitBody("NOW", START, START.plusSeconds(10800));
            clock.set(START.plusSeconds(600));
            JsonNode created = created(post(student, EXITS, body));
            UUID id = UUID.fromString(created.path("id").asText());
            assertThat(Instant.parse(created.path("requestedDepartureAt").asText())).isEqualTo(clock.instant());
            assertThat(Instant.parse(created.path("expectedReturnAt").asText())).isEqualTo(START.plusSeconds(10800));
            clock.set(START.plusSeconds(900));
            body.put("version", 0);
            assertThat(put(student, EXITS + "/" + id, body).statusCode()).isEqualTo(200);
            assertThat(Instant.parse(read(student, EXITS + "/" + id).path("requestedDepartureAt").asText()))
                    .isEqualTo(clock.instant());
            assertThat(auditFields(id)).containsExactly("requestedDepartureAt");
        }
    }

    @Test
    void authorizesThroughExactExpectedReturnButNotWhenAlreadyReturnedAtOpening() throws Exception {
        clock.set(START.minusSeconds(1800));
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String exit = createExit(student, "NOW", 0, 1800).path("id").asText();
            approve(supervisor, exit);
            assertThat(post(supervisor, EXITS + "/" + exit + "/partida",
                    Map.of("version", 1, "timeMode", "NOW")).statusCode()).isEqualTo(200);
            clock.set(START);
            String call = open(supervisor).path("id").asText();
            assertThat(put(supervisor, CALLS + "/" + call + "/registros/" + resident,
                    Map.of("version", 0, "mark", "AUSENCIA_JUSTIFICADA")).statusCode()).isEqualTo(200);
            assertThat(post(supervisor, CALLS + "/" + call + "/fechamento", Map.of("version", 1))
                    .statusCode()).isEqualTo(200);
            assertThat(post(supervisor, EXITS + "/" + exit + "/retorno",
                    Map.of("version", 2, "timeMode", "NOW")).statusCode()).isEqualTo(200);
            assertError(post(supervisor, CALLS + "/" + call + "/correcoes/" + resident,
                    Map.of("version", 2, "mark", "AUSENCIA_JUSTIFICADA",
                            "justification", "Revisão da autorização no instante")),
                    409, "authorized_exit_required");
        }
    }

    @Test
    void pendingAndPhysicallyLateExitsNeverJustifyNightAbsence() throws Exception {
        clock.set(START.minusSeconds(3601));
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String exit = createExit(student, "NOW", 0, 3600).path("id").asText();
            approve(supervisor, exit);
            assertThat(post(supervisor, EXITS + "/" + exit + "/partida",
                    Map.of("version", 1, "timeMode", "NOW")).statusCode()).isEqualTo(200);
            clock.set(START);
            String call = open(supervisor).path("id").asText();
            assertError(put(supervisor, CALLS + "/" + call + "/registros/" + resident,
                    Map.of("version", 0, "mark", "AUSENCIA_JUSTIFICADA",
                            "authorizedExitId", UUID.fromString(exit), "authorizedExitType", "SHORT")),
                    409, "authorized_exit_required");
            String pending = createExit(student, "NOW", 0, 3600).path("id").asText();
            assertError(put(supervisor, CALLS + "/" + call + "/registros/" + resident,
                    Map.of("version", 0, "mark", "AUSENCIA_JUSTIFICADA",
                            "authorizedExitId", UUID.fromString(pending), "authorizedExitType", "SHORT")),
                    409, "authorized_exit_required");
            assertThat(read(supervisor, CALLS + "/" + call).path("version").asLong()).isZero();
        }
    }

    @Test
    void concurrentOpeningAndMarkingUseOneRosterAndOneAggregateVersion() throws Exception {
        UUID another = resident("OPS-RACE", LocalDate.of(2009, 1, 1), true);
        try (HttpClient supervisor = logged("supervisor")) {
            String token = csrf(supervisor);
            String body = json.writeValueAsString(Map.of("accommodationId", accommodation));
            CompletableFuture<Integer> a = CompletableFuture.supplyAsync(() -> status(supervisor, CALLS, body, token));
            CompletableFuture<Integer> b = CompletableFuture.supplyAsync(() -> status(supervisor, CALLS, body, token));
            assertThat(List.of(a.join(), b.join())).containsExactlyInAnyOrder(201, 409);
            JsonNode call = read(supervisor, CALLS).get(0);
            assertThat(call.path("records").size()).isEqualTo(2);
            String id = call.path("id").asText();
            String marking = "{\"version\":0,\"mark\":\"PRESENTE\"}";
            CompletableFuture<Integer> first = CompletableFuture.supplyAsync(() ->
                    putStatus(supervisor, CALLS + "/" + id + "/registros/" + resident, marking, token));
            CompletableFuture<Integer> second = CompletableFuture.supplyAsync(() ->
                    putStatus(supervisor, CALLS + "/" + id + "/registros/" + another, marking, token));
            assertThat(List.of(first.join(), second.join())).containsExactlyInAnyOrder(200, 409);
            JsonNode current = read(supervisor, CALLS + "/" + id);
            assertThat(current.path("version").asLong()).isEqualTo(1);
            assertThat(current.path("summary").path("unmarked").asInt()).isEqualTo(1);
            assertThat(count("sager_night_call")).isEqualTo(1);
        }
    }

    @Test
    void expiryBatchRollsBackEveryRecordAndUsesOneCorrelationWhenSuccessful() throws Exception {
        UUID other = resident("OPS-EXPIRY", LocalDate.of(2009, 1, 1), true);
        account("other", "residente");
        provisioning.linkResident("other@example.invalid", other);
        try (HttpClient student = logged("student"); HttpClient another = logged("other");
                HttpClient supervisor = logged("supervisor")) {
            UUID first = UUID.fromString(createExit(student, "NOW", 0, 3600).path("id").asText());
            UUID second = UUID.fromString(createExit(another, "NOW", 0, 3600).path("id").asText());
            UUID failLast = jdbc.query("SELECT id FROM sager_short_exit ORDER BY resident_id, id",
                    (result, row) -> result.getObject(1, UUID.class)).getLast();
            jdbc.execute("CREATE FUNCTION reject_ops_batch() RETURNS TRIGGER AS $$ BEGIN IF NEW.origin = 'SYSTEM_JOB'"
                    + " AND NEW.resource_id = '" + failLast + "'::uuid THEN RAISE EXCEPTION 'synthetic batch rollback';"
                    + " END IF; RETURN NEW; END; $$ LANGUAGE plpgsql");
            jdbc.execute("CREATE TRIGGER reject_ops_batch BEFORE INSERT ON sager_audit_event"
                    + " FOR EACH ROW EXECUTE FUNCTION reject_ops_batch()");
            clock.set(START.plusSeconds(3600));
            try {
                assertThatThrownBy(this::expire).isInstanceOf(java.lang.reflect.InvocationTargetException.class);
                Logger taskLogger = (Logger) LoggerFactory.getLogger(ShortExitExpiryScheduler.class);
                ListAppender<ILoggingEvent> messages = new ListAppender<>();
                messages.start();
                taskLogger.addAppender(messages);
                try {
                    ShortExitExpiryScheduler scheduler = new ShortExitExpiryScheduler(
                            context.getBean(ShortExitExpiryService.class));
                    assertThatCode(scheduler::expire).doesNotThrowAnyException();
                    assertThat(messages.list).hasSize(1);
                    assertThat(messages.list.getFirst().getFormattedMessage()).contains("exceptionType=")
                            .doesNotContain("synthetic batch rollback", "Motivo sintético", "Estudante");
                    assertThat(messages.list.getFirst().getThrowableProxy()).isNull();
                } finally {
                    taskLogger.detachAppender(messages);
                    messages.stop();
                }
                for (UUID id : List.of(first, second)) {
                    JsonNode unchanged = read(supervisor, EXITS + "/" + id);
                    assertThat(unchanged.path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
                    assertThat(unchanged.path("version").asLong()).isZero();
                    assertThat(unchanged.path("history").size()).isEqualTo(1);
                }
                assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE origin = 'SYSTEM_JOB'"
                        + " AND resource_id IN (?, ?)", Integer.class, first, second)).isZero();
            } finally {
                jdbc.execute("DROP TRIGGER reject_ops_batch ON sager_audit_event");
                jdbc.execute("DROP FUNCTION reject_ops_batch()");
            }
            expire();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE origin = 'SYSTEM_JOB'"
                    + " AND resource_id IN (?, ?)", Integer.class, first, second)).isEqualTo(2);
            assertThat(jdbc.queryForObject("SELECT COUNT(DISTINCT request_id) FROM sager_audit_event"
                    + " WHERE origin = 'SYSTEM_JOB' AND resource_id IN (?, ?)", Integer.class, first, second))
                    .isEqualTo(1);
        }
    }

    @Test
    void rejectsMalformedUntrustedBodiesAndFuturePhysicalTimeWithoutWrites() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String token = csrf(student);
            for (String body : List.of("[]", "null", "{", "{\"departureMode\":true}",
                    "{\"departureMode\":\"NOW\",\"expectedReturnAt\":false,\"reason\":\"Sintético\"}",
                    "{\"departureMode\":\"NOW\",\"expectedReturnAt\":\"2026-10-01T02:00:00\",\"reason\":\"Sintético\"}",
                    "{\"departureMode\":\"NOW\",\"expectedReturnAt\":\"2026-10-01T02:00:00Z\",\"reason\":123}",
                    "{\"departureMode\":\"NOW\",\"expectedReturnAt\":\"2026-10-01T02:00:00Z\",\"reason\":\"😃😃\"}",
                    "{\"origin\":\"SYSTEM_JOB\",\"actorId\":\"00000000-0000-0000-0000-000000000000\"}")) {
                assertError(postRaw(student, EXITS, body, token), 400, "invalid_input");
            }
            assertThat(count("sager_short_exit")).isZero();
            String id = createExit(student, "NOW", 0, 3600).path("id").asText();
            approve(supervisor, id);
            assertError(post(supervisor, EXITS + "/" + id + "/partida", Map.of("version", 1,
                    "timeMode", "RETROACTIVE", "occurredAt", START.plusSeconds(1).toString(),
                    "justification", "Horário informado ainda futuro")), 400, "invalid_input");
            assertThat(read(supervisor, EXITS + "/" + id).path("version").asLong()).isEqualTo(1);
            provisioning.disable("student@example.invalid");
            assertThat(get(student, EXITS).statusCode()).isEqualTo(401);
            assertThat(read(supervisor, EXITS).size()).isEqualTo(1);
        }
    }

    private List<String> auditFields(UUID id) {
        return jdbc.query("SELECT changed_fields FROM sager_audit_event WHERE resource_id = ? ORDER BY sequence DESC LIMIT 1",
                (result, row) -> List.of((String[]) result.getArray(1).getArray()), id).getFirst();
    }

    private int putStatus(HttpClient client, String path, String body, String token) {
        try {
            return client.send(request(path, token).PUT(HttpRequest.BodyPublishers.ofString(body)).build(),
                    HttpResponse.BodyHandlers.ofString()).statusCode();
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }

    private UUID resident(String enrollment, LocalDate birth, boolean allocated) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident(id, name, enrollment, birth_date) VALUES (?, ?, ?, ?)",
                id, "Estudante Sintético", enrollment, birth);
        if (allocated) {
            jdbc.update("INSERT INTO sager_room_allocation(id, resident_id, room_id, started_at) VALUES (?, ?, ?, ?)",
                    UUID.randomUUID(), id, room, OffsetDateTime.ofInstant(START.minusSeconds(86400), ZoneOffset.UTC));
        }
        return id;
    }

    private void account(String name, String profile) {
        provisioning.create(name + "@example.invalid", "Pessoa Sintética", profile, PASSWORD.toCharArray());
    }

    private HttpClient logged(String name) throws Exception {
        HttpClient client = browser();
        String body = "email=" + URLEncoder.encode(name + "@example.invalid", StandardCharsets.UTF_8)
                + "&password=" + URLEncoder.encode(PASSWORD, StandardCharsets.UTF_8);
        HttpRequest.Builder request = HttpRequest.newBuilder(uri("/api/v1/auth/login"))
                .header("Content-Type", "application/x-www-form-urlencoded").header("X-CSRF-TOKEN", csrf(client));
        assertThat(client.send(request.POST(HttpRequest.BodyPublishers.ofString(body)).build(),
                HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(204);
        return client;
    }

    private HttpClient browser() {
        return HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();
    }

    private JsonNode open(HttpClient client) throws Exception {
        return created(post(client, CALLS, Map.of("accommodationId", accommodation)));
    }

    private Map<String, Object> exitBody(String mode, Instant departure, Instant returning) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("departureMode", mode);
        if (mode.equals("SCHEDULED")) body.put("requestedDepartureAt", departure.toString());
        body.put("expectedReturnAt", returning.toString());
        body.put("reason", "Motivo sintético da saída");
        body.put("notes", "Observação sintética");
        return body;
    }

    private Map<String, Object> editBody(String mode, long departure, long returning, long version) {
        Map<String, Object> body = exitBody(mode, clock.instant().plusSeconds(departure),
                clock.instant().plusSeconds(returning));
        body.put("version", version);
        return body;
    }

    private JsonNode createExit(HttpClient client, String mode, long departure, long returning) throws Exception {
        return created(post(client, EXITS, exitBody(mode, clock.instant().plusSeconds(departure),
                clock.instant().plusSeconds(returning))));
    }

    private void approve(HttpClient client, String id) throws Exception {
        assertThat(post(client, EXITS + "/" + id + "/decisao", Map.of("version", 0, "decision", "APPROVE"))
                .statusCode()).isEqualTo(200);
    }

    private void expire() throws Exception {
        Object service = context.getBean("shortExitExpiryService");
        service.getClass().getMethod("expireDue").invoke(service);
    }

    private int count(String table) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }

    private JsonNode created(HttpResponse<String> response) throws Exception {
        assertThat(response.statusCode()).describedAs(response.body()).isEqualTo(201);
        assertThat(response.headers().firstValue("Cache-Control").orElseThrow()).contains("no-store");
        return json.readTree(response.body());
    }

    private String csrf(HttpClient client) throws Exception {
        return read(client, "/api/v1/auth/csrf").path("token").asText();
    }

    private JsonNode read(HttpClient client, String path) throws Exception {
        HttpResponse<String> response = get(client, path);
        assertThat(response.statusCode()).describedAs(response.body()).isEqualTo(200);
        assertThat(response.headers().firstValue("Cache-Control").orElseThrow()).contains("no-store");
        return json.readTree(response.body());
    }

    private void assertError(HttpResponse<String> response, int status, String code) throws Exception {
        assertThat(response.statusCode()).describedAs(response.body()).isEqualTo(status);
        assertThat(response.headers().firstValue("Cache-Control").orElseThrow()).contains("no-store");
        assertThat(json.readTree(response.body()).path("code").asText()).isEqualTo(code);
    }

    private HttpResponse<String> get(HttpClient client, String path) throws Exception {
        return client.send(HttpRequest.newBuilder(uri(path)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> post(HttpClient client, String path, Map<String, ?> body) throws Exception {
        return postRaw(client, path, json.writeValueAsString(body), csrf(client));
    }

    private HttpResponse<String> postRaw(HttpClient client, String path, String body, String token) throws Exception {
        return client.send(request(path, token).POST(HttpRequest.BodyPublishers.ofString(body)).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> put(HttpClient client, String path, Map<String, ?> body) throws Exception {
        return client.send(request(path, csrf(client)).PUT(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                .build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpRequest.Builder request(String path, String token) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json");
        if (token != null) builder.header("X-CSRF-TOKEN", token);
        return builder;
    }

    private URI uri(String path) {
        return URI.create("http://127.0.0.1:" + port + path);
    }

    private int status(HttpClient client, String path, String body, String token) {
        try {
            return postRaw(client, path, body, token).statusCode();
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }

    @TestConfiguration
    static class TimeConfiguration {
        @Bean @Primary MutableClock testClock() {
            return new MutableClock();
        }

        @Bean LongExitFixture longExitFixture() {
            return new LongExitFixture();
        }
    }

    static class MutableClock extends Clock {
        private volatile Instant value = START;
        void set(Instant instant) { value = instant; }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return Clock.fixed(value, zone); }
        @Override public Instant instant() { return value; }
    }

    static class LongExitFixture implements AuthorizedExitLookup, ExitOccupancyLookup {
        volatile UUID resident;
        volatile boolean overlap;
        volatile boolean physical;
        volatile AuthorizedExitLookup.Reference reference;

        void clear() {
            resident = null;
            overlap = false;
            physical = false;
            reference = null;
        }

        @Override public List<AuthorizedExitLookup.Reference> authorizedFor(UUID residentId, Instant at) {
            return residentId.equals(resident) && reference != null ? List.of(reference) : List.of();
        }

        @Override public boolean physicalOpenFor(UUID residentId) {
            return residentId.equals(resident) && physical;
        }

        @Override public boolean overlaps(UUID residentId, AuthorizedExitLookup.Reference excluded,
                Instant departure, Instant returning, Instant now) {
            return residentId.equals(resident) && overlap;
        }
    }
}
