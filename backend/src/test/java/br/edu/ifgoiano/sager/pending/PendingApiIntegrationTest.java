package br.edu.ifgoiano.sager.pending;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import br.edu.ifgoiano.sager.TestIdentity;
import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
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

/** Menu badges: each profile counts only what waits for it, with the access rules of the API. */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "sager.operations.expiry.enabled=false",
            "sager.integrations.worker.enabled=false"
        })
@ActiveProfiles("local")
@Import(PendingApiIntegrationTest.TimeConfiguration.class)
class PendingApiIntegrationTest {
    // 22h30 em America/Sao_Paulo: a chamada abre sem horário excepcional.
    static final Instant START = Instant.parse("2026-10-01T01:30:00Z");
    static final String PENDING = "/api/v1/me/pendencias";
    static final String PASSWORD = "Senha sintética 123!";
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");
    static final Path PRIVATE_ROOT;

    static {
        POSTGRES.start();
        try {
            PRIVATE_ROOT = Files.createTempDirectory("sager-pending-documents-").toAbsolutePath();
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("sager.documents.private-root", PRIVATE_ROOT::toString);
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired LocalAccountProvisioningService accounts;
    @Autowired MutableClock clock;
    @LocalServerPort int port;
    UUID resident, other, accommodation, guardian;

    @BeforeEach
    void fixtures() {
        clock.set(START);
        jdbc.update("DELETE FROM spring_session");
        jdbc.execute("TRUNCATE sager_occurrence,sager_warning,sager_notice,sager_commitment_term,"
                + "sager_communication,sager_discipline_idempotency,sager_night_call,sager_short_exit,"
                + "sager_long_exit,sager_whatsapp_conversation RESTART IDENTITY CASCADE");
        jdbc.update("DELETE FROM sager_local_account");
        resident = UUID.randomUUID();
        other = UUID.randomUUID();
        accommodation = UUID.randomUUID();
        guardian = UUID.randomUUID();
        UUID room = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_accommodation(id,code,name) VALUES (?,?,'Unidade Sintética')",
                accommodation, "PB-" + accommodation.toString().substring(0, 8));
        jdbc.update("INSERT INTO sager_room(id,code,number,accommodation_id,capacity,situation)"
                + " VALUES (?,?,'01',?,4,'Disponível')", room, "PB-" + room.toString().substring(0, 8),
                accommodation);
        for (UUID id : List.of(resident, other))
            jdbc.update("INSERT INTO sager_resident(id,name,enrollment,birth_date)"
                    + " VALUES (?,'Estudante Sintético',?,'2009-01-01')", id, id.toString());
        jdbc.update("INSERT INTO sager_room_allocation(id,resident_id,room_id,started_at) VALUES (?,?,?,?)",
                UUID.randomUUID(), resident, room, time(START.minusSeconds(86400)));
        jdbc.update("INSERT INTO sager_guardian(id,resident_id,name,relationship,phone,active)"
                + " VALUES (?,?,'Responsável Sintético','Mãe','+5562999990000',true)", guardian, resident);
        for (String profile : List.of("supervisor", "gestor", "residente", "other"))
            accounts.create(TestIdentity.enrollment(profile + "@example.invalid"), profile + "@example.invalid",
                    "Pessoa Sintética", profile.equals("other") ? "residente" : profile, PASSWORD.toCharArray());
        accounts.linkResident("residente@example.invalid", resident);
        accounts.linkResident("other@example.invalid", other);
    }

    @Test
    void supervisorCountsOnlyWhatWaitsForTheirAction() throws Exception {
        try (var sup = login("supervisor"); var student = login("residente")) {
            expect(sup, supervisor(0, 0, 0, 0, 0));

            // Saídas curtas de outro residente, gravadas direto em cada situação (minutos a partir de agora).
            shortExit("NOW", -10, 170, "AGUARDANDO_ANALISE"); // conta: o prazo é o retorno previsto
            shortExit("SCHEDULED", 60, 240, "AGUARDANDO_ANALISE"); // conta até a partida pedida
            shortExit("SCHEDULED", -1, 179, "AGUARDANDO_ANALISE"); // prazo vencido antes da rotina
            shortExit("SCHEDULED", 120, 300, "APROVADA"); // ainda não chegou a hora de sair
            shortExit("SCHEDULED", -5, 175, "APROVADA"); // espera o registro da saída
            shortExit("SCHEDULED", -30, 150, "EXPIRADA");
            ok(student, "POST", "/api/v1/saidas-longas", longExitPlan());
            expect(sup, supervisor(3, 1, 0, 0, 0));
            clock.set(START.plusSeconds(61 * 60));
            expect(sup, supervisor(2, 1, 0, 0, 0));
            clock.set(START.plusSeconds(121 * 60));
            expect(sup, supervisor(3, 1, 0, 0, 0));
            clock.set(START);

            String call = ok(sup, "POST", "/api/v1/chamadas", Map.of("accommodationId", accommodation))
                    .path("id").asString();
            expect(sup, supervisor(3, 1, 0, 1, 0));
            ok(sup, "PUT", "/api/v1/chamadas/" + call + "/registros/" + resident, Map.of("version", 0, "mark", "AUSENTE"));
            ok(sup, "POST", "/api/v1/chamadas/" + call + "/fechamento", Map.of("version", 1));
            expect(sup, supervisor(3, 1, 1, 0, 0));

            String notification = read(sup, "/api/v1/notificacoes").path("items").get(0).path("id").asString();
            String base = "/api/v1/notificacoes/" + notification;
            ok(sup, "POST", base + "/visualizar", Map.of("version", version(sup, base)));
            // A notificação vista sai da contagem (notification-seen-evidence).
            expect(sup, supervisor(3, 1, 0, 0, 0));
            Map<String, Object> warning = warningPayload();
            warning.put("version", version(sup, base));
            ok(sup, "POST", base + "/converter", warning);
            expect(sup, supervisor(3, 1, 0, 0, 0));
            // Origem corrigida depois da conversão e ainda válida: espera "Confirmar registro atual".
            jdbc.update("UPDATE sager_discipline_notification SET requires_review=true,version=version+1 WHERE id=?",
                    UUID.fromString(notification));
            expect(sup, supervisor(3, 1, 1, 0, 0));
            ok(sup, "POST", base + "/analisar", Map.of("version", version(sup, base),
                    "confirmCurrentEvidence", true, "reason", "Registro atual conferido pelo supervisor."));
            expect(sup, supervisor(3, 1, 0, 0, 0));

            UUID conversation = conversation();
            message(conversation, "IN", START.minusSeconds(120));
            message(conversation, "OUT", START.minusSeconds(60));
            expect(sup, supervisor(3, 1, 0, 0, 1));
            HttpResponse<String> read = write(sup, "POST", "/api/v1/conversas/" + conversation + "/leitura", Map.of());
            assertThat(read.statusCode()).withFailMessage(read.body()).isEqualTo(204);
            expect(sup, supervisor(3, 1, 0, 0, 0));
            message(conversation, "OUT", START.plusSeconds(30));
            expect(sup, supervisor(3, 1, 0, 0, 0));
            message(conversation, "IN", START.plusSeconds(60));
            expect(sup, supervisor(3, 1, 0, 0, 1));

            // Consultar nunca marca nada: a leitura repetida devolve o mesmo número.
            expect(sup, supervisor(3, 1, 0, 0, 1));
        }
    }

    @Test
    void seenOrAnalyzedNotificationLeavesTheCountAndStaysInTheList() throws Exception {
        try (var sup = login("supervisor")) {
            String call = ok(sup, "POST", "/api/v1/chamadas", Map.of("accommodationId", accommodation))
                    .path("id").asString();
            ok(sup, "PUT", "/api/v1/chamadas/" + call + "/registros/" + resident, Map.of("version", 0, "mark", "AUSENTE"));
            ok(sup, "POST", "/api/v1/chamadas/" + call + "/fechamento", Map.of("version", 1));
            // Pendente: ninguém viu ainda.
            expect(sup, supervisor(0, 0, 1, 0, 0));
            String notification = read(sup, "/api/v1/notificacoes").path("items").get(0).path("id").asString();
            String base = "/api/v1/notificacoes/" + notification;

            ok(sup, "POST", base + "/visualizar", Map.of("version", version(sup, base)));
            expect(sup, supervisor(0, 0, 0, 0, 0));
            assertThat(read(sup, base).path("status").asString()).isEqualTo("VISUALIZADA");
            assertThat(read(sup, "/api/v1/notificacoes?status=VISUALIZADA").path("items").size()).isEqualTo(1);

            ok(sup, "POST", base + "/analisar", Map.of("version", version(sup, base)));
            expect(sup, supervisor(0, 0, 0, 0, 0));
            assertThat(read(sup, base).path("status").asString()).isEqualTo("EM_ANALISE");
            assertThat(read(sup, "/api/v1/notificacoes?status=EM_ANALISE").path("items").size()).isEqualTo(1);
        }
    }

    @Test
    void residentCountsOnlyOwnCurrentCommunicationsWithoutAcknowledgment() throws Exception {
        try (var sup = login("supervisor"); var student = login("residente"); var stranger = login("other")) {
            expect(student, resident(0, 0, 0));
            JsonNode draft = ok(sup, "POST", "/api/v1/avisos", Map.of("title", "Aviso sintético",
                    "body", "Orientação sintética de convivência.", "residentIds", List.of(resident),
                    "idempotencyKey", UUID.randomUUID()));
            expect(student, resident(0, 0, 0));
            String notice = ok(sup, "POST", "/api/v1/avisos/" + draft.path("id").asString() + "/publicar",
                    Map.of("version", 0, "idempotencyKey", UUID.randomUUID())).path("communicationId").asString();
            JsonNode first = manual(sup), second = manual(sup), third = manual(sup);
            expect(student, resident(1, 3, 0));
            expect(stranger, resident(0, 0, 0));

            String own = "/api/v1/me/comunicacoes/" + notice;
            ok(student, "POST", own + "/leitura", Map.of("version", contentVersion(student, own)));
            expect(student, resident(1, 3, 0));
            ok(student, "POST", own + "/ciencia", Map.of("version", contentVersion(student, own)));
            expect(student, resident(0, 3, 0));

            ok(sup, "POST", "/api/v1/advertencias/" + third.path("id").asString() + "/anular",
                    Map.of("version", 0, "reason", "Advertência anulada após revisão humana motivada."));
            expect(student, resident(0, 2, 0));
            Map<String, Object> term = new LinkedHashMap<>();
            term.put("warningIds", List.of(first.path("id").asString(), second.path("id").asString()));
            term.put("decision", "O supervisor confirmou a relação dos fatos e orientou o compromisso de convivência.");
            term.put("confirmed", true);
            term.put("idempotencyKey", UUID.randomUUID());
            ok(sup, "POST", "/api/v1/residentes/" + resident + "/termos", term);
            expect(student, resident(0, 2, 1));
            expect(stranger, resident(0, 0, 0));
            expect(sup, supervisor(0, 0, 0, 0, 0));
        }
    }

    @Test
    void accessFollowsTheProfilesAndTheAutomaticRefreshHeader() throws Exception {
        try (var anonymous = browser(); var manager = login("gestor"); var sup = login("supervisor")) {
            assertError(get(anonymous, PENDING), 401, "unauthorized");
            assertError(get(manager, PENDING), 403, "forbidden");
            assertThat(write(sup, "POST", PENDING, Map.of()).statusCode()).isEqualTo(403);
            HttpResponse<String> automatic = sup.send(request(PENDING).header("X-Sager-Auto-Refresh", "1").GET()
                    .build(), HttpResponse.BodyHandlers.ofString());
            assertThat(automatic.statusCode()).withFailMessage(automatic.body()).isEqualTo(200);
            assertThat(automatic.headers().firstValue("Cache-Control").orElse("")).contains("no-store");
            assertThat(json.readTree(automatic.body())).isEqualTo(json.valueToTree(supervisor(0, 0, 0, 0, 0)));
        }
    }

    private static Map<String, Integer> supervisor(int shortExits, int longExits, int notifications,
            int nightCalls, int conversations) {
        return Map.of("shortExits", shortExits, "longExits", longExits, "notifications", notifications,
                "nightCalls", nightCalls, "conversations", conversations);
    }

    private static Map<String, Integer> resident(int notices, int warnings, int terms) {
        return Map.of("notices", notices, "warnings", warnings, "terms", terms);
    }

    private void expect(HttpClient client, Map<String, Integer> counts) throws Exception {
        assertThat(read(client, PENDING)).isEqualTo(json.valueToTree(counts));
    }

    private void shortExit(String mode, long departureMinutes, long returnMinutes, String status) {
        Instant now = clock.instant();
        boolean approved = status.equals("APROVADA");
        jdbc.update("INSERT INTO sager_short_exit(id,resident_id,resident_name,enrollment,departure_mode,"
                + "requested_departure_at,expected_return_at,reason,status,decision,decided_at,expiry_reason,"
                + "created_at,updated_at) VALUES (?,?,'Estudante Sintético',?,?,?,?,'Compromisso sintético',?,?,?,?,?,?)",
                UUID.randomUUID(), other, other.toString(), mode, time(now.plusSeconds(departureMinutes * 60)),
                time(now.plusSeconds(returnMinutes * 60)), status, approved ? "APPROVE" : null,
                approved ? time(now.minusSeconds(3600)) : null, status.equals("EXPIRADA") ? "DEADLINE" : null,
                time(now.minusSeconds(3600)), time(now.minusSeconds(3600)));
    }

    private Map<String, Object> longExitPlan() {
        Map<String, Object> plan = new LinkedHashMap<>();
        plan.put("departureMode", "NOW");
        plan.put("expectedReturnAt", clock.instant().plusSeconds(4 * 3600).toString());
        plan.put("reason", "Visita familiar sintética");
        plan.put("guardianId", guardian.toString());
        return plan;
    }

    private UUID conversation() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_whatsapp_conversation(id,provider,session,chat_id,phone,last_message_at,"
                + "created_at,updated_at) VALUES (?,'WHATSAPP_GATEWAY','default','5562999990000@c.us',"
                + "'+5562999990000',?,?,?)", id, time(START), time(START), time(START));
        return id;
    }

