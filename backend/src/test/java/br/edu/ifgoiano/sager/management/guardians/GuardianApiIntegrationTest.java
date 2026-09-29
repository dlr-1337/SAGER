package br.edu.ifgoiano.sager.management.guardians;

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
class GuardianApiIntegrationTest {
    private static final String PASSWORD = "Senha sintética 123!";
    private static final String PATH = "/api/v1/responsaveis";
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
        jdbc.update("DELETE FROM sager_guardian");
        jdbc.update("DELETE FROM sager_resident");
        jdbc.update("DELETE FROM sager_local_account");
    }

    @Test
    void createsMultipleGuardiansPerResidentAndEditsWithoutInventingAuthorization() throws Exception {
        account("gestor");
        UUID resident = resident("DEMO-A");
        UUID secondResident = resident("DEMO-B");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            assertThat(json.readTree(get(client, PATH).body()).size()).isZero();
            HttpResponse<String> created = post(client, PATH,
                    body(resident, "  Pessoa Responsável  ", "  Guardiã  ", "  ", true, null),
                    csrf(client));
            assertThat(created.statusCode()).isEqualTo(201);
            assertNoStore(created);
            JsonNode value = json.readTree(created.body());
            String id = value.path("id").asText();
            assertThat(UUID.fromString(id)).isNotNull();
            assertThat(created.headers().firstValue("Location").orElseThrow())
                    .isEqualTo(PATH + "/" + id);
            assertThat(value.size()).isEqualTo(7);
            assertThat(value.path("residentId").asText()).isEqualTo(resident.toString());
            assertThat(value.path("name").asText()).isEqualTo("Pessoa Responsável");
            assertThat(value.path("relationship").asText()).isEqualTo("Guardiã");
            assertThat(value.path("phone").isNull()).isTrue();
            assertThat(value.path("active").asBoolean()).isTrue();
            assertThat(value.path("version").asLong()).isZero();
            create(client, resident, "Outra Pessoa");
            assertThat(json.readTree(get(client, PATH).body()).size()).isEqualTo(2);
            assertNoStore(get(client, PATH + "/" + id));

            HttpResponse<String> changed = put(client, PATH + "/" + id,
                    body(secondResident, "Pessoa Atualizada", "Pai", "(00) 00000-0000", false, 0),
                    csrf(client));
            assertThat(changed.statusCode()).isEqualTo(200);
            JsonNode updated = json.readTree(changed.body());
            assertThat(updated.path("residentId").asText()).isEqualTo(secondResident.toString());
            assertThat(updated.path("phone").asText()).isEqualTo("(00) 00000-0000");
            assertThat(updated.path("active").asBoolean()).isFalse();
            assertThat(updated.path("version").asLong()).isEqualTo(1);
            assertThat(json.readTree(get(client, PATH + "/" + id).body()).path("name").asText())
                    .isEqualTo("Pessoa Atualizada");
            assertThat(jdbc.queryForObject("SELECT created_at IS NOT NULL AND updated_at IS NOT NULL "
                    + "FROM sager_guardian WHERE id = ?", Boolean.class, UUID.fromString(id))).isTrue();
        }
    }

    @Test
    void rejectsBadInputAndMissingResidentWithoutWriting() throws Exception {
        account("gestor");
        UUID resident = resident("DEMO-A");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            for (String invalid : List.of("{}", "{", body(null, "Pessoa", "Mãe", null, true, null),
                    body("not-a-uuid", "Pessoa", "Mãe", null, true, null),
                    body(123, "Pessoa", "Mãe", null, true, null),
                    body(resident, "AB", "Mãe", null, true, null),
                    body(resident, "N".repeat(201), "Mãe", null, true, null),
                    body(resident, "Pessoa", "A", null, true, null),
                    body(resident, "Pessoa", "V".repeat(81), null, true, null),
                    body(resident, "Pessoa", "Mãe", "9".repeat(31), true, null),
                    body(resident, 123, "Mãe", null, true, null),
                    body(resident, "Pessoa", false, null, true, null),
                    body(resident, "Pessoa", "Mãe", 123, true, null),
                    body(resident, "Pessoa", "Mãe", null, null, null),
                    body(resident, "Pessoa", "Mãe", null, "true", null))) {
                assertError(post(client, PATH, invalid, csrf(client)), 400, "invalid_input");
            }
            assertError(post(client, PATH,
                    body(UUID.randomUUID(), "Pessoa", "Mãe", null, true, null), csrf(client)),
                    422, "invalid_reference");
            assertError(get(client, PATH + "/not-a-uuid"), 400, "invalid_input");
            assertError(get(client, PATH + "/" + UUID.randomUUID()), 404, "not_found");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_guardian", Integer.class)).isZero();
        }
    }

    @Test
    void updateRejectsMissingReferenceMissingVersionAndStaleWrites() throws Exception {
        account("gestor");
        UUID resident = resident("DEMO-A");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            String id = create(client, resident, "Pessoa Responsável");
            for (Object invalidVersion : List.of(-1, 0.5, "0", Long.MAX_VALUE, true)) {
                assertError(put(client, PATH + "/" + id,
                        body(resident, "Pessoa", "Mãe", null, true, invalidVersion), csrf(client)),
                        400, "invalid_input");
            }
            assertError(put(client, PATH + "/" + id,
                    body(resident, "Pessoa", "Mãe", null, true, null), csrf(client)),
                    400, "invalid_input");
            assertError(put(client, PATH + "/" + id,
                    body(UUID.randomUUID(), "Pessoa", "Mãe", null, true, 0), csrf(client)),
                    422, "invalid_reference");
            assertError(put(client, PATH + "/" + UUID.randomUUID(),
                    body(resident, "Pessoa", "Mãe", null, true, 0), csrf(client)),
                    404, "not_found");
            assertThat(put(client, PATH + "/" + id,
                    body(resident, "Pessoa Atualizada", "Mãe", null, true, 0), csrf(client))
                    .statusCode()).isEqualTo(200);
            assertError(put(client, PATH + "/" + id,
                    body(resident, "Alteração Perdida", "Mãe", null, true, 0), csrf(client)),
                    409, "stale_version");
            assertThat(json.readTree(get(client, PATH + "/" + id).body()).path("name").asText())
                    .isEqualTo("Pessoa Atualizada");
        }
    }

    @Test
    void enforcesRolesCsrfAndDisabledAccounts() throws Exception {
        for (String profile : List.of("gestor", "supervisor", "residente")) {
            account(profile);
        }
        UUID resident = resident("DEMO-A");
        String id;
        try (HttpClient gestor = browser()) {
            login(gestor, "gestor");
            id = create(gestor, resident, "Pessoa Responsável");
            assertThat(post(gestor, PATH, body(resident, "Outra Pessoa", "Pai", null, true, null),
                    null).statusCode()).isEqualTo(403);
            assertThat(put(gestor, PATH + "/" + id,
                    body(resident, "Pessoa", "Mãe", null, true, 0), null).statusCode())
                    .isEqualTo(403);
        }
        try (HttpClient supervisor = browser()) {
            login(supervisor, "supervisor");
            assertThat(get(supervisor, PATH).statusCode()).isEqualTo(200);
            assertThat(get(supervisor, PATH + "/" + id).statusCode()).isEqualTo(200);
            assertThat(post(supervisor, PATH,
                    body(resident, "Outra Pessoa", "Pai", null, true, null), csrf(supervisor))
                    .statusCode()).isEqualTo(403);
            assertThat(put(supervisor, PATH + "/" + id,
                    body(resident, "Pessoa", "Mãe", null, true, 0), csrf(supervisor))
                    .statusCode()).isEqualTo(403);
            provisioning.disable("supervisor@example.invalid");
            assertThat(get(supervisor, PATH).statusCode()).isEqualTo(401);
        }
        try (HttpClient residente = browser(); HttpClient anonymous = browser()) {
            login(residente, "residente");
            for (String path : List.of(PATH, PATH + "/" + id)) {
                assertThat(get(residente, path).statusCode()).isEqualTo(403);
                assertThat(get(anonymous, path).statusCode()).isEqualTo(401);
            }
            assertThat(post(residente, PATH,
                    body(resident, "Pessoa", "Mãe", null, true, null), csrf(residente))
                    .statusCode()).isEqualTo(403);
            assertThat(post(anonymous, PATH,
                    body(resident, "Pessoa", "Mãe", null, true, null), csrf(anonymous))
                    .statusCode()).isEqualTo(401);
            assertThat(put(residente, PATH + "/" + id,
                    body(resident, "Pessoa", "Mãe", null, true, 0), csrf(residente))
                    .statusCode()).isEqualTo(403);
            assertThat(put(anonymous, PATH + "/" + id,
                    body(resident, "Pessoa", "Mãe", null, true, 0), csrf(anonymous))
                    .statusCode()).isEqualTo(401);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_guardian", Integer.class)).isEqualTo(1);
    }

    @Test
    void outsideLocalProfileDoesNotExposeGuardianApi() throws Exception {
        SpringApplication application = new SpringApplication(SagerApplication.class);
        application.setAdditionalProfiles("production");
        try (var context = application.run("--server.port=0",
                "--spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                "--spring.datasource.username=" + POSTGRES.getUsername(),
                "--spring.datasource.password=" + POSTGRES.getPassword())) {
            int closedPort = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
            try (HttpClient client = browser()) {
                HttpResponse<String> response = client.send(HttpRequest.newBuilder(
                        URI.create("http://127.0.0.1:" + closedPort + PATH)).GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                assertThat(response.statusCode()).isIn(401, 403);
            }
        }
    }

    private UUID resident(String enrollment) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident (id, name, enrollment) VALUES (?, ?, ?)",
                id, "Estudante Sintético", enrollment);
        return id;
    }

    private void account(String profile) {
        provisioning.create(profile + "@example.invalid", "Pessoa Sintética", profile,
                PASSWORD.toCharArray());
    }

    private String create(HttpClient client, UUID residentId, String name) throws Exception {
        HttpResponse<String> response = post(client, PATH,
                body(residentId, name, "Mãe", null, true, null), csrf(client));
        assertThat(response.statusCode()).isEqualTo(201);
        return json.readTree(response.body()).path("id").asText();
    }

    private String body(Object residentId, Object name, Object relationship, Object phone,
            Object active, Object version) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("residentId", residentId);
        fields.put("name", name);
        fields.put("relationship", relationship);
        fields.put("phone", phone);
        fields.put("active", active);
        if (version != null) {
            fields.put("version", version);
        }
        return json.writeValueAsString(fields);
    }

    private void login(HttpClient client, String profile) throws Exception {
        String form = "email=" + URLEncoder.encode(profile + "@example.invalid", StandardCharsets.UTF_8)
                + "&password=" + URLEncoder.encode(PASSWORD, StandardCharsets.UTF_8);
        HttpRequest request = HttpRequest.newBuilder(uri("/api/v1/auth/login"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("X-CSRF-TOKEN", csrf(client))
                .POST(HttpRequest.BodyPublishers.ofString(form)).build();
        assertThat(send(client, request).statusCode()).isEqualTo(204);
    }

    private String csrf(HttpClient client) throws Exception {
        HttpResponse<String> response = get(client, "/api/v1/auth/csrf");
        assertThat(response.statusCode()).isEqualTo(200);
        return json.readTree(response.body()).path("token").asText();
    }

    private void assertError(HttpResponse<String> response, int status, String code) throws Exception {
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

    private HttpResponse<String> post(HttpClient client, String path, String body, String token)
            throws Exception {
        return send(client, jsonRequest(path, token).POST(HttpRequest.BodyPublishers.ofString(body)).build());
    }

    private HttpResponse<String> put(HttpClient client, String path, String body, String token)
            throws Exception {
        return send(client, jsonRequest(path, token).PUT(HttpRequest.BodyPublishers.ofString(body)).build());
    }

    private HttpRequest.Builder jsonRequest(String path, String token) {
        HttpRequest.Builder request = HttpRequest.newBuilder(uri(path))
                .header("Content-Type", "application/json");
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
