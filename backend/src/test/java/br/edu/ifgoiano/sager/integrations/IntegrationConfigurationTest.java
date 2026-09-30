package br.edu.ifgoiano.sager.integrations;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class IntegrationConfigurationTest {
    private final ApplicationContextRunner runner =
            new ApplicationContextRunner()
                    .withUserConfiguration(IntegrationConfiguration.class)
                    .withPropertyValues("spring.profiles.active=local")
                    .withBean(
                            tools.jackson.databind.ObjectMapper.class,
                            tools.jackson.databind.ObjectMapper::new);

    @Test
    void providersAreDisabledByDefault() {
        runner.run(
                context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context.getBean(SignatureProvider.class).available()).isFalse();
                    assertThat(context.getBean(WhatsAppProvider.class).available()).isFalse();
                });
    }

    @Test
    void rejectsNonOfficialOriginsAndIncompleteSecretsWhenEnabled() {
        runner.withPropertyValues(
                        "sager.integrations.clicksign.enabled=true",
                        "sager.integrations.clicksign.api-base=http://127.0.0.1:9191/api/v3")
                .run(context -> assertThat(context).hasFailed());
        runner.withPropertyValues(
                        "sager.integrations.clicksign.enabled=true",
                        "sager.integrations.clicksign.api-base=https://sandbox.clicksign.com/api/v3",
                        "sager.integrations.clicksign.access-token=synthetic")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void enablesOfficialV3AdapterOnlyWithCompleteExplicitConfiguration() {
        runner.withPropertyValues(
                        "sager.integrations.clicksign.enabled=true",
                        "sager.integrations.clicksign.api-base=https://sandbox.clicksign.com/api/v3",
                        "sager.integrations.clicksign.access-token=synthetic",
                        "sager.integrations.clicksign.webhook-secret=separate-synthetic-secret",
                        "sager.integrations.public-origin=https://sager.example.invalid")
                .run(
                        context -> {
                            assertThat(context).hasNotFailed();
                            assertThat(context.getBean(SignatureProvider.class))
                                    .isInstanceOf(ClicksignHttpProvider.class);
                            assertThat(context.getBean(SignatureProvider.class).environment())
                                    .isEqualTo("sandbox");
                        });
    }

    @Test
    void requiresExplicitGraphVersionWabaNumberAndTemplateWithoutAssumingApproval() {
        runner.withPropertyValues(
                        "sager.integrations.whatsapp.enabled=true",
                        "sager.integrations.whatsapp.access-token=synthetic")
                .run(context -> assertThat(context).hasFailed());
    }
}
