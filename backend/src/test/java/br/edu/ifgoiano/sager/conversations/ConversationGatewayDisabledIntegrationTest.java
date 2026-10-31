package br.edu.ifgoiano.sager.conversations;

import static org.assertj.core.api.Assertions.assertThat;

import br.edu.ifgoiano.sager.TestIdentity;
import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.UUID;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "sager.operations.expiry.enabled=false",
            "sager.integrations.worker.enabled=false"
        })
@ActiveProfiles("local")
class ConversationGatewayDisabledIntegrationTest {
    static final String PASSWORD = "Senha sintética 123!";
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
        r.add(
                "sager.documents.private-root",
                () -> Path.of(System.getProperty("java.io.tmpdir"), "sager-disabled-" + UUID.randomUUID()).toString());
        r.add("sager.integrations.whatsapp.enabled", () -> "false");
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired LocalAccountProvisioningService provisioning;
    @LocalServerPort int port;

    @Test
    void historyStaysReadableAndSendingExplainsWhyItIsUnavailable() throws Exception {
        provisioning.create(
                TestIdentity.enrollment("supervisor@example.invalid"),
                "supervisor@example.invalid",
                "Pessoa sintética",
                "supervisor",
                PASSWORD.toCharArray());
        UUID conversation = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        jdbc.update(
                "INSERT INTO sager_whatsapp_conversation(id,provider,session,chat_id,phone,last_message_at,"
                        + "created_at,updated_at) VALUES (?,'WHATSAPP_GATEWAY','default','5562999990000@c.us',"
                        + "'+5562999990000',?,?,?)",
                conversation,
                now,
                now,
                now);
        jdbc.update(
                "INSERT INTO sager_whatsapp_message(id,conversation_id,provider,session,provider_message_id,"
                        + "direction,origin,body,media_state,sent_at,received_at) VALUES"
                        + " (?,?,'WHATSAPP_GATEWAY','default','A','IN','WEBHOOK','guardada','NONE',?,?)",
                UUID.randomUUID(),
                conversation,
                now,
                now);
        try (HttpClient c = login()) {
            JsonNode history =
                    json.readTree(get(c, "/api/v1/conversas/" + conversation + "/mensagens").body());
            assertThat(history.path("items").get(0).path("body").asString()).isEqualTo("guardada");

            JsonNode session = json.readTree(get(c, "/api/v1/conversas/sessao").body());
            assertThat(session.path("available").asBoolean()).isFalse();
            assertThat(session.path("status").asString()).isEqualTo("DISABLED");
            assertThat(session.path("canSend").asBoolean()).isFalse();
            assertThat(session.path("unavailableReason").asString()).isEqualTo("gateway_disabled");

            assertUnavailable(
                    post(c, "/api/v1/conversas/" + conversation + "/mensagens", "{\"text\":\"oi\"}", "chave-desligada"));
            assertUnavailable(
                    post(c, "/api/v1/conversas", "{\"guardianId\":\"" + UUID.randomUUID() + "\"}", null));
            assertUnavailable(post(c, "/api/v1/conversas/sessao/inicio", "{}", null));
            assertUnavailable(get(c, "/api/v1/conversas/sessao/qr"));
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT COUNT(*) FROM sager_whatsapp_message WHERE direction='OUT'",
                                    Long.class))
                    .isZero();
        }
    }

    private void assertUnavailable(HttpResponse<String> response) throws Exception {
        assertThat(response.statusCode()).describedAs(response.body()).isEqualTo(503);
        assertThat(json.readTree(response.body()).path("code").asString()).isEqualTo("gateway_disabled");
    }

    private HttpClient login() throws Exception {
        HttpClient c =
                HttpClient.newBuilder()
                        .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
                        .build();
        String body =
                "matricula="
                        + URLEncoder.encode(
                                TestIdentity.enrollment("supervisor@example.invalid"),
                                StandardCharsets.UTF_8)
                        + "&password="
                        + URLEncoder.encode(PASSWORD, StandardCharsets.UTF_8);
        assertThat(
                        c.send(
                                        HttpRequest.newBuilder(uri("/api/v1/auth/login"))
                                                .header("Content-Type", "application/x-www-form-urlencoded")
                                                .header("X-CSRF-TOKEN", csrf(c))
                                                .POST(HttpRequest.BodyPublishers.ofString(body))
                                                .build(),
                                        HttpResponse.BodyHandlers.ofString())
                                .statusCode())
                .isEqualTo(204);
        return c;
    }

    private URI uri(String p) {
        return URI.create("http://127.0.0.1:" + port + p);
    }

    private String csrf(HttpClient c) throws Exception {
        return json.readTree(get(c, "/api/v1/auth/csrf").body()).path("token").asString();
    }

    private HttpResponse<String> get(HttpClient c, String p) throws Exception {
        return c.send(
                HttpRequest.newBuilder(uri(p)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> post(HttpClient c, String p, String body, String key) throws Exception {
        HttpRequest.Builder request =
                HttpRequest.newBuilder(uri(p))
                        .header("Content-Type", "application/json")
                        .header("X-CSRF-TOKEN", csrf(c))
                        .POST(HttpRequest.BodyPublishers.ofString(body));
        if (key != null) request.header("Idempotency-Key", key);
        return c.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
