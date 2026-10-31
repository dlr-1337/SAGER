package br.edu.ifgoiano.sager.integrations;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.env.SystemEnvironmentPropertySource;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

class IntegrationConfigurationTest {
    private final ApplicationContextRunner runner =
            new ApplicationContextRunner()
                    .withUserConfiguration(IntegrationConfiguration.class)
                    .withPropertyValues("spring.profiles.active=local")
                    .withBean(
                            tools.jackson.databind.ObjectMapper.class,
                            tools.jackson.databind.ObjectMapper::new);

    @Test
    void gatewayIsDisabledByDefault() {
        runner.run(
                context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context.getBean(WhatsAppGateway.class).available()).isFalse();
                });
    }

    @Test
    void refusesToStartWithIncompleteOrUnsafeConfiguration() {
        String[][] invalid = {
            {"api-key=synthetic-key", "webhook-secret=synthetic-secret"},
            {"base-url=http://gateway.invalid:3000", "webhook-secret=synthetic-secret"},
            {"base-url=http://gateway.invalid:3000", "api-key=synthetic-key"},
            {"base-url=ftp://gateway.invalid", "api-key=a", "webhook-secret=b"},
            {"base-url=http://user@gateway.invalid", "api-key=a", "webhook-secret=b"},
            {"base-url=http://gateway.invalid/api", "api-key=a", "webhook-secret=b"},
            {"base-url=http://gateway.invalid", "api-key=same", "webhook-secret=same"},
            {"base-url=http://gateway.invalid", "api-key=a", "webhook-secret=b", "session=../x"},
        };
        for (String[] properties : invalid) {
            var configured = runner.withPropertyValues("sager.integrations.whatsapp.enabled=true");
            for (String property : properties)
                configured =
                        configured.withPropertyValues("sager.integrations.whatsapp." + property);
            configured.run(context -> assertThat(context).hasFailed());
        }
    }

    @Test
    void completeConfigurationEnablesTheGateway() {
        runner.withPropertyValues(
                        "sager.integrations.whatsapp.enabled=true",
                        "sager.integrations.whatsapp.base-url=http://gateway.invalid:3000",
                        "sager.integrations.whatsapp.api-key=synthetic-key",
                        "sager.integrations.whatsapp.webhook-secret=synthetic-secret")
                .run(
                        context -> {
                            assertThat(context).hasNotFailed();
                            assertThat(context.getBean(WhatsAppGateway.class))
                                    .isInstanceOf(WahaWhatsAppGateway.class);
                            assertThat(context.getBean(IntegrationProperties.class).whatsappSession())
                                    .isEqualTo("default");
                        });
    }

    @Test
    void productionReadsDeployedSecretFilesAndEnvironmentNames(@TempDir Path secrets)
            throws IOException {
        Files.writeString(
                secrets.resolve("SAGER_INTEGRATIONS_WHATSAPP_API_KEY"), "synthetic-key\n");
        Files.writeString(
                secrets.resolve("SAGER_INTEGRATIONS_WHATSAPP_WEBHOOK_SECRET"),
                "synthetic-secret\n");
        var properties =
                production(
                        secrets,
                        Map.of(
                                "SAGER_INTEGRATIONS_WHATSAPP_ENABLED", "true",
                                "SAGER_INTEGRATIONS_WHATSAPP_BASE_URL",
                                        "http://whatsapp-gateway-proxy:3000"));
        assertThat(properties.whatsappEnabled()).isTrue();
        assertThat(properties.whatsappBaseUrl())
                .isEqualTo(URI.create("http://whatsapp-gateway-proxy:3000"));
        assertThat(properties.whatsappApiKey()).isEqualTo("synthetic-key");
        assertThat(properties.whatsappWebhookSecret()).isEqualTo("synthetic-secret");
    }

    @Test
    void disabledProductionStartsWhenDockerMountedDirectoriesInPlaceOfMissingSecrets(
            @TempDir Path secrets) throws IOException {
        Files.createDirectory(secrets.resolve("SAGER_INTEGRATIONS_WHATSAPP_API_KEY"));
        Files.createDirectory(secrets.resolve("SAGER_INTEGRATIONS_WHATSAPP_WEBHOOK_SECRET"));
        var properties =
                production(secrets, Map.of("SAGER_INTEGRATIONS_WHATSAPP_ENABLED", "false"));
        assertThat(properties.whatsappEnabled()).isFalse();
        assertThat(properties.whatsappApiKey()).isEmpty();
    }

    private IntegrationProperties production(Path secrets, Map<String, Object> variables) {
        var environment = new StandardEnvironment();
        environment
                .getPropertySources()
                .replace(
                        StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME,
                        new SystemEnvironmentPropertySource(
                                StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME,
                                variables));
        try (var context =
                new SpringApplicationBuilder(Empty.class)
                        .web(WebApplicationType.NONE)
                        .environment(environment)
                        .profiles("production")
                        .properties(
                                "spring.config.import=configtree:"
                                        + secrets.toString().replace('\\', '/')
                                        + "/")
                        .run()) {
            return new IntegrationProperties(context.getEnvironment());
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class Empty {}
}
