package br.edu.ifgoiano.sager.auth;

import static org.assertj.core.api.Assertions.*;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.nio.file.Path;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "server.address=127.0.0.1", "sager.production.public-host=sager.example.test",
        "sager.production.rate-limit-secret=Synthetic_login_counter_secret_20260930_123",
        "sager.production.login-counter-cleanup-ms=86400000" })
@ActiveProfiles("production")
class ProductionAuthIntegrationTest {
    private static final Path STORAGE_ROOT = Path.of("target", "production-auth-" + UUID.randomUUID()).toAbsolutePath();
    private static final String RUNTIME_PASSWORD = "Synthetic_runtime_password_20260930_123";
    private static final String PASSWORD = "Senha sintética institucional 123!";
    static final PostgreSQLContainer DATABASE = new PostgreSQLContainer("postgres:17.11")
            .withDatabaseName("sager").withUsername("sager_owner")
            .withPassword("Synthetic_owner_password_20260930_456");
    static { DATABASE.start(); }
    private static JdbcTemplate owner;
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired LocalAccountProvisioningService provisioning;
    @Autowired ProductionSchemaVerifier verifier;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        Flyway.configure().dataSource(DATABASE.getJdbcUrl(), DATABASE.getUsername(), DATABASE.getPassword()).load().migrate();
        owner = new JdbcTemplate(new DriverManagerDataSource(DATABASE.getJdbcUrl(), DATABASE.getUsername(), DATABASE.getPassword()));
        owner.execute("CREATE ROLE sager_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '" + RUNTIME_PASSWORD + "'");
        owner.execute("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
        owner.execute("GRANT USAGE ON SCHEMA public TO sager_runtime");
        owner.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sager_runtime");
        owner.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sager_runtime");
        owner.execute("REVOKE ALL ON TABLE flyway_schema_history FROM sager_runtime");
        owner.execute("GRANT SELECT ON TABLE flyway_schema_history TO sager_runtime");
        owner.execute("REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE sager_audit_event FROM sager_runtime");
        registry.add("spring.datasource.url", DATABASE::getJdbcUrl);
        registry.add("spring.datasource.username", () -> "sager_runtime");
        registry.add("spring.datasource.password", () -> RUNTIME_PASSWORD);
        registry.add("sager.documents.private-root", () -> STORAGE_ROOT.resolve("documents").toString());
        registry.add("sager.reports.private-root", () -> STORAGE_ROOT.resolve("reports").toString());
    }

    @BeforeEach
    void clearEphemeralState() { jdbc.update("DELETE FROM spring_session"); jdbc.update("DELETE FROM sager_login_rate_bucket"); }

    @Test
    void httpsProxySessionIsSecureAndCanWriteAuditedDataWithRuntimeRole() throws Exception {
        String email = createAccount("supervisor");
        try (var browser = new Browser()) {
            var response = browser.login(email, PASSWORD);
            assertThat(response.statusCode()).isEqualTo(204);
            assertThat(response.headers().allValues("Set-Cookie").toString()).contains("Secure", "HttpOnly", "SameSite=Lax");
            assertThat(browser.get("/api/v1/auth/me").statusCode()).isEqualTo(200);
            var csrf = json.readTree(browser.get("/api/v1/auth/csrf").body());
            var created = browser.send("/api/v1/alojamentos", "{\"code\":\"PROD-" + UUID.randomUUID() + "\",\"name\":\"Moradia Sintética Produção\"}", csrf.path("token").asText());
            assertThat(created.statusCode()).isEqualTo(201);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event", Integer.class)).isPositive();
            assertThat(browser.get("/api/v1/openapi").statusCode()).isEqualTo(404);
            assertThat(browser.send("/api/v1/alojamentos", "{}", null).statusCode()).isEqualTo(403);
        }
        assertThat(HttpClient.newHttpClient().send(HttpRequest.newBuilder(url("/actuator/health/readiness")).GET().build(),
                HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(200);
    }

    @Test
    void directCleartextAndWrongForwardedHostAreRefused() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            var cleartext = client.send(HttpRequest.newBuilder(url("/api/v1/auth/csrf")).GET().build(), HttpResponse.BodyHandlers.ofString());
            assertThat(cleartext.statusCode()).isEqualTo(403);
            assertThat(json.readTree(cleartext.body()).path("code").asText()).isEqualTo("invalid_origin");
            var wrong = client.send(proxy("/api/v1/auth/csrf").setHeader("X-Forwarded-Host", "untrusted.example.test").GET().build(), HttpResponse.BodyHandlers.ofString());
            assertThat(wrong.statusCode()).isEqualTo(403);
            assertThat(json.readTree(wrong.body()).path("requestId").asText()).satisfies(UUID::fromString);
        }
    }

