package br.edu.ifgoiano.sager.integrations;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

import tools.jackson.databind.ObjectMapper;

import java.net.http.HttpClient;
import java.time.Duration;

@Configuration
@Profile({ "local", "production" })
public class IntegrationConfiguration {
    @Bean
    IntegrationProperties integrationProperties(Environment env) {
        return new IntegrationProperties(env);
    }

    @Bean
    WhatsAppGateway whatsAppGateway(IntegrationProperties properties, ObjectMapper json) {
        if (!properties.whatsappEnabled()) return new WhatsAppGateway() {};
        return new WahaWhatsAppGateway(
                HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(5))
                        .followRedirects(HttpClient.Redirect.NEVER)
                        .build(),
                properties.whatsappBaseUrl(),
                properties.whatsappApiKey(),
                properties.whatsappSession(),
                json,
                Duration.ofSeconds(20));
    }
}
