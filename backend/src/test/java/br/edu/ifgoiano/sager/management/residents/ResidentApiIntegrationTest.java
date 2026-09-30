package br.edu.ifgoiano.sager.management.residents;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
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
class ResidentApiIntegrationTest {
    private static final String PASSWORD = "Senha sintética 123!";
    private static final String BIRTH_DATE = "2006-01-02";
    private static final String PATH = "/api/v1/residentes";
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
        jdbc.update("DELETE FROM sager_resident");
        jdbc.update("DELETE FROM sager_local_account");
    }

    @Test
    void gestorCreatesReadsAndUpdatesWithRequiredBirthDateAndOptionalCourse() throws Exception {
        account("gestor");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            HttpResponse<String> empty = get(client, PATH);
            assertThat(empty.statusCode()).isEqualTo(200);
            assertNoStore(empty);
            assertThat(json.readTree(empty.body()).size()).isZero();

            HttpResponse<String> created = post(client, PATH,
                    body("  Estudante Sintético  ", "  DEMO-2026-A  ", BIRTH_DATE, "  ", null),
                    csrf(client));
            assertThat(created.statusCode()).isEqualTo(201);
            assertNoStore(created);
            JsonNode value = json.readTree(created.body());
            String id = value.path("id").asText();
            assertThat(UUID.fromString(id)).isNotNull();
            assertThat(created.headers().firstValue("Location").orElseThrow())
                    .isEqualTo(PATH + "/" + id);
            assertThat(value.size()).isEqualTo(6);
            assertThat(value.path("name").asText()).isEqualTo("Estudante Sintético");
            assertThat(value.path("enrollment").asText()).isEqualTo("DEMO-2026-A");
            assertThat(value.path("birthDate").asText()).isEqualTo(BIRTH_DATE);
            assertThat(value.path("course").isNull()).isTrue();
            assertThat(value.path("version").asLong()).isZero();
            assertThat(json.readTree(get(client, PATH).body()).size()).isEqualTo(1);
            assertNoStore(get(client, PATH + "/" + id));

            HttpResponse<String> changed = put(client, PATH + "/" + id,
                    body("Estudante Atualizado", " demo-2026-a ", "2005-04-09",
                            "  Curso Sintético  ", 0), csrf(client));
            assertThat(changed.statusCode()).isEqualTo(200);
            assertNoStore(changed);
            JsonNode updated = json.readTree(changed.body());
            assertThat(updated.path("birthDate").asText()).isEqualTo("2005-04-09");
            assertThat(updated.path("course").asText()).isEqualTo("Curso Sintético");
            assertThat(updated.path("enrollment").asText()).isEqualTo("demo-2026-a");
            assertThat(updated.path("version").asLong()).isEqualTo(1);
            assertThat(json.readTree(get(client, PATH + "/" + id).body()).path("name").asText())
                    .isEqualTo("Estudante Atualizado");
            assertThat(jdbc.queryForObject("SELECT birth_date FROM sager_resident WHERE id = ?",
                    LocalDate.class, UUID.fromString(id))).isEqualTo(LocalDate.of(2005, 4, 9));
            assertThat(jdbc.queryForObject("SELECT created_at IS NOT NULL AND updated_at IS NOT NULL "
                    + "FROM sager_resident WHERE id = ?", Boolean.class, UUID.fromString(id))).isTrue();
        }
    }

    @Test
    void rejectsInvalidAndNonTextInputsWithoutWriting() throws Exception {
        account("gestor");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            for (String invalid : List.of("{}", "{", body("Pessoa", "DEMO-A", null, null, null),
                    body("Pessoa", "DEMO-A", "", null, null),
                    body("Pessoa", "DEMO-A", "  ", null, null),
                    body("AB", "DEMO-A", BIRTH_DATE, null, null),
                    body("Pessoa", " ", BIRTH_DATE, null, null),
                    body("Pessoa", "A".repeat(65), BIRTH_DATE, null, null),
                    body("N".repeat(201), "DEMO-A", BIRTH_DATE, null, null),
                    body("Pessoa", "DEMO-A", "2026-02-30", null, null),
                    body("Pessoa", "DEMO-A", LocalDate.now().plusDays(1).toString(), null, null),
                    body("Pessoa", "DEMO-A", BIRTH_DATE, "C".repeat(201), null),
                    body(123, "DEMO-A", BIRTH_DATE, null, null),
                    body("Pessoa", 123, BIRTH_DATE, null, null),
                    body("Pessoa", "DEMO-A", 20260101, null, null),
                    body("Pessoa", "DEMO-A", BIRTH_DATE, false, null))) {
                assertError(post(client, PATH, invalid, csrf(client)), 400, "invalid_input");
            }
            assertError(get(client, PATH + "/not-a-uuid"), 400, "invalid_input");
            assertError(get(client, PATH + "/" + UUID.randomUUID()), 404, "not_found");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_resident", Integer.class)).isZero();
        }
    }

    @Test
    void duplicateEnrollmentAndStaleVersionDoNotOverwriteOtherRecords() throws Exception {
        account("gestor");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            String first = create(client, "Estudante Primeiro", "DEMO-2026-A");
            String second = create(client, "Estudante Segundo", "DEMO-2026-B");
            assertError(post(client, PATH,
                    body("Estudante Duplicado", " demo-2026-a ", BIRTH_DATE, null, null), csrf(client)),
                    409, "duplicate_enrollment");
            assertError(put(client, PATH + "/" + second,
                    body("Estudante Segundo", "DEMO-2026-A", BIRTH_DATE, null, 0), csrf(client)),
                    409, "duplicate_enrollment");
            String fresh = body("Estudante Primeiro Atualizado", "DEMO-2026-A", BIRTH_DATE, null, 0);
            assertThat(put(client, PATH + "/" + first, fresh, csrf(client)).statusCode())
                    .isEqualTo(200);
            assertError(put(client, PATH + "/" + first,
                    body("Alteração Perdida", "DEMO-2026-A", BIRTH_DATE, null, 0), csrf(client)),
                    409, "stale_version");
            for (Object invalidVersion : List.of(-1, 0.5, "0", Long.MAX_VALUE, true)) {
                assertError(put(client, PATH + "/" + first,
                        body("Estudante Primeiro", "DEMO-2026-A", BIRTH_DATE, null, invalidVersion),
                        csrf(client)), 400, "invalid_input");
            }
            assertError(put(client, PATH + "/" + first,
                    body("Estudante Primeiro", "DEMO-2026-A", BIRTH_DATE, null, null), csrf(client)),
                    400, "invalid_input");
            for (Object missingDate : List.of("", "   ")) {
                assertError(put(client, PATH + "/" + first,
                        body("Estudante Primeiro", "DEMO-2026-A", missingDate, null, 1),
                        csrf(client)), 400, "invalid_input");
            }
            assertError(put(client, PATH + "/" + first,
                    body("Estudante Primeiro", "DEMO-2026-A", null, null, 1), csrf(client)),
                    400, "invalid_input");
            assertError(put(client, PATH + "/" + first,
                    "{\"name\":\"Estudante Primeiro\",\"enrollment\":\"DEMO-2026-A\",\"version\":1}",
                    csrf(client)), 400, "invalid_input");
            assertError(put(client, PATH + "/" + UUID.randomUUID(), fresh, csrf(client)),
                    404, "not_found");
            JsonNode value = json.readTree(get(client, PATH + "/" + first).body());
            assertThat(value.path("name").asText()).isEqualTo("Estudante Primeiro Atualizado");
            assertThat(value.path("version").asLong()).isEqualTo(1);
            assertThat(json.readTree(get(client, PATH + "/" + second).body())
                    .path("enrollment").asText()).isEqualTo("DEMO-2026-B");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_resident", Integer.class)).isEqualTo(2);
        }
    }

    @Test
    void normalizesUnicodeSpacesBeforePersistingAndCheckingEnrollment() throws Exception {
        account("gestor");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            HttpResponse<String> created = post(client, PATH,
                    body("\u00a0Estudante Sintético\u2003", "\u00a0DEMO-2026-A\u2003", BIRTH_DATE,
                            "\u00a0\u2003", null), csrf(client));
            assertThat(created.statusCode()).isEqualTo(201);
            JsonNode value = json.readTree(created.body());
            assertThat(value.path("name").asText()).isEqualTo("Estudante Sintético");
            assertThat(value.path("enrollment").asText()).isEqualTo("DEMO-2026-A");
            assertThat(value.path("course").isNull()).isTrue();

            assertError(post(client, PATH,
                    body("Outra Pessoa", "demo-2026-a\u00a0", BIRTH_DATE, null, null), csrf(client)),
                    409, "duplicate_enrollment");
            String otherId = create(client, "Estudante Segundo", "DEMO-2026-B");
            assertError(put(client, PATH + "/" + otherId,
                    body("Estudante Segundo", "\u2003demo-2026-a", BIRTH_DATE, null, 0), csrf(client)),
                    409, "duplicate_enrollment");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_resident", Integer.class))
                    .isEqualTo(2);
        }
    }

    @Test
    void enforcesProfilesCsrfAndRevokesDisabledAccounts() throws Exception {
        for (String profile : List.of("gestor", "supervisor", "residente")) {
            account(profile);
        }
        String id;
        try (HttpClient gestor = browser()) {
            login(gestor, "gestor");
            id = create(gestor, "Estudante Exemplo", "DEMO-2026-A");
            assertThat(post(gestor, PATH, body("Outro Estudante", "DEMO-2026-B", null, null, null),
                    null).statusCode()).isEqualTo(403);
            assertThat(put(gestor, PATH + "/" + id,
                    body("Estudante Exemplo", "DEMO-2026-A", null, null, 0), null).statusCode())
                    .isEqualTo(403);
        }
        try (HttpClient supervisor = browser()) {
            login(supervisor, "supervisor");
            assertThat(get(supervisor, PATH).statusCode()).isEqualTo(200);
            assertThat(get(supervisor, PATH + "/" + id).statusCode()).isEqualTo(200);
            assertThat(post(supervisor, PATH,
                    body("Outro Estudante", "DEMO-2026-B", null, null, null), csrf(supervisor))
                    .statusCode()).isEqualTo(403);
            assertThat(put(supervisor, PATH + "/" + id,
                    body("Estudante Exemplo", "DEMO-2026-A", null, null, 0), csrf(supervisor))
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
                    body("Outro Estudante", "DEMO-2026-B", null, null, null), csrf(residente))
                    .statusCode()).isEqualTo(403);
            assertThat(post(anonymous, PATH,
                    body("Outro Estudante", "DEMO-2026-B", null, null, null), csrf(anonymous))
                    .statusCode()).isEqualTo(401);
            assertThat(put(residente, PATH + "/" + id,
                    body("Estudante Exemplo", "DEMO-2026-A", null, null, 0), csrf(residente))
                    .statusCode()).isEqualTo(403);
            assertThat(put(anonymous, PATH + "/" + id,
                    body("Estudante Exemplo", "DEMO-2026-A", null, null, 0), csrf(anonymous))
                    .statusCode()).isEqualTo(401);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_resident", Integer.class)).isEqualTo(1);
    }

    @Test
    void outsideLocalProfileDoesNotExposeResidentApi() throws Exception {
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

    private void account(String profile) {
        provisioning.create(profile + "@example.invalid", "Pessoa Sintética", profile,
                PASSWORD.toCharArray());
    }

    private String create(HttpClient client, String name, String enrollment) throws Exception {
        HttpResponse<String> response = post(client, PATH, body(name, enrollment, BIRTH_DATE, null, null),
                csrf(client));
        assertThat(response.statusCode()).isEqualTo(201);
        return json.readTree(response.body()).path("id").asText();
    }

    private String body(Object name, Object enrollment, Object birthDate, Object course,
            Object version) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("name", name);
        fields.put("enrollment", enrollment);
        fields.put("birthDate", birthDate);
        fields.put("course", course);
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
