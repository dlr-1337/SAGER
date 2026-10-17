package br.edu.ifgoiano.sager.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;

import br.edu.ifgoiano.sager.SagerApplication;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.web.server.servlet.context.ServletWebServerApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class AuthFlowIntegrationTest {
    private static final String PASSWORD = "Senha sintetica 123!";
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
    private LocalAccountRepository repository;

    @Autowired
    private LocalAccountProvisioningService provisioning;

    @Autowired
    private PasswordEncoder passwords;

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
    }

    @Test
    void migratesWithoutChangingTheHistoricalIdentityTablesAndHashesPasswords() {
        assertThat(jdbc.queryForObject("SELECT to_regclass('sager_identity')", String.class))
                .isNotNull();
        assertThat(jdbc.queryForObject("SELECT to_regclass('spring_session')", String.class))
                .isNotNull();
        assertThat(jdbc.queryForObject("SELECT to_regclass('sager_local_account')", String.class))
                .isNotNull();
        assertThat(jdbc.queryForObject("""
                SELECT character_maximum_length FROM information_schema.columns
                WHERE lower(table_name) = 'spring_session' AND lower(column_name) = 'principal_name'
                """, Integer.class)).isEqualTo(320);

        char[] supplied = PASSWORD.toCharArray();
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("  GESTOR@example.invalid  "), "  GESTOR@example.invalid  ", " Gestor Sintetico ", "gestor", supplied);
        LocalAccount account = repository.findByEmail("gestor@example.invalid").orElseThrow();
        assertThat(account.email()).isEqualTo("gestor@example.invalid");
        assertThat(account.name()).isEqualTo("Gestor Sintetico");
        assertThat(account.profile()).isEqualTo("gestor");
        assertThat(account.passwordHash()).startsWith("{bcrypt}");
        assertThat(account.passwordHash()).doesNotContain(PASSWORD);
        assertThat(passwords.matches(PASSWORD, account.passwordHash())).isTrue();
        assertThat(supplied).containsOnly('\0');

        assertThatThrownBy(() -> provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("gestor@example.invalid"), "gestor@example.invalid", "Outro", "gestor",
                PASSWORD.toCharArray())).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void handlesLoginSessionCsrfAndLogoutOverRealHttp() throws Exception {
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("supervisor@example.invalid"), "supervisor@example.invalid", "Supervisor Sintetico", "supervisor",
                PASSWORD.toCharArray());
        try (HttpClient client = browser()) {
            HttpResponse<String> tokenResponse = get(client, "/api/v1/auth/csrf");
            assertThat(tokenResponse.statusCode()).isEqualTo(200);
            assertThat(tokenResponse.headers().firstValue("Cache-Control").orElseThrow())
                    .contains("no-store");
            String sessionCookie = tokenResponse.headers().allValues("Set-Cookie").getFirst();
            assertThat(sessionCookie).contains("HttpOnly", "SameSite=Lax").doesNotContain("Secure");
            String token = json.readTree(tokenResponse.body()).path("token").asText();
            assertThat(token).isNotBlank();

            assertThat(get(client, "/api/v1/auth/me").statusCode()).isEqualTo(401);
            assertThat(get(client, "/login").statusCode()).isNotEqualTo(200);
            assertThat(get(client, "/oauth2/authorization/google").statusCode())
                    .isNotEqualTo(302);
            assertThat(login(client, "supervisor@example.invalid", PASSWORD, null).statusCode())
                    .isEqualTo(403);

            assertThat(login(client, "supervisor@example.invalid", "senha incorreta", token)
                    .statusCode()).isEqualTo(401);
            assertThat(login(client, "supervisor@example.invalid", PASSWORD, token)
                    .statusCode()).isEqualTo(204);

            HttpResponse<String> me = get(client, "/api/v1/auth/me");
            assertThat(me.statusCode()).isEqualTo(200);
            JsonNode identity = json.readTree(me.body());
            assertThat(identity.path("id").asText()).isEqualTo(repository
                    .findByEmail("supervisor@example.invalid").orElseThrow().id().toString());
            assertThat(identity.path("nome").asText()).isEqualTo("Supervisor Sintetico");
            assertThat(identity.path("email").asText()).isEqualTo("supervisor@example.invalid");
            assertThat(identity.path("fotoUrl").isNull()).isTrue();
            assertThat(identity.path("perfis").get(0).asText()).isEqualTo("supervisor");
            assertThat(identity.path("matricula").asText()).isEqualTo("supervisor");
            assertThat(identity.has("passwordHash")).isFalse();
            assertThat(me.headers().firstValue("Cache-Control").orElseThrow())
                    .contains("no-store");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM spring_session", Integer.class))
                    .isPositive();

            assertThat(post(client, "/api/v1/auth/logout", "", null).statusCode())
                    .isEqualTo(403);
            String afterLoginToken = csrfToken(client);
            assertThat(post(client, "/api/v1/auth/logout", "", afterLoginToken).statusCode())
                    .isEqualTo(204);
            assertThat(get(client, "/api/v1/auth/me").statusCode()).isEqualTo(401);
        }
    }

    @Test
    void healthProfileRequiresIndependentProfessionalAccessAndCannotManageResidents() throws Exception {
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("saude@example.invalid"), "saude@example.invalid", "Profissional Sintetica", "saude",
                PASSWORD.toCharArray());
        try (HttpClient client = browser()) {
            String csrf = csrfToken(client);
            assertThat(login(client, "saude@example.invalid", PASSWORD, csrf).statusCode()).isEqualTo(204);
            JsonNode principal = json.readTree(get(client, "/api/v1/auth/me").body());
            assertThat(principal.path("perfis").get(0).asText()).isEqualTo("saude");
            assertThat(principal.path("residenteId").isNull()).isTrue();
            assertThat(principal.path("supervisorId").isNull()).isTrue();
            assertThat(get(client, "/api/v1/residentes").statusCode()).isEqualTo(403);
            assertThat(get(client, "/api/v1/auditoria").statusCode()).isEqualTo(403);
            HttpResponse<String> response = get(client, "/api/v1/saude/me");
            assertThat(response.statusCode()).isEqualTo(200);
            JsonNode capacity = json.readTree(response.body());
            assertThat(capacity.path("professionalGrant").isNull()).isTrue();
            assertThat(capacity.path("canAdministerAccess").asBoolean()).isFalse();
            assertThat(capacity.path("canAccessOwnRecord").asBoolean()).isFalse();
        }
    }

    @Test
    void onlyOperatorAssignedProfilesAreExposed() throws Exception {
        for (String profile : List.of("gestor", "supervisor", "residente")) {
            String email = profile + "@example.invalid";
            provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment(email), email, "Conta " + profile, profile, PASSWORD.toCharArray());
            try (HttpClient client = browser()) {
                assertThat(login(client, email, PASSWORD, csrfToken(client)).statusCode())
                        .isEqualTo(204);
                JsonNode me = json.readTree(get(client, "/api/v1/auth/me").body());
                assertThat(me.path("perfis").size()).isEqualTo(1);
                assertThat(me.path("perfis").get(0).asText()).isEqualTo(profile);
            }
        }
        assertThatThrownBy(() -> provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("outro@example.invalid"), "outro@example.invalid", "Outro", "admin",
                PASSWORD.toCharArray())).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void resetAndDisableRevokeExistingSessions() throws Exception {
        String email = "residente@example.invalid";
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment(email), email, "Residente Sintetico", "residente", PASSWORD.toCharArray());
        try (HttpClient client = browser()) {
            assertThat(login(client, email, PASSWORD, csrfToken(client)).statusCode()).isEqualTo(204);
            assertThat(get(client, "/api/v1/auth/me").statusCode()).isEqualTo(200);
            provisioning.resetPassword(email, "Outra senha sintetica 456!".toCharArray());
            assertThat(get(client, "/api/v1/auth/me").statusCode()).isEqualTo(401);
        }
        try (HttpClient client = browser()) {
            assertThat(login(client, email, PASSWORD, csrfToken(client)).statusCode()).isEqualTo(401);
            assertThat(login(client, email, "Outra senha sintetica 456!", csrfToken(client))
                    .statusCode()).isEqualTo(204);
            provisioning.disable(email);
            assertThat(get(client, "/api/v1/auth/me").statusCode()).isEqualTo(401);
            assertThat(login(client, email, "Outra senha sintetica 456!", csrfToken(client))
                    .statusCode()).isEqualTo(401);
        }
    }

    @Test
    void usesTheImmutableAccountIdInTheSessionIndex() throws Exception {
        String email = "a".repeat(60) + "@" + "b".repeat(60) + "." + "c".repeat(60)
                + "." + "d".repeat(60) + "." + "e".repeat(60);
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment(email), email, "Conta Sintetica", "gestor", PASSWORD.toCharArray());
        try (HttpClient client = browser()) {
            assertThat(login(client, email, PASSWORD, csrfToken(client)).statusCode()).isEqualTo(204);
            assertThat(get(client, "/api/v1/auth/me").statusCode()).isEqualTo(200);
            assertThat(jdbc.queryForObject("SELECT principal_name FROM spring_session",
                    String.class)).isEqualTo(repository.findByEmail(email).orElseThrow().id().toString());
        }
    }

    @Test
    void unknownProfileDoesNotExposeLoginOrCsrf() throws Exception {
        SpringApplication application = new SpringApplication(SagerApplication.class);
        application.setAdditionalProfiles("closed");
        try (var context = application.run("--server.port=0",
                "--spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                "--spring.datasource.username=" + POSTGRES.getUsername(),
                "--spring.datasource.password=" + POSTGRES.getPassword())) {
            int closedPort = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
            try (HttpClient client = browser()) {
                HttpResponse<String> csrf = request(client,
                        HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + closedPort
                                + "/api/v1/auth/csrf")).GET().build());
                assertThat(csrf.statusCode()).isIn(401, 403);
                HttpResponse<String> login = request(client,
                        HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + closedPort
                                + "/api/v1/auth/login"))
                                .POST(HttpRequest.BodyPublishers.ofString("matricula=x&password=y"))
                                .header("Content-Type", "application/x-www-form-urlencoded")
                                .build());
                assertThat(login.statusCode()).isIn(401, 403);
            }
        }
    }

    @Test
    void localModeRefusesNonLoopbackBindingOrMixedProfiles() {
        MockEnvironment publicAddress = new MockEnvironment()
                .withProperty("server.address", "0.0.0.0");
        publicAddress.setActiveProfiles("local");
        assertThatThrownBy(() -> SecurityConfiguration.requireLoopbackOnly(publicAddress))
                .isInstanceOf(IllegalStateException.class);

        MockEnvironment unspecifiedAddress = new MockEnvironment()
                .withProperty("server.address", "");
        unspecifiedAddress.setActiveProfiles("local");
        assertThatThrownBy(() -> SecurityConfiguration.requireLoopbackOnly(unspecifiedAddress))
                .isInstanceOf(IllegalStateException.class);

        MockEnvironment mixedProfiles = new MockEnvironment()
                .withProperty("server.address", "127.0.0.1");
        mixedProfiles.setActiveProfiles("local", "production");
        assertThatThrownBy(() -> SecurityConfiguration.requireLoopbackOnly(mixedProfiles))
                .isInstanceOf(IllegalStateException.class);
    }

    private HttpClient browser() {
        return HttpClient.newBuilder()
                .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    private String csrfToken(HttpClient client) throws Exception {
        HttpResponse<String> response = get(client, "/api/v1/auth/csrf");
        assertThat(response.statusCode()).isEqualTo(200);
        return json.readTree(response.body()).path("token").asText();
    }

    private HttpResponse<String> login(HttpClient client, String email, String password, String csrf)
            throws Exception {
        String form = "matricula=" + URLEncoder.encode(br.edu.ifgoiano.sager.TestIdentity.enrollment(email), StandardCharsets.UTF_8)
                + "&password=" + URLEncoder.encode(password, StandardCharsets.UTF_8);
        return post(client, "/api/v1/auth/login", form, csrf);
    }

    private HttpResponse<String> post(HttpClient client, String path, String body, String csrf)
            throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri(path))
                .header("Content-Type", "application/x-www-form-urlencoded");
        if (csrf != null) {
            builder.header("X-CSRF-TOKEN", csrf);
        }
        return request(client, builder.POST(HttpRequest.BodyPublishers.ofString(body)).build());
    }

    private HttpResponse<String> get(HttpClient client, String path) throws Exception {
        return request(client, HttpRequest.newBuilder(uri(path)).GET().build());
    }

    private HttpResponse<String> request(HttpClient client, HttpRequest request) throws Exception {
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create("http://127.0.0.1:" + port + path);
    }
}
