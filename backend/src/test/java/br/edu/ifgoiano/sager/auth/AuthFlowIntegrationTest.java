package br.edu.ifgoiano.sager.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.OidcLoginRequestPostProcessor;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest(properties = {
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

    @BeforeEach
    void cleanIdentities() {
        jdbc.update("DELETE FROM sager_identity");
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
