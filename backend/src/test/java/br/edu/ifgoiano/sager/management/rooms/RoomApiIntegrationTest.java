package br.edu.ifgoiano.sager.management.rooms;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
class RoomApiIntegrationTest {
    private static final String PASSWORD = "Senha sintetica 123!";
    private static final String PATH = "/api/v1/quartos";
    private static final String ACCOMMODATIONS = "/api/v1/alojamentos";
    private static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:17.11");

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
        jdbc.update("DELETE FROM sager_local_account");
        if (jdbc.queryForObject("SELECT to_regclass('sager_room')", String.class) != null) {
            jdbc.update("DELETE FROM sager_room");
        }
        jdbc.update("DELETE FROM sager_accommodation_unit");
        jdbc.update("DELETE FROM sager_accommodation");
    }

    @Test
    void gestorPersistsLeadingZeroNumberAndOptionalFieldsWithZeroOccupancy() throws Exception {
        gestorAccount();
        try (HttpClient client = browser()) {
            login(client, "gestor");
            String accommodation = accommodation(client, "DEMO-A");
            HttpResponse<String> created = post(client, PATH,
                    room(" DEMO-A-01 ", " 01 ", accommodation, null, null, null, "Ocupado"), csrf(client));
            assertThat(created.statusCode()).isEqualTo(201);
            assertNoStore(created);
            JsonNode value = json.readTree(created.body());
            String id = value.path("id").asText();
            assertThat(UUID.fromString(id)).isNotNull();
            assertThat(created.headers().firstValue("Location").orElseThrow()).isEqualTo(PATH + "/" + id);
            assertThat(value.path("code").asText()).isEqualTo("DEMO-A-01");
            assertThat(value.path("number").asText()).isEqualTo("01");
            assertThat(value.path("accommodationId").asText()).isEqualTo(accommodation);
            assertThat(value.path("situation").asText()).isEqualTo("Ocupado");
            assertThat(value.path("version").asLong()).isZero();
            assertThat(value.size()).isEqualTo(12);
            for (String field : new String[] { "unitId", "floor", "capacity", "vacancies", "cleaningScore" }) {
                assertThat(value.path(field).isNull()).as(field).isTrue();
            }
            assertThat(value.path("occupancy").asInt()).isZero();
            assertThat(json.readTree(get(client, PATH).body()).size()).isEqualTo(1);
            assertThat(get(client, PATH + "/" + id).statusCode()).isEqualTo(200);
            String unit = unit(client, accommodation, "CASA");
            HttpResponse<String> changed = put(client, PATH + "/" + id,
                    edit(room("DEMO-A-01", "01", accommodation, unit, "Térreo", 6, "Manutenção"), 0),
                    csrf(client));
            assertThat(changed.statusCode()).isEqualTo(200);
            assertNoStore(changed);
            JsonNode changedValue = json.readTree(changed.body());
            assertThat(changedValue.path("version").asLong()).isEqualTo(1);
            assertThat(changedValue.path("capacity").asInt()).isEqualTo(6);
            assertThat(changedValue.path("unitId").asText()).isEqualTo(unit);
            assertThat(changedValue.path("floor").asText()).isEqualTo("Térreo");
            assertThat(changedValue.path("situation").asText()).isEqualTo("Manutenção");
            assertThat(changedValue.path("occupancy").asInt()).isZero();
            assertThat(changedValue.path("vacancies").asInt()).isEqualTo(6);
            assertThat(jdbc.queryForObject("SELECT number FROM sager_room WHERE id = ?",
                    String.class, UUID.fromString(id))).isEqualTo("01");
            assertThat(jdbc.queryForObject("SELECT capacity FROM sager_room WHERE id = ?",
                    Integer.class, UUID.fromString(id))).isEqualTo(6);
        }
    }

    @Test
    void acceptsUnknownCapacityAndPositiveIntegersButRejectsInvalidNumericPayloads() throws Exception {
        gestorAccount();
        try (HttpClient client = browser()) {
            login(client, "gestor");
            String accommodation = accommodation(client, "DEMO-A");
            for (Object capacity : new Object[] { 0, -1, 1.5, "4", true, 2147483648L }) {
                assertError(post(client, PATH,
                        room("INVALID", "01", accommodation, null, null, capacity, "Disponível"), csrf(client)),
                        400, "invalid_input");
            }
            String id = createRoom(client, room("DEMO-01", "01", accommodation, null, null, 4, "Disponível"));
            assertThat(put(client, PATH + "/" + id,
                    edit(room("DEMO-01", "01", accommodation, null, " ", null, "Indisponível"), 0),
                    csrf(client)).statusCode()).isEqualTo(200);
            JsonNode value = json.readTree(get(client, PATH + "/" + id).body());
            assertThat(value.path("capacity").isNull()).isTrue();
            assertThat(value.path("floor").isNull()).isTrue();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_room", Integer.class)).isEqualTo(1);
        }
    }

    @Test
    void globalCodeAndLocalNumberUniquenessProtectDifferentLocationCombinations() throws Exception {
        gestorAccount();
        try (HttpClient client = browser()) {
            login(client, "gestor");
            String first = accommodation(client, "DEMO-A");
            String second = accommodation(client, "DEMO-B");
            String casaA = unit(client, first, "CASA-A");
            String casaB = unit(client, first, "CASA-B");
            String original = createRoom(client, room("DEMO-A-01", "01", first, null, null, 4, "Disponível"));
            assertError(post(client, PATH,
                    room("demo-a-01", "02", second, null, null, 4, "Disponível"), csrf(client)),
                    409, "duplicate_code");
            assertError(post(client, PATH,
                    room("DEMO-DUP", "01", first, null, null, 4, "Disponível"), csrf(client)),
                    409, "duplicate_location");
            createRoom(client, room("DEMO-CASA-A", "01", first, casaA, null, 4, "Disponível"));
            createRoom(client, room("DEMO-CASA-B", "01", first, casaB, null, 4, "Disponível"));
            String other = createRoom(client, room("DEMO-B-01", "01", second, null, null, 4, "Disponível"));
            createRoom(client, room("DEMO-ANDAR", "01", first, null, "1", 4, "Disponível"));
            createRoom(client, room("DEMO-TERREO", "01", first, casaA, "Térreo", 4, "Disponível"));
            assertError(post(client, PATH,
                    room("DEMO-DUP-ANDAR", "01", first, casaA, "térreo", 4, "Disponível"), csrf(client)),
                    409, "duplicate_location");
            assertError(put(client, PATH + "/" + other,
                    edit(room("DEMO-A-01", "03", second, null, null, 4, "Disponível"), 0), csrf(client)),
                    409, "duplicate_code");
            assertError(put(client, PATH + "/" + other,
                    edit(room("DEMO-B-01", "01", first, null, null, 4, "Disponível"), 0), csrf(client)),
                    409, "duplicate_location");
            assertThat(json.readTree(get(client, PATH + "/" + other).body())
                    .path("accommodationId").asText()).isEqualTo(second);
            assertThat(json.readTree(get(client, PATH + "/" + original).body()).path("version").asLong()).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_room", Integer.class)).isEqualTo(6);
        }
    }

    @Test
    void invalidLocationNeverMovesRoomOrProducesSuccess() throws Exception {
        gestorAccount();
        try (HttpClient client = browser()) {
            login(client, "gestor");
            String first = accommodation(client, "DEMO-A");
            String second = accommodation(client, "DEMO-B");
            String secondUnit = unit(client, second, "CASA-B");
            String unknown = UUID.randomUUID().toString();
            assertError(post(client, PATH, room("DEMO-X", "01", null, null, null, 4, "Disponível"), csrf(client)),
                    400, "invalid_input");
            assertError(post(client, PATH, room("DEMO-X", "01", unknown, null, null, 4, "Disponível"), csrf(client)),
                    400, "invalid_location");
            assertError(post(client, PATH, room("DEMO-X", "01", first, unknown, null, 4, "Disponível"), csrf(client)),
                    400, "invalid_location");
            assertError(post(client, PATH, room("DEMO-X", "01", first, secondUnit, null, 4, "Disponível"), csrf(client)),
                    400, "invalid_location");
            String original = createRoom(client, room("DEMO-A-01", "01", first, null, null, 4, "Disponível"));
            assertError(put(client, PATH + "/" + original,
                    edit(room("DEMO-A-01", "01", first, secondUnit, null, 8, "Ocupado"), 0), csrf(client)),
                    400, "invalid_location");
            JsonNode value = json.readTree(get(client, PATH + "/" + original).body());
            assertThat(value.path("version").asLong()).isZero();
            assertThat(value.path("capacity").asInt()).isEqualTo(4);
            assertThat(value.path("unitId").isNull()).isTrue();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_room", Integer.class)).isEqualTo(1);
        }
    }

    @Test
    void missingInvalidAndStaleVersionCannotOverwriteTheLatestRoom() throws Exception {
        gestorAccount();
        try (HttpClient client = browser()) {
            login(client, "gestor");
            String accommodation = accommodation(client, "DEMO-A");
            String base = room("DEMO-01", "01", accommodation, null, null, 4, "Disponível");
            String id = createRoom(client, base);
            assertError(put(client, PATH + "/" + id, base, csrf(client)), 400, "invalid_input");
            for (Object version : new Object[] { -1, 0.5, "0", Long.MAX_VALUE, true }) {
                assertError(put(client, PATH + "/" + id, edit(base, version), csrf(client)), 400, "invalid_input");
            }
            assertThat(put(client, PATH + "/" + id,
                    edit(room("DEMO-01", "01", accommodation, null, null, 6, "Ocupado"), 0), csrf(client))
                    .statusCode()).isEqualTo(200);
            assertError(put(client, PATH + "/" + id, edit(base, 0), csrf(client)), 409, "stale_version");
            JsonNode value = json.readTree(get(client, PATH + "/" + id).body());
            assertThat(value.path("capacity").asInt()).isEqualTo(6);
            assertThat(value.path("situation").asText()).isEqualTo("Ocupado");
            assertThat(value.path("version").asLong()).isEqualTo(1);
            assertError(put(client, PATH + "/" + UUID.randomUUID(), edit(base, 0), csrf(client)),
                    404, "not_found");
        }
    }

    @Test
    void mapStartsEmptyAndIncludesAllAccommodationUnitAndRoomReferences() throws Exception {
        gestorAccount();
        try (HttpClient client = browser()) {
            login(client, "gestor");
            HttpResponse<String> empty = get(client, PATH + "/mapa");
            assertThat(empty.statusCode()).isEqualTo(200);
            assertNoStore(empty);
            JsonNode emptyBody = json.readTree(empty.body());
            assertThat(emptyBody.size()).isEqualTo(3);
            for (String field : new String[] { "accommodations", "units", "rooms" }) {
                assertThat(emptyBody.path(field).isArray()).isTrue();
                assertThat(emptyBody.path(field).size()).isZero();
            }
            String first = accommodation(client, "DEMO-A");
            accommodation(client, "DEMO-VAZIO");
            String unit = unit(client, first, "CASA");
            String id = createRoom(client, room("DEMO-A-01", "01", first, unit, null, null, "Disponível"));
            JsonNode map = json.readTree(get(client, PATH + "/mapa").body());
            assertThat(map.path("accommodations").size()).isEqualTo(2);
            assertThat(map.path("units").size()).isEqualTo(1);
            assertThat(map.path("units").get(0).path("accommodationId").asText()).isEqualTo(first);
            assertThat(map.path("rooms").size()).isEqualTo(1);
            JsonNode value = map.path("rooms").get(0);
            assertThat(value.path("id").asText()).isEqualTo(id);
            assertThat(value.path("unitId").asText()).isEqualTo(unit);
            assertThat(value.path("capacity").isNull()).isTrue();
            assertThat(value.path("occupancy").asInt()).isZero();
            assertThat(value.path("vacancies").isNull()).isTrue();
            assertThat(value.path("cleaningScore").isNull()).isTrue();
        }
    }

    @Test
    void enforcesReadWriteProfilesCsrfAndAccountRevocationForEveryRoomEndpoint() throws Exception {
        for (String profile : new String[] { "gestor", "supervisor", "residente" }) {
            provisioning.create(profile + "@example.invalid", profile, profile, PASSWORD.toCharArray());
        }
        String id;
        String input;
        try (HttpClient gestor = browser()) {
            login(gestor, "gestor");
            String accommodation = accommodation(gestor, "DEMO-A");
            input = room("DEMO-01", "01", accommodation, null, null, 4, "Disponível");
            id = createRoom(gestor, input);
            assertThat(post(gestor, PATH,
                    room("DEMO-02", "02", accommodation, null, null, 4, "Disponível"), null).statusCode())
                    .isEqualTo(403);
            assertThat(put(gestor, PATH + "/" + id, edit(input, 0), null).statusCode()).isEqualTo(403);
            assertThat(send(gestor, jsonRequest(PATH + "/" + id, csrf(gestor)).DELETE().build())
                    .statusCode()).isEqualTo(403);
        }
        try (HttpClient supervisor = browser()) {
            login(supervisor, "supervisor");
            for (String path : new String[] { PATH, PATH + "/" + id, PATH + "/mapa" }) {
                assertThat(get(supervisor, path).statusCode()).isEqualTo(200);
            }
            assertThat(post(supervisor, PATH, input, csrf(supervisor)).statusCode()).isEqualTo(403);
            assertThat(put(supervisor, PATH + "/" + id, edit(input, 0), csrf(supervisor)).statusCode()).isEqualTo(403);
            provisioning.disable("supervisor@example.invalid");
            assertThat(get(supervisor, PATH + "/mapa").statusCode()).isEqualTo(401);
        }
        try (HttpClient residente = browser(); HttpClient anonymous = browser()) {
            login(residente, "residente");
            for (String path : new String[] { PATH, PATH + "/" + id, PATH + "/mapa" }) {
                assertThat(get(residente, path).statusCode()).isEqualTo(403);
                assertThat(get(anonymous, path).statusCode()).isEqualTo(401);
            }
            assertThat(post(residente, PATH, input, csrf(residente)).statusCode()).isEqualTo(403);
            assertThat(post(anonymous, PATH, input, csrf(anonymous)).statusCode()).isEqualTo(401);
        }
    }

    @Test
    void validatesIdentifiersFieldsAndManualSituationBeforeWriting() throws Exception {
        gestorAccount();
        try (HttpClient client = browser()) {
            login(client, "gestor");
            String accommodation = accommodation(client, "DEMO-A");
            for (String body : new String[] { "{}", "{", room(" ", "01", accommodation, null, null, 4, "Disponível"),
                    room("A".repeat(65), "01", accommodation, null, null, 4, "Disponível"),
                    room("DEMO", "N".repeat(65), accommodation, null, null, 4, "Disponível"),
                    room("DEMO", " ", accommodation, null, null, 4, "Disponível"),
                    room("DEMO", "01", accommodation, null, "A".repeat(65), 4, "Disponível"),
                    room("DEMO", "01", accommodation, null, "Térreo\nNorte", 4, "Disponível"),
                    room("DEMO", "01", accommodation, null, null, 4, "Outro"),
                    room("DEMO", "01", "not-a-uuid", null, null, 4, "Disponível") }) {
                assertError(post(client, PATH, body, csrf(client)), 400, "invalid_input");
            }
            assertError(get(client, PATH + "/not-a-uuid"), 400, "invalid_input");
            assertError(get(client, PATH + "/" + UUID.randomUUID()), 404, "not_found");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_room", Integer.class)).isZero();
        }
    }

    @Test
    void rejectsNonTextRoomFieldsWithoutPersistingOrIncrementingVersion() throws Exception {
        gestorAccount();
        try (HttpClient client = browser()) {
            login(client, "gestor");
            String accommodation = accommodation(client, "DEMO-TEXT");
            String base = room("DEMO-TEXT-01", "01", accommodation, null, null, 4, "Disponível");
            for (String field : new String[] { "code", "number", "floor", "situation" }) {
                for (Object invalid : new Object[] { 2, false, List.of("texto"), Map.of("text", "texto") }) {
                    assertError(post(client, PATH, replaceField(base, field, invalid), csrf(client)),
                            400, "invalid_input");
                }
            }
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_room", Integer.class)).isZero();
            String id = createRoom(client, base);
            for (String field : new String[] { "code", "number", "floor", "situation" }) {
                for (Object invalid : new Object[] { 2, false, List.of("texto"), Map.of("text", "texto") }) {
                    assertError(put(client, PATH + "/" + id,
                            replaceField(edit(base, 0), field, invalid), csrf(client)), 400, "invalid_input");
                }
            }
            JsonNode persisted = json.readTree(get(client, PATH + "/" + id).body());
            assertThat(persisted.path("code").asText()).isEqualTo("DEMO-TEXT-01");
            assertThat(persisted.path("number").asText()).isEqualTo("01");
            assertThat(persisted.path("floor").isNull()).isTrue();
            assertThat(persisted.path("situation").asText()).isEqualTo("Disponível");
            assertThat(persisted.path("version").asLong()).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_room", Integer.class)).isEqualTo(1);
        }
    }

    @Test
    void backendRestartPreservesEditedCapacityMapAndJdbcSession() throws Exception {
        gestorAccount();
        try (HttpClient client = browser()) {
            String roomId;
            try (var first = application("local")) {
                port = first.getWebServer().getPort();
                login(client, "gestor");
                String accommodation = accommodation(client, "DEMO-RESTART");
                String unit = unit(client, accommodation, "CASA");
                String base = room("DEMO-RESTART-01", "01", accommodation, unit, null, 4, "Disponível");
                roomId = createRoom(client, base);
                assertThat(put(client, PATH + "/" + roomId,
                        edit(room("DEMO-RESTART-01", "01", accommodation, unit, null, 8, "Ocupado"), 0),
                        csrf(client)).statusCode()).isEqualTo(200);
            }
            try (var restarted = application("local")) {
                port = restarted.getWebServer().getPort();
                HttpResponse<String> read = get(client, PATH + "/" + roomId);
                assertThat(read.statusCode()).isEqualTo(200);
                JsonNode value = json.readTree(read.body());
                assertThat(value.path("capacity").asInt()).isEqualTo(8);
                assertThat(value.path("version").asLong()).isEqualTo(1);
                assertThat(value.path("occupancy").asInt()).isZero();
                assertThat(value.path("vacancies").asInt()).isEqualTo(8);
                JsonNode map = json.readTree(get(client, PATH + "/mapa").body());
                assertThat(map.path("rooms").get(0).path("id").asText()).isEqualTo(roomId);
                assertThat(map.path("rooms").get(0).path("capacity").asInt()).isEqualTo(8);
                assertThat(map.path("units").size()).isEqualTo(1);
            }
        }
    }

    @Test
    void nonLocalModeBlocksRoomApiAndMap() throws Exception {
        try (var closed = application("production"); HttpClient client = browser()) {
            port = closed.getWebServer().getPort();
            for (String path : new String[] { PATH, PATH + "/mapa", PATH + "/" + UUID.randomUUID() }) {
                assertThat(get(client, path).statusCode()).isIn(401, 403);
            }
            assertThat(post(client, PATH, "{}", null).statusCode()).isIn(401, 403);
            assertThat(put(client, PATH + "/" + UUID.randomUUID(), "{}", null).statusCode()).isIn(401, 403);
        }
    }

    private ServletWebServerApplicationContext application(String profile) {
        SpringApplication application = new SpringApplication(SagerApplication.class);
        application.setAdditionalProfiles(profile);
        return (ServletWebServerApplicationContext) application.run("--server.port=0",
                "--spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                "--spring.datasource.username=" + POSTGRES.getUsername(),
                "--spring.datasource.password=" + POSTGRES.getPassword());
    }

    private void gestorAccount() {
        provisioning.create("gestor@example.invalid", "Gestor Sintético", "gestor", PASSWORD.toCharArray());
    }

    private String accommodation(HttpClient client, String code) throws Exception {
        HttpResponse<String> response = post(client, ACCOMMODATIONS,
                json.writeValueAsString(Map.of("code", code, "name", "Alojamento " + code)), csrf(client));
        assertThat(response.statusCode()).isEqualTo(201);
        return json.readTree(response.body()).path("id").asText();
    }

    private String unit(HttpClient client, String accommodation, String code) throws Exception {
        HttpResponse<String> response = post(client, ACCOMMODATIONS + "/" + accommodation + "/unidades",
                json.writeValueAsString(Map.of("code", code, "name", "Casa " + code)), csrf(client));
        assertThat(response.statusCode()).isEqualTo(201);
        return json.readTree(response.body()).path("id").asText();
    }

    private String createRoom(HttpClient client, String body) throws Exception {
        HttpResponse<String> response = post(client, PATH, body, csrf(client));
        assertThat(response.statusCode()).isEqualTo(201);
        return json.readTree(response.body()).path("id").asText();
    }

    private String room(String code, String number, String accommodation, String unit, String floor,
            Object capacity, String situation) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("code", code);
        value.put("number", number);
        value.put("accommodationId", accommodation);
        value.put("unitId", unit);
        value.put("floor", floor);
        value.put("capacity", capacity);
        value.put("situation", situation);
        return json.writeValueAsString(value);
    }

    private String edit(String body, Object version) {
        var value = (tools.jackson.databind.node.ObjectNode) json.readTree(body);
        value.set("version", json.valueToTree(version));
        return json.writeValueAsString(value);
    }

    private String replaceField(String body, String field, Object value) {
        var changed = (tools.jackson.databind.node.ObjectNode) json.readTree(body);
        changed.set(field, json.valueToTree(value));
        return json.writeValueAsString(changed);
    }

    private void login(HttpClient client, String profile) throws Exception {
        String form = "email=" + URLEncoder.encode(profile + "@example.invalid", StandardCharsets.UTF_8)
                + "&password=" + URLEncoder.encode(PASSWORD, StandardCharsets.UTF_8);
        assertThat(send(client, HttpRequest.newBuilder(uri("/api/v1/auth/login"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("X-CSRF-TOKEN", csrf(client))
                .POST(HttpRequest.BodyPublishers.ofString(form)).build()).statusCode()).isEqualTo(204);
    }

    private String csrf(HttpClient client) throws Exception {
        HttpResponse<String> response = get(client, "/api/v1/auth/csrf");
        assertThat(response.statusCode()).isEqualTo(200);
        return json.readTree(response.body()).path("token").asText();
    }

    private void assertError(HttpResponse<String> response, int status, String code) {
        assertThat(response.statusCode()).isEqualTo(status);
        assertNoStore(response);
        JsonNode body = json.readTree(response.body());
        assertThat(body.path("code").asText()).isEqualTo(code);
        assertThat(body.path("message").asText()).isNotBlank();
        assertThat(response.body()).doesNotContain("password", "sql", "org.springframework");
    }

    private void assertNoStore(HttpResponse<String> response) {
        assertThat(response.headers().firstValue("Cache-Control").orElseThrow()).contains("no-store");
    }

    private HttpResponse<String> get(HttpClient client, String path) throws Exception {
        return send(client, HttpRequest.newBuilder(uri(path)).GET().build());
    }

    private HttpResponse<String> post(HttpClient client, String path, String body, String csrf) throws Exception {
        return send(client, jsonRequest(path, csrf).POST(HttpRequest.BodyPublishers.ofString(body)).build());
    }

    private HttpResponse<String> put(HttpClient client, String path, String body, String csrf) throws Exception {
        return send(client, jsonRequest(path, csrf).PUT(HttpRequest.BodyPublishers.ofString(body)).build());
    }

    private HttpRequest.Builder jsonRequest(String path, String csrf) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json");
        if (csrf != null) {
            builder.header("X-CSRF-TOKEN", csrf);
        }
        return builder;
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
