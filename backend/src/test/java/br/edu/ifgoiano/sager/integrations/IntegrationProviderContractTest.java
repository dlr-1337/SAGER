package br.edu.ifgoiano.sager.integrations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.edu.ifgoiano.sager.documents.StoredFile;
import br.edu.ifgoiano.sager.integrations.IntegrationRepository.BindingData;
import br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.DocumentRow;

import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

@SpringJUnitConfig(IntegrationProviderContractTest.DoubleConfiguration.class)
class IntegrationProviderContractTest {
    @Autowired DoubleServer server;
    @Autowired ObjectMapper json;
    UUID envelope = UUID.randomUUID(),
            document = UUID.randomUUID(),
            signer = UUID.randomUUID(),
            binding = UUID.randomUUID(),
            revision = UUID.randomUUID();
    UUID agree = UUID.randomUUID(), sms = UUID.randomUUID();
    Instant now = Instant.parse("2026-10-01T01:00:00Z");
    byte[] original = "%PDF-1.7\noriginal sintético".getBytes(StandardCharsets.UTF_8);
    byte[] signed = "%PDF-1.7\nassinado sintético preservado".getBytes(StandardCharsets.UTF_8);

    @BeforeEach
    void reset() {
        server.calls.clear();
        server.responses.clear();
        server.delay = 0;
    }

    @Test
    void persistsV3SequenceWithRawAuthorizationSmsAndOneSigner() {
        ClicksignHttpProvider provider = click(Duration.ofSeconds(20));
        BindingData b = data();
        DocumentRow doc =
                new DocumentRow(
                        revision,
                        b.exitId(),
                        1,
                        "{}",
                        new StoredFile(
                                UUID.randomUUID(),
                                CapabilityTokens.hash(original),
                                original.length,
                                "STORED"),
                        null);
        List<String> stages = List.of("ENVELOPE", "DOCUMENT", "SIGNER", "AGREE", "SMS", "ACTIVATE");
        List<UUID> ids = List.of(envelope, document, signer, agree, sms, envelope);
        for (int i = 0; i < stages.size(); i++) {
            String type =
                    i == 0 || i == 5
                            ? "envelopes"
                            : i == 1 ? "documents" : i == 2 ? "signers" : "requirements";
            server.responses.add(
                    new Answer(
                            200,
                            json.writeValueAsString(
                                    Map.of("data", Map.of("id", ids.get(i), "type", type)))));
            assertThat(provider.prepare(stages.get(i), b, doc, original)).isEqualTo(ids.get(i));
        }
        assertThat(server.calls).hasSize(6);
        for (Call call : server.calls) {
            assertThat(call.authorization()).isEqualTo("synthetic-click-token");
            assertThat(call.contentType()).isEqualTo("application/vnd.api+json");
        }
        JsonNode upload = json.readTree(server.calls.get(1).body()).path("data").path("attributes");
        assertThat(
                        java.util.Base64.getDecoder()
                                .decode(
                                        upload.path("content_base64")
                                                .asText()
                                                .replace("data:application/pdf;base64,", "")))
                .isEqualTo(original);
        assertThat(
                        json.readTree(upload.path("metadata").asText())
                                .path("documentVersionId")
                                .asText())
                .isEqualTo(revision.toString());
        JsonNode person = json.readTree(server.calls.get(2).body()).path("data").path("attributes");
        assertThat(person.path("phone_number").asText()).isEqualTo("62999990000");
        assertThat(person.path("communicate_events").path("signature_request").asText())
                .isEqualTo("none");
        assertThat(person.path("communicate_events").path("document_signed").asText())
                .isEqualTo("whatsapp");
        assertThat(
                        json.readTree(server.calls.get(3).body())
                                .path("data")
                                .path("attributes")
                                .path("role")
                                .asText())
                .isEqualTo("sign");
        assertThat(
                        json.readTree(server.calls.get(4).body())
                                .path("data")
                                .path("attributes")
                                .path("auth")
                                .asText())
                .isEqualTo("sms");
        assertThat(
                        json.readTree(server.calls.get(5).body())
                                .path("data")
                                .path("attributes")
                                .path("status")
                                .asText())
                .isEqualTo("running");
    }

