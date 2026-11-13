package br.edu.ifgoiano.sager.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.ExitCodeGenerator;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
@ExtendWith(OutputCaptureExtension.class)
class LocalAccountLinksIntegrationTest {
    private static final String PASSWORD = "Senha sintetica 123!";
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
    private LocalAccountProvisioningRunner commands;

    @Autowired
    private LocalAccountRepository accounts;

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
        jdbc.update("DELETE FROM sager_resident");
        jdbc.update("DELETE FROM sager_supervisor");
    }

    @Test
    void exposesNullLinksForAnUnlinkedAccount() throws Exception {
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("unlinked@example.invalid"), "unlinked@example.invalid", "Conta Sintética", "residente", PASSWORD.toCharArray());
        try (HttpClient client = browser()) {
            login(client, "unlinked@example.invalid");
            JsonNode me = me(client);
            assertThat(me.has("residenteId")).isTrue();
            assertThat(me.path("residenteId").isNull()).isTrue();
            assertThat(me.has("supervisorId")).isTrue();
            assertThat(me.path("supervisorId").isNull()).isTrue();
            assertThat(me.has("passwordHash")).isFalse();
            assertThat(me.has("password_hash")).isFalse();
        }
    }

    @Test
    void linksOnlyTheExplicitResidentAndKeepsTheCredentialAndAssignedRole() throws Exception {
        UUID first = resident("DEMO-A");
        UUID second = resident("DEMO-B");
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("account-a@example.invalid"), "account-a@example.invalid", "Nome Sem Relação", "residente", PASSWORD.toCharArray());
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("account-b@example.invalid"), "account-b@example.invalid", "Estudante Sintético", "residente", PASSWORD.toCharArray());
        String hash = accounts.findByEmail("account-a@example.invalid").orElseThrow().passwordHash();

        command("link-resident", "  ACCOUNT-A@example.invalid  ", "--resident-id=" + first);
        command("link-resident", "account-b@example.invalid", "--resident-id=" + second);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_local_account", Integer.class)).isEqualTo(2);
        assertThat(accounts.findByEmail("account-a@example.invalid").orElseThrow().passwordHash()).isEqualTo(hash);
        try (HttpClient client = browser()) {
            login(client, "account-a@example.invalid");
            JsonNode me = me(client);
            assertThat(me.path("residenteId").asText()).isEqualTo(first.toString());
            assertThat(me.path("supervisorId").isNull()).isTrue();
            assertThat(me.path("perfis").size()).isEqualTo(1);
            assertThat(me.path("perfis").get(0).asText()).isEqualTo("residente");
            assertThat(get(client, "/api/v1/residentes").statusCode()).isEqualTo(403);
            assertThat(get(client, "/api/v1/supervisores").statusCode()).isEqualTo(403);
        }
    }

    @Test
    void reportsAdulthoodOnlyForALinkedResidentWithABirthDateOfEighteenOrMore() throws Exception {
        UUID record = resident("DEMO-ADULT");
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("adult@example.invalid"), "adult@example.invalid", "Estudante Sintético", "residente", PASSWORD.toCharArray());
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("loose@example.invalid"), "loose@example.invalid", "Conta Sintética", "residente", PASSWORD.toCharArray());
        command("link-resident", "adult@example.invalid", "--resident-id=" + record);
        try (HttpClient client = browser(); HttpClient loose = browser()) {
            login(client, "adult@example.invalid");
            assertThat(me(client).path("maiorDeIdade").asBoolean()).isTrue();
            jdbc.update("UPDATE sager_resident SET birth_date = ? WHERE id = ?",
                    LocalDate.now(java.time.ZoneId.of("America/Sao_Paulo")).minusYears(15), record);
            assertThat(me(client).path("maiorDeIdade").isBoolean()).isTrue();
            assertThat(me(client).path("maiorDeIdade").asBoolean()).isFalse();
            jdbc.execute("ALTER TABLE sager_resident DISABLE TRIGGER ALL");
            jdbc.execute("ALTER TABLE sager_resident DROP CONSTRAINT sager_resident_birth_date_required");
            try {
                jdbc.update("UPDATE sager_resident SET birth_date = NULL WHERE id = ?", record);
            } finally {
                jdbc.execute("ALTER TABLE sager_resident ADD CONSTRAINT sager_resident_birth_date_required"
                        + " CHECK (birth_date IS NOT NULL) NOT VALID");
                jdbc.execute("ALTER TABLE sager_resident ENABLE TRIGGER ALL");
            }
            assertThat(me(client).path("maiorDeIdade").isBoolean()).isTrue();
            assertThat(me(client).path("maiorDeIdade").asBoolean()).isFalse();
            login(loose, "loose@example.invalid");
            assertThat(me(loose).path("maiorDeIdade").isBoolean()).isTrue();
            assertThat(me(loose).path("maiorDeIdade").asBoolean()).isFalse();
        }
    }

    @Test
    void permitsSupervisorRecordsForBothSupervisorAndGestorAccounts() throws Exception {
        for (String profile : new String[] { "supervisor", "gestor" }) {
            UUID record = supervisor("DEMO-" + profile);
            String email = profile + "@example.invalid";
            provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment(email), email, "Conta Sintética", profile, PASSWORD.toCharArray());
            command("link-supervisor", email, "--supervisor-id=" + record);
            try (HttpClient client = browser()) {
                login(client, email);
                JsonNode me = me(client);
                assertThat(me.path("supervisorId").asText()).isEqualTo(record.toString());
                assertThat(me.path("residenteId").isNull()).isTrue();
                assertThat(me.path("perfis").size()).isEqualTo(1);
                assertThat(me.path("perfis").get(0).asText()).isEqualTo(profile);
                assertThat(me.path("maiorDeIdade").isBoolean()).isTrue();
                assertThat(me.path("maiorDeIdade").asBoolean()).isFalse();
            }
        }
    }

    @Test
    void rejectsMissingInactiveIncompatibleAndDuplicateLinksWithoutPartialChanges(CapturedOutput output) {
        UUID record = resident("DEMO-A");
        UUID staff = supervisor("DEMO-S");
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("resident-a@example.invalid"), "resident-a@example.invalid", "Conta Sintética", "residente", PASSWORD.toCharArray());
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("resident-b@example.invalid"), "resident-b@example.invalid", "Conta Sintética", "residente", PASSWORD.toCharArray());
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("gestor@example.invalid"), "gestor@example.invalid", "Conta Sintética", "gestor", PASSWORD.toCharArray());
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("inactive@example.invalid"), "inactive@example.invalid", "Conta Sintética", "residente", PASSWORD.toCharArray());
        provisioning.disable("inactive@example.invalid");

        rejected("link-resident", "missing@example.invalid", "--resident-id=" + record);
        rejected("link-resident", "inactive@example.invalid", "--resident-id=" + record);
        rejected("link-resident", "gestor@example.invalid", "--resident-id=" + record);
        rejected("link-supervisor", "resident-b@example.invalid", "--supervisor-id=" + staff);
        rejected("link-resident", "resident-b@example.invalid", "--resident-id=" + UUID.randomUUID());
        rejected("link-resident", "resident-b@example.invalid", "--resident-id=invalid");
        rejected("link-resident", "resident-b@example.invalid", "--resident-id=1-1-1-1-1");
        command("link-resident", "resident-a@example.invalid", "--resident-id=" + record);
        rejected("link-resident", "resident-b@example.invalid", "--resident-id=" + record);
        rejected("unlink", "resident-a@example.invalid", "--record-id=" + UUID.randomUUID());

        assertThat(jdbc.queryForObject("SELECT resident_id FROM sager_local_account WHERE email = ?",
                UUID.class, "resident-a@example.invalid")).isEqualTo(record);
        assertThat(jdbc.queryForObject("SELECT resident_id FROM sager_local_account WHERE email = ?",
                UUID.class, "resident-b@example.invalid")).isNull();
        assertThat(output.getErr()).contains("Conta ativa nao encontrada", "Perfil", "Residente",
                "UUID", "vincul", "Vinculo").doesNotContain("Exception", "\tat ", "password_hash");
    }

    @Test
    void changingOrRemovingTheLinkRevokesAllExistingSessions() throws Exception {
        UUID first = resident("DEMO-A");
        UUID second = resident("DEMO-B");
        String email = "resident@example.invalid";
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment(email), email, "Conta Sintética", "residente", PASSWORD.toCharArray());
        try (HttpClient client = browser(); HttpClient other = browser()) {
            login(client, email);
            login(other, email);
            command("link-resident", email, "--resident-id=" + first);
            assertThat(get(client, "/api/v1/auth/me").statusCode()).isEqualTo(401);
            assertThat(get(other, "/api/v1/auth/me").statusCode()).isEqualTo(401);
            login(client, email);
            command("link-resident", email, "--resident-id=" + second);
            assertThat(get(client, "/api/v1/auth/me").statusCode()).isEqualTo(401);
            login(client, email);
            assertThat(me(client).path("residenteId").asText()).isEqualTo(second.toString());
            command("unlink", email, "--record-id=" + second);
            assertThat(get(client, "/api/v1/auth/me").statusCode()).isEqualTo(401);
            login(client, email);
            assertThat(me(client).path("residenteId").isNull()).isTrue();
        }
    }

    @Test
    void unlinksAnInactiveAccountWithoutReactivatingItSoTheRecordCanBeAssignedAgain() throws Exception {
        UUID record = resident("DEMO-REASSIGN");
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("disabled@example.invalid"), "disabled@example.invalid", "Conta Sintética", "residente", PASSWORD.toCharArray());
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("replacement@example.invalid"), "replacement@example.invalid", "Conta Sintética", "residente", PASSWORD.toCharArray());
        command("link-resident", "disabled@example.invalid", "--resident-id=" + record);
        try (HttpClient client = browser()) {
            login(client, "disabled@example.invalid");
            provisioning.disable("disabled@example.invalid");
            command("unlink", "disabled@example.invalid", "--record-id=" + record);
            assertThat(get(client, "/api/v1/auth/me").statusCode()).isEqualTo(401);
        }
        assertThat(accounts.findByEmail("disabled@example.invalid").orElseThrow().active()).isFalse();
        assertThat(jdbc.queryForObject("SELECT resident_id FROM sager_local_account WHERE email = ?",
                UUID.class, "disabled@example.invalid")).isNull();
        command("link-resident", "replacement@example.invalid", "--resident-id=" + record);
        try (HttpClient client = browser()) {
            login(client, "replacement@example.invalid");
            assertThat(me(client).path("residenteId").asText()).isEqualTo(record.toString());
        }
    }

    @Test
    void verifiesTheCurrentLinkOnEveryRequestEvenAfterADirectDatabaseChange() throws Exception {
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'sager_local_account'
                    AND column_name IN ('resident_id', 'supervisor_id')
                """, Integer.class)).isEqualTo(2);
        UUID record = resident("DEMO-A");
        String email = "resident@example.invalid";
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment(email), email, "Conta Sintética", "residente", PASSWORD.toCharArray());
        try (HttpClient client = browser()) {
            login(client, email);
            jdbc.update("UPDATE sager_local_account SET resident_id = ? WHERE email = ?", record, email);
            assertThat(get(client, "/api/v1/auth/me").statusCode()).isEqualTo(401);
            login(client, email);
            assertThat(me(client).path("residenteId").asText()).isEqualTo(record.toString());
        }
    }

    @Test
    void allowsOnlyOneOfTwoConcurrentAccountsToLinkTheSameRecord() throws Exception {
        UUID record = resident("DEMO-CONCURRENT");
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("first@example.invalid"), "first@example.invalid", "Conta Sintética", "residente", PASSWORD.toCharArray());
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("second@example.invalid"), "second@example.invalid", "Conta Sintética", "residente", PASSWORD.toCharArray());
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> concurrentLink("first@example.invalid", record, ready, start));
            var second = executor.submit(() -> concurrentLink("second@example.invalid", record, ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThatCode(() -> assertThat(new int[] { first.get(10, TimeUnit.SECONDS),
                    second.get(10, TimeUnit.SECONDS) }).containsExactlyInAnyOrder(0, 2))
                    .doesNotThrowAnyException();
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_local_account WHERE resident_id = ?",
                Integer.class, record)).isEqualTo(1);
    }

    @Test
    void operatorCommandsRecordAccountEventsWithoutActorOrValues() {
        UUID record = resident("DEMO-AUDIT");
        String email = "audited@example.invalid";
        // O comando create lê a senha do console, nulo no Surefire: o serviço é chamado sem requisição HTTP.
        provisioning.create(br.edu.ifgoiano.sager.TestIdentity.enrollment(email), email, "Conta Sintética",
                "residente", PASSWORD.toCharArray());
        UUID account = accounts.findByEmail(email).orElseThrow().id();
        command("link-resident", email, "--resident-id=" + record);
        command("link-resident", email, "--resident-id=" + record);
        String allAccountEvents = "SELECT COUNT(*) FROM sager_audit_event WHERE resource = 'LOCAL_ACCOUNT'";
        int beforeList = jdbc.queryForObject(allAccountEvents, Integer.class);
        assertThatCode(() -> commands.run(new DefaultApplicationArguments("--sager-account=list")))
                .doesNotThrowAnyException();
        assertThat(jdbc.queryForObject(allAccountEvents, Integer.class)).isEqualTo(beforeList);
        assertThatCode(() -> commands.run(new DefaultApplicationArguments("--sager-account=disable",
                "--email=" + email))).doesNotThrowAnyException();
        assertThat(((ExitCodeGenerator) commands).getExitCode()).isZero();

        assertThat(jdbc.queryForList("""
                SELECT action || ' ' || origin || ' ' || changed_fields::text FROM sager_audit_event
                WHERE resource = 'LOCAL_ACCOUNT' AND resource_id = ? AND actor_id IS NULL
                    AND actor_profile IS NULL AND resulting_version = 0
                ORDER BY sequence
                """, String.class, account)).containsExactly(
                        "CREATE OPERATOR_CLI {email,enrollment,name,password,profile}",
                        "UPDATE OPERATOR_CLI {residentId}",
                        "END OPERATOR_CLI {active}");
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(DISTINCT request_id) FROM sager_audit_event WHERE resource_id = ?
                """, Integer.class, account)).isEqualTo(3);
    }

    private int concurrentLink(String email, UUID record, CountDownLatch ready, CountDownLatch start)
            throws InterruptedException {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("local");
        LocalAccountProvisioningRunner runner = new LocalAccountProvisioningRunner(provisioning, environment);
        ready.countDown();
        assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
        runner.run(new DefaultApplicationArguments("--sager-account=link-resident", "--email=" + email,
                "--resident-id=" + record));
        return ((ExitCodeGenerator) runner).getExitCode();
    }

    private void command(String action, String email, String recordOption) {
        assertThatCode(() -> commands.run(new DefaultApplicationArguments("--sager-account=" + action,
                "--email=" + email, recordOption))).doesNotThrowAnyException();
        assertThat(commands).isInstanceOf(ExitCodeGenerator.class);
        assertThat(((ExitCodeGenerator) commands).getExitCode()).isZero();
    }

    private void rejected(String action, String email, String recordOption) {
        assertThatCode(() -> commands.run(new DefaultApplicationArguments("--sager-account=" + action,
                "--email=" + email, recordOption))).doesNotThrowAnyException();
        assertThat(commands).isInstanceOf(ExitCodeGenerator.class);
        assertThat(((ExitCodeGenerator) commands).getExitCode()).isEqualTo(2);
    }

    private UUID resident(String enrollment) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident (id, name, enrollment, birth_date)"
                + " VALUES (?, 'Estudante Sintético', ?, ?)", id, enrollment, LocalDate.of(2006, 1, 2));
        return id;
    }

    private UUID supervisor(String institutionalId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sager_supervisor (id, name, institutional_id, email)
                VALUES (?, 'Supervisor Sintético', ?, 'registro@example.invalid')
                """, id, institutionalId);
        return id;
    }

    private HttpClient browser() {
        return HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
                .followRedirects(HttpClient.Redirect.NEVER).build();
    }

    private void login(HttpClient client, String email) throws Exception {
        JsonNode csrf = json.readTree(get(client, "/api/v1/auth/csrf").body());
        String form = "matricula=" + URLEncoder.encode(br.edu.ifgoiano.sager.TestIdentity.enrollment(email), StandardCharsets.UTF_8)
                + "&password=" + URLEncoder.encode(PASSWORD, StandardCharsets.UTF_8);
        HttpResponse<String> response = client.send(HttpRequest.newBuilder(uri("/api/v1/auth/login"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("X-CSRF-TOKEN", csrf.path("token").asText())
                .POST(HttpRequest.BodyPublishers.ofString(form)).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(204);
    }

    private JsonNode me(HttpClient client) throws Exception {
        HttpResponse<String> response = get(client, "/api/v1/auth/me");
        assertThat(response.statusCode()).isEqualTo(200);
        return json.readTree(response.body());
    }

    private HttpResponse<String> get(HttpClient client, String path) throws Exception {
        return client.send(HttpRequest.newBuilder(uri(path)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create("http://127.0.0.1:" + port + path);
    }
}
