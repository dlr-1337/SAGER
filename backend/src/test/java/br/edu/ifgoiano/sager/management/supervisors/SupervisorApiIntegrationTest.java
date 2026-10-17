package br.edu.ifgoiano.sager.management.supervisors;

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
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;
import br.edu.ifgoiano.sager.auth.LocalAccount;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
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

import br.edu.ifgoiano.sager.SagerApplication;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class SupervisorApiIntegrationTest {
    private static final String PASSWORD = "Senha sintetica 123!";
    private static final String PATH = "/api/v1/supervisores";
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
        jdbc.update("DELETE FROM sager_supervisor");
    }

    @Test
    void gestorCreatesListsReadsAndUpdatesPersistedSupervisorWithoutProvisioningAnAccount()
            throws Exception {
        assertThat(jdbc.queryForObject("SELECT to_regclass('sager_supervisor')", String.class))
                .isNotNull();
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("gestor@example.invalid"), "gestor@example.invalid", "Gestor Sintetico", "gestor",
                PASSWORD.toCharArray());
        try (HttpClient client = browser()) {
            login(client, "gestor@example.invalid");
            assertThat(json.readTree(get(client, PATH).body()).size()).isZero();

            HttpResponse<String> created = post(client, PATH,
                    input("Ana Exemplo", "DEMO-SUP-001", "Ana@demo.invalid"), csrfToken(client));
            assertThat(created.statusCode()).isEqualTo(201);
            assertThat(created.headers().firstValue("Location").orElseThrow())
                    .startsWith(PATH + "/");
            assertThat(created.headers().firstValue("Cache-Control").orElseThrow())
                    .contains("no-store");
            JsonNode createdBody = json.readTree(created.body());
            String id = createdBody.path("id").asText();
            assertThat(UUID.fromString(id)).isNotNull();
            assertThat(createdBody.path("name").asText()).isEqualTo("Ana Exemplo");
            assertThat(createdBody.path("institutionalId").asText()).isEqualTo("DEMO-SUP-001");
            assertThat(createdBody.path("email").asText()).isEqualTo("ana@demo.invalid");
            assertThat(createdBody.path("version").asLong()).isZero();
            assertThat(createdBody.size()).isEqualTo(5);

            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_supervisor", Integer.class))
                    .isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_local_account", Integer.class))
                    .isEqualTo(1);
            assertThat(json.readTree(get(client, PATH).body()).get(0).path("id").asText())
                    .isEqualTo(id);
            assertThat(json.readTree(get(client, PATH + "/" + id).body()).path("name").asText())
                    .isEqualTo("Ana Exemplo");

            HttpResponse<String> updated = put(client, PATH + "/" + id,
                    updateInput("Ana Editada", "DEMO-SUP-002", "editada@demo.invalid", 0),
                    csrfToken(client));
            assertThat(updated.statusCode()).isEqualTo(200);
            assertThat(json.readTree(updated.body()).path("version").asLong()).isEqualTo(1);
            assertThat(json.readTree(get(client, PATH + "/" + id).body()).path("name").asText())
                    .isEqualTo("Ana Editada");
            assertThat(jdbc.queryForObject("SELECT institutional_id FROM sager_supervisor WHERE id = ?",
                    String.class, UUID.fromString(id))).isEqualTo("DEMO-SUP-002");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_local_account", Integer.class))
                    .isEqualTo(1);
            assertAudit(id, "CREATE", 0, "name", "institutionalId", "email");
            assertAudit(id, "UPDATE", 1, "name", "institutionalId", "email");
        }
    }

    @Test
    void rejectsInvalidDuplicateMissingAndStaleWritesWithoutOverwritingData() throws Exception {
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("gestor@example.invalid"), "gestor@example.invalid", "Gestor Sintetico", "gestor",
                PASSWORD.toCharArray());
        try (HttpClient client = browser()) {
            login(client, "gestor@example.invalid");
            assertError(post(client, PATH, "{}", csrfToken(client)), 400, "invalid_input");
            assertError(post(client, PATH, input("Ana", "DEMO-001", "invalido"),
                    csrfToken(client)), 400, "invalid_input");
            assertError(post(client, PATH, input(" ", "DEMO-001", "ana@demo.invalid"),
                    csrfToken(client)), 400, "invalid_input");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_supervisor", Integer.class))
                    .isZero();

            String firstId = json.readTree(post(client, PATH,
                    input("Ana", "DEMO-001", "ana@demo.invalid"), csrfToken(client)).body())
                    .path("id").asText();
            assertError(post(client, PATH, input("Outra", "demo-001", "outra@demo.invalid"),
                    csrfToken(client)), 409, "duplicate_institutional_id");

            String secondId = json.readTree(post(client, PATH,
                    input("Bia", "DEMO-002", "bia@demo.invalid"), csrfToken(client)).body())
                    .path("id").asText();
            assertError(put(client, PATH + "/" + secondId,
                    updateInput("Bia", "DEMO-001", "bia@demo.invalid", 0),
                    csrfToken(client)), 409, "duplicate_institutional_id");
            assertThat(put(client, PATH + "/" + firstId,
                    updateInput("Ana Atualizada", "DEMO-001", "ana@demo.invalid", 0),
                    csrfToken(client)).statusCode()).isEqualTo(200);
            assertError(put(client, PATH + "/" + firstId,
                    updateInput("Ana Velha", "DEMO-001", "ana@demo.invalid", 0),
                    csrfToken(client)), 409, "stale_version");
            assertError(put(client, PATH + "/" + firstId,
                    json.writeValueAsString(Map.of("name", "Ana", "institutionalId", "DEMO-001",
                            "email", "ana@demo.invalid")), csrfToken(client)), 400,
                    "invalid_input");
            assertThat(json.readTree(get(client, PATH + "/" + firstId).body())
                    .path("name").asText()).isEqualTo("Ana Atualizada");

            String unknown = UUID.randomUUID().toString();
            assertError(get(client, PATH + "/" + unknown), 404, "not_found");
            assertError(put(client, PATH + "/" + unknown,
                    updateInput("Nova", "DEMO-003", "nova@demo.invalid", 0),
                    csrfToken(client)), 404, "not_found");
            assertError(get(client, PATH + "/bad-id"), 400, "invalid_input");
            assertError(post(client, PATH, "{", csrfToken(client)), 400, "invalid_input");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_supervisor", Integer.class))
                    .isEqualTo(2);
        }
    }

    @ParameterizedTest
    @MethodSource("nonTextRequests")
    void rejectsNonTextCreationWithoutWritingOrAuditing(Map<String, Object> invalid) throws Exception {
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("gestor@example.invalid"), "gestor@example.invalid", "Gestor Sintético", "gestor", PASSWORD.toCharArray());
        UUID actor = jdbc.queryForObject("SELECT id FROM sager_local_account WHERE email = ?",
                UUID.class, "gestor@example.invalid");
        try (HttpClient client = browser()) {
            login(client, "gestor@example.invalid");
            assertError(post(client, PATH, json.writeValueAsString(invalid), csrfToken(client)),
                    400, "invalid_input");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_supervisor", Integer.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE actor_id = ?",
                    Integer.class, actor)).isZero();
        }
    }

    @ParameterizedTest
    @MethodSource("invalidUpdateRequests")
    void rejectsNonTextOrNonIntegerUpdatesWithoutWritingOrAuditing(Map<String, Object> invalid)
            throws Exception {
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("gestor@example.invalid"), "gestor@example.invalid", "Gestor Sintético", "gestor", PASSWORD.toCharArray());
        try (HttpClient client = browser()) {
            login(client, "gestor@example.invalid");
            HttpResponse<String> created = post(client, PATH,
                    input("Pessoa Original", "STRICT-ORIGINAL", "original@example.invalid"), csrfToken(client));
            assertThat(created.statusCode()).isEqualTo(201);
            UUID id = UUID.fromString(json.readTree(created.body()).path("id").asText());
            Map<String, Object> fields = new LinkedHashMap<>(invalid);
            fields.putIfAbsent("version", 0);
            assertError(put(client, PATH + "/" + id, json.writeValueAsString(fields), csrfToken(client)),
                    400, "invalid_input");
            JsonNode persisted = json.readTree(get(client, PATH + "/" + id).body());
            assertThat(persisted.path("name").asText()).isEqualTo("Pessoa Original");
            assertThat(persisted.path("institutionalId").asText()).isEqualTo("STRICT-ORIGINAL");
            assertThat(persisted.path("email").asText()).isEqualTo("original@example.invalid");
            assertThat(persisted.path("version").asLong()).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE resource_id = ?",
                    Integer.class, id)).isEqualTo(1);
        }
    }

    private static Stream<Map<String, Object>> nonTextRequests() {
        return Stream.of(
                Map.of("name", 123, "institutionalId", "STRICT-NEW", "email", "new@example.invalid"),
                Map.of("name", "Pessoa Nova", "institutionalId", 123, "email", "new@example.invalid"),
                Map.of("name", "Pessoa Nova", "institutionalId", "STRICT-NEW", "email", 123));
    }

    private static Stream<Map<String, Object>> invalidUpdateRequests() {
        return Stream.concat(nonTextRequests(), Stream.of(0.5, "0", true).map(version ->
                Map.of("name", "Pessoa Nova", "institutionalId", "STRICT-NEW",
                        "email", "new@example.invalid", "version", version)));
    }

    @Test
    void gestorAndSupervisorCanManageWithCsrfWhileOthersCannot() throws Exception {
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("gestor@example.invalid"), "gestor@example.invalid", "Gestor", "gestor",
                PASSWORD.toCharArray());
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("supervisor@example.invalid"), "supervisor@example.invalid", "Supervisor", "supervisor",
                PASSWORD.toCharArray());
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("residente@example.invalid"), "residente@example.invalid", "Residente", "residente",
                PASSWORD.toCharArray());
        String unknown = UUID.randomUUID().toString();
        try (HttpClient anonymous = browser()) {
            assertThat(get(anonymous, PATH).statusCode()).isEqualTo(401);
            assertThat(get(anonymous, PATH + "/" + unknown).statusCode()).isEqualTo(401);
            assertThat(post(anonymous, PATH, input("Ana", "DEMO-001", "ana@demo.invalid"),
                    csrfToken(anonymous)).statusCode()).isEqualTo(401);
            assertThat(put(anonymous, PATH + "/" + unknown,
                    updateInput("Ana", "DEMO-001", "ana@demo.invalid", 0),
                    csrfToken(anonymous)).statusCode()).isEqualTo(401);
        }
        for (String profile : new String[] { "residente" }) {
            try (HttpClient client = browser()) {
                login(client, profile + "@example.invalid");
                assertThat(get(client, PATH).statusCode()).isEqualTo(403);
                assertThat(get(client, PATH + "/" + UUID.randomUUID()).statusCode())
                        .isEqualTo(403);
                assertThat(post(client, PATH, input("Ana", "DEMO-001", "ana@demo.invalid"),
                        csrfToken(client)).statusCode()).isEqualTo(403);
                assertThat(put(client, PATH + "/" + unknown,
                        updateInput("Ana", "DEMO-001", "ana@demo.invalid", 0),
                        csrfToken(client)).statusCode()).isEqualTo(403);
            }
        }
        try (HttpClient gestor = browser()) {
            login(gestor, "gestor@example.invalid");
            assertThat(post(gestor, PATH, input("Ana", "DEMO-001", "ana@demo.invalid"),
                    null).statusCode()).isEqualTo(403);
            assertThat(put(gestor, PATH + "/" + unknown,
                    updateInput("Ana", "DEMO-001", "ana@demo.invalid", 0),
                    null).statusCode()).isEqualTo(403);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_supervisor", Integer.class))
                    .isZero();
        }
        try (HttpClient supervisor = browser()) {
            login(supervisor, "supervisor@example.invalid");
            assertThat(get(supervisor, PATH).statusCode()).isEqualTo(200);
            assertThat(post(supervisor, PATH, input("Ana", "DEMO-001", "ana@demo.invalid"),
                    null).statusCode()).isEqualTo(403);
            HttpResponse<String> created = post(supervisor, PATH,
                    input("Ana", "DEMO-001", "ana@demo.invalid"), csrfToken(supervisor));
            assertThat(created.statusCode()).isEqualTo(201);
            String id = json.readTree(created.body()).path("id").asText();
            assertThat(get(supervisor, PATH + "/" + id).statusCode()).isEqualTo(200);
            assertThat(put(supervisor, PATH + "/" + id,
                    updateInput("Ana", "DEMO-001", "ana@demo.invalid", 0),
                    null).statusCode()).isEqualTo(403);
            assertThat(put(supervisor, PATH + "/" + id,
                    updateInput("Ana Atualizada", "DEMO-001", "ana@demo.invalid", 0),
                    csrfToken(supervisor)).statusCode()).isEqualTo(200);
            assertThat(jdbc.queryForObject("SELECT name FROM sager_supervisor WHERE id = ?",
                    String.class, UUID.fromString(id))).isEqualTo("Ana Atualizada");
        }
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void unrelatedUpdatePreservesAssignedLoginAndSession(boolean originalEnrollmentOccupied) throws Exception {
        try (HttpClient manager = browser(); HttpClient supervisor = browser()) {
            LocalAccount assigned = linkedSupervisor(manager);
            UUID id = assigned.supervisorId();
            if (originalEnrollmentOccupied)
                provisioning.create("cad-sup-001", null, "Outra Conta Sintética", "saude", PASSWORD.toCharArray());
            login(supervisor, assigned.enrollment());

            HttpResponse<String> updated = put(manager, PATH + "/" + id,
                    updateInput("Nome Editado", " cad-sup-001 ", "editado@example.invalid", 0), csrfToken(manager));
            assertThat(updated.statusCode()).isEqualTo(200);
            assertThat(json.readTree(updated.body()).path("name").asText()).isEqualTo("Nome Editado");
            assertThat(json.readTree(updated.body()).path("institutionalId").asText()).isEqualTo("cad-sup-001");
            assertThat(provisioning.list()).contains(assigned);
            assertAudit(id.toString(), "UPDATE", 1, "name", "email");
            HttpResponse<String> me = get(supervisor, "/api/v1/auth/me");
            assertThat(me.statusCode()).isEqualTo(200);
            assertThat(json.readTree(me.body()).path("matricula").asText()).isEqualTo(assigned.enrollment());
            assertThat(json.readTree(me.body()).path("supervisorId").asText()).isEqualTo(id.toString());
        }
    }

    @Test
    void enrollmentChangeRollsBackCollisionAndOtherwisePreservesAccountAndRevokesSession() throws Exception {
        try (HttpClient manager = browser(); HttpClient supervisor = browser()) {
            LocalAccount assigned = linkedSupervisor(manager);
            UUID id = assigned.supervisorId();
            provisioning.create("ocupada-sup-001", null, "Outra Conta Sintética", "saude", PASSWORD.toCharArray());
            login(supervisor, assigned.enrollment());
            String before = get(manager, PATH + "/" + id).body();
            Integer audits = jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE resource_id=?", Integer.class, id);

            assertError(put(manager, PATH + "/" + id,
                    updateInput("Não Persistir", "ocupada-sup-001", "editado@example.invalid", 0), csrfToken(manager)),
                    409, "duplicate_enrollment");
            assertThat(get(manager, PATH + "/" + id).body()).isEqualTo(before);
            assertThat(provisioning.list()).contains(assigned);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE resource_id=?", Integer.class, id)).isEqualTo(audits);
            assertThat(get(supervisor, "/api/v1/auth/me").statusCode()).isEqualTo(200);

            assertThat(put(manager, PATH + "/" + id,
                    updateInput("Nome Editado", "nova-sup-001", "sup@example.invalid", 0), csrfToken(manager)).statusCode()).isEqualTo(200);
            LocalAccount changed = provisioning.list().stream().filter(a -> a.id().equals(assigned.id())).findFirst().orElseThrow();
            assertThat(changed.enrollment()).isEqualTo("nova-sup-001");
            assertThat(changed).usingRecursiveComparison().ignoringFields("enrollment").isEqualTo(assigned);
            assertAudit(id.toString(), "UPDATE", 1, "name", "institutionalId");
            assertThat(get(supervisor, "/api/v1/auth/me").statusCode()).isEqualTo(401);
            login(supervisor, changed.enrollment());
            assertThat(get(supervisor, "/api/v1/auth/me").statusCode()).isEqualTo(200);
        }
    }

    private LocalAccount linkedSupervisor(HttpClient manager) throws Exception {
        provisioning.create("gestor", "gestor@example.invalid", "Gestor Sintético", "gestor", PASSWORD.toCharArray());
        login(manager, "gestor");
        HttpResponse<String> created = post(manager, PATH,
                input("Pessoa Sintética", "cad-sup-001", "sup@example.invalid"), csrfToken(manager));
        assertThat(created.statusCode()).isEqualTo(201);
        UUID id = UUID.fromString(json.readTree(created.body()).path("id").asText());
        provisioning.create("temporaria-sup", null, "Conta Sintética", "supervisor", PASSWORD.toCharArray());
        LocalAccount linked = provisioning.list().stream().filter(a -> a.enrollment().equals("temporaria-sup")).findFirst().orElseThrow();
        provisioning.linkSupervisor(linked.id(), id);
        provisioning.assignEnrollment(linked.id(), "acesso-sup-001");
        return provisioning.list().stream().filter(a -> a.id().equals(linked.id())).findFirst().orElseThrow();
    }

    @Test
    void nonLocalModeDoesNotExposeSupervisorApi() throws Exception {
        SpringApplication application = new SpringApplication(SagerApplication.class);
        application.setAdditionalProfiles("closed");
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

    private void login(HttpClient client, String email) throws Exception {
        String form = "matricula=" + URLEncoder.encode(br.edu.ifgoiano.sager.TestIdentity.enrollment(email), StandardCharsets.UTF_8)
                + "&password=" + URLEncoder.encode(PASSWORD, StandardCharsets.UTF_8);
        HttpRequest request = HttpRequest.newBuilder(uri("/api/v1/auth/login"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("X-CSRF-TOKEN", csrfToken(client))
                .POST(HttpRequest.BodyPublishers.ofString(form)).build();
        assertThat(send(client, request).statusCode()).isEqualTo(204);
    }

    private String csrfToken(HttpClient client) throws Exception {
        HttpResponse<String> response = get(client, "/api/v1/auth/csrf");
        assertThat(response.statusCode()).isEqualTo(200);
        return json.readTree(response.body()).path("token").asText();
    }

    private String input(String name, String institutionalId, String email) {
        return """
                {"name":"%s","institutionalId":"%s","email":"%s"}
                """.formatted(name, institutionalId, email);
    }

    private String updateInput(String name, String institutionalId, String email, long version) {
        return """
                {"name":"%s","institutionalId":"%s","email":"%s","version":%d}
                """.formatted(name, institutionalId, email, version);
    }

    private void assertAudit(String id, String action, long version, String... fields) {
        assertThat(jdbc.queryForObject("SELECT to_regclass('sager_audit_event')", String.class)).isNotNull();
        java.util.List<java.util.List<String>> recorded = jdbc.query("""
                SELECT changed_fields FROM sager_audit_event
                WHERE resource = 'SUPERVISOR' AND resource_id = ? AND action = ? AND resulting_version = ?
                """, (result, row) -> java.util.List.of((String[]) result.getArray(1).getArray()),
                UUID.fromString(id), action, version);
        assertThat(recorded).hasSize(1);
        assertThat(recorded.getFirst()).containsExactlyInAnyOrder(fields);
    }

    private void assertError(HttpResponse<String> response, int status, String code) throws Exception {
        assertThat(response.statusCode()).isEqualTo(status);
        assertThat(response.headers().firstValue("Cache-Control").orElseThrow())
                .contains("no-store");
        JsonNode body = json.readTree(response.body());
        assertThat(body.path("code").asText()).isEqualTo(code);
        assertThat(body.path("message").asText()).isNotBlank();
        assertThat(response.body()).doesNotContain("password", "sql", "org.springframework");
    }

    private HttpResponse<String> get(HttpClient client, String path) throws Exception {
        return send(client, HttpRequest.newBuilder(uri(path)).GET().build());
    }

    private HttpResponse<String> post(HttpClient client, String path, String body, String csrf)
            throws Exception {
        return send(client, jsonRequest(path, csrf)
                .POST(HttpRequest.BodyPublishers.ofString(body)).build());
    }

    private HttpResponse<String> put(HttpClient client, String path, String body, String csrf)
            throws Exception {
        return send(client, jsonRequest(path, csrf)
                .PUT(HttpRequest.BodyPublishers.ofString(body)).build());
    }

    private HttpRequest.Builder jsonRequest(String path, String csrf) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri(path))
                .header("Content-Type", "application/json");
        if (csrf != null) {
            builder.header("X-CSRF-TOKEN", csrf);
        }
        return builder;
    }

    private HttpResponse<String> send(HttpClient client, HttpRequest request) throws Exception {
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private HttpClient browser() {
        return HttpClient.newBuilder()
                .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    private URI uri(String path) {
        return URI.create("http://127.0.0.1:" + port + path);
    }
}