    @Test
    void requiresAuthenticatedClosedDocumentSignerRequirementsEventsAndPreservesSignedBytes() {
        closedAnswers(true, signer, "documents");
        SignatureProvider.VerifiedSignature result = click(Duration.ofSeconds(20)).inspect(data());
        assertThat(result).isNotNull();
        assertThat(result.documentId()).isEqualTo(document);
        assertThat(result.signerId()).isEqualTo(signer);
        assertThat(result.signedPdf()).isEqualTo(signed);
        assertThat(result.signedAt()).isEqualTo(now.plusSeconds(60));
        assertThat(server.calls.stream().filter(c -> !c.path().startsWith("/files")))
                .allMatch(c -> "synthetic-click-token".equals(c.authorization()));
        assertThat(server.calls.stream().filter(c -> c.path().startsWith("/files")))
                .allMatch(c -> c.authorization() == null);
    }

    @Test
    void signatureEventAloneAndMalformedDocumentNeverBecomeEvidence() {
        closedAnswers(false, signer, "documents");
        assertThat(click(Duration.ofSeconds(20)).inspect(data())).isNull();
        server.responses.clear();
        closedAnswers(true, signer, "envelopes");
        assertThatThrownBy(() -> click(Duration.ofSeconds(20)).inspect(data()))
                .isInstanceOf(ProviderFailure.class);
        server.responses.clear();
        closedAnswers(true, UUID.randomUUID(), "documents");
        assertThatThrownBy(() -> click(Duration.ofSeconds(20)).inspect(data()))
                .isInstanceOf(ProviderFailure.class);
    }

    @Test
    void signatureAtTheExclusiveCapabilityDeadlineIsRejected() {
        closedAnswers(true, signer, "documents");
        BindingData b = data();
        BindingData boundary =
                new BindingData(
                        b.id(),
                        b.exitId(),
                        b.documentVersionId(),
                        b.guardianId(),
                        b.guardianVersion(),
                        b.guardianName(),
                        b.guardianRelationship(),
                        b.guardianPhone(),
                        b.environment(),
                        b.status(),
                        b.stage(),
                        b.envelopeId(),
                        b.providerDocumentId(),
                        b.signerId(),
                        b.agreeRequirementId(),
                        b.smsRequirementId(),
                        b.tokenHash(),
                        b.issuedAt(),
                        now.plusSeconds(60),
                        b.revokedAt(),
                        b.signedAt(),
                        b.verifiedAt(),
                        b.verifiedApi(),
                        b.evidenceHash(),
                        b.failureCode(),
                        b.createdAt(),
                        b.version());
        assertThatThrownBy(() -> click(Duration.ofSeconds(20)).inspect(boundary))
                .isInstanceOf(ProviderFailure.class);
    }

    @Test
    void ambiguousPostTimeoutAndMalformedSuccessNeverRetryBlindly() {
        server.responses.add(new Answer(201, "{}"));
        DocumentRow doc =
                new DocumentRow(
                        revision,
                        UUID.randomUUID(),
                        1,
                        "{}",
                        new StoredFile(
                                UUID.randomUUID(),
                                CapabilityTokens.hash(original),
                                original.length,
                                "STORED"),
                        null);
        assertThatThrownBy(
                        () ->
                                click(Duration.ofSeconds(20))
                                        .prepare("ENVELOPE", data(), doc, original))
                .isInstanceOfSatisfying(
                        ProviderFailure.class,
                        e -> assertThat(e.kind()).isEqualTo(ProviderFailure.Kind.UNCERTAIN));
        server.responses.add(new Answer(201, "{}"));
        server.delay = 250;
        assertThatThrownBy(
                        () ->
                                click(Duration.ofMillis(50))
                                        .prepare("ENVELOPE", data(), doc, original))
                .isInstanceOfSatisfying(
                        ProviderFailure.class,
                        e -> assertThat(e.kind()).isEqualTo(ProviderFailure.Kind.UNCERTAIN));
    }

