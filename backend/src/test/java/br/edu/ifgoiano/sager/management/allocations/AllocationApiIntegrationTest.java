package br.edu.ifgoiano.sager.management.allocations;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import br.edu.ifgoiano.sager.SagerApplication;
import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.web.server.servlet.context.ServletWebServerApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class AllocationApiIntegrationTest {
    private static final String PASSWORD = "Senha sintética 123!";
    private static final String PATH = "/api/v1/alocacoes";
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

    @Autowired
    private LocalAccountProvisioningService provisioning;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper json;

    @LocalServerPort
    private int port;

    @BeforeEach
    void cleanDatabase() {
        jdbc.update("DELETE FROM spring_session");
        jdbc.update("DELETE FROM sager_room_allocation");
        jdbc.update("DELETE FROM sager_room");
        jdbc.update("DELETE FROM sager_accommodation_unit");
        jdbc.update("DELETE FROM sager_accommodation");
        jdbc.update("DELETE FROM sager_resident");
        jdbc.update("DELETE FROM sager_local_account");
    }

    @Test
    void createsTransfersAndEndsWithHistoryAndLiveRoomCounts() throws Exception {
        account("gestor");
        UUID resident = resident("DEMO-A");
        UUID first = room("DEMO-01", 2, "Disponível");
        UUID second = room("DEMO-02", 1, "Disponível");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            assertThat(read(client, "/api/v1/quartos/" + first).path("occupancy").asInt()).isZero();
            HttpResponse<String> created = post(client, PATH,
                    json.writeValueAsString(Map.of("residentId", resident, "roomId", first)), csrf(client));
            assertThat(created.statusCode()).isEqualTo(201);
            assertNoStore(created);
            JsonNode allocation = json.readTree(created.body());
            UUID id = UUID.fromString(allocation.path("id").asText());
            assertThat(created.headers().firstValue("Location").orElseThrow()).isEqualTo(PATH + "/" + id);
            assertThat(read(client, PATH + "/" + id).path("id").asText()).isEqualTo(id.toString());
            assertThat(allocation.size()).isEqualTo(7);
            assertThat(allocation.path("startedAt").asText()).isNotBlank();
            assertThat(allocation.path("endedAt").isNull()).isTrue();
            assertThat(allocation.path("endReason").isNull()).isTrue();
            assertThat(allocation.path("version").asLong()).isZero();
            assertCounts(client, first, 1, 1);
            assertError(putRoom(client, first, null, 0), 409, "capacity_below_occupancy");
            assertThat(putRoom(client, first, 1, 0).statusCode()).isEqualTo(200);
            assertCounts(client, first, 1, 0);

            HttpResponse<String> moved = post(client, PATH + "/" + id + "/transferir",
                    json.writeValueAsString(Map.of("roomId", second, "version", 0)), csrf(client));
            assertThat(moved.statusCode()).isEqualTo(201);
            UUID movedId = UUID.fromString(json.readTree(moved.body()).path("id").asText());
            assertThat(movedId).isNotEqualTo(id);
            assertCounts(client, first, 0, 1);
            assertCounts(client, second, 1, 0);
            assertThat(read(client, "/api/v1/quartos/" + second).path("situation").asText())
                    .isEqualTo("Ocupado");
            JsonNode history = read(client, PATH + "?residentId=" + resident);
            assertThat(history.size()).isEqualTo(2);
            assertThat(history.get(0).path("id").asText()).isEqualTo(movedId.toString());
            assertThat(history.get(1).path("endReason").asText()).isEqualTo("TRANSFER");
            assertThat(history.get(1).path("endedAt").asText()).isNotBlank();
            assertThat(history.get(1).path("version").asLong()).isEqualTo(1);
            assertThat(read(client, PATH + "?roomId=" + first + "&active=true").size()).isZero();
            assertThat(read(client, PATH + "?roomId=" + first + "&active=false").size()).isEqualTo(1);

            HttpResponse<String> ended = post(client, PATH + "/" + movedId + "/encerrar", "{\"version\":0}",
                    csrf(client));
            assertThat(ended.statusCode()).isEqualTo(200);
            assertThat(json.readTree(ended.body()).path("endReason").asText()).isEqualTo("END");
            assertCounts(client, second, 0, 1);
            assertThat(read(client, "/api/v1/quartos/" + second).path("situation").asText())
                    .isEqualTo("Disponível");
            assertThat(read(client, PATH + "?roomId=" + second + "&active=true").size()).isZero();
            assertThat(read(client, PATH + "?roomId=" + second + "&active=false").size()).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_room_allocation", Integer.class))
                    .isEqualTo(2);
        }
    }

    @Test
    void occupiedSituationFollowsActiveAllocationsWhileManualStatesPrevail() throws Exception {
        account("gestor");
        UUID resident = resident("DEMO-A");
        UUID room = room("DEMO-01", 1, "Disponível");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            UUID allocation = create(client, resident, room);
            assertSituation(client, room, "Ocupado");
            assertThat(read(client, "/api/v1/quartos?situation=Ocupado").size()).isEqualTo(1);
            assertThat(read(client, "/api/v1/quartos?situation=Dispon%C3%ADvel").size()).isZero();

            assertThat(putRoom(client, room, 2, 0).statusCode()).isEqualTo(200);
            assertSituation(client, room, "Disponível");
            assertThat(jdbc.queryForObject("""
                    SELECT array_to_string(changed_fields, ',') FROM sager_audit_event
                    WHERE resource = 'ROOM' AND resource_id = ? AND resulting_version = 1
                    """, String.class, room)).isEqualTo("capacity");

            jdbc.update("UPDATE sager_room SET capacity = 1, situation = 'Manutenção' WHERE id = ?", room);
            assertSituation(client, room, "Manutenção");
            assertThat(read(client, "/api/v1/quartos?situation=Ocupado").size()).isZero();
            assertThat(post(client, PATH + "/" + allocation + "/encerrar", "{\"version\":0}", csrf(client))
                    .statusCode()).isEqualTo(200);
            assertSituation(client, room, "Manutenção");
        }
    }

    @Test
    void rejectsInvalidCapacitySituationActiveDuplicatesAndStaleChanges() throws Exception {
        account("gestor");
        UUID first = resident("DEMO-A");
        UUID second = resident("DEMO-B");
        UUID room = room("DEMO-01", 1, "Disponível");
        UUID unknown = room("DEMO-UNKNOWN", null, "Disponível");
        UUID maintenance = room("DEMO-MAINT", 2, "Manutenção");
        UUID unavailable = room("DEMO-BLOCKED", 2, "Indisponível");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            assertError(post(client, PATH, "{}", csrf(client)), 400, "invalid_input");
            assertError(post(client, PATH, "{", csrf(client)), 400, "invalid_input");
            assertError(post(client, PATH, "{\"residentId\":123,\"roomId\":true}", csrf(client)),
                    400, "invalid_input");
            assertError(post(client, PATH, json.writeValueAsString(Map.of(
                    "residentId", UUID.randomUUID(), "roomId", room)), csrf(client)),
                    422, "invalid_reference");
            assertError(post(client, PATH, json.writeValueAsString(Map.of(
                    "residentId", first, "roomId", UUID.randomUUID())), csrf(client)),
                    422, "invalid_reference");
            for (Map.Entry<UUID, String> blocked : Map.of(unknown, "capacity_unknown",
                    maintenance, "room_unavailable", unavailable, "room_unavailable").entrySet()) {
                assertError(post(client, PATH, json.writeValueAsString(Map.of(
                        "residentId", first, "roomId", blocked.getKey())), csrf(client)),
                        409, blocked.getValue());
            }
            UUID allocation = create(client, first, room);
            assertError(post(client, PATH, json.writeValueAsString(Map.of(
                    "residentId", first, "roomId", unknown)), csrf(client)), 409, "active_conflict");
            assertError(post(client, PATH, json.writeValueAsString(Map.of(
                    "residentId", second, "roomId", room)), csrf(client)), 409, "room_full");
            assertError(putRoom(client, room, null, 0), 409, "capacity_below_occupancy");
            assertError(post(client, PATH + "/" + allocation + "/transferir",
                    json.writeValueAsString(Map.of("roomId", room, "version", 0)), csrf(client)),
                    400, "invalid_input");
            assertError(post(client, PATH + "/" + allocation + "/transferir",
                    json.writeValueAsString(Map.of("roomId", unknown, "version", 0)), csrf(client)),
                    409, "capacity_unknown");
            assertError(post(client, PATH + "/" + allocation + "/encerrar", "{\"version\":1}", csrf(client)),
                    409, "stale_version");
            assertError(post(client, PATH + "/" + allocation + "/encerrar", "{\"version\":null}",
                    csrf(client)), 400, "invalid_input");
            assertError(post(client, PATH + "/" + UUID.randomUUID() + "/encerrar", "{\"version\":0}",
                    csrf(client)), 404, "not_found");
            assertError(get(client, PATH + "/" + UUID.randomUUID()), 404, "not_found");
            assertError(get(client, PATH), 400, "invalid_input");
            assertError(get(client, PATH + "?roomId=" + room + "&residentId=" + first), 400, "invalid_input");
            assertError(get(client, PATH + "?roomId=not-a-uuid"), 400, "invalid_input");
            assertThat(post(client, PATH + "/" + allocation + "/encerrar", "{\"version\":0}",
                    csrf(client)).statusCode()).isEqualTo(200);
            assertError(post(client, PATH + "/" + allocation + "/encerrar", "{\"version\":0}",
                    csrf(client)), 409, "stale_version");
            assertThat(read(client, PATH + "?residentId=" + first).size()).isEqualTo(1);
        }
    }

    @Test
    void enforcesRolesCsrfDisabledAccountAndUnknownProfile() throws Exception {
        for (String profile : List.of("gestor", "supervisor", "residente")) {
            account(profile);
        }
        UUID resident = resident("DEMO-A");
        UUID room = room("DEMO-01", 2, "Disponível");
        UUID secondResident = resident("DEMO-B");
        UUID secondRoom = room("DEMO-02", 2, "Disponível");
        String body = json.writeValueAsString(Map.of("residentId", resident, "roomId", room));
        try (HttpClient anonymous = browser(); HttpClient supervisor = browser();
                HttpClient gestor = browser(); HttpClient student = browser()) {
            assertThat(get(anonymous, PATH + "?residentId=" + resident).statusCode()).isEqualTo(401);
            assertThat(post(anonymous, PATH, body, csrf(anonymous)).statusCode()).isEqualTo(401);
            login(gestor, "gestor");
            assertThat(post(gestor, PATH, body, null).statusCode()).isEqualTo(403);
            UUID allocation = create(gestor, resident, room);
            assertThat(post(gestor, PATH + "/" + allocation + "/encerrar", "{\"version\":0}", null)
                    .statusCode()).isEqualTo(403);
            login(supervisor, "supervisor");
            assertThat(read(supervisor, PATH + "?residentId=" + resident).size()).isEqualTo(1);
            UUID secondAllocation = create(supervisor, secondResident, secondRoom);
            assertThat(read(supervisor, PATH + "?residentId=" + secondResident).size()).isEqualTo(1);
            assertThat(post(supervisor, PATH + "/" + secondAllocation + "/encerrar", "{\"version\":0}",
                    null).statusCode()).isEqualTo(403);
            assertThat(post(supervisor, PATH + "/" + allocation + "/encerrar", "{\"version\":0}",
                    csrf(supervisor)).statusCode()).isEqualTo(200);
            UUID replacement = create(supervisor, resident, room);
            HttpResponse<String> transferred = post(supervisor, PATH + "/" + replacement + "/transferir",
                    json.writeValueAsString(Map.of("roomId", secondRoom, "version", 0)),
                    csrf(supervisor));
            assertThat(transferred.statusCode()).isEqualTo(201);
            assertThat(json.readTree(transferred.body()).path("roomId").asText())
                    .isEqualTo(secondRoom.toString());
            assertThat(post(supervisor, PATH + "/" + secondAllocation + "/encerrar", "{\"version\":0}",
                    csrf(supervisor)).statusCode()).isEqualTo(200);
            provisioning.disable("supervisor@example.invalid");
            assertThat(get(supervisor, PATH + "?residentId=" + resident).statusCode()).isEqualTo(401);
            login(student, "residente");
            assertThat(get(student, PATH + "?residentId=" + resident).statusCode()).isEqualTo(403);
            assertThat(post(student, PATH, body, csrf(student)).statusCode()).isEqualTo(403);
        }
        SpringApplication application = new SpringApplication(SagerApplication.class);
        application.setAdditionalProfiles("closed");
        try (var context = application.run("--server.port=0",
                "--spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                "--spring.datasource.username=" + POSTGRES.getUsername(),
                "--spring.datasource.password=" + POSTGRES.getPassword())) {
            int closedPort = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
            try (HttpClient client = browser()) {
                HttpResponse<String> response = client.send(HttpRequest.newBuilder(
                        URI.create("http://127.0.0.1:" + closedPort + PATH + "?residentId=" + resident))
                        .GET().build(), HttpResponse.BodyHandlers.ofString());
                assertThat(response.statusCode()).isIn(401, 403);
            }
        }
    }

    @Test
    void concurrentAssignmentsCannotOverfillRoom() throws Exception {
        account("gestor");
        UUID room = room("DEMO-01", 1, "Disponível");
        UUID first = resident("DEMO-A");
        UUID second = resident("DEMO-B");
        try (HttpClient one = browser(); HttpClient two = browser()) {
            login(one, "gestor");
            login(two, "gestor");
            String tokenOne = csrf(one);
            String tokenTwo = csrf(two);
            CompletableFuture<Integer> a = CompletableFuture.supplyAsync(() ->
                    parallelPost(one, first, room, tokenOne));
            CompletableFuture<Integer> b = CompletableFuture.supplyAsync(() ->
                    parallelPost(two, second, room, tokenTwo));
            assertThat(List.of(a.join(), b.join())).containsExactlyInAnyOrder(201, 409);
            JsonNode active = read(one, PATH + "?roomId=" + room + "&active=true");
            assertThat(active.size()).isEqualTo(1);
            assertCounts(one, room, 1, 0);
            assertThat(jdbc.queryForObject("SELECT to_regclass('sager_audit_event')", String.class)).isNotNull();
            assertThat(auditRows(UUID.fromString(active.get(0).path("id").asText()))).hasSize(1);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event "
                    + "WHERE resource = 'ALLOCATION' AND actor_id = "
                    + "(SELECT id FROM sager_local_account WHERE email = ?)", Integer.class,
                    "gestor@example.invalid")).isEqualTo(1);
        }
    }

    @Test
    void auditsTransferAsCorrelatedEndAndCreationAndKeepsFailedChangesUnaudited() throws Exception {
        assertThat(jdbc.queryForObject("SELECT to_regclass('sager_audit_event')", String.class)).isNotNull();
        account("supervisor");
        UUID resident = resident("AUDIT-TRANSFER");
        UUID first = room("AUDIT-01", 1, "Disponível");
        UUID second = room("AUDIT-02", 1, "Disponível");
        UUID actor = jdbc.queryForObject("SELECT id FROM sager_local_account WHERE email = ?",
                UUID.class, "supervisor@example.invalid");
        try (HttpClient client = browser()) {
            login(client, "supervisor");
            UUID id = create(client, resident, first);
            List<AuditRow> initial = auditRows(id);
            assertThat(initial).hasSize(1);
            assertThat(initial.getFirst().action()).isEqualTo("CREATE");
            assertThat(initial.getFirst().version()).isZero();
            assertThat(initial.getFirst().fields()).containsExactlyInAnyOrder("residentId", "roomId", "startedAt");
            assertThat(initial.getFirst().actorId()).isEqualTo(actor);
            assertThat(initial.getFirst().profile()).isEqualTo("supervisor");
            assertError(post(client, PATH + "/" + id + "/transferir",
                    json.writeValueAsString(Map.of("roomId", first, "version", 0)), csrf(client)),
                    400, "invalid_input");
            assertError(post(client, PATH + "/" + id + "/encerrar", "{\"version\":1}", csrf(client)),
                    409, "stale_version");
            assertThat(auditRows(id)).hasSize(1);

            HttpResponse<String> moved = post(client, PATH + "/" + id + "/transferir",
                    json.writeValueAsString(Map.of("roomId", second, "version", 0)), csrf(client));
            assertThat(moved.statusCode()).isEqualTo(201);
            UUID replacement = UUID.fromString(json.readTree(moved.body()).path("id").asText());
            AuditRow end = auditRows(id).getLast();
            AuditRow start = auditRows(replacement).getFirst();
            assertThat(end.action()).isEqualTo("END");
            assertThat(end.version()).isEqualTo(1);
            assertThat(end.fields()).containsExactlyInAnyOrder("endedAt", "endReason");
            assertThat(start.action()).isEqualTo("CREATE");
            assertThat(start.version()).isZero();
            assertThat(end.requestId()).isEqualTo(start.requestId());
            assertThat(end.requestId()).isNotEqualTo(initial.getFirst().requestId());
            assertThat(end.actorId()).isEqualTo(start.actorId()).isEqualTo(actor);
            assertThat(end.profile()).isEqualTo(start.profile()).isEqualTo("supervisor");

            assertThat(post(client, PATH + "/" + replacement + "/encerrar", "{\"version\":0}",
                    csrf(client)).statusCode()).isEqualTo(200);
            AuditRow finalEnd = auditRows(replacement).getLast();
            assertThat(finalEnd.action()).isEqualTo("END");
            assertThat(finalEnd.version()).isEqualTo(1);
            assertThat(finalEnd.fields()).containsExactlyInAnyOrder("endedAt", "endReason");
            assertThat(finalEnd.requestId()).isNotEqualTo(end.requestId());
            assertThat(auditRows(id)).hasSize(2);
            assertThat(auditRows(replacement)).hasSize(2);
        }
    }

    @Test
    void transferAuditFailureRollsBackBothAllocationChanges() throws Exception {
        assertThat(jdbc.queryForObject("SELECT to_regclass('sager_audit_event')", String.class)).isNotNull();
        account("gestor");
        UUID resident = resident("AUDIT-TRANSFER-ROLLBACK");
        UUID first = room("AUDIT-ROLLBACK-01", 1, "Disponível");
        UUID second = room("AUDIT-ROLLBACK-02", 1, "Disponível");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            UUID id = create(client, resident, first);
            jdbc.execute("""
                    CREATE FUNCTION reject_test_allocation_audit() RETURNS trigger LANGUAGE plpgsql AS $$
                    BEGIN
                        IF NEW.resource = 'ALLOCATION' AND NEW.action = 'CREATE' THEN
                            RAISE EXCEPTION 'synthetic allocation audit insertion failure';
                        END IF;
                        RETURN NEW;
                    END
                    $$
                    """);
            jdbc.execute("CREATE TRIGGER reject_test_allocation_audit BEFORE INSERT ON sager_audit_event "
                    + "FOR EACH ROW EXECUTE FUNCTION reject_test_allocation_audit()");
            try {
                assertThat(post(client, PATH + "/" + id + "/transferir",
                        json.writeValueAsString(Map.of("roomId", second, "version", 0)), csrf(client))
                        .statusCode()).isEqualTo(500);
                JsonNode current = read(client, PATH + "/" + id);
                assertThat(current.path("endedAt").isNull()).isTrue();
                assertThat(current.path("version").asLong()).isZero();
                assertThat(read(client, PATH + "?residentId=" + resident).size()).isEqualTo(1);
                assertCounts(client, first, 1, 0);
                assertCounts(client, second, 0, 1);
                assertThat(auditRows(id)).hasSize(1);
                assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event "
                        + "WHERE resource = 'ALLOCATION' AND actor_id = "
                        + "(SELECT id FROM sager_local_account WHERE email = ?)",
                        Integer.class, "gestor@example.invalid")).isEqualTo(1);
            } finally {
                jdbc.execute("DROP TRIGGER reject_test_allocation_audit ON sager_audit_event");
                jdbc.execute("DROP FUNCTION reject_test_allocation_audit()");
            }
        }
    }

    @Test
    void rejectsCapacityBelowTwoActiveResidentsWithoutChangingStoredRoom() throws Exception {
        account("gestor");
        UUID room = room("DEMO-01", 2, "Disponível");
        UUID first = resident("DEMO-A");
        UUID second = resident("DEMO-B");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            create(client, first, room);
            create(client, second, room);
            assertCounts(client, room, 2, 0);
            assertError(putRoom(client, room, 1, 0), 409, "capacity_below_occupancy");
            assertThat(read(client, "/api/v1/quartos/" + room).path("capacity").asInt()).isEqualTo(2);
            assertThat(read(client, "/api/v1/quartos/" + room).path("version").asLong()).isZero();
        }
    }

    @Test
    void ageGroupIsCheckedOnlyWhenPlacingOrTransferring() throws Exception {
        account("gestor");
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("America/Sao_Paulo"));
        UUID minorsAccommodation = accommodation("MEN", "MENORES");
        UUID minors = room("MEN-01", minorsAccommodation);
        UUID adults = room("MAI-01", accommodation("MAI", "MAIORES"));
        UUID free = room("LIVRE-01", 4, "Disponível");
        UUID minor = resident("AGE-A", today.minusYears(15));
        UUID adult = resident("AGE-B", today.minusYears(19));
        UUID turning = resident("AGE-C", today.minusYears(18));
        UUID unknown = resident("AGE-D", null);
        UUID minorWithoutGroup = resident("AGE-E", today.minusYears(16));
        int audits = jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE resource = 'ALLOCATION'",
                Integer.class);
        try (HttpClient client = browser()) {
            login(client, "gestor");
            assertError(allocate(client, minor, adults), 409, "age_group_mismatch");
            assertError(allocate(client, turning, minors), 409, "age_group_mismatch");
            assertError(allocate(client, unknown, minors), 409, "birth_date_required");
            assertError(allocate(client, unknown, adults), 409, "birth_date_required");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_room_allocation", Integer.class)).isZero();

            UUID adultAllocation = create(client, adult, free);
            create(client, unknown, free);
            UUID minorAllocation = create(client, minor, minors);
            create(client, minorWithoutGroup, free);
            create(client, turning, adults);
            assertError(post(client, PATH + "/" + adultAllocation + "/transferir",
                    json.writeValueAsString(Map.of("roomId", minors, "version", 0)), csrf(client)), 409,
                    "age_group_mismatch");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_room_allocation WHERE id = ?"
                    + " AND ended_at IS NULL AND version = 0", Integer.class, adultAllocation)).isOne();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE resource = 'ALLOCATION'",
                    Integer.class)).isEqualTo(audits + 5);

            assertThat(put(client, "/api/v1/alojamentos/" + minorsAccommodation, json.writeValueAsString(
                    Map.of("code", "MEN", "name", "Sintético", "ageGroup", "MAIORES", "version", 0)), csrf(client))
                    .statusCode()).isEqualTo(200);
            assertThat(read(client, PATH + "/" + minorAllocation).path("endedAt").isNull()).isTrue();
        }
    }

    private HttpResponse<String> allocate(HttpClient client, UUID resident, UUID room) throws Exception {
        return post(client, PATH, json.writeValueAsString(Map.of("residentId", resident, "roomId", room)),
                csrf(client));
    }

    private UUID accommodation(String code, String ageGroup) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_accommodation (id, code, name, age_group) VALUES (?, ?, 'Sintético', ?)",
                id, code, ageGroup);
        return id;
    }

    private UUID room(String code, UUID accommodation) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_room (id, code, number, accommodation_id, capacity, situation)
                VALUES (?, ?, ?, ?, 4, 'Disponível')
                """, id, code, code, accommodation);
        return id;
    }

    /** Sem data, simula o cadastro antigo que a V10 preservou. */
    private UUID resident(String enrollment, java.time.LocalDate birth) {
        UUID id = UUID.randomUUID();
        if (birth == null) jdbc.execute("ALTER TABLE sager_resident DROP CONSTRAINT sager_resident_birth_date_required");
        try {
            jdbc.update("INSERT INTO sager_resident (id, name, enrollment, birth_date) VALUES (?, ?, ?, ?)",
                    id, "Estudante Sintético", enrollment, birth);
        } finally {
            if (birth == null) jdbc.execute("ALTER TABLE sager_resident ADD CONSTRAINT"
                    + " sager_resident_birth_date_required CHECK (birth_date IS NOT NULL) NOT VALID");
        }
        return id;
    }

    private int parallelPost(HttpClient client, UUID resident, UUID room, String token) {
        try {
            return post(client, PATH, json.writeValueAsString(Map.of(
                    "residentId", resident, "roomId", room)), token).statusCode();
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }

    private List<AuditRow> auditRows(UUID id) {
        return jdbc.query("""
                SELECT action, resulting_version, changed_fields, actor_id, actor_profile, request_id
                FROM sager_audit_event WHERE resource = 'ALLOCATION' AND resource_id = ? ORDER BY sequence
                """, (result, row) -> new AuditRow(result.getString("action"), result.getLong("resulting_version"),
                List.of((String[]) result.getArray("changed_fields").getArray()), result.getObject("actor_id", UUID.class),
                result.getString("actor_profile"), result.getObject("request_id", UUID.class)), id);
    }

    private record AuditRow(String action, long version, List<String> fields, UUID actorId,
            String profile, UUID requestId) {
    }

    private UUID resident(String enrollment) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident (id, name, enrollment, birth_date) VALUES (?, ?, ?, ?)",
                id, "Estudante Sintético", enrollment, java.time.LocalDate.of(2006, 1, 2));
        return id;
    }

    private UUID room(String code, Integer capacity, String situation) {
        UUID accommodation = jdbc.query("SELECT id FROM sager_accommodation WHERE code = 'DEMO'",
                (result, row) -> result.getObject(1, UUID.class)).stream().findFirst().orElseGet(() -> {
                    UUID id = UUID.randomUUID();
                    jdbc.update("INSERT INTO sager_accommodation (id, code, name) VALUES (?, 'DEMO', 'Sintético')", id);
                    return id;
                });
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_room (id, code, number, accommodation_id, capacity, situation)
                VALUES (?, ?, ?, ?, ?, ?)
                """, id, code, code, accommodation, capacity, situation);
        return id;
    }

    private void account(String profile) {
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment(profile + "@example.invalid"), profile + "@example.invalid", "Pessoa Sintética", profile, PASSWORD.toCharArray());
    }

    private UUID create(HttpClient client, UUID resident, UUID room) throws Exception {
        HttpResponse<String> result = post(client, PATH,
                json.writeValueAsString(Map.of("residentId", resident, "roomId", room)), csrf(client));
        assertThat(result.statusCode()).isEqualTo(201);
        return UUID.fromString(json.readTree(result.body()).path("id").asText());
    }

    private HttpResponse<String> putRoom(HttpClient client, UUID roomId, Integer capacity, long version)
            throws Exception {
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("code", "DEMO-01");
        body.put("number", "DEMO-01");
        body.put("accommodationId", jdbc.queryForObject("SELECT accommodation_id FROM sager_room WHERE id = ?",
                UUID.class, roomId));
        body.put("unitId", null);
        body.put("floor", null);
        body.put("capacity", capacity);
        body.put("situation", "Disponível");
        body.put("version", version);
        return put(client, "/api/v1/quartos/" + roomId, json.writeValueAsString(body), csrf(client));
    }

    private void assertSituation(HttpClient client, UUID room, String situation) throws Exception {
        assertThat(read(client, "/api/v1/quartos/" + room).path("situation").asText()).isEqualTo(situation);
    }

    private void assertCounts(HttpClient client, UUID room, int occupancy, int vacancies) throws Exception {
        JsonNode value = read(client, "/api/v1/quartos/" + room);
        assertThat(value.path("occupancy").asInt()).isEqualTo(occupancy);
        assertThat(value.path("vacancies").asInt()).isEqualTo(vacancies);
        JsonNode map = read(client, "/api/v1/quartos/mapa").path("rooms");
        JsonNode fromMap = null;
        for (JsonNode candidate : map) {
            if (candidate.path("id").asText().equals(room.toString())) {
                fromMap = candidate;
                break;
            }
        }
        assertThat(fromMap).isNotNull();
        assertThat(fromMap.path("occupancy").asInt()).isEqualTo(occupancy);
        assertThat(fromMap.path("vacancies").asInt()).isEqualTo(vacancies);
    }

    private void login(HttpClient client, String profile) throws Exception {
        String form = "matricula=" + URLEncoder.encode(br.edu.ifgoiano.sager.TestIdentity.enrollment(profile + "@example.invalid"), StandardCharsets.UTF_8)
                + "&password=" + URLEncoder.encode(PASSWORD, StandardCharsets.UTF_8);
        assertThat(postForm(client, "/api/v1/auth/login", form, csrf(client)).statusCode()).isEqualTo(204);
    }

    private String csrf(HttpClient client) throws Exception {
        return read(client, "/api/v1/auth/csrf").path("token").asText();
    }

    private JsonNode read(HttpClient client, String path) throws Exception {
        HttpResponse<String> response = get(client, path);
        assertThat(response.statusCode()).isEqualTo(200);
        assertNoStore(response);
        return json.readTree(response.body());
    }

    private void assertError(HttpResponse<String> response, int status, String code) throws Exception {
        assertThat(response.statusCode()).isEqualTo(status);
        assertNoStore(response);
        JsonNode body = json.readTree(response.body());
        assertThat(body.path("code").asText()).isEqualTo(code);
        assertThat(body.path("message").asText()).isNotBlank();
    }

    private void assertNoStore(HttpResponse<String> response) {
        assertThat(response.headers().firstValue("Cache-Control").orElseThrow()).contains("no-store");
    }

    private HttpResponse<String> get(HttpClient client, String path) throws Exception {
        return send(client, HttpRequest.newBuilder(uri(path)).GET().build());
    }

    private HttpResponse<String> post(HttpClient client, String path, String body, String token) throws Exception {
        return send(client, jsonRequest(path, token).POST(HttpRequest.BodyPublishers.ofString(body)).build());
    }

    private HttpResponse<String> put(HttpClient client, String path, String body, String token) throws Exception {
        return send(client, jsonRequest(path, token).PUT(HttpRequest.BodyPublishers.ofString(body)).build());
    }

    private HttpResponse<String> postForm(HttpClient client, String path, String body, String token) throws Exception {
        return send(client, HttpRequest.newBuilder(uri(path))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("X-CSRF-TOKEN", token).POST(HttpRequest.BodyPublishers.ofString(body)).build());
    }

    private HttpRequest.Builder jsonRequest(String path, String token) {
        HttpRequest.Builder request = HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json");
        if (token != null) {
            request.header("X-CSRF-TOKEN", token);
        }
        return request;
    }

    private HttpResponse<String> send(HttpClient client, HttpRequest request) throws Exception {
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private HttpClient browser() {
        return HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
                .followRedirects(HttpClient.Redirect.NEVER).build();
    }

    private URI uri(String path) {
        return URI.create("http://127.0.0.1:" + port + path);
    }
}