    @Test
    void failedLoginCountersPersistAcrossClientSessionsWithoutEmailOrIpValues() throws Exception {
        String email = createAccount("residente");
        try (var first = new Browser()) {
            for (int i = 0; i < 5; i++) assertThat(first.login(email, "senha incorreta sintética").statusCode()).isEqualTo(401);
        }
        try (var second = new Browser()) {
            var blocked = second.login(email, PASSWORD);
            assertThat(blocked.statusCode()).isEqualTo(429);
            assertThat(json.readTree(blocked.body()).path("code").asText()).isEqualTo("rate_limited");
            assertThat(blocked.headers().firstValue("Retry-After").orElseThrow()).isEqualTo("900");
        }
        for (String key : jdbc.queryForList("SELECT key_hash FROM sager_login_rate_bucket", String.class)) {
            assertThat(key).matches("[0-9a-f]{64}").doesNotContain(email, "127.0.0.1");
        }
    }

    @Test
    void successfulLoginResetsItsAccountCounterAndWindowExpiresAtFifteenMinutes() throws Exception {
        String email = createAccount("supervisor");
        try (var browser = new Browser()) {
            for (int i = 0; i < 4; i++) assertThat(browser.login(email, "senha errada").statusCode()).isEqualTo(401);
            assertThat(browser.login(email, PASSWORD).statusCode()).isEqualTo(204);
        }
        try (var browser = new Browser()) { assertThat(browser.login(email, "senha errada").statusCode()).isEqualTo(401); }
        jdbc.update("DELETE FROM sager_login_rate_bucket");
        String secret = "Synthetic_login_counter_secret_20260930_123";
        Instant now = Instant.parse("2026-09-30T20:00:00Z");
        var initial = new LoginRateLimiter(jdbc, Clock.fixed(now, ZoneOffset.UTC), secret);
        for (int i = 0; i < 5; i++) assertThat(initial.allow(email, "198.51.100.21")).isTrue();
        var before = new LoginRateLimiter(jdbc, Clock.fixed(now.plus(Duration.ofMinutes(15)).minusNanos(1000), ZoneOffset.UTC), secret);
        assertThat(before.allow(email, "198.51.100.21")).isFalse();
        var after = new LoginRateLimiter(jdbc, Clock.fixed(now.plus(Duration.ofMinutes(15)), ZoneOffset.UTC), secret);
        assertThat(after.allow(email, "198.51.100.21")).isTrue();
    }

    @Test
    void runtimeCannotAlterOrEraseAuditAndVerifierRejectsChangedMigration() {
        assertThatThrownBy(() -> jdbc.execute("UPDATE sager_audit_event SET resulting_version=resulting_version WHERE false")).rootCause().hasMessageContaining("permission denied");
        assertThatThrownBy(() -> jdbc.execute("DELETE FROM sager_audit_event WHERE false")).rootCause().hasMessageContaining("permission denied");
        assertThatThrownBy(() -> jdbc.execute("ALTER TABLE sager_audit_event DISABLE TRIGGER ALL")).rootCause().hasMessageContaining("owner");
        assertThatThrownBy(() -> jdbc.execute("CREATE TABLE production_should_refuse(id INT)")).rootCause().hasMessageContaining("permission denied");
        Integer original = owner.queryForObject("SELECT checksum FROM flyway_schema_history WHERE version='1'", Integer.class);
        owner.update("UPDATE flyway_schema_history SET checksum=checksum+1 WHERE version='1'");
        try { assertThatThrownBy(() -> verifier.run(null)).isInstanceOf(IllegalStateException.class); }
        finally { owner.update("UPDATE flyway_schema_history SET checksum=? WHERE version='1'", original); }
        assertThatCode(() -> verifier.run(null)).doesNotThrowAnyException();
    }

