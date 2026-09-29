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
        UUID second = room("DEMO-02", 1, "Ocupado");
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
                    .isEqualTo("Ocupado");
            assertThat(read(client, PATH + "?roomId=" + second + "&active=true").size()).isZero();
            assertThat(read(client, PATH + "?roomId=" + second + "&active=false").size()).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_room_allocation", Integer.class))
                    .isEqualTo(2);
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
    void enforcesRolesCsrfDisabledAccountAndClosedProductionProfile() throws Exception {
        for (String profile : List.of("gestor", "supervisor", "residente")) {
            account(profile);
        }
        UUID resident = resident("DEMO-A");
        UUID room = room("DEMO-01", 2, "Disponível");
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
            assertThat(post(supervisor, PATH, body, csrf(supervisor)).statusCode()).isEqualTo(403);
            assertThat(post(supervisor, PATH + "/" + allocation + "/encerrar", "{\"version\":0}",
                    csrf(supervisor)).statusCode()).isEqualTo(403);
            provisioning.disable("supervisor@example.invalid");
            assertThat(get(supervisor, PATH + "?residentId=" + resident).statusCode()).isEqualTo(401);
            login(student, "residente");
            assertThat(get(student, PATH + "?residentId=" + resident).statusCode()).isEqualTo(403);
            assertThat(post(student, PATH, body, csrf(student)).statusCode()).isEqualTo(403);
        }
        SpringApplication application = new SpringApplication(SagerApplication.class);
        application.setAdditionalProfiles("production");
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
            assertThat(read(one, PATH + "?roomId=" + room + "&active=true").size()).isEqualTo(1);
            assertCounts(one, room, 1, 0);
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

    private int parallelPost(HttpClient client, UUID resident, UUID room, String token) {
        try {
            return post(client, PATH, json.writeValueAsString(Map.of(
                    "residentId", resident, "roomId", room)), token).statusCode();
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }

    private UUID resident(String enrollment) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident (id, name, enrollment) VALUES (?, ?, ?)",
                id, "Estudante Sintético", enrollment);
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
        provisioning.create(profile + "@example.invalid", "Pessoa Sintética", profile, PASSWORD.toCharArray());
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
        String form = "email=" + URLEncoder.encode(profile + "@example.invalid", StandardCharsets.UTF_8)
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