    @Test
    void metaUsesConfiguredVersionApprovedTemplateOpaqueSuffixAndAcceptanceOnly() {
        server.responses.add(
                new Answer(
                        200,
                        json.writeValueAsString(
                                Map.of(
                                        "messaging_product",
                                        "whatsapp",
                                        "contacts",
                                        List.of(Map.of("wa_id", "5562999990000")),
                                        "messages",
                                        List.of(Map.of("id", "wamid.synthetic"))))));
        var provider =
                new MetaWhatsAppHttpProvider(
                        HttpClient.newHttpClient(),
                        server.root(),
                        "v99.0",
                        "12345",
                        "synthetic-meta-token",
                        "sager_autorizacao_saida_v1",
                        json,
                        Duration.ofSeconds(20));
        String token = "a".repeat(43);
        assertThat(provider.send("5562999990000", token)).isEqualTo("wamid.synthetic");
        Call call = server.calls.getFirst();
        assertThat(call.path()).isEqualTo("/v99.0/12345/messages");
        assertThat(call.authorization()).isEqualTo("Bearer synthetic-meta-token");
        JsonNode body = json.readTree(call.body());
        assertThat(body.path("type").asText()).isEqualTo("template");
        assertThat(body.path("template").path("language").path("code").asText()).isEqualTo("pt_BR");
        assertThat(
                        body.path("template")
                                .path("components")
                                .get(0)
                                .path("parameters")
                                .get(0)
                                .path("text")
                                .asText())
                .isEqualTo(token);
        assertThat(call.path()).doesNotContain(token);
        assertThat(call.body()).doesNotContain("https://", "#token=");
    }

    @Test
    void hmacAuthenticatesRawBytesAndKeepsSecretsSeparate() throws Exception {
        byte[] raw = "{\"nome\":\"Autorização\"}".getBytes(StandardCharsets.UTF_8);
        String secret = "synthetic-webhook-secret";
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String header = "sha256=" + HexFormat.of().formatHex(mac.doFinal(raw));
        assertThat(WebhookHmacVerifier.valid(header, secret, raw)).isTrue();
        assertThat(WebhookHmacVerifier.valid(header, "different-app-secret", raw)).isFalse();
        assertThat(WebhookHmacVerifier.valid(header, secret, "{}".getBytes(StandardCharsets.UTF_8)))
                .isFalse();
        assertThat(WebhookHmacVerifier.valid(null, secret, raw)).isFalse();
    }

    private ClicksignHttpProvider click(Duration timeout) {
        return new ClicksignHttpProvider(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build(),
                server.root(),
                "synthetic-click-token",
                "sandbox",
                Set.of("127.0.0.1"),
                json,
                timeout);
    }

    private BindingData data() {
        return new BindingData(
                binding,
                UUID.randomUUID(),
                revision,
                UUID.randomUUID(),
                0,
                "Responsável sintético",
                "Mãe",
                "+5562999990000",
                "sandbox",
                "PENDING",
                "DONE",
                envelope,
                document,
                signer,
                agree,
                sms,
                null,
                null,
                now.plusSeconds(14400),
                null,
                null,
                null,
                false,
                null,
                null,
                now,
                0);
    }

