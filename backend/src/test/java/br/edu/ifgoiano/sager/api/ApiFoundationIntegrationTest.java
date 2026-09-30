package br.edu.ifgoiano.sager.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.List;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
@Import(ApiFoundationIntegrationTest.FailureConfiguration.class)
class ApiFoundationIntegrationTest {
    private static final String PASSWORD = "Senha sintética 123!";
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
    void cleanAccounts() {
        jdbc.update("DELETE FROM spring_session");
        jdbc.update("DELETE FROM sager_local_account");
    }

    @Test
    void securityAndValidationErrorsUseSafeJsonWithServerCorrelation() throws Exception {
        try (HttpClient anonymous = browser()) {
            assertError(get(anonymous, "/api/v1/auth/me"), 401, "unauthorized");
            assertError(login(anonymous, "missing@example.test", "incorrect", csrf(anonymous)),
                    401, "invalid_credentials");
        }
        account("gestor");
        try (HttpClient client = browser()) {
            assertThat(login(client, "gestor@example.test", PASSWORD, csrf(client)).statusCode())
                    .isEqualTo(204);
            assertError(post(client, "/api/v1/residentes", "{}", null), 403, "csrf_invalid");
            assertError(post(client, "/api/v1/residentes", "{}", csrf(client)), 400, "invalid_input");
            assertError(get(client, "/api/v1/residentes/not-a-uuid"), 400, "invalid_input");
            assertError(get(client, "/api/v1/residentes/" + UUID.randomUUID()), 404, "not_found");
            assertError(get(client, "/api/v1/residentes/falha-controlada"), 500, "internal_error");
            HttpResponse<String> response = send(client, HttpRequest.newBuilder(uri("/api/v1/auth/me"))
                    .header("X-Request-Id", "spoofed-personal-information").GET().build());
            assertThat(UUID.fromString(response.headers().firstValue("X-Request-Id").orElseThrow()))
                    .isNotNull();
        }
        account("residente");
        try (HttpClient resident = browser()) {
            login(resident, "residente@example.test", PASSWORD, csrf(resident));
            assertError(get(resident, "/api/v1/residentes"), 403, "forbidden");
        }
    }

