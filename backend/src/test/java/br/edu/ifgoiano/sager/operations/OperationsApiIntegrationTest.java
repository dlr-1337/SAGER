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
import br.edu.ifgoiano.sager.auth.LocalAccountPrincipal;
import br.edu.ifgoiano.sager.operations.shortexits.ShortExit;
import br.edu.ifgoiano.sager.operations.shortexits.ShortExitService;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
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
    @Autowired private ShortExitService shortExits;
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
    void legacyListsBindNameAndEnrollmentSearch() throws Exception {
        UUID exitId;
        try (HttpClient student = logged("student")) {
            exitId = UUID.fromString(createExit(student, "NOW", 0).path("id").asText());
        }
        UUID actorId = jdbc.queryForObject("SELECT id FROM sager_local_account WHERE email=?",
                UUID.class, "supervisor@example.invalid");
        var principal = new LocalAccountPrincipal(actorId, "supervisor@example.invalid",
                "Supervisor Sintético", "supervisor", null, null, "TESTE-SUPERVISOR");
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, List.of()));
        try {
            for (String query : new String[] {"  ESTUDANTE sintetico  ", "  ops-a  ", null, "   "}) {
                assertThat(shortExits.list(null, query, null)).extracting(ShortExit::id)
                        .containsExactly(exitId);
                assertThat(shortExits.list(resident, query, "AGUARDANDO_ANALISE"))
                        .extracting(ShortExit::id).containsExactly(exitId);
            }
            assertThat(shortExits.list(null, "Sem correspondência", null)).isEmpty();
            assertThat(shortExits.list(null, "%", null)).isEmpty();
            assertThat(shortExits.list(UUID.randomUUID(), "sintetico", null)).isEmpty();
            assertThat(shortExits.list(resident, "OPS-A", "CANCELADA")).isEmpty();
        } finally {
            SecurityContextHolder.clearContext();
        }
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
    void nightCallLeavesOutAdultAccommodationsWithoutAnAllocatedMinor() throws Exception {
        jdbc.update("UPDATE sager_accommodation SET age_group = 'MENORES' WHERE id = ?", accommodation);
        UUID adults = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_accommodation(id, code, name, age_group) VALUES (?, 'OPS-MAI', 'Maiores', 'MAIORES')",
                adults);
        UUID adultRoom = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_room(id, code, number, accommodation_id, capacity, situation)"
                + " VALUES (?, 'OPS-M1', 'M1', ?, 4, 'Disponível')", adultRoom, adults);
        UUID adult = resident("OPS-MAIOR", LocalDate.of(2000, 1, 1), false);
        jdbc.update("INSERT INTO sager_room_allocation(id, resident_id, room_id) VALUES (?, ?, ?)",
                UUID.randomUUID(), adult, adultRoom);
        UUID free = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_accommodation(id, code, name) VALUES (?, 'OPS-LIVRE', 'Sem faixa')", free);
        try (HttpClient supervisor = logged("supervisor")) {
            List<String> listed = new java.util.ArrayList<>();
            read(supervisor, CALLS + "/contexto").path("accommodations")
                    .forEach(option -> listed.add(option.path("id").asText()));
            assertThat(listed).containsExactlyInAnyOrder(accommodation.toString(), free.toString());
            assertError(get(supervisor, CALLS + "/contexto?accommodationId=" + adults), 422, "invalid_reference");
            assertError(post(supervisor, CALLS, Map.of("accommodationId", adults)), 422, "invalid_reference");
            assertThat(count("sager_night_call")).isZero();
        }
    }

    @Test
    void minorAllocatedBeforeTheGroupChangeKeepsTheAdultAccommodationInTheNightCall() throws Exception {
        jdbc.update("UPDATE sager_resident SET birth_date = '2010-03-01' WHERE id = ?", resident);
        try (HttpClient supervisor = logged("supervisor")) {
            assertThat(put(supervisor, "/api/v1/alojamentos/" + accommodation, Map.of("code", "OPS",
                    "name", "Sintético", "ageGroup", "MAIORES", "version", 0)).statusCode()).isEqualTo(200);
            List<String> listed = new java.util.ArrayList<>();
            read(supervisor, CALLS + "/contexto").path("accommodations")
                    .forEach(option -> listed.add(option.path("id").asText()));
            assertThat(listed).contains(accommodation.toString());
            JsonNode opened = open(supervisor);
            assertThat(opened.path("records").size()).isEqualTo(1);
            assertThat(opened.path("records").get(0).path("residentId").asText()).isEqualTo(resident.toString());
            String id = opened.path("id").asText();
            assertThat(put(supervisor, CALLS + "/" + id + "/registros/" + resident,
                    Map.of("mark", "PRESENTE", "version", 0)).statusCode()).isEqualTo(200);
            assertThat(post(supervisor, CALLS + "/" + id + "/fechamento", Map.of("version", 1))
                    .statusCode()).isEqualTo(200);
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
    void exitListFiltersByRoomAndAccommodationAllocatedAtRequestedDeparture() throws Exception {
        String exitId;
        try (HttpClient student = logged("student")) {
            exitId = createExit(student, "NOW", 0).path("id").asText();
        }
        UUID laterAccommodation = UUID.randomUUID();
        UUID laterRoom = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_accommodation(id, code, name) VALUES (?, 'OPS-B', 'Sintético B')",
                laterAccommodation);
        jdbc.update("INSERT INTO sager_room(id, code, number, accommodation_id, capacity, situation)"
                + " VALUES (?, 'OPS-B-1', '1', ?, 30, 'Disponível')", laterRoom, laterAccommodation);
        OffsetDateTime moved = OffsetDateTime.ofInstant(START.plusSeconds(3600), ZoneOffset.UTC);
        jdbc.update("UPDATE sager_room_allocation SET ended_at = ?, end_reason = 'END' WHERE resident_id = ?",
                moved, resident);
        jdbc.update("INSERT INTO sager_room_allocation(id, resident_id, room_id, started_at) VALUES (?, ?, ?, ?)",
                UUID.randomUUID(), resident, laterRoom, moved);
        UUID unit = UUID.randomUUID();
        UUID laterUnit = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_accommodation_unit(id, accommodation_id, code, name) VALUES (?, ?, 'BL-A', 'Bloco A')",
                unit, accommodation);
        jdbc.update("INSERT INTO sager_accommodation_unit(id, accommodation_id, code, name) VALUES (?, ?, 'BL-A', 'Bloco A')",
                laterUnit, laterAccommodation);
        jdbc.update("UPDATE sager_room SET unit_id = ? WHERE id = ?", unit, room);
        jdbc.update("UPDATE sager_room SET unit_id = ? WHERE id = ?", laterUnit, laterRoom);
        try (HttpClient supervisor = logged("supervisor")) {
            assertThat(read(supervisor, EXITS + "?roomId=" + room).get(0).path("id").asText()).isEqualTo(exitId);
            assertThat(read(supervisor, EXITS + "?roomId=" + laterRoom).size()).isZero();
            assertThat(read(supervisor, EXITS + "?accommodationId=" + accommodation).size()).isEqualTo(1);
            assertThat(read(supervisor, EXITS + "?accommodationId=" + laterAccommodation).size()).isZero();
            assertThat(read(supervisor, EXITS + "?unitId=" + unit).get(0).path("id").asText()).isEqualTo(exitId);
            assertThat(get(supervisor, EXITS + "?unitId=" + unit + "&limit=25").headers().firstValue("X-Total-Count"))
                    .contains("1");
            assertThat(get(supervisor, EXITS + "?unitId=" + laterUnit + "&limit=25").headers().firstValue("X-Total-Count"))
                    .contains("0");
            assertThat(get(supervisor, EXITS + "?unitId=invalido").statusCode()).isEqualTo(400);
            assertThat(get(supervisor, EXITS + "?roomId=invalido").statusCode()).isEqualTo(400);
        }
        UUID neighbor = resident("OPS-B", LocalDate.of(2009, 1, 1), true);
        account("neighbor", "residente");
        provisioning.linkResident("neighbor@example.invalid", neighbor);
        try (HttpClient other = logged("neighbor")) {
            assertThat(read(other, EXITS + "?roomId=" + room).size()).isZero();
        }
    }

    @Test
    void overdueShortExitsComeFirstAndHaveTheirOwnStatusFilter() throws Exception {
        UUID second = resident("OPS-SECOND", LocalDate.of(2009, 1, 1), true);
        UUID third = resident("OPS-THIRD", LocalDate.of(2009, 1, 1), true);
        account("second", "residente");
        account("third", "residente");
        provisioning.linkResident("second@example.invalid", second);
        provisioning.linkResident("third@example.invalid", third);
        try (HttpClient student = logged("student"); HttpClient secondStudent = logged("second");
                HttpClient thirdStudent = logged("third"); HttpClient supervisor = logged("supervisor")) {
            // A mais antiga sai em START e deve voltar até START + 3 h.
            String overdue = createExit(student, "NOW", 0).path("id").asText();
            depart(supervisor, overdue);
            clock.set(START.plusSeconds(3600));
            String onTime = createExit(secondStudent, "NOW", 0).path("id").asText();
            depart(supervisor, onTime);
            clock.set(START.plusSeconds(7200));
            String waiting = createExit(thirdStudent, "NOW", 0).path("id").asText();
            // Antes do retorno previsto, a ordem é do pedido mais novo ao mais antigo.
            clock.set(START.plusSeconds(10799));
            assertThat(ids(read(supervisor, EXITS))).containsExactly(waiting, onTime, overdue);
            assertThat(ids(read(supervisor, EXITS + "?status=ATRASADA"))).isEmpty();
            assertThat(ids(read(supervisor, EXITS + "?status=EM_ANDAMENTO"))).containsExactly(onTime, overdue);
            // No retorno previsto exato, pelo relógio da aplicação, ela já está atrasada e sobe para o topo.
            clock.set(START.plusSeconds(10800));
            assertThat(ids(read(supervisor, EXITS))).containsExactly(overdue, waiting, onTime);
            assertThat(ids(read(supervisor, EXITS + "?limit=1"))).containsExactly(overdue);
            // Com busca, a ordem da busca vem antes e o relógio ocupa o parâmetro certo.
            assertThat(ids(read(supervisor, EXITS + "?search=sintetico&limit=25")))
                    .containsExactly(overdue, waiting, onTime);
            assertThat(ids(read(supervisor, EXITS + "?search=ops-second&status=EM_ANDAMENTO")))
                    .containsExactly(onTime);
            HttpResponse<String> late = get(supervisor, EXITS + "?status=ATRASADA&limit=25");
            assertThat(late.statusCode()).describedAs(late.body()).isEqualTo(200);
            assertThat(late.headers().firstValue("X-Total-Count")).contains("1");
            assertThat(ids(json.readTree(late.body()))).containsExactly(overdue);
            HttpResponse<String> inProgress = get(supervisor, EXITS + "?status=EM_ANDAMENTO&limit=25");
            assertThat(inProgress.headers().firstValue("X-Total-Count")).contains("1");
            assertThat(ids(json.readTree(inProgress.body()))).containsExactly(onTime);
            assertThat(ids(read(supervisor, EXITS + "?status=AGUARDANDO_ANALISE"))).containsExactly(waiting);
            // A situação gravada não muda: continua em andamento até o registro da volta.
            assertThat(read(supervisor, EXITS + "/" + overdue).path("status").asText()).isEqualTo("EM_ANDAMENTO");
            assertThat(jdbc.queryForObject("SELECT status FROM sager_short_exit WHERE id = ?", String.class,
                    UUID.fromString(overdue))).isEqualTo("EM_ANDAMENTO");
            // O residente filtra só as próprias saídas.
            assertThat(ids(read(student, EXITS + "?status=ATRASADA"))).containsExactly(overdue);
            assertThat(ids(read(secondStudent, EXITS + "?status=ATRASADA"))).isEmpty();
            assertThat(ids(read(secondStudent, EXITS + "?status=EM_ANDAMENTO"))).containsExactly(onTime);
            // Um instante enviado na consulta não substitui o relógio da aplicação.
            assertThat(ids(read(supervisor, EXITS + "?overdueAt=2000-01-01T00:00:00Z")))
                    .containsExactly(overdue, waiting, onTime);
            assertThat(ids(read(supervisor, EXITS + "?status=ATRASADA&overdueAt=2999-01-01T00:00:00Z")))
                    .containsExactly(overdue);
            assertThat(get(supervisor, EXITS + "?status=ADIADA").statusCode()).isEqualTo(400);
            // Com a volta registrada, ela deixa de estar atrasada e volta à ordem do pedido.
            clock.set(START.plusSeconds(10800 + 600));
            assertThat(post(supervisor, EXITS + "/" + overdue + "/retorno", Map.of("version", 1,
                    "timeMode", "NOW", "lateObservation", "Retorno conferido após atraso sintético"))
                    .statusCode()).isEqualTo(200);
            assertThat(ids(read(supervisor, EXITS + "?status=ATRASADA"))).isEmpty();
            assertThat(ids(read(supervisor, EXITS + "?status=RETORNO_CONFIRMADO_COM_ATRASO")))
                    .containsExactly(overdue);
            assertThat(ids(read(supervisor, EXITS))).containsExactly(waiting, onTime, overdue);
        }
    }

    @Test
    void shortExitDerivesOwnerUsesServerNowAndSetsThreeHours() throws Exception {
        try (HttpClient student = logged("student")) {
            assertThat(read(student, EXITS + "/elegibilidade").path("eligible").asBoolean()).isTrue();
            Map<String, Object> body = exitBody("NOW", clock.instant());
            body.put("residentId", UUID.randomUUID());
            assertError(post(student, EXITS, body), 400, "invalid_input");
            body.remove("residentId");
            body.put("requestedDepartureAt", clock.instant().minusSeconds(900).toString());
            assertError(post(student, EXITS, body), 400, "invalid_input");
            body.remove("requestedDepartureAt");
            body.put("expectedReturnAt", clock.instant().plusSeconds(10801).toString());
            assertError(post(student, EXITS, body), 400, "invalid_input");
            body.remove("expectedReturnAt");
            JsonNode saved = created(post(student, EXITS, body));
            assertThat(Instant.parse(saved.path("expectedReturnAt").asText()))
                    .isEqualTo(clock.instant().plusSeconds(10800));
            assertThat(saved.path("residentId").asText()).isEqualTo(resident.toString());
            assertThat(Instant.parse(saved.path("requestedDepartureAt").asText())).isEqualTo(clock.instant());
            assertThat(saved.path("actualDepartureAt").isNull()).isTrue();
            assertThat(saved.path("version").asLong()).isZero();
            assertThat(saved.path("departureMode").asText()).isEqualTo("NOW");
            // A saída curta é sempre para agora: a agendada, passada ou futura, é recusada.
            assertError(post(student, EXITS, exitBody("SCHEDULED", clock.instant().minusSeconds(1))),
                    400, "invalid_input");
            assertError(post(student, EXITS, exitBody("SCHEDULED", clock.instant().plusSeconds(4 * 3600))),
                    400, "invalid_input");
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
            String id = createExit(student, "NOW", 0).path("id").asText();
            assertThat(get(anonymous, EXITS).statusCode()).isEqualTo(401);
            assertThat(get(gestor, CALLS + "/contexto?accommodationId=" + accommodation).statusCode())
                    .isEqualTo(403);
            assertThat(get(gestor, EXITS).statusCode()).isEqualTo(403);
            assertThat(get(student, CALLS + "/contexto?accommodationId=" + accommodation).statusCode())
                    .isEqualTo(403);
            assertThat(read(another, EXITS).size()).isZero();
            assertError(get(another, EXITS + "/" + id), 404, "not_found");
            assertError(put(another, EXITS + "/" + id,
                    editBody("NOW", 0, 0)), 404, "not_found");
            assertThat(postRaw(student, EXITS, json.writeValueAsString(exitBody("NOW", clock.instant())), null)
                    .statusCode()).isEqualTo(403);
            assertThat(post(student, EXITS + "/" + id + "/decisao",
                    Map.of("decision", "REJECT", "version", 0, "comment", "Motivo de recusa sintético"))
                    .statusCode()).isEqualTo(403);
            // Só o supervisor registra a saída, que libera o pedido.
            assertThat(post(student, EXITS + "/" + id + "/partida",
                    Map.of("version", 0, "timeMode", "NOW")).statusCode()).isEqualTo(403);
            assertThat(post(gestor, EXITS + "/" + id + "/partida",
                    Map.of("version", 0, "timeMode", "NOW")).statusCode()).isEqualTo(403);
            assertError(post(supervisor, EXITS + "/" + id + "/decisao",
                    Map.of("decision", "REJECT", "version", 1, "comment", "Motivo de recusa sintético")),
                    409, "stale_version");
            assertError(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 1, "timeMode", "NOW")), 409, "stale_version");
            assertThat(read(supervisor, EXITS + "/" + id).path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
            assertThat(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 0, "timeMode", "NOW")).statusCode()).isEqualTo(200);
            assertError(put(student, EXITS + "/" + id, editBody("NOW", 0, 1)),
                    409, "invalid_state");
        }
    }

    @Test
    void rejectsAdultUnallocatedAndUnlinkedResidents() throws Exception {
        jdbc.update("UPDATE sager_resident SET birth_date = DATE '2008-09-30' WHERE id = ?", resident);
        account("unlinked", "residente");
        try (HttpClient student = logged("student"); HttpClient unlinked = logged("unlinked")) {
            assertThat(read(student, EXITS + "/elegibilidade").path("eligible").asBoolean()).isFalse();
            assertError(post(student, EXITS, exitBody("NOW", clock.instant())), 409, "not_eligible");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_short_exit", Integer.class)).isZero();
            assertError(get(unlinked, EXITS + "/elegibilidade"), 403, "resident_link_required");
            jdbc.update("UPDATE sager_resident SET birth_date = DATE '2009-01-01' WHERE id = ?", resident);
            jdbc.update("UPDATE sager_room_allocation SET ended_at = started_at, end_reason = 'END'");
            assertError(post(student, EXITS, exitBody("NOW", clock.instant())), 409, "not_eligible");
        }
    }

    @Test
    void eveOfEighteenthBirthdayInSaoPauloIsStillEligibleAlthoughUtcIsTheNextDay() throws Exception {
        // START é 22h de 30/09/2026 em Brasília e já 01/10 em UTC.
        jdbc.update("UPDATE sager_resident SET birth_date = DATE '2008-10-01' WHERE id = ?", resident);
        try (HttpClient student = logged("student")) {
            JsonNode eligibility = read(student, EXITS + "/elegibilidade");
            assertThat(eligibility.path("eligible").asBoolean()).isTrue();
            assertThat(eligibility.path("blockers")).isEmpty();
        }
    }

    @Test
    void permitsOwnPendingCancellationAndSupervisorRejectionWithReasons() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String id = createExit(student, "NOW", 0).path("id").asText();
            assertError(post(supervisor, EXITS + "/" + id + "/decisao",
                    Map.of("decision", "REJECT", "version", 0, "comment", "breve")),
                    400, "invalid_input");
            assertThat(read(supervisor, EXITS + "/" + id).path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
            JsonNode rejected = json.readTree(post(supervisor, EXITS + "/" + id + "/decisao",
                    Map.of("decision", "REJECT", "version", 0, "comment", "Motivo de recusa sintético")).body());
            assertThat(rejected.path("status").asText()).isEqualTo("REJEITADA");
            assertThat(rejected.path("decision").asText()).isEqualTo("REJECT");
            assertThat(rejected.path("decisionComment").asText()).isEqualTo("Motivo de recusa sintético");
            String next = createExit(student, "NOW", 0).path("id").asText();
            assertThat(post(student, EXITS + "/" + next + "/cancelamento",
                    Map.of("version", 0, "comment", "Solicitação cancelada pelo estudante"))
                    .statusCode()).isEqualTo(200);
            assertThat(read(student, EXITS + "/" + next).path("status").asText()).isEqualTo("CANCELADA");
            // Saída aprovada antes de 20/11/2026: só o supervisor ainda a cancela.
            String approved = createExit(student, "NOW", 0).path("id").asText();
            legacyApprove(approved, clock.instant());
            assertError(post(student, EXITS + "/" + approved + "/cancelamento",
                    Map.of("version", 1, "comment", "Cancelamento após análise presencial")),
                    409, "invalid_state");
            assertThat(post(supervisor, EXITS + "/" + approved + "/cancelamento",
                    Map.of("version", 1, "comment", "Cancelamento antes da partida física"))
                    .statusCode()).isEqualTo(200);
        }
    }

    @Test
    void requestWithoutDepartureModeIsForNowOnTheServerClock() throws Exception {
        try (HttpClient student = logged("student")) {
            clock.set(START.plusSeconds(600));
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("reason", "Motivo sintético da saída");
            JsonNode saved = created(post(student, EXITS, body));
            assertThat(saved.path("departureMode").asText()).isEqualTo("NOW");
            assertThat(saved.path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
            assertThat(Instant.parse(saved.path("requestedDepartureAt").asText())).isEqualTo(clock.instant());
            assertThat(Instant.parse(saved.path("expectedReturnAt").asText()))
                    .isEqualTo(clock.instant().plusSeconds(10800));
            assertThat(saved.path("decision").isNull()).isTrue();
            // A edição também dispensa o modo e grava de novo a hora do servidor.
            clock.set(START.plusSeconds(900));
            body.put("version", 0);
            body.put("reason", "Novo motivo sintético da saída");
            HttpResponse<String> response = put(student, EXITS + "/" + saved.path("id").asText(), body);
            assertThat(response.statusCode()).describedAs(response.body()).isEqualTo(200);
            JsonNode edited = json.readTree(response.body());
            assertThat(edited.path("departureMode").asText()).isEqualTo("NOW");
            assertThat(edited.path("version").asLong()).isEqualTo(1);
            assertThat(Instant.parse(edited.path("requestedDepartureAt").asText())).isEqualTo(clock.instant());
            assertThat(Instant.parse(edited.path("expectedReturnAt").asText()))
                    .isEqualTo(clock.instant().plusSeconds(10800));
        }
    }

    @Test
    void scheduledRequestOrDeviceDepartureTimeIsRefusedWithoutWrites() throws Exception {
        try (HttpClient student = logged("student")) {
            String audits = "SELECT COUNT(*) FROM sager_audit_event WHERE resource = 'SHORT_EXIT'";
            int auditsBefore = jdbc.queryForObject(audits, Integer.class);
            // Agendada para daqui a 2 horas: o residente ganharia tempo extra.
            Map<String, Object> scheduled = exitBody("SCHEDULED", clock.instant().plusSeconds(2 * 3600));
            assertError(post(student, EXITS, scheduled), 400, "invalid_input");
            scheduled.remove("requestedDepartureAt");
            assertError(post(student, EXITS, scheduled), 400, "invalid_input");
            // O horário do aparelho nunca vale, com ou sem o modo.
            Map<String, Object> sentTime = exitBody("NOW", clock.instant());
            sentTime.put("requestedDepartureAt", clock.instant().plusSeconds(3600).toString());
            assertError(post(student, EXITS, sentTime), 400, "invalid_input");
            sentTime.remove("departureMode");
            assertError(post(student, EXITS, sentTime), 400, "invalid_input");
            sentTime.put("requestedDepartureAt", clock.instant().toString());
            assertError(post(student, EXITS, sentTime), 400, "invalid_input");
            assertThat(count("sager_short_exit")).isZero();
            assertThat(count("sager_short_exit_history")).isZero();
            assertThat(jdbc.queryForObject(audits, Integer.class)).isEqualTo(auditsBefore);
            // A edição segue a mesma regra e não muda o pedido.
            String id = createExit(student, "NOW", 0).path("id").asText();
            clock.set(START.plusSeconds(300));
            assertError(put(student, EXITS + "/" + id, editBody("SCHEDULED", 3600, 0)), 400, "invalid_input");
            Map<String, Object> edit = editBody("NOW", 0, 0);
            edit.put("requestedDepartureAt", clock.instant().plusSeconds(3600).toString());
            assertError(put(student, EXITS + "/" + id, edit), 400, "invalid_input");
            edit.remove("departureMode");
            assertError(put(student, EXITS + "/" + id, edit), 400, "invalid_input");
            JsonNode unchanged = read(student, EXITS + "/" + id);
            assertThat(unchanged.path("version").asLong()).isZero();
            assertThat(unchanged.path("departureMode").asText()).isEqualTo("NOW");
            assertThat(Instant.parse(unchanged.path("requestedDepartureAt").asText())).isEqualTo(START);
            assertThat(unchanged.path("history").size()).isEqualTo(1);
        }
    }

    @Test
    void approvalDecisionIsRefusedAndTheShortExitKeepsWaitingForTheDeparture() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String id = createExit(student, "NOW", 0).path("id").asText();
            HttpResponse<String> refused = post(supervisor, EXITS + "/" + id + "/decisao",
                    Map.of("version", 0, "decision", "APPROVE"));
            assertError(refused, 400, "invalid_input");
            assertThat(json.readTree(refused.body()).path("message").asText())
                    .isEqualTo("Para liberar a saída curta, registre a saída.");
            HttpResponse<String> commented = post(supervisor, EXITS + "/" + id + "/decisao",
                    Map.of("version", 0, "decision", "APPROVE", "comment", "Liberação avulsa sintética"));
            assertError(commented, 400, "invalid_input");
            assertThat(json.readTree(commented.body()).path("message").asText())
                    .isEqualTo("Para liberar a saída curta, registre a saída.");
            JsonNode unchanged = read(supervisor, EXITS + "/" + id);
            assertThat(unchanged.path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
            assertThat(unchanged.path("version").asLong()).isZero();
            assertThat(unchanged.path("decision").isNull()).isTrue();
            assertThat(unchanged.path("decidedAt").isNull()).isTrue();
            assertThat(unchanged.path("history").size()).isEqualTo(1);
            // A decisão continua disponível, mas só para rejeitar.
            assertThat(unchanged.path("capabilities").path("canDecide").asBoolean()).isTrue();
            assertThat(unchanged.path("capabilities").path("canDepart").asBoolean()).isTrue();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE resource = 'SHORT_EXIT'"
                    + " AND resource_id = ? AND action = 'UPDATE'", Integer.class, UUID.fromString(id))).isZero();
        }
    }

    @Test
    void departureOfAPendingRequestReleasesAndStartsTheExitInOneAct() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String id = createExit(student, "NOW", 0).path("id").asText();
            JsonNode waiting = read(supervisor, EXITS + "/" + id);
            assertThat(waiting.path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
            assertThat(waiting.path("capabilities").path("canDepart").asBoolean()).isTrue();
            assertThat(waiting.path("capabilities").path("canDecide").asBoolean()).isTrue();
            assertThat(waiting.path("capabilities").path("canReturn").asBoolean()).isFalse();
            JsonNode own = read(student, EXITS + "/" + id).path("capabilities");
            assertThat(own.path("canDepart").asBoolean()).isFalse();
            assertThat(own.path("canDecide").asBoolean()).isFalse();
            assertThat(own.path("canEdit").asBoolean()).isTrue();
            // O residente se apresenta 20 minutos depois: só então a saída começa e o prazo conta.
            Instant inPerson = START.plusSeconds(1200);
            clock.set(inPerson);
            HttpResponse<String> response = post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 0, "timeMode", "NOW"));
            assertThat(response.statusCode()).describedAs(response.body()).isEqualTo(200);
            JsonNode departed = json.readTree(response.body());
            assertThat(departed.path("status").asText()).isEqualTo("EM_ANDAMENTO");
            assertThat(departed.path("decision").asText()).isEqualTo("APPROVE");
            assertThat(departed.path("version").asLong()).isEqualTo(1);
            assertThat(Instant.parse(departed.path("requestedDepartureAt").asText())).isEqualTo(START);
            assertThat(Instant.parse(departed.path("actualDepartureAt").asText())).isEqualTo(inPerson);
            assertThat(Instant.parse(departed.path("decidedAt").asText())).isEqualTo(inPerson);
            assertThat(Instant.parse(departed.path("expectedReturnAt").asText())).isEqualTo(inPerson.plusSeconds(10800));
            assertThat(departed.path("capabilities").path("canDepart").asBoolean()).isFalse();
            assertThat(departed.path("capabilities").path("canDecide").asBoolean()).isFalse();
            assertThat(departed.path("capabilities").path("canReturn").asBoolean()).isTrue();
            // Um único registro no histórico, sem evento de aprovação.
            JsonNode history = departed.path("history");
            assertThat(history).extracting(event -> event.path("event").asText())
                    .containsExactly("CREATE", "DEPARTURE");
            JsonNode departure = history.get(1);
            assertThat(departure.path("actorProfile").asText()).isEqualTo("supervisor");
            assertThat(departure.path("actorId").asText()).isEqualTo(accountId("supervisor").toString());
            assertThat(departure.path("version").asLong()).isEqualTo(1);
            assertThat(departure.path("status").asText()).isEqualTo("EM_ANDAMENTO");
            assertThat(departure.path("decision").asText()).isEqualTo("APPROVE");
            assertThat(Instant.parse(departure.path("effectiveAt").asText())).isEqualTo(inPerson);
            assertThat(Instant.parse(departure.path("recordedAt").asText())).isEqualTo(inPerson);
            // Uma única auditoria, com a liberação e a partida.
            UUID exitId = UUID.fromString(id);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE resource = 'SHORT_EXIT'"
                    + " AND resource_id = ? AND action = 'UPDATE'", Integer.class, exitId)).isEqualTo(1);
            assertThat(auditFields(exitId)).containsExactly("actualDepartureAt", "decision", "expectedReturnAt", "status");
            assertThat(jdbc.queryForObject("SELECT decided_at = actual_departure_at"
                    + " AND expected_return_at = actual_departure_at + INTERVAL '3 hours'"
                    + " FROM sager_short_exit WHERE id = ?", Boolean.class, exitId)).isTrue();
            assertThat(read(student, EXITS + "/" + id).path("status").asText()).isEqualTo("EM_ANDAMENTO");
        }
    }

    @Test
    void retroactiveDepartureOfAPendingRequestCountsThreeHoursFromTheInformedTime() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String id = createExit(student, "NOW", 0).path("id").asText();
            Instant recorded = START.plusSeconds(1200);
            Instant retroactive = recorded.minusSeconds(600);
            clock.set(recorded);
            // Antes do pedido: recusada, e o pedido continua esperando.
            assertError(post(supervisor, EXITS + "/" + id + "/partida", Map.of("version", 0,
                    "timeMode", "RETROACTIVE", "occurredAt", START.minusSeconds(60).toString(),
                    "justification", "Saída conferida no livro da portaria")), 400, "invalid_input");
            JsonNode waiting = read(supervisor, EXITS + "/" + id);
            assertThat(waiting.path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
            assertThat(waiting.path("version").asLong()).isZero();
            assertThat(waiting.path("history").size()).isEqualTo(1);
            HttpResponse<String> response = post(supervisor, EXITS + "/" + id + "/partida", Map.of("version", 0,
                    "timeMode", "RETROACTIVE", "occurredAt", retroactive.toString(),
                    "justification", "Saída conferida no livro da portaria"));
            assertThat(response.statusCode()).describedAs(response.body()).isEqualTo(200);
            JsonNode departed = json.readTree(response.body());
            assertThat(departed.path("status").asText()).isEqualTo("EM_ANDAMENTO");
            assertThat(departed.path("version").asLong()).isEqualTo(1);
            assertThat(Instant.parse(departed.path("actualDepartureAt").asText())).isEqualTo(retroactive);
            // A liberação vale desde a partida informada, e as 3 horas contam dela.
            assertThat(Instant.parse(departed.path("decidedAt").asText())).isEqualTo(retroactive);
            assertThat(Instant.parse(departed.path("expectedReturnAt").asText()))
                    .isEqualTo(retroactive.plusSeconds(10800));
            JsonNode history = departed.path("history");
            assertThat(history).extracting(event -> event.path("event").asText())
                    .containsExactly("CREATE", "DEPARTURE");
            assertThat(Instant.parse(history.get(1).path("effectiveAt").asText())).isEqualTo(retroactive);
            assertThat(Instant.parse(history.get(1).path("recordedAt").asText())).isEqualTo(recorded);
            assertThat(history.get(1).path("justification").asText()).isEqualTo("Saída conferida no livro da portaria");
        }
    }

    @Test
    void departureAfterTheEighteenthBirthdayIsRefusedAndTheRequestKeepsWaiting() throws Exception {
        // START é 22h de 30/09/2026 em Brasília: o residente pede aos 17 e faz 18 anos à meia-noite.
        jdbc.update("UPDATE sager_resident SET birth_date = DATE '2008-10-01' WHERE id = ?", resident);
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String id = createExit(student, "NOW", 0).path("id").asText();
            clock.set(START.plusSeconds(7200));
            assertError(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 0, "timeMode", "NOW")), 409, "not_eligible");
            JsonNode waiting = read(supervisor, EXITS + "/" + id);
            assertThat(waiting.path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
            assertThat(waiting.path("version").asLong()).isZero();
            assertThat(waiting.path("actualDepartureAt").isNull()).isTrue();
            assertThat(waiting.path("history").size()).isEqualTo(1);
        }
    }

    @Test
    void pendingRequestCannotStartAfterItsDeadlineAndExpires() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String id = createExit(student, "NOW", 0).path("id").asText();
            clock.set(START.plusSeconds(10799));
            assertThat(read(supervisor, EXITS + "/" + id).path("capabilities").path("canDepart").asBoolean()).isTrue();
            // O prazo do pedido é a hora do pedido mais 3 horas.
            clock.set(START.plusSeconds(10800));
            JsonNode late = read(supervisor, EXITS + "/" + id);
            assertThat(late.path("capabilities").path("canDepart").asBoolean()).isFalse();
            assertThat(late.path("capabilities").path("canDecide").asBoolean()).isFalse();
            assertError(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 0, "timeMode", "NOW")), 409, "deadline_passed");
            assertError(post(supervisor, EXITS + "/" + id + "/partida", Map.of("version", 0,
                    "timeMode", "RETROACTIVE", "occurredAt", START.plusSeconds(600).toString(),
                    "justification", "Saída conferida no livro da portaria")), 409, "deadline_passed");
            JsonNode waiting = read(supervisor, EXITS + "/" + id);
            assertThat(waiting.path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
            assertThat(waiting.path("version").asLong()).isZero();
            expire();
            JsonNode expired = read(supervisor, EXITS + "/" + id);
            assertThat(expired.path("status").asText()).isEqualTo("EXPIRADA");
            assertThat(expired.path("expiryReason").asText()).isEqualTo("RETURN_DEADLINE_PASSED");
        }
    }

    @Test
    void legacyApprovalKeepsTheDepartureAfterTheDecision() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String id = createExit(student, "NOW", 0).path("id").asText();
            // Pedido para 22h aprovado às 22h20, antes desta mudança.
            Instant decided = START.plusSeconds(1200);
            legacyApprove(id, decided);
            clock.set(START.plusSeconds(1800));
            JsonNode approved = read(supervisor, EXITS + "/" + id);
            assertThat(approved.path("status").asText()).isEqualTo("APROVADA");
            assertThat(approved.path("capabilities").path("canDepart").asBoolean()).isTrue();
            assertThat(approved.path("capabilities").path("canDecide").asBoolean()).isFalse();
            assertThat(approved.path("capabilities").path("canCancel").asBoolean()).isTrue();
            assertError(post(supervisor, EXITS + "/" + id + "/partida", Map.of("version", 1,
                    "timeMode", "RETROACTIVE", "occurredAt", START.plusSeconds(600).toString(),
                    "justification", "Saída conferida no livro da portaria")), 400, "invalid_input");
            Instant departure = START.plusSeconds(1500);
            HttpResponse<String> response = post(supervisor, EXITS + "/" + id + "/partida", Map.of("version", 1,
                    "timeMode", "RETROACTIVE", "occurredAt", departure.toString(),
                    "justification", "Saída conferida no livro da portaria"));
            assertThat(response.statusCode()).describedAs(response.body()).isEqualTo(200);
            JsonNode departed = json.readTree(response.body());
            assertThat(departed.path("status").asText()).isEqualTo("EM_ANDAMENTO");
            assertThat(departed.path("version").asLong()).isEqualTo(2);
            assertThat(Instant.parse(departed.path("decidedAt").asText())).isEqualTo(decided);
            assertThat(Instant.parse(departed.path("actualDepartureAt").asText())).isEqualTo(departure);
            assertThat(Instant.parse(departed.path("expectedReturnAt").asText())).isEqualTo(departure.plusSeconds(10800));
            assertThat(departed.path("history")).extracting(event -> event.path("event").asText())
                    .containsExactly("CREATE", "APPROVE", "DEPARTURE");
            assertThat(auditFields(UUID.fromString(id))).containsExactly("actualDepartureAt", "expectedReturnAt", "status");
        }
    }

    @Test
    void approvedRequestToLeaveNowWithoutDepartureExpiresAtTheRequestedDeparturePlusThreeHours() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String id = createExit(student, "NOW", 0).path("id").asText();
            // Aprovada antes de 20/11/2026, sem saída registrada.
            legacyApprove(id, START);
            clock.set(START.plusSeconds(10800));
            assertError(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 1, "timeMode", "NOW")), 409, "deadline_passed");
            expire();
            JsonNode expired = read(supervisor, EXITS + "/" + id);
            assertThat(expired.path("status").asText()).isEqualTo("EXPIRADA");
            assertThat(expired.path("expiryReason").asText()).isEqualTo("APPROVED_WITHOUT_DEPARTURE");
            assertThat(expired.path("actualDepartureAt").isNull()).isTrue();
        }
    }

    @Test
    void scheduledApprovalWaitsForTheSupervisorToRecordTheDepartureFromTheRequestedTime() throws Exception {
        try (HttpClient supervisor = logged("supervisor")) {
            // Saída agendada e aprovada antes de 20/11/2026: continua trabalhável até o prazo.
            String id = legacyScheduled(START.plusSeconds(3600), START);
            legacyApprove(id, START);
            JsonNode approved = read(supervisor, EXITS + "/" + id);
            assertThat(approved.path("status").asText()).isEqualTo("APROVADA");
            assertThat(approved.path("departureMode").asText()).isEqualTo("SCHEDULED");
            assertThat(approved.path("version").asLong()).isEqualTo(1);
            assertThat(approved.path("actualDepartureAt").isNull()).isTrue();
            assertThat(approved.path("capabilities").path("canDepart").asBoolean()).isFalse();
            assertThat(approved.path("capabilities").path("canCancel").asBoolean()).isTrue();
            // Antes da hora marcada, a saída não é registrada.
            assertError(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 1, "timeMode", "NOW")), 400, "invalid_input");
            String other = legacyScheduled(START.plusSeconds(3600 + 10800), START);
            legacyApprove(other, START);
            assertThat(post(supervisor, EXITS + "/" + other + "/cancelamento",
                    Map.of("version", 1, "comment", "Cancelamento antes do horário marcado"))
                    .statusCode()).isEqualTo(200);
            clock.set(START.plusSeconds(3600));
            assertThat(read(supervisor, EXITS + "/" + id).path("capabilities").path("canDepart").asBoolean())
                    .isTrue();
            JsonNode departed = json.readTree(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 1, "timeMode", "NOW")).body());
            assertThat(departed.path("status").asText()).isEqualTo("EM_ANDAMENTO");
            assertThat(departed.path("version").asLong()).isEqualTo(2);
            assertThat(Instant.parse(departed.path("actualDepartureAt").asText())).isEqualTo(clock.instant());
            assertThat(Instant.parse(departed.path("decidedAt").asText())).isEqualTo(START);
            assertThat(Instant.parse(departed.path("expectedReturnAt").asText()))
                    .isEqualTo(clock.instant().plusSeconds(10800));
            assertThat(departed.path("history")).extracting(event -> event.path("event").asText())
                    .containsExactly("CREATE", "APPROVE", "DEPARTURE");
        }
    }

    @Test
    void departureOfAPendingRequestWaitsWhileAnotherExitIsPhysicallyOpen() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String id = createExit(student, "NOW", 0).path("id").asText();
            // Uma saída longa atrasada, ainda sem volta, mantém o residente fora.
            longExits.resident = resident;
            longExits.physical = true;
            assertError(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 0, "timeMode", "NOW")), 409, "physical_exit_conflict");
            JsonNode unchanged = read(supervisor, EXITS + "/" + id);
            assertThat(unchanged.path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
            assertThat(unchanged.path("version").asLong()).isZero();
            assertThat(unchanged.path("decision").isNull()).isTrue();
            assertThat(unchanged.path("decidedAt").isNull()).isTrue();
            assertThat(unchanged.path("actualDepartureAt").isNull()).isTrue();
            assertThat(unchanged.path("history").size()).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE resource = 'SHORT_EXIT'"
                    + " AND resource_id = ? AND action = 'UPDATE'", Integer.class, UUID.fromString(id))).isZero();
            longExits.physical = false;
            depart(supervisor, id);
            assertThat(read(supervisor, EXITS + "/" + id).path("status").asText()).isEqualTo("EM_ANDAMENTO");
        }
    }

    @Test
    void scheduledApprovalWithoutDepartureLeavesTheResidentPendingAtOpening() throws Exception {
        clock.set(START.minusSeconds(3600));
        try (HttpClient supervisor = logged("supervisor")) {
            // Agendada e aprovada antes de 20/11/2026, sem saída registrada.
            String exit = legacyScheduled(START.minusSeconds(1800), START.minusSeconds(3600));
            legacyApprove(exit, START.minusSeconds(3600));
            clock.set(START);
            JsonNode mark = open(supervisor).path("records").get(0);
            assertThat(mark.path("mark").isNull()).isTrue();
            assertThat(mark.path("authorizedExits").size()).isZero();
        }
    }

    @Test
    void physicalTimesRequireJustificationAndLateReturnObservationWithoutAutomaticSanction() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String id = createExit(student, "NOW", 0).path("id").asText();
            Instant departure = START.plusSeconds(600);
            clock.set(departure.plusSeconds(60));
            assertError(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 0, "timeMode", "RETROACTIVE", "occurredAt", departure.toString(),
                            "justification", "breve")), 400, "invalid_input");
            assertError(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 0, "timeMode", "RETROACTIVE", "occurredAt", START.minusSeconds(1).toString(),
                            "justification", "Conferência retroativa presencial")), 400, "invalid_input");
            assertThat(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 0, "timeMode", "RETROACTIVE", "occurredAt", departure.toString(),
                            "justification", "Conferência retroativa presencial")).statusCode()).isEqualTo(200);
            clock.set(departure.plusSeconds(10800 + 600));
            expire();
            assertThat(read(supervisor, EXITS + "/" + id).path("status").asText()).isEqualTo("EM_ANDAMENTO");
            assertError(post(supervisor, EXITS + "/" + id + "/cancelamento",
                    Map.of("version", 1, "comment", "Não pode cancelar após partida")), 409, "invalid_state");
            assertError(post(supervisor, EXITS + "/" + id + "/retorno",
                    Map.of("version", 1, "timeMode", "NOW")), 400, "invalid_input");
            assertThat(post(supervisor, EXITS + "/" + id + "/retorno", Map.of("version", 1,
                    "timeMode", "NOW", "lateObservation", "Retorno conferido após atraso sintético"))
                    .statusCode()).isEqualTo(200);
            JsonNode saved = read(supervisor, EXITS + "/" + id);
            assertThat(saved.path("status").asText()).isEqualTo("RETORNO_CONFIRMADO_COM_ATRASO");
            assertThat(saved.path("history").size()).isEqualTo(3);
            assertThat(Instant.parse(saved.path("actualReturnAt").asText())).isEqualTo(clock.instant());
            assertThat(count("sager_short_exit")).isEqualTo(1);
            assertError(post(supervisor, EXITS + "/" + id + "/retorno",
                    Map.of("version", 1, "timeMode", "NOW", "lateObservation", "Outra confirmação tardia")),
                    409, "stale_version");
        }
    }

    @Test
    void expiresExactDeadlinesWithSystemAuditAndRejectsActionsBeforeSchedulerRuns() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            // Pedido agendado antes de 20/11/2026: o prazo dele é a partida pedida.
            String scheduled = legacyScheduled(START.plusSeconds(3600), START);
            clock.set(START.plusSeconds(3600));
            assertError(post(supervisor, EXITS + "/" + scheduled + "/partida",
                    Map.of("version", 0, "timeMode", "NOW")), 409, "deadline_passed");
            assertError(post(supervisor, EXITS + "/" + scheduled + "/decisao",
                    Map.of("version", 0, "decision", "REJECT", "comment", "Motivo de recusa sintético")),
                    409, "deadline_passed");
            assertThat(read(supervisor, EXITS + "/" + scheduled).path("status").asText())
                    .isEqualTo("AGUARDANDO_ANALISE");
            expire();
            JsonNode expiredScheduled = read(supervisor, EXITS + "/" + scheduled);
            assertThat(expiredScheduled.path("status").asText()).isEqualTo("EXPIRADA");
            assertThat(expiredScheduled.path("expiryReason").asText()).isEqualTo("SCHEDULED_DEPARTURE_PASSED");
            String now = createExit(student, "NOW", 0).path("id").asText();
            clock.set(START.plusSeconds(3600 + 10800));
            expire();
            assertThat(read(supervisor, EXITS + "/" + now).path("status").asText()).isEqualTo("EXPIRADA");
            // Agendada e aprovada antes de 20/11/2026, sem a saída registrada pelo supervisor.
            String approved = legacyScheduled(START.plusSeconds(14400 + 3600), clock.instant());
            legacyApprove(approved, clock.instant());
            clock.set(START.plusSeconds(14400 + 3600 + 10800));
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
            // O pedido que só espera o registro da saída não justifica a ausência.
            String exit = createExit(student, "NOW", 0).path("id").asText();
            clock.set(START);
            JsonNode opened = open(supervisor);
            assertThat(opened.path("records").get(0).path("mark").isNull()).isTrue();
            String call = opened.path("id").asText();
            assertError(put(supervisor, CALLS + "/" + call + "/registros/" + resident,
                    Map.of("version", 0, "mark", "AUSENCIA_JUSTIFICADA")), 409, "authorized_exit_required");
            assertThat(post(supervisor, EXITS + "/" + exit + "/partida", Map.of("version", 0,
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
    void residentOutOnShortExitIsJustifiedBySystemAtOpeningAndClosesWithoutOccurrence() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String exit = departedExit(student, supervisor);
            JsonNode opened = open(supervisor);
            assertThat(opened.path("version").asLong()).isZero();
            assertThat(opened.path("summary").path("justified").asInt()).isEqualTo(1);
            assertThat(opened.path("summary").path("unmarked").asInt()).isZero();
            JsonNode mark = opened.path("records").get(0);
            assertThat(mark.path("mark").asText()).isEqualTo("AUSENCIA_JUSTIFICADA");
            assertThat(mark.path("authorizedExitId").asText()).isEqualTo(exit);
            assertThat(mark.path("authorizedExitType").asText()).isEqualTo("SHORT");
            assertThat(mark.path("version").asLong()).isEqualTo(1);
            UUID actor = jdbc.queryForObject("SELECT id FROM sager_local_account WHERE email=?",
                    UUID.class, "supervisor@example.invalid");
            JsonNode history = mark.path("history");
            assertThat(history.size()).isEqualTo(1);
            assertThat(history.get(0).path("actorProfile").asText()).isEqualTo("sistema");
            assertThat(history.get(0).path("actorId").asText()).isEqualTo(actor.toString());
            assertThat(history.get(0).path("version").asLong()).isEqualTo(1);
            assertThat(history.get(0).path("callVersion").asLong()).isZero();
            assertThat(jdbc.queryForObject("SELECT changed_fields::text FROM sager_audit_event"
                    + " WHERE resource = 'NIGHT_CALL_MARK' AND action = 'UPDATE' AND resource_id = ? AND actor_id = ?",
                    String.class, UUID.fromString(mark.path("id").asText()), actor))
                    .contains("mark", "authorizedExitId", "authorizedExitType");
            assertThat(post(supervisor, CALLS + "/" + opened.path("id").asText() + "/fechamento",
                    Map.of("version", 0)).statusCode()).isEqualTo(200);
            assertThat(count("sager_occurrence")).isZero();
        }
    }

    @Test
    void retroactiveReturnBeforeOpeningBlocksClosingUntilTheMarkIsCorrected() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String exit = departedExit(student, supervisor);
            JsonNode opened = open(supervisor);
            String call = opened.path("id").asText();
            assertThat(opened.path("records").get(0).path("mark").asText()).isEqualTo("AUSENCIA_JUSTIFICADA");
            clock.set(START.plusSeconds(600));
            assertThat(post(supervisor, EXITS + "/" + exit + "/retorno", Map.of("version", 1,
                    "timeMode", "RETROACTIVE", "occurredAt", START.minusSeconds(60).toString(),
                    "justification", "Retorno lançado depois da chamada")).statusCode()).isEqualTo(200);
            assertError(post(supervisor, CALLS + "/" + call + "/fechamento", Map.of("version", 0)),
                    409, "authorized_exit_outdated");
            assertThat(put(supervisor, CALLS + "/" + call + "/registros/" + resident,
                    Map.of("version", 0, "mark", "PRESENTE")).statusCode()).isEqualTo(200);
            assertThat(post(supervisor, CALLS + "/" + call + "/fechamento", Map.of("version", 1)).statusCode())
                    .isEqualTo(200);
        }
    }

    @Test
    void returnBeforeOpeningAndDepartureAfterOpeningStayPending() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String returned = departedExit(student, supervisor);
            clock.set(START.minusSeconds(60));
            assertThat(post(supervisor, EXITS + "/" + returned + "/retorno",
                    Map.of("version", 1, "timeMode", "NOW")).statusCode()).isEqualTo(200);
            // Pedido feito antes da chamada, com a saída registrada só depois da abertura.
            String late = createExit(student, "NOW", 0).path("id").asText();
            clock.set(START);
            JsonNode opened = open(supervisor);
            JsonNode mark = opened.path("records").get(0);
            assertThat(mark.path("mark").isNull()).isTrue();
            assertThat(mark.path("authorizedExits").size()).isZero();
            assertThat(mark.path("history").size()).isZero();
            clock.set(START.plusSeconds(60));
            assertThat(post(supervisor, EXITS + "/" + late + "/partida",
                    Map.of("version", 0, "timeMode", "NOW")).statusCode()).isEqualTo(200);
            assertError(put(supervisor, CALLS + "/" + opened.path("id").asText() + "/registros/" + resident,
                    Map.of("version", 0, "mark", "AUSENCIA_JUSTIFICADA")), 409, "authorized_exit_required");
        }
    }

    @Test
    void moreThanOneValidExitStaysPendingUntilSupervisorChooses() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String exit = departedExit(student, supervisor);
            longExits.resident = resident;
            longExits.reference = new AuthorizedExitLookup.Reference(UUID.randomUUID(), "LONG");
            JsonNode opened = open(supervisor);
            JsonNode mark = opened.path("records").get(0);
            assertThat(mark.path("mark").isNull()).isTrue();
            assertThat(mark.path("authorizedExits").size()).isEqualTo(2);
            String path = CALLS + "/" + opened.path("id").asText() + "/registros/" + resident;
            assertError(put(supervisor, path, Map.of("version", 0, "mark", "AUSENCIA_JUSTIFICADA")),
                    409, "authorized_exit_required");
            JsonNode chosen = json.readTree(put(supervisor, path, Map.of("version", 0, "mark", "AUSENCIA_JUSTIFICADA",
                    "authorizedExitId", UUID.fromString(exit), "authorizedExitType", "SHORT")).body());
            JsonNode history = chosen.path("records").get(0).path("history");
            assertThat(history.size()).isEqualTo(1);
            assertThat(history.get(0).path("actorProfile").asText()).isEqualTo("supervisor");
        }
    }

    @Test
    void supervisorCorrectsAutomaticMarkWhileOpenAndAfterClosing() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            departedExit(student, supervisor);
            String call = open(supervisor).path("id").asText();
            String path = CALLS + "/" + call + "/registros/" + resident;
            JsonNode present = json.readTree(put(supervisor, path, Map.of("version", 0, "mark", "PRESENTE")).body());
            JsonNode mark = present.path("records").get(0);
            assertThat(mark.path("mark").asText()).isEqualTo("PRESENTE");
            assertThat(mark.path("authorizedExitId").isNull()).isTrue();
            assertThat(mark.path("history").size()).isEqualTo(2);
            assertThat(mark.path("history").get(0).path("actorProfile").asText()).isEqualTo("sistema");
            assertThat(mark.path("history").get(1).path("actorProfile").asText()).isEqualTo("supervisor");
            assertThat(put(supervisor, path, Map.of("version", 1, "mark", "AUSENCIA_JUSTIFICADA")).statusCode())
                    .isEqualTo(200);
            assertThat(post(supervisor, CALLS + "/" + call + "/fechamento", Map.of("version", 2)).statusCode())
                    .isEqualTo(200);
            assertThat(count("sager_occurrence")).isZero();
            assertThat(post(supervisor, CALLS + "/" + call + "/correcoes/" + resident, Map.of("version", 3,
                    "mark", "AUSENTE", "justification", "Conferência presencial posterior")).statusCode()).isEqualTo(200);
            assertThat(count("sager_occurrence")).isEqualTo(1);
        }
    }

    @Test
    void concurrentOverlappingRequestsAndReturnsPersistOnlyOneChange() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String token = csrf(student);
            String body = json.writeValueAsString(exitBody("NOW", START));
            CompletableFuture<Integer> first = CompletableFuture.supplyAsync(() -> status(student, EXITS, body, token));
            CompletableFuture<Integer> second = CompletableFuture.supplyAsync(() -> status(student, EXITS, body, token));
            assertThat(List.of(first.join(), second.join())).containsExactlyInAnyOrder(201, 409);
            String id = read(supervisor, EXITS).get(0).path("id").asText();
            depart(supervisor, id);
            clock.set(START.plusSeconds(60));
            String staffToken = csrf(supervisor);
            String returning = "{\"version\":1,\"timeMode\":\"NOW\"}";
            CompletableFuture<Integer> a = CompletableFuture.supplyAsync(() ->
                    status(supervisor, EXITS + "/" + id + "/retorno", returning, staffToken));
            CompletableFuture<Integer> b = CompletableFuture.supplyAsync(() ->
                    status(supervisor, EXITS + "/" + id + "/retorno", returning, staffToken));
            assertThat(List.of(a.join(), b.join())).containsExactlyInAnyOrder(200, 409);
            assertThat(read(supervisor, EXITS + "/" + id).path("history").size()).isEqualTo(3);
        }
    }

    @Test
    void auditFailureRollsBackDomainAndHistoryAndDoesNotRecordClinicalValues() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String id = createExit(student, "NOW", 0).path("id").asText();
            jdbc.execute("CREATE FUNCTION reject_ops_audit() RETURNS TRIGGER AS $$ BEGIN"
                    + " IF NEW.resource IN ('SHORT_EXIT', 'NIGHT_CALL', 'NIGHT_CALL_MARK') THEN"
                    + " RAISE EXCEPTION 'synthetic audit rollback'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql");
            jdbc.execute("CREATE TRIGGER reject_ops_audit BEFORE INSERT ON sager_audit_event"
                    + " FOR EACH ROW EXECUTE FUNCTION reject_ops_audit()");
            try {
                assertThat(post(supervisor, EXITS + "/" + id + "/partida",
                        Map.of("version", 0, "timeMode", "NOW")).statusCode()).isEqualTo(500);
                JsonNode unchanged = read(supervisor, EXITS + "/" + id);
                assertThat(unchanged.path("version").asLong()).isZero();
                assertThat(unchanged.path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
                assertThat(unchanged.path("history").size()).isEqualTo(1);
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
            assertError(post(student, EXITS, exitBody("NOW", START)),
                    409, "overlapping_exit");
            longExits.overlap = false;
            String id = createExit(student, "NOW", 0).path("id").asText();
            clock.set(START.plusSeconds(600));
            longExits.physical = true;
            assertError(post(supervisor, EXITS + "/" + id + "/partida",
                    Map.of("version", 0, "timeMode", "NOW")), 409, "physical_exit_conflict");
            assertThat(read(supervisor, EXITS + "/" + id).path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
        }
    }

    @Test
    void acceptsAuthorizedLongExitReferenceFromRegisteredProvider() throws Exception {
        try (HttpClient supervisor = logged("supervisor")) {
            longExits.resident = resident;
            longExits.reference = new AuthorizedExitLookup.Reference(UUID.randomUUID(), "LONG");
            JsonNode opened = open(supervisor);
            assertThat(opened.path("records").get(0).path("mark").asText()).isEqualTo("AUSENCIA_JUSTIFICADA");
            String id = opened.path("id").asText();
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
            UUID exit = UUID.fromString(createExit(student, "NOW", 0).path("id").asText());
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
            UUID id = UUID.fromString(createExit(student, "NOW", 0).path("id").asText());
            Map<String, Object> body = editBody("NOW", 0, 0);
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
            Map<String, Object> body = exitBody("NOW", START);
            clock.set(START.plusSeconds(600));
            JsonNode created = created(post(student, EXITS, body));
            UUID id = UUID.fromString(created.path("id").asText());
            assertThat(Instant.parse(created.path("requestedDepartureAt").asText())).isEqualTo(clock.instant());
            assertThat(Instant.parse(created.path("expectedReturnAt").asText()))
                    .isEqualTo(clock.instant().plusSeconds(10800));
            clock.set(START.plusSeconds(900));
            body.put("version", 0);
            assertThat(put(student, EXITS + "/" + id, body).statusCode()).isEqualTo(200);
            assertThat(Instant.parse(read(student, EXITS + "/" + id).path("requestedDepartureAt").asText()))
                    .isEqualTo(clock.instant());
            assertThat(auditFields(id)).containsExactly("expectedReturnAt", "requestedDepartureAt");
        }
    }

    @Test
    void recordedDepartureFixesTheReturnThreeHoursLaterWithoutOverlapRefusal() throws Exception {
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String late = createExit(student, "NOW", 0).path("id").asText();
            // Saída agendada e aprovada antes de 20/11/2026, para logo depois do prazo do pedido.
            String next = legacyScheduled(START.plusSeconds(10800 + 1800), START);
            legacyApprove(next, START);
            // Saída registrada 40 min depois do pedido: a janela passa a cruzar a saída seguinte, sem 409.
            clock.set(START.plusSeconds(2400));
            JsonNode departed = json.readTree(post(supervisor, EXITS + "/" + late + "/partida",
                    Map.of("version", 0, "timeMode", "NOW")).body());
            assertThat(departed.path("status").asText()).isEqualTo("EM_ANDAMENTO");
            assertThat(Instant.parse(departed.path("expectedReturnAt").asText()))
                    .isEqualTo(clock.instant().plusSeconds(10800));
            assertThat(auditFields(UUID.fromString(late)))
                    .containsExactly("actualDepartureAt", "decision", "expectedReturnAt", "status");
            clock.set(START.plusSeconds(10800 + 1800));
            assertError(post(supervisor, EXITS + "/" + next + "/partida",
                    Map.of("version", 1, "timeMode", "NOW")), 409, "physical_exit_conflict");
            assertThat(post(supervisor, EXITS + "/" + late + "/retorno",
                    Map.of("version", 1, "timeMode", "NOW")).statusCode()).isEqualTo(200);
            // Partida retroativa: as 3 horas contam do horário informado.
            Instant retroactive = clock.instant().plusSeconds(300);
            clock.set(clock.instant().plusSeconds(900));
            JsonNode retro = json.readTree(post(supervisor, EXITS + "/" + next + "/partida",
                    Map.of("version", 1, "timeMode", "RETROACTIVE", "occurredAt", retroactive.toString(),
                            "justification", "Conferência retroativa presencial")).body());
            assertThat(Instant.parse(retro.path("expectedReturnAt").asText())).isEqualTo(retroactive.plusSeconds(10800));
            // Na aprovada antiga, a decisão já existia: a auditoria não a repete.
            assertThat(auditFields(UUID.fromString(next)))
                    .containsExactly("actualDepartureAt", "expectedReturnAt", "status");
            assertThat(post(supervisor, EXITS + "/" + next + "/retorno",
                    Map.of("version", 2, "timeMode", "NOW")).statusCode()).isEqualTo(200);
            // Pedido para sair agora registrado 50 min depois: o prazo só conta da saída registrada em pessoa.
            String now = createExit(student, "NOW", 0).path("id").asText();
            Instant requested = clock.instant();
            clock.set(requested.plusSeconds(1200));
            JsonNode waiting = read(supervisor, EXITS + "/" + now);
            assertThat(waiting.path("status").asText()).isEqualTo("AGUARDANDO_ANALISE");
            assertThat(Instant.parse(waiting.path("expectedReturnAt").asText()))
                    .isEqualTo(requested.plusSeconds(10800));
            clock.set(requested.plusSeconds(3000));
            JsonNode inPerson = json.readTree(post(supervisor, EXITS + "/" + now + "/partida",
                    Map.of("version", 0, "timeMode", "NOW")).body());
            assertThat(inPerson.path("status").asText()).isEqualTo("EM_ANDAMENTO");
            assertThat(Instant.parse(inPerson.path("decidedAt").asText())).isEqualTo(clock.instant());
            assertThat(Instant.parse(inPerson.path("expectedReturnAt").asText()))
                    .isEqualTo(clock.instant().plusSeconds(10800));
        }
    }

    @Test
    void authorizesThroughExactExpectedReturnButNotWhenAlreadyReturnedAtOpening() throws Exception {
        clock.set(START.minusSeconds(1800));
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String exit = createExit(student, "NOW", 0).path("id").asText();
            depart(supervisor, exit);
            clock.set(START);
            JsonNode opened = open(supervisor);
            assertThat(opened.path("records").get(0).path("authorizedExitId").asText()).isEqualTo(exit);
            String call = opened.path("id").asText();
            assertThat(post(supervisor, CALLS + "/" + call + "/fechamento", Map.of("version", 0))
                    .statusCode()).isEqualTo(200);
            assertThat(post(supervisor, EXITS + "/" + exit + "/retorno",
                    Map.of("version", 1, "timeMode", "NOW")).statusCode()).isEqualTo(200);
            assertError(post(supervisor, CALLS + "/" + call + "/correcoes/" + resident,
                    Map.of("version", 1, "mark", "AUSENCIA_JUSTIFICADA",
                            "justification", "Revisão da autorização no instante")),
                    409, "authorized_exit_required");
        }
    }

    @Test
    void pendingAndPhysicallyLateExitsNeverJustifyNightAbsence() throws Exception {
        clock.set(START.minusSeconds(10801));
        try (HttpClient student = logged("student"); HttpClient supervisor = logged("supervisor")) {
            String exit = createExit(student, "NOW", 0).path("id").asText();
            depart(supervisor, exit);
            clock.set(START);
            JsonNode opened = open(supervisor);
            assertThat(opened.path("records").get(0).path("mark").isNull()).isTrue();
            String call = opened.path("id").asText();
            assertError(put(supervisor, CALLS + "/" + call + "/registros/" + resident,
                    Map.of("version", 0, "mark", "AUSENCIA_JUSTIFICADA",
                            "authorizedExitId", UUID.fromString(exit), "authorizedExitType", "SHORT")),
                    409, "authorized_exit_required");
            String pending = createExit(student, "NOW", 0).path("id").asText();
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
            UUID first = UUID.fromString(createExit(student, "NOW", 0).path("id").asText());
            UUID second = UUID.fromString(createExit(another, "NOW", 0).path("id").asText());
            UUID failLast = jdbc.query("SELECT id FROM sager_short_exit ORDER BY resident_id, id",
                    (result, row) -> result.getObject(1, UUID.class)).getLast();
            jdbc.execute("CREATE FUNCTION reject_ops_batch() RETURNS TRIGGER AS $$ BEGIN IF NEW.origin = 'SYSTEM_JOB'"
                    + " AND NEW.resource_id = '" + failLast + "'::uuid THEN RAISE EXCEPTION 'synthetic batch rollback';"
                    + " END IF; RETURN NEW; END; $$ LANGUAGE plpgsql");
            jdbc.execute("CREATE TRIGGER reject_ops_batch BEFORE INSERT ON sager_audit_event"
                    + " FOR EACH ROW EXECUTE FUNCTION reject_ops_batch()");
            clock.set(START.plusSeconds(10800));
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
                    "{\"departureMode\":\"NOW\",\"reason\":123}",
                    "{\"departureMode\":\"NOW\",\"reason\":\"😃😃\"}",
                    "{\"departureMode\":\"SCHEDULED\",\"requestedDepartureAt\":\"2026-10-01T03:00:00Z\",\"reason\":\"Sintético\"}",
                    "{\"departureMode\":\"LATER\",\"reason\":\"Sintético\"}",
                    "{\"requestedDepartureAt\":\"2026-10-01T03:00:00Z\",\"reason\":\"Sintético\"}",
                    "{\"origin\":\"SYSTEM_JOB\",\"actorId\":\"00000000-0000-0000-0000-000000000000\"}")) {
                assertError(postRaw(student, EXITS, body, token), 400, "invalid_input");
            }
            assertThat(count("sager_short_exit")).isZero();
            String id = createExit(student, "NOW", 0).path("id").asText();
            clock.set(START.plusSeconds(600));
            assertError(post(supervisor, EXITS + "/" + id + "/partida", Map.of("version", 0,
                    "timeMode", "RETROACTIVE", "occurredAt", START.plusSeconds(601).toString(),
                    "justification", "Horário informado ainda futuro")), 400, "invalid_input");
            assertThat(read(supervisor, EXITS + "/" + id).path("version").asLong()).isZero();
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
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment(name + "@example.invalid"), name + "@example.invalid", "Pessoa Sintética", profile, PASSWORD.toCharArray());
    }

    private HttpClient logged(String name) throws Exception {
        HttpClient client = browser();
        String body = "matricula=" + URLEncoder.encode(br.edu.ifgoiano.sager.TestIdentity.enrollment(name + "@example.invalid"), StandardCharsets.UTF_8)
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

    /** A saída curta não leva volta: o servidor conta 3 horas da partida (short-exit-recorded-departure). */
    private Map<String, Object> exitBody(String mode, Instant departure) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("departureMode", mode);
        if (mode.equals("SCHEDULED")) body.put("requestedDepartureAt", departure.toString());
        body.put("reason", "Motivo sintético da saída");
        body.put("notes", "Observação sintética");
        return body;
    }

    private Map<String, Object> editBody(String mode, long departure, long version) {
        Map<String, Object> body = exitBody(mode, clock.instant().plusSeconds(departure));
        body.put("version", version);
        return body;
    }

    private JsonNode createExit(HttpClient client, String mode, long departure) throws Exception {
        return created(post(client, EXITS, exitBody(mode, clock.instant().plusSeconds(departure))));
    }

    /**
     * Saída curta aprovada antes de 20/11/2026. A API não aprova mais a saída curta (short-exit-two-steps),
     * então o estado antigo é gravado direto no banco, com o registro de aprovação no histórico (versão +1).
     */
    private void legacyApprove(String id, Instant decidedAt) {
        UUID exit = UUID.fromString(id);
        assertThat(jdbc.update("UPDATE sager_short_exit SET status = 'APROVADA', decision = 'APPROVE',"
                + " decided_at = ?, version = version + 1, updated_at = ?"
                + " WHERE id = ? AND status = 'AGUARDANDO_ANALISE'", time(decidedAt), time(decidedAt), exit))
                .isEqualTo(1);
        legacyHistory(exit, "APPROVE", decidedAt, "supervisor");
    }

    /** Saída curta agendada (SCHEDULED) aguardando análise, como as gravadas antes de 20/11/2026. */
    private String legacyScheduled(Instant requested, Instant createdAt) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_short_exit(id, resident_id, resident_name, enrollment, departure_mode,"
                + " requested_departure_at, expected_return_at, reason, notes, created_at, updated_at)"
                + " SELECT ?::uuid, id, name, enrollment, 'SCHEDULED', ?::timestamptz, ?::timestamptz,"
                + " 'Motivo sintético da saída', 'Observação sintética', ?::timestamptz, ?::timestamptz"
                + " FROM sager_resident WHERE id = ?::uuid", id, time(requested), time(requested.plusSeconds(10800)),
                time(createdAt), time(createdAt), resident);
        legacyHistory(id, "CREATE", createdAt, "student");
        return id.toString();
    }

    private void legacyHistory(UUID exit, String event, Instant at, String account) {
        jdbc.update("INSERT INTO sager_short_exit_history(id, exit_id, event, resulting_version, occurred_at,"
                + " actor_id, actor_profile, origin, departure_mode, requested_departure_at, expected_return_at,"
                + " reason, notes, status, decision, decision_comment)"
                + " SELECT ?::uuid, id, ?, version, ?::timestamptz, ?::uuid, ?, 'LOCAL_API', departure_mode,"
                + " requested_departure_at, expected_return_at, reason, notes, status, decision, decision_comment"
                + " FROM sager_short_exit WHERE id = ?::uuid", UUID.randomUUID(), event, time(at), accountId(account),
                "supervisor".equals(account) ? "supervisor" : "residente", exit);
    }

    private UUID accountId(String name) {
        return jdbc.queryForObject("SELECT id FROM sager_local_account WHERE email = ?", UUID.class,
                name + "@example.invalid");
    }

    private static OffsetDateTime time(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    private List<String> ids(JsonNode exits) {
        List<String> ids = new java.util.ArrayList<>();
        exits.forEach(exit -> ids.add(exit.path("id").asText()));
        return ids;
    }

    /** Pedido para sair agora uma hora antes da chamada, com a saída registrada em pessoa no mesmo ato; deixa o relógio em START. */
    private String departedExit(HttpClient student, HttpClient supervisor) throws Exception {
        clock.set(START.minusSeconds(3600));
        String exit = createExit(student, "NOW", 0).path("id").asText();
        depart(supervisor, exit);
        clock.set(START);
        return exit;
    }

    /** O supervisor registra a saída agora sobre o pedido que espera: libera e começa num ato só (versão 0 → 1). */
    private void depart(HttpClient client, String id) throws Exception {
        assertThat(post(client, EXITS + "/" + id + "/partida", Map.of("version", 0, "timeMode", "NOW"))
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