    private void closedAnswers(boolean closed, UUID eventSigner, String documentType) {
        server.responses.add(
                new Answer(
                        200,
                        json.writeValueAsString(
                                Map.of(
                                        "data",
                                        Map.of(
                                                "id",
                                                envelope,
                                                "type",
                                                "envelopes",
                                                "attributes",
                                                Map.of(
                                                        "status",
                                                        closed ? "closed" : "running"))))));
        server.responses.add(
                new Answer(
                        200,
                        json.writeValueAsString(
                                Map.of(
                                        "data",
                                        Map.of(
                                                "id",
                                                document,
                                                "type",
                                                documentType,
                                                "attributes",
                                                Map.of(
                                                        "status",
                                                        closed ? "closed" : "running",
                                                        "metadata",
                                                        Map.of(
                                                                "documentVersionId",
                                                                revision,
                                                                "bindingId",
                                                                binding)),
                                                "links",
                                                Map.of(
                                                        "files",
                                                        Map.of(
                                                                "original",
                                                                server.root() + "/files/original",
                                                                "signed",
                                                                server.root()
                                                                        + "/files/signed")))))));
        server.responses.add(
                new Answer(
                        200,
                        json.writeValueAsString(
                                Map.of(
                                        "data",
                                        Map.of(
                                                "id",
                                                signer,
                                                "type",
                                                "signers",
                                                "attributes",
                                                Map.of(
                                                        "name",
                                                        "Responsável sintético",
                                                        "phone_number",
                                                        "62999990000"))))));
        server.responses.add(
                new Answer(
                        200,
                        json.writeValueAsString(
                                Map.of(
                                        "data",
                                        List.of(
                                                Map.of(
                                                        "id",
                                                        agree,
                                                        "type",
                                                        "requirements",
                                                        "attributes",
                                                        Map.of("action", "agree", "role", "sign")),
                                                Map.of(
                                                        "id",
                                                        sms,
                                                        "type",
                                                        "requirements",
                                                        "attributes",
                                                        Map.of(
                                                                "action",
                                                                "provide_evidence",
                                                                "auth",
                                                                "sms")))))));
        server.responses.add(
                new Answer(
                        200,
                        json.writeValueAsString(
                                Map.of(
                                        "data",
                                        List.of(
                                                Map.of(
                                                        "id",
                                                        UUID.randomUUID(),
                                                        "type",
                                                        "events",
                                                        "attributes",
                                                        Map.of(
                                                                "name",
                                                                "sign",
                                                                "created",
                                                                now.plusSeconds(60).toString(),
                                                                "data",
                                                                Map.of(
                                                                        "signer",
                                                                        Map.of(
                                                                                "key",
                                                                                eventSigner,
                                                                                "phone_number",
                                                                                "62999990000",
                                                                                "auths",
                                                                                List.of(
                                                                                        "sms"))))))))));
        server.responses.add(
                new Answer(
                        200,
                        json.writeValueAsString(
                                Map.of(
                                        "data",
                                        closed
                                                ? List.of(
                                                        Map.of(
                                                                "id",
                                                                UUID.randomUUID(),
                                                                "type",
                                                                "events",
                                                                "attributes",
                                                                Map.of(
                                                                        "name",
                                                                        "document_closed",
                                                                        "created",
                                                                        now.plusSeconds(61)
                                                                                .toString())))
                                                : List.of()))));
        if (closed) {
            server.responses.add(new Answer(200, new String(original, StandardCharsets.UTF_8)));
            server.responses.add(new Answer(200, new String(signed, StandardCharsets.UTF_8)));
        }
    }

    record Call(String path, String authorization, String contentType, String body) {}

    record Answer(int status, String body) {}

    @TestConfiguration
    static class DoubleConfiguration {
        @Bean
        ObjectMapper json() {
            return new ObjectMapper();
        }

        @Bean(destroyMethod = "close")
        DoubleServer server() throws IOException {
            return new DoubleServer();
        }
    }

    static class DoubleServer implements AutoCloseable {
        final HttpServer http;
        final List<Call> calls = new CopyOnWriteArrayList<>();
        final List<Answer> responses = new CopyOnWriteArrayList<>();
        volatile long delay;

        DoubleServer() throws IOException {
            http = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            http.setExecutor(java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor());
            http.createContext(
                    "/",
                    exchange -> {
                        String body =
                                new String(
                                        exchange.getRequestBody().readAllBytes(),
                                        StandardCharsets.UTF_8);
                        calls.add(
                                new Call(
                                        exchange.getRequestURI().getPath(),
                                        exchange.getRequestHeaders().getFirst("Authorization"),
                                        exchange.getRequestHeaders().getFirst("Content-Type"),
                                        body));
                        Answer answer =
                                responses.isEmpty()
                                        ? new Answer(500, "{}")
                                        : responses.removeFirst();
                        if (delay > 0)
                            try {
                                Thread.sleep(delay);
                            } catch (InterruptedException e) {
                                Thread.currentThread().interrupt();
                            }
                        byte[] bytes = answer.body().getBytes(StandardCharsets.UTF_8);
                        exchange.getResponseHeaders()
                                .set(
                                        "Content-Type",
                                        exchange.getRequestURI().getPath().startsWith("/files")
                                                ? "application/pdf"
                                                : "application/json");
                        exchange.sendResponseHeaders(answer.status(), bytes.length);
                        try (var out = exchange.getResponseBody()) {
                            out.write(bytes);
                        }
                        exchange.close();
                    });
            http.start();
        }

        URI root() {
            return URI.create("http://127.0.0.1:" + http.getAddress().getPort());
        }

        public void close() {
            http.stop(0);
        }
    }
}
