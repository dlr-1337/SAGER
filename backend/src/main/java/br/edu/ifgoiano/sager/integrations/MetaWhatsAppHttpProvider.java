package br.edu.ifgoiano.sager.integrations;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;

public class MetaWhatsAppHttpProvider implements WhatsAppProvider {
    private final ProviderHttp http;
    private final URI endpoint;
    private final String token;
    private final String template;

    public MetaWhatsAppHttpProvider(
            HttpClient client,
            URI root,
            String version,
            String numberId,
            String token,
            String template,
            ObjectMapper json,
            Duration timeout) {
        if (version == null
                || !version.matches("v[0-9]+\\.[0-9]+")
                || numberId == null
                || !numberId.matches("[0-9]+")
                || template == null
                || !template.matches("[a-z0-9_]{1,512}"))
            throw new IllegalArgumentException("Configuração Meta inválida.");
        this.http = new ProviderHttp(client, json, timeout);
        this.endpoint = ProviderHttp.append(root, "/" + version + "/" + numberId + "/messages");
        this.token = token;
        this.template = template;
    }

    public boolean available() {
        return true;
    }

    public String send(String recipient, String rawToken) {
        if (!recipient.matches("55[1-9][0-9]{9,10}") || !rawToken.matches("[A-Za-z0-9_-]{43}"))
            throw new ProviderFailure(ProviderFailure.Kind.PERMANENT, "invalid_invitation");
        JsonNode response =
                http.json(
                        endpoint,
                        "POST",
                        "Bearer " + token,
                        "application/json",
                        Map.of(
                                "messaging_product",
                                "whatsapp",
                                "recipient_type",
                                "individual",
                                "to",
                                recipient,
                                "type",
                                "template",
                                "template",
                                Map.of(
                                        "name",
                                        template,
                                        "language",
                                        Map.of("code", "pt_BR"),
                                        "components",
                                        List.of(
                                                Map.of(
                                                        "type",
                                                        "button",
                                                        "sub_type",
                                                        "url",
                                                        "index",
                                                        "0",
                                                        "parameters",
                                                        List.of(
                                                                Map.of(
                                                                        "type", "text", "text",
                                                                        rawToken)))))));
        try {
            if (!"whatsapp".equals(response.path("messaging_product").asText())
                    || !response.path("messages").isArray()
                    || response.path("messages").size() != 1
                    || !response.path("contacts").isArray()
                    || response.path("contacts").size() != 1
                    || !recipient.equals(response.path("contacts").get(0).path("wa_id").asText()))
                throw ProviderHttp.invalid();
            String id = ProviderHttp.text(response.path("messages").get(0), "id");
            if (!id.startsWith("wamid.") || id.length() > 512) throw ProviderHttp.invalid();
            return id;
        } catch (ProviderFailure error) {
            throw new ProviderFailure(ProviderFailure.Kind.UNCERTAIN, "provider_response_invalid");
        }
    }
}
