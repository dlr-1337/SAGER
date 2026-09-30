package br.edu.ifgoiano.sager.integrations;

import org.springframework.core.env.Environment;

import java.net.URI;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

public final class IntegrationProperties {
    private final Environment env;

    public IntegrationProperties(Environment env) {
        this.env = env;
        validate();
    }

    public boolean clicksignEnabled() {
        return env.getProperty("sager.integrations.clicksign.enabled", Boolean.class, false);
    }

    public boolean whatsappEnabled() {
        return env.getProperty("sager.integrations.whatsapp.enabled", Boolean.class, false);
    }

    public URI clicksignRoot() {
        try {
            return URI.create(value("clicksign.api-base", "https://sandbox.clicksign.com/api/v3"));
        } catch (IllegalArgumentException invalid) {
            throw new IllegalArgumentException(
                    "Configuração de integração inválida: clicksign.api-base.");
        }
    }

    public String clicksignToken() {
        return value("clicksign.access-token", "");
    }

    public String clicksignWebhookSecret() {
        return value("clicksign.webhook-secret", "");
    }

    public String clicksignEnvironment() {
        return "app.clicksign.com".equals(clicksignRoot().getHost()) ? "production" : "sandbox";
    }

    public Set<String> clicksignDownloadHosts() {
        return Arrays.stream(
                        value(
                                        "clicksign.download-hosts",
                                        "clicksign-content.s3.amazonaws.com,clicksign-sandbox-content.s3.amazonaws.com")
                                .split(","))
                .map(String::trim)
                .collect(Collectors.toUnmodifiableSet());
    }

    public String graphVersion() {
        return value("whatsapp.graph-version", "");
    }

    public String phoneNumberId() {
        return value("whatsapp.phone-number-id", "");
    }

    public String whatsappToken() {
        return value("whatsapp.access-token", "");
    }

    public String whatsappAppSecret() {
        return value("whatsapp.app-secret", "");
    }

    public String whatsappVerifyToken() {
        return value("whatsapp.verify-token", "");
    }

    public String wabaId() {
        return value("whatsapp.waba-id", "");
    }

    public String templateName() {
        return value("whatsapp.template-name", "");
    }

    private String value(String suffix, String fallback) {
        return env.getProperty("sager.integrations." + suffix, fallback);
    }

    private void validate() {
        if (clicksignEnabled()) {
            URI uri = clicksignRoot();
            if (!"https".equals(uri.getScheme())
                    || uri.getHost() == null
                    || !Set.of("app.clicksign.com", "sandbox.clicksign.com").contains(uri.getHost())
                    || !"/api/v3".equals(uri.getPath())
                    || uri.getPort() != -1
                    || uri.getUserInfo() != null
                    || uri.getQuery() != null
                    || uri.getFragment() != null) invalid("clicksign.api-base");
            required(clicksignToken(), "clicksign.access-token");
            required(clicksignWebhookSecret(), "clicksign.webhook-secret");
            if (clicksignToken().equals(clicksignWebhookSecret()))
                invalid("clicksign.webhook-secret");
            for (String host : clicksignDownloadHosts())
                if (!host.matches("clicksign(?:-[a-z0-9]+)+\\.s3\\.amazonaws\\.com"))
                    invalid("clicksign.download-hosts");
        }
        if (whatsappEnabled()) {
            if (!graphVersion().matches("v[0-9]+\\.[0-9]+")) invalid("whatsapp.graph-version");
            if (!phoneNumberId().matches("[0-9]{1,64}")) invalid("whatsapp.phone-number-id");
            if (!wabaId().matches("[0-9]{1,64}")) invalid("whatsapp.waba-id");
            required(whatsappToken(), "whatsapp.access-token");
            required(whatsappAppSecret(), "whatsapp.app-secret");
            required(whatsappVerifyToken(), "whatsapp.verify-token");
            if (whatsappAppSecret().equals(whatsappVerifyToken())
                    || whatsappAppSecret().equals(whatsappToken())) invalid("whatsapp.app-secret");
            if (!templateName().matches("[a-z0-9_]{1,512}")) invalid("whatsapp.template-name");
        }
        if (clicksignEnabled() || whatsappEnabled()) {
            URI publicOrigin;
            try {
                publicOrigin = URI.create(value("public-origin", ""));
            } catch (IllegalArgumentException error) {
                throw new IllegalArgumentException(
                        "Configuração de integração inválida: public-origin.");
            }
            if (!"https".equals(publicOrigin.getScheme())
                    || publicOrigin.getHost() == null
                    || publicOrigin.getUserInfo() != null
                    || publicOrigin.getPort() != -1
                    || publicOrigin.getQuery() != null
                    || publicOrigin.getFragment() != null
                    || (!publicOrigin.getPath().isEmpty() && !"/".equals(publicOrigin.getPath())))
                invalid("public-origin");
        }
    }

    private void required(String value, String key) {
        if (value == null
                || value.isBlank()
                || value.indexOf('\n') >= 0
                || value.indexOf('\r') >= 0) invalid(key);
    }

    private void invalid(String key) {
        throw new IllegalArgumentException("Configuração de integração inválida: " + key + ".");
    }
}
