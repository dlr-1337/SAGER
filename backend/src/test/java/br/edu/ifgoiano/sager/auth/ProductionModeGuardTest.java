package br.edu.ifgoiano.sager.auth;

import static org.assertj.core.api.Assertions.*;

import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.mock.env.MockEnvironment;

class ProductionModeGuardTest {
    private MockEnvironment valid() {
        var environment = new MockEnvironment()
                .withProperty("server.forward-headers-strategy", "framework")
                .withProperty("server.servlet.session.cookie.secure", "true")
                .withProperty("spring.flyway.enabled", "false")
                .withProperty("springdoc.api-docs.enabled", "false")
                .withProperty("spring.datasource.username", "sager_runtime")
                .withProperty("spring.datasource.password", "Synthetic_runtime_password_20260930_123")
                .withProperty("sager.production.rate-limit-secret", "Synthetic_login_counter_secret_20260930_123")
                .withProperty("sager.production.public-host", "sager.example.test");
        environment.setActiveProfiles("production");
        return environment;
    }

    @Test
    void rejectsCombinedProfilesBeforeAnyDatabaseInitialization() {
        var environment = valid();
        environment.setActiveProfiles("production", "local");
        refusesBeforeDatabase(environment);
    }

    @Test
    void rejectsEnabledFlywayBeforeAnyDatabaseInitialization() {
        refusesBeforeDatabase(valid().withProperty("spring.flyway.enabled", "true"));
    }

    private void refusesBeforeDatabase(MockEnvironment environment) {
        AtomicBoolean initialized = new AtomicBoolean();
        try (var context = new AnnotationConfigApplicationContext()) {
            context.setEnvironment(environment);
            context.registerBean("databaseInitialization", Object.class, () -> {
                initialized.set(true);
                return new Object();
            });
            context.register(ProductionModeGuard.class);
            assertThatThrownBy(context::refresh).isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Production requires");
            assertThat(initialized).isFalse();
        }
    }
}