    private void message(UUID conversation, String direction, Instant at) {
        boolean in = direction.equals("IN");
        jdbc.update("INSERT INTO sager_whatsapp_message(id,conversation_id,provider,session,provider_message_id,"
                + "direction,origin,body,media_state,delivery_status,sent_at,received_at) VALUES"
                + " (?,?,'WHATSAPP_GATEWAY','default',?,?,?,'Mensagem sintética','NONE',?,?,?)",
                UUID.randomUUID(), conversation, UUID.randomUUID().toString(), direction,
                in ? "WEBHOOK" : "SUPERVISOR", in ? null : "SENT", time(at), time(at));
    }

    private JsonNode manual(HttpClient sup) throws Exception {
        Map<String, Object> payload = warningPayload();
        payload.put("residentId", resident);
        return ok(sup, "POST", "/api/v1/advertencias", payload);
    }

    private Map<String, Object> warningPayload() {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("category", "AUSENCIA");
        values.put("severity", "LEVE");
        values.put("description", "Registro sintético analisado pelo supervisor.");
        values.put("justification", "Decisão humana motivada com análise do contexto sintético.");
        values.put("warningDate", LocalDate.ofInstant(clock.instant(), ZoneId.of("America/Sao_Paulo")).toString());
        values.put("idempotencyKey", UUID.randomUUID());
        return values;
    }