    @Test
    void productionGuardRefusesCombinedProfilesWeakSecretsAndOwnerRole() {
        MockEnvironment environment = new MockEnvironment().withProperty("server.forward-headers-strategy", "framework")
                .withProperty("server.servlet.session.cookie.secure", "true").withProperty("spring.flyway.enabled", "false")
                .withProperty("springdoc.api-docs.enabled", "false").withProperty("spring.datasource.username", "sager_runtime")
                .withProperty("spring.datasource.password", RUNTIME_PASSWORD).withProperty("sager.production.public-host", "sager.example.test")
                .withProperty("sager.production.rate-limit-secret", "Synthetic_login_counter_secret_20260930_123");
        environment.setActiveProfiles("production");
        assertThatCode(() -> ProductionModeGuard.requireProduction(environment)).doesNotThrowAnyException();
        environment.setActiveProfiles("production", "local");
        assertThatThrownBy(() -> ProductionModeGuard.requireProduction(environment)).isInstanceOf(IllegalStateException.class);
        environment.setActiveProfiles("production");
        environment.setProperty("spring.datasource.username", "sager_owner");
        assertThatThrownBy(() -> ProductionModeGuard.requireProduction(environment)).hasMessageContaining("runtime database role");
        environment.setProperty("spring.datasource.username", "sager_runtime");
        environment.setProperty("sager.production.rate-limit-secret", "weak");
        assertThatThrownBy(() -> ProductionModeGuard.requireProduction(environment)).hasMessageContaining("login counter secret");
    }

    private String createAccount(String profile) {
        String email = "production-" + UUID.randomUUID() + "@example.test";
        provisioning.create(email, "Pessoa Sintética Produção", profile, PASSWORD.toCharArray());
        return email;
    }
    private URI url(String path) { return URI.create("http://127.0.0.1:" + port + path); }
    private HttpRequest.Builder proxy(String path) {
        return HttpRequest.newBuilder(url(path)).header("X-Forwarded-Proto", "https")
                .header("X-Forwarded-Host", "sager.example.test").header("X-Forwarded-Port", "443");
    }
    private class Browser implements AutoCloseable {
        final HttpClient client = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
        String cookie;
        HttpResponse<String> get(String path) throws Exception { return request(proxy(path).GET()); }
        HttpResponse<String> login(String email, String password) throws Exception {
            String csrf = json.readTree(get("/api/v1/auth/csrf").body()).path("token").asText();
            return request(proxy("/api/v1/auth/login").header("Content-Type", "application/x-www-form-urlencoded")
                    .header("X-CSRF-TOKEN", csrf).POST(HttpRequest.BodyPublishers.ofString("email=" +
                            URLEncoder.encode(email, StandardCharsets.UTF_8) + "&password=" + URLEncoder.encode(password, StandardCharsets.UTF_8))));
        }
        HttpResponse<String> send(String path, String body, String csrf) throws Exception {
            var request = proxy(path).header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body));
            if (csrf != null) request.header("X-CSRF-TOKEN", csrf);
            return request(request);
        }
        HttpResponse<String> request(HttpRequest.Builder request) throws Exception {
            if (cookie != null) request.header("Cookie", cookie);
            var response = client.send(request.build(), HttpResponse.BodyHandlers.ofString());
            for (String value : response.headers().allValues("Set-Cookie")) if (value.startsWith("SESSION=")) cookie = value.split(";", 2)[0];
            return response;
        }
        @Override public void close() { client.close(); }
    }
}
