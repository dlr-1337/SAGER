package br.edu.ifgoiano.sager.management.allocations;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;

import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Saída prevista em 30/06/2026: 23h30 de 30/06 em Brasília ainda não conclui; 00h30 de 01/07 conclui. */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT, properties = "sager.operations.expiry.enabled=false")
@ActiveProfiles("local")
@Import(CourseConclusionIntegrationTest.TimeConfiguration.class)
class CourseConclusionIntegrationTest {
    private static final String PASSWORD = "Senha sintética 123!";
    private static final Instant LAST_DAY = Instant.parse("2026-07-01T02:30:00Z");
    private static final Instant NEXT_DAY = Instant.parse("2026-07-01T03:30:00Z");
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

    @Autowired private LocalAccountProvisioningService provisioning;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper json;
    @Autowired private MutableClock clock;
    @LocalServerPort private int port;
    private UUID course;
    private UUID room;

    @BeforeEach
    void fixtures() {
        clock.set(LAST_DAY);
        jdbc.update("DELETE FROM spring_session");
        jdbc.update("DELETE FROM sager_room_allocation");
        jdbc.update("DELETE FROM sager_room");
        jdbc.update("DELETE FROM sager_accommodation_unit");
        jdbc.update("DELETE FROM sager_accommodation");
        jdbc.update("DELETE FROM sager_local_account");
        jdbc.update("DELETE FROM sager_resident");
        jdbc.update("DELETE FROM sager_course");
        course = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_course(id,name,level,duration_years) VALUES (?,'Sistemas Sintéticos','SUPERIOR',4)",
                course);
        room = room("CONC-01", 4);
        provisioning.create("gestor", null, "Gestor Sintético", "gestor", PASSWORD.toCharArray());
    }

    @Test
    void residentResponsesCarryStageExpectedExitAndConclusionFromTheServerClock() throws Exception {
        UUID resident = resident("20222CONC000001", 2022, 0, course);
        allocate(resident, room);
        try (HttpClient client = browser()) {
            login(client, "gestor");
            JsonNode before = read(client, "/api/v1/residentes/" + resident);
            assertThat(before.path("expectedExit").asText()).isEqualTo("2026-06-30");
            assertThat(before.path("concluded").asBoolean()).isFalse();
            assertThat(before.path("stage").asText()).isEqualTo("8º período");

            clock.set(NEXT_DAY);
            JsonNode after = read(client, "/api/v1/residentes/" + resident);
            assertThat(after.path("expectedExit").asText()).isEqualTo("2026-06-30");
            assertThat(after.path("concluded").asBoolean()).isTrue();
            assertThat(after.path("stage").asText()).isEqualTo("Concluinte");
            JsonNode inRoom = read(client, "/api/v1/residentes?roomId=" + room).get(0);
            assertThat(inRoom.path("id").asText()).isEqualTo(resident.toString());
            assertThat(inRoom.path("expectedExit").asText()).isEqualTo("2026-06-30");
            assertThat(inRoom.path("concluded").asBoolean()).isTrue();
            assertThat(inRoom.path("stage").asText()).isEqualTo("Concluinte");

            UUID legacy = resident("20222CONC000002", null, 0, course);
            JsonNode unknown = read(client, "/api/v1/residentes/" + legacy);
            assertThat(unknown.path("expectedExit").isNull()).isTrue();
            assertThat(unknown.path("stage").isNull()).isTrue();
            assertThat(unknown.path("concluded").asBoolean()).isFalse();
        }
    }

    private UUID resident(String enrollment, Integer entryYear, int extraSemesters, UUID courseId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_resident (id, name, enrollment, birth_date, course_id, entry_year, extra_semesters)
                VALUES (?, 'Estudante Sintético', ?, ?, ?, ?, ?)
                """, id, enrollment, LocalDate.of(2004, 3, 10), courseId, entryYear, extraSemesters);
        return id;
    }

    private UUID room(String code, int capacity) {
        UUID accommodation = jdbc.query("SELECT id FROM sager_accommodation WHERE code = 'CONC'",
                (result, row) -> result.getObject(1, UUID.class)).stream().findFirst().orElseGet(() -> {
                    UUID id = UUID.randomUUID();
                    jdbc.update("INSERT INTO sager_accommodation (id, code, name) VALUES (?, 'CONC', 'Sintético')", id);
                    return id;
                });
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_room (id, code, number, accommodation_id, capacity, situation)
                VALUES (?, ?, ?, ?, ?, 'Disponível')
                """, id, code, code, accommodation, capacity);
        return id;
    }

    private UUID allocate(UUID resident, UUID roomId) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_room_allocation (id, resident_id, room_id, started_at)"
                + " VALUES (?, ?, ?, TIMESTAMPTZ '2026-02-10 12:00:00-03')", id, resident, roomId);
        return id;
    }

    private void login(HttpClient client, String enrollment) throws Exception {
        String form = "matricula=" + URLEncoder.encode(enrollment, StandardCharsets.UTF_8)
                + "&password=" + URLEncoder.encode(PASSWORD, StandardCharsets.UTF_8);
        assertThat(send(client, HttpRequest.newBuilder(uri("/api/v1/auth/login"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("X-CSRF-TOKEN", csrf(client))
                .POST(HttpRequest.BodyPublishers.ofString(form)).build()).statusCode()).isEqualTo(204);
    }

    private String csrf(HttpClient client) throws Exception {
        return read(client, "/api/v1/auth/csrf").path("token").asText();
    }

    private JsonNode read(HttpClient client, String path) throws Exception {
        HttpResponse<String> response = send(client, HttpRequest.newBuilder(uri(path)).GET().build());
        assertThat(response.statusCode()).as(path).isEqualTo(200);
        return json.readTree(response.body());
    }

    private HttpResponse<String> write(HttpClient client, String method, String path, Object body) throws Exception {
        return send(client, HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                .header("X-CSRF-TOKEN", csrf(client))
                .method(method, HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build());
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

    @TestConfiguration
    static class TimeConfiguration {
        @Bean @Primary MutableClock testClock() {
            return new MutableClock();
        }
    }

    static class MutableClock extends Clock {
        private volatile Instant value = LAST_DAY;
        void set(Instant instant) { value = instant; }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return Clock.fixed(value, zone); }
        @Override public Instant instant() { return value; }
    }
}