    private long version(HttpClient client, String path) throws Exception {
        return read(client, path).path("version").asLong();
    }

    private long contentVersion(HttpClient client, String path) throws Exception {
        return read(client, path).path("contentVersion").asLong();
    }

    private static OffsetDateTime time(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    private HttpClient browser() {
        return HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();
    }

    private HttpClient login(String name) throws Exception {
        HttpClient client = browser();
        String body = "matricula=" + URLEncoder.encode(TestIdentity.enrollment(name + "@example.invalid"),
                StandardCharsets.UTF_8) + "&password=" + URLEncoder.encode(PASSWORD, StandardCharsets.UTF_8);
        HttpResponse<String> response = client.send(request("/api/v1/auth/login")
                .header("Content-Type", "application/x-www-form-urlencoded").header("X-CSRF-TOKEN", csrf(client))
                .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(204);
        return client;
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path));
    }

    private HttpResponse<String> get(HttpClient client, String path) throws Exception {
        return client.send(request(path).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode read(HttpClient client, String path) throws Exception {
        HttpResponse<String> response = get(client, path);
        assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(200);
        return json.readTree(response.body());
    }

    private String csrf(HttpClient client) throws Exception {
        return json.readTree(get(client, "/api/v1/auth/csrf").body()).path("token").asString();
    }

    private HttpResponse<String> write(HttpClient client, String method, String path, Object body) throws Exception {
        return client.send(request(path).header("Content-Type", "application/json").header("X-CSRF-TOKEN", csrf(client))
                .method(method, HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode ok(HttpClient client, String method, String path, Object body) throws Exception {
        HttpResponse<String> response = write(client, method, path, body);
        assertThat(response.statusCode()).withFailMessage(response.body()).isBetween(200, 201);
        return json.readTree(response.body());
    }

    private void assertError(HttpResponse<String> response, int status, String code) {
        assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(status);
        assertThat(json.readTree(response.body()).path("code").asString()).isEqualTo(code);
    }

    @TestConfiguration
    static class TimeConfiguration {
        @Bean
        @Primary
        MutableClock clock() {
            return new MutableClock();
        }
    }

    static class MutableClock extends Clock {
        private volatile Instant instant = START;

        void set(Instant value) {
            instant = value;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
