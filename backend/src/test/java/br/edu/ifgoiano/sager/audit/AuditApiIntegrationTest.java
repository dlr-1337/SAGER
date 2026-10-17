package br.edu.ifgoiano.sager.audit;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
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

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class AuditApiIntegrationTest {
    private static final String PASSWORD = "Senha sintetica 123!";
    private static final String PATH = "/api/v1/auditoria";
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
    void cleanAccountsWithoutTouchingPermanentEvents() {
        jdbc.update("DELETE FROM spring_session");
        jdbc.update("DELETE FROM sager_local_account");
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("gestor@example.invalid"), "gestor@example.invalid", "Gestor Sintético", "gestor",
                PASSWORD.toCharArray());
    }

    @Test
    void serverGeneratesRequestCorrelationAndIgnoresCallerSuppliedIdentifiers() throws Exception {
        UUID callerId = UUID.randomUUID();
        try (HttpClient client = browser()) {
            HttpResponse<String> first = send(client, HttpRequest.newBuilder(uri("/api/v1/auth/csrf"))
                    .header("X-Request-Id", callerId.toString()).GET().build());
            assertThat(first.statusCode()).isEqualTo(200);
            assertThat(first.headers().firstValue("X-Request-Id"))
                    .as("the server assigns a correlation ID to every local API request")
                    .isPresent();
            UUID serverId = UUID.fromString(first.headers().firstValue("X-Request-Id").orElseThrow());
            assertThat(serverId).isNotEqualTo(callerId);
            HttpResponse<String> second = get(client, "/api/v1/auth/csrf");
            assertThat(UUID.fromString(second.headers().firstValue("X-Request-Id").orElseThrow()))
                    .isNotEqualTo(serverId);
        }
    }

    @Test
    void listReturnsOnlyMetadataWithCombinedFiltersAndStableSequenceCursor() throws Exception {
        UUID actor = UUID.randomUUID();
        UUID resource = UUID.randomUUID();
        UUID request = UUID.randomUUID();
        UUID first = event(actor, resource, request, "SUPERVISOR");
        UUID second = event(actor, resource, request, "SUPERVISOR");
        UUID third = event(actor, resource, request, "SUPERVISOR");
        event(UUID.randomUUID(), resource, request, "SUPERVISOR");
        event(actor, UUID.randomUUID(), request, "SUPERVISOR");
        event(actor, resource, UUID.randomUUID(), "SUPERVISOR");
        event(actor, resource, request, "RESIDENT");
        String filter = "?actorId=" + actor + "&resourceId=" + resource + "&requestId=" + request
                + "&resource=SUPERVISOR&limit=2";
        try (HttpClient client = browser()) {
            login(client);
            HttpResponse<String> response = get(client, PATH + filter);
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.headers().firstValue("Cache-Control").orElseThrow())
                    .contains("no-store");
            JsonNode page = json.readTree(response.body());
            assertThat(page.path("items").size()).isEqualTo(2);
            assertThat(page.path("items").get(0).path("id").asText()).isEqualTo(third.toString());
            JsonNode metadata = page.path("items").get(1);
            assertThat(metadata.path("id").asText()).isEqualTo(second.toString());
            assertThat(metadata.path("actorId").asText()).isEqualTo(actor.toString());
            assertThat(metadata.path("actorProfile").asText()).isEqualTo("gestor");
            assertThat(metadata.path("origin").asText()).isEqualTo("LOCAL_API");
            assertThat(metadata.path("requestId").asText()).isEqualTo(request.toString());
            assertThat(metadata.path("resource").asText()).isEqualTo("SUPERVISOR");
            assertThat(metadata.path("resourceId").asText()).isEqualTo(resource.toString());
            assertThat(metadata.path("action").asText()).isEqualTo("CREATE");
            assertThat(metadata.path("resultingVersion").asLong()).isZero();
            assertThat(metadata.path("occurredAt").asText()).isNotBlank();
            assertThat(metadata.path("changedFields").get(0).asText()).isEqualTo("name");
            assertThat(metadata.size()).isEqualTo(12);
            long cursor = page.path("nextCursor").asLong();
            assertThat(cursor).isEqualTo(metadata.path("sequence").asLong());
            event(actor, resource, request, "SUPERVISOR");

            JsonNode remainder = json.readTree(get(client,
                    PATH + filter + "&beforeSequence=" + cursor).body());
            assertThat(remainder.path("items").size()).isEqualTo(1);
            assertThat(remainder.path("items").get(0).path("id").asText())
                    .isEqualTo(first.toString());
            assertThat(remainder.path("nextCursor").isNull()).isTrue();
            assertThat(response.body()).doesNotContain("Gestor Sintético", "password",
                    "headers", "snapshot", "example.invalid");
        }
    }

    @Test
    void courseCreationEditsAndDeactivationAppearInAdministrativePages() throws Exception {
        try (HttpClient client = browser()) {
            login(client);
            String name = "Curso Sintético " + UUID.randomUUID();
            HttpResponse<String> created = write(client, "POST", "/api/v1/cursos", Map.of("name", name));
            assertThat(created.statusCode()).isEqualTo(201);
            String id = json.readTree(created.body()).path("id").asText();
            assertThat(write(client, "PUT", "/api/v1/cursos/" + id,
                    Map.of("name", name + " Editado", "active", true, "version", 0)).statusCode())
                    .isEqualTo(200);
            assertThat(write(client, "PUT", "/api/v1/cursos/" + id,
                    Map.of("name", name + " Editado", "active", false, "version", 1)).statusCode())
                    .isEqualTo(200);

            for (String resourceFilter : new String[] { "", "&resource=COURSE" }) {
                String query = PATH + "?resourceId=" + id + "&limit=2" + resourceFilter;
                HttpResponse<String> response = get(client, query);
                assertThat(response.statusCode()).isEqualTo(200);
                JsonNode page = json.readTree(response.body());
                assertThat(page.path("items").size()).isEqualTo(2);
                JsonNode deactivated = page.path("items").get(0);
                assertThat(deactivated.path("resource").asText()).isEqualTo("COURSE");
                assertThat(deactivated.path("action").asText()).isEqualTo("UPDATE");
                assertThat(deactivated.path("resultingVersion").asLong()).isEqualTo(2);
                assertThat(deactivated.path("changedFields").get(0).asText()).isEqualTo("active");
                JsonNode edited = page.path("items").get(1);
                assertThat(edited.path("resultingVersion").asLong()).isEqualTo(1);
                assertThat(edited.path("changedFields").get(0).asText()).isEqualTo("name");
                assertThat(page.path("nextCursor").asLong()).isPositive();
                JsonNode previous = json.readTree(get(client,
                        query + "&beforeSequence=" + page.path("nextCursor").asLong()).body());
                assertThat(previous.path("items").size()).isEqualTo(1);
                assertThat(previous.path("items").get(0).path("action").asText()).isEqualTo("CREATE");
                assertThat(previous.path("items").get(0).path("resultingVersion").asLong()).isZero();
                assertThat(previous.path("nextCursor").isNull()).isTrue();
                assertThat(response.body()).doesNotContain(name);
            }
        }
    }

    @Test
    void defaultAndMaximumPageSizesBoundTheQuery() throws Exception {
        UUID resource = UUID.randomUUID();
        for (int index = 0; index < 105; index++) {
            event(UUID.randomUUID(), resource, UUID.randomUUID(), "SUPERVISOR");
        }
        try (HttpClient client = browser()) {
            login(client);
            JsonNode defaultPage = json.readTree(get(client, PATH + "?resourceId=" + resource).body());
            assertThat(defaultPage.path("items").size()).isEqualTo(50);
            assertThat(defaultPage.path("nextCursor").asLong()).isPositive();
            JsonNode maximum = json.readTree(get(client,
                    PATH + "?resourceId=" + resource + "&limit=100").body());
            assertThat(maximum.path("items").size()).isEqualTo(100);
            assertThat(maximum.path("nextCursor").asLong()).isPositive();
        }
    }

    @Test
    void rejectsMalformedFiltersAndUnboundedPaginationWithoutInternalDetails() throws Exception {
        try (HttpClient client = browser()) {
            login(client);
            for (String query : new String[] {
                    "limit=0", "limit=101", "limit=-1", "limit=abc", "beforeSequence=0",
                    "beforeSequence=-1", "beforeSequence=abc", "resource=OTHER",
                    "actorId=invalid", "resourceId=invalid", "requestId=invalid"
            }) {
                HttpResponse<String> response = get(client, PATH + "?" + query);
                assertThat(response.statusCode()).as(query).isEqualTo(400);
                assertThat(response.headers().firstValue("Cache-Control").orElseThrow())
                        .contains("no-store");
                assertThat(json.readTree(response.body()).path("code").asText())
                        .isEqualTo("invalid_input");
                assertThat(json.readTree(response.body()).path("requestId").asText())
                        .isEqualTo(response.headers().firstValue("X-Request-Id").orElseThrow());
                assertThat(response.body()).doesNotContain("SQLException", "org.springframework",
                        "sager_audit_event");
            }
        }
    }

    private UUID event(UUID actor, UUID resource, UUID request, String resourceType) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_audit_event
                    (id, actor_id, actor_profile, origin, request_id, resource, resource_id,
                     action, resulting_version, changed_fields)
                VALUES (?, ?, 'gestor', 'LOCAL_API', ?, ?, ?, 'CREATE', 0, ARRAY['name'])
                """, id, actor, request, resourceType, resource);
        return id;
    }

    private void login(HttpClient client) throws Exception {
        String csrf = json.readTree(get(client, "/api/v1/auth/csrf").body()).path("token").asText();
        String form = "matricula=gestor&password="
                + URLEncoder.encode(PASSWORD, StandardCharsets.UTF_8);
        assertThat(send(client, HttpRequest.newBuilder(uri("/api/v1/auth/login"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("X-CSRF-TOKEN", csrf).POST(HttpRequest.BodyPublishers.ofString(form))
                .build()).statusCode()).isEqualTo(204);
    }

    private HttpClient browser() {
        return HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
                .followRedirects(HttpClient.Redirect.NEVER).build();
    }

    private HttpResponse<String> get(HttpClient client, String path) throws Exception {
        return send(client, HttpRequest.newBuilder(uri(path)).GET().build());
    }

    private HttpResponse<String> write(HttpClient client, String method, String path,
            Map<String, ?> input) throws Exception {
        String csrf = json.readTree(get(client, "/api/v1/auth/csrf").body()).path("token").asText();
        return send(client, HttpRequest.newBuilder(uri(path))
                .header("Content-Type", "application/json").header("X-CSRF-TOKEN", csrf)
                .method(method, HttpRequest.BodyPublishers.ofString(json.writeValueAsString(input)))
                .build());
    }

    private HttpResponse<String> send(HttpClient client, HttpRequest request) throws Exception {
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create("http://127.0.0.1:" + port + path);
    }
}
