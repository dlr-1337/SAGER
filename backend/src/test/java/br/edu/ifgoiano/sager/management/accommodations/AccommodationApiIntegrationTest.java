package br.edu.ifgoiano.sager.management.accommodations;

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
class AccommodationApiIntegrationTest {
    private static final String PASSWORD = "Senha sintetica 123!";
    private static final String PATH = "/api/v1/alojamentos";
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
    void cleanSessionsAndAccounts() {
        jdbc.update("DELETE FROM spring_session");
        jdbc.update("DELETE FROM sager_local_account");
        if (jdbc.queryForObject("SELECT to_regclass('sager_accommodation_unit')", String.class)
                != null) {
            jdbc.update("DELETE FROM sager_accommodation_unit");
            jdbc.update("DELETE FROM sager_accommodation");
        }
    }

    @Test
    void gestorCreatesReadsAndUpdatesAccommodationAndUnitWithPersistedVersion() throws Exception {
        provisioning.create("gestor@example.invalid", "Gestor Sintético", "gestor",
                PASSWORD.toCharArray());
        try (HttpClient client = browser()) {
            login(client, "gestor");
            HttpResponse<String> created = post(client, PATH,
                    input(" DEMO-RES ", " Residência Sintética "), csrf(client));
            assertThat(created.statusCode()).isEqualTo(201);
            assertNoStore(created);
            JsonNode accommodation = json.readTree(created.body());
            String id = accommodation.path("id").asText();
            assertThat(UUID.fromString(id)).isNotNull();
            assertThat(accommodation.path("code").asText()).isEqualTo("DEMO-RES");
            assertThat(accommodation.path("name").asText()).isEqualTo("Residência Sintética");
            assertThat(accommodation.path("version").asLong()).isZero();
            assertThat(accommodation.size()).isEqualTo(4);
            assertThat(created.headers().firstValue("Location").orElseThrow())
                    .isEqualTo(PATH + "/" + id);
            assertThat(json.readTree(get(client, PATH).body()).size()).isEqualTo(1);
            assertThat(json.readTree(get(client, PATH + "/" + id).body()).path("name").asText())
                    .isEqualTo("Residência Sintética");

            HttpResponse<String> updated = put(client, PATH + "/" + id,
                    update("DEMO-RES", "Residência Editada", 0), csrf(client));
            assertThat(updated.statusCode()).isEqualTo(200);
            assertThat(json.readTree(updated.body()).path("version").asLong()).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT name FROM sager_accommodation WHERE id = ?",
                    String.class, UUID.fromString(id))).isEqualTo("Residência Editada");

