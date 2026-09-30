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
import java.util.List;
import java.util.UUID;

import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class AuditHealthPrivacyApiIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");
    static { POSTGRES.start(); }

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired private JdbcTemplate jdbc;
    @Autowired private LocalAccountProvisioningService provisioning;
    @Autowired private ObjectMapper json;
    @LocalServerPort private int port;

    @Test
    void protectedEventsNeverOccupyAdministrativePagesOrAffectTheirCursor() throws Exception {
        UUID actor = UUID.randomUUID();
        UUID first = event(actor, "HEALTH_GRANT", "CREATE");
        event(actor, "HEALTH_NOTE", "READ");
        event(actor, "HEALTH_SHARE", "CREATE");
        event(actor, "HEALTH_EXPORT", "EXPORT");
        UUID second = event(actor, "CARE_ASSIGNMENT", "CREATE");
        event(actor, "HEALTH_NOTE", "EXPORT");
        try (HttpClient browser = browser()) {
            login(browser);
            JsonNode page = json.readTree(get(browser, "/api/v1/auditoria?actorId=" + actor + "&limit=1").body());
            assertThat(page.path("items").get(0).path("id").asText()).isEqualTo(second.toString());
            long cursor = page.path("nextCursor").asLong();
            JsonNode remaining = json.readTree(get(browser, "/api/v1/auditoria?actorId=" + actor
                    + "&limit=1&beforeSequence=" + cursor).body());
            assertThat(remaining.path("items").get(0).path("id").asText()).isEqualTo(first.toString());
            assertThat(remaining.path("nextCursor").isNull()).isTrue();
        }
    }

    @Test
    void explicitProtectedFiltersAreForbiddenEvenWithoutMatchingEvents() throws Exception {
        try (HttpClient browser = browser()) {
            login(browser);
            for (String resource : List.of("HEALTH_NOTE", "HEALTH_SHARE", "HEALTH_EXPORT")) {
                HttpResponse<String> response = get(browser, "/api/v1/auditoria?resource=" + resource
                        + "&resourceId=" + UUID.randomUUID());
                assertThat(response.statusCode()).isEqualTo(403);
                assertThat(json.readTree(response.body()).path("requestId").asText())
                        .isEqualTo(response.headers().firstValue("X-Request-Id").orElseThrow());
            }
        }
    }

    private UUID event(UUID actor, String resource, String action) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_audit_event
                  (id,actor_id,actor_profile,origin,request_id,resource,resource_id,action,resulting_version,changed_fields)
                VALUES (?,?,'saude','LOCAL_API',?,?,?,?,0,ARRAY[]::text[])
                """, id, actor, UUID.randomUUID(), resource, UUID.randomUUID(), action);
        return id;
    }

    private void login(HttpClient browser) throws Exception {
        String email = UUID.randomUUID() + "@example.invalid";
        String password = "Senha local sintetica 123!";
        provisioning.create(email, "Gestor Sintetico", "gestor", password.toCharArray());
        String csrf = json.readTree(get(browser, "/api/v1/auth/csrf").body()).path("token").asText();
        String form = "email=" + URLEncoder.encode(email, StandardCharsets.UTF_8) + "&password="
                + URLEncoder.encode(password, StandardCharsets.UTF_8);
        assertThat(browser.send(HttpRequest.newBuilder(uri("/api/v1/auth/login"))
                .header("Content-Type", "application/x-www-form-urlencoded").header("X-CSRF-TOKEN", csrf)
                .POST(HttpRequest.BodyPublishers.ofString(form)).build(),
                HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(204);
    }

    private HttpClient browser() {
        return HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();
    }

    private HttpResponse<String> get(HttpClient browser, String path) throws Exception {
        return browser.send(HttpRequest.newBuilder(uri(path)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) { return URI.create("http://127.0.0.1:" + port + path); }
}
