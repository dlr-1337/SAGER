package br.edu.ifgoiano.sager.integrations;

import br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.DocumentRow;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.UUID;

@Configuration
@Profile("local")
public class IntegrationConfiguration {
    @Bean
    IntegrationProperties integrationProperties(Environment env) {
        return new IntegrationProperties(env);
    }

    @Bean
    SignatureProvider signatureProvider(IntegrationProperties properties, ObjectMapper json) {
        if (properties.clicksignEnabled())
            return new ClicksignHttpProvider(
                    client(),
                    properties.clicksignRoot(),
                    properties.clicksignToken(),
                    properties.clicksignEnvironment(),
                    properties.clicksignDownloadHosts(),
                    json,
                    Duration.ofSeconds(20));
        return new SignatureProvider() {
            public boolean available() {
                return false;
            }

            public String environment() {
                return "disabled";
            }

            public UUID prepare(
                    String stage,
                    IntegrationRepository.BindingData binding,
                    DocumentRow document,
                    byte[] original) {
                throw disabled();
            }

            public VerifiedSignature inspect(IntegrationRepository.BindingData binding) {
                throw disabled();
            }

            public void cancel(IntegrationRepository.BindingData binding) {
                throw disabled();
            }
        };
    }

    @Bean
    WhatsAppProvider whatsAppProvider(IntegrationProperties properties, ObjectMapper json) {
        if (properties.whatsappEnabled())
            return new MetaWhatsAppHttpProvider(
                    client(),
                    URI.create("https://graph.facebook.com"),
                    properties.graphVersion(),
                    properties.phoneNumberId(),
                    properties.whatsappToken(),
                    properties.templateName(),
                    json,
                    Duration.ofSeconds(20));
        return new WhatsAppProvider() {
            public boolean available() {
                return false;
            }

            public String send(String recipient, String rawToken) {
                throw disabled();
            }
        };
    }

    private static ProviderFailure disabled() {
        return new ProviderFailure(ProviderFailure.Kind.DISABLED, "provider_disabled");
    }

    private HttpClient client() {
        return HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }
}