            String units = PATH + "/" + id + "/unidades";
            assertThat(json.readTree(get(client, units).body()).size()).isZero();
            HttpResponse<String> unitCreated = post(client, units,
                    input("DEMO-CASA", "Casa Sintética"), csrf(client));
            assertThat(unitCreated.statusCode()).isEqualTo(201);
            assertNoStore(unitCreated);
            JsonNode unit = json.readTree(unitCreated.body());
            String unitId = unit.path("id").asText();
            assertThat(unit.path("accommodationId").asText()).isEqualTo(id);
            assertThat(unit.path("version").asLong()).isZero();
            assertThat(unit.size()).isEqualTo(5);
            assertThat(unitCreated.headers().firstValue("Location").orElseThrow())
                    .isEqualTo(units + "/" + unitId);
            assertThat(json.readTree(get(client, units).body()).size()).isEqualTo(1);
            assertThat(get(client, units + "/" + unitId).statusCode()).isEqualTo(200);
            assertThat(put(client, units + "/" + unitId,
                    update("DEMO-CASA", "Casa Editada", 0), csrf(client)).statusCode())
                    .isEqualTo(200);
            assertThat(json.readTree(get(client, units + "/" + unitId).body())
                    .path("version").asLong()).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT name FROM sager_accommodation_unit WHERE id = ?",
                    String.class, UUID.fromString(unitId))).isEqualTo("Casa Editada");
            assertAudit(id, "ACCOMMODATION", "CREATE", 0, "code", "name");
            assertAudit(id, "ACCOMMODATION", "UPDATE", 1, "name");
            assertAudit(unitId, "ACCOMMODATION_UNIT", "CREATE", 0, "accommodationId", "code", "name");
            assertAudit(unitId, "ACCOMMODATION_UNIT", "UPDATE", 1, "name");
        }
    }

    @Test
    void codesAreCaseInsensitiveAndUnitCodesAreScopedToTheirAccommodation() throws Exception {
        provisioning.create("gestor@example.invalid", "Gestor", "gestor", PASSWORD.toCharArray());
        try (HttpClient client = browser()) {
            login(client, "gestor");
            String first = create(client, "DEMO-A", "Residência A");
            String second = create(client, "DEMO-B", "Residência B");
            assertError(post(client, PATH, input("demo-a", "Duplicada"), csrf(client)),
                    409, "duplicate_code");
            assertError(put(client, PATH + "/" + second,
                    update("demo-a", "Residência B", 0), csrf(client)), 409, "duplicate_code");
            String unitsA = PATH + "/" + first + "/unidades";
            String unitsB = PATH + "/" + second + "/unidades";
            assertThat(post(client, unitsA, input("CASA-01", "Casa A"), csrf(client))
                    .statusCode()).isEqualTo(201);
            assertError(post(client, unitsA, input("casa-01", "Duplicada"), csrf(client)),
                    409, "duplicate_code");
            assertThat(post(client, unitsB, input("casa-01", "Casa B"), csrf(client))
                    .statusCode()).isEqualTo(201);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_accommodation_unit",
                    Integer.class)).isEqualTo(2);
        }
    }

    @Test
    void staleVersionsCannotOverwritePersistedAccommodationOrUnit() throws Exception {
        provisioning.create("gestor@example.invalid", "Gestor", "gestor", PASSWORD.toCharArray());
        try (HttpClient client = browser()) {
            login(client, "gestor");
            String id = create(client, "DEMO-A", "Residência A");
            assertThat(put(client, PATH + "/" + id,
                    update("DEMO-A", "Versão Nova", 0), csrf(client)).statusCode()).isEqualTo(200);
            assertError(put(client, PATH + "/" + id,
                    update("DEMO-A", "Versão Velha", 0), csrf(client)), 409, "stale_version");
            assertError(put(client, PATH + "/" + id, input("DEMO-A", "Sem Versão"), csrf(client)),
                    400, "invalid_input");
            String units = PATH + "/" + id + "/unidades";
            String unitId = json.readTree(post(client, units,
                    input("CASA-01", "Casa"), csrf(client)).body()).path("id").asText();
            assertThat(put(client, units + "/" + unitId,
                    update("CASA-01", "Casa Nova", 0), csrf(client)).statusCode()).isEqualTo(200);
            assertError(put(client, units + "/" + unitId,
                    update("CASA-01", "Casa Velha", 0), csrf(client)), 409, "stale_version");
            assertThat(json.readTree(get(client, PATH + "/" + id).body()).path("name").asText())
                    .isEqualTo("Versão Nova");
            assertThat(json.readTree(get(client, units + "/" + unitId).body()).path("name").asText())
                    .isEqualTo("Casa Nova");
        }
    }

    @Test
    void validatesFieldsMissingIdsAndUnitParentWithoutMovingUnit() throws Exception {
        provisioning.create("gestor@example.invalid", "Gestor", "gestor", PASSWORD.toCharArray());
        try (HttpClient client = browser()) {
            login(client, "gestor");
            for (String body : new String[] { "{}", "{", input(" ", "Nome"),
                    input("A".repeat(65), "Nome"), input("A", "N".repeat(201)),
                    "{\"code\":\"A\\nB\",\"name\":\"Nome\"}" }) {
                assertError(post(client, PATH, body, csrf(client)), 400, "invalid_input");
            }
            assertError(get(client, PATH + "/not-a-uuid"), 400, "invalid_input");
            String unknown = UUID.randomUUID().toString();
            assertError(get(client, PATH + "/" + unknown), 404, "not_found");
            assertError(put(client, PATH + "/" + unknown,
                    update("DEMO-X", "Não Existe", 0), csrf(client)), 404, "not_found");
            assertError(get(client, PATH + "/" + unknown + "/unidades"), 404, "not_found");
            assertError(post(client, PATH + "/" + unknown + "/unidades",
                    input("CASA", "Sem Alojamento"), csrf(client)), 404, "not_found");
            String first = create(client, "DEMO-A", "Residência A");
            String second = create(client, "DEMO-B", "Residência B");
            String units = PATH + "/" + first + "/unidades";
            String unitId = json.readTree(post(client, units,
                    input("CASA", "Casa"), csrf(client)).body()).path("id").asText();
            String wrongParent = PATH + "/" + second + "/unidades/" + unitId;
            assertError(get(client, wrongParent), 404, "not_found");
            assertError(put(client, wrongParent, update("CASA", "Movida", 0), csrf(client)),
                    404, "not_found");
            assertThat(jdbc.queryForObject("SELECT accommodation_id FROM sager_accommodation_unit"
                    + " WHERE id = ?", UUID.class, UUID.fromString(unitId)))
                    .isEqualTo(UUID.fromString(first));
        }
    }

    @Test
    void rejectsNonTextFieldsInCreateAndUpdateWithoutChangingVersion() throws Exception {
        provisioning.create("gestor@example.invalid", "Gestor", "gestor", PASSWORD.toCharArray());
        try (HttpClient client = browser()) {
            login(client, "gestor");
            String base = input("DEMO-TEXT", "Residência Sintética");
            for (String field : new String[] { "code", "name" }) {
                for (Object invalid : new Object[] { 1, false, List.of("texto"), Map.of("text", "texto") }) {
                    assertError(post(client, PATH, replaceField(base, field, invalid), csrf(client)),
                            400, "invalid_input");
                }
            }
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_accommodation", Integer.class)).isZero();
            String id = create(client, "DEMO-TEXT", "Residência Sintética");
            String units = PATH + "/" + id + "/unidades";
            String unitBase = input("CASA-TEXT", "Casa Sintética");
            for (String field : new String[] { "code", "name" }) {
                for (Object invalid : new Object[] { 1, false, List.of("texto"), Map.of("text", "texto") }) {
                    assertError(post(client, units, replaceField(unitBase, field, invalid), csrf(client)),
                            400, "invalid_input");
                    assertError(put(client, PATH + "/" + id,
                            replaceField(update("DEMO-TEXT", "Residência Alterada", 0), field, invalid), csrf(client)),
                            400, "invalid_input");
                }
            }
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_accommodation_unit", Integer.class)).isZero();
            String unitId = json.readTree(post(client, units, unitBase, csrf(client)).body()).path("id").asText();
            for (String field : new String[] { "code", "name" }) {
                for (Object invalid : new Object[] { 1, false, List.of("texto"), Map.of("text", "texto") }) {
                    assertError(put(client, units + "/" + unitId,
                            replaceField(update("CASA-TEXT", "Casa Alterada", 0), field, invalid), csrf(client)),
                            400, "invalid_input");
                }
            }
            JsonNode accommodation = json.readTree(get(client, PATH + "/" + id).body());
            assertThat(accommodation.path("name").asText()).isEqualTo("Residência Sintética");
            assertThat(accommodation.path("code").asText()).isEqualTo("DEMO-TEXT");
            assertThat(accommodation.path("version").asLong()).isZero();
            JsonNode unit = json.readTree(get(client, units + "/" + unitId).body());
            assertThat(unit.path("name").asText()).isEqualTo("Casa Sintética");
            assertThat(unit.path("code").asText()).isEqualTo("CASA-TEXT");
            assertThat(unit.path("version").asLong()).isZero();
        }
    }

    @Test
    void gestorAndSupervisorReadWriteWithCsrfAndActiveSession() throws Exception {
        for (String profile : new String[] { "gestor", "supervisor", "residente" }) {
            provisioning.create(profile + "@example.invalid", profile, profile, PASSWORD.toCharArray());
        }
        String id;
        try (HttpClient gestor = browser()) {
            login(gestor, "gestor");
            id = create(gestor, "DEMO-A", "Residência A");
            assertThat(post(gestor, PATH, input("DEMO-B", "Sem CSRF"), null).statusCode())
                    .isEqualTo(403);
            assertThat(put(gestor, PATH + "/" + id, update("DEMO-A", "Sem CSRF", 0), null)
                    .statusCode()).isEqualTo(403);
        }
        String units = PATH + "/" + id + "/unidades";
        try (HttpClient supervisor = browser()) {
            login(supervisor, "supervisor");
            for (String path : new String[] { PATH, PATH + "/" + id, units }) {
                assertThat(get(supervisor, path).statusCode()).isEqualTo(200);
            }
            assertThat(post(supervisor, PATH, input("DEMO-B", "Sem CSRF"), null)
                    .statusCode()).isEqualTo(403);
            assertThat(post(supervisor, PATH, input("DEMO-B", "Residência B"), csrf(supervisor))
                    .statusCode()).isEqualTo(201);
            assertThat(put(supervisor, PATH + "/" + id,
                    update("DEMO-A", "Residência A Atualizada", 0), csrf(supervisor)).statusCode())
                    .isEqualTo(200);
            HttpResponse<String> unitCreated = post(supervisor, units,
                    input("CASA", "Casa Sintética"), csrf(supervisor));
            assertThat(unitCreated.statusCode()).isEqualTo(201);
            String unitId = json.readTree(unitCreated.body()).path("id").asText();
            assertThat(put(supervisor, units + "/" + unitId,
                    update("CASA", "Casa Atualizada", 0), csrf(supervisor)).statusCode())
                    .isEqualTo(200);
            assertThat(json.readTree(get(supervisor, units + "/" + unitId).body())
                    .path("name").asText()).isEqualTo("Casa Atualizada");
            provisioning.disable("supervisor@example.invalid");
            assertThat(get(supervisor, PATH).statusCode()).isEqualTo(401);
        }
        try (HttpClient residente = browser(); HttpClient anonymous = browser()) {
            login(residente, "residente");
            assertThat(get(residente, PATH).statusCode()).isEqualTo(403);
            assertThat(get(anonymous, PATH).statusCode()).isEqualTo(401);
            assertThat(post(anonymous, PATH, input("DEMO-C", "Anônimo"), csrf(anonymous))
                    .statusCode()).isEqualTo(401);
        }
    }

    @Test
    void nonLocalModeDoesNotExposeAccommodationOrUnitApi() throws Exception {
        SpringApplication application = new SpringApplication(SagerApplication.class);
        application.setAdditionalProfiles("production");
        try (var context = application.run("--server.port=0",
                "--spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                "--spring.datasource.username=" + POSTGRES.getUsername(),
                "--spring.datasource.password=" + POSTGRES.getPassword())) {
            int closedPort = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
            try (HttpClient client = browser()) {
                for (String path : new String[] { PATH, PATH + "/" + UUID.randomUUID() + "/unidades" }) {
                    HttpResponse<String> response = client.send(HttpRequest.newBuilder(
                            URI.create("http://127.0.0.1:" + closedPort + path)).GET().build(),
                            HttpResponse.BodyHandlers.ofString());
                    assertThat(response.statusCode()).isIn(401, 403);
                }
            }
        }
    }

    private String create(HttpClient client, String code, String name) throws Exception {
        HttpResponse<String> response = post(client, PATH, input(code, name), csrf(client));
        assertThat(response.statusCode()).isEqualTo(201);
        return json.readTree(response.body()).path("id").asText();
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

    private String input(String code, String name) {
        return json.writeValueAsString(Map.of("code", code, "name", name));
    }

    private String update(String code, String name, long version) {
        return json.writeValueAsString(Map.of("code", code, "name", name, "version", version));
    }

    private String replaceField(String body, String field, Object value) {
        var changed = (tools.jackson.databind.node.ObjectNode) json.readTree(body);
        changed.set(field, json.valueToTree(value));
        return json.writeValueAsString(changed);
    }

    private void assertAudit(String id, String resource, String action, long version, String... fields) {
        assertThat(jdbc.queryForObject("SELECT to_regclass('sager_audit_event')", String.class)).isNotNull();
        List<List<String>> recorded = jdbc.query("""
                SELECT changed_fields FROM sager_audit_event
                WHERE resource = ? AND resource_id = ? AND action = ? AND resulting_version = ?
                """, (result, row) -> List.of((String[]) result.getArray(1).getArray()),
                resource, UUID.fromString(id), action, version);
        assertThat(recorded).hasSize(1);
        assertThat(recorded.getFirst()).containsExactlyInAnyOrder(fields);
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

    private HttpResponse<String> post(HttpClient client, String path, String body, String csrf)
            throws Exception {
        return send(client, jsonRequest(path, csrf).POST(HttpRequest.BodyPublishers.ofString(body)).build());
    }

    private HttpResponse<String> put(HttpClient client, String path, String body, String csrf)
            throws Exception {
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
