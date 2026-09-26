package br.edu.ifgoiano.sager.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.OidcLoginRequestPostProcessor;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT, properties = {
        "spring.security.oauth2.client.registration.google.client-id=synthetic-client",
        "spring.security.oauth2.client.registration.google.client-secret=synthetic-secret",
        "sager.auth.allowed-hd=ifgoiano.edu.br"
})
@AutoConfigureMockMvc
class AuthFlowIntegrationTest {
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
    private MockMvc mvc;

    @Autowired
    private IdentityRepository identities;

    @Autowired
    private JdbcTemplate jdbc;

    @LocalServerPort
    private int port;

    @BeforeEach
    void cleanIdentities() {
        jdbc.update("DELETE FROM sager_identity");
        jdbc.update("DELETE FROM spring_session");
    }

    @AfterAll
    static void stopDatabase() {
        POSTGRES.stop();
    }

    @Test
    void migratesAnEmptyPostgresAndKeepsIssuerSubjectStable() {
        assertThat(jdbc.queryForObject("SELECT to_regclass('spring_session')", String.class))
                .isNotNull();
        LocalIdentity first = identities.findOrCreate("https://accounts.google.com", "subject-1");
        LocalIdentity second = identities.findOrCreate("https://accounts.google.com", "subject-1");
        LocalIdentity otherIssuer = identities.findOrCreate("https://other.example", "subject-1");

        assertThat(second.id()).isEqualTo(first.id());
        assertThat(otherIssuer.id()).isNotEqualTo(first.id());
        assertThat(first.profiles()).isEmpty();
    }

    @Test
    void deniesAnAnonymousCallerAndAnUnprovisionedIdentity() throws Exception {
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
        identities.findOrCreate("https://accounts.google.com", "subject-1");
        mvc.perform(get("/api/v1/auth/me").with(syntheticLogin()))
                .andExpect(status().isForbidden());
    }

    @Test
    void returnsOnlyLocalProfilesAndRechecksDeactivation() throws Exception {
        LocalIdentity identity = identities.findOrCreate("https://accounts.google.com", "subject-1");
        jdbc.update("INSERT INTO sager_identity_profile (identity_id, profile) VALUES (?, ?)",
                identity.id(), "supervisor");

        mvc.perform(get("/api/v1/auth/me").with(syntheticLogin()))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.id").value(identity.id().toString()))
                .andExpect(jsonPath("$.email").value("user@example.invalid"))
                .andExpect(jsonPath("$.nome").value("Teste Sintético"))
                .andExpect(jsonPath("$.perfis[0]").value("supervisor"))
                .andExpect(jsonPath("$.sub").doesNotExist())
                .andExpect(jsonPath("$.matricula").doesNotExist());

        jdbc.update("UPDATE sager_identity SET active = false WHERE id = ?", identity.id());
        mvc.perform(get("/api/v1/auth/me").with(syntheticLogin()))
                .andExpect(status().isForbidden());
    }

    @Test
    void protectsLogoutWithCsrf() throws Exception {
        mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
        mvc.perform(post("/api/v1/auth/logout").with(syntheticLogin()))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/logout").with(syntheticLogin()).with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    void issuesAProtectedSessionCookie() throws Exception {
        mvc.perform(get("/oauth2/authorization/google"))
                .andExpect(status().isFound())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("Secure"),
                        org.hamcrest.Matchers.containsString("HttpOnly"),
                        org.hamcrest.Matchers.containsString("SameSite=Lax"))));
    }

    @Test
    void rejectsAnUncorrelatedCallbackAndInvalidatesTheSession() throws Exception {
        try (HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER).build()) {
            HttpResponse<Void> authorization = fetch(client, "/oauth2/authorization/google");
            String cookie = authorization.headers().firstValue("Set-Cookie").orElseThrow()
                    .split(";", 2)[0];
            assertThat(jdbc.queryForObject("SELECT count(*) FROM spring_session", Integer.class))
                    .isEqualTo(1);

            HttpRequest callback = HttpRequest.newBuilder(URI.create("http://localhost:" + port
                            + "/login/oauth2/code/google?code=invalid&state=unrecognized"))
                    .header("Cookie", cookie).GET().build();
            assertThat(client.send(callback, HttpResponse.BodyHandlers.discarding()).statusCode())
                    .isEqualTo(403);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM spring_session", Integer.class))
                    .isZero();
        }
    }

    @Test
    void startsAuthorizationCodeWithTheLocalCallback() throws Exception {
        mvc.perform(get("/oauth2/authorization/google")
                        .with(request -> {
                            request.setServerPort(8080);
                            return request;
                        }))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("response_type=code"),
                        org.hamcrest.Matchers.containsString("scope=openid%20profile%20email"),
                        org.hamcrest.Matchers.containsString("redirect_uri=http://localhost:8080/login/oauth2/code/google"))));
    }

    @Test
    void servesTheAnonymousAndOAuthEndpointsOverRealHttp() throws Exception {
        try (HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER).build()) {
            assertThat(fetch(client, "/").statusCode()).isEqualTo(200);
            assertThat(fetch(client, "/api/v1/auth/me").statusCode()).isEqualTo(401);
            assertThat(fetch(client, "/api/v1/auth/csrf").statusCode()).isEqualTo(200);

            HttpResponse<Void> oauth = fetch(client, "/oauth2/authorization/google");
            assertThat(oauth.statusCode()).isEqualTo(302);
            assertThat(oauth.headers().firstValue("Location").orElseThrow())
                    .contains("response_type=code")
                    .contains("redirect_uri=http://localhost:" + port + "/login/oauth2/code/google");
            assertThat(oauth.headers().firstValue("Set-Cookie").orElseThrow())
                    .contains("Secure", "HttpOnly", "SameSite=Lax");
        }
    }

    private HttpResponse<Void> fetch(HttpClient client, String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .GET().build();
        return client.send(request, HttpResponse.BodyHandlers.discarding());
    }

    private static OidcLoginRequestPostProcessor syntheticLogin() {
        return oidcLogin().idToken(token -> token
                .claim("iss", "https://accounts.google.com")
                .claim("sub", "subject-1")
                .claim("email", "user@example.invalid")
                .claim("email_verified", true)
                .claim("hd", "ifgoiano.edu.br")
                .claim("name", "Teste Sintético"));
    }
}