    @Test
    void openApiDescribesImplementedEndpointsAndRequiresManagementRole() throws Exception {
        account("supervisor");
        account("residente");
        try (HttpClient client = browser()) {
            assertError(get(client, "/api/v1/openapi"), 401, "unauthorized");
            login(client, "supervisor@example.test", PASSWORD, csrf(client));
            HttpResponse<String> response = get(client, "/api/v1/openapi");
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.headers().firstValue("Cache-Control").orElse("")).contains("no-store");
            JsonNode document = json.readTree(response.body());
            assertThat(document.path("openapi").asText()).startsWith("3.");
            for (String path : new String[] { "/api/v1/auth/me", "/api/v1/auth/login",
                    "/api/v1/auth/logout", "/api/v1/residentes", "/api/v1/supervisores",
                    "/api/v1/alojamentos", "/api/v1/quartos", "/api/v1/responsaveis",
                    "/api/v1/alocacoes", "/api/v1/auditoria" }) {
                assertThat(document.path("paths").has(path)).as(path).isTrue();
            }
            assertThat(document.path("components").path("securitySchemes")
                    .path("sessionCookie").path("name").asText()).isEqualTo("SESSION");
            assertThat(response.body()).doesNotContain("passwordHash", "LocalAccountPrincipal",
                    "falha-controlada");
            JsonNode birthDate = document.path("components").path("schemas")
                    .path("ResidentCreateRequest").path("properties").path("birthDate");
            assertThat(birthDate.path("type").asText()).isEqualTo("string");
            assertThat(birthDate.path("format").asText()).isEqualTo("date");
            assertThat(document.path("paths").path("/api/v1/responsaveis").path("post")
                    .path("responses").has("422")).isTrue();
            assertThat(document.path("paths").path("/api/v1/alocacoes").path("post")
                    .path("responses").has("422")).isTrue();
        }
        try (HttpClient resident = browser()) {
            login(resident, "residente@example.test", PASSWORD, csrf(resident));
            assertError(get(resident, "/api/v1/openapi"), 403, "forbidden");
        }
    }

    @Test
    void operationsContractDescribesStrictBodiesAndServerTimeRules() throws Exception {
        account("supervisor");
        try (HttpClient client = browser()) {
            login(client, "supervisor@example.test", PASSWORD, csrf(client));
            HttpResponse<String> response = get(client, "/api/v1/openapi");
            assertThat(response.statusCode()).isEqualTo(200);
            JsonNode document = json.readTree(response.body());
            for (String path : new String[] { "/api/v1/chamadas", "/api/v1/chamadas/contexto",
                    "/api/v1/chamadas/{id}", "/api/v1/chamadas/{id}/registros/{residentId}",
                    "/api/v1/chamadas/{id}/correcoes/{residentId}", "/api/v1/chamadas/{id}/fechamento",
                    "/api/v1/saidas-curtas", "/api/v1/saidas-curtas/elegibilidade",
                    "/api/v1/saidas-curtas/{id}", "/api/v1/saidas-curtas/{id}/decisao",
                    "/api/v1/saidas-curtas/{id}/cancelamento", "/api/v1/saidas-curtas/{id}/partida",
                    "/api/v1/saidas-curtas/{id}/retorno" }) {
                assertThat(document.path("paths").has(path)).as(path).isTrue();
            }
            JsonNode schemas = document.path("components").path("schemas");
            JsonNode plan = schemas.path("ShortExitCreateRequest");
            assertThat(plan.path("properties").has("residentId")).isFalse();
            assertThat(plan.path("additionalProperties").asBoolean()).isFalse();
            assertThat(plan.path("properties").path("departureMode").path("enum").toString())
                    .contains("NOW", "SCHEDULED");
            assertThat(plan.path("properties").path("reason").path("maxLength").asInt()).isEqualTo(2000);
            assertThat(schemas.path("NightCallCorrectionRequest").path("properties")
                    .path("justification").path("minLength").asInt()).isEqualTo(10);
            JsonNode version = schemas.path("ShortExitReturnRequest").path("properties").path("version");
            assertThat(version.path("type").asText()).isEqualTo("integer");
            assertThat(version.path("maximum").asLong()).isEqualTo(Long.MAX_VALUE - 1);
            assertThat(document.path("paths").path("/api/v1/saidas-curtas/{id}/partida").path("post")
                    .path("description").asText()).contains("America/Sao_Paulo", "10 caracteres");
        }
    }

    @Test
    void openApiIncludesLongExitBodiesCapabilityAndPrivatePdfContracts() throws Exception {
        account("supervisor");
        try (HttpClient client = browser()) {
            login(client, "supervisor@example.test", PASSWORD, csrf(client));
            HttpResponse<String> response = get(client, "/api/v1/openapi");
            assertThat(response.statusCode()).isEqualTo(200);
            JsonNode document = json.readTree(response.body());
            JsonNode paths = document.path("paths");
            for (String path : List.of("/api/v1/saidas-longas", "/api/v1/saidas-longas/elegibilidade",
                    "/api/v1/saidas-longas/{id}", "/api/v1/saidas-longas/{id}/decisao",
                    "/api/v1/saidas-longas/{id}/cancelamento", "/api/v1/saidas-longas/{id}/partida",
                    "/api/v1/saidas-longas/{id}/retorno", "/api/v1/saidas-longas/{id}/reenvio",
                    "/api/v1/saidas-longas/{id}/reconciliacao",
                    "/api/v1/saidas-longas/{id}/documentos/{documentVersionId}/original",
                    "/api/v1/saidas-longas/{id}/documentos/{documentVersionId}/assinado",
                    "/api/v1/assinaturas/acesso", "/api/v1/assinaturas/documento")) {
                assertThat(paths.has(path)).as(path).isTrue();
            }
            JsonNode schemas = document.path("components").path("schemas");
            assertThat(schemas.path("LongExitCreateRequest").path("required").toString()).contains("guardianId");
            assertThat(schemas.path("LongExitCreateRequest").path("additionalProperties").asBoolean(true)).isFalse();
            assertThat(schemas.path("LongExitUpdateRequest").path("properties").path("version")
                    .path("maximum").asLong()).isEqualTo(Long.MAX_VALUE - 1);
            assertThat(paths.path("/api/v1/saidas-longas/{id}/decisao").path("post")
                    .path("requestBody").path("content").path("application/json").path("schema")
                    .path("$ref").asText()).isEqualTo("#/components/schemas/LongExitDecisionRequest");
            assertThat(paths.path("/api/v1/assinaturas/acesso").path("get").path("security")
                    .get(0).has("signatureCapability")).isTrue();
            assertThat(paths.path("/api/v1/assinaturas/documento").path("get").path("responses")
                    .path("200").path("content").has("application/pdf")).isTrue();
            assertThat(document.path("components").path("securitySchemes").path("signatureCapability")
                    .path("scheme").asText()).isEqualTo("bearer");
        }
    }

    @Test
    void openApiIncludesActualHealthPathsAndStrictDistinctRequestSchemas() throws Exception {
        account("gestor");
        try (HttpClient client = browser()) {
            login(client, "gestor@example.test", PASSWORD, csrf(client));
            HttpResponse<String> response = get(client, "/api/v1/openapi");
            assertThat(response.statusCode()).isEqualTo(200);
            JsonNode document = json.readTree(response.body());
            JsonNode paths = document.path("paths");
            for (String path : List.of("/api/v1/saude/me", "/api/v1/saude/contas",
                    "/api/v1/saude/habilitacoes", "/api/v1/saude/habilitacoes/{id}/revogacao",
                    "/api/v1/saude/vinculos", "/api/v1/saude/vinculos/{id}/encerramento",
                    "/api/v1/saude/custodias", "/api/v1/saude/custodias/{id}/encerramento",
                    "/api/v1/saude/residentes", "/api/v1/saude/residentes/{id}",
                    "/api/v1/saude/residentes/{id}/profissionais", "/api/v1/saude/residentes/{id}/notas",
                    "/api/v1/saude/notas/{id}", "/api/v1/saude/notas/{id}/historico",
                    "/api/v1/saude/notas/{id}/correcoes", "/api/v1/saude/notas/{id}/partilhas",
                    "/api/v1/saude/notas/{id}/partilhas/{shareId}/revogacao",
                    "/api/v1/saude/residentes/{id}/exportacoes", "/api/v1/minha-saude/notas",
                    "/api/v1/minha-saude/notas/{id}", "/api/v1/minha-saude/notas/{id}/historico",
                    "/api/v1/minha-saude/exportacoes")) {
                assertThat(paths.has(path)).as(path).isTrue();
            }
            assertThat(paths.path("/api/v1/saude/notas/{id}/partilhas").path("post")
                    .path("requestBody").path("content").path("application/json").path("schema")
                    .path("$ref").asText()).isEqualTo("#/components/schemas/HealthNoteShareRequest");
            JsonNode schemas = document.path("components").path("schemas");
            JsonNode grant = schemas.path("HealthGrantCreateRequest").path("properties");
            assertThat(grant.path("registrationNumber").path("maxLength").asInt()).isEqualTo(100);
            assertThat(grant.path("registrationRegion").path("enum").size()).isEqualTo(27);
            JsonNode correction = schemas.path("HealthNoteCorrectionRequest").path("properties");
            assertThat(correction.path("body").path("maxLength").asInt()).isEqualTo(4000);
            assertThat(correction.path("reason").path("minLength").asInt()).isEqualTo(10);
            assertThat(correction.path("version").path("type").asText()).isEqualTo("integer");
            assertThat(schemas.path("HealthNoteShareRequest").path("properties")
                    .path("recipientGrantIds").path("uniqueItems").asBoolean()).isTrue();
            assertThat(paths.path("/api/v1/minha-saude/exportacoes").path("post")
                    .path("responses").path("403").path("content").path("application/json")
                    .path("schema").path("$ref").asText()).isEqualTo("#/components/schemas/ApiError");
        }
    }

    @Test
    void reportingContractHasStrictScoringSnapshotFiltersAndActualDownloadFormats() throws Exception {
        account("supervisor");
        try (HttpClient client = browser()) {
            login(client, "supervisor@example.test", PASSWORD, csrf(client));
            JsonNode document = json.readTree(get(client, "/api/v1/openapi").body());
            JsonNode paths = document.path("paths");
            for (String path : List.of("/limpeza/politica", "/limpeza/avaliacoes", "/limpeza/avaliacoes/{id}/corrigir",
                    "/limpeza/ranking", "/limpeza/indicadores", "/me/limpeza/avaliacoes/{id}",
                    "/relatorios/catalogo", "/relatorios/consultas", "/relatorios/consultas/{id}/linhas",
                    "/relatorios/consultas/{id}/exportacoes", "/relatorios/exportacoes/{id}/arquivo")) {
                assertThat(paths.has("/api/v1" + path)).as(path).isTrue();
            }
            JsonNode schemas = document.path("components").path("schemas");
            JsonNode criteria = schemas.path("CleaningAssessmentCreateRequest").path("properties").path("criteria");
            assertThat(criteria.path("required").size()).isEqualTo(4);
            assertThat(criteria.path("additionalProperties").asBoolean(true)).isFalse();
            assertThat(criteria.path("properties").path("PISO").path("multipleOf").decimalValue()).isEqualByComparingTo("0.1");
            assertThat(schemas.path("CleaningAssessmentCorrectionRequest").path("properties").path("reason").path("minLength").asInt()).isEqualTo(10);
            JsonNode filters = schemas.path("ReportSnapshotCreateRequest").path("properties").path("filters");
            assertThat(filters.path("additionalProperties").asBoolean(true)).isFalse();
            assertThat(filters.path("properties").path("residentId").path("format").asText()).isEqualTo("uuid");
            assertThat(schemas.path("ReportExportRequest").path("properties").path("format").path("enum").toString()).contains("PDF", "XLSX");
            assertThat(paths.path("/api/v1/relatorios/exportacoes/{id}/arquivo").path("get").path("responses").path("200").path("content")
                    .has("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).isTrue();
            assertThat(paths.path("/api/v1/relatorios/consultas").path("post").path("description").asText()).contains("10.000", "366", "24 horas");
        }
    }

    @Test
    void communicationsContractDocumentsHumanDecisionsVersionedAcknowledgementAndPrivatePdf() throws Exception {
        account("supervisor");
        try (HttpClient client = browser()) {
            login(client, "supervisor@example.test", PASSWORD, csrf(client));
            JsonNode document = json.readTree(get(client, "/api/v1/openapi").body());
            JsonNode paths = document.path("paths");
            for (String path : List.of("/notificacoes/contexto", "/ocorrencias", "/notificacoes/{id}/converter",
                    "/advertencias", "/residentes/{id}/reincidencias", "/residentes/{id}/termos",
                    "/avisos/{id}/revisar", "/me/comunicacoes/{id}/leitura", "/me/comunicacoes/{id}/ciencia",
                    "/me/termos/{id}/documento")) {
                assertThat(paths.has("/api/v1" + path)).as(path).isTrue();
            }
            JsonNode schemas = document.path("components").path("schemas");
            assertThat(schemas.path("WarningCreateRequest").path("additionalProperties").asBoolean(true)).isFalse();
            assertThat(schemas.path("WarningCreateRequest").path("properties").path("severity").path("enum").size()).isEqualTo(3);
            assertThat(schemas.path("WarningCreateRequest").path("properties").path("justification").path("minLength").asInt()).isEqualTo(10);
            assertThat(schemas.path("TermIssueRequest").path("properties").path("warningIds").path("minItems").asInt()).isEqualTo(2);
            assertThat(schemas.path("TermIssueRequest").path("properties").path("confirmed").path("enum").get(0).asBoolean()).isTrue();
            assertThat(schemas.path("CommunicationAcknowledgeRequest").path("properties").path("version").path("type").asText()).isEqualTo("integer");
            assertThat(schemas.path("NoticeRevisionRequest").path("properties").has("residentIds")).isFalse();
            assertThat(paths.path("/api/v1/me/termos/{id}/documento").path("get").path("responses")
                    .path("200").path("content").has("application/pdf")).isTrue();
            assertThat(paths.path("/api/v1/notificacoes/{id}/converter").path("post").path("responses")
                    .path("409").path("content").path("application/json").path("schema").path("$ref").asText())
                    .isEqualTo("#/components/schemas/ApiError");
        }
    }

    @Test
    void operationalHealthAndMetricsAreRestrictedAndHideDetails() throws Exception {
        account("gestor");
        account("residente");
        try (HttpClient client = browser()) {
            assertError(get(client, "/actuator/health"), 401, "unauthorized");
            login(client, "gestor@example.test", PASSWORD, csrf(client));
            HttpResponse<String> health = get(client, "/actuator/health");
            assertThat(health.statusCode()).isEqualTo(200);
            assertThat(json.readTree(health.body()).path("status").asText()).isEqualTo("UP");
            assertThat(health.body()).doesNotContain("components", "jdbc", "password", "database");
            assertThat(get(client, "/actuator/metrics/http.server.requests").statusCode()).isEqualTo(200);
            assertError(get(client, "/actuator/env"), 403, "forbidden");
        }
        try (HttpClient resident = browser()) {
            login(resident, "residente@example.test", PASSWORD, csrf(resident));
            assertError(get(resident, "/actuator/health"), 403, "forbidden");
            assertError(get(resident, "/actuator/metrics"), 403, "forbidden");
        }
    }

    private void assertError(HttpResponse<String> response, int status, String code) throws Exception {
        assertThat(response.statusCode()).isEqualTo(status);
        assertThat(response.headers().firstValue("Content-Type").orElse("")).contains("application/json");
        assertThat(response.headers().firstValue("Cache-Control").orElse("")).contains("no-store");
        JsonNode body = json.readTree(response.body());
        assertThat(body.size()).isEqualTo(3);
        assertThat(body.path("code").asText()).isEqualTo(code);
        assertThat(body.path("message").asText()).isNotBlank();
        UUID requestId = UUID.fromString(body.path("requestId").asText());
        assertThat(response.headers().firstValue("X-Request-Id").orElseThrow())
                .isEqualTo(requestId.toString());
        assertThat(response.body()).doesNotContain("segredo-sintetico", "exception", "trace",
                "password", "spoofed-personal-information");
    }

    private void account(String profile) {
        provisioning.create(profile + "@example.test", "Pessoa Sintética", profile, PASSWORD.toCharArray());
    }

    private HttpClient browser() {
        return HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
                .followRedirects(HttpClient.Redirect.NEVER).build();
    }

    private URI uri(String path) {
        return URI.create("http://127.0.0.1:" + port + path);
    }

    private HttpResponse<String> get(HttpClient client, String path) throws Exception {
        return send(client, HttpRequest.newBuilder(uri(path)).header("Accept", "application/json")
                .GET().build());
    }

    private String csrf(HttpClient client) throws Exception {
        return json.readTree(get(client, "/api/v1/auth/csrf").body()).path("token").asText();
    }

    private HttpResponse<String> login(HttpClient client, String email, String password, String csrf)
            throws Exception {
        String body = "email=" + java.net.URLEncoder.encode(email, java.nio.charset.StandardCharsets.UTF_8)
                + "&password=" + java.net.URLEncoder.encode(password, java.nio.charset.StandardCharsets.UTF_8);
        return send(client, HttpRequest.newBuilder(uri("/api/v1/auth/login"))
                .header("Content-Type", "application/x-www-form-urlencoded").header("X-CSRF-TOKEN", csrf)
                .POST(HttpRequest.BodyPublishers.ofString(body)).build());
    }

    private HttpResponse<String> post(HttpClient client, String path, String body, String csrf)
            throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body));
        if (csrf != null) request.header("X-CSRF-TOKEN", csrf);
        return send(client, request.build());
    }

    private HttpResponse<String> send(HttpClient client, HttpRequest request) throws Exception {
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    @TestConfiguration
    static class FailureConfiguration {
        @Bean
        FailureController failureController() {
            return new FailureController();
        }
    }

    @RestController
    static class FailureController {
        @GetMapping("/api/v1/residentes/falha-controlada")
        Map<String, Object> fail() {
            throw new IllegalStateException("segredo-sintetico");
        }
    }
}
