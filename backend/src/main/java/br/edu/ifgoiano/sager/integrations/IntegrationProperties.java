package br.edu.ifgoiano.sager.integrations;

import org.springframework.core.env.Environment;

import java.net.URI;

public final class IntegrationProperties {
    private final Environment env;

    public IntegrationProperties(Environment env) {
        this.env = env;
        validate();
    }

    public boolean whatsappEnabled() {
        return env.getProperty("sager.integrations.whatsapp.enabled", Boolean.class, false);
    }

    public URI whatsappBaseUrl() {
        try {
            return URI.create(value("base-url", ""));
        } catch (IllegalArgumentException invalid) {
            throw new IllegalArgumentException("Configuração de integração inválida: whatsapp.base-url.");
        }
    }

    public String whatsappApiKey() {
        return value("api-key", "");
    }

    public String whatsappWebhookSecret() {
        return value("webhook-secret", "");
    }

    public String whatsappSession() {
        return value("session", "default");
    }

    private String value(String suffix, String fallback) {
        return env.getProperty("sager.integrations.whatsapp." + suffix, fallback);
    }

    private void validate() {
        if (!whatsappEnabled()) return;
        URI base = whatsappBaseUrl();
        if (!("http".equals(base.getScheme()) || "https".equals(base.getScheme()))
                || base.getHost() == null
                || base.getUserInfo() != null
                || base.getQuery() != null
                || base.getFragment() != null
                || (!base.getPath().isEmpty() && !"/".equals(base.getPath())))
            invalid("whatsapp.base-url");
        required(whatsappApiKey(), "whatsapp.api-key");
        required(whatsappWebhookSecret(), "whatsapp.webhook-secret");
        if (whatsappApiKey().equals(whatsappWebhookSecret())) invalid("whatsapp.webhook-secret");
        if (!whatsappSession().matches("[A-Za-z0-9_-]{1,16}")) invalid("whatsapp.session");
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
