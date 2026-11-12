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
import java.util.concurrent.CompletableFuture;

import br.edu.ifgoiano.sager.SagerApplication;
import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
        jdbc.update("DELETE FROM sager_local_account");
        jdbc.update("DELETE FROM sager_guardian");
        jdbc.update("DELETE FROM sager_room_allocation");
        jdbc.update("DELETE FROM sager_room");
        jdbc.update("DELETE FROM sager_accommodation_unit");
        jdbc.update("DELETE FROM sager_accommodation");
        jdbc.update("DELETE FROM sager_resident");
        jdbc.update("DELETE FROM sager_course");
        jdbc.update("DELETE FROM sager_login_rate_bucket");
    }

    @Test
    void gestorCreatesReadsAndUpdatesWithRequiredBirthDateAndCourse() throws Exception {
        account("gestor");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            HttpResponse<String> empty = get(client, PATH);
            assertThat(empty.statusCode()).isEqualTo(200);
            assertNoStore(empty);
            assertThat(json.readTree(empty.body()).size()).isZero();

            HttpResponse<String> created = post(client, PATH,
                    body("  Estudante Sintético  ", "  20261DEMO00000A  ", BIRTH_DATE, "Curso Inicial", null),
                    csrf(client));
            assertThat(created.statusCode()).isEqualTo(201);
            assertNoStore(created);
            JsonNode value = json.readTree(created.body());
            String id = value.path("id").asText();
            assertThat(UUID.fromString(id)).isNotNull();
            assertThat(created.headers().firstValue("Location").orElseThrow())
                    .isEqualTo(PATH + "/" + id);
            assertThat(value.size()).isEqualTo(10);
            assertThat(value.path("name").asText()).isEqualTo("Estudante Sintético");
            assertThat(value.path("enrollment").asText()).isEqualTo("20261DEMO00000A");
            assertThat(value.path("birthDate").asText()).isEqualTo(BIRTH_DATE);
            assertThat(value.path("course").asText()).isEqualTo("Curso Inicial");
            assertThat(value.path("version").asLong()).isZero();
            assertThat(json.readTree(get(client, PATH).body()).size()).isEqualTo(1);
            assertNoStore(get(client, PATH + "/" + id));

            HttpResponse<String> changed = put(client, PATH + "/" + id,
                    body("Estudante Atualizado", " 20261demo00000a ", "2005-04-09",
                            "  Curso Sintético  ", 0), csrf(client));
            assertThat(changed.statusCode()).isEqualTo(200);
            assertNoStore(changed);
            JsonNode updated = json.readTree(changed.body());
            assertThat(updated.path("birthDate").asText()).isEqualTo("2005-04-09");
            assertThat(updated.path("course").asText()).isEqualTo("Curso Sintético");
            assertThat(updated.path("enrollment").asText()).isEqualTo("20261DEMO00000A");
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
            for (String invalid : List.of("{}", "{", body("Pessoa Sintética", "20261DEMO00000A", null, null, null),
                    body("Pessoa Sintética", "20261DEMO00000A", "", null, null),
                    body("Pessoa Sintética", "20261DEMO00000A", "  ", null, null),
                    body("AB", "20261DEMO00000A", BIRTH_DATE, null, null),
                    body("Pessoa Sintética", " ", BIRTH_DATE, null, null),
                    body("Pessoa Sintética", "A".repeat(65), BIRTH_DATE, null, null),
                    body("N".repeat(201), "20261DEMO00000A", BIRTH_DATE, null, null),
                    body("Pessoa Sintética", "20261DEMO00000A", "2026-02-30", null, null),
                    body("Pessoa Sintética", "20261DEMO00000A", LocalDate.now().plusDays(1).toString(), null, null),
                    body("Pessoa Sintética", "20261DEMO00000A", BIRTH_DATE, "C".repeat(201), null),
                    body(123, "20261DEMO00000A", BIRTH_DATE, null, null),
                    body("Pessoa Sintética", 123, BIRTH_DATE, null, null),
                    body("Pessoa Sintética", "20261DEMO00000A", 20260101, null, null),
                    body("Pessoa Sintética", "20261DEMO00000A", BIRTH_DATE, false, null))) {
                assertError(post(client, PATH, invalid, csrf(client)), 400, "invalid_input");
            }
            assertError(get(client, PATH + "/not-a-uuid"), 400, "invalid_input");
            assertError(get(client, PATH + "/" + UUID.randomUUID()), 404, "not_found");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_resident", Integer.class)).isZero();
        }
    }

    @Test
    void rejectsFormatsOutsideTheRulesAndNormalizesTyping() throws Exception {
        account("gestor");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            String valid = "20261REGRA00001";
            String future = (LocalDate.now(java.time.ZoneId.of("America/Sao_Paulo")).getYear() + 1) + "1ABCD000123";
            for (String invalid : List.of(body("Maria", valid, BIRTH_DATE, null, null),
                    body("Ana2 Silva", valid, BIRTH_DATE, null, null),
                    body("Pessoa Sintética", "123", BIRTH_DATE, null, null),
                    body("Pessoa Sintética", "SAGER-QA-2026-001", BIRTH_DATE, null, null),
                    body("Pessoa Sintética", future, BIRTH_DATE, null, null),
                    body("Pessoa Sintética", valid, "1900-01-01", null, null),
                    body("Pessoa Sintética", valid, LocalDate.now().toString(), null, null),
                    body("Pessoa Sintética", valid, BIRTH_DATE, "  ", null))) {
                assertError(post(client, PATH, invalid, csrf(client)), 400, "invalid_input");
            }
            var input = new LinkedHashMap<String, Object>(Map.of("name", "Pessoa Sintética", "enrollment", valid,
                    "birthDate", BIRTH_DATE, "courseId", courseId("Curso Sintético"),
                    "institutionalEmail", "pessoa@gmail.com", "password", PASSWORD, "passwordConfirmation", PASSWORD));
            assertError(post(client, PATH, json.writeValueAsString(input), csrf(client)), 400, "invalid_input");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_resident", Integer.class)).isZero();
            input.put("institutionalEmail", "Pessoa.Silva@ESTUDANTE.ifgoiano.edu.br");
            input.put("name", "ana   d\u2019ávila");
            input.put("enrollment", "2017 1.abcd/000-123");
            JsonNode created = json.readTree(post(client, PATH, json.writeValueAsString(input), csrf(client)).body());
            assertThat(created.path("name").asText()).isEqualTo("Ana D'Ávila");
            assertThat(created.path("enrollment").asText()).isEqualTo("20171ABCD000123");
            assertThat(created.path("institutionalEmail").asText()).isEqualTo("pessoa.silva@estudante.ifgoiano.edu.br");
        }
    }

    @Test
    void legacyResidentEditsWithoutFixingUnchangedFieldsButMustChooseACourse() throws Exception {
        account("gestor");
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident (id, name, enrollment, birth_date, institutional_email) VALUES (?, ?, ?, ?, ?)",
                id, "Maria", "SAGER-QA-2026-001", LocalDate.of(1900, 1, 1), "maria@gmail.com");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            assertThat(json.readTree(get(client, PATH + "/" + id).body()).path("course").isNull()).isTrue();
            assertError(put(client, PATH + "/" + id, legacy("Maria", "SAGER-QA-2026-001", "1900-01-01", null, "maria@gmail.com", 0), csrf(client)),
                    400, "invalid_input");
            UUID course = courseId("Curso Sintético");
            HttpResponse<String> edited = put(client, PATH + "/" + id,
                    legacy("Maria", "SAGER-QA-2026-001", "1900-01-01", course, "maria@gmail.com", 0), csrf(client));
            assertThat(edited.statusCode()).isEqualTo(200);
            JsonNode value = json.readTree(edited.body());
            assertThat(value.path("name").asText()).isEqualTo("Maria");
            assertThat(value.path("enrollment").asText()).isEqualTo("SAGER-QA-2026-001");
            assertThat(auditRows(id).getLast().fields()).containsExactlyInAnyOrder("course", "courseId");
            for (String changed : List.of(legacy("Mariana", "SAGER-QA-2026-001", "1900-01-01", course, "maria@gmail.com", 1),
                    legacy("Maria", "SAGER-QA-2026-002", "1900-01-01", course, "maria@gmail.com", 1),
                    legacy("Maria", "SAGER-QA-2026-001", "1900-01-02", course, "maria@gmail.com", 1),
                    legacy("Maria", "SAGER-QA-2026-001", "1900-01-01", course, "nova@gmail.com", 1))) {
                assertError(put(client, PATH + "/" + id, changed, csrf(client)), 400, "invalid_input");
            }
        }
    }

    private String legacy(String name, String enrollment, String birthDate, UUID course, String email, long version) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("name", name);
        fields.put("enrollment", enrollment);
        fields.put("birthDate", birthDate);
        fields.put("courseId", course);
        fields.put("institutionalEmail", email);
        fields.put("version", version);
        return json.writeValueAsString(fields);
    }

    @Test
    void duplicateEnrollmentAndStaleVersionDoNotOverwriteOtherRecords() throws Exception {
        account("gestor");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            String first = create(client, "Estudante Primeiro", "20261DEMO00000A");
            String second = create(client, "Estudante Segundo", "20261DEMO00000B");
            assertError(post(client, PATH,
                    body("Estudante Duplicado", " 20261demo00000a ", BIRTH_DATE, null, null), csrf(client)),
                    409, "duplicate_enrollment");
            assertError(put(client, PATH + "/" + second,
                    body("Estudante Segundo", "20261DEMO00000A", BIRTH_DATE, null, 0), csrf(client)),
                    409, "duplicate_enrollment");
            String fresh = body("Estudante Primeiro Atualizado", "20261DEMO00000A", BIRTH_DATE, null, 0);
            assertThat(put(client, PATH + "/" + first, fresh, csrf(client)).statusCode())
                    .isEqualTo(200);
            assertError(put(client, PATH + "/" + first,
                    body("Alteração Perdida", "20261DEMO00000A", BIRTH_DATE, null, 0), csrf(client)),
                    409, "stale_version");
            for (Object invalidVersion : List.of(-1, 0.5, "0", Long.MAX_VALUE, true)) {
                assertError(put(client, PATH + "/" + first,
                        body("Estudante Primeiro", "20261DEMO00000A", BIRTH_DATE, null, invalidVersion),
                        csrf(client)), 400, "invalid_input");
            }
            assertError(put(client, PATH + "/" + first,
                    body("Estudante Primeiro", "20261DEMO00000A", BIRTH_DATE, null, null), csrf(client)),
                    400, "invalid_input");
            for (Object missingDate : List.of("", "   ")) {
                assertError(put(client, PATH + "/" + first,
                        body("Estudante Primeiro", "20261DEMO00000A", missingDate, null, 1),
                        csrf(client)), 400, "invalid_input");
            }
            assertError(put(client, PATH + "/" + first,
                    body("Estudante Primeiro", "20261DEMO00000A", null, null, 1), csrf(client)),
                    400, "invalid_input");
            assertError(put(client, PATH + "/" + first,
                    "{\"name\":\"Estudante Primeiro\",\"enrollment\":\"20261DEMO00000A\",\"version\":1}",
                    csrf(client)), 400, "invalid_input");
            assertError(put(client, PATH + "/" + UUID.randomUUID(), fresh, csrf(client)),
                    404, "not_found");
            JsonNode value = json.readTree(get(client, PATH + "/" + first).body());
            assertThat(value.path("name").asText()).isEqualTo("Estudante Primeiro Atualizado");
            assertThat(value.path("version").asLong()).isEqualTo(1);
            assertThat(json.readTree(get(client, PATH + "/" + second).body())
                    .path("enrollment").asText()).isEqualTo("20261DEMO00000B");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_resident", Integer.class)).isEqualTo(2);
        }
    }

    @Test
    void normalizesUnicodeSpacesBeforePersistingAndCheckingEnrollment() throws Exception {
        account("gestor");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            HttpResponse<String> created = post(client, PATH,
                    body("\u00a0Estudante Sintético\u2003", "\u00a020261DEMO00000A\u2003", BIRTH_DATE,
                            null, null), csrf(client));
            assertThat(created.statusCode()).isEqualTo(201);
            JsonNode value = json.readTree(created.body());
            assertThat(value.path("name").asText()).isEqualTo("Estudante Sintético");
            assertThat(value.path("enrollment").asText()).isEqualTo("20261DEMO00000A");

            assertError(post(client, PATH,
                    body("Outra Pessoa", "20261demo00000a\u00a0", BIRTH_DATE, null, null), csrf(client)),
                    409, "duplicate_enrollment");
            String otherId = create(client, "Estudante Segundo", "20261DEMO00000B");
            assertError(put(client, PATH + "/" + otherId,
                    body("Estudante Segundo", "\u200320261demo00000a", BIRTH_DATE, null, 0), csrf(client)),
                    409, "duplicate_enrollment");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_resident", Integer.class))
                    .isEqualTo(2);
        }
    }

    @Test
    void auditsSuccessfulWritesWithNormalizedFieldNamesAndNoSensitiveValues() throws Exception {
        assertThat(jdbc.queryForObject("SELECT to_regclass('sager_audit_event')", String.class)).isNotNull();
        account("gestor");
        UUID actor = jdbc.queryForObject("SELECT id FROM sager_local_account WHERE email = ?",
                UUID.class, "gestor@example.invalid");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            UUID id = UUID.fromString(create(client, "Estudante Privado", "20261AUDIT00001"));
            List<AuditRow> created = auditRows(id);
            assertThat(created).hasSize(1);
            AuditRow first = created.getFirst();
            assertThat(first.resource()).isEqualTo("RESIDENT");
            assertThat(first.action()).isEqualTo("CREATE");
            assertThat(first.version()).isZero();
            assertThat(first.fields()).containsExactlyInAnyOrder("name", "enrollment", "birthDate", "courseId", "institutionalEmail",
                    "entryYear", "extraSemesters");
            assertThat(first.actorId()).isEqualTo(actor);
            assertThat(first.profile()).isEqualTo("gestor");
            assertThat(first.requestId()).isNotNull();
            assertThat(jdbc.queryForObject("SELECT row_to_json(event)::text FROM sager_audit_event event "
                    + "WHERE resource_id = ?", String.class, id))
                    .doesNotContain("Estudante Privado", "20261AUDIT00001", BIRTH_DATE,
                            "gestor@example.invalid", PASSWORD);

            assertThat(get(client, PATH).statusCode()).isEqualTo(200);
            assertThat(get(client, PATH + "/" + id).statusCode()).isEqualTo(200);
            assertThat(auditRows(id)).hasSize(1);
            assertThat(put(client, PATH + "/" + id,
                    body("\u00a0Estudante Privado\u2003", "20261AUDIT00001", BIRTH_DATE,
                            "  Curso Privado  ", 0), csrf(client)).statusCode()).isEqualTo(200);
            List<AuditRow> updated = auditRows(id);
            assertThat(updated).hasSize(2);
            assertThat(updated.getLast().action()).isEqualTo("UPDATE");
            assertThat(updated.getLast().version()).isEqualTo(1);
            assertThat(updated.getLast().fields()).containsExactlyInAnyOrder("course", "courseId");
            assertThat(updated.getLast().requestId()).isNotEqualTo(first.requestId());

            assertThat(put(client, PATH + "/" + id,
                    body("Estudante Privado", "20261AUDIT00001", BIRTH_DATE,
                            "Curso Privado", 1), csrf(client)).statusCode()).isEqualTo(200);
            assertThat(auditRows(id).getLast().fields()).isEmpty();
            assertThat(auditRows(id).getLast().version()).isEqualTo(2);
            assertError(put(client, PATH + "/" + id,
                    body("Outra Pessoa", "20261AUDIT00001", BIRTH_DATE, null, 1), csrf(client)),
                    409, "stale_version");
            assertError(put(client, PATH + "/" + id,
                    body("AB", "20261AUDIT00001", BIRTH_DATE, null, 2), csrf(client)),
                    400, "invalid_input");
            assertError(post(client, PATH,
                    body("Outra Pessoa", "20261AUDIT00001", BIRTH_DATE, null, null), csrf(client)),
                    409, "duplicate_enrollment");
            assertThat(auditRows(id)).hasSize(3);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE actor_id = ?",
                    Integer.class, actor)).isEqualTo(3);
        }
    }

    @Test
    void auditFailureRollsBackResidentCreationAndUpdate() throws Exception {
        assertThat(jdbc.queryForObject("SELECT to_regclass('sager_audit_event')", String.class)).isNotNull();
        account("gestor");
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident (id, name, enrollment, birth_date) VALUES (?, ?, ?, ?)",
                id, "Estudante Original", "AUDIT-ROLLBACK-UPDATE", LocalDate.of(2006, 1, 2));
        jdbc.execute("""
                CREATE FUNCTION reject_test_resident_audit() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    IF NEW.resource = 'RESIDENT' THEN
                        RAISE EXCEPTION 'synthetic audit insertion failure';
                    END IF;
                    RETURN NEW;
                END
                $$
                """);
        jdbc.execute("CREATE TRIGGER reject_test_resident_audit BEFORE INSERT ON sager_audit_event "
                + "FOR EACH ROW EXECUTE FUNCTION reject_test_resident_audit()");
        try (HttpClient client = browser()) {
            login(client, "gestor");
            assertThat(post(client, PATH,
                    body("Estudante Novo", "20261AUDIT00002", BIRTH_DATE, null, null), csrf(client))
                    .statusCode()).isEqualTo(500);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_resident WHERE enrollment = ?",
                    Integer.class, "20261AUDIT00002")).isZero();
            assertThat(put(client, PATH + "/" + id,
                    body("Estudante Modificado", "AUDIT-ROLLBACK-UPDATE", BIRTH_DATE, null, 0), csrf(client))
                    .statusCode()).isEqualTo(500);
            assertThat(jdbc.queryForObject("SELECT name FROM sager_resident WHERE id = ?", String.class, id))
                    .isEqualTo("Estudante Original");
            assertThat(jdbc.queryForObject("SELECT version FROM sager_resident WHERE id = ?", Long.class, id))
                    .isZero();
            assertThat(auditRows(id)).isEmpty();
        } finally {
            jdbc.execute("DROP TRIGGER reject_test_resident_audit ON sager_audit_event");
            jdbc.execute("DROP FUNCTION reject_test_resident_audit()");
        }
    }

    @Test
    void concurrentResidentUpdatesAuditOnlyTheSuccessfulVersionAndItsFields() throws Exception {
        assertThat(jdbc.queryForObject("SELECT to_regclass('sager_audit_event')", String.class)).isNotNull();
        account("gestor");
        try (HttpClient one = browser(); HttpClient two = browser()) {
            login(one, "gestor");
            login(two, "gestor");
            UUID id = UUID.fromString(create(one, "Estudante Original", "20261AUDIT00003"));
            String tokenOne = csrf(one);
            String tokenTwo = csrf(two);
            CompletableFuture<Integer> nameChange = CompletableFuture.supplyAsync(() -> parallelUpdate(
                    one, id, body("Estudante Atualizado", "20261AUDIT00003", BIRTH_DATE, null, 0), tokenOne));
            CompletableFuture<Integer> courseChange = CompletableFuture.supplyAsync(() -> parallelUpdate(
                    two, id, body("Estudante Original", "20261AUDIT00003", BIRTH_DATE, "Curso Novo", 0), tokenTwo));
            assertThat(List.of(nameChange.join(), courseChange.join())).containsExactlyInAnyOrder(200, 409);
            List<AuditRow> rows = auditRows(id);
            assertThat(rows).hasSize(2);
            assertThat(rows.getLast().action()).isEqualTo("UPDATE");
            assertThat(rows.getLast().version()).isEqualTo(1);
            if (nameChange.join() == 200) assertThat(rows.getLast().fields()).containsExactly("name");
            else assertThat(rows.getLast().fields()).containsExactlyInAnyOrder("course", "courseId");
            assertThat(json.readTree(get(one, PATH + "/" + id).body()).path("version").asLong()).isEqualTo(1);
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
            id = create(gestor, "Estudante Exemplo", "20261DEMO00000A");
            assertThat(post(gestor, PATH, body("Outro Estudante", "20261DEMO00000B", BIRTH_DATE, null, null),
                    null).statusCode()).isEqualTo(403);
            assertThat(put(gestor, PATH + "/" + id,
                    body("Estudante Exemplo", "20261DEMO00000A", BIRTH_DATE, null, 0), null).statusCode())
                    .isEqualTo(403);
        }
        try (HttpClient supervisor = browser()) {
            login(supervisor, "supervisor");
            assertThat(get(supervisor, PATH).statusCode()).isEqualTo(200);
            assertThat(get(supervisor, PATH + "/" + id).statusCode()).isEqualTo(200);
            assertThat(post(supervisor, PATH,
                    body("Outro Estudante", "20261DEMO00000B", BIRTH_DATE, null, null), csrf(supervisor))
                    .statusCode()).isEqualTo(201);
            assertThat(put(supervisor, PATH + "/" + id,
                    body("Estudante Editado", "20261DEMO00000A", BIRTH_DATE, null, 0), csrf(supervisor))
                    .statusCode()).isEqualTo(200);
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
                    body("Outro Estudante", "20261DEMO00000C", BIRTH_DATE, null, null), csrf(residente))
                    .statusCode()).isEqualTo(403);
            assertThat(post(anonymous, PATH,
                    body("Outro Estudante", "20261DEMO00000C", BIRTH_DATE, null, null), csrf(anonymous))
                    .statusCode()).isEqualTo(401);
            assertThat(put(residente, PATH + "/" + id,
                    body("Estudante Exemplo", "20261DEMO00000A", BIRTH_DATE, null, 1), csrf(residente))
                    .statusCode()).isEqualTo(403);
            assertThat(put(anonymous, PATH + "/" + id,
                    body("Estudante Exemplo", "20261DEMO00000A", BIRTH_DATE, null, 1), csrf(anonymous))
                    .statusCode()).isEqualTo(401);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_resident", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT to_regclass('sager_audit_event')", String.class)).isNotNull();
        assertThat(auditRows(UUID.fromString(id))).hasSize(2);
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM sager_audit_event
                WHERE resource = 'RESIDENT' AND actor_id IN (SELECT id FROM sager_local_account)
                """, Integer.class)).isEqualTo(3);
    }

    @Test
    void outsideLocalProfileDoesNotExposeResidentApi() throws Exception {
        SpringApplication application = new SpringApplication(SagerApplication.class);
        application.setAdditionalProfiles("closed");
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

    @Test
    void createsLinkedLoginAtomically() throws Exception {
        account("gestor");
        try (HttpClient manager = browser(); HttpClient resident = browser()) {
            login(manager, "gestor");
            String id = create(manager, "Residente Sintético", "2026100000012345");
            assertThat(jdbc.queryForObject("SELECT resident_id FROM sager_local_account WHERE enrollment='2026100000012345'", UUID.class)).isEqualTo(UUID.fromString(id));
            assertThat(jdbc.queryForObject("SELECT profile FROM sager_local_account WHERE enrollment='2026100000012345'", String.class)).isEqualTo("residente");
            assertThat(form(resident, "/api/v1/auth/login", Map.of("matricula","2026100000012345","password",PASSWORD)).statusCode()).isEqualTo(204);
            assertThat(json.readTree(get(resident,"/api/v1/auth/me").body()).path("matricula").asText()).isEqualTo("2026100000012345");
            assertThat(form(browser(), "/api/v1/auth/login", Map.of("email","2026100000012345","password",PASSWORD)).statusCode()).isEqualTo(401);
            assertThat(form(browser(), "/api/v1/auth/login", Map.of("matricula","2026100000012346","password",PASSWORD)).statusCode()).isEqualTo(401);
            String textualId=create(manager,"Matrícula Textual","20171-abcd.000123");
            assertThat(jdbc.queryForObject("SELECT enrollment FROM sager_local_account WHERE resident_id=?",String.class,UUID.fromString(textualId))).isEqualTo("20171ABCD000123");
        }
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void unrelatedUpdatePreservesAssignedLoginAndSession(boolean originalEnrollmentOccupied) throws Exception {
        account("gestor");
        try (HttpClient manager = browser(); HttpClient resident = browser()) {
            login(manager, "gestor");
            UUID id = UUID.fromString(create(manager, "Pessoa Sintética", "20261CADRES00001"));
            var linked = provisioning.list().stream().filter(a -> id.equals(a.residentId())).findFirst().orElseThrow();
            provisioning.assignEnrollment(linked.id(), "acesso-res-001");
            var assigned = provisioning.list().stream().filter(a -> a.id().equals(linked.id())).findFirst().orElseThrow();
            if (originalEnrollmentOccupied)
                provisioning.create("20261CADRES00001", null, "Outra Conta Sintética", "saude", PASSWORD.toCharArray());
            assertThat(form(resident, "/api/v1/auth/login", Map.of("matricula", assigned.enrollment(), "password", PASSWORD)).statusCode()).isEqualTo(204);

            HttpResponse<String> updated = put(manager, PATH + "/" + id,
                    body("Nome Editado", " 20261CADRES00001 ", BIRTH_DATE, null, 0), csrf(manager));
            assertThat(updated.statusCode()).isEqualTo(200);
            assertThat(json.readTree(updated.body()).path("name").asText()).isEqualTo("Nome Editado");
            assertThat(json.readTree(updated.body()).path("enrollment").asText()).isEqualTo("20261CADRES00001");
            assertThat(provisioning.list()).contains(assigned);
            assertThat(auditRows(id).getLast().fields()).containsExactly("name");
            HttpResponse<String> me = get(resident, "/api/v1/auth/me");
            assertThat(me.statusCode()).isEqualTo(200);
            assertThat(json.readTree(me.body()).path("matricula").asText()).isEqualTo(assigned.enrollment());
            assertThat(json.readTree(me.body()).path("residenteId").asText()).isEqualTo(id.toString());
        }
    }

    @Test
    void enrollmentChangeRollsBackCollisionAndOtherwisePreservesAccountAndRevokesSession() throws Exception {
        account("gestor");
        try (HttpClient manager = browser(); HttpClient resident = browser()) {
            login(manager, "gestor");
            UUID id = UUID.fromString(create(manager, "Pessoa Sintética", "20261CADRES00001"));
            var linked = provisioning.list().stream().filter(a -> id.equals(a.residentId())).findFirst().orElseThrow();
            provisioning.assignEnrollment(linked.id(), "acesso-res-001");
            var assigned = provisioning.list().stream().filter(a -> a.id().equals(linked.id())).findFirst().orElseThrow();
            provisioning.create("20261OCUPADA0001", null, "Outra Conta Sintética", "saude", PASSWORD.toCharArray());
            assertThat(form(resident, "/api/v1/auth/login", Map.of("matricula", assigned.enrollment(), "password", PASSWORD)).statusCode()).isEqualTo(204);
            String before = get(manager, PATH + "/" + id).body();
            int audits = auditRows(id).size();

            assertError(put(manager, PATH + "/" + id,
                    body("Não Persistir", "20261OCUPADA0001", BIRTH_DATE, null, 0), csrf(manager)),
                    409, "duplicate_enrollment");
            assertThat(get(manager, PATH + "/" + id).body()).isEqualTo(before);
            assertThat(provisioning.list()).contains(assigned);
            assertThat(auditRows(id)).hasSize(audits);
            assertThat(get(resident, "/api/v1/auth/me").statusCode()).isEqualTo(200);

            assertThat(put(manager, PATH + "/" + id,
                    body("Nome Editado", "20261NOVARES0001", BIRTH_DATE, null, 0), csrf(manager)).statusCode()).isEqualTo(200);
            var changed = provisioning.list().stream().filter(a -> a.id().equals(assigned.id())).findFirst().orElseThrow();
            assertThat(changed.enrollment()).isEqualTo("20261NOVARES0001");
            assertThat(changed).usingRecursiveComparison().ignoringFields("enrollment").isEqualTo(assigned);
            assertThat(auditRows(id).getLast().fields()).containsExactlyInAnyOrder("name", "enrollment");
            assertThat(get(resident, "/api/v1/auth/me").statusCode()).isEqualTo(401);
            assertThat(form(resident, "/api/v1/auth/login", Map.of("matricula", assigned.enrollment(), "password", PASSWORD)).statusCode()).isEqualTo(401);
            assertThat(form(resident, "/api/v1/auth/login", Map.of("matricula", changed.enrollment(), "password", PASSWORD)).statusCode()).isEqualTo(204);
            assertThat(get(resident, "/api/v1/auth/me").statusCode()).isEqualTo(200);
        }
    }

    @Test
    void rejectsPasswordMismatchAndAccountCollisionWithoutPartialResident() throws Exception {
        account("gestor");
        try (HttpClient client = browser()) {
            login(client,"gestor");
            provisioning.create("2026100000000123", null, "Outra Conta Sintética", "saude", PASSWORD.toCharArray());
            var input = new LinkedHashMap<String,Object>(Map.of("name","Pessoa Sintética","enrollment","2026100000000123","birthDate",BIRTH_DATE,"courseId",courseId("Curso Sintético"),"password",PASSWORD,"passwordConfirmation","diferente"));
            assertThat(post(client,PATH,json.writeValueAsString(input),csrf(client)).statusCode()).isEqualTo(400);
            input.put("passwordConfirmation", PASSWORD);
            assertThat(post(client,PATH,json.writeValueAsString(input),csrf(client)).statusCode()).isEqualTo(409);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM sager_resident",Integer.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM sager_local_account",Integer.class)).isEqualTo(2);
        }
    }

    @Test
    void recoversOnlyAfterMatchingRegisteredIdentityAndActiveGuardianAndRevokesSessions() throws Exception {
        account("gestor");
        try (HttpClient manager = browser(); HttpClient resident = browser(); HttpClient visitor = browser()) {
            login(manager,"gestor");
            UUID id=UUID.fromString(create(manager,"João Antônio da Silva","2026100000000042"));
            jdbc.update("INSERT INTO sager_guardian(id,resident_id,name,relationship,active) VALUES (?,?,?,?,true)",UUID.randomUUID(),id,"Maria Rita dos Santos","Mãe");
            assertThat(form(resident,"/api/v1/auth/login",Map.of("matricula","2026100000000042","password",PASSWORD)).statusCode()).isEqualTo(204);
            Map<String,String> input=new LinkedHashMap<>(Map.of("matricula","2026100000000042","name"," JOAO  ANTONIO DA SILVA ","birthDate",BIRTH_DATE,"guardianName","Maria errada","password","Nova senha teste 123!","passwordConfirmation","Nova senha teste 123!"));
            assertThat(form(visitor,"/api/v1/auth/recover",input).statusCode()).isEqualTo(400);
            input.put("guardianName"," MARIA RITA DOS SANTOS ");
            input.put("matricula","2026.1000.0000.0042");
            assertThat(form(visitor,"/api/v1/auth/recover",input).statusCode()).isEqualTo(204);
            assertThat(get(resident,"/api/v1/auth/me").statusCode()).isEqualTo(401);
            assertThat(get(visitor,"/api/v1/auth/me").statusCode()).isEqualTo(401);
            assertThat(form(visitor,"/api/v1/auth/login",Map.of("matricula","2026100000000042","password",PASSWORD)).statusCode()).isEqualTo(401);
            assertThat(form(visitor,"/api/v1/auth/login",Map.of("matricula","2026100000000042","password","Nova senha teste 123!")).statusCode()).isEqualTo(204);
        }
    }

    @Test
    void creatingResidentAppliesPasswordRulesWithoutLeavingPartialRecords() throws Exception {
        account("gestor");
        try (HttpClient manager = browser(); HttpClient resident = browser()) {
            login(manager,"gestor");
            var input=new LinkedHashMap<String,Object>(Map.of("name","Pessoa Sintética","enrollment","2026100000000777","birthDate",BIRTH_DATE,"courseId",courseId("Curso Sintético")));
            for (String refused : List.of("gato az", "12345678", "2026100000000777", "x".repeat(73))) {
                input.put("password",refused); input.put("passwordConfirmation",refused);
                assertThat(post(manager,PATH,json.writeValueAsString(input),csrf(manager)).statusCode()).as(refused).isEqualTo(400);
            }
            assertThat(jdbc.queryForObject("SELECT count(*) FROM sager_resident",Integer.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM sager_local_account",Integer.class)).isEqualTo(1);
            input.put("password","gato azul"); input.put("passwordConfirmation","gato azul");
            assertThat(post(manager,PATH,json.writeValueAsString(input),csrf(manager)).statusCode()).isEqualTo(201);
            assertThat(form(resident,"/api/v1/auth/login",Map.of("matricula","2026100000000777","password","gato azul")).statusCode()).isEqualTo(204);
        }
    }

    @Test
    void recoveryRefusesBadPasswordsIdenticallyWhetherOrNotTheAccountExists() throws Exception {
        account("gestor");
        try (HttpClient manager = browser(); HttpClient visitor = browser()) {
            login(manager,"gestor"); create(manager,"Pessoa Com Conta","2026100000555555");
            String sql="SELECT password_hash FROM sager_local_account WHERE enrollment='2026100000555555'";
            String hash=jdbc.queryForObject(sql,String.class);
            for (String refused : List.of("curta","12345678","2026100000555555","x".repeat(73))) {
                var existing=form(visitor,"/api/v1/auth/recover",recovery("2026100000555555",refused));
                var missing=form(visitor,"/api/v1/auth/recover",recovery("99999999",refused));
                assertThat(existing.statusCode()).as(refused).isEqualTo(400);
                assertThat(missing.statusCode()).as(refused).isEqualTo(400);
                assertThat(json.readTree(existing.body()).path("code")).isEqualTo(json.readTree(missing.body()).path("code"));
                assertThat(json.readTree(existing.body()).path("message")).isEqualTo(json.readTree(missing.body()).path("message"));
            }
            assertThat(jdbc.queryForObject(sql,String.class)).isEqualTo(hash);
            assertThat(form(visitor,"/api/v1/auth/recover",recovery("2026100000555555","gato azul")).statusCode()).isEqualTo(204);
            assertThat(jdbc.queryForObject(sql,String.class)).isNotEqualTo(hash);
        }
    }

    private Map<String,String> recovery(String enrollment,String password) {
        return Map.of("matricula",enrollment,"name","Pessoa Com Conta","birthDate",BIRTH_DATE,"password",password,"passwordConfirmation",password);
    }

    @Test
    void recoveryWithoutGuardianDoesNotCreateNewRegistrationRequirementsAndIsThrottled() throws Exception {
        account("gestor");
        try (HttpClient manager = browser(); HttpClient visitor=browser()) {
            login(manager,"gestor"); create(manager,"Pessoa Sem Responsável","2026100000000099");
            Map<String,String> input=new LinkedHashMap<>(Map.of("matricula","2026100000000099","name","Pessoa Sem Responsavel","birthDate",BIRTH_DATE,"password",PASSWORD,"passwordConfirmation",PASSWORD));
            assertThat(form(visitor,"/api/v1/auth/recover",input).statusCode()).isEqualTo(204);
            input.put("matricula","gestor"); input.put("name","Pessoa Sintética");
            for (int i=0;i<5;i++) assertThat(form(visitor,"/api/v1/auth/recover",input).statusCode()).isEqualTo(400);
            var limited=form(visitor,"/api/v1/auth/recover",input);
            assertThat(limited.statusCode()).isEqualTo(429);
            assertThat(limited.headers().firstValue("Retry-After")).contains("900");
            assertThat(limited.body()).doesNotContain("Pessoa Sintética", "gestor");
        }
    }

    @Test
    void managesCatalogAndKeepsInactiveCourseOnExistingResident() throws Exception {
        account("gestor");
        try(HttpClient manager=browser()) {
            login(manager,"gestor");
            var response=post(manager,"/api/v1/cursos",json.writeValueAsString(Map.of("name","Curso   Sintético")),csrf(manager));
            assertThat(response.statusCode()).isEqualTo(201);
            String course=json.readTree(response.body()).path("id").asText();
            assertThat(post(manager,"/api/v1/cursos",json.writeValueAsString(Map.of("name"," curso sintético ")),csrf(manager)).statusCode()).isEqualTo(409);
            var input=new LinkedHashMap<String,Object>(Map.of("name","Pessoa Sintética","enrollment","2026100000000003","birthDate",BIRTH_DATE,"courseId",course,"institutionalEmail","Pessoa@estudante.ifgoiano.edu.br","password",PASSWORD,"passwordConfirmation",PASSWORD));
            var created=post(manager,PATH,json.writeValueAsString(input),csrf(manager));
            assertThat(created.statusCode()).isEqualTo(201);
            String resident=json.readTree(created.body()).path("id").asText();
            assertThat(json.readTree(created.body()).path("institutionalEmail").asText()).isEqualTo("pessoa@estudante.ifgoiano.edu.br");
            assertThat(put(manager,"/api/v1/cursos/"+course,json.writeValueAsString(Map.of("name","Curso Sintético","active",false,"version",0)),csrf(manager)).statusCode()).isEqualTo(200);
            input.put("version",0);input.remove("password");input.remove("passwordConfirmation");input.put("name","Pessoa Atualizada");
            assertThat(put(manager,PATH+"/"+resident,json.writeValueAsString(input),csrf(manager)).statusCode()).isEqualTo(200);
            input.remove("version"); input.put("enrollment","2026100000000004");input.put("password",PASSWORD);input.put("passwordConfirmation",PASSWORD);
            assertThat(post(manager,PATH,json.writeValueAsString(input),csrf(manager)).statusCode()).isEqualTo(400);
            assertThat(put(manager,"/api/v1/cursos/"+course,json.writeValueAsString(Map.of("name","Curso Sintético","active",true,"version",0)),csrf(manager)).statusCode()).isEqualTo(409);
        }
    }

    @Test
    void courseLevelAndDurationAreOptionalStrictAndAudited() throws Exception {
        account("supervisor");
        try (HttpClient client = browser()) {
            login(client, "supervisor");
            JsonNode legacy = json.readTree(post(client, "/api/v1/cursos",
                    json.writeValueAsString(Map.of("name", "Curso Sem Nível")), csrf(client)).body());
            assertThat(legacy.path("level").isNull()).isTrue();
            assertThat(legacy.path("durationYears").isNull()).isTrue();
            var created = post(client, "/api/v1/cursos", json.writeValueAsString(Map.of("name", "Sistemas Sintéticos",
                    "level", "SUPERIOR", "durationYears", 4)), csrf(client));
            assertThat(created.statusCode()).isEqualTo(201);
            UUID id = UUID.fromString(json.readTree(created.body()).path("id").asText());
            assertThat(json.readTree(created.body()).path("level").asText()).isEqualTo("SUPERIOR");
            assertThat(auditRows(id).getFirst().fields()).containsExactlyInAnyOrder("name", "active", "level", "durationYears");
            for (Map<String, Object> invalid : List.<Map<String, Object>>of(Map.of("level", "TECNICO"), Map.of("level", 1),
                    Map.of("durationYears", 0), Map.of("durationYears", 7), Map.of("durationYears", "3"),
                    Map.of("durationYears", 3.5))) {
                var input = new LinkedHashMap<String, Object>(Map.of("name", "Curso Inválido", "active", true, "version", 0));
                input.putAll(invalid);
                assertThat(post(client, "/api/v1/cursos", json.writeValueAsString(input), csrf(client)).statusCode())
                        .as(invalid.toString()).isEqualTo(400);
                assertThat(put(client, "/api/v1/cursos/" + id, json.writeValueAsString(input), csrf(client)).statusCode())
                        .as(invalid.toString()).isEqualTo(400);
            }
            var changed = put(client, "/api/v1/cursos/" + id, json.writeValueAsString(Map.of("name", "Sistemas Sintéticos",
                    "active", true, "version", 0, "level", "MEDIO", "durationYears", 4)), csrf(client));
            assertThat(changed.statusCode()).isEqualTo(200);
            assertThat(auditRows(id).getLast().fields()).containsExactly("level");
            assertThat(put(client, "/api/v1/cursos/" + id, json.writeValueAsString(Map.of("name", "Sistemas Sintéticos",
                    "active", true, "version", 1)), csrf(client)).statusCode()).isEqualTo(200);
            assertThat(auditRows(id).getLast().fields()).containsExactlyInAnyOrder("level", "durationYears");
            assertThat(jdbc.queryForObject("SELECT level IS NULL AND duration_years IS NULL FROM sager_course WHERE id = ?",
                    Boolean.class, id)).isTrue();
        }
    }

    @Test
    void entryYearAndExtensionAreValidatedOnlyWhenChangedAndAudited() throws Exception {
        account("supervisor");
        int nextYear = LocalDate.now(java.time.ZoneId.of("America/Sao_Paulo")).getYear() + 1;
        try (HttpClient client = browser()) {
            login(client, "supervisor");
            for (Object[] invalid : new Object[][] { { 1989, 0 }, { nextYear + 1, 0 }, { "2026", 0 }, { 2026.5, 0 },
                    { 2026, 11 }, { 2026, -1 }, { 2026, "1" }, { 2026, true } }) {
                assertError(post(client, PATH, progress(body("Pessoa Sintética", "20261PROG000001", BIRTH_DATE, null, null),
                        invalid[0], invalid[1]), csrf(client)), 400, "invalid_input");
            }
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_resident", Integer.class)).isZero();

            HttpResponse<String> created = post(client, PATH, progress(body("Pessoa Sintética", "20261PROG000001",
                    BIRTH_DATE, null, null), nextYear, 2), csrf(client));
            assertThat(created.statusCode()).isEqualTo(201);
            JsonNode value = json.readTree(created.body());
            UUID id = UUID.fromString(value.path("id").asText());
            assertThat(value.path("entryYear").asInt()).isEqualTo(nextYear);
            assertThat(value.path("extraSemesters").asInt()).isEqualTo(2);

            String unchanged = body("Pessoa Sintética", "20261PROG000001", BIRTH_DATE, null, 0);
            assertThat(put(client, PATH + "/" + id, progress(unchanged, 2024, 3), csrf(client)).statusCode()).isEqualTo(200);
            assertThat(auditRows(id).getLast().fields()).containsExactlyInAnyOrder("entryYear", "extraSemesters");
            JsonNode read = json.readTree(get(client, PATH + "/" + id).body());
            assertThat(read.path("entryYear").asInt()).isEqualTo(2024);
            assertThat(read.path("extraSemesters").asInt()).isEqualTo(3);

            jdbc.update("UPDATE sager_resident SET entry_year = 2100 WHERE id = ?", id);
            String legacy = body("Pessoa Sintética", "20261PROG000001", BIRTH_DATE, null, 1);
            assertThat(put(client, PATH + "/" + id, progress(legacy, 2100, 3), csrf(client)).statusCode()).isEqualTo(200);
            assertThat(auditRows(id).getLast().fields()).isEmpty();
            assertError(put(client, PATH + "/" + id, progress(body("Pessoa Sintética", "20261PROG000001", BIRTH_DATE, null, 2),
                    2099, 3), csrf(client)), 400, "invalid_input");

            HttpResponse<String> cleared = put(client, PATH + "/" + id, legacy.replace("\"version\":1", "\"version\":2"),
                    csrf(client));
            assertThat(cleared.statusCode()).isEqualTo(200);
            assertThat(json.readTree(cleared.body()).path("entryYear").isNull()).isTrue();
            assertThat(json.readTree(cleared.body()).path("extraSemesters").asInt()).isZero();
            assertThat(auditRows(id).getLast().fields()).containsExactlyInAnyOrder("entryYear", "extraSemesters");

            UUID old = UUID.randomUUID();
            jdbc.update("INSERT INTO sager_resident(id,name,enrollment,birth_date) VALUES (?,?,?,?::date)", old,
                    "Pessoa Antiga", "20251PROG000002", BIRTH_DATE);
            JsonNode legacyRead = json.readTree(get(client, PATH + "/" + old).body());
            assertThat(legacyRead.path("entryYear").isNull()).isTrue();
            assertThat(legacyRead.path("extraSemesters").asInt()).isZero();
        }
    }

    private String progress(String body, Object entryYear, Object extraSemesters) {
        var fields = (tools.jackson.databind.node.ObjectNode) json.readTree(body);
        fields.set("entryYear", json.valueToTree(entryYear));
        fields.set("extraSemesters", json.valueToTree(extraSemesters));
        return json.writeValueAsString(fields);
    }

    @Test
    void searchesWithoutAccentsAndPaginatesBeforeReturningTheArray() throws Exception {
        account("gestor");
        for(int i=0;i<30;i++) jdbc.update("INSERT INTO sager_resident(id,name,enrollment,birth_date) VALUES (?,?,?,?::date)",UUID.randomUUID(),"João Teste "+i,"00"+i,BIRTH_DATE);
        try(HttpClient client=browser()) {
            login(client,"gestor");
            var first=get(client,PATH+"?search=joao&allocated=false&limit=25&offset=0");
            assertThat(first.statusCode()).isEqualTo(200);assertThat(first.headers().firstValue("X-Total-Count")).contains("30");
            var second=get(client,PATH+"?search=joao&allocated=false&limit=25&offset=25");
            assertThat(json.readTree(first.body()).size()).isEqualTo(25);assertThat(json.readTree(second.body()).size()).isEqualTo(5);
            assertThat(get(client,PATH+"?limit=0").statusCode()).isEqualTo(400);
            assertThat(get(client,PATH+"?search=joao&allocated=true&limit=25").headers().firstValue("X-Total-Count")).contains("0");
        }
    }

    @Test
    void filtersByUnitBeforeCountingAndPaginatingOnlyCurrentAllocations() throws Exception {
        account("gestor");
        UUID accommodation=UUID.randomUUID(),unit=UUID.randomUUID(),otherUnit=UUID.randomUUID(),room=UUID.randomUUID(),otherRoom=UUID.randomUUID();
        jdbc.update("INSERT INTO sager_accommodation(id,code,name) VALUES (?,'ALO','Alojamento Sintético')",accommodation);
        jdbc.update("INSERT INTO sager_accommodation_unit(id,accommodation_id,code,name) VALUES (?,?,'BL-A','Bloco A'),(?,?,'BL-B','Bloco B')",unit,accommodation,otherUnit,accommodation);
        jdbc.update("INSERT INTO sager_room(id,code,number,accommodation_id,unit_id,capacity,situation) VALUES (?,'A-1','1',?,?,40,'Disponível'),(?,'B-1','1',?,?,40,'Disponível')",room,accommodation,unit,otherRoom,accommodation,otherUnit);
        for(int i=0;i<27;i++) allocated("Bloco A "+i,"A"+i,room);
        UUID moved=allocated("Mudou de bloco","MUDOU",room);
        jdbc.update("UPDATE sager_room_allocation SET ended_at=CURRENT_TIMESTAMP,end_reason='END' WHERE resident_id=?",moved);
        jdbc.update("INSERT INTO sager_room_allocation(id,resident_id,room_id,started_at) VALUES (?,?,?,CURRENT_TIMESTAMP)",UUID.randomUUID(),moved,otherRoom);
        try(HttpClient client=browser()) {
            login(client,"gestor");
            var first=get(client,PATH+"?unitId="+unit+"&limit=25&offset=0");
            assertThat(first.headers().firstValue("X-Total-Count")).contains("27");
            assertThat(json.readTree(first.body()).size()).isEqualTo(25);
            assertThat(json.readTree(get(client,PATH+"?unitId="+unit+"&limit=25&offset=25").body()).size()).isEqualTo(2);
            var other=get(client,PATH+"?unitId="+otherUnit+"&limit=25");
            assertThat(other.headers().firstValue("X-Total-Count")).contains("1");
            assertThat(json.readTree(other.body()).get(0).path("id").asText()).isEqualTo(moved.toString());
            assertThat(get(client,PATH+"?unitId=invalido").statusCode()).isEqualTo(400);
        }
    }

    private UUID allocated(String name,String enrollment,UUID room) {
        UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident(id,name,enrollment,birth_date) VALUES (?,?,?,?::date)",id,name,enrollment,BIRTH_DATE);
        jdbc.update("INSERT INTO sager_room_allocation(id,resident_id,room_id,started_at) VALUES (?,?,?,CURRENT_TIMESTAMP - INTERVAL '1 day')",UUID.randomUUID(),id,room);
        return id;
    }

    private HttpResponse<String> form(HttpClient client,String path,Map<String,String> input) throws Exception {
        String body=input.entrySet().stream().map(e->URLEncoder.encode(e.getKey(),StandardCharsets.UTF_8)+"="+URLEncoder.encode(e.getValue(),StandardCharsets.UTF_8)).collect(java.util.stream.Collectors.joining("&"));
        return send(client,HttpRequest.newBuilder(uri(path)).header("Content-Type","application/x-www-form-urlencoded").header("X-CSRF-TOKEN",csrf(client)).POST(HttpRequest.BodyPublishers.ofString(body)).build());
    }

    private void account(String profile) {
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment(profile + "@example.invalid"), profile + "@example.invalid", "Pessoa Sintética", profile,
                PASSWORD.toCharArray());
    }

    private int parallelUpdate(HttpClient client, UUID id, String body, String token) {
        try {
            return put(client, PATH + "/" + id, body, token).statusCode();
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }

    private List<AuditRow> auditRows(UUID id) {
        return jdbc.query("""
                SELECT resource, action, resulting_version, changed_fields, actor_id, actor_profile, request_id
                FROM sager_audit_event WHERE resource_id = ? ORDER BY sequence
                """, (result, row) -> new AuditRow(result.getString("resource"), result.getString("action"),
                result.getLong("resulting_version"), List.of((String[]) result.getArray("changed_fields").getArray()),
                result.getObject("actor_id", UUID.class), result.getString("actor_profile"),
                result.getObject("request_id", UUID.class)), id);
    }

    private record AuditRow(String resource, String action, long version, List<String> fields,
            UUID actorId, String profile, UUID requestId) {
    }

    @Test
    void createAndUpdateFormatResidentNameWhateverTheTypedCase() throws Exception {
        account("gestor");
        try (HttpClient manager = browser()) {
            login(manager, "gestor");
            UUID id = UUID.fromString(create(manager, "JOÃO silva", "20261NOMERES0001"));
            assertThat(json.readTree(get(manager, PATH + "/" + id).body()).path("name").asText())
                    .isEqualTo("João Silva");
            assertThat(provisioning.list().stream().filter(a -> id.equals(a.residentId())).findFirst()
                    .orElseThrow().name()).isEqualTo("João Silva");

            HttpResponse<String> updated = put(manager, PATH + "/" + id,
                    body("josé DA silva", "20261NOMERES0001", BIRTH_DATE, null, 0), csrf(manager));
            assertThat(updated.statusCode()).isEqualTo(200);
            assertThat(json.readTree(updated.body()).path("name").asText()).isEqualTo("José Da Silva");
        }
    }

    private String create(HttpClient client, String name, String enrollment) throws Exception {
        HttpResponse<String> response = post(client, PATH, body(name, enrollment, BIRTH_DATE, null, null),
                csrf(client));
        assertThat(response.statusCode()).isEqualTo(201);
        return json.readTree(response.body()).path("id").asText();
    }

    /** Null course means the default one; a blank course sends no courseId at all. */
    private String body(Object name, Object enrollment, Object birthDate, Object course,
            Object version) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("name", name);
        fields.put("enrollment", enrollment);
        fields.put("birthDate", birthDate);
        Object chosen = course == null ? "Curso Sintético" : course;
        Object courseId = chosen;
        if (chosen instanceof String courseName && courseName.strip().length() <= 200)
            courseId = courseName.isBlank() ? null : courseId(courseName.strip());
        fields.put("courseId", courseId);
        if (version == null) {
            fields.put("password", PASSWORD);
            fields.put("passwordConfirmation", PASSWORD);
        }
        if (version != null) {
            fields.put("version", version);
        }
        return json.writeValueAsString(fields);
    }

    private UUID courseId(String name) {
        var ids = jdbc.query("SELECT id FROM sager_course WHERE normalized_name=lower(?)", (r,n) -> r.getObject(1,UUID.class), name);
        UUID id = ids.isEmpty() ? UUID.randomUUID() : ids.getFirst();
        if (ids.isEmpty()) jdbc.update("INSERT INTO sager_course(id,name) VALUES (?,?)", id, name);
        return id;
    }

    private void login(HttpClient client, String profile) throws Exception {
        String form = "matricula=" + URLEncoder.encode(br.edu.ifgoiano.sager.TestIdentity.enrollment(profile + "@example.invalid"), StandardCharsets.UTF_8)
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
