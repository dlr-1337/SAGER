package br.edu.ifgoiano.sager.integrations;

import br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.DocumentRow;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public class ClicksignHttpProvider implements SignatureProvider {
    private static final String CONTENT_TYPE = "application/vnd.api+json";
    private final URI root;
    private final String token;
    private final String environment;
    private final Set<String> downloadHosts;
    private final ObjectMapper json;
    private final ProviderHttp http;

    public ClicksignHttpProvider(
            HttpClient client,
            URI root,
            String token,
            String environment,
            Set<String> downloadHosts,
            ObjectMapper json,
            Duration timeout) {
        this.root = root;
        this.token = token;
        this.environment = environment;
        this.downloadHosts = Set.copyOf(downloadHosts);
        this.json = json;
        this.http = new ProviderHttp(client, json, timeout);
    }

    public boolean available() {
        return true;
    }

    public String environment() {
        return environment;
    }

    public UUID prepare(
            String stage,
            IntegrationRepository.BindingData b,
            DocumentRow document,
            byte[] original) {
        String suffix, method = "POST", type;
        Map<String, Object> attributes;
        Map<String, Object> data = new LinkedHashMap<>();
        switch (stage) {
            case "ENVELOPE" -> {
                suffix = "/envelopes";
                type = "envelopes";
                attributes =
                        Map.of(
                                "name",
                                "SAGER " + b.documentVersionId(),
                                "locale",
                                "pt-BR",
                                "deadline_at",
                                b.expiresAt().toString(),
                                "auto_close",
                                true,
                                "remind_interval",
                                "null",
                                "block_after_refusal",
                                true);
            }
            case "DOCUMENT" -> {
                required(b.envelopeId());
                suffix = "/envelopes/" + b.envelopeId() + "/documents";
                type = "documents";
                attributes =
                        Map.of(
                                "filename",
                                "autorizacao-"
                                        + document.id()
                                        + "-r"
                                        + document.revision()
                                        + ".pdf",
                                "content_base64",
                                "data:application/pdf;base64,"
                                        + Base64.getEncoder().encodeToString(original),
                                "metadata",
                                json.writeValueAsString(
                                        Map.of(
                                                "documentVersionId",
                                                b.documentVersionId(),
                                                "bindingId",
                                                b.id())));
            }
            case "SIGNER" -> {
                required(b.envelopeId());
                suffix = "/envelopes/" + b.envelopeId() + "/signers";
                type = "signers";
                if (!b.guardianPhone().matches("\\+55[1-9][0-9]{9,10}"))
                    throw ProviderHttp.invalid();
                attributes =
                        Map.of(
                                "name",
                                b.guardianName(),
                                "phone_number",
                                b.guardianPhone().substring(3),
                                "refusable",
                                true,
                                "communicate_events",
                                Map.of(
                                        "signature_request",
                                        "none",
                                        "signature_reminder",
                                        "none",
                                        "document_signed",
                                        "whatsapp"));
            }
            case "AGREE", "SMS" -> {
                required(b.envelopeId());
                required(b.providerDocumentId());
                required(b.signerId());
                suffix = "/envelopes/" + b.envelopeId() + "/requirements";
                type = "requirements";
                attributes =
                        "AGREE".equals(stage)
                                ? Map.of("action", "agree", "role", "sign")
                                : Map.of("action", "provide_evidence", "auth", "sms");
                data.put(
                        "relationships",
                        Map.of(
                                "document",
                                Map.of(
                                        "data",
                                        Map.of("type", "documents", "id", b.providerDocumentId())),
                                "signer",
                                Map.of("data", Map.of("type", "signers", "id", b.signerId()))));
            }
            case "ACTIVATE" -> {
                required(b.envelopeId());
                suffix = "/envelopes/" + b.envelopeId();
                type = "envelopes";
                method = "PATCH";
                attributes = Map.of("status", "running");
                data.put("id", b.envelopeId());
            }
            default -> throw ProviderHttp.invalid();
        }
        data.put("type", type);
        data.put("attributes", attributes);
        JsonNode response =
                http.json(
                        ProviderHttp.append(root, suffix),
                        method,
                        token,
                        CONTENT_TYPE,
                        Map.of("data", data));
        try {
            return resource(response, type, null);
        } catch (ProviderFailure error) {
            throw ProviderHttp.failure(method, "provider_response_invalid");
        }
    }

    public VerifiedSignature inspect(IntegrationRepository.BindingData b) {
        required(b.envelopeId());
        required(b.providerDocumentId());
        required(b.signerId());
        required(b.agreeRequirementId());
        required(b.smsRequirementId());
        String path = "/envelopes/" + b.envelopeId();
        JsonNode envelope = get(path);
        resource(envelope, "envelopes", b.envelopeId());
        JsonNode document = get(path + "/documents/" + b.providerDocumentId());
        resource(document, "documents", b.providerDocumentId());
        JsonNode metadata = document.path("data").path("attributes").path("metadata");
        if (metadata.isString())
            try {
                metadata = json.readTree(metadata.asText());
            } catch (RuntimeException error) {
                throw ProviderHttp.invalid();
            }
        if (!b.documentVersionId().toString().equals(metadata.path("documentVersionId").asText())
                || !b.id().toString().equals(metadata.path("bindingId").asText()))
            throw ProviderHttp.invalid();
        JsonNode signer = get(path + "/signers/" + b.signerId());
        resource(signer, "signers", b.signerId());
        if (!b.guardianPhone()
                        .substring(3)
                        .equals(
                                signer.path("data")
                                        .path("attributes")
                                        .path("phone_number")
                                        .asText())
                || !b.guardianName()
                        .equals(signer.path("data").path("attributes").path("name").asText()))
            throw ProviderHttp.invalid();
        JsonNode requirements = get(path + "/requirements");
        JsonNode agree = find(requirements, "requirements", b.agreeRequirementId());
        JsonNode sms = find(requirements, "requirements", b.smsRequirementId());
        if (!"agree".equals(agree.path("attributes").path("action").asText())
                || !"sign".equals(agree.path("attributes").path("role").asText())
                || !"provide_evidence".equals(sms.path("attributes").path("action").asText())
                || !"sms".equals(sms.path("attributes").path("auth").asText()))
            throw ProviderHttp.invalid();
        relationshipIfPresent(agree, b);
        relationshipIfPresent(sms, b);
        JsonNode signEvents =
                get(
                        path
                                + "/documents/"
                                + b.providerDocumentId()
                                + "/events?filter%5Bname%5D=sign");
        JsonNode closeEvents =
                get(
                        path
                                + "/documents/"
                                + b.providerDocumentId()
                                + "/events?filter%5Bname%5D=document_closed");
        Instant signedAt = null, closedAt = null;
        JsonNode matching = null;
        for (JsonNode event : array(signEvents, "events")) {
            JsonNode attributes = event.path("attributes");
            if (!"sign".equals(attributes.path("name").asText())) throw ProviderHttp.invalid();
            JsonNode person = attributes.path("data").path("signer");
            if (!b.signerId().toString().equals(person.path("key").asText())
                    || !b.guardianPhone().substring(3).equals(person.path("phone_number").asText())
                    || !person.path("auths").isArray()
                    || !contains(person.path("auths"), "sms")) throw ProviderHttp.invalid();
            Instant at = instant(attributes, "created");
            if (signedAt == null || at.isBefore(signedAt)) {
                signedAt = at;
                matching = event;
            }
        }
        for (JsonNode event : array(closeEvents, "events")) {
            if (!"document_closed".equals(event.path("attributes").path("name").asText()))
                throw ProviderHttp.invalid();
            Instant at = instant(event.path("attributes"), "created");
            if (closedAt == null || at.isAfter(closedAt)) closedAt = at;
        }
        if (signedAt == null
                || closedAt == null
                || !"closed"
                        .equals(envelope.path("data").path("attributes").path("status").asText())
                || !"closed"
                        .equals(document.path("data").path("attributes").path("status").asText()))
            return null;
        if (signedAt.isBefore(b.createdAt())
                || !signedAt.isBefore(b.expiresAt())
                || closedAt.isBefore(signedAt)) throw ProviderHttp.invalid();
        JsonNode files = document.path("data").path("links").path("files");
        byte[] original = download(ProviderHttp.text(files, "original"));
        byte[] signed = download(ProviderHttp.text(files, "signed"));
        if (!new String(
                        signed,
                        0,
                        Math.min(5, signed.length),
                        java.nio.charset.StandardCharsets.US_ASCII)
                .equals("%PDF-")) throw ProviderHttp.invalid();
        String evidence =
                CapabilityTokens.hash(
                        json.writeValueAsBytes(
                                Map.of(
                                        "document",
                                        document,
                                        "signer",
                                        signer,
                                        "requirements",
                                        requirements,
                                        "signEvent",
                                        matching,
                                        "closedEvents",
                                        closeEvents)));
        return new VerifiedSignature(
                b.providerDocumentId(),
                b.signerId(),
                signedAt,
                evidence,
                signed,
                CapabilityTokens.hash(original));
    }

    public void cancel(IntegrationRepository.BindingData b) {
        if (b.envelopeId() == null) return;
        String path = "/envelopes/" + b.envelopeId();
        JsonNode envelope = get(path);
        resource(envelope, "envelopes", b.envelopeId());
        String status = ProviderHttp.text(envelope.path("data").path("attributes"), "status");
        if ("draft".equals(status)) {
            http.empty(ProviderHttp.append(root, path), "DELETE", token, CONTENT_TYPE, null);
            return;
        }
        if ("closed".equals(status) || "canceled".equals(status)) return;
        if (!"running".equals(status) || b.providerDocumentId() == null)
            throw ProviderHttp.invalid();
        JsonNode doc = get(path + "/documents/" + b.providerDocumentId());
        resource(doc, "documents", b.providerDocumentId());
        String documentStatus = ProviderHttp.text(doc.path("data").path("attributes"), "status");
        if ("closed".equals(documentStatus) || "canceled".equals(documentStatus)) return;
        if (!"running".equals(documentStatus)) throw ProviderHttp.invalid();
        JsonNode result =
                http.json(
                        ProviderHttp.append(root, path + "/documents/" + b.providerDocumentId()),
                        "PATCH",
                        token,
                        CONTENT_TYPE,
                        Map.of(
                                "data",
                                Map.of(
                                        "id",
                                        b.providerDocumentId(),
                                        "type",
                                        "documents",
                                        "attributes",
                                        Map.of("status", "canceled"))));
        resource(result, "documents", b.providerDocumentId());
    }

    private JsonNode get(String path) {
        return http.json(ProviderHttp.append(root, path), "GET", token, CONTENT_TYPE, null);
    }

    private byte[] download(String url) {
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException error) {
            throw ProviderHttp.invalid();
        }
        boolean sameTestOrigin =
                "http".equals(root.getScheme())
                        && java.util.Objects.equals(root.getAuthority(), uri.getAuthority());
        if (uri.getHost() == null
                || uri.getUserInfo() != null
                || uri.getFragment() != null
                || !downloadHosts.contains(uri.getHost())
                || (!"https".equals(uri.getScheme()) && !sameTestOrigin)
                || ("https".equals(uri.getScheme()) && uri.getPort() != -1 && uri.getPort() != 443))
            throw ProviderHttp.invalid();
        return http.bytes(uri, "GET", null, null, null, 10485760);
    }

    private static UUID resource(JsonNode response, String type, UUID expected) {
        JsonNode data = response.path("data");
        if (!type.equals(data.path("type").asText())) throw ProviderHttp.invalid();
        try {
            UUID id = UUID.fromString(ProviderHttp.text(data, "id"));
            if (expected != null && !expected.equals(id)) throw ProviderHttp.invalid();
            return id;
        } catch (IllegalArgumentException error) {
            throw ProviderHttp.invalid();
        }
    }

    private static List<JsonNode> array(JsonNode response, String type) {
        JsonNode data = response.path("data");
        if (!data.isArray() || data.size() > 100) throw ProviderHttp.invalid();
        List<JsonNode> values = new java.util.ArrayList<>();
        for (JsonNode item : data) {
            if (!type.equals(item.path("type").asText()) || !item.path("attributes").isObject())
                throw ProviderHttp.invalid();
            values.add(item);
        }
        return values;
    }

    private static JsonNode find(JsonNode response, String type, UUID id) {
        return array(response, type).stream()
                .filter(v -> id.toString().equals(v.path("id").asText()))
                .findFirst()
                .orElseThrow(ProviderHttp::invalid);
    }

    private static void required(UUID id) {
        if (id == null) throw ProviderHttp.invalid();
    }

    private static Instant instant(JsonNode attributes, String field) {
        try {
            return Instant.parse(ProviderHttp.text(attributes, field));
        } catch (java.time.DateTimeException error) {
            throw ProviderHttp.invalid();
        }
    }

    private static boolean contains(JsonNode values, String expected) {
        for (JsonNode value : values) if (expected.equals(value.asText())) return true;
        return false;
    }

    private static void relationshipIfPresent(
            JsonNode requirement, IntegrationRepository.BindingData b) {
        JsonNode relationships = requirement.path("relationships");
        if (relationships.isMissingNode()) return;
        if (!b.providerDocumentId()
                        .toString()
                        .equals(relationships.path("document").path("data").path("id").asText())
                || !b.signerId()
                        .toString()
                        .equals(relationships.path("signer").path("data").path("id").asText()))
            throw ProviderHttp.invalid();
    }
}
